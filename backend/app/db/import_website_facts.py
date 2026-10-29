"""
Accreditation facts and evidence from the college website, read from the pages CampusSphere's crawler stored
(knowledge base: python -c "from backend.app.knowledge.service import refresh; refresh('admin')").

  facts     established, affiliation, autonomy, Principal, NAAC and NBA status, NIRF / AISHE IDs, ISO, research
            centres... each with the page it came from, UNCONFIRMED until the IQAC confirms it in the workspace
  evidence  documents the website publishes per year, attached to the metric they support as links (the SSR's
            hyperlinks): mentor lists (2.3.3), NSS reports (3.4.3), IIC members (3.2.1), strategic plans (6.2.1),
            NIRF data (6.5.3). Only where the year and the metric are unambiguous.

Run again after a new crawl: facts are refreshed (confirmed ones are kept), links are added once.

Usage (from the project root):
    python backend/app/db/import_website_facts.py
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.db.migrations import ensure_columns  # noqa: E402
from backend.app.db.session import Base, SessionLocal, engine  # noqa: E402
from backend.app.models import accreditation as _accr, campus as _campus  # noqa: E402,F401  (users table for the foreign keys)
from backend.app.models.accreditation import AccrEvidenceModel, InstitutionFactModel  # noqa: E402
from backend.app.models.knowledge import KbDocumentModel  # noqa: E402

SITE = "college website"


def page(db, article_id: int):
    return db.query(KbDocumentModel).filter(KbDocumentModel.url.like(f"%id={article_id}&%")).first()


def links(db, pattern: str):
    return db.query(KbDocumentModel).filter(KbDocumentModel.title.like(pattern)).all()


def year_of(title: str):
    """'NSS 2023-2024' / 'Counselors & Advisors 2021-2022' -> '2023-24'."""
    m = re.search(r"(20\d\d)\s*[-–]\s*(20)?(\d\d)", title)
    return f"{m.group(1)}-{m.group(3)}" if m else None


def fact(db, key, value, url, n):
    f = db.query(InstitutionFactModel).filter(InstitutionFactModel.key == key).first()
    if f and f.verified:
        return n                                   # the IQAC confirmed it: keep their version
    f = f or InstitutionFactModel(key=key)
    f.value, f.source_url, f.verified, f.updated_by = value, url, False, "website crawler"
    db.add(f)
    return n + 1


def main():
    Base.metadata.create_all(bind=engine)
    ensure_columns(engine)
    db = SessionLocal()
    try:
        if not db.query(KbDocumentModel.id).first():
            sys.exit("The college website hasn't been crawled yet (knowledge base is empty)")
        n_facts = n_links = 0
        profile, milestones, principal = page(db, 648), page(db, 160), page(db, 139)
        nba, nirf, iqac = page(db, 1740), page(db, 1803), page(db, 1753)

        if profile:
            t = profile.text
            if "established in 1981" in t:
                n_facts = fact(db, "established", "1981, by the Matrusri Education Society", profile.url, n_facts)
            if "Osmania University" in t:
                n_facts = fact(db, "affiliation", "Osmania University, Hyderabad", profile.url, n_facts)
            if "ISO 9001:2015" in t:
                n_facts = fact(db, "iso", "ISO 9001:2015 certified", profile.url, n_facts)
            m = re.search(r"B\.E programs in ([^.]+?), PG programs in ([^.]+?) besides MBA", t)
            if m:
                n_facts = fact(db, "programmes", f"UG (B.E.): {m.group(1)}\nPG: {m.group(2)}, MBA", profile.url, n_facts)
            if "Ph.D" in t:
                n_facts = fact(db, "research_centres", "Recognised by Osmania University as research centres (Ph.D.) in CSE, ECE "
                                                       "and Mechanical Engineering (2017)", profile.url, n_facts)
            if "about a 1000 students" in t:
                n_facts = fact(db, "intake", "About 1,000 students admitted a year; over 200 faculty", profile.url, n_facts)
        if milestones:
            t = milestones.text
            if "UGC Autonomous status" in t:
                n_facts = fact(db, "autonomous", "UGC autonomous status conferred in 2021 for 10 years (to 2031)", milestones.url, n_facts)
            if "Accredited by NAAC" in t:
                n_facts = fact(db, "naac_status",
                               "Accredited by NAAC in 2019 (website Milestones). The grade and validity are not stated in the "
                               "page text; the institutional grade sheet is linked from the NIRF page.\n"
                               "A NAAC accreditation is valid for 5 years: a 2019 accreditation ran to about 2024, so "
                               "re-accreditation (or its outcome) should be confirmed.", milestones.url, n_facts)
            if "NIRF-2020" in t:
                n_facts = fact(db, "nirf_rank", "NIRF 2020: 251-300 rank band (Engineering)", milestones.url, n_facts)
        if nba:
            grants = re.findall(r"Grant Date:\s*([\d\s-]+?)\s*\(Validity upto ([\d-]+)\)", nba.text)
            if grants:
                lines = [f"Granted {g.replace(' ', '')}, valid to {v}" for g, v in grants]
                n_facts = fact(db, "nba_status",
                               "NBA accreditation of the UG programmes (2018: Civil, CSE, ECE, EEE, Mechanical, IT):\n" +
                               "\n".join(lines) + "\nThe latest grant published on the website is valid to 30-06-2025: "
                               "confirm whether it has been renewed.", nba.url, n_facts)
        if nirf:
            m = re.search(r"Institution ID \(Engineering\) : (\S+)", nirf.text)
            if m:
                n_facts = fact(db, "nirf_id", f"NIRF institution ID (Engineering): {m.group(1)}; AISHE code C-25615", nirf.url, n_facts)
        if principal and "Marthi Kameswara Rao" in principal.text:
            n_facts = fact(db, "principal", "Dr. Marthi Kameswara Rao (Professor of Civil Engineering; Ph.D. IIT Bombay). "
                                            "The website names him the central coordinator for NAAC.", principal.url, n_facts)
        if iqac:
            n_facts = fact(db, "iqac", "IQAC page: members list and the Strategic Plans 2018-2023 and 2023-2028. No AQAR "
                                       "(Annual Quality Assurance Report) is published on the website: NAAC expects each "
                                       "year's AQAR to be on the website.", iqac.url, n_facts)

        # ── Year-wise documents as evidence links ──
        def attach(code, title_pattern, title_fmt, years=None):
            nonlocal n_links
            for d in links(db, title_pattern):
                for y in (years or [year_of(d.title)]):
                    if not y:
                        continue
                    exists = db.query(AccrEvidenceModel.id).filter(AccrEvidenceModel.framework == "naac", AccrEvidenceModel.code == code,
                                                                   AccrEvidenceModel.year == y, AccrEvidenceModel.url == d.url).first()
                    if not exists:
                        db.add(AccrEvidenceModel(framework="naac", code=code, programme="", year=y, title=title_fmt.format(t=d.title),
                                                 kind="link", url=d.url, source=SITE))
                        n_links += 1

        attach("2.3.3", "Counselors & Advisors 20%", "Mentor (counsellor) list: {t}")
        attach("3.4.3", "NSS - National Service Scheme 20%", "NSS activities: {t}")
        attach("3.2.1", "Members of IIC 20%", "Institution's Innovation Council: {t}")
        attach("6.2.1", "Strategic Plan 2018-2023", "{t}", ["2021-22", "2022-23"])
        attach("6.2.1", "Strategic Plan 2023-2028", "{t}", ["2023-24", "2024-25", "2025-26"])
        attach("6.5.3", "NIRF Engineering", "NIRF data submitted (Engineering)", ["2025-26"])
        attach("6.5.3", "%Annual Report", "College annual report: {t}")
        db.commit()
    finally:
        db.close()
    print(f"Facts recorded (to confirm by the IQAC): {n_facts} · evidence links attached: {n_links}")


if __name__ == "__main__":
    main()

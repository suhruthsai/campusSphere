"""
Faculty and research figures per academic year, as NBA criterion 5 and NAAC 2.4 / 3 / 6.3 ask for them. Only
verified research items count.

  in position   regular and contract faculty whose service covers any part of the year (Jul 1 - Jun 30)
  S             students of the programme's 2nd, 3rd and 4th years (admitted + lateral of those batches)
  SFR (5.1)     S / faculty in position;   RF = S / 20 (faculty required)
  FCR (5.2)     cadre proportion against the 1 : 2 : 6 norm: (AF1/RF1 + 0.6 AF2/RF2 + 0.4 AF3/RF3) x 12.5, at most 25
  FQI (5.3)     2.5 x (10X + 4Y) / F, X = PhDs, Y = M.Tech / M.E, F = max(faculty in position, RF), at most 25
  retention     share of the faculty two years earlier still in position (5.4)
  NAAC          % with PhD (2.4.2), average teaching experience (2.4.3), grants (3.1.1), % with projects (3.1.3),
                journal papers per teacher (3.3.2), books / chapters / proceedings per teacher (3.3.3),
                % attending FDPs (6.3.4), extension (3.4.3), collaborations (3.5.1), MoUs (3.5.2), IPR workshops (3.2.2)
"""
from collections import Counter
from datetime import date

from sqlalchemy.orm import Session

from backend.app.models.feedback import BatchOutcomeModel
from backend.app.models.research import DeptActivityModel, FacultyRecordModel, ResearchItemModel

PUBLICATIONS = ("journal",)
BOOKISH = ("book", "chapter", "conference")


def bounds(year: str) -> tuple:
    y = int(year[:4])
    return date(y, 7, 1), date(y + 1, 6, 30)


def in_position(records: list, year: str, include_visiting: bool = False) -> list:
    start, end = bounds(year)
    return [r for r in records if r.joined_on <= end and (r.left_on is None or r.left_on >= start)
            and (include_visiting or r.nature in ("regular", "contract"))]


def students(db: Session, programme: str, year: str):
    """2nd-4th year students of the programme in that year, from the admission batches (None if unknown)."""
    y = int(year[:4])
    batches = {b.batch: b for b in db.query(BatchOutcomeModel).filter(BatchOutcomeModel.programme == programme)}
    have = [batches.get(y - k) for k in (1, 2, 3)]
    if any(b is None for b in have):
        return None
    return sum(b.admitted + (b.lateral or 0) for b in have)


def experience(r: FacultyRecordModel, year: str) -> float:
    _start, end = bounds(year)
    served = ((min(end, r.left_on or end) - r.joined_on).days / 365.25)
    return max(0.0, r.prior_experience + served)


def year_summary(db: Session, programme: str, year: str) -> dict:
    records = db.query(FacultyRecordModel).filter(FacultyRecordModel.department == programme).all()
    fac = in_position(records, year)
    F = len(fac)
    S = students(db, programme, year)
    RF = S / 20 if S else None
    cadre = Counter(r.designation for r in fac)
    phd = sum(1 for r in fac if r.qualification == "PhD")
    mtech = sum(1 for r in fac if r.qualification in ("M.Tech", "M.E"))
    fcr = fqi = None
    if RF:
        rf1, rf2, rf3 = RF / 9, 2 * RF / 9, 6 * RF / 9
        fcr = min(25.0, (cadre["Professor"] / rf1 + 0.6 * cadre["Associate Professor"] / rf2 +
                         0.4 * cadre["Assistant Professor"] / rf3) * 12.5)
        fqi = min(25.0, 2.5 * (10 * phd + 4 * mtech) / max(F, RF)) if F else 0.0
    prev = in_position(records, f"{int(year[:4]) - 2}-{(int(year[:4]) - 1) % 100:02d}")
    retained = sum(1 for r in prev if r in fac)
    ids = [r.id for r in fac]
    items = db.query(ResearchItemModel).filter(ResearchItemModel.department == programme, ResearchItemModel.year == year,
                                               ResearchItemModel.verified == True).all()  # noqa: E712
    k = Counter(i.kind for i in items)
    indexed = sum(1 for i in items if i.kind == "journal" and i.indexing in ("scopus", "wos", "ugc_care"))
    projects = [i for i in items if i.kind == "project"]
    with_projects = {i.faculty_id for i in projects}
    fdp_people = {i.faculty_id for i in items if i.kind in ("fdp_attended", "resource_person")}
    acts = Counter(a.kind for a in db.query(DeptActivityModel).filter(
        DeptActivityModel.year == year, (DeptActivityModel.department == programme) | (DeptActivityModel.department.is_(None))))
    pending = db.query(ResearchItemModel).filter(ResearchItemModel.department == programme, ResearchItemModel.year == year,
                                                 ResearchItemModel.verified == False).count()  # noqa: E712
    r2 = lambda x: round(x, 2) if x is not None else None  # noqa: E731
    return {
        "year": year, "faculty": F, "students": S, "required": r2(RF), "sfr": r2(S / F) if S and F else None,
        "cadre": {"Professor": cadre["Professor"], "Associate Professor": cadre["Associate Professor"],
                  "Assistant Professor": cadre["Assistant Professor"]},
        "fcr_marks": r2(fcr), "phd": phd, "mtech": mtech, "fqi_marks": r2(fqi),
        "phd_pct": round(100 * phd / F, 1) if F else None,
        "avg_experience": round(sum(experience(r, year) for r in fac) / F, 1) if F else None,
        "retention_pct": round(100 * retained / len(prev), 1) if prev else None, "retained": retained, "two_years_ago": len(prev),
        "visiting": len(in_position(records, year, True)) - F,
        "journals": k["journal"], "indexed_journals": indexed, "conferences": k["conference"], "books": k["book"] + k["chapter"],
        "patents": k["patent"], "phd_guided": k["phd_guided"], "awards": k["award"],
        "projects": len(projects), "grants_lakh": r2(sum(i.amount_lakh or 0 for i in projects)),
        "consultancy_lakh": r2(sum(i.amount_lakh or 0 for i in items if i.kind == "consultancy")),
        "fdp_attended": k["fdp_attended"], "fdp_organised": k["fdp_organised"], "resource_person": k["resource_person"],
        "papers_per_teacher": r2(indexed / F) if F else None,
        "bookish_per_teacher": r2(sum(k[x] for x in BOOKISH) / F) if F else None,
        "projects_pct": round(100 * len(with_projects & set(ids)) / F, 1) if F else None,
        "fdp_pct": round(100 * len(fdp_people & set(ids)) / F, 1) if F else None,
        "mous": acts["mou"], "extension": acts["extension"], "collaborations": acts["collaboration"], "ipr_workshops": acts["ipr_workshop"],
        "unverified": pending,
    }


def years_with_data(db: Session, programme: str) -> list:
    ys = {y for (y,) in db.query(ResearchItemModel.year).filter(ResearchItemModel.department == programme).distinct()}
    ys |= {y for (y,) in db.query(DeptActivityModel.year).distinct()}
    return sorted(ys)

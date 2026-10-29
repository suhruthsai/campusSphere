"""
Set up a branch's approval chain in one go: HOD, Associate HODs (per section letter, e.g. all A sections), a class
in-charge for every section, and mentors for every student. Requests then route
mentor -> class in-charge -> Associate HOD -> HOD -> principal.

  - --hod / --ahod name faculty by part of their name ("Krishna Prasad", "A=Samson"). A name with no account gets
    a new faculty account in the branch (placeholder email; login written to faculty_accounts.local.txt);
  - only teachers mentor or take a class: the HOD and Associate HODs are left out;
  - class in-charge of a section: the teacher with the most periods in it (timetable), one section each;
  - mentors: only as many as needed, one per --per-mentor students (default 35), so 2 for a class of 70; taken
    from teachers of that section, never its class in-charge (the request would reach the same person twice),
    each teacher mentoring one group where possible. Students get consecutive roll numbers. This REPLACES the
    branch's current mentors;
  - --dry-run shows the plan without saving.

Usage (from the project root):
    python backend/app/db/setup_branch_approvers.py --branch IT --hod "Krishna Prasad" \\
        --ahod "A=Samson" --ahod "B=Vijaya Bhaskar" --ahod "C=Venu Gopal" --dry-run
"""
import argparse
import re
import secrets
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.core.security import get_password_hash  # noqa: E402
from backend.app.db.migrations import ensure_columns  # noqa: E402
from backend.app.db.session import Base, SessionLocal, engine  # noqa: E402
from backend.app.models.campus import TimetableEntryModel, UserModel  # noqa: E402
from backend.app.models.services import ApproverAssignmentModel, RosterEntryModel, StudentProfileModel  # noqa: E402

FACULTY_LOGINS = Path(__file__).resolve().parent / "faculty_accounts.local.txt"


def _norm(s: str) -> str:
    return re.sub(r"[^a-z]", "", (s or "").lower())


def find_or_create(db, name: str, branch: str, faculty: list, created: list, dry_run: bool) -> UserModel:
    hits = [f for f in faculty if _norm(name) in _norm(f.name)]
    if len(hits) > 1:
        sys.exit(f"{name!r} matches several faculty: {[f.name for f in hits]}; give more of the name")
    if hits:
        return hits[0]
    slug = _norm(name)
    pw = secrets.token_urlsafe(9)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    user = UserModel(id=f"u_fac_{slug}", name=name.strip(), email=f"{slug}@faculty.campussphere.example", role="faculty",
                     department=branch, status="active", hashed_password=get_password_hash(pw), must_change_password=True, joined_at=today, last_active=today)
    if not dry_run:
        db.add(user)
    faculty.append(user)
    created.append((branch, user.name, user.email, pw))
    return user


def assign(db, role, user_id, branch, year=None, section=None):
    db.query(ApproverAssignmentModel).filter(
        ApproverAssignmentModel.role == role, ApproverAssignmentModel.department == branch,
        ApproverAssignmentModel.year.is_(None) if year is None else ApproverAssignmentModel.year == year,
        ApproverAssignmentModel.section.is_(None) if section is None else ApproverAssignmentModel.section == section,
    ).delete(synchronize_session=False)
    db.add(ApproverAssignmentModel(role=role, user_id=user_id, department=branch, year=year, section=section))


def main():
    ap = argparse.ArgumentParser(description="Set up a branch's HOD, Associate HODs, class in-charges and mentors")
    ap.add_argument("--branch", required=True)
    ap.add_argument("--hod", required=True)
    ap.add_argument("--ahod", action="append", default=[], help='"A=Name" for all A sections, or "Name" for the branch')
    ap.add_argument("--per-mentor", type=int, default=35, help="Students per mentor (default 35)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    branch = args.branch.strip().upper()
    Base.metadata.create_all(bind=engine)
    ensure_columns(engine)
    db = SessionLocal()
    created, report = [], []
    try:
        faculty = db.query(UserModel).filter(UserModel.role == "faculty", UserModel.department == branch,
                                             UserModel.status == "active").order_by(UserModel.name).all()
        hod = find_or_create(db, args.hod, branch, faculty, created, args.dry_run)
        ahods = {}
        for spec in args.ahod:
            sec, _, name = spec.rpartition("=")
            ahods[sec.strip().upper() or None] = find_or_create(db, name, branch, faculty, created, args.dry_run)
        heads = {hod.id} | {u.id for u in ahods.values()}
        teachers = {f.id: f for f in faculty if f.id not in heads}
        by_staff = {f.staff_id: f.id for f in faculty if f.staff_id}

        # Periods each teacher has in each section of this branch, e.g. IT-3A -> {u_fac_..: 9}
        periods = defaultdict(Counter)
        for e in db.query(TimetableEntryModel).filter(TimetableEntryModel.is_active == True,  # noqa: E712
                                                      TimetableEntryModel.section.like(f"{branch}-%")):
            uid = by_staff.get(e.faculty_id)
            if uid in teachers:
                periods[e.section][uid] += 1

        profiles = db.query(StudentProfileModel).filter(StudentProfileModel.department == branch).all()
        classes = defaultdict(list)
        for p in profiles:
            if p.year and p.section:
                classes[(p.year, p.section.upper())].append(p)

        incharge, used_incharge = {}, set()
        for (year, sec) in sorted(classes):
            ranked = [u for u, _ in periods[f"{branch}-{year}{sec}"].most_common()] + sorted(teachers, key=lambda u: teachers[u].name)
            incharge[(year, sec)] = next(u for u in ranked if u not in used_incharge)
            used_incharge.add(incharge[(year, sec)])

        groups = Counter()
        mentor_plan = []
        for (year, sec), studs in sorted(classes.items()):
            studs.sort(key=lambda p: p.roll_no or "")
            need = max(1, round(len(studs) / args.per_mentor))   # 71 students at 35 each: 2 mentors, not 3
            teach = [u for u, _ in periods[f"{branch}-{year}{sec}"].most_common()]
            pool = teach + [u for u in sorted(teachers, key=lambda u: teachers[u].name) if u not in teach]
            pool = [u for u in pool if u != incharge[(year, sec)]]
            chosen = []
            for limit in range(0, 10):            # teachers with no mentor group first, then one, ...
                for u in pool:
                    if len(chosen) < need and u not in chosen and groups[u] <= limit:
                        chosen.append(u)
                if len(chosen) == need:
                    break
            for u in chosen:
                groups[u] += 1
            size, extra = divmod(len(studs), need)
            i = 0
            for k, u in enumerate(chosen):
                n = size + (1 if k < extra else 0)
                for p in studs[i:i + n]:
                    p.mentor_id = u
                mentor_plan.append((f"{branch}-{year}{sec}", teachers[u].name, n, studs[i].roll_no, studs[i + n - 1].roll_no))
                i += n

        if not args.dry_run:
            assign(db, "hod", hod.id, branch)
            # An AHOD for the whole branch replaces section ones and vice versa only within the same scope
            for sec, u in ahods.items():
                assign(db, "ahod", u.id, branch, None, sec)
            for (year, sec), u in incharge.items():
                assign(db, "class_incharge", u, branch, year, sec)
            db.commit()
        else:
            db.rollback()
        report = {
            "hod": hod.name,
            "ahod": {s or "all": u.name for s, u in ahods.items()},
            "incharge": {f"{branch}-{y}{s}": teachers[u].name for (y, s), u in sorted(incharge.items())},
        }
    finally:
        db.close()

    print(("DRY RUN · " if args.dry_run else "") + f"{branch}: HOD {report['hod']}; Associate HODs {report['ahod']}")
    print("Class in-charges:")
    for s, n in report["incharge"].items():
        print(f"  {s}: {n}")
    print("Mentors:")
    for s, name, n, a, b in mentor_plan:
        print(f"  {s}: {name:<24} {n:>3} students  {a} -> {b}")
    mentors = {m[1] for m in mentor_plan}
    print(f"{len(mentors)} mentors for {sum(m[2] for m in mentor_plan)} students; "
          f"{len(set(report['incharge'].values()) | mentors)} teachers in all.")
    if created:
        print("New faculty accounts: " + ", ".join(f"{c[1]} <{c[2]}>" for c in created))
    if created and not args.dry_run:
        stamp = f"# {branch} approvers · created {datetime.now():%d %b %Y %H:%M}"
        lines = [stamp] + [f"{d:<14} {n:<32} {e:<34} {pw}" for d, n, e, pw in created]
        prev = FACULTY_LOGINS.read_text(encoding="utf-8") if FACULTY_LOGINS.exists() else ""
        FACULTY_LOGINS.write_text(prev + "\n".join(lines) + "\n", encoding="utf-8")
        print(f"Logins written to {FACULTY_LOGINS}")


if __name__ == "__main__":
    main()

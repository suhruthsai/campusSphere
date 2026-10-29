"""
Generate the IT pilot: what four weeks of using CampusSphere for attendance, notices and certificate requests
looks like, built on the real IT data (roll list, timetable, teachers, mentors, class in-charges, AHODs, HOD).

  dates         the pilot as first run: Mon 21 Sep to Tue 27 Oct 2026 with the Dussehra break 20-24 Oct. Run
                later, everything moves forward by whole weeks (weekdays stay the same) and the classes run up
                to yesterday, so the pilot always ends "now": nothing looks weeks old in a demo;
  attendance    every IT period (Mon-Sat, none in the break) marked by its teacher, or by the substitute when the teacher was away. Students keep
                a steady habit: most are regular, some sit in the condonation band (65-75%), a few are below 65%.
                Mondays, Saturdays, last periods and the days around the break are thinner. A few periods were
                marked late and about 2% never;
  electives     3rd-year students each take one of Disaster Mitigation / Operations Research / Soft Skills;
  substitutions a handful of teacher absences, arranged by the section's AHOD or the HOD;
  notices       posted by the HOD, AHODs and class in-charges, to the department, a year or a section;
  requests      bonafide and NOC requests through mentor -> class in-charge -> AHOD -> HOD -> principal:
                most issued, some waiting (a few overdue), a few rejected or withdrawn;
  sign-ins      students and staff signing in over the four weeks (adoption).

Every generated row carries pilot_run = RUN, so `--remove` deletes exactly this data and nothing real. Real
student profiles and passwords are never touched. Generated certificates are never valid: the public QR check
refuses them and their PDF says SAMPLE - NOT VALID.

Usage (from the project root):
    python backend/app/db/generate_it_pilot.py            # (re)generate; removes an earlier run first
    python backend/app/db/generate_it_pilot.py --remove   # remove it all
"""
import argparse
import random
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from sqlalchemy import insert  # noqa: E402

from backend.app.db.migrations import ensure_columns  # noqa: E402
from backend.app.db.session import Base, SessionLocal, engine  # noqa: E402
from backend.app.attendance import core as A  # noqa: E402
from backend.app.models.attendance import AttendanceGroupModel, AttendanceMarkModel, AttendanceSessionModel  # noqa: E402
from backend.app.models.campus import (  # noqa: E402
    AnnouncementModel, SignInEventModel, SubstitutionModel, TimetableEntryModel, UserModel,
)
from backend.app.models.services import ApproverAssignmentModel, DocumentRequestModel, RosterEntryModel, StudentProfileModel  # noqa: E402
from backend.app.student_services import workflow  # noqa: E402
from backend.app.student_services.catalog import DOC_TYPES  # noqa: E402

RUN = "it-pilot-2026"
BRANCH = "IT"
IST = timedelta(hours=5, minutes=30)
rng = random.Random(2026)

# The pilot as first generated (the day after it ended: 28 Oct 2026). Later runs shift it by whole weeks.
FIRST_RUN = date(2026, 10, 28)
TODAY = (datetime.utcnow() + IST).date()
SHIFT = timedelta(days=max(0, (TODAY - FIRST_RUN).days) // 7 * 7)
START = date(2026, 9, 21) + SHIFT
END = TODAY - timedelta(days=1)                                         # classes up to yesterday
BREAK_START = date(2026, 10, 20) + SHIFT
HOLIDAYS = {BREAK_START + timedelta(days=i) for i in range(5)}
BREAK_NAME = "Dussehra" if not SHIFT else "mid-semester"


def D(month: int, day: int) -> date:
    """A date of the first run, moved with the pilot."""
    return date(2026, month, day) + SHIFT


def say(d: date) -> str:
    return f"{d.day} {d:%B}"


def utc(day: date, hhmm: str, plus_minutes: float = 0) -> datetime:
    h, m = map(int, hhmm.split(":"))
    return datetime.combine(day, datetime.min.time()).replace(hour=h, minute=m) - IST + timedelta(minutes=plus_minutes)


def working_days():
    d = START
    while d <= END:
        if d.weekday() != 6 and d not in HOLIDAYS:
            yield d
        d += timedelta(days=1)


# ── Remove ───────────────────────────────────────────────────────────────────────
def remove(db) -> dict:
    sess = [s for (s,) in db.query(AttendanceSessionModel.id).filter(AttendanceSessionModel.pilot_run == RUN)]
    n = {"marks": 0}
    for i in range(0, len(sess), 500):
        n["marks"] += db.query(AttendanceMarkModel).filter(AttendanceMarkModel.session_id.in_(sess[i:i + 500])).delete(synchronize_session=False)
    for name, model in (("sessions", AttendanceSessionModel), ("groups", AttendanceGroupModel), ("substitutions", SubstitutionModel),
                        ("notices", AnnouncementModel), ("requests", DocumentRequestModel), ("sign_ins", SignInEventModel)):
        n[name] = db.query(model).filter(model.pilot_run == RUN).delete(synchronize_session=False)
    db.commit()
    return n


# ── Students' habits ─────────────────────────────────────────────────────────────
def habit(roll: str) -> float:
    """How likely this student is to come to a class (stable per roll number)."""
    r = random.Random(roll).random()
    if r < 0.75:
        return random.Random(roll + "a").uniform(0.86, 0.985)     # regular
    if r < 0.90:
        return random.Random(roll + "b").uniform(0.68, 0.80)      # borderline: condonation band
    if r < 0.97:
        return random.Random(roll + "c").uniform(0.50, 0.66)      # at risk
    return random.Random(roll + "d").uniform(0.15, 0.40)          # hardly comes


def day_factor(d: date) -> float:
    f = 1.0
    if d.weekday() == 0:
        f -= 0.03
    if d.weekday() == 5:
        f -= 0.06
    if d == BREAK_START - timedelta(days=1) or BREAK_START + timedelta(days=6) <= d <= BREAK_START + timedelta(days=7):
        f -= 0.07                                                  # around the break
    return f


# ── Attendance ───────────────────────────────────────────────────────────────────
def attendance(db, entries, staff_user, roster, members_of, absences):
    """absences: {(faculty_id, date): substitute faculty id per (section, period)}"""
    sessions = marks = unmarked = late_marked = 0
    present_today = {}
    for d in working_days():
        dow = d.weekday()
        todays = [e for e in entries if e.day_of_week == dow]
        for e in todays:
            if rng.random() < 0.02:
                unmarked += 1                                      # the teacher never marked it
                continue
            sub = absences.get((e.faculty_id, d, e.section, e.period_number))
            marker = staff_user.get(sub or e.faculty_id)
            r = rng.random()
            delay = rng.uniform(1, 15) if r < 0.72 else rng.uniform(40, 240) if r < 0.94 else rng.uniform(16 * 60, 30 * 60)
            late_marked += delay > 60
            res = db.execute(insert(AttendanceSessionModel).values(
                timetable_entry_id=e.id, date=d, section=e.section, department=BRANCH, subject_name=e.subject_name,
                batch=e.batch, period_number=e.period_number, marked_by=marker.id if marker else None,
                marked_by_name=marker.name if marker else None, marked_at=utc(d, e.end_time, delay),
                updated_at=utc(d, e.end_time, delay), pilot_run=RUN))
            sid = res.inserted_primary_key[0]
            sessions += 1
            last = e.period_number >= 5
            rows = []
            for st in members_of(e):
                key = (st.roll_no, d)
                if key not in present_today:                       # whole-day absence decided once a day
                    p = habit(st.roll_no) * day_factor(d)
                    present_today[key] = rng.random() < min(0.995, p + (1 - p) * 0.35)
                if not present_today[key]:
                    status = "absent"
                else:
                    p = habit(st.roll_no) - (0.04 if last else 0)
                    status = "present" if rng.random() < min(0.995, 0.65 + p * 0.35) else "absent"
                    if status == "present" and e.period_number in (1, 5) and rng.random() < 0.04:
                        status = "late"
                rows.append({"session_id": sid, "roll_no": st.roll_no, "status": status})
            if rows:
                db.execute(insert(AttendanceMarkModel), rows)
                marks += len(rows)
    return sessions, marks, unmarked, late_marked


# ── Main ─────────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Generate (or remove) the IT pilot data")
    ap.add_argument("--remove", action="store_true")
    args = ap.parse_args()
    Base.metadata.create_all(bind=engine)
    ensure_columns(engine)
    db = SessionLocal()
    try:
        gone = remove(db)
        if args.remove:
            print(f"Removed the IT pilot data: {gone}")
            return
        if any(gone.values()):
            print(f"Removed the earlier run first: {gone}")

        entries = db.query(TimetableEntryModel).filter(TimetableEntryModel.is_active == True,  # noqa: E712
                                                       TimetableEntryModel.section.like(f"{BRANCH}-%")).all()
        users = db.query(UserModel).all()
        staff_user = {u.staff_id: u for u in users if u.staff_id}
        by_id = {u.id: u for u in users}
        sections = sorted({e.section for e in entries})
        roster = {s: A.class_list(db, s) for s in sections}

        # Electives (3rd year): each student takes one of the section's parallel electives
        groups = defaultdict(set)
        n_groups = 0
        for s in sections:
            electives = sorted({e.batch for e in entries if e.section == s and e.batch and e.batch not in A.SPLIT_BATCHES})
            if not electives:
                continue
            for i, st in enumerate(roster[s]):
                choice = electives[random.Random(st.roll_no + "elective").randrange(len(electives))]
                groups[(s, choice)].add(st.roll_no)
                db.add(AttendanceGroupModel(section=s, batch=choice, roll_no=st.roll_no, member=1, pilot_run=RUN))
                n_groups += 1
        db.flush()

        def members_of(e):
            if not e.batch:
                return roster[e.section]
            if e.batch in A.SPLIT_BATCHES:
                return A.group_members(db, e.section, e.batch, roster[e.section])
            return [r for r in roster[e.section] if r.roll_no in groups[(e.section, e.batch)]]

        # Substitutions: some teacher absences, arranged by the section's AHOD (or the HOD)
        assign = db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.department == BRANCH).all()
        hod = next(a.user_id for a in assign if a.role == "hod")
        ahod = {a.section: a.user_id for a in assign if a.role == "ahod"}
        it_teachers = sorted({e.faculty_id for e in entries if e.faculty_id in staff_user and staff_user[e.faculty_id].department == BRANCH})
        busy = defaultdict(set)
        for e in entries:
            busy[(e.day_of_week, e.period_number)].add(e.faculty_id)
        absences, n_subs = {}, 0
        days = list(working_days())
        for d in rng.sample(days, 9):
            fac = rng.choice(it_teachers)
            for e in [e for e in entries if e.faculty_id == fac and e.day_of_week == d.weekday()]:
                free = [f for f in it_teachers if f not in busy[(e.day_of_week, e.period_number)]]
                if not free:
                    continue
                rep = rng.choice(free)
                absences[(fac, d, e.section, e.period_number)] = rep
                letter = A.section_parts(e.section)[2]
                creator = ahod.get(letter, hod)
                db.add(SubstitutionModel(
                    date=d, day_of_week=e.day_of_week, period_number=e.period_number, start_time=e.start_time,
                    end_time=e.end_time, classroom_id=e.classroom_id, section=e.section, subject_id=e.subject_id,
                    subject_name=e.subject_name, original_faculty_id=fac, original_faculty_name=staff_user[fac].name,
                    replacement_faculty_id=rep, replacement_faculty_name=staff_user[rep].name,
                    reason=rng.choice(["On leave", "Medical leave", "University duty (exam evaluation)", "Workshop / FDP",
                                       "Personal work"]),
                    status="active", created_by=creator, created_at=utc(d, "08:30", -rng.uniform(60, 900)), pilot_run=RUN))
                n_subs += 1
        db.flush()

        sessions, marks, unmarked, late = attendance(db, entries, staff_user, roster, members_of, absences)

        n_notices = notices(db, by_id, hod, ahod, assign)
        n_req = requests(db, by_id)
        n_sign = sign_ins(db, by_id, entries, staff_user, assign)
        db.commit()
    finally:
        db.close()
    print(f"IT pilot generated ({START:%d %b} - {END:%d %b %Y}, {BREAK_NAME} break {BREAK_START:%d}-{BREAK_START + timedelta(days=4):%d %b}"
          + (f", moved {SHIFT.days // 7} weeks forward" if SHIFT else "") + "):")
    print(f"  attendance: {sessions} periods marked ({late} more than an hour after class, {unmarked} never marked), {marks} marks")
    print(f"  electives: {n_groups} students placed · substitutions: {n_subs} periods")
    print(f"  notices: {n_notices} · certificate requests: {n_req} · sign-ins: {n_sign}")


# ── Notices ──────────────────────────────────────────────────────────────────────
def notices(db, by_id, hod, ahod, assign) -> int:
    inch = {(a.year, a.section): a.user_id for a in assign if a.role == "class_incharge"}
    brk, back = BREAK_START, BREAK_START + timedelta(days=6)
    N = [
        # (date, time, author, audience, year, section, priority, title, body)
        (D(9, 21), "09:05", hod, "all", None, None, "normal", "Welcome to CampusSphere",
         "From today the IT department uses CampusSphere for attendance, notices and certificate requests. "
         "Sign in with your roll number and the password on your slip, then set your own password."),
        (D(9, 22), "16:30", hod, "staff", None, None, "urgent", "Mark attendance in CampusSphere",
         "All faculty: please mark every period in CampusSphere, ideally before you leave the class."),
        (D(9, 24), "11:00", ahod.get("A"), "students", 4, None, "normal", "Project batches: submit titles",
         f"IV year: submit major project titles and batch members to your guide by {say(D(10, 3))}."),
        (D(9, 26), "10:15", inch.get((2, "A")), "students", 2, "A", "normal", "DS Lab records",
         "IT-2A: bring your Data Structures lab records on Monday for verification."),
        (D(9, 28), "09:40", hod, "students", None, None, "normal", f"Fee payment: last date {say(D(10, 10))}",
         f"Students with tuition or exam fee dues, pay before {say(D(10, 10))} to avoid a late fee."),
        (D(9, 30), "12:10", ahod.get("B"), "students", 3, None, "info", "Guest lecture: Cloud careers",
         f"III year: guest lecture by an industry speaker on cloud careers, Friday {say(D(10, 2))}, 2:15 pm, seminar hall."),
        (D(10, 1), "15:20", inch.get((4, "C")), "students", 4, "C", "normal", "IoT Lab batch change",
         "IT-4C: IoT Lab batches 1 and 2 swap slots this Saturday."),
        (D(10, 3), "10:00", hod, "students", 4, None, "urgent", "Placement drive: registrations open",
         f"IV year: a campus placement drive is on {say(D(10, 16))}. Register with the Placement Cell by {say(D(10, 9))}."),
        (D(10, 5), "09:15", hod, "all", None, None, "normal", "Attendance below 75%",
         "Students below 75% attendance: check Attendance in CampusSphere for how many classes you need. "
         "Below 65% means detention."),
        (D(10, 7), "13:00", ahod.get("C"), "students", 2, None, "normal", "Mentoring meeting",
         "II year: meet your mentor this week. Your mentor's name is on your profile."),
        (D(10, 8), "11:30", inch.get((3, "B")), "students", 3, "B", "normal", "OR assignment 1",
         f"IT-3B Operations Research students: assignment 1 is due on {say(D(10, 14))}."),
        (D(10, 9), "16:00", hod, "staff", None, None, "normal", "Mid-1 question papers",
         f"Faculty: submit Mid-1 question papers to the HOD office by {say(D(10, 15))}."),
        (D(10, 12), "09:30", hod, "students", None, None, "urgent", "Mid-1 examinations",
         f"Mid-1 examinations for II, III and IV year begin on {say(back + timedelta(days=2))}. "
         "The timetable is on the department notice board."),
        (D(10, 13), "14:45", ahod.get("A"), "students", None, None, "info", "Hackathon",
         f"Inter-college hackathon on {say(D(11, 7))}-{D(11, 8).day}. Teams of 3-4; apply for an NOC through CampusSphere if needed."),
        (D(10, 15), "10:20", inch.get((4, "A")), "students", 4, "A", "normal", "Seminar schedule",
         f"IT-4A: technical seminar presentations start {say(back)}. The order is by roll number."),
        (brk - timedelta(days=3), "15:30", hod, "all", None, None, "info", f"{BREAK_NAME.capitalize()} holidays",
         f"The college is closed for {BREAK_NAME} holidays from {say(brk)} to {say(brk + timedelta(days=4))}. "
         f"Classes resume on Monday {say(back)}."),
        (brk - timedelta(days=1), "09:00", ahod.get("B"), "students", 2, None, "normal", "Bring ID cards",
         f"II year: ID cards are compulsory in the labs from {say(back)}."),
        (back, "09:10", hod, "students", None, None, "urgent", "Mid-1 hall arrangement",
         "Mid-1 seating arrangement is posted outside the department office. Report 15 minutes early."),
        (back, "12:30", inch.get((3, "A")), "students", 3, "A", "normal", "Soft Skills session moved",
         "IT-3A Soft Skills students: Tuesday's session moves to Room CE-IT-204."),
        (back + timedelta(days=1), "16:10", hod, "staff", None, None, "normal", "Condonation list",
         f"Class in-charges: send the list of students between 65% and 75% (from the Attendance report) by {say(back + timedelta(days=4))}."),
    ]
    n = 0
    for d, hhmm, author, aud, year, sec, prio, title, body in N:
        u = by_id.get(author)
        if not u or d > END:
            continue
        db.add(AnnouncementModel(title=title, body=body, author_id=u.id, author_name=u.name, department=BRANCH,
                                 priority=prio, is_active=True, created_at=utc(d, hhmm), audience=aud, year=year,
                                 section=sec, pilot_run=RUN))
        n += 1
    return n


# ── Certificate requests ─────────────────────────────────────────────────────────
FEMALE_ENDINGS = ("a", "i", "ee", "ini", "ika", "sri", "vi", "ya", "thi", "ni")
FATHERS = ["Ramesh", "Srinivas", "Venkatesh", "Ravi Kumar", "Narsimha", "Mahesh", "Satyanarayana", "Raju", "Krishna",
           "Anjaiah", "Yadagiri", "Sudhakar", "Prabhakar", "Mallesh", "Shankar", "Ramulu", "Chandra Shekar", "Bhaskar"]


def requests(db, by_id) -> int:
    from backend.app.ai.brief import given_name
    now = datetime.utcnow()
    profiles = db.query(StudentProfileModel, UserModel).join(UserModel, UserModel.id == StudentProfileModel.user_id).filter(
        StudentProfileModel.department == BRANCH, UserModel.id.like("u_stu_%")).all()
    picks = rng.sample(profiles, 62)
    at_principal = 0
    n = 0
    for k, (p, u) in enumerate(picks):
        doc = "bonafide" if rng.random() < 0.65 else "noc"
        purpose = rng.choice([x for x in DOC_TYPES[doc]["purposes"] if x != "Other"])
        details = {}
        if doc == "noc":
            details = {"organization": rng.choice(["Infosys Springboard", "TCS iON", "Smart India Hackathon", "T-Hub",
                                                   "Microsoft Learn Student Ambassadors", "JNTU Tech Fest"]),
                       "location": "Hyderabad"}
        try:
            steps = workflow.resolve_chain(db, p)
        except workflow.ChainError:
            continue
        given = given_name(u.name.upper())
        gender = "female" if given.lower().endswith(FEMALE_ENDINGS) else "male"
        surname = u.name.split()[0] if len(u.name.split()) > 1 else ""
        snap = workflow.student_snapshot(u, p)
        snap.update(parent_name=f"{surname} {rng.choice(FATHERS)}".strip(), gender=gender)
        # How far it got: issued, still waiting at some desk (asked for recently), rejected or withdrawn
        r = rng.random()
        outcome = "approved" if r < 0.60 else "pending" if r < 0.85 else "rejected" if r < 0.95 else "cancelled"
        stop = rng.randrange(len(steps))                          # the desk where it waits / was rejected / was withdrawn
        to_principal = outcome == "pending" and at_principal < 3   # a few reach the Principal, so his inbox isn't empty
        if to_principal:
            stop, at_principal = len(steps) - 1, at_principal + 1
        days = [d for d in working_days()]
        day = rng.choice(days[-5:-3] if to_principal else days[-3:] if outcome == "pending" else days[:-3])
        created = utc(day, f"{rng.randint(9, 16):02d}:{rng.choice(['05', '20', '35', '50'])}")
        t, status, current = created, "in_review", len(steps)
        for i, st in enumerate(steps):
            wait = rng.uniform(1.5, 20) if st["role"] != "principal" else rng.uniform(4, 30)
            if rng.random() < 0.12 and not to_principal:
                wait += rng.uniform(24, 60)                       # a slow desk
            if to_principal:
                wait = rng.uniform(2, 9)                          # moved quickly through the department
            t2 = t + timedelta(hours=wait)
            if t2 > now or (outcome == "pending" and i == stop):
                current = i                                       # waiting at this desk since t
                break
            if outcome == "rejected" and i == stop:
                st.update(status="rejected", acted_at=t2.isoformat(), acted_by_id=st["approver_id"],
                          acted_by_name=st["approver_name"],
                          remarks=rng.choice(["Purpose not clear: give the scholarship name", "Attendance below 65%: meet the HOD",
                                              "Please attach the internship offer letter", "Duplicate request"]))
                status, current, t = "rejected", i, t2
                break
            if outcome == "cancelled" and i == stop:
                status, current, t = "cancelled", i, t2
                break
            st.update(status="approved", acted_at=t2.isoformat(), acted_by_id=st["approver_id"],
                      acted_by_name=st["approver_name"], remarks=None)
            t = t2
        if status == "in_review" and current >= len(steps):
            status = "approved"
        req = DocumentRequestModel(
            student_id=u.id, doc_type=doc, purpose=purpose, details=details, student=snap, steps=steps,
            current_step=min(current, len(steps)), status=status, step_since=t, created_at=created, updated_at=t,
            verify_code=workflow.new_verify_code(db), amount=0, fulfilment=DOC_TYPES[doc]["fulfilment"],
            issued_at=t if status == "approved" else None, pilot_run=RUN)
        db.add(req)
        db.flush()
        workflow.assign_ref_no(req)
        n += 1
    return n


# ── Sign-ins (adoption) ──────────────────────────────────────────────────────────
def sign_ins(db, by_id, entries, staff_user, assign) -> int:
    days = list(working_days())
    rows = []
    students = db.query(UserModel).filter(UserModel.id.like("u_stu_%"), UserModel.department == BRANCH).all()
    for u in students:
        rr = random.Random(u.id)
        if rr.random() < 0.08:
            continue                                               # never signed in
        first = min(len(days) - 1, int(rr.expovariate(1 / 3.5)))   # most within the first week
        engaged = rr.uniform(0.15, 0.75)
        for d in days[first:]:
            if d == days[first] or rr.random() < engaged:
                rows.append({"user_id": u.id, "at": utc(d, f"{rr.randint(7, 21):02d}:{rr.randint(0, 59):02d}"), "pilot_run": RUN})
    teach_days = defaultdict(set)
    for e in entries:
        if e.faculty_id in staff_user:
            teach_days[staff_user[e.faculty_id].id].add(e.day_of_week)
    approvers = {a.user_id for a in assign}
    for uid in set(teach_days) | approvers:
        rr = random.Random(uid)
        for d in days:
            if d.weekday() in teach_days.get(uid, set()) or (uid in approvers and rr.random() < 0.6):
                rows.append({"user_id": uid, "at": utc(d, f"{rr.randint(8, 10):02d}:{rr.randint(0, 59):02d}"), "pilot_run": RUN})
    for i in range(0, len(rows), 2000):
        db.execute(insert(SignInEventModel), rows[i:i + 2000])
    return len(rows)


if __name__ == "__main__":
    main()

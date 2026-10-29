"""
Department report: how a department uses CampusSphere for attendance, notices and certificate requests,
from the first marked class to today. For the HOD (their department), the Principal, management and admins.

  adoption     per section: students on the roll, with an account, who have signed in, active in the last 7 days
  attendance   per section and week; students below 75% (condonation) and 65% (detention)
  teachers     periods marked within an hour of class, later, and timetabled periods never marked
  requests     issued / waiting / rejected / withdrawn, time to issue, average hours at each desk, what waits now
  notices      how many were posted, by whom, to whom
"""
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.attendance import core as A
from backend.app.core.roles import user_roles
from backend.app.core.security import get_current_user
from backend.app.db.session import get_db
from backend.app.models.attendance import AttendanceMarkModel, AttendanceSessionModel
from backend.app.models.campus import AnnouncementModel, SignInEventModel, SubstitutionModel, TimetableEntryModel, UserModel
from backend.app.models.services import DocumentRequestModel, RosterEntryModel, StudentProfileModel
from backend.app.student_services.catalog import DOC_TYPES, ROLE_LABELS, STEP_SLA_HOURS

router = APIRouter()
IST = timedelta(hours=5, minutes=30)


def _allowed_departments(db: Session, current: dict) -> Optional[set]:
    """None = any department (admin, Principal, management); else the HOD's departments."""
    r = user_roles(db, current)
    if r.get("management"):
        return None
    return set(r.get("hod_departments") or [])


@router.get("/departments", summary="Departments I can see the report for")
def report_departments(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    allowed = _allowed_departments(db, current)
    have = sorted({d for (d,) in db.query(AttendanceSessionModel.department).distinct() if d})
    return [d for d in have if allowed is None or d in allowed]


@router.get("/department", summary="Department report: adoption, attendance, teachers, requests, notices")
def department_report(department: str = Query("IT", max_length=20), db: Session = Depends(get_db),
                      current: dict = Depends(get_current_user)):
    dept = department.strip().upper()
    allowed = _allowed_departments(db, current)
    if allowed is not None and dept not in allowed:
        raise HTTPException(status_code=403, detail="Only the HOD of this department, the Principal or management")
    now = datetime.utcnow()
    rules = A.rules(db)
    target, floor = rules.target_pct, rules.floor_pct

    sessions = db.query(AttendanceSessionModel).filter(AttendanceSessionModel.department == dept).all()
    if not sessions:
        return {"department": dept, "empty": True}
    first, last = min(s.date for s in sessions), max(s.date for s in sessions)
    entries = {e.id: e for e in db.query(TimetableEntryModel).filter(TimetableEntryModel.is_active == True,  # noqa: E712
                                                                      TimetableEntryModel.department == dept)}
    roster = db.query(RosterEntryModel).filter(RosterEntryModel.department == dept).all()
    sec_of = {r.roll_no: f"{dept}-{r.year}{r.section}" for r in roster if r.year and r.section}

    # ── Attendance ──
    sess_by_id = {s.id: s for s in sessions}
    per_student = defaultdict(lambda: [0, 0])
    per_session = defaultdict(lambda: [0, 0])
    ids = list(sess_by_id)
    for i in range(0, len(ids), 900):
        for sid, roll, status in db.query(AttendanceMarkModel.session_id, AttendanceMarkModel.roll_no,
                                          AttendanceMarkModel.status).filter(AttendanceMarkModel.session_id.in_(ids[i:i + 900])):
            ok = status in ("present", "late")
            per_student[roll][1] += 1
            per_student[roll][0] += ok
            per_session[sid][1] += 1
            per_session[sid][0] += ok
    week_of = lambda d: (d - timedelta(days=d.weekday()))   # noqa: E731  Monday of the week
    weekly = defaultdict(lambda: [0, 0])
    sec_week = defaultdict(lambda: [0, 0])
    for sid, (a, n) in per_session.items():
        s = sess_by_id[sid]
        weekly[week_of(s.date)][0] += a
        weekly[week_of(s.date)][1] += n
        sec_week[(s.section, week_of(s.date))][0] += a
        sec_week[(s.section, week_of(s.date))][1] += n
    sections = sorted({s.section for s in sessions})
    sec_rows = []
    below = []
    for sec in sections:
        studs = [(roll, a, n) for roll, (a, n) in per_student.items() if sec_of.get(roll) == sec and n]
        pcts = [100 * a / n for _, a, n in studs]
        tot_a = sum(a for _, a, _ in studs)
        tot_n = sum(n for _, _, n in studs)
        sec_rows.append({"section": sec, "students": len(studs), "avg_pct": round(100 * tot_a / tot_n, 1) if tot_n else None,
                         "condonation": sum(floor <= p < target for p in pcts), "detained": sum(p < floor for p in pcts)})
    names = {r.roll_no: r.name for r in roster}
    for roll, (a, n) in per_student.items():
        p = 100 * a / n if n else 100
        if p < target and roll in sec_of:
            below.append({"roll_no": roll, "name": names.get(roll), "section": sec_of[roll], "pct": round(p, 1),
                          "status": A.status_of(p, target, floor), "attended": a, "held": n})
    below.sort(key=lambda x: x["pct"])
    weeks = sorted(weekly)
    trend = [{"week": w.isoformat(), "label": f"{w:%d %b}", "pct": round(100 * weekly[w][0] / weekly[w][1], 1),
              **{sec: (round(100 * sec_week[(sec, w)][0] / sec_week[(sec, w)][1], 1) if sec_week[(sec, w)][1] else None)
                 for sec in sections}} for w in weeks]

    # ── Teachers: marking on time ──
    held_days = sorted({s.date for s in sessions})
    expected = sum(1 for d in held_days for e in entries.values() if e.day_of_week == d.weekday())
    teach = defaultdict(lambda: {"marked": 0, "on_time": 0, "late": 0, "subjects": set()})
    on_time_total = 0
    for s in sessions:
        e = entries.get(s.timetable_entry_id)
        end = A.class_end(e, s.date) - IST if e else None
        prompt = bool(end and s.marked_at and s.marked_at <= end + timedelta(hours=1))
        t = teach[s.marked_by_name or "—"]
        t["marked"] += 1
        t["on_time" if prompt else "late"] += 1
        t["subjects"].add(s.subject_name)
        on_time_total += prompt
    # Timetabled periods on teaching days that nobody marked: who should have (the substitute, if one was arranged)
    marked_keys = {(s.timetable_entry_id, s.date) for s in sessions}
    subs = {(x.date, x.section, x.period_number): x.replacement_faculty_name for x in db.query(SubstitutionModel).filter(
        SubstitutionModel.status == "active", SubstitutionModel.date >= first, SubstitutionModel.date <= last)}
    unmarked = []
    for d in held_days:
        for e in entries.values():
            if e.day_of_week == d.weekday() and (e.id, d) not in marked_keys:
                who = subs.get((d, e.section, e.period_number)) or e.faculty_name or "—"
                unmarked.append({"date": d.isoformat(), "period": e.period_number, "time": f"{e.start_time}–{e.end_time}",
                                 "section": e.section, "subject": e.subject_name, "batch": e.batch, "teacher": who,
                                 "substitute": (d, e.section, e.period_number) in subs})
                teach[who]["missed"] = teach[who].get("missed", 0) + 1
    unmarked.sort(key=lambda u: (u["date"], u["period"]), reverse=True)
    teachers = sorted(({"name": k, "marked": v["marked"], "on_time": v["on_time"], "late": v["late"], "missed": v.get("missed", 0),
                        "on_time_pct": round(100 * v["on_time"] / v["marked"]) if v["marked"] else 0,
                        "subjects": sorted(v["subjects"])[:3]}
                       for k, v in teach.items()), key=lambda x: (-x["missed"], x["on_time_pct"], -x["marked"]))

    # ── Adoption ──
    profiles = db.query(StudentProfileModel).filter(StudentProfileModel.department == dept).all()
    uid_sec = {p.user_id: f"{dept}-{p.year}{p.section}" for p in profiles if p.year and p.section}
    signed, recent = set(), set()
    week_ago = now - timedelta(days=7)
    ids = list(uid_sec)
    for i in range(0, len(ids), 900):
        for uid, at in db.query(SignInEventModel.user_id, SignInEventModel.at).filter(SignInEventModel.user_id.in_(ids[i:i + 900])):
            signed.add(uid)
            if at and at >= week_ago:
                recent.add(uid)
    on_roll = Counter(sec_of.values())
    accounts = Counter(uid_sec.values())
    adoption = [{"section": sec, "on_roll": on_roll.get(sec, 0), "accounts": accounts.get(sec, 0),
                 "signed_in": sum(1 for u, s in uid_sec.items() if s == sec and u in signed),
                 "active_7d": sum(1 for u, s in uid_sec.items() if s == sec and u in recent)} for sec in sections]
    staff_ids = {u.id for u in db.query(UserModel).filter(UserModel.role.in_(["faculty", "staff"]), UserModel.department == dept)}
    staff_signed = {u for (u,) in db.query(SignInEventModel.user_id).filter(SignInEventModel.user_id.in_(staff_ids)).distinct()} if staff_ids else set()

    # ── Requests ──
    reqs = [r for r in db.query(DocumentRequestModel).all() if (r.student or {}).get("department") == dept]
    status_n = Counter(r.status for r in reqs)
    issue_hours = [(r.issued_at - r.created_at).total_seconds() / 3600 for r in reqs if r.status == "approved" and r.issued_at and r.created_at]
    desk_hours = defaultdict(list)
    for r in reqs:
        prev = r.created_at
        for st in r.steps or []:
            if st.get("acted_at") and prev:
                at = datetime.fromisoformat(st["acted_at"])
                desk_hours[st["role"]].append((at - prev).total_seconds() / 3600)
                prev = at
    waiting = []
    for r in reqs:
        if r.status == "in_review" and r.current_step < len(r.steps or []):
            st = r.steps[r.current_step]
            hours = (now - r.step_since).total_seconds() / 3600 if r.step_since else 0
            waiting.append({"ref_no": r.ref_no, "document": DOC_TYPES[r.doc_type]["name"], "student": (r.student or {}).get("name"),
                            "roll_no": (r.student or {}).get("roll_no"), "desk": st["label"], "with": st["approver_name"],
                            "hours": round(hours, 1), "overdue": hours > STEP_SLA_HOURS})
    waiting.sort(key=lambda x: -x["hours"])
    order = ["mentor", "class_incharge", "ahod", "hod", "principal"]
    desks = [{"role": k, "label": ROLE_LABELS[k], "avg_hours": round(sum(v) / len(v), 1), "acted": len(v)}
             for k in order if (v := desk_hours.get(k))]
    by_doc = Counter(DOC_TYPES[r.doc_type]["name"] for r in reqs)

    # ── Notices ──
    notes = db.query(AnnouncementModel).filter(AnnouncementModel.department == dept, AnnouncementModel.is_active == True).all()  # noqa: E712
    authors = Counter(n.author_name or "—" for n in notes)
    aud = Counter("Staff" if n.audience == "staff" else "One section" if n.section else "One year" if n.year
                  else "Students" if n.audience == "students" else "Everyone" for n in notes)

    all_pcts = [100 * a / n for roll, (a, n) in per_student.items() if n and roll in sec_of]
    return {
        "department": dept, "from": first.isoformat(), "to": last.isoformat(), "teaching_days": len(held_days),
        "rules": {"target_pct": target, "floor_pct": floor},
        "summary": {
            "students": len(sec_of), "signed_in": len(signed), "active_7d": len(recent),
            "staff_signed_in": len(staff_signed), "staff": len(staff_ids),
            "periods_marked": len(sessions), "periods_expected": expected,
            "marked_on_time_pct": round(100 * on_time_total / len(sessions)),
            "avg_attendance_pct": round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else None,
            "condonation": sum(floor <= p < target for p in all_pcts), "detained": sum(p < floor for p in all_pcts),
            "requests": len(reqs), "issued": status_n.get("approved", 0), "waiting": status_n.get("in_review", 0),
            "rejected": status_n.get("rejected", 0), "withdrawn": status_n.get("cancelled", 0),
            "avg_hours_to_issue": round(sum(issue_hours) / len(issue_hours), 1) if issue_hours else None,
            "notices": len(notes),
        },
        "adoption": adoption,
        "attendance": {"sections": sec_rows, "trend": trend, "section_names": sections, "below_target": below[:60],
                       "below_target_total": len(below)},
        "teachers": teachers,
        "unmarked": unmarked,
        "requests": {"by_status": dict(status_n), "by_document": dict(by_doc), "desks": desks, "waiting": waiting},
        "notices": {"by_author": authors.most_common(), "by_audience": aud.most_common(),
                    "latest": [{"title": n.title, "author": n.author_name, "at": n.created_at.isoformat() if n.created_at else None}
                               for n in sorted(notes, key=lambda n: n.created_at or now, reverse=True)[:6]]},
    }

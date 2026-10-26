"""
Turns next-week predictions into decisions. Everything is evaluated per room *slot*
(room x day x period), because combined elective classes put several sections in one
room at the same time.

* room utilization  -> how often rooms are used and how full they are,
* timetable clashes -> two different classes booked into one room; a free room for one,
* overflow risk     -> a larger free room for that slot (or add seats / split),
* low attendance    -> a better weekday slot where section, faculty and a room are free,
                       scored by the slot model ("what if it moved?"),
* small groups in big rooms -> a much smaller free room, freeing the big one,
* idle rooms        -> periods available for remedial classes or other departments.
"""
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from backend.app.models.campus import ClassroomModel, TimetableEntryModel
from backend.app.ai.utilization import model as M
from backend.app.ai.utilization.calendar import PERIODS_PER_DAY, TEACHING_DAYS, is_teaching_day, session_date, week_start

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
TEACHING_ROOM_TYPES = ("CLASSROOM", "LABORATORY")
LOW_ATTENDANCE = 0.65        # predicted attendance rate below this is flagged
MIN_GAIN_STUDENTS = 3        # only suggest a move if it gains at least this many
AVOID_TARGET_DAYS = {5}      # don't suggest moving classes onto Saturday
OVERFLOW_MARGIN = 2          # "possible overflow" only if the upper estimate exceeds capacity by this much
IDLE_ROOM_SLOT_SHARE = 0.40  # rooms used in fewer than 40% of periods
SMALL_GROUP_SHARE = 0.40     # group fills less than 40% of the room …
DOWNSIZE_RATIO = 0.75        # … and a free room at most 75% of the size exists
MAX_ITEMS = 12


def _slot_label(day, period):
    return f"{DAY_NAMES[int(day)]} P{int(period)}"


def _session_view(r):
    return {
        "entry_id": int(r.entry_id), "subject": r.subject, "section": r.section,
        "batch": r.batch, "faculty": r.faculty_name, "kind": r.kind,
        "day": int(r.day), "period": int(r.period), "slot": _slot_label(r.day, r.period),
        "time": f"{r.start_time}–{r.end_time}", "classroom_id": r.classroom_id,
        "capacity": int(r.capacity), "enrolled": int(r.enrolled),
        "predicted_present": int(r.predicted_present),
        "predicted_low": int(r.predicted_low), "predicted_high": int(r.predicted_high),
        "predicted_rate": round(float(r.predicted_rate), 3),
        "seat_utilization": round(float(r.seat_utilization), 3),
    }


def _room_slots(fc: pd.DataFrame) -> pd.DataFrame:
    """One row per (room, day, period) with combined predictions for all sessions in it."""
    fc = fc.assign(spread=(fc["predicted_high"] - fc["predicted_present"]).clip(lower=0) ** 2)
    g = fc.groupby(["classroom_id", "day", "period"])
    slots = g.agg(capacity=("capacity", "first"), location_type=("location_type", "first"),
                  sessions=("entry_id", "count"), predicted_present=("predicted_present", "sum"),
                  enrolled=("enrolled", "sum"), spread=("spread", "sum"),
                  subjects=("subject", lambda s: sorted(set(s))),
                  sections=("section", lambda s: sorted(set(s))),
                  entry_ids=("entry_id", list)).reset_index()
    # Combined upper estimate: independent sessions' spreads add in quadrature
    slots["predicted_high"] = (slots["predicted_present"] + np.sqrt(slots["spread"])).round().astype(int)
    slots["seat_utilization"] = slots["predicted_present"] / slots["capacity"]
    slots["combined"] = slots["sessions"] > 1
    return slots.drop(columns="spread")


def _swap_suggestions(db, week, low, fc, combined_entries, already, rooms, room_busy, faculty_busy):
    """Swap a low-attendance session A with session B of the same section: A takes B's
    slot and room, B takes A's. Both must be full-section, non-combined sessions; each
    faculty must be free in the other slot; each room must suit the class moving in."""
    full = fc[(fc["group"] == "full") & ~fc["entry_id"].isin(combined_entries)]
    slot_count = fc.groupby(["section", "day", "period"])["entry_id"].count()
    pairs = []
    for a in low[low["group"] == "full"].itertuples():
        if a.entry_id in combined_entries or a.entry_id in already:
            continue
        for b in full[(full["section"] == a.section) & (full["entry_id"] != a.entry_id)].itertuples():
            if (b.day, b.period) == (a.day, a.period) or b.day in AVOID_TARGET_DAYS:
                continue
            if slot_count.get((a.section, b.day, b.period), 0) > 1 or slot_count.get((a.section, a.day, a.period), 0) > 1:
                continue                                 # another batch of the section is also in that slot
            if a.faculty_key != b.faculty_key and (
                    (a.faculty_key, b.day, b.period) in faculty_busy or (b.faculty_key, a.day, a.period) in faculty_busy):
                continue
            # A moves into B's room, B into A's room: labs must stay in labs, and seats must suffice
            if a.kind == "lab" and b.location_type != "LABORATORY":
                continue
            if b.kind == "lab" and a.location_type != "LABORATORY":
                continue
            if rooms[b.classroom_id].capacity < a.enrolled or rooms[a.classroom_id].capacity < b.enrolled:
                continue
            pairs.append((a, b))
    if not pairs:
        return []

    def frame(rows, slot_from):
        df = pd.DataFrame([r._asdict() for r in rows]).drop(columns="Index")
        src = pd.DataFrame([s._asdict() for s in slot_from])
        df["day"], df["period"] = src["day"].values, src["period"].values
        df["date"] = [session_date(week, d) for d in df["day"]]
        return df

    a_rows, b_rows = [p[0] for p in pairs], [p[1] for p in pairs]
    a_now, b_now = frame(a_rows, a_rows), frame(b_rows, b_rows)
    a_moved, b_moved = frame(a_rows, b_rows), frame(b_rows, a_rows)
    gain_a = (M.what_if_rates(db, a_moved) - M.what_if_rates(db, a_now)) * a_now["enrolled"].values
    gain_b = (M.what_if_rates(db, b_moved) - M.what_if_rates(db, b_now)) * b_now["enrolled"].values
    net = gain_a + gain_b

    # Greedy, best net gain first; each session takes part in at most one swap
    ranked = sorted(zip(pairs, gain_a, gain_b, net), key=lambda x: -x[3])
    used, chosen = set(), []
    for (a, b), ga, gb, n in ranked:
        if n < MIN_GAIN_STUDENTS:
            break
        if a.entry_id in used or b.entry_id in used:
            continue
        used.update((a.entry_id, b.entry_id))
        chosen.append((a, b, ga, gb, n))
    out = []
    for a, b, ga, gb, n in chosen:
        out.append({
            **_session_view(a),
            "to_slot": _slot_label(b.day, b.period), "to_day": int(b.day), "to_period": int(b.period),
            "to_room": b.classroom_id, "swap_with": f"{b.subject} ({b.faculty_name})",
            "expected_present_after": int(min(a.enrolled, a.predicted_present + round(ga))),
            "expected_gain": int(round(n)),
            "action": (f"Swap with {b.subject} ({_slot_label(b.day, b.period)}): this class gains about "
                       f"{int(round(ga))} students, {b.subject} changes by {int(round(gb)):+d} — net {int(round(n)):+d}"),
        })
    return out


def build_report(db: Session, week: int = None) -> dict:
    week = week or M.default_forecast_week()
    fc = M.forecast(db, week)
    rooms = {r.id: r for r in db.query(ClassroomModel).all()}
    teaching_rooms = [r for r in rooms.values() if r.location_type in TEACHING_ROOM_TYPES]
    active = db.query(TimetableEntryModel).filter(TimetableEntryModel.is_active == True).all()

    teaching_days = [d for d in range(TEACHING_DAYS) if is_teaching_day(session_date(week, d))]
    slots = [(d, p) for d in teaching_days for p in range(1, PERIODS_PER_DAY + 1)]

    # Who/what is busy in each slot (from the timetable itself)
    room_busy, section_busy, faculty_busy = set(), set(), set()
    for e in active:
        room_busy.add((e.classroom_id, e.day_of_week, e.period_number))
        section_busy.add((e.section, e.day_of_week, e.period_number))
        faculty_busy.add((e.faculty_id or e.faculty_name, e.day_of_week, e.period_number))

    def free_rooms(day, period, location_type, min_capacity, exclude=None):
        return sorted(
            (r for r in teaching_rooms
             if r.location_type == location_type and r.capacity >= min_capacity
             and r.id != exclude and (r.id, day, period) not in room_busy),
            key=lambda r: r.capacity)

    rs = _room_slots(fc) if not fc.empty else pd.DataFrame(
        columns=["classroom_id", "day", "period", "capacity", "sessions", "predicted_present", "predicted_high"])
    by_entry = fc.set_index("entry_id") if not fc.empty else fc

    # ── Room utilization ─────────────────────────────────────────────────────
    room_rows = []
    for r in teaching_rooms:
        g = rs[rs["classroom_id"] == r.id]
        used = len(g)                                   # distinct periods in use
        seat_hours = float(g["predicted_present"].sum()) if used else 0.0
        room_rows.append({
            "classroom_id": r.id, "name": r.name, "type": r.location_type, "capacity": r.capacity,
            "periods_used": used, "periods_available": len(slots),
            "sessions": int(g["sessions"].sum()) if used else 0,
            "slot_utilization": round(used / len(slots), 3) if slots else 0,
            "seat_utilization_when_used": round(float(g["seat_utilization"].mean()), 3) if used else 0,
            "overall_utilization": round(seat_hours / (r.capacity * len(slots)), 3) if slots else 0,
            "predicted_seat_hours": int(seat_hours),
        })
    room_rows.sort(key=lambda x: -x["overall_utilization"])

    heatmap = [
        {"classroom_id": r.classroom_id, "day": int(r.day), "period": int(r.period),
         "seat_utilization": round(float(r.seat_utilization), 3),
         "predicted_present": int(r.predicted_present), "capacity": int(r.capacity),
         "subjects": r.subjects, "sections": r.sections, "combined": bool(r.combined)}
        for r in rs.itertuples()
    ]

    # ── Timetable clashes (different classes booked into one room) ───────────
    clashes = []
    for r in rs[rs["combined"]].itertuples():
        if len(r.subjects) < 2:
            continue                                     # same subject = combined elective class
        sessions = [by_entry.loc[i] for i in r.entry_ids]
        mover = min(sessions, key=lambda s: s["enrolled"])
        options = free_rooms(r.day, r.period, r.location_type, int(mover["enrolled"]), exclude=r.classroom_id)
        clashes.append({
            "classroom_id": r.classroom_id, "slot": _slot_label(r.day, r.period),
            "day": int(r.day), "period": int(r.period),
            "classes": [f"{s['section']} · {s['subject']}" for s in sessions],
            "suggested_room": options[0].id if options else None,
            "action": (f"Double-booked. Move {mover['section']} · {mover['subject']} to {options[0].id} "
                       f"({options[0].capacity} seats), free in this slot"
                       if options else "Double-booked and no suitable room is free — reschedule one class"),
        })

    # ── Overflow risk (per room slot) ────────────────────────────────────────
    overflow = []
    risky = rs[(rs["predicted_present"] > rs["capacity"]) |
               (rs["predicted_high"] >= rs["capacity"] + OVERFLOW_MARGIN)]
    for r in risky.sort_values("predicted_high", ascending=False).itertuples():
        if r.combined and len(r.subjects) > 1:
            continue                                     # reported as a clash instead
        likely = r.predicted_present > r.capacity
        options = free_rooms(r.day, r.period, r.location_type, int(r.predicted_high), exclude=r.classroom_id)
        who = ", ".join(r.sections) + " · " + r.subjects[0]
        overflow.append({
            "classroom_id": r.classroom_id, "slot": _slot_label(r.day, r.period),
            "day": int(r.day), "period": int(r.period), "class": who,
            "combined": bool(r.combined), "capacity": int(r.capacity), "enrolled": int(r.enrolled),
            "predicted_present": int(r.predicted_present), "predicted_high": int(r.predicted_high),
            "severity": "likely" if likely else "possible",
            "suggested_room": options[0].id if options else None,
            "action": (f"Move to {options[0].id} ({options[0].capacity} seats), free in this slot" if options
                       else f"Expect up to {int(r.predicted_high)} in {int(r.capacity)} seats — add seating or split the group"),
        })

    # ── Low attendance → better weekday slot (what-if with the slot model) ───
    combined_entries = {i for ids in rs.loc[rs["combined"], "entry_ids"] for i in ids} if not rs.empty else set()
    low = fc[fc["predicted_rate"] < LOW_ATTENDANCE].copy() if not fc.empty else fc
    reschedule, low_attendance = [], []
    if not low.empty:
        candidates = []
        for r in low.itertuples():
            if r.entry_id in combined_entries:
                continue                                 # moving one section would break a combined class
            for day, period in slots:
                if (day, period) == (r.day, r.period) or day in AVOID_TARGET_DAYS:
                    continue
                if (r.section, day, period) in section_busy or (r.faculty_key, day, period) in faculty_busy:
                    continue
                if (r.classroom_id, day, period) not in room_busy:
                    room = r.classroom_id
                elif r.kind == "lab":
                    continue                             # labs need their own lab room
                else:
                    options = free_rooms(day, period, r.location_type, r.enrolled)
                    if not options:
                        continue
                    room = options[0].id
                candidates.append({"entry_id": r.entry_id, "new_day": day, "new_period": period, "new_room": room})

        if candidates:
            cand = pd.DataFrame(candidates).merge(low, on="entry_id")
            moved = cand.copy()
            moved["day"], moved["period"] = moved["new_day"], moved["new_period"]
            moved["date"] = [session_date(week, d) for d in moved["new_day"]]
            cand["gain_students"] = (M.what_if_rates(db, moved) - M.what_if_rates(db, cand)) * cand["enrolled"]
            best = cand.sort_values("gain_students", ascending=False).groupby("entry_id").head(1)
            for b in best[best["gain_students"] >= MIN_GAIN_STUDENTS].itertuples():
                gain = int(round(b.gain_students))
                reschedule.append({
                    **_session_view(b),
                    "to_slot": _slot_label(b.new_day, b.new_period), "to_day": int(b.new_day),
                    "to_period": int(b.new_period), "to_room": b.new_room,
                    "expected_present_after": int(min(b.enrolled, b.predicted_present + gain)),
                    "expected_gain": gain,
                    "action": (f"Move from {_slot_label(b.day, b.period)} to {_slot_label(b.new_day, b.new_period)}"
                               f" in {b.new_room}: about {gain} more students expected"),
                })
            reschedule.sort(key=lambda x: -x["expected_gain"])

        # Sections rarely have a free weekday period, so also try swapping a low-attendance
        # session with another full-section session of the same section (net gain of both moves).
        reschedule += _swap_suggestions(db, week, low, fc, combined_entries,
                                        {x["entry_id"] for x in reschedule},
                                        rooms, room_busy, faculty_busy)
        reschedule.sort(key=lambda x: -x["expected_gain"])

        moved_ids = {x["entry_id"] for x in reschedule}
        for r in low.sort_values("predicted_rate").itertuples():
            if r.entry_id not in moved_ids:
                low_attendance.append({**_session_view(r),
                                       "action": "Low predicted attendance and no better free weekday slot — flag to faculty/HOD"})

    # ── Small groups in big rooms → much smaller free room ───────────────────
    downsize = []
    small = rs[rs["predicted_high"] < SMALL_GROUP_SHARE * rs["capacity"]]
    for r in small.sort_values("seat_utilization").itertuples():
        options = [o for o in free_rooms(r.day, r.period, r.location_type, int(r.predicted_high), exclude=r.classroom_id)
                   if o.capacity <= DOWNSIZE_RATIO * r.capacity]
        if options and r.location_type == "CLASSROOM":
            downsize.append({
                "classroom_id": r.classroom_id, "slot": _slot_label(r.day, r.period),
                "class": ", ".join(r.sections) + " · " + r.subjects[0],
                "capacity": int(r.capacity), "predicted_present": int(r.predicted_present),
                "suggested_room": options[0].id,
                "action": f"Use {options[0].id} ({options[0].capacity} seats) and free {r.classroom_id} ({int(r.capacity)})",
            })

    # ── Idle rooms ───────────────────────────────────────────────────────────
    idle = [{**rr, "free_periods": rr["periods_available"] - rr["periods_used"],
             "action": (f"Free {rr['periods_available'] - rr['periods_used']} of {rr['periods_available']} periods — "
                        "available for remedial classes, extra labs or other departments")}
            for rr in room_rows if rr["slot_utilization"] < IDLE_ROOM_SLOT_SHARE]
    idle.sort(key=lambda x: x["slot_utilization"])

    total_capacity_hours = sum(r.capacity for r in teaching_rooms) * len(slots)
    used_room_slots = len(rs)
    return {
        "week": week,
        "week_start": week_start(week).isoformat(),
        "teaching_days": [DAY_NAMES[d] for d in teaching_days],
        "summary": {
            "sessions": int(len(fc)),
            "predicted_attendance": int(fc["predicted_present"].sum()) if not fc.empty else 0,
            "expected_enrolment": int(fc["enrolled"].sum()) if not fc.empty else 0,
            "avg_attendance_rate": round(float(fc["predicted_rate"].mean()), 3) if not fc.empty else 0,
            "campus_seat_utilization": round(float(rs["predicted_present"].sum()) / total_capacity_hours, 3)
                                        if total_capacity_hours else 0,
            "room_slot_utilization": round(used_room_slots / (len(teaching_rooms) * len(slots)), 3) if slots else 0,
            "timetable_clashes": len(clashes), "overflow_risks": len(overflow),
            "low_attendance_sessions": int(len(low)), "reschedule_suggestions": len(reschedule),
            "downsize_suggestions": len(downsize), "idle_rooms": len(idle),
        },
        "rooms": room_rows,
        "heatmap": heatmap,
        "recommendations": {
            "clashes": clashes[:MAX_ITEMS],
            "overflow": overflow[:MAX_ITEMS],
            "reschedule": reschedule[:MAX_ITEMS],
            "low_attendance": low_attendance[:MAX_ITEMS],
            "downsize": downsize[:MAX_ITEMS],
            "idle_rooms": idle[:MAX_ITEMS],
        },
    }

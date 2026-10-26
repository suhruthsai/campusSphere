# What students can request at each service counter.
# "counter" is the twin building whose service counter issues the document.
#   V1: bonafide, NOC (students)       V3: leaving documents (final years and alumni)

# The full chain used by the V1 student documents.
CHAIN = ["mentor", "class_incharge", "ahod", "hod", "principal"]

ROLE_LABELS = {
    "mentor": "Mentor",
    "class_incharge": "Class In-charge",
    "ahod": "Associate HOD",
    "hod": "HOD",
    "coe": "Controller of Examinations",
    "principal": "Principal",
}

# Hours an approver has before a request counts as overdue at their desk.
STEP_SLA_HOURS = 24

OTHER = "Other"
COURSE_COMPLETED = "Course completed"

# fulfilment: "generated" = the portal renders the signed PDF; "upload" = the Exam Cell prepares the
# document from the examination records and uploads it (the portal holds no marks).
# needs_exit: None | "cleared" (no-dues complete) ; completed_only: only for students who finished the course.
DOC_TYPES = {
    "bonafide": {
        "name": "Bonafide Certificate", "code": "BON", "counter": "civilit", "counter_name": "Admin Office",
        "fee": 0, "chain": CHAIN, "fulfilment": "generated", "needs_exit": None, "completed_only": False,
        "for_alumni": False,
        "description": "Certifies that you are a bonafide student of the college.",
        "purposes": ["Scholarship (TS ePASS)", "Passport application", "Bank account opening",
                     "Bus / railway concession", "Education loan", "Aadhaar update", OTHER],
        "fields": [],
    },
    "noc": {
        "name": "No Objection Certificate (NOC)", "code": "NOC", "counter": "placement", "counter_name": "Placement Cell",
        "fee": 0, "chain": CHAIN, "fulfilment": "generated", "needs_exit": None, "completed_only": False,
        "for_alumni": False,
        "description": "The college has no objection to your internship, competition or other activity.",
        "purposes": ["Internship", "Hackathon / competition", "Part-time work", "Higher studies / entrance exam", "Passport", OTHER],
        "fields": [
            {"key": "organization", "label": "Organisation / event", "required": True},
            {"key": "location", "label": "Location", "required": False},
            {"key": "from_date", "label": "From date", "required": False, "type": "date"},
            {"key": "to_date", "label": "To date", "required": False, "type": "date"},
        ],
    },
    # ── Leaving documents (V3) ──
    "tc": {
        "name": "Transfer Certificate (TC)", "code": "TC", "counter": "civilit", "counter_name": "Admin Office",
        "fee": 0, "chain": ["hod", "principal"], "fulfilment": "generated", "needs_exit": "cleared", "completed_only": False,
        "for_alumni": True,
        "description": "Issued when you leave the college, after your no-dues clearance.",
        "purposes": ["Higher studies", "Employment", OTHER], "fields": [],
    },
    "conduct": {
        "name": "Conduct Certificate", "code": "CON", "counter": "civilit", "counter_name": "Admin Office",
        "fee": 0, "chain": ["hod", "principal"], "fulfilment": "generated", "needs_exit": "cleared", "completed_only": False,
        "for_alumni": True,
        "description": "Your conduct and character during your study at the college.",
        "purposes": ["Higher studies", "Employment", "Passport / visa", OTHER], "fields": [],
    },
    "course_completion": {
        "name": "Course Completion Certificate", "code": "CCC", "counter": "civilit", "counter_name": "Admin Office",
        "fee": 0, "chain": ["hod", "principal"], "fulfilment": "generated", "needs_exit": "cleared", "completed_only": True,
        "for_alumni": True,
        "description": "Confirms you completed the B.E. programme (the degree itself is awarded by Osmania University).",
        "purposes": ["Higher studies", "Employment", "Visa application", OTHER], "fields": [],
    },
    "moi": {
        "name": "Medium of Instruction Certificate", "code": "MOI", "counter": "civilit", "counter_name": "Admin Office",
        "fee": 200, "chain": ["hod", "principal"], "fulfilment": "generated", "needs_exit": None, "completed_only": False,
        "for_alumni": True,
        "description": "States that the programme is taught and examined in English (for studies abroad, IELTS/TOEFL waivers, visas).",
        "purposes": ["Higher studies abroad", "IELTS / TOEFL", "Visa application", "Employment", OTHER], "fields": [],
    },
    "provisional": {
        "name": "Provisional Certificate (PC)", "code": "PC", "counter": "exam", "counter_name": "Exam Cell",
        "fee": 500, "chain": ["coe", "principal"], "fulfilment": "upload", "needs_exit": "cleared", "completed_only": True,
        "for_alumni": True,
        "description": "Proof of passing until Osmania University issues the original degree.",
        "purposes": ["Higher studies", "Employment", OTHER], "fields": [],
    },
    "cmm": {
        "name": "Consolidated Marks Memo (CMM)", "code": "CMM", "counter": "exam", "counter_name": "Exam Cell",
        "fee": 500, "chain": ["coe", "principal"], "fulfilment": "upload", "needs_exit": "cleared", "completed_only": True,
        "for_alumni": True,
        "description": "All semesters' grades in one memo, prepared by the Exam Cell.",
        "purposes": ["Higher studies", "Employment", OTHER], "fields": [],
    },
    "transcripts": {
        "name": "Official Transcripts", "code": "TR", "counter": "exam", "counter_name": "Exam Cell",
        "fee": 300, "per_copy": True, "chain": ["coe", "principal"], "fulfilment": "upload", "needs_exit": None,
        "completed_only": False, "for_alumni": True,
        "description": "Attested transcripts for universities abroad and credential evaluation (WES, ECE).",
        "purposes": ["Higher studies abroad", "WES / ECE evaluation", "Employment abroad", OTHER],
        "fields": [
            {"key": "copies", "label": "Number of copies", "required": True, "type": "number", "min": 1, "max": 10},
            {"key": "delivery", "label": "Delivery", "required": True, "type": "select",
             "options": ["Digital copy (download)", "Sealed envelope — collect at Exam Cell",
                         "Post to my address", "Send directly to WES / ECE"]},
            {"key": "address", "label": "Postal address (for posting)", "required": False, "show_if": {"delivery": "Post to my address"}},
            {"key": "wes_ref", "label": "WES / ECE reference number", "required": False, "show_if": {"delivery": "Send directly to WES / ECE"}},
        ],
    },
}

# NOC purposes that need dates on the certificate
NOC_DATED_PURPOSES = {"Internship", "Part-time work", "Hackathon / competition"}

EXIT_REASONS = [COURSE_COMPLETED, "Discontinued", "Transfer to another institution"]

# No-dues clearance units and where they sit on the twin ("department" = the student's department block)
CLEARANCE_UNITS = [
    {"key": "library",    "label": "Library",            "place": "lib"},
    {"key": "accounts",   "label": "Accounts section",   "place": "civilit"},
    {"key": "department", "label": "Department (labs)",  "place": None},
    {"key": "transport",  "label": "Transport",          "place": "Parking (Buses)"},
    {"key": "exam_cell",  "label": "Exam Cell",          "place": "exam"},
    {"key": "placement",  "label": "Placement Cell",     "place": "placement"},
    {"key": "sports",     "label": "Sports",             "place": "cant"},
]
UNIT_LABELS = {u["key"]: u["label"] for u in CLEARANCE_UNITS}

# Which twin building each department's approvers sit in (mentor .. HOD steps)
DEPARTMENT_BUILDINGS = {
    "CSE": "cse",
    "ECE": "ece",
    "EEE": "mecheee",
    "MECH": "mecheee",
    "MECHANICAL": "mecheee",
    "CIVIL": "civilit",
    "IT": "civilit",
    "S&H": "sh",
}
PRINCIPAL_BUILDING = "civilit"   # Principal / Director's office (Civil & IT block, first floor)
COE_BUILDING = "exam"            # Controller of Examinations (Exam Cell)


def department_building(department: str) -> str:
    return DEPARTMENT_BUILDINGS.get((department or "").strip().upper(), "civilit")


def unit_place(unit: str, department: str) -> str:
    place = next(u["place"] for u in CLEARANCE_UNITS if u["key"] == unit)
    return place or department_building(department)


def public_catalog(fees: dict | None = None) -> list:
    """Catalogue as sent to the frontend. fees: admin overrides {doc_type: amount}."""
    fees = fees or {}
    return [
        {
            "id": key,
            "name": d["name"],
            "counter": d["counter"],
            "counter_name": d["counter_name"],
            "fee": fees.get(key, d["fee"]),
            "per_copy": d.get("per_copy", False),
            "description": d["description"],
            "purposes": d["purposes"],
            "fields": d["fields"],
            # Purposes whose certificate states a period (from/to dates become required)
            "dated_purposes": sorted(NOC_DATED_PURPOSES) if key == "noc" else [],
            "chain": [{"role": r, "label": ROLE_LABELS[r]} for r in d["chain"]],
            "fulfilment": d["fulfilment"],
            "needs_exit": d["needs_exit"],
            "completed_only": d["completed_only"],
            "for_alumni": d["for_alumni"],
            "sla_hours": STEP_SLA_HOURS,
        }
        for key, d in DOC_TYPES.items()
    ]

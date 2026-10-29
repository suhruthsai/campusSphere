# Which departments a report covers. CampusSphere runs as a pilot in the Civil & IT block: the
# timetable, faculty and rooms are loaded for Civil and IT only, so reports cover those programmes
# (NBA accredits each programme separately; NAAC can take the whole pilot).
PILOT_NAME = "Civil & IT Block pilot"
PILOT_BUILDING = "civilit"

SCOPES = {
    "both":  {"id": "both",  "label": PILOT_NAME,                    "short": "Civil & IT", "departments": ("CIVIL", "IT")},
    "civil": {"id": "civil", "label": "Civil Engineering programme", "short": "Civil",      "departments": ("CIVIL",)},
    "it":    {"id": "it",    "label": "Information Technology programme", "short": "IT",    "departments": ("IT",)},
}

_ALIASES = {"CIVIL ENGINEERING": "CIVIL", "CE": "CIVIL", "INFORMATION TECHNOLOGY": "IT"}


def dept_key(department) -> str:
    d = (department or "").strip().upper()
    return _ALIASES.get(d, d)


class Scope:
    def __init__(self, scope_id: str = "both"):
        self.meta = SCOPES[scope_id]
        self.id = scope_id
        self.departments = set(self.meta["departments"])

    def has(self, department) -> bool:
        return dept_key(department) in self.departments

    def describe(self) -> dict:
        return {"id": self.id, "label": self.meta["label"], "short": self.meta["short"], "pilot": PILOT_NAME,
                "departments": sorted(self.departments)}

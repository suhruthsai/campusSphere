import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.security import require_admin
from backend.app.db.session import get_db
from backend.app.models.campus import BuildingModel
from backend.app.schemas.campus import BuildingOut

router = APIRouter()

# MVSR Nadergul buildings, with the same ids as the 3D twin. Seeded into the database once;
# after that the admin edits them under Admin → Buildings.
SEED_BUILDINGS = [
    {"id": "cse",         "name": "CSE Block",              "type": "Academic",               "floors": 3, "capacity": 600, "color": "#00E5FF", "departments": ["Computer Science Engg."]},
    {"id": "ece",         "name": "ECE Block",              "type": "Academic",               "floors": 2, "capacity": 550, "color": "#7B61FF", "departments": ["Electronics & Communication Engg."]},
    {"id": "mecheee",     "name": "Mech & EEE Block",       "type": "Academic",               "floors": 3, "capacity": 500, "color": "#F59E0B", "departments": ["Mechanical Engg.", "Electrical & Electronics Engg."]},
    {"id": "civilit",     "name": "Civil & IT Block",       "type": "Academic",               "floors": 3, "capacity": 800, "color": "#10B981", "departments": ["Civil Engineering", "Information Technology"]},
    {"id": "sh",          "name": "S&H Block",              "type": "Academic",               "floors": 4, "capacity": 400, "color": "#A78BFA", "departments": ["Science & Humanities"]},
    {"id": "exam",        "name": "Examination Department", "type": "Admin",                  "floors": 4, "capacity": 200, "color": "#EC4899", "departments": ["Examination Department"]},
    {"id": "lib",         "name": "Library",                "type": "Library",                "floors": 2, "capacity": 140, "color": "#F472B6", "departments": ["Library"]},
    {"id": "placement",   "name": "Placement Cell",         "type": "Admin",                  "floors": 3, "capacity": 150, "color": "#38BDF8", "departments": ["Training & Placement"]},
    {"id": "rnd",         "name": "R&D Block",              "type": "Research & Development", "floors": 2, "capacity": 300, "color": "#7B61FF", "departments": ["Research & Development"]},
    {"id": "cad",         "name": "CAD Lab",                "type": "Lab",                    "floors": 1, "capacity": 70,  "color": "#38BDF8", "departments": ["CAD Lab"]},
    {"id": "cant",        "name": "Canteen & Sports Block", "type": "Canteen",                "floors": 2, "capacity": 250, "color": "#FB7185", "departments": ["Canteen", "Sports & Fine Arts"]},
    {"id": "boyshostel",  "name": "Boys Hostel",            "type": "Hostel",                 "floors": 3, "capacity": 300, "color": "#3B82F6", "departments": ["Accommodation"]},
    {"id": "girlshostel", "name": "Girls Hostel",           "type": "Hostel",                 "floors": 3, "capacity": 300, "color": "#EC4899", "departments": ["Accommodation"]},
]


def _ensure_seeded(db: Session) -> None:
    """First run only (empty or near-empty table): add the campus buildings. Never re-adds ones the admin removed."""
    have = {b.id for b in db.query(BuildingModel.id).all()}
    if len(have) > 1:
        return
    for b in (x for x in SEED_BUILDINGS if x["id"] not in have):
        db.add(BuildingModel(**b))
    db.commit()


class BuildingIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    type: str = Field(..., min_length=2, max_length=60)
    floors: int = Field(..., ge=1, le=20)
    capacity: Optional[int] = Field(None, ge=0, le=100000)
    color: str = Field("#00E5FF", pattern=r"^#[0-9A-Fa-f]{6}$")
    health: str = Field("Good", pattern=r"^(Good|Warning|Critical)$")


@router.get("/", response_model=List[BuildingOut])
def get_buildings(db: Session = Depends(get_db)):
    _ensure_seeded(db)
    return db.query(BuildingModel).order_by(BuildingModel.name).all()


@router.post("/", response_model=BuildingOut, status_code=201, summary="Add a building (admin only)")
def add_building(body: BuildingIn, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    base = re.sub(r"[^a-z0-9]+", "", body.name.lower())[:16] or "building"
    bid, n = base, 2
    while db.query(BuildingModel).filter(BuildingModel.id == bid).first():
        bid, n = f"{base}{n}", n + 1
    b = BuildingModel(id=bid, name=body.name.strip(), type=body.type.strip(), floors=body.floors,
                      capacity=body.capacity if body.capacity is not None else body.floors * 120,
                      color=body.color, health=body.health, departments=[])
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


@router.put("/{building_id}", response_model=BuildingOut, summary="Edit a building (admin only)")
def edit_building(building_id: str, body: BuildingIn, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    b = db.query(BuildingModel).filter(BuildingModel.id == building_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Building not found")
    b.name, b.type, b.floors = body.name.strip(), body.type.strip(), body.floors
    b.color, b.health = body.color, body.health
    if body.capacity is not None:
        b.capacity = body.capacity
    db.commit()
    db.refresh(b)
    return b


@router.delete("/{building_id}", summary="Remove a building (admin only)")
def delete_building(building_id: str, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    b = db.query(BuildingModel).filter(BuildingModel.id == building_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Building not found")
    db.delete(b)
    db.commit()
    return {"message": f"{b.name} removed"}

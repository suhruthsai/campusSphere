"""
Seed script — populates the 'buildings' table with all campus buildings.
Run with: python -m backend.app.db.seed
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../.."))

from backend.app.db.session import SessionLocal, engine, Base
from backend.app.models import campus

Base.metadata.create_all(bind=engine)

BUILDINGS_SEED = [
    {"id": "rnd",        "name": "R&D",                    "type": "Research & Development", "x": -78, "z": -50, "floors": 2, "color": "#14b8a6", "departments": ["Research & Development"]},
    {"id": "cant",       "name": "Canteen",                "type": "Canteen",                "x": -55, "z": -50, "floors": 2, "color": "#f97316", "departments": ["Canteen"]},
    {"id": "cad",        "name": "CAD Lab",                "type": "Lab",                    "x": -28, "z": -50, "floors": 1, "color": "#3b82f6", "departments": ["CAD Lab"]},
    {"id": "exam",       "name": "Examination Department", "type": "Admin",                  "x": -2,  "z": -50, "floors": 4, "color": "#ec4899", "departments": ["Examination Department"]},
    {"id": "sh",         "name": "S&H Block",              "type": "Academic",               "x": 45,  "z": -50, "floors": 5, "color": "#8b5cf6", "departments": ["Science & Humanities"]},
    {"id": "ece",        "name": "ECE Block",              "type": "Academic",               "x": -65, "z": -9,  "floors": 2, "color": "#06b6d4", "departments": ["ECE"]},
    {"id": "cse",        "name": "CSE Block",              "type": "Academic",               "x": -40, "z": -9,  "floors": 4, "color": "#6366f1", "departments": ["CSE"]},
    {"id": "mecheee",    "name": "Mech & EEE",             "type": "Academic",               "x": -10, "z": -9,  "floors": 4, "color": "#f59e0b", "departments": ["Mech", "EEE"]},
    {"id": "civilit",    "name": "Civil & IT",             "type": "Academic",               "x": 23,  "z": -9,  "floors": 3, "color": "#10b981", "departments": ["Civil", "IT"]},
    {"id": "lib",        "name": "Library",                "type": "Admin",                  "x": -30, "z": 55,  "floors": 2, "color": "#a855f7", "departments": ["Library"]},
    {"id": "aud",        "name": "Auditorium",             "type": "Auditorium",             "x": 12,  "z": 55,  "floors": 1, "color": "#f43f5e", "departments": ["Auditorium"]},
    {"id": "frontgate",  "name": "Suhruth University",     "type": "Entrance",               "x": 81,  "z": 2,   "floors": 1, "color": "#334155", "departments": []},
    {"id": "backgate",   "name": "Back Gate",              "type": "Entrance",               "x": -77, "z": 55,  "floors": 1, "color": "#334155", "departments": []},
    {"id": "boyshostel", "name": "Boys Hostel",            "type": "Hostel",                 "x": 82,  "z": -35, "floors": 4, "color": "#3b82f6", "departments": ["Accommodation"]},
    {"id": "girlshostel","name": "Girls Hostel",           "type": "Hostel",                 "x": 82,  "z": 45,  "floors": 4, "color": "#ec4899", "departments": ["Accommodation"]},
    {"id": "security",   "name": "Security Room",          "type": "Admin",                  "x": 74,  "z": -8,  "floors": 1, "color": "#475569", "departments": ["Security"]},
]

def seed():
    db = SessionLocal()
    try:
        existing_ids = {b.id for b in db.query(campus.BuildingModel).all()}
        added = 0
        for data in BUILDINGS_SEED:
            if data["id"] not in existing_ids:
                building = campus.BuildingModel(**data)
                db.add(building)
                added += 1
        db.commit()
        print(f"✅ Seeded {added} buildings. ({len(existing_ids)} already existed)")
    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()

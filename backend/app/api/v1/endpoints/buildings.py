from fastapi import APIRouter
from typing import List
from backend.app.schemas.campus import BuildingOut

router = APIRouter()

DEMO_BUILDINGS = [
    {"id": "b001", "name": "Basketball Court",   "type": "Sports",                "x": -18, "z": -12, "height": 0.3, "floors": 1, "color": "#00FFB3", "occupancy": 40, "health": "Good",     "capacity": 50 },
    {"id": "b002", "name": "Ground",             "type": "Sports Field",          "x": -18, "z": 0,   "height": 0.1, "floors": 1, "color": "#34D399", "occupancy": 15, "health": "Good",     "capacity": 1000 },
    {"id": "b003", "name": "Parking Area",       "type": "Parking",               "x": -18, "z": 12,  "height": 0.2, "floors": 1, "color": "#F59E0B", "occupancy": 70, "health": "Good",     "capacity": 120 },
    {"id": "b004", "name": "R&D Block",          "type": "Research & Development","x": -10, "z": -12, "height": 1.6, "floors": 3, "color": "#7B61FF", "occupancy": 62, "health": "Good",     "capacity": 300 },
    {"id": "b005", "name": "Canteen",            "type": "Dining",                "x": -5,  "z": -12, "height": 0.8, "floors": 1, "color": "#fb7185", "occupancy": 84, "health": "Good",     "capacity": 250 },
    {"id": "b006", "name": "CAD Lab",            "type": "Design Studio",         "x": 0,   "z": -12, "height": 1.0, "floors": 2, "color": "#38BDF8", "occupancy": 0,  "health": "Good",     "capacity": 70 },
    {"id": "b007", "name": "Examination Dept",   "type": "Administration",        "x": 5,   "z": -12, "height": 1.2, "floors": 2, "color": "#fbbf24", "occupancy": 0,  "health": "Warning",  "capacity": 200 },
    {"id": "b008", "name": "S&H Block",          "type": "Science & Humanities",  "x": 13,  "z": -12, "height": 1.5, "floors": 3, "color": "#a78bfa", "occupancy": 78, "health": "Good",     "capacity": 400 },
    {"id": "b009", "name": "Garden",             "type": "Landscape",             "x": 18,  "z": -12, "height": 0.2, "floors": 1, "color": "#4ade80", "occupancy": 20, "health": "Good",     "capacity": 200 },
    {"id": "b010", "name": "CSE Block",          "type": "Computer Science & Engg","x": -10, "z": 0,   "height": 2.2, "floors": 4, "color": "#00E5FF", "occupancy": 88, "health": "Good",     "capacity": 600 },
    {"id": "b011", "name": "ECE Block",          "type": "Electronics & Comm Engg","x": -3,  "z": 0,   "height": 2.0, "floors": 4, "color": "#7B61FF", "occupancy": 72, "health": "Warning",  "capacity": 550 },
    {"id": "b012", "name": "Mech & EEE Block",   "type": "Mechanical & Electrical","x": 5,   "z": 0,   "height": 1.8, "floors": 3, "color": "#F59E0B", "occupancy": 65, "health": "Good",     "capacity": 500 },
    {"id": "b013", "name": "Civil & IT Block",   "type": "Civil & Info Tech",     "x": 12,  "z": 0,   "height": 1.8, "floors": 3, "color": "#00FFB3", "occupancy": 58, "health": "Good",     "capacity": 500 },
    {"id": "b014", "name": "Library",            "type": "Knowledge Resource",    "x": -10, "z": 12,  "height": 1.4, "floors": 2, "color": "#F472B6", "occupancy": 69, "health": "Good",     "capacity": 140 },
    {"id": "b015", "name": "Main Gate",          "type": "Campus Entry",          "x": 18,  "z": 0,   "height": 0.9, "floors": 1, "color": "#38BDF8", "occupancy": 90, "health": "Good",     "capacity": 500 },
]

@router.get("/", response_model=List[BuildingOut])
def get_buildings():
    return DEMO_BUILDINGS

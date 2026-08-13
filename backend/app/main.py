import asyncio
import json
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.app.core.config import settings
from backend.app.api.v1.router import api_router
from backend.app.db.session import engine, Base, SessionLocal
from backend.app.models import campus
from backend.app.core.state import global_state
from backend.app.core.security import get_password_hash
import random
import datetime
import uuid

# Create tables (graceful — won't crash if DB is temporarily unavailable)
try:
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created/verified.")
except Exception as e:
    print(f"⚠️  DB connection warning (tables not created): {e}")

# ── Seed default admin user on first run ───────────────────────────────────────
def seed_admin():
    db = SessionLocal()
    try:
        exists = db.query(campus.UserModel).filter(campus.UserModel.email == "admin@suhruth.edu").first()
        if not exists:
            admin = campus.UserModel(
                id=f"u_{uuid.uuid4().hex[:10]}",
                name="System Admin",
                email="admin@suhruth.edu",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                department="Administration",
                status="active",
                joined_at=datetime.datetime.utcnow().strftime("%Y-%m-%d"),
                last_active=datetime.datetime.utcnow().strftime("%Y-%m-%d"),
            )
            db.add(admin)
            db.commit()
            print("✅ Default admin seeded: admin@suhruth.edu / admin123")
    except Exception as e:
        print(f"⚠️  Admin seed warning: {e}")
    finally:
        db.close()

seed_admin()

def seed_civilit_block():
    try:
        from backend.app.db.seed_all_timetables import seed_all
        seed_all()
    except Exception as e:
        print(f"⚠️ Timetable seeding warning: {e}")

seed_civilit_block()



app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "message": "CampusSphere FastAPI Digital Twin & AI Backend is Running",
        "docs": "/docs",
        "version": settings.VERSION
    }

# ── WebSockets Live Telemetry Stream ──────────────────────────────────────────
@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await websocket.accept()
    # Initialize parking spots (60 spots, randomly occupied)
    spots = [{"id": f"spot_{i}", "occupied": random.random() > 0.3} for i in range(60)]
    
    try:
        count = 0
        while True:
            count += 1
            
            # Simulate cars entering/leaving (toggle 1-3 spots)
            num_to_toggle = random.randint(1, 3)
            for _ in range(num_to_toggle):
                idx = random.randint(0, 59)
                spots[idx]["occupied"] = not spots[idx]["occupied"]
            
            # Sync to global state for API routing logic to read
            global_state.parking_spots = spots

            occupied_count = sum(1 for s in spots if s["occupied"])

            telemetry_data = {
                "sequence": count,
                "active_users": 2840 + (count % 15) - (count % 7),
                "energy_kwh": round(1842.5 + (count % 10) * 0.8, 2),
                "water_litres": 28450 + (count % 20) * 5,
                "parking": {
                    "total": 60,
                    "occupied": occupied_count,
                    "spots": spots
                },
                "timestamp": asyncio.get_event_loop().time()
            }
            
            # Log to SQLite every 10 iterations (30 seconds)
            if count % 10 == 0:
                db = SessionLocal()
                try:
                    log_entry = campus.TelemetryLogModel(
                        module="parking_and_users",
                        data=telemetry_data
                    )
                    db.add(log_entry)
                    db.commit()
                except Exception as e:
                    print("DB Log Error:", e)
                finally:
                    db.close()
                    
            await websocket.send_json(telemetry_data)
            await asyncio.sleep(3) # Send real-time updates every 3 seconds
    except WebSocketDisconnect:
        pass

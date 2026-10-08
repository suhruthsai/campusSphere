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
from backend.app.core.security import get_password_hash, verify_password
from backend.app.core.realtime import timetable_manager
from backend.app.api.v1.endpoints.media import MEDIA_DIR
from sqlalchemy import text
import random
import secrets
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
        admin_email = settings.ADMIN_EMAIL.lower()
        exists = db.query(campus.UserModel).filter(campus.UserModel.email == admin_email).first()
        if exists:
            if verify_password("admin123", exists.hashed_password):
                print(f"⚠️  SECURITY: {admin_email} still uses the old default password 'admin123'. Change it now via POST /api/v1/auth/change-password.")
        else:
            password = settings.ADMIN_PASSWORD
            if not password:
                password = secrets.token_urlsafe(12)
                print(f"🔑 Generated admin password for {admin_email}: {password}  (shown once — set ADMIN_PASSWORD to choose your own)")
            admin = campus.UserModel(
                id=f"u_{uuid.uuid4().hex[:10]}",
                name="System Admin",
                email=admin_email,
                hashed_password=get_password_hash(password),
                role="admin",
                department="Administration",
                status="active",
                joined_at=datetime.datetime.utcnow().strftime("%Y-%m-%d"),
                last_active=datetime.datetime.utcnow().strftime("%Y-%m-%d"),
            )
            db.add(admin)
            db.commit()
            print(f"✅ Admin account seeded: {admin_email}")
    except Exception as e:
        print(f"⚠️  Admin seed warning: {e}")
    finally:
        db.close()

seed_admin()

def seed_civilit_block():
    try:
        from backend.app.db.seed_all_timetables import seed_all
        # Only seed an empty database — never wipe timetable edits on restart/redeploy.
        # To force a full reseed, run: python backend/app/db/seed_all_timetables.py
        seed_all(only_if_empty=True)
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
    allow_origins=settings.cors_origins,
    allow_credentials=False,  # auth uses Authorization headers, not cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Include API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Uploaded room media (note: on hosts with ephemeral disks, e.g. Render free tier, uploads are lost on redeploy)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

@app.get("/health", include_in_schema=False)
def health():
    """Health check for the hosting platform — verifies the DB is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        from fastapi.responses import JSONResponse
        return JSONResponse({"status": "db_unavailable"}, status_code=503)

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


# ── WebSockets Timetable Updates ──────────────────────────────────────────────

@app.websocket("/ws/timetable")
async def websocket_timetable_endpoint(websocket: WebSocket):
    await timetable_manager.connect(websocket)
    try:
        while True:
            # We don't expect messages from client, but we must receive to keep conn alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        timetable_manager.disconnect(websocket)

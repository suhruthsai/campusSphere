import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.api.v1.router import api_router
from backend.app.db.session import engine, Base, SessionLocal
from backend.app.models import campus
from backend.app.models import services as _services_models  # registers the student-services tables
from backend.app.models import admissions as _admissions_models  # joining, fees, originals register
from backend.app.models import leaving as _leaving_models  # no-dues clearance, leaving-document fees
from backend.app.models import knowledge as _knowledge_models  # Mitra's knowledge base (crawled college website)
from backend.app.models import attendance as _attendance_models  # class attendance by period, rules
from backend.app.models import placements as _placement_models  # drives, registrations, batch summaries
from backend.app.models import accreditation as _accreditation_models  # yearly values, evidence, roles, facts
from backend.app.models import obe as _obe_models  # outcomes, COs, mapping, assessments, attainment rules
from backend.app.models import feedback as _feedback_models  # feedback forms and responses, ATRs, exam results
from backend.app.models import research as _research_models  # faculty records, research items, MoUs and extension
from backend.app.models import institution as _institution_models  # progression, facility / finance figures, meetings
from backend.app.models import locker as _locker_models  # CampusLocker: documents, share links, access log
from backend.app.models import college_docs as _college_docs_models  # documents read from the college website
from backend.app.core.security import get_password_hash, verify_password
from backend.app.core.realtime import timetable_manager
from backend.app.core import storage
from sqlalchemy import text
import secrets
import datetime
import uuid

# Create tables (graceful — won't crash if DB is temporarily unavailable)
try:
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created/verified.")
    from backend.app.db.migrations import ensure_columns
    for column in ensure_columns(engine):
        print(f"✅ Added column {column}")
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
        from backend.app.db.seed_all_timetables import seed_all, sync_subjects
        # Only seed an empty database — never wipe timetable edits on restart/redeploy.
        # To force a full reseed, run: python backend/app/db/seed_all_timetables.py
        seed_all(only_if_empty=True)
        sync_subjects()   # the subject picker in the timetable editor needs the subjects list
    except Exception as e:
        print(f"⚠️ Timetable seeding warning: {e}")

seed_civilit_block()


def warm_utilization_model():
    """Load (or train, ~20 s the first time) the classroom-utilization model in the
    background so the first request doesn't wait for it."""
    import threading

    def run():
        db = SessionLocal()
        try:
            from backend.app.ai.utilization.model import get_bundle
            info = get_bundle(db)["info"]
            print(f"✅ Utilization model ready (trained {info['trained_at']}, {info['training_rows']} sessions)")
        except Exception as e:
            print(f"⚠️  Utilization model warm-up failed: {e}")
        finally:
            db.close()

    threading.Thread(target=run, daemon=True, name="utilization-warmup").start()

if settings.WARM_UTILIZATION_MODEL:
    warm_utilization_model()

# Mitra's college knowledge base: load the search index, crawl mvsrec.edu.in on first run and weekly
from backend.app.knowledge.service import start_background as start_knowledge
start_knowledge(crawl=settings.BACKGROUND_CRAWLS)
# The documents the college website publishes, kept for CampusLocker (first run, then weekly)
if settings.BACKGROUND_CRAWLS:
    from backend.app.college_docs.scraper import start_background as start_college_docs
    start_college_docs()



app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.middleware("http")
async def relative_redirects(request, call_next):
    """Keep redirects on the address the visitor is using. The site proxies /api through Vercel, but the
    trailing-slash redirect names this server's own host (…onrender.com), which would send the browser
    around the proxy (and fail on Vercel's preview addresses). A path-only Location works either way."""
    response = await call_next(request)
    loc = response.headers.get("location")
    if loc and response.status_code in (301, 302, 307, 308):
        own = f"{request.url.scheme}://{request.url.netloc}"
        if loc.startswith(own):
            response.headers["location"] = loc[len(own):] or "/"
    return response


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

# Uploaded room media. On hosts that wipe their disk (Render free), set STORAGE_BACKEND=s3 so they survive.
@app.get("/media/{filename}", include_in_schema=False)
def media_file(filename: str):
    """Room photos and videos (public, as before): ./media_uploads locally, or the R2 bucket."""
    import mimetypes
    return storage.send(storage.key("media", filename), mimetypes.guess_type(filename)[0],
                        {"Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff"})

@app.api_route("/ping", methods=["GET", "HEAD"], include_in_schema=False)
def ping():
    """Liveness only: never touches the database. Render's health check (every few seconds) and the uptime
    monitor call this, so Neon can still suspend when nobody uses the app and stays inside its free hours."""
    return {"status": "ok"}


@app.api_route("/health", methods=["GET", "HEAD"], include_in_schema=False)
def health():
    """Full check: verifies the DB is reachable. For people and deploy checks, not for frequent polling."""
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
async def _ws_sign_in(websocket: WebSocket):
    """Sign the socket in with its first frame: {"token": "..."}.

    Browsers can't set an Authorization header on a WebSocket, and a token in the query string ends up in
    the server's access log, the proxy's log and the browser's history. So the socket is accepted first and
    the caller has SIGN_IN_SECONDS to send its token; anything else closes the connection.
    """
    from backend.app.core.security import _resolve_user
    await websocket.accept()
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=SIGN_IN_SECONDS)
        token = json.loads(raw).get("token")
    except (asyncio.TimeoutError, ValueError, AttributeError, WebSocketDisconnect):
        token = None
    if not token:
        await websocket.close(code=1008)      # policy violation: not signed in
        return None
    db = SessionLocal()
    try:
        user = _resolve_user(token, db)
    finally:
        db.close()
    if not user or user["must_change_password"]:   # temporary passwords get My account only
        await websocket.close(code=1008)
        return None
    return user


SIGN_IN_SECONDS = 5


# There is no /ws/telemetry socket: it used to stream invented parking occupancy and a made-up
# "active users" count. The car park is a fixed arrangement in core/state.py until real sensors exist.

# ── WebSockets Timetable Updates ──────────────────────────────────────────────

@app.websocket("/ws/timetable")
async def websocket_timetable_endpoint(websocket: WebSocket):
    if not await _ws_sign_in(websocket):
        return
    timetable_manager.join(websocket)
    try:
        while True:
            # We don't expect messages from client, but we must receive to keep conn alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        timetable_manager.disconnect(websocket)

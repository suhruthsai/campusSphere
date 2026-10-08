from fastapi import APIRouter, Depends
from backend.app.core.security import get_current_user
from backend.app.api.v1.endpoints import auth, ai, buildings, monitoring, routing, media, attendance, events, announcements, classrooms, timetable, subjects, faculty_profiles, substitutions

api_router = APIRouter()

# /auth handles its own per-route auth (login/register are public).
api_router.include_router(auth.router,             prefix="/auth",             tags=["Authentication"])

# Everything else requires a logged-in user; write routes add role checks on top.
authed = [Depends(get_current_user)]
api_router.include_router(ai.router,               prefix="/ai",               tags=["AI Assistant"],          dependencies=authed)
api_router.include_router(buildings.router,        prefix="/buildings",        tags=["Campus Buildings"],      dependencies=authed)
api_router.include_router(routing.router,          prefix="/buildings",        tags=["Navigation & Routing"],  dependencies=authed)
api_router.include_router(monitoring.router,       prefix="/monitoring",       tags=["IoT & Analytics"],       dependencies=authed)
api_router.include_router(media.router,            prefix="/media",            tags=["Room Media"],            dependencies=authed)
api_router.include_router(attendance.router,       prefix="/attendance",       tags=["Attendance"],            dependencies=authed)
api_router.include_router(events.router,           prefix="/events",           tags=["Campus Events"],         dependencies=authed)
api_router.include_router(announcements.router,    prefix="/announcements",    tags=["Announcements"],         dependencies=authed)
api_router.include_router(classrooms.router,       prefix="/classrooms",       tags=["Classrooms"],            dependencies=authed)
api_router.include_router(timetable.router,        prefix="/timetable",        tags=["Timetable"],             dependencies=authed)
api_router.include_router(subjects.router,         prefix="/subjects",         tags=["Subjects"],              dependencies=authed)
api_router.include_router(faculty_profiles.router, prefix="/faculty-profiles", tags=["Faculty Profiles"],      dependencies=authed)
api_router.include_router(substitutions.router,    prefix="/substitutions",    tags=["Faculty Substitutions"], dependencies=authed)

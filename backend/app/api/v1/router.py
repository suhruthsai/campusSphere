from fastapi import APIRouter, Depends
from backend.app.core.security import get_current_user
from backend.app.api.v1.endpoints import locker, accreditation, auth, ai, guide, knowledge, utilization, buildings, monitoring, routing, media, attendance, events, announcements, classrooms, timetable, subjects, faculty_profiles, substitutions, services, joining, leaving, reports, placements, obe, feedback, results, research, institution

api_router = APIRouter()

# /auth handles its own per-route auth (login/register are public).
api_router.include_router(auth.router,             prefix="/auth",             tags=["Authentication"])
# Certificate verification is public: banks/employers scan the QR without an account.
api_router.include_router(services.public_router,  prefix="/services",         tags=["Student Services"])
# Mitra, the talking 3D guide, is public so visiting parents can use it (visitors get public data only).
api_router.include_router(guide.router,            prefix="/ai/guide",         tags=["AI Guide (Mitra)"])

# Locker share links: whoever holds a live link can open that one document (the owner can withdraw it any time).
api_router.include_router(locker.public_router,    prefix="/locker",           tags=["CampusLocker (share links)"])

# The open campus map (the front door, no account): buildings, rooms, the timetable and walking routes, read-only.
# Teacher names and internal building status are hidden from guests inside these routes.
# Listed before the login-only routers below, so these paths win; the other routes of those modules stay login-only.
api_router.include_router(buildings.public_router, prefix="/buildings",        tags=["Campus Buildings"])
api_router.include_router(routing.router,          prefix="/buildings",        tags=["Navigation & Routing"])
api_router.include_router(classrooms.public_router, prefix="/classrooms",      tags=["Classrooms"])
api_router.include_router(timetable.public_router, prefix="/timetable",        tags=["Timetable"])

# Everything else requires a logged-in user; write routes add role checks on top.
authed = [Depends(get_current_user)]
api_router.include_router(ai.router,               prefix="/ai",               tags=["AI Assistant"],          dependencies=authed)
api_router.include_router(knowledge.router,         prefix="/knowledge",        tags=["Knowledge Base (Mitra)"], dependencies=authed)
api_router.include_router(utilization.router,      prefix="/ai/utilization",   tags=["Classroom Utilization"], dependencies=authed)
api_router.include_router(buildings.router,        prefix="/buildings",        tags=["Campus Buildings"],      dependencies=authed)
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
api_router.include_router(services.router,         prefix="/services",         tags=["Student Services"],      dependencies=authed)
api_router.include_router(joining.router,          prefix="/joining",          tags=["Joining & Fees"],        dependencies=authed)
api_router.include_router(locker.router,           prefix="/locker",           tags=["CampusLocker"],          dependencies=authed)
api_router.include_router(leaving.router,          prefix="/leaving",          tags=["Leaving & No-dues"],     dependencies=authed)
api_router.include_router(feedback.public_router,  prefix="/feedback",         tags=["Feedback"])
api_router.include_router(feedback.router,         prefix="/feedback",         tags=["Feedback"],              dependencies=authed)
api_router.include_router(institution.router,      prefix="/institution",      tags=["Institution records"],   dependencies=authed)
api_router.include_router(research.router,         prefix="/research",         tags=["Faculty & research"],    dependencies=authed)
api_router.include_router(results.router,          prefix="/results",          tags=["Examination results"],   dependencies=authed)
api_router.include_router(obe.router,              prefix="/obe",              tags=["Outcome-based education"], dependencies=authed)
api_router.include_router(placements.router,       prefix="/placements",       tags=["Placements"],            dependencies=authed)
api_router.include_router(reports.router,          prefix="/reports",          tags=["Department report"],     dependencies=authed)
api_router.include_router(accreditation.router,    prefix="/accreditation",    tags=["Accreditation"],         dependencies=authed)

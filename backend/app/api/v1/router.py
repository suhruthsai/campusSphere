from fastapi import APIRouter
from backend.app.api.v1.endpoints import auth, buildings, monitoring, routing, media, attendance, events, announcements, classrooms, timetable, subjects, faculty_profiles

api_router = APIRouter()

api_router.include_router(auth.router,             prefix="/auth",             tags=["Authentication"])
api_router.include_router(buildings.router,        prefix="/buildings",        tags=["Campus Buildings"])
api_router.include_router(routing.router,          prefix="/buildings",        tags=["Navigation & Routing"])
api_router.include_router(monitoring.router,       prefix="/monitoring",       tags=["IoT & Analytics"])
api_router.include_router(media.router,            prefix="/media",            tags=["Room Media"])
api_router.include_router(attendance.router,       prefix="/attendance",       tags=["Attendance"])
api_router.include_router(events.router,           prefix="/events",           tags=["Campus Events"])
api_router.include_router(announcements.router,    prefix="/announcements",    tags=["Announcements"])
api_router.include_router(classrooms.router,       prefix="/classrooms",       tags=["Classrooms"])
api_router.include_router(timetable.router,        prefix="/timetable",        tags=["Timetable"])
api_router.include_router(subjects.router,         prefix="/subjects",         tags=["Subjects"])
api_router.include_router(faculty_profiles.router, prefix="/faculty-profiles", tags=["Faculty Profiles"])

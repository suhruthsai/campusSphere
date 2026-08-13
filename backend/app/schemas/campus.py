from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any
from datetime import date

# --- Auth & User ---
class Token(BaseModel):
    access_token: str
    token_type: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "student"
    department: str = "CSE"

class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    department: str
    status: str
    joined_at: Optional[str] = None
    last_active: Optional[str] = None

    class Config:
        from_attributes = True

# --- Building ---
class BuildingOut(BaseModel):
    id: str
    name: str
    type: str
    x: float
    z: float
    height: float
    floors: int
    color: str
    occupancy: int
    health: str
    capacity: int

    class Config:
        from_attributes = True

# --- AI ---
class ForecastRequest(BaseModel):
    module: str
    days_ahead: int = 1

class ForecastResponse(BaseModel):
    module: str
    forecast_values: List[float]
    confidence_score: float
    insights: str

class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str
    sources: Optional[List[str]] = None

# --- Classroom ---
class ClassroomCreate(BaseModel):
    id: str
    name: str
    building: Optional[str] = None
    floor: int = 1
    capacity: int = 60
    equipment: List[str] = []
    status: str = "available"
    type: str = "Lecture Hall"
    location_type: str = "CLASSROOM"

class ClassroomUpdate(BaseModel):
    name: Optional[str] = None
    building: Optional[str] = None
    floor: Optional[int] = None
    capacity: Optional[int] = None
    equipment: Optional[List[str]] = None
    status: Optional[str] = None
    type: Optional[str] = None
    location_type: Optional[str] = None

class ClassroomOut(BaseModel):
    id: str
    name: str
    building: Optional[str] = None
    floor: int
    capacity: int
    equipment: List[Any] = []
    occupancy: int
    status: str
    type: str
    location_type: Optional[str] = "CLASSROOM"

    class Config:
        from_attributes = True

# --- Subject ---
class SubjectCreate(BaseModel):
    id: str
    name: str
    code: str
    department: str = "IT"
    semester: Optional[int] = None
    credits: Optional[int] = None
    subject_type: str = "theory"

class SubjectOut(BaseModel):
    id: str
    name: str
    code: str
    department: str
    semester: Optional[int] = None
    credits: Optional[int] = None
    subject_type: str

    class Config:
        from_attributes = True

# --- Faculty Profile ---
class FacultyProfileCreate(BaseModel):
    id: str
    name: str
    department: str = "IT"
    designation: Optional[str] = None
    email: Optional[str] = None
    specialization: Optional[str] = None

class FacultyProfileOut(BaseModel):
    id: str
    name: str
    department: str
    designation: Optional[str] = None
    email: Optional[str] = None
    specialization: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

# --- Timetable Entry ---
class TimetableEntryCreate(BaseModel):
    day_of_week: int
    period_number: int
    start_time: str
    end_time: str
    classroom_id: str
    subject_id: Optional[str] = None
    subject_name: str
    faculty_id: Optional[str] = None
    faculty_name: str
    department: str = "IT"
    academic_year: str = "2026-2027"
    section: str
    semester: int = 7
    batch: Optional[str] = None
    effective_from: Optional[date] = None
    effective_until: Optional[date] = None

class TimetableEntryUpdate(BaseModel):
    day_of_week: Optional[int] = None
    period_number: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    classroom_id: Optional[str] = None
    subject_id: Optional[str] = None
    subject_name: Optional[str] = None
    faculty_id: Optional[str] = None
    faculty_name: Optional[str] = None
    department: Optional[str] = None
    academic_year: Optional[str] = None
    section: Optional[str] = None
    semester: Optional[int] = None
    batch: Optional[str] = None
    effective_from: Optional[date] = None
    effective_until: Optional[date] = None
    is_active: Optional[bool] = None

class TimetableEntryOut(BaseModel):
    id: int
    day_of_week: int
    period_number: int
    start_time: str
    end_time: str
    classroom_id: str
    subject_id: Optional[str] = None
    subject_name: str
    faculty_id: Optional[str] = None
    faculty_name: str
    department: str
    academic_year: str
    section: str
    semester: int
    batch: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

# --- Runtime State ---
class CurrentClassResponse(BaseModel):
    classroom_id: str
    classroom_name: str
    building: Optional[str] = None
    floor: int
    status: str
    day_name: Optional[str] = None
    current_entry: Optional[TimetableEntryOut] = None
    next_entry: Optional[TimetableEntryOut] = None

class ConflictItem(BaseModel):
    conflict_type: str
    description: str
    entries: List[TimetableEntryOut]

class ConflictReport(BaseModel):
    total_conflicts: int
    conflicts: List[ConflictItem]

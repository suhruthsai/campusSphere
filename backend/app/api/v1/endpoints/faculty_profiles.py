from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.app.db.session import get_db
from backend.app.models.campus import FacultyProfileModel
from backend.app.schemas.campus import FacultyProfileCreate, FacultyProfileOut

router = APIRouter()

@router.get("/", response_model=List[FacultyProfileOut])
def list_faculty(
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(FacultyProfileModel)
    if department: q = q.filter(FacultyProfileModel.department == department)
    return q.filter(FacultyProfileModel.is_active == True).all()

@router.post("/", response_model=FacultyProfileOut)
def create_faculty(payload: FacultyProfileCreate, db: Session = Depends(get_db)):
    if db.query(FacultyProfileModel).filter(FacultyProfileModel.id == payload.id).first():
        raise HTTPException(status_code=409, detail="Faculty ID already exists")
    f = FacultyProfileModel(**payload.model_dump())
    db.add(f)
    db.commit()
    db.refresh(f)
    return f

@router.put("/{faculty_id}", response_model=FacultyProfileOut)
def update_faculty(faculty_id: str, payload: FacultyProfileCreate, db: Session = Depends(get_db)):
    f = db.query(FacultyProfileModel).filter(FacultyProfileModel.id == faculty_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Faculty not found")
    for k, v in payload.model_dump().items():
        setattr(f, k, v)
    db.commit()
    db.refresh(f)
    return f

@router.delete("/{faculty_id}")
def delete_faculty(faculty_id: str, db: Session = Depends(get_db)):
    f = db.query(FacultyProfileModel).filter(FacultyProfileModel.id == faculty_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Faculty not found")
    f.is_active = False
    db.commit()
    return {"message": "Deactivated"}

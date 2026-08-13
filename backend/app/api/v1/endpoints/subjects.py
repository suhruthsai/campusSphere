from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.app.db.session import get_db
from backend.app.models.campus import SubjectModel
from backend.app.schemas.campus import SubjectCreate, SubjectOut

router = APIRouter()

@router.get("/", response_model=List[SubjectOut])
def list_subjects(
    department: Optional[str] = Query(None),
    semester: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(SubjectModel)
    if department: q = q.filter(SubjectModel.department == department)
    if semester: q = q.filter(SubjectModel.semester == semester)
    return q.all()

@router.post("/", response_model=SubjectOut)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)):
    if db.query(SubjectModel).filter(SubjectModel.id == payload.id).first():
        raise HTTPException(status_code=409, detail="Subject ID already exists")
    s = SubjectModel(**payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s

@router.put("/{subject_id}", response_model=SubjectOut)
def update_subject(subject_id: str, payload: SubjectCreate, db: Session = Depends(get_db)):
    s = db.query(SubjectModel).filter(SubjectModel.id == subject_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    for k, v in payload.model_dump().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s

@router.delete("/{subject_id}")
def delete_subject(subject_id: str, db: Session = Depends(get_db)):
    s = db.query(SubjectModel).filter(SubjectModel.id == subject_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(s)
    db.commit()
    return {"message": "Deleted"}

"""
Complete Seeder — Civil & IT Block, 12 Section Timetables (Full Week).
Run via: PYTHONPATH=. .venv/bin/python3 backend/app/db/seed_all_timetables.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../.."))

from backend.app.db.session import SessionLocal, engine, Base
from backend.app.models.campus import BuildingModel, ClassroomModel, SubjectModel, FacultyProfileModel, TimetableEntryModel
from sqlalchemy import text

Base.metadata.create_all(bind=engine)
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE classrooms ADD COLUMN location_type VARCHAR DEFAULT 'CLASSROOM'"))
        conn.commit()
    except Exception:
        pass

PERIOD_TIMES = {
    1: ("09:30","10:30"), 2: ("10:30","11:30"), 3: ("11:40","12:40"),
    4: ("12:40","13:40"), 5: ("14:15","15:15"), 6: ("15:15","16:15"),
}

def seed_all():
    db = SessionLocal()
    try:
        print("🌱 Seeding Civil & IT Block — Full Week Timetables...")

        # ── 1. Building ──────────────────────────────────────────────────────────
        b_id = "civilit"
        if not db.query(BuildingModel).filter(BuildingModel.id == b_id).first():
            db.add(BuildingModel(id=b_id, name="Civil & IT Block", type="Academic",
                x=23.0, z=-15.0, height=3.0, floors=3, color="#10B981",
                occupancy=0, energy="Optimized", health="Good", capacity=800,
                departments=["Civil Engineering","Information Technology"]))
            db.commit()

        # ── 2. Physical Locations ────────────────────────────────────────────────
        locs = [
            # Ground Floor
            dict(id="ADMINISTRATION",  name="Administration",                      building=b_id,floor=0,capacity=20, type="Administration",    location_type="ADMINISTRATION",   equipment=["Desks","Computer Terminals"]),
            dict(id="CE-IT-18",        name="IoT Lab (CE-IT-18)",                  building=b_id,floor=0,capacity=35, type="Lab",               location_type="LABORATORY",       equipment=["Raspberry Pi","Arduino","IoT Kits","Projector"]),
            dict(id="TE-LAB",          name="Transportation Engineering Lab",       building=b_id,floor=0,capacity=35, type="Lab",               location_type="LABORATORY",       equipment=["Ductility Apparatus","Viscometer","Marshall Stability"]),
            dict(id="EE-LAB",          name="Environmental Engineering Lab",        building=b_id,floor=0,capacity=35, type="Lab",               location_type="LABORATORY",       equipment=["pH Meter","Turbidity Meter","BOD Incubator"]),
            dict(id="CT-LAB",          name="Concrete Technology Lab",             building=b_id,floor=0,capacity=35, type="Lab",               location_type="LABORATORY",       equipment=["CTM","Slump Cone","Vee-Bee Consistometer"]),
            dict(id="SUR-LAB-CE",      name="Surveying Lab (Civil)",               building=b_id,floor=0,capacity=40, type="Lab",               location_type="LABORATORY",       equipment=["Total Station","Theodolite","Levelling Staff"]),
            dict(id="EG-LAB-CE",       name="Engineering Geology Lab (Civil)",     building=b_id,floor=0,capacity=35, type="Lab",               location_type="LABORATORY",       equipment=["Rock Specimens","Mineral Samples","Microscopes"]),
            dict(id="FM-LAB-CE",       name="Fluid Mechanics Lab (Civil)",         building=b_id,floor=0,capacity=35, type="Lab",               location_type="LABORATORY",       equipment=["Reynolds Apparatus","Venturimeter","Orifice Meter"]),
            dict(id="ADA-LAB",         name="Ada Lab",                             building=b_id,floor=0,capacity=40, type="Lab",               location_type="LABORATORY",       equipment=["Workstations","Projector"]),
            dict(id="CB-01",           name="Charles Babbage Lab (CB-01)",         building=b_id,floor=0,capacity=50, type="Lab",               location_type="LABORATORY",       equipment=["High Performance Computing Workstations"]),
            # First Floor
            dict(id="PRINCIPAL-OFFICE",name="Principal / Directors Office",        building=b_id,floor=1,capacity=10, type="Office",            location_type="OFFICE",           equipment=["Executive Desk","Conference Table"]),
            dict(id="IT-STAFF-ROOM",   name="IT Staff Room",                       building=b_id,floor=1,capacity=25, type="Staff Room",         location_type="STAFF_ROOM",       equipment=["Faculty Cabins","Computers","Printer"]),
            dict(id="CE-IT-101",       name="Classroom CE-IT-101",                 building=b_id,floor=1,capacity=65, type="Lecture Hall",       location_type="CLASSROOM",        equipment=["Projector","Whiteboard","Podium"]),
            dict(id="CE-IT-102",       name="Classroom CE-IT-102",                 building=b_id,floor=1,capacity=65, type="Lecture Hall",       location_type="CLASSROOM",        equipment=["Projector","Whiteboard","Podium"]),
            dict(id="CIVIL-DEPT-OFFICE",name="Civil Department Office",            building=b_id,floor=1,capacity=15, type="Department Office",  location_type="DEPARTMENT_OFFICE",equipment=["HOD Desk","Faculty Cabins","Records Storage"]),
            dict(id="IQAC-ROOM",       name="IQAC Room",                           building=b_id,floor=1,capacity=12, type="Office",            location_type="OFFICE",           equipment=["Meeting Table","Display Screen"]),
            dict(id="CE-IT-104",       name="Computer Lab (CE-IT-104)",            building=b_id,floor=1,capacity=40, type="Lab",               location_type="LABORATORY",       equipment=["40 i7 PCs","High Speed Fiber","Projector","Smart Board"]),
            # Second Floor
            dict(id="CE-IT-201",       name="Classroom CE-IT-201",                 building=b_id,floor=2,capacity=65, type="Lecture Hall",       location_type="CLASSROOM",        equipment=["Projector","Whiteboard"]),
            dict(id="CE-IT-202",       name="Classroom CE-IT-202",                 building=b_id,floor=2,capacity=65, type="Lecture Hall",       location_type="CLASSROOM",        equipment=["Projector","Whiteboard"]),
            dict(id="CE-IT-203",       name="Classroom CE-IT-203",                 building=b_id,floor=2,capacity=65, type="Lecture Hall",       location_type="CLASSROOM",        equipment=["Projector","Whiteboard"]),
            dict(id="CE-IT-211",       name="CN & NS Lab (CE-IT-211)",             building=b_id,floor=2,capacity=35, type="Lab",               location_type="LABORATORY",       equipment=["Cisco Routers","Managed Switches","Packet Tracer"]),
            dict(id="CE-IT-211-LAB",   name="DS Lab (CE-IT-211)",                  building=b_id,floor=2,capacity=35, type="Lab",               location_type="LABORATORY",       equipment=["35 Workstations","C Compilers"]),
            dict(id="CE-IT-212",       name="Classroom CE-IT-212",                 building=b_id,floor=2,capacity=65, type="Lecture Hall",       location_type="CLASSROOM",        equipment=["Projector","Whiteboard"]),
            dict(id="CE-IT-213",       name="Classroom CE-IT-213",                 building=b_id,floor=2,capacity=65, type="Lecture Hall",       location_type="CLASSROOM",        equipment=["Projector","Whiteboard"]),
            dict(id="CE-IT-214",       name="Electronics Laboratory (CE-IT-214)", building=b_id,floor=2,capacity=35, type="Lab",               location_type="LABORATORY",       equipment=["CRO","Function Generators","Power Supplies"]),
            dict(id="CE-204",          name="Classroom CE-204",                    building=b_id,floor=2,capacity=65, type="Lecture Hall",       location_type="CLASSROOM",        equipment=["Projector","Whiteboard"]),
            dict(id="CE-205",          name="Classroom CE-205",                    building=b_id,floor=2,capacity=65, type="Lecture Hall",       location_type="CLASSROOM",        equipment=["Projector","Whiteboard"]),
            dict(id="CE-206",          name="Classroom CE-206",                    building=b_id,floor=2,capacity=65, type="Lecture Hall",       location_type="CLASSROOM",        equipment=["Projector","Whiteboard"]),
            dict(id="CSE-LAB-IV",      name="CSE Lab-IV (CEP Lab)",               building="cse",floor=2,capacity=40,type="Lab",               location_type="LABORATORY",       equipment=["Programming Terminals"]),
        ]
        for loc in locs:
            ex = db.query(ClassroomModel).filter(ClassroomModel.id == loc["id"]).first()
            if not ex: db.add(ClassroomModel(**loc))
            else:
                for k,v in loc.items(): setattr(ex, k, v)
        db.commit()
        print(f"✅ {len(locs)} physical locations upserted.")

        # ── 3. Faculty ───────────────────────────────────────────────────────────
        faculty_data = [
            dict(id="FAC_SRU",  name="Ch.Srujana",               department="IT",    designation="Assistant Professor"),
            dict(id="FAC_PBH",  name="Phanindra Bharadwaja",      department="IT",    designation="Assistant Professor"),
            dict(id="FAC_VAS",  name="Dr.B.Vasavi",               department="IT",    designation="Professor"),
            dict(id="FAC_SRA",  name="M.Sravani",                 department="IT",    designation="Assistant Professor"),
            dict(id="FAC_KCS",  name="K.Chandra Sekhar",          department="IT",    designation="Associate Professor"),
            dict(id="FAC_SAM",  name="Dr.Ch.Samson",              department="IT",    designation="Professor & AHOD"),
            dict(id="FAC_UPE",  name="I.Upender",                 department="IT",    designation="Assistant Professor"),
            dict(id="FAC_SUN",  name="B.Sunitha",                 department="IT",    designation="Assistant Professor"),
            dict(id="FAC_DEV",  name="K.Devaki",                  department="IT",    designation="Assistant Professor"),
            dict(id="FAC_VASU", name="M.Vasundhara",              department="IT",    designation="Assistant Professor"),
            dict(id="FAC_MAN",  name="A.Manasa",                  department="IT",    designation="Assistant Professor"),
            dict(id="FAC_KSL",  name="K.Sri Laxmi",               department="IT",    designation="Assistant Professor"),
            dict(id="FAC_RMA",  name="K.Ramya Madhavi",           department="IT",    designation="Assistant Professor"),
            dict(id="FAC_NIT",  name="N.Nithya lakshmi",          department="IT",    designation="Assistant Professor"),
            dict(id="FAC_MBD",  name="Maya B Dhone",              department="IT",    designation="Assistant Professor"),
            dict(id="FAC_MUN",  name="D.Muninder",                department="IT",    designation="Associate Professor"),
            dict(id="FAC_AMB",  name="P.Amba Bhavani",            department="IT",    designation="Assistant Professor"),
            dict(id="FAC_VIB",  name="S.Ch. Vijaya Bhaskar",      department="IT",    designation="Associate Professor"),
            dict(id="FAC_KAR",  name="P.Karthik",                 department="IT",    designation="Assistant Professor"),
            dict(id="FAC_USH",  name="G.Ushasri",                 department="IT",    designation="Assistant Professor"),
            dict(id="FAC_SRI",  name="Sriranga Raju",             department="IT",    designation="Assistant Professor"),
            dict(id="FAC_SRIL", name="K.Srilaxmi",                department="IT",    designation="Assistant Professor"),
            dict(id="FAC_UGE",  name="Dr.A.Ugendhar",             department="IT",    designation="Associate Professor"),
            dict(id="FAC_RAV",  name="Dr.DBV Ravi Sankar",        department="IT",    designation="Professor"),
            dict(id="FAC_SWA",  name="M.Swapna",                  department="IT",    designation="Assistant Professor"),
            dict(id="FAC_SOW",  name="J.Sowjanya",                department="IT",    designation="Assistant Professor"),
            dict(id="FAC_AVK",  name="Dr.A.V.Krishna Prasad",     department="IT",    designation="Professor & HOD IT"),
            dict(id="FAC_SIT",  name="P.Sita Sowjanya",           department="IT",    designation="Associate Professor"),
            dict(id="FAC_GNK",  name="Dr.G.Nikhil Kumar",         department="S&H",   designation="Assistant Professor"),
            dict(id="FAC_MKR",  name="Dr. M.Kameshwar Reddy",     department="Mechanical",designation="Professor"),
            dict(id="FAC_GVS",  name="Dr.GVS Subbaraya Sharma",   department="S&H",   designation="Professor"),
            dict(id="FAC_CRT",  name="Training & Placement Cell", department="TPO",   designation="Training Coordinator"),
            # Civil
            dict(id="FAC_UDA",  name="Dr. B. Udaysree",           department="Civil", designation="Associate Professor"),
            dict(id="FAC_BHA",  name="Dr. D. Bhagya",             department="S&H",   designation="Associate Professor"),
            dict(id="FAC_SSW",  name="Mrs.S.Swathi",              department="Civil", designation="Assistant Professor"),
            dict(id="FAC_CAK",  name="Dr. C. Arvind Kumar",       department="Civil", designation="Associate Professor"),
            dict(id="FAC_VSC",  name="Dr. V. Shiva Chandra",      department="Civil", designation="Assistant Professor"),
            dict(id="FAC_PBK",  name="Dr.P.Bharath Kumar",        department="Civil", designation="Assistant Professor"),
            dict(id="FAC_KRS",  name="Mr.K.Ravi Sekhar",          department="Civil", designation="Assistant Professor"),
            dict(id="FAC_GNG",  name="Dr. G. Narendra Goud",      department="Civil", designation="Assistant Professor"),
            dict(id="FAC_VRU",  name="Mrs. K. Vrushali",          department="Civil", designation="Assistant Professor"),
            dict(id="FAC_SRR",  name="Dr. R. Sandhya Rani",       department="Civil", designation="Professor"),
            dict(id="FAC_KSB",  name="Dr. K. Sai Baba",           department="Civil", designation="Professor"),
            dict(id="FAC_PKU",  name="Mr. Prashanth Kuberkar",    department="S&H",   designation="Assistant Professor"),
            dict(id="FAC_TNK",  name="Mr. T. Naveen Kumar",       department="Civil", designation="Assistant Professor"),
            dict(id="FAC_HAR",  name="Mr. R. Hari Nath",          department="Mechanical",designation="Associate Professor"),
            dict(id="FAC_RRK",  name="Dr.R.Ravi Kumar",           department="Civil", designation="Associate Professor"),
            dict(id="FAC_RHA",  name="Mr.R.Haranath",             department="Civil", designation="Assistant Professor"),
            dict(id="FAC_GVS2", name="Dr.GVS Subbaraya Sharma",   department="S&H",   designation="Professor"),
        ]
        for f in faculty_data:
            ex = db.query(FacultyProfileModel).filter(FacultyProfileModel.id == f["id"]).first()
            if not ex: db.add(FacultyProfileModel(**f))
            else:
                for k,v in f.items(): setattr(ex, k, v)
        db.commit()

        # ── 4. Subjects ──────────────────────────────────────────────────────────
        subjects_data = [
            # IT Sem 3
            dict(id="U25HSN01CO",name="Finance and Accounting",                    code="F&A",    department="IT",   semester=3,subject_type="theory"),
            dict(id="U25ES301IT",name="Electronic Devices and Sensors",            code="EDS",    department="IT",   semester=3,subject_type="theory"),
            dict(id="U25PC301IT",name="Data Structures using C",                   code="DS",     department="IT",   semester=3,subject_type="theory"),
            dict(id="U25PC302IT",name="Operating Systems",                          code="OS",     department="IT",   semester=3,subject_type="theory"),
            dict(id="U25PC303IT",name="Mathematical Foundation for IT",            code="MFIT",   department="IT",   semester=3,subject_type="theory"),
            dict(id="U25ES302IT",name="Digital Electronics and Logic Design",      code="DELD",   department="IT",   semester=3,subject_type="theory"),
            dict(id="U25MCN01PO",name="Indian Constitution",                       code="IC",     department="IT",   semester=3,subject_type="theory"),
            dict(id="U25ES381IT",name="Electronic Devices and Sensors Lab",        code="EDS Lab",department="IT",   semester=3,subject_type="lab"),
            dict(id="U25PC381IT",name="Data Structures using C Lab",               code="DS Lab", department="IT",   semester=3,subject_type="lab"),
            dict(id="U25PC382IT",name="Operating Systems Lab",                     code="OS Lab", department="IT",   semester=3,subject_type="lab"),
            dict(id="U25PC383IT",name="Web Technologies Lab",                      code="WT Lab", department="IT",   semester=3,subject_type="lab"),
            # IT Sem 5
            dict(id="U21PC501IT",name="Software Engineering",                      code="SE",     department="IT",   semester=5,subject_type="theory"),
            dict(id="U21PC502IT",name="Data Mining",                               code="DM",     department="IT",   semester=5,subject_type="theory"),
            dict(id="U21PC503IT",name="Design and Analysis of Algorithms",         code="DAA",    department="IT",   semester=5,subject_type="theory"),
            dict(id="U21PC504IT",name="Artificial Intelligence",                   code="AI",     department="IT",   semester=5,subject_type="theory"),
            dict(id="U21PC505IT",name="Automata Theory",                           code="AT",     department="IT",   semester=5,subject_type="theory"),
            dict(id="U21PE621IT",name="Big Data Analytics",                        code="BDA",    department="IT",   semester=5,subject_type="elective"),
            dict(id="U21OE611CE",name="Disaster Mitigation",                       code="OE-DM",  department="IT",   semester=5,subject_type="elective"),
            dict(id="U21OE611EG",name="Soft Skills and Interpersonal Skills",      code="OE-SS",  department="IT",   semester=5,subject_type="elective"),
            dict(id="U21OE611ME",name="Operations Research & Techniques",          code="OE-OR",  department="IT",   semester=5,subject_type="elective"),
            dict(id="U21PC581IT",name="Full Stack Development Lab",                code="FSD Lab",department="IT",   semester=5,subject_type="lab"),
            dict(id="U21PC582IT",name="Artificial Intelligence Lab",               code="AI Lab", department="IT",   semester=5,subject_type="lab"),
            dict(id="U21PC583IT",name="Mobile Application Development Lab",        code="MAD Lab",department="IT",   semester=5,subject_type="lab"),
            dict(id="U21PW581I", name="Summer Internship-I Evaluation",            code="SIE-1",  department="IT",   semester=5,subject_type="project"),
            dict(id="CRT",       name="Campus Recruitment Training",               code="CRT",    department="IT",   semester=5,subject_type="lab"),
            # IT Sem 7
            dict(id="U21PC701IT",name="Internet of Things",                        code="IOT",    department="IT",   semester=7,subject_type="theory"),
            dict(id="U21PC702IT",name="Network Security",                          code="NS",     department="IT",   semester=7,subject_type="theory"),
            dict(id="U21PE742IT",name="Cyber Security",                            code="CS",     department="IT",   semester=7,subject_type="elective"),
            dict(id="U21PE754IT",name="Software Project Management",               code="SPM",    department="IT",   semester=7,subject_type="elective"),
            dict(id="U21PE752IT",name="Block Chain Technology",                    code="BCT",    department="IT",   semester=7,subject_type="elective"),
            dict(id="U21PE864IT",name="Agile Software Engineering",                code="ASE",    department="IT",   semester=7,subject_type="elective"),
            dict(id="U21OE831CE",name="Road Safety Engineering",                   code="RSE",    department="IT",   semester=7,subject_type="elective"),
            dict(id="U21PC781IT",name="IoT Lab",                                   code="IOT LAB",department="IT",   semester=7,subject_type="lab"),
            dict(id="U21PC782IT",name="CN & NS Lab",                               code="CN&NS",  department="IT",   semester=7,subject_type="lab"),
            dict(id="U21PW781IT",name="Project Work-I",                            code="PW-I",   department="IT",   semester=7,subject_type="project"),
            dict(id="U21PW782IT",name="Summer Internship-II Evaluation",           code="SI-II",  department="IT",   semester=7,subject_type="project"),
            # Civil Sem 3
            dict(id="U25BSNO3MT",name="Probability & Statistics, Numerical Methods",code="P&S",  department="Civil",semester=3,subject_type="theory"),
            dict(id="U25ES301CE",name="Civil Engineering Materials",               code="CEM",    department="Civil",semester=3,subject_type="theory"),
            dict(id="U25ES302CE",name="Engineering Mechanics",                     code="EM",     department="Civil",semester=3,subject_type="theory"),
            dict(id="U25PC301CE",name="Surveying and Geomatics",                   code="SUR",    department="Civil",semester=3,subject_type="theory"),
            dict(id="U25PC302CE",name="Engineering Geology",                       code="EG",     department="Civil",semester=3,subject_type="theory"),
            dict(id="U25PC303CE",name="Fluid Mechanics",                           code="FM",     department="Civil",semester=3,subject_type="theory"),
            dict(id="U25PC381CE",name="Surveying Lab",                             code="SUR Lab",department="Civil",semester=3,subject_type="lab"),
            dict(id="U25PC382CE",name="Engineering Geology Lab",                   code="EG Lab", department="Civil",semester=3,subject_type="lab"),
            dict(id="U25PC383CE",name="Fluid Mechanics Lab",                       code="FM Lab", department="Civil",semester=3,subject_type="lab"),
            dict(id="U25PC384CE",name="Computer Aided Civil Engineering Drawing Lab",code="CACED Lab",department="Civil",semester=3,subject_type="lab"),
            # Civil Sem 5
            dict(id="U21PC501CE",name="Foundation Engineering",                    code="FE",     department="Civil",semester=5,subject_type="theory"),
            dict(id="U21PC502CE",name="Transportation Engineering",                code="TE",     department="Civil",semester=5,subject_type="theory"),
            dict(id="U21PC503CE",name="Design of RCC Structures-II",               code="DRCS-II",department="Civil",semester=5,subject_type="theory"),
            dict(id="U21PC504CE",name="Structural Analysis-I",                     code="SA-I",   department="Civil",semester=5,subject_type="theory"),
            dict(id="U21PC505CE",name="Engineering Hydrology",                     code="EH",     department="Civil",semester=5,subject_type="theory"),
            dict(id="U21PC506CE",name="Environmental Engineering",                 code="EE",     department="Civil",semester=5,subject_type="theory"),
            dict(id="U21MCN01PY",name="Essence of Indian Traditional Knowledge",   code="EITK",   department="Civil",semester=5,subject_type="theory"),
            dict(id="SSIP",      name="Soft Skills",                               code="Soft Skills",department="Civil",semester=5,subject_type="theory"),
            dict(id="U21PC581CE",name="Transportation Engineering Lab",            code="TE Lab", department="Civil",semester=5,subject_type="lab"),
            dict(id="U21PC582CE",name="Environmental Engineering Lab",             code="EE Lab", department="Civil",semester=5,subject_type="lab"),
            dict(id="U21PC681CE",name="Concrete Technology Lab",                   code="CT Lab", department="Civil",semester=5,subject_type="lab"),
            # Civil Sem 7
            dict(id="U21PC701CE",name="Estimation and Specifications",             code="E&S",    department="Civil",semester=7,subject_type="theory"),
            dict(id="U21PE741CE",name="Disaster Mitigation and Management",        code="DMM",    department="Civil",semester=7,subject_type="elective"),
            dict(id="U21PE751CE",name="Transportation and Land Use Planning",      code="TLP",    department="Civil",semester=7,subject_type="elective"),
            dict(id="U21PE861CE",name="Construction Management & Administration",  code="CMA",    department="Civil",semester=7,subject_type="elective"),
            dict(id="U21PE871CE",name="Prestressed Concrete",                      code="PSC",    department="Civil",semester=7,subject_type="elective"),
            dict(id="U21OE831ME",name="Material Handling",                         code="MH",     department="Civil",semester=7,subject_type="elective"),
            dict(id="U21PC781CE",name="Civil Engineering Programming Lab",         code="CEP LAB",department="Civil",semester=7,subject_type="lab"),
            dict(id="U21PW782CE",name="Project work-I",                            code="PW-1",   department="Civil",semester=7,subject_type="project"),
            # Generic
            dict(id="COUNSELLING",name="Counselling Session",                      code="Counselling",department="General",semester=0,subject_type="theory"),
            dict(id="LIBRARY",   name="Library Session",                           code="Library",department="General",semester=0,subject_type="theory"),
            dict(id="SPORTS",    name="Sports / Fitness",                          code="Sports", department="General",semester=0,subject_type="theory"),
            dict(id="TUTORIAL",  name="Tutorial Session",                          code="Tutorial",department="General",semester=0,subject_type="theory"),
        ]
        for s in subjects_data:
            ex = db.query(SubjectModel).filter(SubjectModel.id == s["id"]).first()
            if not ex: db.add(SubjectModel(**s))
            else:
                for k,v in s.items(): setattr(ex, k, v)
            try: db.commit()
            except Exception: db.rollback()

        # ── 5. Clear old timetable entries for all 12 sections ───────────────────
        sections_to_clear = [
            "IT-2A","IT-2B","IT-2C","IT-3A","IT-3B","IT-3C",
            "IT-4A","IT-4B","IT-4C","Civil-3","Civil-5","Civil-7"
        ]
        for sec in sections_to_clear:
            db.query(TimetableEntryModel).filter(TimetableEntryModel.section == sec).delete()
        db.commit()
        print("🗑️  Cleared old timetable entries for 12 sections.")

        # ── 6. Build raw timetable entries ───────────────────────────────────────
        raw = []
        def e(sec,sem,dept,day,period,room,subj_id,subj_name,fac_id,fac_name,batch=None):
            st,et = PERIOD_TIMES[period]
            raw.append(dict(section=sec,semester=sem,department=dept,
                day_of_week=day,period_number=period,start_time=st,end_time=et,
                classroom_id=room,subject_id=subj_id,subject_name=subj_name,
                faculty_id=fac_id,faculty_name=fac_name,batch=batch))

        # ════════════════════════════════════════════════════════════════
        # IT-2A  |  Room CE-IT-101  |  Sem III
        # ════════════════════════════════════════════════════════════════
        # MON
        e("IT-2A",3,"IT",0,1,"CE-IT-101","U25PC301IT","Data Structures using C","FAC_VAS","Dr.B.Vasavi")
        e("IT-2A",3,"IT",0,2,"CE-IT-101","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        e("IT-2A",3,"IT",0,3,"CE-IT-101","U25ES302IT","Digital Electronics and Logic Design","FAC_SAM","Dr.Ch.Samson")
        e("IT-2A",3,"IT",0,4,"CE-IT-101","TUTORIAL","Tutorial","FAC_SRU","Ch.Srujana")
        e("IT-2A",3,"IT",0,5,"CE-IT-101","U25ES301IT","Electronic Devices and Sensors","FAC_SRU","Ch.Srujana")
        e("IT-2A",3,"IT",0,6,"CE-IT-101","COUNSELLING","Counselling","FAC_SRA","M.Sravani")
        # TUE
        e("IT-2A",3,"IT",1,1,"CE-IT-101","U25PC303IT","Mathematical Foundation for IT","FAC_KCS","K.Chandra Sekhar")
        e("IT-2A",3,"IT",1,2,"CE-IT-101","U25PC301IT","Data Structures using C","FAC_VAS","Dr.B.Vasavi")
        e("IT-2A",3,"IT",1,3,"CE-IT-101","U25PC302IT","Operating Systems","FAC_SRA","M.Sravani")
        e("IT-2A",3,"IT",1,4,"CE-IT-101","U25ES301IT","Electronic Devices and Sensors","FAC_SRU","Ch.Srujana")
        e("IT-2A",3,"IT",1,5,"CE-IT-101","U25ES302IT","Digital Electronics and Logic Design","FAC_SAM","Dr.Ch.Samson")
        e("IT-2A",3,"IT",1,6,"CE-IT-101","U25MCN01PO","Indian Constitution","FAC_UPE","I.Upender")
        # WED
        e("IT-2A",3,"IT",2,1,"CE-IT-104","U25PC382IT","Operating Systems Lab","FAC_SRA","M.Sravani")
        e("IT-2A",3,"IT",2,2,"CE-IT-104","U25PC382IT","Operating Systems Lab","FAC_SRA","M.Sravani")
        e("IT-2A",3,"IT",2,3,"CE-IT-101","U25PC302IT","Operating Systems","FAC_SRA","M.Sravani")
        e("IT-2A",3,"IT",2,4,"CE-IT-101","U25ES301IT","Electronic Devices and Sensors","FAC_SRU","Ch.Srujana")
        e("IT-2A",3,"IT",2,5,"CE-IT-101","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        e("IT-2A",3,"IT",2,6,"CE-IT-101","U25PC303IT","Mathematical Foundation for IT","FAC_KCS","K.Chandra Sekhar")
        # THU
        e("IT-2A",3,"IT",3,1,"CE-IT-101","U25PC301IT","Data Structures using C","FAC_VAS","Dr.B.Vasavi")
        e("IT-2A",3,"IT",3,2,"CE-IT-101","U25PC303IT","Mathematical Foundation for IT","FAC_KCS","K.Chandra Sekhar")
        e("IT-2A",3,"IT",3,3,"CE-IT-101","U25PC302IT","Operating Systems","FAC_SRA","M.Sravani")
        e("IT-2A",3,"IT",3,4,"CE-IT-101","U25ES302IT","Digital Electronics and Logic Design","FAC_SAM","Dr.Ch.Samson")
        e("IT-2A",3,"IT",3,5,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SRU","Ch.Srujana",batch="1")
        e("IT-2A",3,"IT",3,5,"CE-IT-211-LAB","U25PC381IT","DS Lab","FAC_VASU","M.Vasundhara",batch="2")
        e("IT-2A",3,"IT",3,6,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SRU","Ch.Srujana",batch="1")
        e("IT-2A",3,"IT",3,6,"CE-IT-211-LAB","U25PC381IT","DS Lab","FAC_VASU","M.Vasundhara",batch="2")
        # FRI
        e("IT-2A",3,"IT",4,1,"CE-IT-101","U25ES301IT","Electronic Devices and Sensors","FAC_SRU","Ch.Srujana")
        e("IT-2A",3,"IT",4,2,"CE-IT-101","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        e("IT-2A",3,"IT",4,3,"CE-IT-101","U25ES302IT","Digital Electronics and Logic Design","FAC_SAM","Dr.Ch.Samson")
        e("IT-2A",3,"IT",4,4,"CE-IT-101","U25PC301IT","Data Structures using C","FAC_VAS","Dr.B.Vasavi")
        e("IT-2A",3,"IT",4,5,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="2")
        e("IT-2A",3,"IT",4,5,"CE-IT-211-LAB","U25PC381IT","DS Lab","FAC_DEV","K.Devaki",batch="1")
        e("IT-2A",3,"IT",4,6,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="2")
        e("IT-2A",3,"IT",4,6,"CE-IT-211-LAB","U25PC381IT","DS Lab","FAC_DEV","K.Devaki",batch="1")
        # SAT
        e("IT-2A",3,"IT",5,1,"CE-IT-101","U25PC303IT","Mathematical Foundation for IT","FAC_KCS","K.Chandra Sekhar")
        e("IT-2A",3,"IT",5,2,"CE-IT-101","U25MCN01PO","Indian Constitution","FAC_UPE","I.Upender")
        e("IT-2A",3,"IT",5,3,"CE-IT-101","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        e("IT-2A",3,"IT",5,4,"CE-IT-101","U25PC302IT","Operating Systems","FAC_SRA","M.Sravani")
        e("IT-2A",3,"IT",5,5,"CE-IT-104","U25PC383IT","Web Technologies Lab","FAC_MAN","A.Manasa")
        e("IT-2A",3,"IT",5,6,"CE-IT-104","U25PC383IT","Web Technologies Lab","FAC_MAN","A.Manasa")

        # ════════════════════════════════════════════════════════════════
        # IT-2B  |  Room CE-IT-102  |  Sem III
        # ════════════════════════════════════════════════════════════════
        # MON
        e("IT-2B",3,"IT",0,1,"CE-IT-102","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        e("IT-2B",3,"IT",0,2,"CE-IT-102","U25ES302IT","Digital Electronics and Logic Design","FAC_VIB","S.Ch. Vijaya Bhaskar")
        e("IT-2B",3,"IT",0,3,"CE-IT-102","COUNSELLING","Counselling","FAC_SUN","B.Sunitha")
        e("IT-2B",3,"IT",0,4,"CE-IT-102","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        e("IT-2B",3,"IT",0,5,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="1")
        e("IT-2B",3,"IT",0,5,"CE-IT-211-LAB","U25PC381IT","DS Lab","FAC_MBD","Maya B Dhone",batch="2")
        e("IT-2B",3,"IT",0,6,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="1")
        e("IT-2B",3,"IT",0,6,"CE-IT-211-LAB","U25PC381IT","DS Lab","FAC_MBD","Maya B Dhone",batch="2")
        # TUE
        e("IT-2B",3,"IT",1,1,"CE-IT-102","U25PC303IT","Mathematical Foundation for IT","FAC_AMB","P.Amba Bhavani")
        e("IT-2B",3,"IT",1,2,"CE-IT-102","U25ES302IT","Digital Electronics and Logic Design","FAC_VIB","S.Ch. Vijaya Bhaskar")
        e("IT-2B",3,"IT",1,3,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="2")
        e("IT-2B",3,"IT",1,3,"CE-IT-211-LAB","U25PC381IT","DS Lab","FAC_MBD","Maya B Dhone",batch="1")
        e("IT-2B",3,"IT",1,4,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="2")
        e("IT-2B",3,"IT",1,4,"CE-IT-211-LAB","U25PC381IT","DS Lab","FAC_MBD","Maya B Dhone",batch="1")
        e("IT-2B",3,"IT",1,5,"CE-IT-102","U25PC302IT","Operating Systems","FAC_MUN","D.Muninder")
        e("IT-2B",3,"IT",1,6,"CE-IT-102","TUTORIAL","Tutorial","FAC_MBD","Maya B Dhone")
        # WED
        e("IT-2B",3,"IT",2,1,"CE-IT-102","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        e("IT-2B",3,"IT",2,2,"CE-IT-102","U25PC301IT","Data Structures using C","FAC_MBD","Maya B Dhone")
        e("IT-2B",3,"IT",2,3,"CE-IT-102","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        e("IT-2B",3,"IT",2,4,"CE-IT-102","U25PC303IT","Mathematical Foundation for IT","FAC_AMB","P.Amba Bhavani")
        e("IT-2B",3,"IT",2,5,"CE-IT-104","U25PC382IT","Operating Systems Lab","FAC_MUN","D.Muninder")
        e("IT-2B",3,"IT",2,6,"CE-IT-104","U25PC382IT","Operating Systems Lab","FAC_MUN","D.Muninder")
        # THU
        e("IT-2B",3,"IT",3,1,"CE-IT-102","U25PC303IT","Mathematical Foundation for IT","FAC_AMB","P.Amba Bhavani")
        e("IT-2B",3,"IT",3,2,"CE-IT-102","U25PC301IT","Data Structures using C","FAC_MBD","Maya B Dhone")
        e("IT-2B",3,"IT",3,3,"CE-IT-102","U25MCN01PO","Indian Constitution","FAC_UPE","I.Upender")
        e("IT-2B",3,"IT",3,4,"CE-IT-102","U25PC302IT","Operating Systems","FAC_MUN","D.Muninder")
        e("IT-2B",3,"IT",3,5,"CE-IT-102","U25ES302IT","Digital Electronics and Logic Design","FAC_VIB","S.Ch. Vijaya Bhaskar")
        e("IT-2B",3,"IT",3,6,"CE-IT-102","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        # FRI
        e("IT-2B",3,"IT",4,1,"CE-IT-102","U25ES302IT","Digital Electronics and Logic Design","FAC_VIB","S.Ch. Vijaya Bhaskar")
        e("IT-2B",3,"IT",4,2,"CE-IT-102","U25PC303IT","Mathematical Foundation for IT","FAC_AMB","P.Amba Bhavani")
        e("IT-2B",3,"IT",4,3,"CE-IT-102","U25PC302IT","Operating Systems","FAC_MUN","D.Muninder")
        e("IT-2B",3,"IT",4,4,"CE-IT-102","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        e("IT-2B",3,"IT",4,5,"CE-IT-102","U25MCN01PO","Indian Constitution","FAC_UPE","I.Upender")
        e("IT-2B",3,"IT",4,6,"CE-IT-102","U25PC301IT","Data Structures using C","FAC_MBD","Maya B Dhone")
        # SAT
        e("IT-2B",3,"IT",5,1,"CE-IT-102","U25PC301IT","Data Structures using C","FAC_MBD","Maya B Dhone")
        e("IT-2B",3,"IT",5,2,"CE-IT-102","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        e("IT-2B",3,"IT",5,3,"CE-IT-104","U25PC383IT","Web Technologies Lab","FAC_KAR","P.Karthik")
        e("IT-2B",3,"IT",5,4,"CE-IT-104","U25PC383IT","Web Technologies Lab","FAC_KAR","P.Karthik")
        e("IT-2B",3,"IT",5,5,"CE-IT-102","U25PC302IT","Operating Systems","FAC_MUN","D.Muninder")
        e("IT-2B",3,"IT",5,6,"CE-IT-102","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")

        # ════════════════════════════════════════════════════════════════
        # IT-2C  |  Room CE-IT-201  |  Sem III
        # ════════════════════════════════════════════════════════════════
        # MON
        e("IT-2C",3,"IT",0,1,"CE-IT-201","U25HSN01CO","Finance and Accounting","FAC_SRI","Sriranga Raju")
        e("IT-2C",3,"IT",0,2,"CE-IT-201","U25MCN01PO","Indian Constitution","FAC_UPE","I.Upender")
        e("IT-2C",3,"IT",0,3,"CE-IT-201","U25PC301IT","Data Structures using C","FAC_USH","G.Ushasri")
        e("IT-2C",3,"IT",0,4,"CE-IT-201","U25PC302IT","Operating Systems","FAC_SRIL","K.Srilaxmi")
        e("IT-2C",3,"IT",0,5,"CE-IT-201","U25ES302IT","Digital Electronics and Logic Design","FAC_RAV","Dr.DBV Ravi Sankar")
        e("IT-2C",3,"IT",0,6,"CE-IT-201","U25PC303IT","Mathematical Foundation for IT","FAC_UGE","Dr.A.Ugendhar")
        # TUE
        e("IT-2C",3,"IT",1,1,"CE-IT-201","U25PC301IT","Data Structures using C","FAC_USH","G.Ushasri")
        e("IT-2C",3,"IT",1,2,"CE-IT-201","U25PC302IT","Operating Systems","FAC_SRIL","K.Srilaxmi")
        e("IT-2C",3,"IT",1,3,"CE-IT-201","U25ES302IT","Digital Electronics and Logic Design","FAC_RAV","Dr.DBV Ravi Sankar")
        e("IT-2C",3,"IT",1,4,"CE-IT-201","U25MCN01PO","Indian Constitution","FAC_UPE","I.Upender")
        e("IT-2C",3,"IT",1,5,"CE-IT-201","U25PC303IT","Mathematical Foundation for IT","FAC_UGE","Dr.A.Ugendhar")
        e("IT-2C",3,"IT",1,6,"CE-IT-201","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        # WED
        e("IT-2C",3,"IT",2,1,"CE-IT-201","U25ES302IT","Digital Electronics and Logic Design","FAC_RAV","Dr.DBV Ravi Sankar")
        e("IT-2C",3,"IT",2,2,"CE-IT-201","U25PC301IT","Data Structures using C","FAC_USH","G.Ushasri")
        e("IT-2C",3,"IT",2,3,"CE-IT-201","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        e("IT-2C",3,"IT",2,4,"CE-IT-201","U25PC302IT","Operating Systems","FAC_SRIL","K.Srilaxmi")
        e("IT-2C",3,"IT",2,5,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="1")
        e("IT-2C",3,"IT",2,5,"CE-IT-211-LAB","U25PC381IT","DS Lab","FAC_USH","G.Ushasri",batch="2")
        e("IT-2C",3,"IT",2,6,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="1")
        e("IT-2C",3,"IT",2,6,"CE-IT-211-LAB","U25PC381IT","DS Lab","FAC_USH","G.Ushasri",batch="2")
        # THU
        e("IT-2C",3,"IT",3,1,"CE-IT-201","U25PC301IT","Data Structures using C","FAC_USH","G.Ushasri")
        e("IT-2C",3,"IT",3,2,"CE-IT-201","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        e("IT-2C",3,"IT",3,3,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="2")
        e("IT-2C",3,"IT",3,3,"CE-IT-211-LAB","U25PC381IT","DS Lab","FAC_USH","G.Ushasri",batch="1")
        e("IT-2C",3,"IT",3,4,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="2")
        e("IT-2C",3,"IT",3,4,"CE-IT-211-LAB","U25PC381IT","DS Lab","FAC_USH","G.Ushasri",batch="1")
        e("IT-2C",3,"IT",3,5,"CE-IT-201","U25ES302IT","Digital Electronics and Logic Design","FAC_RAV","Dr.DBV Ravi Sankar")
        e("IT-2C",3,"IT",3,6,"CE-IT-201","U25HSN01CO","Finance and Accounting","FAC_SRI","Sriranga Raju")
        # FRI
        e("IT-2C",3,"IT",4,1,"CE-IT-201","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        e("IT-2C",3,"IT",4,2,"CE-IT-201","U25PC302IT","Operating Systems","FAC_SRIL","K.Srilaxmi")
        e("IT-2C",3,"IT",4,3,"CE-IT-201","U25PC303IT","Mathematical Foundation for IT","FAC_UGE","Dr.A.Ugendhar")
        e("IT-2C",3,"IT",4,4,"CE-IT-201","U25HSN01CO","Finance and Accounting","FAC_SRI","Sriranga Raju")
        e("IT-2C",3,"IT",4,5,"CE-IT-104","U25PC382IT","Operating Systems Lab","FAC_SRIL","K.Srilaxmi")
        e("IT-2C",3,"IT",4,6,"CE-IT-104","U25PC382IT","Operating Systems Lab","FAC_SRIL","K.Srilaxmi")
        # SAT
        e("IT-2C",3,"IT",5,1,"CE-IT-104","U25PC383IT","Web Technologies Lab","FAC_SWA","M.Swapna")
        e("IT-2C",3,"IT",5,2,"CE-IT-104","U25PC383IT","Web Technologies Lab","FAC_SWA","M.Swapna")
        e("IT-2C",3,"IT",5,3,"CE-IT-201","U25PC303IT","Mathematical Foundation for IT","FAC_UGE","Dr.A.Ugendhar")
        e("IT-2C",3,"IT",5,4,"CE-IT-201","TUTORIAL","Tutorial","FAC_USH","G.Ushasri")
        e("IT-2C",3,"IT",5,5,"CE-IT-201","U25HSN01CO","Finance and Accounting","FAC_SRI","Sriranga Raju")
        e("IT-2C",3,"IT",5,6,"CE-IT-201","COUNSELLING","Counselling","FAC_SOW","J.Sowjanya")

        # ════════════════════════════════════════════════════════════════
        # IT-3A  |  Room CE-IT-202  |  Sem V
        # ════════════════════════════════════════════════════════════════
        # MON
        e("IT-3A",5,"IT",0,1,"CE-IT-104","U21PC583IT","Mobile Application Development Lab","FAC_KCS","K.Chandra Sekhar")
        e("IT-3A",5,"IT",0,2,"CE-IT-104","U21PC583IT","Mobile Application Development Lab","FAC_KCS","K.Chandra Sekhar")
        e("IT-3A",5,"IT",0,3,"CE-IT-202","U21PE621IT","Big Data Analytics","FAC_AVK","Dr.A.V.Krishna Prasad")
        e("IT-3A",5,"IT",0,4,"CE-IT-202","U21PE621IT","Big Data Analytics","FAC_AVK","Dr.A.V.Krishna Prasad")
        e("IT-3A",5,"IT",0,5,"CE-IT-202","U21PC505IT","Automata Theory","FAC_SRA","M.Sravani")
        e("IT-3A",5,"IT",0,6,"CE-IT-202","U21PC501IT","Software Engineering","FAC_DEV","K.Devaki")
        # TUE — OE-I split across 3 rooms (each OE group in its assigned room)
        e("IT-3A",5,"IT",1,1,"CE-IT-213","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="OE-DM")
        e("IT-3A",5,"IT",1,1,"CE-IT-104","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="OE-SS")
        e("IT-3A",5,"IT",1,1,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OE-OR")
        e("IT-3A",5,"IT",1,2,"CE-IT-202","U21PC502IT","Data Mining","FAC_MAN","A.Manasa")
        e("IT-3A",5,"IT",1,3,"CE-IT-202","U21PC501IT","Software Engineering","FAC_DEV","K.Devaki")
        e("IT-3A",5,"IT",1,4,"CE-IT-202","U21PC504IT","Artificial Intelligence","FAC_KCS","K.Chandra Sekhar")
        e("IT-3A",5,"IT",1,5,"CE-IT-211","U21PC582IT","Artificial Intelligence Lab","FAC_SRA","M.Sravani")
        e("IT-3A",5,"IT",1,6,"CE-IT-211","U21PC582IT","Artificial Intelligence Lab","FAC_SRA","M.Sravani")
        # WED
        e("IT-3A",5,"IT",2,1,"CE-IT-202","U21PC501IT","Software Engineering","FAC_DEV","K.Devaki")
        e("IT-3A",5,"IT",2,2,"CE-IT-202","U21PE621IT","Big Data Analytics","FAC_AVK","Dr.A.V.Krishna Prasad")
        e("IT-3A",5,"IT",2,3,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_DEV","K.Devaki")
        e("IT-3A",5,"IT",2,4,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_DEV","K.Devaki")
        e("IT-3A",5,"IT",2,5,"CE-IT-202","U21PC505IT","Automata Theory","FAC_SRA","M.Sravani")
        e("IT-3A",5,"IT",2,6,"CE-IT-202","U21PC503IT","Design and Analysis of Algorithms","FAC_VAS","Dr.B.Vasavi")
        # THU
        e("IT-3A",5,"IT",3,1,"CE-IT-202","U21PC502IT","Data Mining","FAC_MAN","A.Manasa")
        e("IT-3A",5,"IT",3,2,"CE-IT-202","U21PE621IT","Big Data Analytics","FAC_AVK","Dr.A.V.Krishna Prasad")
        e("IT-3A",5,"IT",3,3,"CE-IT-202","U21PC503IT","Design and Analysis of Algorithms","FAC_VAS","Dr.B.Vasavi")
        e("IT-3A",5,"IT",3,4,"CE-IT-212","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="OE-DM")
        e("IT-3A",5,"IT",3,4,"CE-IT-104","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="OE-SS")
        e("IT-3A",5,"IT",3,4,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OE-OR")
        e("IT-3A",5,"IT",3,5,"CE-IT-202","U21PC504IT","Artificial Intelligence","FAC_KCS","K.Chandra Sekhar")
        e("IT-3A",5,"IT",3,6,"CE-IT-202","U21PC505IT","Automata Theory","FAC_SRA","M.Sravani")
        # FRI
        e("IT-3A",5,"IT",4,1,"CE-IT-202","U21PC504IT","Artificial Intelligence","FAC_KCS","K.Chandra Sekhar")
        e("IT-3A",5,"IT",4,2,"CE-IT-202","U21PC503IT","Design and Analysis of Algorithms","FAC_VAS","Dr.B.Vasavi")
        e("IT-3A",5,"IT",4,3,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_KCS","K.Chandra Sekhar")
        e("IT-3A",5,"IT",4,4,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_KCS","K.Chandra Sekhar")
        e("IT-3A",5,"IT",4,5,"CE-IT-213","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="OE-DM")
        e("IT-3A",5,"IT",4,5,"CE-IT-212","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="OE-SS")
        e("IT-3A",5,"IT",4,5,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OE-OR")
        e("IT-3A",5,"IT",4,6,"CE-IT-202","U21PC502IT","Data Mining","FAC_MAN","A.Manasa")
        # SAT — CRT (Ada Lab all day)
        for p in range(1,7):
            e("IT-3A",5,"IT",5,p,"ADA-LAB","CRT","Campus Recruitment Training","FAC_CRT","Training & Placement Cell")

        # ════════════════════════════════════════════════════════════════
        # IT-3B  |  Room CE-IT-212  |  Sem V
        # ════════════════════════════════════════════════════════════════
        # MON
        e("IT-3B",5,"IT",0,1,"CE-IT-212","U21PE621IT","Big Data Analytics","FAC_AVK","Dr.A.V.Krishna Prasad")
        e("IT-3B",5,"IT",0,2,"CE-IT-212","U21PC505IT","Automata Theory","FAC_SOW","J.Sowjanya")
        e("IT-3B",5,"IT",0,3,"CE-IT-212","U21PC504IT","Artificial Intelligence","FAC_SIT","P.Sita Sowjanya")
        e("IT-3B",5,"IT",0,4,"CE-IT-212","U21PC502IT","Data Mining","FAC_NIT","N.Nithya lakshmi")
        e("IT-3B",5,"IT",0,5,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_KAR","P.Karthik")
        e("IT-3B",5,"IT",0,6,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_KAR","P.Karthik")
        # TUE
        e("IT-3B",5,"IT",1,1,"CE-IT-213","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="OE-DM")
        e("IT-3B",5,"IT",1,1,"CE-IT-104","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="OE-SS")
        e("IT-3B",5,"IT",1,1,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OE-OR")
        e("IT-3B",5,"IT",1,2,"CE-IT-104","U21PC583IT","Mobile Application Development Lab","FAC_SOW","J.Sowjanya")
        e("IT-3B",5,"IT",1,3,"CE-IT-104","U21PC583IT","Mobile Application Development Lab","FAC_SOW","J.Sowjanya")
        e("IT-3B",5,"IT",1,5,"CE-IT-212","U21PC503IT","Design and Analysis of Algorithms","FAC_AMB","P.Amba Bhavani")
        e("IT-3B",5,"IT",1,6,"CE-IT-212","U21PC501IT","Software Engineering","FAC_KAR","P.Karthik")
        # WED — CRT (Ada Lab all day)
        for p in range(1,7):
            e("IT-3B",5,"IT",2,p,"ADA-LAB","CRT","Campus Recruitment Training","FAC_CRT","Training & Placement Cell")
        # THU
        e("IT-3B",5,"IT",3,1,"CE-IT-212","U21PC504IT","Artificial Intelligence","FAC_SIT","P.Sita Sowjanya")
        e("IT-3B",5,"IT",3,2,"CE-IT-212","U21PC502IT","Data Mining","FAC_NIT","N.Nithya lakshmi")
        e("IT-3B",5,"IT",3,3,"CE-IT-212","U21PC503IT","Design and Analysis of Algorithms","FAC_AMB","P.Amba Bhavani")
        e("IT-3B",5,"IT",3,4,"CE-IT-212","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="OE-DM")
        e("IT-3B",5,"IT",3,4,"CE-IT-104","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="OE-SS")
        e("IT-3B",5,"IT",3,4,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OE-OR")
        e("IT-3B",5,"IT",3,5,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_KAR","P.Karthik")
        e("IT-3B",5,"IT",3,6,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_KAR","P.Karthik")
        # FRI
        e("IT-3B",5,"IT",4,1,"CE-IT-212","U21PC505IT","Automata Theory","FAC_SOW","J.Sowjanya")
        e("IT-3B",5,"IT",4,2,"CE-IT-212","U21PC501IT","Software Engineering","FAC_KAR","P.Karthik")
        e("IT-3B",5,"IT",4,3,"CE-IT-211","U21PC582IT","Artificial Intelligence Lab","FAC_SIT","P.Sita Sowjanya")
        e("IT-3B",5,"IT",4,4,"CE-IT-211","U21PC582IT","Artificial Intelligence Lab","FAC_SIT","P.Sita Sowjanya")
        e("IT-3B",5,"IT",4,5,"CE-IT-213","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="OE-DM")
        e("IT-3B",5,"IT",4,5,"CE-IT-212","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="OE-SS")
        e("IT-3B",5,"IT",4,5,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OE-OR")
        e("IT-3B",5,"IT",4,6,"CE-IT-212","U21PE621IT","Big Data Analytics","FAC_AVK","Dr.A.V.Krishna Prasad")
        # SAT
        e("IT-3B",5,"IT",5,1,"CE-IT-212","U21PC501IT","Software Engineering","FAC_KAR","P.Karthik")
        e("IT-3B",5,"IT",5,2,"CE-IT-212","U21PC503IT","Design and Analysis of Algorithms","FAC_AMB","P.Amba Bhavani")
        e("IT-3B",5,"IT",5,3,"CE-IT-212","U21PE621IT","Big Data Analytics","FAC_AVK","Dr.A.V.Krishna Prasad")
        e("IT-3B",5,"IT",5,4,"CE-IT-212","U21PC502IT","Data Mining","FAC_NIT","N.Nithya lakshmi")
        e("IT-3B",5,"IT",5,5,"CE-IT-212","U21PC505IT","Automata Theory","FAC_SOW","J.Sowjanya")
        e("IT-3B",5,"IT",5,6,"CE-IT-212","U21PC504IT","Artificial Intelligence","FAC_SIT","P.Sita Sowjanya")

        # ════════════════════════════════════════════════════════════════
        # IT-3C  |  Room CE-IT-213  |  Sem V
        # ════════════════════════════════════════════════════════════════
        # MON
        e("IT-3C",5,"IT",0,1,"CE-IT-211","U21PC582IT","Artificial Intelligence Lab","FAC_SRIL","K.Srilaxmi")
        e("IT-3C",5,"IT",0,2,"CE-IT-211","U21PC582IT","Artificial Intelligence Lab","FAC_SRIL","K.Srilaxmi")
        e("IT-3C",5,"IT",0,3,"CE-IT-213","U21PC501IT","Software Engineering","FAC_VASU","M.Vasundhara")
        e("IT-3C",5,"IT",0,4,"CE-IT-213","U21PC502IT","Data Mining","FAC_RMA","K.Ramya Madhavi")
        e("IT-3C",5,"IT",0,5,"CE-IT-213","U21PE621IT","Big Data Analytics","FAC_SOW","J.Sowjanya")
        e("IT-3C",5,"IT",0,6,"CE-IT-213","U21PC504IT","Artificial Intelligence","FAC_SRIL","K.Srilaxmi")
        # TUE
        e("IT-3C",5,"IT",1,1,"CE-IT-213","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="OE-DM")
        e("IT-3C",5,"IT",1,1,"CE-IT-104","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="OE-SS")
        e("IT-3C",5,"IT",1,1,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OE-OR")
        e("IT-3C",5,"IT",1,2,"CE-IT-213","U21PC505IT","Automata Theory","FAC_NIT","N.Nithya lakshmi")
        e("IT-3C",5,"IT",1,3,"CE-IT-213","U21PC503IT","Design and Analysis of Algorithms","FAC_USH","G.Ushasri")
        e("IT-3C",5,"IT",1,4,"CE-IT-213","U21PC504IT","Artificial Intelligence","FAC_SRIL","K.Srilaxmi")
        e("IT-3C",5,"IT",1,5,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_VASU","M.Vasundhara")
        e("IT-3C",5,"IT",1,6,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_VASU","M.Vasundhara")
        # WED — CRT (Charles Babbage Lab all day)
        for p in range(1,7):
            e("IT-3C",5,"IT",2,p,"CB-01","CRT","Campus Recruitment Training","FAC_CRT","Training & Placement Cell")
        # THU
        e("IT-3C",5,"IT",3,1,"CE-IT-104","U21PC583IT","Mobile Application Development Lab","FAC_SOW","J.Sowjanya")
        e("IT-3C",5,"IT",3,2,"CE-IT-104","U21PC583IT","Mobile Application Development Lab","FAC_SOW","J.Sowjanya")
        e("IT-3C",5,"IT",3,4,"CE-IT-212","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="OE-DM")
        e("IT-3C",5,"IT",3,4,"CE-IT-104","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="OE-SS")
        e("IT-3C",5,"IT",3,4,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OE-OR")
        e("IT-3C",5,"IT",3,5,"CE-IT-213","U21PC503IT","Design and Analysis of Algorithms","FAC_USH","G.Ushasri")
        e("IT-3C",5,"IT",3,6,"CE-IT-213","U21PC505IT","Automata Theory","FAC_NIT","N.Nithya lakshmi")
        # FRI
        e("IT-3C",5,"IT",4,1,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_VASU","M.Vasundhara")
        e("IT-3C",5,"IT",4,2,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_VASU","M.Vasundhara")
        e("IT-3C",5,"IT",4,3,"CE-IT-213","U21PE621IT","Big Data Analytics","FAC_SOW","J.Sowjanya")
        e("IT-3C",5,"IT",4,4,"CE-IT-213","U21PC501IT","Software Engineering","FAC_VASU","M.Vasundhara")
        e("IT-3C",5,"IT",4,5,"CE-IT-213","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="OE-DM")
        e("IT-3C",5,"IT",4,5,"CE-IT-212","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="OE-SS")
        e("IT-3C",5,"IT",4,5,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OE-OR")
        e("IT-3C",5,"IT",4,6,"CE-IT-213","U21PC502IT","Data Mining","FAC_RMA","K.Ramya Madhavi")
        # SAT
        e("IT-3C",5,"IT",5,1,"CE-IT-213","U21PC505IT","Automata Theory","FAC_NIT","N.Nithya lakshmi")
        e("IT-3C",5,"IT",5,2,"CE-IT-213","U21PE621IT","Big Data Analytics","FAC_SOW","J.Sowjanya")
        e("IT-3C",5,"IT",5,3,"CE-IT-213","U21PC502IT","Data Mining","FAC_RMA","K.Ramya Madhavi")
        e("IT-3C",5,"IT",5,4,"CE-IT-213","U21PC503IT","Design and Analysis of Algorithms","FAC_USH","G.Ushasri")
        e("IT-3C",5,"IT",5,5,"CE-IT-213","U21PC504IT","Artificial Intelligence","FAC_SRIL","K.Srilaxmi")
        e("IT-3C",5,"IT",5,6,"CE-IT-213","U21PC501IT","Software Engineering","FAC_VASU","M.Vasundhara")

        # ════════════════════════════════════════════════════════════════
        # IT-4A  |  Multi-room  |  Sem VII
        # ════════════════════════════════════════════════════════════════
        # MON
        e("IT-4A",7,"IT",0,1,"CE-IT-202","U21OE831CE","Road Safety Engineering","FAC_RRK","Dr.R.Ravi Kumar")
        e("IT-4A",7,"IT",0,2,"CE-IT-202","U21PC701IT","Internet of Things","FAC_SRU","Ch.Srujana")
        e("IT-4A",7,"IT",0,3,"CE-IT-202","U21PE864IT","Agile Software Engineering","FAC_MAN","A.Manasa")
        e("IT-4A",7,"IT",0,4,"CE-IT-104","COUNSELLING","Counselling","FAC_SIT","P.Sita Sowjanya")
        e("IT-4A",7,"IT",0,5,"CE-IT-102","U21PW781IT","Project Work-I","FAC_VAS","Dr.B.Vasavi")
        e("IT-4A",7,"IT",0,6,"CE-IT-102","U21PW781IT","Project Work-I","FAC_VAS","Dr.B.Vasavi")
        # TUE
        e("IT-4A",7,"IT",1,1,"CE-IT-18","U21PC781IT","IoT Lab","FAC_SRU","Ch.Srujana",batch="1")
        e("IT-4A",7,"IT",1,1,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_SAM","Dr.Ch.Samson",batch="2")
        e("IT-4A",7,"IT",1,2,"CE-IT-18","U21PC781IT","IoT Lab","FAC_SRU","Ch.Srujana",batch="1")
        e("IT-4A",7,"IT",1,2,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_SAM","Dr.Ch.Samson",batch="2")
        e("IT-4A",7,"IT",1,3,"CE-IT-102","U21PW781IT","Project Work-I","FAC_KCS","K.Chandra Sekhar")
        e("IT-4A",7,"IT",1,4,"CE-IT-102","U21PW781IT","Project Work-I","FAC_MAN","A.Manasa")
        e("IT-4A",7,"IT",1,5,"CE-IT-202","U21PE742IT","Cyber Security","FAC_DEV","K.Devaki")
        e("IT-4A",7,"IT",1,6,"CE-IT-202","U21PC701IT","Internet of Things","FAC_SRU","Ch.Srujana")
        # WED
        e("IT-4A",7,"IT",2,1,"CE-IT-212","U21PE754IT","Software Project Management","FAC_SWA","M.Swapna")
        e("IT-4A",7,"IT",2,2,"CE-IT-212","U21PC702IT","Network Security","FAC_SAM","Dr.Ch.Samson")
        e("IT-4A",7,"IT",2,3,"CE-IT-212","U21PW781IT","Project Work-I","FAC_SAM","Dr.Ch.Samson")
        e("IT-4A",7,"IT",2,4,"CE-IT-212","U21PW781IT","Project Work-I","FAC_VASU","M.Vasundhara")
        e("IT-4A",7,"IT",2,5,"CE-IT-212","U21PE742IT","Cyber Security","FAC_DEV","K.Devaki")
        e("IT-4A",7,"IT",2,6,"CE-IT-212","U21OE831CE","Road Safety Engineering","FAC_RRK","Dr.R.Ravi Kumar")
        # THU
        e("IT-4A",7,"IT",3,1,"CE-IT-18","U21PC781IT","IoT Lab","FAC_SRU","Ch.Srujana",batch="2")
        e("IT-4A",7,"IT",3,1,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_DEV","K.Devaki",batch="1")
        e("IT-4A",7,"IT",3,2,"CE-IT-18","U21PC781IT","IoT Lab","FAC_SRU","Ch.Srujana",batch="2")
        e("IT-4A",7,"IT",3,2,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_DEV","K.Devaki",batch="1")
        e("IT-4A",7,"IT",3,3,"CE-IT-201","U21PE754IT","Software Project Management","FAC_SWA","M.Swapna")
        e("IT-4A",7,"IT",3,4,"CE-IT-201","U21PE742IT","Cyber Security","FAC_DEV","K.Devaki")
        e("IT-4A",7,"IT",3,5,"CE-IT-101","U21PE864IT","Agile Software Engineering","FAC_MAN","A.Manasa")
        e("IT-4A",7,"IT",3,6,"CE-IT-101","U21PC702IT","Network Security","FAC_SAM","Dr.Ch.Samson")
        # FRI
        e("IT-4A",7,"IT",4,1,"CE-IT-213","U21OE831CE","Road Safety Engineering","FAC_RRK","Dr.R.Ravi Kumar")
        e("IT-4A",7,"IT",4,2,"CE-IT-213","U21PE864IT","Agile Software Engineering","FAC_MAN","A.Manasa")
        e("IT-4A",7,"IT",4,3,"CE-IT-213","U21PE754IT","Software Project Management","FAC_SWA","M.Swapna")
        e("IT-4A",7,"IT",4,4,"CE-IT-212","U21PC701IT","Internet of Things","FAC_SRU","Ch.Srujana")
        e("IT-4A",7,"IT",4,5,"CE-IT-201","U21PC702IT","Network Security","FAC_SAM","Dr.Ch.Samson")
        e("IT-4A",7,"IT",4,6,"CE-IT-201","U21PW782IT","Summer Internship-II Evaluation","FAC_SAM","Dr.Ch.Samson")

        # ════════════════════════════════════════════════════════════════
        # IT-4B  |  Rooms 213,212,203  |  Sem VII
        # ════════════════════════════════════════════════════════════════
        # MON
        e("IT-4B",7,"IT",0,1,"CE-IT-213","U21PE752IT","Block Chain Technology","FAC_KAR","P.Karthik")
        e("IT-4B",7,"IT",0,2,"CE-IT-213","U21PC702IT","Network Security","FAC_MUN","D.Muninder")
        e("IT-4B",7,"IT",0,3,"CE-IT-18","U21PC781IT","IoT Lab","FAC_VIB","S.Ch. Vijaya Bhaskar",batch="1")
        e("IT-4B",7,"IT",0,3,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_MUN","D.Muninder",batch="2")
        e("IT-4B",7,"IT",0,4,"CE-IT-18","U21PC781IT","IoT Lab","FAC_VIB","S.Ch. Vijaya Bhaskar",batch="1")
        e("IT-4B",7,"IT",0,4,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_MUN","D.Muninder",batch="2")
        e("IT-4B",7,"IT",0,5,"CE-IT-212","U21OE831CE","Road Safety Engineering","FAC_RHA","Mr.R.Haranath")
        e("IT-4B",7,"IT",0,6,"CE-IT-212","U21PC701IT","Internet of Things","FAC_VIB","S.Ch. Vijaya Bhaskar")
        # TUE
        e("IT-4B",7,"IT",1,1,"CE-IT-212","U21PE742IT","Cyber Security","FAC_MBD","Maya B Dhone")
        e("IT-4B",7,"IT",1,2,"CE-IT-212","U21PC702IT","Network Security","FAC_MUN","D.Muninder")
        e("IT-4B",7,"IT",1,3,"CE-IT-212","U21PW781IT","Project Work-I","FAC_SIT","P.Sita Sowjanya")
        e("IT-4B",7,"IT",1,4,"CE-IT-212","U21PW781IT","Project Work-I","FAC_MUN","D.Muninder")
        e("IT-4B",7,"IT",1,5,"CE-IT-213","U21PE864IT","Agile Software Engineering","FAC_SIT","P.Sita Sowjanya")
        e("IT-4B",7,"IT",1,6,"CE-IT-212","COUNSELLING","Counselling","FAC_SRIL","K.Srilaxmi")
        # WED
        e("IT-4B",7,"IT",2,1,"CE-IT-18","U21PC781IT","IoT Lab","FAC_VIB","S.Ch. Vijaya Bhaskar",batch="2")
        e("IT-4B",7,"IT",2,1,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_AMB","P.Amba Bhavani",batch="1")
        e("IT-4B",7,"IT",2,2,"CE-IT-18","U21PC781IT","IoT Lab","FAC_VIB","S.Ch. Vijaya Bhaskar",batch="2")
        e("IT-4B",7,"IT",2,2,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_AMB","P.Amba Bhavani",batch="1")
        e("IT-4B",7,"IT",2,3,"CE-IT-203","U21PE864IT","Agile Software Engineering","FAC_SIT","P.Sita Sowjanya")
        e("IT-4B",7,"IT",2,4,"CE-IT-203","U21OE831CE","Road Safety Engineering","FAC_RHA","Mr.R.Haranath")
        e("IT-4B",7,"IT",2,5,"CE-IT-203","U21PW781IT","Project Work-I","FAC_VIB","S.Ch. Vijaya Bhaskar")
        e("IT-4B",7,"IT",2,6,"CE-IT-203","U21PW781IT","Project Work-I","FAC_VIB","S.Ch. Vijaya Bhaskar")
        # THU
        e("IT-4B",7,"IT",3,1,"CE-IT-203","U21PC701IT","Internet of Things","FAC_VIB","S.Ch. Vijaya Bhaskar")
        e("IT-4B",7,"IT",3,2,"CE-IT-203","U21PE752IT","Block Chain Technology","FAC_KAR","P.Karthik")
        e("IT-4B",7,"IT",3,3,"CE-IT-203","U21PW781IT","Project Work-I","FAC_KAR","P.Karthik")
        e("IT-4B",7,"IT",3,4,"CE-IT-203","U21PW781IT","Project Work-I","FAC_KAR","P.Karthik")
        e("IT-4B",7,"IT",3,5,"CE-IT-203","U21PE742IT","Cyber Security","FAC_MBD","Maya B Dhone")
        e("IT-4B",7,"IT",3,6,"CE-IT-203","U21OE831CE","Road Safety Engineering","FAC_RHA","Mr.R.Haranath")
        # FRI
        e("IT-4B",7,"IT",4,1,"CE-IT-203","U21PE864IT","Agile Software Engineering","FAC_SIT","P.Sita Sowjanya")
        e("IT-4B",7,"IT",4,2,"CE-IT-203","U21PE742IT","Cyber Security","FAC_MBD","Maya B Dhone")
        e("IT-4B",7,"IT",4,3,"CE-IT-203","U21PC701IT","Internet of Things","FAC_VIB","S.Ch. Vijaya Bhaskar")
        e("IT-4B",7,"IT",4,4,"CE-IT-203","U21PE752IT","Block Chain Technology","FAC_KAR","P.Karthik")
        e("IT-4B",7,"IT",4,5,"CE-IT-203","U21PC702IT","Network Security","FAC_MUN","D.Muninder")
        e("IT-4B",7,"IT",4,6,"CE-IT-203","U21PW782IT","Summer Internship-II Evaluation","FAC_SIT","P.Sita Sowjanya")

        # ════════════════════════════════════════════════════════════════
        # IT-4C  |  Multi-room  |  Sem VII
        # ════════════════════════════════════════════════════════════════
        # MON
        e("IT-4C",7,"IT",0,1,"CE-IT-203","U21PE742IT","Cyber Security","FAC_UGE","Dr.A.Ugendhar")
        e("IT-4C",7,"IT",0,2,"CE-IT-203","U21PC701IT","Internet of Things","FAC_RAV","Dr.DBV Ravi Sankar")
        e("IT-4C",7,"IT",0,3,"CE-IT-203","U21PW781IT","Project Work-I","FAC_UGE","Dr.A.Ugendhar")
        e("IT-4C",7,"IT",0,4,"CE-IT-203","U21PW781IT","Project Work-I","FAC_UGE","Dr.A.Ugendhar")
        e("IT-4C",7,"IT",0,5,"CE-IT-203","U21PE754IT","Software Project Management","FAC_SWA","M.Swapna")
        e("IT-4C",7,"IT",0,6,"CE-IT-203","U21PC702IT","Network Security","FAC_RMA","K.Ramya Madhavi")
        # TUE
        e("IT-4C",7,"IT",1,1,"CE-IT-203","U21OE831CE","Road Safety Engineering","FAC_SSW","Mrs.S.Swathi")
        e("IT-4C",7,"IT",1,2,"CE-IT-203","U21PE864IT","Agile Software Engineering","FAC_VASU","M.Vasundhara")
        e("IT-4C",7,"IT",1,3,"CE-IT-203","U21PE742IT","Cyber Security","FAC_UGE","Dr.A.Ugendhar")
        e("IT-4C",7,"IT",1,4,"CE-IT-203","U21PC702IT","Network Security","FAC_RMA","K.Ramya Madhavi")
        e("IT-4C",7,"IT",1,5,"CE-IT-203","U21PC701IT","Internet of Things","FAC_RAV","Dr.DBV Ravi Sankar")
        e("IT-4C",7,"IT",1,6,"CE-IT-203","U21PE754IT","Software Project Management","FAC_SWA","M.Swapna")
        # WED
        e("IT-4C",7,"IT",2,1,"CE-IT-213","U21PE742IT","Cyber Security","FAC_UGE","Dr.A.Ugendhar")
        e("IT-4C",7,"IT",2,2,"CE-IT-213","U21PC702IT","Network Security","FAC_RMA","K.Ramya Madhavi")
        e("IT-4C",7,"IT",2,3,"CE-IT-18","U21PC781IT","IoT Lab","FAC_RAV","Dr.DBV Ravi Sankar",batch="1")
        e("IT-4C",7,"IT",2,3,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_RMA","K.Ramya Madhavi",batch="2")
        e("IT-4C",7,"IT",2,4,"CE-IT-18","U21PC781IT","IoT Lab","FAC_RAV","Dr.DBV Ravi Sankar",batch="1")
        e("IT-4C",7,"IT",2,4,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_RMA","K.Ramya Madhavi",batch="2")
        e("IT-4C",7,"IT",2,5,"CE-IT-213","U21PW781IT","Project Work-I","FAC_SRIL","K.Srilaxmi")
        e("IT-4C",7,"IT",2,6,"CE-IT-213","U21PW781IT","Project Work-I","FAC_SRIL","K.Srilaxmi")
        # THU
        e("IT-4C",7,"IT",3,1,"CE-IT-213","U21PE754IT","Software Project Management","FAC_SWA","M.Swapna")
        e("IT-4C",7,"IT",3,2,"CE-IT-213","U21PE864IT","Agile Software Engineering","FAC_VASU","M.Vasundhara")
        e("IT-4C",7,"IT",3,3,"CE-IT-213","U21PW782IT","Summer Internship-II Evaluation","FAC_UGE","Dr.A.Ugendhar")
        e("IT-4C",7,"IT",3,4,"CE-IT-213","U21OE831CE","Road Safety Engineering","FAC_SSW","Mrs.S.Swathi")
        e("IT-4C",7,"IT",3,5,"CE-IT-212","U21PW781IT","Project Work-I","FAC_SWA","M.Swapna")
        e("IT-4C",7,"IT",3,6,"CE-IT-212","U21PW781IT","Project Work-I","FAC_SWA","M.Swapna")
        # FRI
        e("IT-4C",7,"IT",4,1,"CE-IT-18","U21PC781IT","IoT Lab","FAC_RAV","Dr.DBV Ravi Sankar",batch="1")
        e("IT-4C",7,"IT",4,1,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_UGE","Dr.A.Ugendhar",batch="2")
        e("IT-4C",7,"IT",4,2,"CE-IT-18","U21PC781IT","IoT Lab","FAC_RAV","Dr.DBV Ravi Sankar",batch="1")
        e("IT-4C",7,"IT",4,2,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_UGE","Dr.A.Ugendhar",batch="2")
        e("IT-4C",7,"IT",4,3,"CE-IT-202","COUNSELLING","Counselling","FAC_KAR","P.Karthik")
        e("IT-4C",7,"IT",4,4,"CE-IT-202","U21PC701IT","Internet of Things","FAC_RAV","Dr.DBV Ravi Sankar")
        e("IT-4C",7,"IT",4,5,"CE-IT-101","U21OE831CE","Road Safety Engineering","FAC_SSW","Mrs.S.Swathi")
        e("IT-4C",7,"IT",4,6,"CE-IT-101","U21PE864IT","Agile Software Engineering","FAC_VASU","M.Vasundhara")

        # ════════════════════════════════════════════════════════════════
        # Civil Sem-III  |  Room CE-206
        # ════════════════════════════════════════════════════════════════
        # MON — G1: SUR Lab / G2: EG Lab (parallel, P1+P2), then theory
        e("Civil-3",3,"Civil",0,1,"SUR-LAB-CE","U25PC381CE","Surveying Lab","FAC_SSW","Mrs.S.Swathi",batch="G1")
        e("Civil-3",3,"Civil",0,1,"EG-LAB-CE","U25PC382CE","Engineering Geology Lab","FAC_PBK","Dr.P.Bharath Kumar",batch="G2")
        e("Civil-3",3,"Civil",0,2,"SUR-LAB-CE","U25PC381CE","Surveying Lab","FAC_SSW","Mrs.S.Swathi",batch="G1")
        e("Civil-3",3,"Civil",0,2,"EG-LAB-CE","U25PC382CE","Engineering Geology Lab","FAC_PBK","Dr.P.Bharath Kumar",batch="G2")
        e("Civil-3",3,"Civil",0,3,"CE-206","U25ES301CE","Civil Engineering Materials","FAC_SSW","Mrs.S.Swathi")
        e("Civil-3",3,"Civil",0,4,"CE-206","U25PC302CE","Engineering Geology","FAC_PBK","Dr.P.Bharath Kumar")
        e("Civil-3",3,"Civil",0,5,"CE-206","U25ES302CE","Engineering Mechanics","FAC_CAK","Dr. C. Arvind Kumar")
        e("Civil-3",3,"Civil",0,6,"CE-206","U25PC302CE","Engineering Geology","FAC_PBK","Dr.P.Bharath Kumar")
        # TUE
        e("Civil-3",3,"Civil",1,1,"CE-206","U25PC303CE","Fluid Mechanics","FAC_KRS","Mr.K.Ravi Sekhar")
        e("Civil-3",3,"Civil",1,2,"CE-206","U25PC301CE","Surveying and Geomatics","FAC_VSC","Dr. V. Shiva Chandra")
        e("Civil-3",3,"Civil",1,3,"CE-206","U25ES302CE","Engineering Mechanics","FAC_CAK","Dr. C. Arvind Kumar")
        e("Civil-3",3,"Civil",1,4,"CE-206","U25ES302CE","Engineering Mechanics","FAC_CAK","Dr. C. Arvind Kumar")
        e("Civil-3",3,"Civil",1,5,"CE-206","U25BSNO3MT","Probability & Statistics","FAC_BHA","Dr. D. Bhagya")
        e("Civil-3",3,"Civil",1,6,"CE-206","U25PC303CE","Fluid Mechanics","FAC_KRS","Mr.K.Ravi Sekhar")
        # WED — G1: EG Lab / G2: FM Lab (parallel), then theory
        e("Civil-3",3,"Civil",2,1,"EG-LAB-CE","U25PC382CE","Engineering Geology Lab","FAC_PBK","Dr.P.Bharath Kumar",batch="G1")
        e("Civil-3",3,"Civil",2,1,"FM-LAB-CE","U25PC383CE","Fluid Mechanics Lab","FAC_KRS","Mr.K.Ravi Sekhar",batch="G2")
        e("Civil-3",3,"Civil",2,2,"EG-LAB-CE","U25PC382CE","Engineering Geology Lab","FAC_PBK","Dr.P.Bharath Kumar",batch="G1")
        e("Civil-3",3,"Civil",2,2,"FM-LAB-CE","U25PC383CE","Fluid Mechanics Lab","FAC_KRS","Mr.K.Ravi Sekhar",batch="G2")
        e("Civil-3",3,"Civil",2,3,"CE-206","U25PC301CE","Surveying and Geomatics","FAC_VSC","Dr. V. Shiva Chandra")
        e("Civil-3",3,"Civil",2,4,"CE-206","U25ES301CE","Civil Engineering Materials","FAC_SSW","Mrs.S.Swathi")
        e("Civil-3",3,"Civil",2,5,"CE-206","U25PC302CE","Engineering Geology","FAC_PBK","Dr.P.Bharath Kumar")
        e("Civil-3",3,"Civil",2,6,"CE-206","COUNSELLING","Counselling","FAC_UDA","Dr. B. Udaysree")
        # THU
        e("Civil-3",3,"Civil",3,1,"CE-206","U25BSNO3MT","Probability & Statistics","FAC_BHA","Dr. D. Bhagya")
        e("Civil-3",3,"Civil",3,2,"CE-206","U25BSNO3MT","Probability & Statistics","FAC_BHA","Dr. D. Bhagya")
        e("Civil-3",3,"Civil",3,3,"CE-206","U25PC301CE","Surveying and Geomatics","FAC_VSC","Dr. V. Shiva Chandra")
        e("Civil-3",3,"Civil",3,4,"CE-206","U25PC303CE","Fluid Mechanics","FAC_KRS","Mr.K.Ravi Sekhar")
        e("Civil-3",3,"Civil",3,5,"CE-206","U25PC303CE","Fluid Mechanics","FAC_KRS","Mr.K.Ravi Sekhar")
        e("Civil-3",3,"Civil",3,6,"CE-206","U25ES302CE","Engineering Mechanics","FAC_CAK","Dr. C. Arvind Kumar")
        # FRI — G2: SUR Lab / G1: FM Lab (parallel), then theory
        e("Civil-3",3,"Civil",4,1,"SUR-LAB-CE","U25PC381CE","Surveying Lab","FAC_SSW","Mrs.S.Swathi",batch="G2")
        e("Civil-3",3,"Civil",4,1,"FM-LAB-CE","U25PC383CE","Fluid Mechanics Lab","FAC_KRS","Mr.K.Ravi Sekhar",batch="G1")
        e("Civil-3",3,"Civil",4,2,"SUR-LAB-CE","U25PC381CE","Surveying Lab","FAC_SSW","Mrs.S.Swathi",batch="G2")
        e("Civil-3",3,"Civil",4,2,"FM-LAB-CE","U25PC383CE","Fluid Mechanics Lab","FAC_KRS","Mr.K.Ravi Sekhar",batch="G1")
        e("Civil-3",3,"Civil",4,3,"CE-206","U25PC301CE","Surveying and Geomatics","FAC_VSC","Dr. V. Shiva Chandra")
        e("Civil-3",3,"Civil",4,4,"CE-206","U25BSNO3MT","Probability & Statistics","FAC_BHA","Dr. D. Bhagya")
        e("Civil-3",3,"Civil",4,5,"CE-206","COUNSELLING","Counselling","FAC_UDA","Dr. B. Udaysree")
        e("Civil-3",3,"Civil",4,6,"CE-206","LIBRARY","Library Session","FAC_UDA","Dr. B. Udaysree")
        # SAT — CACED Lab then theory, Sports
        e("Civil-3",3,"Civil",5,1,"CE-IT-104","U25PC384CE","CACED Lab","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-3",3,"Civil",5,2,"CE-IT-104","U25PC384CE","CACED Lab","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-3",3,"Civil",5,3,"CE-206","U25PC303CE","Fluid Mechanics","FAC_KRS","Mr.K.Ravi Sekhar")
        e("Civil-3",3,"Civil",5,4,"CE-206","U25ES301CE","Civil Engineering Materials","FAC_SSW","Mrs.S.Swathi")
        e("Civil-3",3,"Civil",5,5,"CE-206","SPORTS","Sports / Fitness","FAC_UDA","Dr. B. Udaysree")
        e("Civil-3",3,"Civil",5,6,"CE-206","SPORTS","Sports / Fitness","FAC_UDA","Dr. B. Udaysree")

        # ════════════════════════════════════════════════════════════════
        # Civil Sem-V  |  Room CE-205  |  Sem V
        # ════════════════════════════════════════════════════════════════
        # MON
        e("Civil-5",5,"Civil",0,1,"CE-205","U21PC502CE","Transportation Engineering","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-5",5,"Civil",0,2,"CE-205","U21PC501CE","Foundation Engineering","FAC_SRR","Dr. R. Sandhya Rani")
        e("Civil-5",5,"Civil",0,3,"CE-205","U21PC505CE","Engineering Hydrology","FAC_KRS","Mr.K.Ravi Sekhar")
        e("Civil-5",5,"Civil",0,4,"CE-205","U21PC504CE","Structural Analysis-I","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-5",5,"Civil",0,5,"CE-205","U21PC506CE","Environmental Engineering","FAC_KSB","Dr. K. Sai Baba")
        e("Civil-5",5,"Civil",0,6,"CE-205","SSIP","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar")
        # TUE
        e("Civil-5",5,"Civil",1,1,"CE-205","U21PC501CE","Foundation Engineering","FAC_SRR","Dr. R. Sandhya Rani")
        e("Civil-5",5,"Civil",1,2,"CE-205","U21PC504CE","Structural Analysis-I","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-5",5,"Civil",1,3,"CE-205","U21PC503CE","Design of RCC Structures-II","FAC_UDA","Dr. B. Udaysree")
        e("Civil-5",5,"Civil",1,4,"CE-205","U21PC505CE","Engineering Hydrology","FAC_KRS","Mr.K.Ravi Sekhar")
        e("Civil-5",5,"Civil",1,5,"TE-LAB","U21PC581CE","Transportation Engineering Lab","FAC_GNG","Dr. G. Narendra Goud",batch="G1")
        e("Civil-5",5,"Civil",1,5,"CT-LAB","U21PC681CE","Concrete Technology Lab","FAC_KSB","Dr. K. Sai Baba",batch="G2")
        e("Civil-5",5,"Civil",1,6,"TE-LAB","U21PC581CE","Transportation Engineering Lab","FAC_GNG","Dr. G. Narendra Goud",batch="G1")
        e("Civil-5",5,"Civil",1,6,"CT-LAB","U21PC681CE","Concrete Technology Lab","FAC_KSB","Dr. K. Sai Baba",batch="G2")
        # WED
        e("Civil-5",5,"Civil",2,1,"CE-205","U21PC503CE","Design of RCC Structures-II","FAC_UDA","Dr. B. Udaysree")
        e("Civil-5",5,"Civil",2,2,"CE-205","U21PC502CE","Transportation Engineering","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-5",5,"Civil",2,3,"CE-205","U21PC504CE","Structural Analysis-I","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-5",5,"Civil",2,4,"CE-205","U21PC501CE","Foundation Engineering","FAC_SRR","Dr. R. Sandhya Rani")
        e("Civil-5",5,"Civil",2,5,"TE-LAB","U21PC581CE","Transportation Engineering Lab","FAC_SRR","Dr. R. Sandhya Rani",batch="G2")
        e("Civil-5",5,"Civil",2,5,"EE-LAB","U21PC582CE","Environmental Engineering Lab","FAC_KSB","Dr. K. Sai Baba",batch="G1")
        e("Civil-5",5,"Civil",2,6,"TE-LAB","U21PC581CE","Transportation Engineering Lab","FAC_SRR","Dr. R. Sandhya Rani",batch="G2")
        e("Civil-5",5,"Civil",2,6,"EE-LAB","U21PC582CE","Environmental Engineering Lab","FAC_KSB","Dr. K. Sai Baba",batch="G1")
        # THU
        e("Civil-5",5,"Civil",3,1,"CE-205","U21PC502CE","Transportation Engineering","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-5",5,"Civil",3,2,"CE-205","U21PC503CE","Design of RCC Structures-II","FAC_UDA","Dr. B. Udaysree")
        e("Civil-5",5,"Civil",3,3,"CE-205","U21PC502CE","Transportation Engineering","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-5",5,"Civil",3,4,"CE-205","U21PC506CE","Environmental Engineering","FAC_KSB","Dr. K. Sai Baba")
        e("Civil-5",5,"Civil",3,5,"CE-205","U21MCN01PY","Essence of Indian Traditional Knowledge","FAC_PKU","Mr. Prashanth Kuberkar")
        e("Civil-5",5,"Civil",3,6,"CE-205","SSIP","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar")
        # FRI
        e("Civil-5",5,"Civil",4,1,"CE-205","U21PC504CE","Structural Analysis-I","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-5",5,"Civil",4,2,"CE-205","U21PC506CE","Environmental Engineering","FAC_KSB","Dr. K. Sai Baba")
        e("Civil-5",5,"Civil",4,3,"CE-205","U21PC503CE","Design of RCC Structures-II","FAC_UDA","Dr. B. Udaysree")
        e("Civil-5",5,"Civil",4,4,"CE-205","U21PC505CE","Engineering Hydrology","FAC_KRS","Mr.K.Ravi Sekhar")
        e("Civil-5",5,"Civil",4,5,"EE-LAB","U21PC582CE","Environmental Engineering Lab","FAC_KSB","Dr. K. Sai Baba",batch="G2")
        e("Civil-5",5,"Civil",4,5,"CT-LAB","U21PC681CE","Concrete Technology Lab","FAC_CAK","Dr. C. Arvind Kumar",batch="G1")
        e("Civil-5",5,"Civil",4,6,"EE-LAB","U21PC582CE","Environmental Engineering Lab","FAC_KSB","Dr. K. Sai Baba",batch="G2")
        e("Civil-5",5,"Civil",4,6,"CT-LAB","U21PC681CE","Concrete Technology Lab","FAC_CAK","Dr. C. Arvind Kumar",batch="G1")
        # SAT
        e("Civil-5",5,"Civil",5,1,"CE-205","SSIP","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar")
        e("Civil-5",5,"Civil",5,2,"CE-205","U21PC506CE","Environmental Engineering","FAC_KSB","Dr. K. Sai Baba")
        e("Civil-5",5,"Civil",5,3,"CE-205","U21PC501CE","Foundation Engineering","FAC_SRR","Dr. R. Sandhya Rani")
        e("Civil-5",5,"Civil",5,4,"CE-205","U21MCN01PY","Essence of Indian Traditional Knowledge","FAC_PKU","Mr. Prashanth Kuberkar")
        e("Civil-5",5,"Civil",5,5,"CE-205","U21PC505CE","Engineering Hydrology","FAC_KRS","Mr.K.Ravi Sekhar")
        e("Civil-5",5,"Civil",5,6,"CE-205","LIBRARY","Library Session","FAC_KRS","Mr.K.Ravi Sekhar")

        # ════════════════════════════════════════════════════════════════
        # Civil Sem-VII  |  Room CE-204  |  Sem VII
        # ════════════════════════════════════════════════════════════════
        # MON
        e("Civil-7",7,"Civil",0,1,"CE-204","U21PC701CE","Estimation and Specifications","FAC_CAK","Dr. C. Arvind Kumar")
        e("Civil-7",7,"Civil",0,2,"CE-204","U21PC701CE","Estimation and Specifications","FAC_CAK","Dr. C. Arvind Kumar")
        e("Civil-7",7,"Civil",0,3,"CE-204","U21PE751CE","Transportation and Land Use Planning","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-7",7,"Civil",0,4,"CE-204","U21OE831ME","Material Handling","FAC_HAR","Mr. R. Hari Nath")
        e("Civil-7",7,"Civil",0,5,"CE-204","U21PE861CE","Construction Management & Administration","FAC_SRR","Dr. R. Sandhya Rani")
        e("Civil-7",7,"Civil",0,6,"CE-204","U21PE741CE","Disaster Mitigation and Management","FAC_VRU","Mrs. K. Vrushali")
        # TUE
        e("Civil-7",7,"Civil",1,1,"CE-204","U21PE871CE","Prestressed Concrete","FAC_UDA","Dr. B. Udaysree")
        e("Civil-7",7,"Civil",1,2,"CE-204","U21OE831ME","Material Handling","FAC_HAR","Mr. R. Hari Nath")
        e("Civil-7",7,"Civil",1,3,"CE-204","U21PE751CE","Transportation and Land Use Planning","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-7",7,"Civil",1,4,"CE-204","U21PE861CE","Construction Management & Administration","FAC_SRR","Dr. R. Sandhya Rani")
        e("Civil-7",7,"Civil",1,5,"CE-204","U21PE741CE","Disaster Mitigation and Management","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-7",7,"Civil",1,6,"CE-204","U21MCN01PO","Indian Constitution","FAC_PBH","Phanindra Bharadwaja")
        # WED
        e("Civil-7",7,"Civil",2,1,"CE-204","U21PE861CE","Construction Management & Administration","FAC_SRR","Dr. R. Sandhya Rani")
        e("Civil-7",7,"Civil",2,2,"CE-204","LIBRARY","Library Session","FAC_TNK","Mr. T. Naveen Kumar")
        e("Civil-7",7,"Civil",2,3,"CE-204","U21PC701CE","Estimation and Specifications","FAC_CAK","Dr. C. Arvind Kumar")
        e("Civil-7",7,"Civil",2,4,"CE-204","U21PE751CE","Transportation and Land Use Planning","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-7",7,"Civil",2,5,"CE-204","U21PE871CE","Prestressed Concrete","FAC_UDA","Dr. B. Udaysree")
        e("Civil-7",7,"Civil",2,6,"CE-204","LIBRARY","Library Session","FAC_TNK","Mr. T. Naveen Kumar")
        # THU
        e("Civil-7",7,"Civil",3,1,"CSE-LAB-IV","U21PC781CE","Civil Engineering Programming Lab","FAC_SSW","Mrs.S.Swathi")
        e("Civil-7",7,"Civil",3,2,"CSE-LAB-IV","U21PC781CE","Civil Engineering Programming Lab","FAC_SSW","Mrs.S.Swathi")
        e("Civil-7",7,"Civil",3,3,"CE-204","U21MCN01PO","Indian Constitution","FAC_PBH","Phanindra Bharadwaja")
        e("Civil-7",7,"Civil",3,4,"CE-204","U21PC701CE","Estimation and Specifications","FAC_CAK","Dr. C. Arvind Kumar")
        e("Civil-7",7,"Civil",3,5,"CE-204","U21PE871CE","Prestressed Concrete","FAC_UDA","Dr. B. Udaysree")
        e("Civil-7",7,"Civil",3,6,"CE-204","SPORTS","Sports / Fitness","FAC_TNK","Mr. T. Naveen Kumar")
        # FRI
        e("Civil-7",7,"Civil",4,1,"CE-204","U21PE871CE","Prestressed Concrete","FAC_UDA","Dr. B. Udaysree")
        e("Civil-7",7,"Civil",4,2,"CE-204","U21PE861CE","Construction Management & Administration","FAC_SRR","Dr. R. Sandhya Rani")
        e("Civil-7",7,"Civil",4,3,"CE-204","U21PE741CE","Disaster Mitigation and Management","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-7",7,"Civil",4,4,"CE-204","U21PE751CE","Transportation and Land Use Planning","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-7",7,"Civil",4,5,"CE-204","U21PE741CE","Disaster Mitigation and Management","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-7",7,"Civil",4,6,"CE-204","U21OE831ME","Material Handling","FAC_HAR","Mr. R. Hari Nath")
        # SAT — Project Work (PW-1) P1 to P6
        for p in range(1, 7):
            e("Civil-7",7,"Civil",5,p,"CE-204","U21PW782CE","Project work-I","FAC_TNK","Mr. T. Naveen Kumar")

        # ── 7. Bulk insert all entries ───────────────────────────────────────────
        inserted = 0
        for item in raw:
            db.add(TimetableEntryModel(**item))
            inserted += 1
        db.commit()
        print(f"🎉 Complete Seeding Successful! {inserted} timetable entries inserted across ALL 12 sections (Full Mon–Sat).")

    except Exception as err:
        db.rollback()
        print(f"❌ Seeding error: {err}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_all()

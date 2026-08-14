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
            dict(id="CB-01",           name="Charles Babbage Lab (CB-01)",         building=b_id,floor=0,capacity=40, type="Lab",               location_type="LABORATORY",       equipment=["Workstations","High Speed Internet"]),
            dict(id="CSE-LAB-IV",      name="CSE Lab-IV (CEP Lab)",                building=b_id,floor=0,capacity=35, type="Lab",               location_type="LABORATORY",       equipment=["Workstations","Programming Tools"]),

            # First Floor
            dict(id="PRINCIPAL-OFFICE",name="Principal / Directors Office",        building=b_id,floor=1,capacity=15, type="Office",            location_type="OFFICE",           equipment=["Executive Desk","Conference Table","AC"]),
            dict(id="IT-STAFF-ROOM",   name="IT Staff Room",                       building=b_id,floor=1,capacity=25, type="Staff Room",        location_type="STAFF_ROOM",       equipment=["Faculty Desks","Storage Lockers"]),
            dict(id="CE-IT-101",       name="Classroom CE-IT-101",                 building=b_id,floor=1,capacity=65, type="Lecture Hall",      location_type="CLASSROOM",        equipment=["Projector","Dual Audio Mic","Green/Whiteboard"]),
            dict(id="CE-IT-102",       name="Classroom CE-IT-102",                 building=b_id,floor=1,capacity=65, type="Lecture Hall",      location_type="CLASSROOM",        equipment=["Projector","Sound System","Whiteboard"]),
            dict(id="CIVIL-DEPT-OFFICE",name="Civil Department Office",            building=b_id,floor=1,capacity=15, type="Department Office", location_type="DEPARTMENT_OFFICE",equipment=["HOD Cabin","Staff Workstations"]),
            dict(id="IQAC-ROOM",       name="IQAC Room",                           building=b_id,floor=1,capacity=20, type="Office",            location_type="OFFICE",           equipment=["Conference System","Presentation Screen"]),
            dict(id="CE-IT-104",       name="Computer Lab (CE-IT-104)",            building=b_id,floor=1,capacity=40, type="Lab",               location_type="LABORATORY",       equipment=["40 Desktop Computers","Gigabit Switch","Projector"]),

            # Second Floor
            dict(id="CE-IT-201",       name="Classroom CE-IT-201",                 building=b_id,floor=2,capacity=65, type="Lecture Hall",      location_type="CLASSROOM",        equipment=["Projector","Audio Setup","Whiteboard"]),
            dict(id="CE-IT-202",       name="Classroom CE-IT-202",                 building=b_id,floor=2,capacity=65, type="Lecture Hall",      location_type="CLASSROOM",        equipment=["Projector","Sound System","Smart Board"]),
            dict(id="CE-IT-203",       name="Classroom CE-IT-203",                 building=b_id,floor=2,capacity=65, type="Lecture Hall",      location_type="CLASSROOM",        equipment=["Projector","Audio Setup","Whiteboard"]),
            dict(id="CE-IT-211",       name="CN & NS / DS / AI Lab (CE-IT-211)",   building=b_id,floor=2,capacity=35, type="Lab",               location_type="LABORATORY",       equipment=["Cisco Routers","Wireshark Tools","High Performance GPUs"]),
            dict(id="CE-IT-212",       name="Classroom CE-IT-212",                 building=b_id,floor=2,capacity=65, type="Lecture Hall",      location_type="CLASSROOM",        equipment=["Projector","Sound System","Whiteboard"]),
            dict(id="CE-IT-213",       name="Classroom CE-IT-213",                 building=b_id,floor=2,capacity=65, type="Lecture Hall",      location_type="CLASSROOM",        equipment=["Projector","Smart Podium","Whiteboard"]),
            dict(id="CE-IT-214",       name="Electronics Laboratory (CE-IT-214)",  building=b_id,floor=2,capacity=35, type="Lab",               location_type="LABORATORY",       equipment=["DSO","Function Generators","Power Supplies"]),
            dict(id="CE-204",          name="Classroom CE-204",                    building=b_id,floor=2,capacity=65, type="Lecture Hall",      location_type="CLASSROOM",        equipment=["Projector","Whiteboard","Audio Mic"]),
            dict(id="CE-205",          name="Classroom CE-205",                    building=b_id,floor=2,capacity=65, type="Lecture Hall",      location_type="CLASSROOM",        equipment=["Projector","Smart Board","Sound System"]),
            dict(id="CE-206",          name="Classroom CE-206",                    building=b_id,floor=2,capacity=65, type="Lecture Hall",      location_type="CLASSROOM",        equipment=["Projector","Whiteboard","Drawing Easels"]),
        ]

        for ld in locs:
            row = db.query(ClassroomModel).filter(ClassroomModel.id == ld["id"]).first()
            if not row:
                db.add(ClassroomModel(**ld, status="available", occupancy=0))
            else:
                for k, v in ld.items():
                    setattr(row, k, v)
        db.commit()

        # ── 3. Faculty ───────────────────────────────────────────────────────────
        faculty_list = [
            ("FAC_SRU","Ch.Srujana","IT","Assistant Professor","srujana@mvsrec.edu.in"),
            ("FAC_SAM","Dr.Ch.Samson","IT","Associate Professor","samson@mvsrec.edu.in"),
            ("FAC_DEV","K.Devaki","IT","Assistant Professor","devaki@mvsrec.edu.in"),
            ("FAC_SWA","M.Swapna","IT","Assistant Professor","swapna@mvsrec.edu.in"),
            ("FAC_MAN","A.Manasa","IT","Assistant Professor","manasa@mvsrec.edu.in"),
            ("FAC_RAV","Dr.R.Ravi Kumar","Civil","Associate Professor","ravikumar@mvsrec.edu.in"),
            ("FAC_SOW","P.Sita Sowjanya","IT","Assistant Professor","sitasowjanya@mvsrec.edu.in"),
            ("FAC_VIJ","S.Ch. Vijaya Bhaskar","IT","Assistant Professor","vijayabhaskar@mvsrec.edu.in"),
            ("FAC_MUN","D.Muninder","IT","Assistant Professor","muninder@mvsrec.edu.in"),
            ("FAC_MBD","Maya B Dhone","IT","Assistant Professor","mayadhone@mvsrec.edu.in"),
            ("FAC_KAR","P.Karthik","IT","Assistant Professor","karthik@mvsrec.edu.in"),
            ("FAC_HAR","Mr.R.Haranath","Civil","Assistant Professor","haranath@mvsrec.edu.in"),
            ("FAC_AMB","P.Amba Bhavani","IT","Assistant Professor","ambabhavani@mvsrec.edu.in"),
            ("FAC_RVS","Dr.DBV Ravi Sankar","IT","Professor & AHOD","ravisankar@mvsrec.edu.in"),
            ("FAC_RAM","K.Ramya Madhavi","IT","Assistant Professor","ramyamadhavi@mvsrec.edu.in"),
            ("FAC_UGN","Dr.A.Ugendhar","IT","Associate Professor","ugendhar@mvsrec.edu.in"),
            ("FAC_VASU","M.Vasundhara","IT","Assistant Professor","vasundhara@mvsrec.edu.in"),
            ("FAC_SWA_CIV","Mrs.S.Swathi","Civil","Assistant Professor","swathi.civil@mvsrec.edu.in"),
            ("FAC_JSW","J.Sowjanya","IT","Assistant Professor","jsowjanya@mvsrec.edu.in"),
            ("FAC_VAS","Dr.B.Vasavi","IT","Associate Professor","vasavi@mvsrec.edu.in"),
            ("FAC_PBH","Phanindra Bharadwaja","Management/IT","Assistant Professor","phanindra@mvsrec.edu.in"),
            ("FAC_SRA","M.Sravani","IT","Assistant Professor","sravani@mvsrec.edu.in"),
            ("FAC_SUN","B.Sunitha","IT","Assistant Professor","sunitha@mvsrec.edu.in"),
            ("FAC_CSK","K.Chandra Sekhar","IT","Assistant Professor","chandrasekhar@mvsrec.edu.in"),
            ("FAC_UPE","I.Upender","S&H","Assistant Professor","upender@mvsrec.edu.in"),
            ("FAC_SRR","Sriranga Raju","Management/IT","Assistant Professor","srirangaraju@mvsrec.edu.in"),
            ("FAC_USH","G.Ushasri","IT","Assistant Professor","ushasri@mvsrec.edu.in"),
            ("FAC_SRI","K.Srilaxmi","IT","Assistant Professor","srilaxmi@mvsrec.edu.in"),
            ("FAC_NIT","N.Nithya lakshmi","IT","Assistant Professor","nithyalakshmi@mvsrec.edu.in"),
            ("FAC_AVK","Dr.A.V.Krishna Prasad","IT","Professor & HOD","hod_it@mvsrec.edu.in"),
            ("FAC_GVS","Dr.GVS Subbaraya Sharma","S&H","Professor","gvssharma@mvsrec.edu.in"),
            ("FAC_GNK","Dr.G.Nikhil Kumar","S&H","Associate Professor","nikhilkumar@mvsrec.edu.in"),
            ("FAC_MKR","Dr.M.Kameshwar Reddy","Mechanical","Associate Professor","kameshwar@mvsrec.edu.in"),
            ("FAC_GNG","Dr. G. Narendra Goud","Civil","Associate Professor","narendragoud@mvsrec.edu.in"),
            ("FAC_SAN","Dr. R. Sandhya Rani","Civil","Associate Professor","sandhyarani@mvsrec.edu.in"),
            ("FAC_KRS","Mr.K.Ravi Sekhar","Civil","Assistant Professor","kravisekhar@mvsrec.edu.in"),
            ("FAC_VRU","Mrs. K. Vrushali","Civil","Assistant Professor","vrushali@mvsrec.edu.in"),
            ("FAC_KSB","Dr. K. Sai Baba","Civil","Associate Professor","saibaba@mvsrec.edu.in"),
            ("FAC_PRK","Mr. Prashanth Kuberkar","S&H","Assistant Professor","prashanth@mvsrec.edu.in"),
            ("FAC_UDA","Dr. B. Udaysree","Civil","Associate Professor","udaysree@mvsrec.edu.in"),
            ("FAC_CAK","Dr. C. Arvind Kumar","Civil","Associate Professor","arvindkumar@mvsrec.edu.in"),
            ("FAC_RHN","Mr. R. Hari Nath","Mechanical","Associate Professor","harinath@mvsrec.edu.in"),
            ("FAC_PBK","Dr.P.Bharath Kumar","Civil","Associate Professor","bharathkumar@mvsrec.edu.in"),
            ("FAC_VSC","Dr. V. Shiva Chandra","Civil","Associate Professor","shivachandra@mvsrec.edu.in"),
            ("FAC_BHA","Dr. D. Bhagya","Mathematics","Associate Professor","bhagya@mvsrec.edu.in"),
            ("FAC_NAV","Mr. T. Naveen Kumar","Civil","Assistant Professor","naveenkumar@mvsrec.edu.in"),
        ]

        for fid, fn, dept, des, email in faculty_list:
            row = db.query(FacultyProfileModel).filter(FacultyProfileModel.id == fid).first()
            if not row:
                db.add(FacultyProfileModel(id=fid, name=fn, department=dept, designation=des, email=email))
            else:
                row.name = fn; row.department = dept; row.designation = des; row.email = email
        db.commit()

        # ── 4. Clear Old Timetable Entries ───────────────────────────────────────
        db.query(TimetableEntryModel).delete()
        db.commit()

        # Helper to push timetable entry
        def e(sec, sem, dept, day, p_num, room_id, s_code, s_name, f_id, f_name, batch=None):
            st, et = PERIOD_TIMES[p_num]
            db.add(TimetableEntryModel(
                section=sec, semester=sem, department=dept, academic_year="2026-2027",
                day_of_week=day, period_number=p_num, start_time=st, end_time=et,
                classroom_id=room_id, subject_id=s_code, subject_name=s_name,
                faculty_id=f_id, faculty_name=f_name, batch=batch, is_active=True
            ))

        # ══════════════════════════════════════════════════════════════════════════
        # 1. BE IT-2A (Room: CE-IT-101)
        # ══════════════════════════════════════════════════════════════════════════
        # MON
        e("IT-2A",3,"IT",0,1,"CE-IT-101","U25PC301IT","Data Structures using C","FAC_VAS","Dr.B.Vasavi")
        e("IT-2A",3,"IT",0,2,"CE-IT-101","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        e("IT-2A",3,"IT",0,3,"CE-IT-101","U25ES302IT","Digital Electronics and Logic Design","FAC_SAM","Dr.Ch.Samson")
        e("IT-2A",3,"IT",0,4,"CE-IT-101","TUTORIAL","Tutorial (OS)","FAC_SRA","M.Sravani")
        e("IT-2A",3,"IT",0,5,"CE-IT-101","U25ES301IT","Electronic Devices and Sensors","FAC_SRU","Ch.Srujana")
        e("IT-2A",3,"IT",0,6,"CE-IT-101","COUNSELLING","Counselling","FAC_SRA","M.Sravani")
        # TUE
        e("IT-2A",3,"IT",1,1,"CE-IT-101","U25PC303IT","Mathematical Foundation for Information Technology","FAC_CSK","K.Chandra Sekhar")
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
        e("IT-2A",3,"IT",2,6,"CE-IT-101","U25PC303IT","Mathematical Foundation for Information Technology","FAC_CSK","K.Chandra Sekhar")
        # THU
        e("IT-2A",3,"IT",3,1,"CE-IT-101","U25PC301IT","Data Structures using C","FAC_VAS","Dr.B.Vasavi")
        e("IT-2A",3,"IT",3,2,"CE-IT-101","U25PC303IT","Mathematical Foundation for Information Technology","FAC_CSK","K.Chandra Sekhar")
        e("IT-2A",3,"IT",3,3,"CE-IT-101","U25PC302IT","Operating Systems","FAC_SRA","M.Sravani")
        e("IT-2A",3,"IT",3,4,"CE-IT-101","U25ES302IT","Digital Electronics and Logic Design","FAC_SAM","Dr.Ch.Samson")
        e("IT-2A",3,"IT",3,5,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SRU","Ch.Srujana",batch="1")
        e("IT-2A",3,"IT",3,5,"CE-IT-211","U25PC381IT","DS Lab","FAC_VASU","M.Vasundhara",batch="2")
        e("IT-2A",3,"IT",3,6,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SRU","Ch.Srujana",batch="1")
        e("IT-2A",3,"IT",3,6,"CE-IT-211","U25PC381IT","DS Lab","FAC_VASU","M.Vasundhara",batch="2")
        # FRI
        e("IT-2A",3,"IT",4,1,"CE-IT-101","U25ES301IT","Electronic Devices and Sensors","FAC_SRU","Ch.Srujana")
        e("IT-2A",3,"IT",4,2,"CE-IT-101","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        e("IT-2A",3,"IT",4,3,"CE-IT-101","U25ES302IT","Digital Electronics and Logic Design","FAC_SAM","Dr.Ch.Samson")
        e("IT-2A",3,"IT",4,4,"CE-IT-101","U25PC301IT","Data Structures using C","FAC_VAS","Dr.B.Vasavi")
        e("IT-2A",3,"IT",4,5,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="2")
        e("IT-2A",3,"IT",4,5,"CE-IT-211","U25PC381IT","DS Lab","FAC_DEV","K.Devaki",batch="1")
        e("IT-2A",3,"IT",4,6,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="2")
        e("IT-2A",3,"IT",4,6,"CE-IT-211","U25PC381IT","DS Lab","FAC_DEV","K.Devaki",batch="1")
        # SAT
        e("IT-2A",3,"IT",5,1,"CE-IT-101","U25PC303IT","Mathematical Foundation for Information Technology","FAC_CSK","K.Chandra Sekhar")
        e("IT-2A",3,"IT",5,2,"CE-IT-101","U25MCN01PO","Indian Constitution","FAC_UPE","I.Upender")
        e("IT-2A",3,"IT",5,3,"CE-IT-101","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        e("IT-2A",3,"IT",5,4,"CE-IT-101","U25PC302IT","Operating Systems","FAC_SRA","M.Sravani")
        e("IT-2A",3,"IT",5,5,"CE-IT-104","U25PC383IT","Web Technologies Lab","FAC_MAN","A.Manasa")
        e("IT-2A",3,"IT",5,6,"CE-IT-104","U25PC383IT","Web Technologies Lab","FAC_MAN","A.Manasa")

        # ══════════════════════════════════════════════════════════════════════════
        # 2. BE IT-2B (Room: CE-IT-102)
        # ══════════════════════════════════════════════════════════════════════════
        # MON
        e("IT-2B",3,"IT",0,1,"CE-IT-102","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        e("IT-2B",3,"IT",0,2,"CE-IT-102","U25ES302IT","Digital Electronics and Logic Design","FAC_VIJ","S.Ch. Vijaya Bhaskar")
        e("IT-2B",3,"IT",0,3,"CE-IT-102","COUNSELLING","Counselling","FAC_SUN","B.Sunitha")
        e("IT-2B",3,"IT",0,4,"CE-IT-102","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        e("IT-2B",3,"IT",0,5,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="1")
        e("IT-2B",3,"IT",0,5,"CE-IT-211","U25PC381IT","DS Lab","FAC_MBD","Maya B Dhone",batch="2")
        e("IT-2B",3,"IT",0,6,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="1")
        e("IT-2B",3,"IT",0,6,"CE-IT-211","U25PC381IT","DS Lab","FAC_MBD","Maya B Dhone",batch="2")
        # TUE
        e("IT-2B",3,"IT",1,1,"CE-IT-102","U25PC303IT","Mathematical Foundation for Information Technology","FAC_AMB","P.Amba Bhavani")
        e("IT-2B",3,"IT",1,2,"CE-IT-102","U25ES302IT","Digital Electronics and Logic Design","FAC_VIJ","S.Ch. Vijaya Bhaskar")
        e("IT-2B",3,"IT",1,3,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="2")
        e("IT-2B",3,"IT",1,3,"CE-IT-211","U25PC381IT","DS Lab","FAC_MBD","Maya B Dhone",batch="1")
        e("IT-2B",3,"IT",1,4,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="2")
        e("IT-2B",3,"IT",1,4,"CE-IT-211","U25PC381IT","DS Lab","FAC_MBD","Maya B Dhone",batch="1")
        e("IT-2B",3,"IT",1,5,"CE-IT-102","U25PC302IT","Operating Systems","FAC_MUN","D.Muninder")
        e("IT-2B",3,"IT",1,6,"CE-IT-102","TUTORIAL","Tutorial (DS)","FAC_MBD","Maya B Dhone")
        # WED
        e("IT-2B",3,"IT",2,1,"CE-IT-102","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        e("IT-2B",3,"IT",2,2,"CE-IT-102","U25PC301IT","Data Structures using C","FAC_MBD","Maya B Dhone")
        e("IT-2B",3,"IT",2,3,"CE-IT-102","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        e("IT-2B",3,"IT",2,4,"CE-IT-102","U25PC303IT","Mathematical Foundation for Information Technology","FAC_AMB","P.Amba Bhavani")
        e("IT-2B",3,"IT",2,5,"CE-IT-104","U25PC382IT","Operating Systems Lab","FAC_MUN","D.Muninder")
        e("IT-2B",3,"IT",2,6,"CE-IT-104","U25PC382IT","Operating Systems Lab","FAC_MUN","D.Muninder")
        # THU
        e("IT-2B",3,"IT",3,1,"CE-IT-102","U25PC303IT","Mathematical Foundation for Information Technology","FAC_AMB","P.Amba Bhavani")
        e("IT-2B",3,"IT",3,2,"CE-IT-102","U25PC301IT","Data Structures using C","FAC_MBD","Maya B Dhone")
        e("IT-2B",3,"IT",3,3,"CE-IT-102","U25MCN01PO","Indian Constitution","FAC_UPE","I.Upender")
        e("IT-2B",3,"IT",3,4,"CE-IT-102","U25PC302IT","Operating Systems","FAC_MUN","D.Muninder")
        e("IT-2B",3,"IT",3,5,"CE-IT-102","U25ES302IT","Digital Electronics and Logic Design","FAC_VIJ","S.Ch. Vijaya Bhaskar")
        e("IT-2B",3,"IT",3,6,"CE-IT-102","U25HSN01CO","Finance and Accounting","FAC_PBH","Phanindra Bharadwaja")
        # FRI
        e("IT-2B",3,"IT",4,1,"CE-IT-102","U25ES302IT","Digital Electronics and Logic Design","FAC_VIJ","S.Ch. Vijaya Bhaskar")
        e("IT-2B",3,"IT",4,2,"CE-IT-102","U25PC303IT","Mathematical Foundation for Information Technology","FAC_AMB","P.Amba Bhavani")
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

        # ══════════════════════════════════════════════════════════════════════════
        # 3. BE IT-2C (Room: CE-IT-201)
        # ══════════════════════════════════════════════════════════════════════════
        # MON
        e("IT-2C",3,"IT",0,1,"CE-IT-201","U25HSN01CO","Finance and Accounting","FAC_SRR","Sriranga Raju")
        e("IT-2C",3,"IT",0,2,"CE-IT-201","U25MCN01PO","Indian Constitution","FAC_UPE","I.Upender")
        e("IT-2C",3,"IT",0,3,"CE-IT-201","U25PC301IT","Data Structures using C","FAC_USH","G.Ushasri")
        e("IT-2C",3,"IT",0,4,"CE-IT-201","U25PC302IT","Operating Systems","FAC_SRI","K.Srilaxmi")
        e("IT-2C",3,"IT",0,5,"CE-IT-201","U25ES302IT","Digital Electronics and Logic Design","FAC_RVS","Dr.DBV Ravi Sankar")
        e("IT-2C",3,"IT",0,6,"CE-IT-201","U25PC303IT","Mathematical Foundation for Information Technology","FAC_UGN","Dr.A.Ugendhar")
        # TUE
        e("IT-2C",3,"IT",1,1,"CE-IT-201","U25PC301IT","Data Structures using C","FAC_USH","G.Ushasri")
        e("IT-2C",3,"IT",1,2,"CE-IT-201","U25PC302IT","Operating Systems","FAC_SRI","K.Srilaxmi")
        e("IT-2C",3,"IT",1,3,"CE-IT-201","U25ES302IT","Digital Electronics and Logic Design","FAC_RVS","Dr.DBV Ravi Sankar")
        e("IT-2C",3,"IT",1,4,"CE-IT-201","U25MCN01PO","Indian Constitution","FAC_UPE","I.Upender")
        e("IT-2C",3,"IT",1,5,"CE-IT-201","U25PC303IT","Mathematical Foundation for Information Technology","FAC_UGN","Dr.A.Ugendhar")
        e("IT-2C",3,"IT",1,6,"CE-IT-201","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        # WED
        e("IT-2C",3,"IT",2,1,"CE-IT-201","U25ES302IT","Digital Electronics and Logic Design","FAC_RVS","Dr.DBV Ravi Sankar")
        e("IT-2C",3,"IT",2,2,"CE-IT-201","U25PC301IT","Data Structures using C","FAC_USH","G.Ushasri")
        e("IT-2C",3,"IT",2,3,"CE-IT-201","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        e("IT-2C",3,"IT",2,4,"CE-IT-201","U25PC302IT","Operating Systems","FAC_SRI","K.Srilaxmi")
        e("IT-2C",3,"IT",2,5,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="1")
        e("IT-2C",3,"IT",2,5,"CE-IT-211","U25PC381IT","DS Lab","FAC_USH","G.Ushasri",batch="2")
        e("IT-2C",3,"IT",2,6,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="1")
        e("IT-2C",3,"IT",2,6,"CE-IT-211","U25PC381IT","DS Lab","FAC_USH","G.Ushasri",batch="2")
        # THU
        e("IT-2C",3,"IT",3,1,"CE-IT-201","U25PC301IT","Data Structures using C","FAC_USH","G.Ushasri")
        e("IT-2C",3,"IT",3,2,"CE-IT-201","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        e("IT-2C",3,"IT",3,3,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="2")
        e("IT-2C",3,"IT",3,3,"CE-IT-211","U25PC381IT","DS Lab","FAC_USH","G.Ushasri",batch="1")
        e("IT-2C",3,"IT",3,4,"CE-IT-214","U25ES381IT","EDS Lab","FAC_SUN","B.Sunitha",batch="2")
        e("IT-2C",3,"IT",3,4,"CE-IT-211","U25PC381IT","DS Lab","FAC_USH","G.Ushasri",batch="1")
        e("IT-2C",3,"IT",3,5,"CE-IT-201","U25ES302IT","Digital Electronics and Logic Design","FAC_RVS","Dr.DBV Ravi Sankar")
        e("IT-2C",3,"IT",3,6,"CE-IT-201","U25HSN01CO","Finance and Accounting","FAC_SRR","Sriranga Raju")
        # FRI
        e("IT-2C",3,"IT",4,1,"CE-IT-201","U25ES301IT","Electronic Devices and Sensors","FAC_SUN","B.Sunitha")
        e("IT-2C",3,"IT",4,2,"CE-IT-201","U25PC302IT","Operating Systems","FAC_SRI","K.Srilaxmi")
        e("IT-2C",3,"IT",4,3,"CE-IT-201","U25PC303IT","Mathematical Foundation for Information Technology","FAC_UGN","Dr.A.Ugendhar")
        e("IT-2C",3,"IT",4,4,"CE-IT-201","U25HSN01CO","Finance and Accounting","FAC_SRR","Sriranga Raju")
        e("IT-2C",3,"IT",4,5,"CE-IT-104","U25PC382IT","Operating Systems Lab","FAC_SRI","K.Srilaxmi")
        e("IT-2C",3,"IT",4,6,"CE-IT-104","U25PC382IT","Operating Systems Lab","FAC_SRI","K.Srilaxmi")
        # SAT
        e("IT-2C",3,"IT",5,1,"CE-IT-104","U25PC383IT","Web Technologies Lab","FAC_SWA","M.Swapna")
        e("IT-2C",3,"IT",5,2,"CE-IT-104","U25PC383IT","Web Technologies Lab","FAC_SWA","M.Swapna")
        e("IT-2C",3,"IT",5,3,"CE-IT-201","U25PC303IT","Mathematical Foundation for Information Technology","FAC_UGN","Dr.A.Ugendhar")
        e("IT-2C",3,"IT",5,4,"CE-IT-201","TUTORIAL","Tutorial (DS)","FAC_USH","G.Ushasri")
        e("IT-2C",3,"IT",5,5,"CE-IT-201","U25HSN01CO","Finance and Accounting","FAC_SRR","Sriranga Raju")
        e("IT-2C",3,"IT",5,6,"CE-IT-201","COUNSELLING","Counselling","FAC_JSW","J.Sowjanya")

        # ══════════════════════════════════════════════════════════════════════════
        # 4. BE IT-3A (Room: CE-IT-202)
        # ══════════════════════════════════════════════════════════════════════════
        # MON
        e("IT-3A",5,"IT",0,1,"CE-IT-104","U21PC583IT","MAD Lab","FAC_CSK","K.Chandra Sekhar")
        e("IT-3A",5,"IT",0,2,"CE-IT-104","U21PC583IT","MAD Lab","FAC_CSK","K.Chandra Sekhar")
        e("IT-3A",5,"IT",0,3,"CE-IT-202","U21PE621IT","Big Data Analytics","FAC_AVK","Dr.A.V.Krishna Prasad")
        e("IT-3A",5,"IT",0,4,"CE-IT-202","U21PE621IT","Big Data Analytics","FAC_AVK","Dr.A.V.Krishna Prasad")
        e("IT-3A",5,"IT",0,5,"CE-IT-202","U21PC505IT","Automata Theory","FAC_SRA","M.Sravani")
        e("IT-3A",5,"IT",0,6,"CE-IT-202","U21PC501IT","Software Engineering","FAC_DEV","K.Devaki")
        # TUE
        e("IT-3A",5,"IT",1,1,"CE-IT-213","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="DM")
        e("IT-3A",5,"IT",1,1,"CE-IT-104","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="SS")
        e("IT-3A",5,"IT",1,1,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OR")
        e("IT-3A",5,"IT",1,2,"CE-IT-202","U21PC502IT","Data Mining","FAC_MAN","A.Manasa")
        e("IT-3A",5,"IT",1,3,"CE-IT-202","U21PC501IT","Software Engineering","FAC_DEV","K.Devaki")
        e("IT-3A",5,"IT",1,4,"CE-IT-202","U21PC504IT","Artificial Intelligence","FAC_CSK","K.Chandra Sekhar")
        e("IT-3A",5,"IT",1,5,"CE-IT-211","U21PC582IT","AI Lab","FAC_SRA","M.Sravani")
        e("IT-3A",5,"IT",1,6,"CE-IT-211","U21PC582IT","AI Lab","FAC_SRA","M.Sravani")
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
        e("IT-3A",5,"IT",3,4,"CE-IT-212","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="DM")
        e("IT-3A",5,"IT",3,4,"CE-IT-104","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="SS")
        e("IT-3A",5,"IT",3,4,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OR")
        e("IT-3A",5,"IT",3,5,"CE-IT-202","U21PC504IT","Artificial Intelligence","FAC_CSK","K.Chandra Sekhar")
        e("IT-3A",5,"IT",3,6,"CE-IT-202","U21PC505IT","Automata Theory","FAC_SRA","M.Sravani")
        # FRI
        e("IT-3A",5,"IT",4,1,"CE-IT-202","U21PC504IT","Artificial Intelligence","FAC_CSK","K.Chandra Sekhar")
        e("IT-3A",5,"IT",4,2,"CE-IT-202","U21PC503IT","Design and Analysis of Algorithms","FAC_VAS","Dr.B.Vasavi")
        e("IT-3A",5,"IT",4,3,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_DEV","K.Devaki")
        e("IT-3A",5,"IT",4,4,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_DEV","K.Devaki")
        e("IT-3A",5,"IT",4,5,"CE-IT-213","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="DM")
        e("IT-3A",5,"IT",4,5,"CE-IT-212","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="SS")
        e("IT-3A",5,"IT",4,5,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OR")
        e("IT-3A",5,"IT",4,6,"CE-IT-202","U21PC502IT","Data Mining","FAC_MAN","A.Manasa")
        # SAT
        for p in range(1,7):
            e("IT-3A",5,"IT",5,p,"ADA-LAB","CRT","CRT Campus Recruitment Training","FAC_MAN","A.Manasa")

        # ══════════════════════════════════════════════════════════════════════════
        # 5. BE IT-3B (Room: CE-IT-212)
        # ══════════════════════════════════════════════════════════════════════════
        # MON
        e("IT-3B",5,"IT",0,1,"CE-IT-212","U21PE621IT","Big Data Analytics","FAC_AVK","Dr.A.V.Krishna Prasad")
        e("IT-3B",5,"IT",0,2,"CE-IT-212","U21PC505IT","Automata Theory","FAC_JSW","J.Sowjanya")
        e("IT-3B",5,"IT",0,3,"CE-IT-212","U21PC504IT","Artificial Intelligence","FAC_SOW","P.Sita Sowjanya")
        e("IT-3B",5,"IT",0,4,"CE-IT-212","U21PC502IT","Data Mining","FAC_NIT","N.Nithya lakshmi")
        e("IT-3B",5,"IT",0,5,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_KAR","P.Karthik")
        e("IT-3B",5,"IT",0,6,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_KAR","P.Karthik")
        # TUE
        e("IT-3B",5,"IT",1,1,"CE-IT-213","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="DM")
        e("IT-3B",5,"IT",1,1,"CE-IT-104","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="SS")
        e("IT-3B",5,"IT",1,1,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OR")
        e("IT-3B",5,"IT",1,2,"CE-IT-104","U21PC583IT","MAD Lab","FAC_JSW","J.Sowjanya")
        e("IT-3B",5,"IT",1,3,"CE-IT-104","U21PC583IT","MAD Lab","FAC_JSW","J.Sowjanya")
        e("IT-3B",5,"IT",1,4,"CE-IT-104","U21PC583IT","MAD Lab","FAC_JSW","J.Sowjanya")
        e("IT-3B",5,"IT",1,5,"CE-IT-212","U21PC503IT","Design and Analysis of Algorithms","FAC_AMB","P.Amba Bhavani")
        e("IT-3B",5,"IT",1,6,"CE-IT-212","U21PC501IT","Software Engineering","FAC_KAR","P.Karthik")
        # WED
        for p in range(1,7):
            e("IT-3B",5,"IT",2,p,"ADA-LAB","CRT","CRT Campus Recruitment Training","FAC_KAR","P.Karthik")
        # THU
        e("IT-3B",5,"IT",3,1,"CE-IT-212","U21PC504IT","Artificial Intelligence","FAC_SOW","P.Sita Sowjanya")
        e("IT-3B",5,"IT",3,2,"CE-IT-212","U21PC502IT","Data Mining","FAC_NIT","N.Nithya lakshmi")
        e("IT-3B",5,"IT",3,3,"CE-IT-212","U21PC503IT","Design and Analysis of Algorithms","FAC_AMB","P.Amba Bhavani")
        e("IT-3B",5,"IT",3,4,"CE-IT-212","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="DM")
        e("IT-3B",5,"IT",3,4,"CE-IT-104","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="SS")
        e("IT-3B",5,"IT",3,4,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OR")
        e("IT-3B",5,"IT",3,5,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_KAR","P.Karthik")
        e("IT-3B",5,"IT",3,6,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_KAR","P.Karthik")
        # FRI
        e("IT-3B",5,"IT",4,1,"CE-IT-212","U21PC505IT","Automata Theory","FAC_JSW","J.Sowjanya")
        e("IT-3B",5,"IT",4,2,"CE-IT-212","U21PC501IT","Software Engineering","FAC_KAR","P.Karthik")
        e("IT-3B",5,"IT",4,3,"CE-IT-211","U21PC582IT","AI Lab","FAC_SOW","P.Sita Sowjanya")
        e("IT-3B",5,"IT",4,4,"CE-IT-211","U21PC582IT","AI Lab","FAC_SOW","P.Sita Sowjanya")
        e("IT-3B",5,"IT",4,5,"CE-IT-213","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="DM")
        e("IT-3B",5,"IT",4,5,"CE-IT-212","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="SS")
        e("IT-3B",5,"IT",4,5,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OR")
        e("IT-3B",5,"IT",4,6,"CE-IT-212","U21PE621IT","Big Data Analytics","FAC_AVK","Dr.A.V.Krishna Prasad")
        # SAT
        e("IT-3B",5,"IT",5,1,"CE-IT-212","U21PC501IT","Software Engineering","FAC_KAR","P.Karthik")
        e("IT-3B",5,"IT",5,2,"CE-IT-212","U21PC503IT","Design and Analysis of Algorithms","FAC_AMB","P.Amba Bhavani")
        e("IT-3B",5,"IT",5,3,"CE-IT-212","U21PE621IT","Big Data Analytics","FAC_AVK","Dr.A.V.Krishna Prasad")
        e("IT-3B",5,"IT",5,4,"CE-IT-212","U21PC502IT","Data Mining","FAC_NIT","N.Nithya lakshmi")
        e("IT-3B",5,"IT",5,5,"CE-IT-212","U21PC505IT","Automata Theory","FAC_JSW","J.Sowjanya")
        e("IT-3B",5,"IT",5,6,"CE-IT-212","U21PC504IT","Artificial Intelligence","FAC_SOW","P.Sita Sowjanya")

        # ══════════════════════════════════════════════════════════════════════════
        # 6. BE IT-3C (Room: CE-IT-213)
        # ══════════════════════════════════════════════════════════════════════════
        # MON
        e("IT-3C",5,"IT",0,1,"CE-IT-211","U21PC582IT","AI Lab","FAC_SRI","K.Srilaxmi")
        e("IT-3C",5,"IT",0,2,"CE-IT-211","U21PC582IT","AI Lab","FAC_SRI","K.Srilaxmi")
        e("IT-3C",5,"IT",0,3,"CE-IT-213","U21PC501IT","Software Engineering","FAC_VASU","M.Vasundhara")
        e("IT-3C",5,"IT",0,4,"CE-IT-213","U21PC502IT","Data Mining","FAC_RAM","K.Ramya Madhavi")
        e("IT-3C",5,"IT",0,5,"CE-IT-213","U21PE621IT","Big Data Analytics","FAC_JSW","J.Sowjanya")
        e("IT-3C",5,"IT",0,6,"CE-IT-213","U21PC504IT","Artificial Intelligence","FAC_SRI","K.Srilaxmi")
        # TUE
        e("IT-3C",5,"IT",1,1,"CE-IT-213","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="DM")
        e("IT-3C",5,"IT",1,1,"CE-IT-104","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="SS")
        e("IT-3C",5,"IT",1,1,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OR")
        e("IT-3C",5,"IT",1,2,"CE-IT-213","U21PC505IT","Automata Theory","FAC_NIT","N.Nithya lakshmi")
        e("IT-3C",5,"IT",1,3,"CE-IT-213","U21PC503IT","Design and Analysis of Algorithms","FAC_USH","G.Ushasri")
        e("IT-3C",5,"IT",1,4,"CE-IT-213","U21PC504IT","Artificial Intelligence","FAC_SRI","K.Srilaxmi")
        e("IT-3C",5,"IT",1,5,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_VASU","M.Vasundhara")
        e("IT-3C",5,"IT",1,6,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_VASU","M.Vasundhara")
        # WED
        for p in range(1,7):
            e("IT-3C",5,"IT",2,p,"CB-01","CRT","CRT Campus Recruitment Training","FAC_JSW","J.Sowjanya")
        # THU
        e("IT-3C",5,"IT",3,1,"CE-IT-104","U21PC583IT","MAD Lab","FAC_JSW","J.Sowjanya")
        e("IT-3C",5,"IT",3,2,"CE-IT-104","U21PC583IT","MAD Lab","FAC_JSW","J.Sowjanya")
        e("IT-3C",5,"IT",3,3,"CE-IT-104","U21PC583IT","MAD Lab","FAC_JSW","J.Sowjanya")
        e("IT-3C",5,"IT",3,4,"CE-IT-212","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="DM")
        e("IT-3C",5,"IT",3,4,"CE-IT-104","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="SS")
        e("IT-3C",5,"IT",3,4,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OR")
        e("IT-3C",5,"IT",3,5,"CE-IT-213","U21PC503IT","Design and Analysis of Algorithms","FAC_USH","G.Ushasri")
        e("IT-3C",5,"IT",3,6,"CE-IT-213","U21PC505IT","Automata Theory","FAC_NIT","N.Nithya lakshmi")
        # FRI
        e("IT-3C",5,"IT",4,1,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_VASU","M.Vasundhara")
        e("IT-3C",5,"IT",4,2,"CE-IT-104","U21PC581IT","Full Stack Development Lab","FAC_VASU","M.Vasundhara")
        e("IT-3C",5,"IT",4,3,"CE-IT-213","U21PE621IT","Big Data Analytics","FAC_JSW","J.Sowjanya")
        e("IT-3C",5,"IT",4,4,"CE-IT-213","U21PC501IT","Software Engineering","FAC_VASU","M.Vasundhara")
        e("IT-3C",5,"IT",4,5,"CE-IT-213","U21OE611CE","Disaster Mitigation","FAC_GVS","Dr.GVS Subbaraya Sharma",batch="DM")
        e("IT-3C",5,"IT",4,5,"CE-IT-212","U21OE611EG","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar",batch="SS")
        e("IT-3C",5,"IT",4,5,"CE-IT-202","U21OE611ME","Operations Research","FAC_MKR","Dr.M.Kameshwar Reddy",batch="OR")
        e("IT-3C",5,"IT",4,6,"CE-IT-213","U21PC502IT","Data Mining","FAC_RAM","K.Ramya Madhavi")
        # SAT
        e("IT-3C",5,"IT",5,1,"CE-IT-213","U21PC505IT","Automata Theory","FAC_NIT","N.Nithya lakshmi")
        e("IT-3C",5,"IT",5,2,"CE-IT-213","U21PE621IT","Big Data Analytics","FAC_JSW","J.Sowjanya")
        e("IT-3C",5,"IT",5,3,"CE-IT-213","U21PC502IT","Data Mining","FAC_RAM","K.Ramya Madhavi")
        e("IT-3C",5,"IT",5,4,"CE-IT-213","U21PC503IT","Design and Analysis of Algorithms","FAC_USH","G.Ushasri")
        e("IT-3C",5,"IT",5,5,"CE-IT-213","U21PC504IT","Artificial Intelligence","FAC_SRI","K.Srilaxmi")
        e("IT-3C",5,"IT",5,6,"CE-IT-213","U21PC501IT","Software Engineering","FAC_VASU","M.Vasundhara")

        # ══════════════════════════════════════════════════════════════════════════
        # 7. BE IT-4A (Sem-VII, Rooms: 101, 102, 201, 202, 212, 213)
        # ══════════════════════════════════════════════════════════════════════════
        # MON
        e("IT-4A",7,"IT",0,1,"CE-IT-202","U21OE831CE","Road Safety Engineering","FAC_RAV","Dr.R.Ravi Kumar")
        e("IT-4A",7,"IT",0,2,"CE-IT-202","U21PC701IT","Internet of Things","FAC_SRU","Ch.Srujana")
        e("IT-4A",7,"IT",0,3,"CE-IT-202","U21PE864IT","Agile Software Engineering","FAC_MAN","A.Manasa")
        e("IT-4A",7,"IT",0,4,"CE-IT-104","COUNSELLING","Counselling","FAC_SOW","P.Sita Sowjanya")
        e("IT-4A",7,"IT",0,5,"CE-IT-102","U21PW781IT","Project Work-I","FAC_VAS","Dr.B.Vasavi")
        e("IT-4A",7,"IT",0,6,"CE-IT-102","U21PW781IT","Project Work-I","FAC_CSK","K.Chandra Sekhar")
        # TUE
        e("IT-4A",7,"IT",1,1,"CE-IT-18","U21PC781IT","IoT Lab","FAC_SRU","Ch.Srujana",batch="1")
        e("IT-4A",7,"IT",1,1,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_SAM","Dr.Ch.Samson",batch="2")
        e("IT-4A",7,"IT",1,2,"CE-IT-18","U21PC781IT","IoT Lab","FAC_SRU","Ch.Srujana",batch="1")
        e("IT-4A",7,"IT",1,2,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_SAM","Dr.Ch.Samson",batch="2")
        e("IT-4A",7,"IT",1,3,"CE-IT-102","U21PW781IT","Project Work-I","FAC_VAS","Dr.B.Vasavi")
        e("IT-4A",7,"IT",1,4,"CE-IT-102","U21PW781IT","Project Work-I","FAC_MAN","A.Manasa")
        e("IT-4A",7,"IT",1,5,"CE-IT-202","U21PE742IT","Cyber Security","FAC_DEV","K.Devaki")
        e("IT-4A",7,"IT",1,6,"CE-IT-202","U21PC701IT","Internet of Things","FAC_SRU","Ch.Srujana")
        # WED
        e("IT-4A",7,"IT",2,1,"CE-IT-212","U21PE754IT","Software Project Management","FAC_SWA","M.Swapna")
        e("IT-4A",7,"IT",2,2,"CE-IT-212","U21PC702IT","Network Security","FAC_SAM","Dr.Ch.Samson")
        e("IT-4A",7,"IT",2,3,"CE-IT-212","U21PW781IT","Project Work-I","FAC_SAM","Dr.Ch.Samson")
        e("IT-4A",7,"IT",2,4,"CE-IT-212","U21PW781IT","Project Work-I","FAC_VASU","M.Vasundhara")
        e("IT-4A",7,"IT",2,5,"CE-IT-212","U21PE742IT","Cyber Security","FAC_DEV","K.Devaki")
        e("IT-4A",7,"IT",2,6,"CE-IT-212","U21OE831CE","Road Safety Engineering","FAC_RAV","Dr.R.Ravi Kumar")
        # THU
        e("IT-4A",7,"IT",3,1,"CE-IT-18","U21PC781IT","IoT Lab","FAC_SRU","Ch.Srujana",batch="2")
        e("IT-4A",7,"IT",3,1,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_SAM","Dr.Ch.Samson",batch="1")
        e("IT-4A",7,"IT",3,2,"CE-IT-18","U21PC781IT","IoT Lab","FAC_SRU","Ch.Srujana",batch="2")
        e("IT-4A",7,"IT",3,2,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_SAM","Dr.Ch.Samson",batch="1")
        e("IT-4A",7,"IT",3,3,"CE-IT-201","U21PE754IT","Software Project Management","FAC_SWA","M.Swapna")
        e("IT-4A",7,"IT",3,4,"CE-IT-201","U21PE742IT","Cyber Security","FAC_DEV","K.Devaki")
        e("IT-4A",7,"IT",3,5,"CE-IT-101","U21PE864IT","Agile Software Engineering","FAC_MAN","A.Manasa")
        e("IT-4A",7,"IT",3,6,"CE-IT-101","U21PC702IT","Network Security","FAC_SAM","Dr.Ch.Samson")
        # FRI
        e("IT-4A",7,"IT",4,1,"CE-IT-213","U21OE831CE","Road Safety Engineering","FAC_RAV","Dr.R.Ravi Kumar")
        e("IT-4A",7,"IT",4,2,"CE-IT-213","U21PE864IT","Agile Software Engineering","FAC_MAN","A.Manasa")
        e("IT-4A",7,"IT",4,3,"CE-IT-212","U21PE754IT","Software Project Management","FAC_SWA","M.Swapna")
        e("IT-4A",7,"IT",4,4,"CE-IT-212","U21PC701IT","Internet of Things","FAC_SRU","Ch.Srujana")
        e("IT-4A",7,"IT",4,5,"CE-IT-201","U21PC702IT","Network Security","FAC_SAM","Dr.Ch.Samson")
        e("IT-4A",7,"IT",4,6,"CE-IT-201","U21PW782IT","Summer Internship-II Evaluation","FAC_SAM","Dr.Ch.Samson")

        # ══════════════════════════════════════════════════════════════════════════
        # 8. BE IT-4B (Sem-VII, Rooms: 203, 212, 213)
        # ══════════════════════════════════════════════════════════════════════════
        # MON
        e("IT-4B",7,"IT",0,1,"CE-IT-213","U21PE752IT","Block Chain Technology","FAC_KAR","P.Karthik")
        e("IT-4B",7,"IT",0,2,"CE-IT-213","U21PC702IT","Network Security","FAC_MUN","D.Muninder")
        e("IT-4B",7,"IT",0,3,"CE-IT-18","U21PC781IT","IoT Lab","FAC_VIJ","S.Ch. Vijaya Bhaskar",batch="1")
        e("IT-4B",7,"IT",0,3,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_MUN","D.Muninder",batch="2")
        e("IT-4B",7,"IT",0,4,"CE-IT-18","U21PC781IT","IoT Lab","FAC_VIJ","S.Ch. Vijaya Bhaskar",batch="1")
        e("IT-4B",7,"IT",0,4,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_MUN","D.Muninder",batch="2")
        e("IT-4B",7,"IT",0,5,"CE-IT-212","U21OE831CE","Road Safety Engineering","FAC_HAR","Mr.R.Haranath")
        e("IT-4B",7,"IT",0,6,"CE-IT-212","U21PC701IT","Internet of Things","FAC_VIJ","S.Ch. Vijaya Bhaskar")
        # TUE
        e("IT-4B",7,"IT",1,1,"CE-IT-212","U21PE742IT","Cyber Security","FAC_MBD","Maya B Dhone")
        e("IT-4B",7,"IT",1,2,"CE-IT-212","U21PC702IT","Network Security","FAC_MUN","D.Muninder")
        e("IT-4B",7,"IT",1,3,"CE-IT-212","U21PW781IT","Project Work-I","FAC_SOW","P.Sita Sowjanya")
        e("IT-4B",7,"IT",1,4,"CE-IT-212","U21PW781IT","Project Work-I","FAC_MUN","D.Muninder")
        e("IT-4B",7,"IT",1,5,"CE-IT-213","U21PE864IT","Agile Software Engineering","FAC_SOW","P.Sita Sowjanya")
        e("IT-4B",7,"IT",1,6,"CE-IT-213","COUNSELLING","Counselling","FAC_SRI","K.Srilaxmi")
        # WED
        e("IT-4B",7,"IT",2,1,"CE-IT-18","U21PC781IT","IoT Lab","FAC_VIJ","S.Ch. Vijaya Bhaskar",batch="2")
        e("IT-4B",7,"IT",2,1,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_MUN","D.Muninder",batch="1")
        e("IT-4B",7,"IT",2,2,"CE-IT-18","U21PC781IT","IoT Lab","FAC_VIJ","S.Ch. Vijaya Bhaskar",batch="2")
        e("IT-4B",7,"IT",2,2,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_MUN","D.Muninder",batch="1")
        e("IT-4B",7,"IT",2,3,"CE-IT-203","U21PE864IT","Agile Software Engineering","FAC_SOW","P.Sita Sowjanya")
        e("IT-4B",7,"IT",2,4,"CE-IT-203","U21OE831CE","Road Safety Engineering","FAC_HAR","Mr.R.Haranath")
        e("IT-4B",7,"IT",2,5,"CE-IT-203","U21PW781IT","Project Work-I","FAC_VIJ","S.Ch. Vijaya Bhaskar")
        e("IT-4B",7,"IT",2,6,"CE-IT-203","U21PW781IT","Project Work-I","FAC_VIJ","S.Ch. Vijaya Bhaskar")
        # THU
        e("IT-4B",7,"IT",3,1,"CE-IT-203","U21PC701IT","Internet of Things","FAC_VIJ","S.Ch. Vijaya Bhaskar")
        e("IT-4B",7,"IT",3,2,"CE-IT-203","U21PE752IT","Block Chain Technology","FAC_KAR","P.Karthik")
        e("IT-4B",7,"IT",3,3,"CE-IT-203","U21PW781IT","Project Work-I","FAC_KAR","P.Karthik")
        e("IT-4B",7,"IT",3,4,"CE-IT-203","U21PW781IT","Project Work-I","FAC_KAR","P.Karthik")
        e("IT-4B",7,"IT",3,5,"CE-IT-203","U21PE742IT","Cyber Security","FAC_MBD","Maya B Dhone")
        e("IT-4B",7,"IT",3,6,"CE-IT-203","U21OE831CE","Road Safety Engineering","FAC_HAR","Mr.R.Haranath")
        # FRI
        e("IT-4B",7,"IT",4,1,"CE-IT-203","U21PE864IT","Agile Software Engineering","FAC_SOW","P.Sita Sowjanya")
        e("IT-4B",7,"IT",4,2,"CE-IT-203","U21PE742IT","Cyber Security","FAC_MBD","Maya B Dhone")
        e("IT-4B",7,"IT",4,3,"CE-IT-203","U21PC701IT","Internet of Things","FAC_VIJ","S.Ch. Vijaya Bhaskar")
        e("IT-4B",7,"IT",4,4,"CE-IT-203","U21PE752IT","Block Chain Technology","FAC_KAR","P.Karthik")
        e("IT-4B",7,"IT",4,5,"CE-IT-203","U21PC702IT","Network Security","FAC_MUN","D.Muninder")
        e("IT-4B",7,"IT",4,6,"CE-IT-203","U21PW782IT","Summer Internship-II Evaluation","FAC_SOW","P.Sita Sowjanya")

        # ══════════════════════════════════════════════════════════════════════════
        # 9. BE IT-4C (Sem-VII, Rooms: 101, 202, 203, 212, 213)
        # ══════════════════════════════════════════════════════════════════════════
        # MON
        e("IT-4C",7,"IT",0,1,"CE-IT-203","U21PE742IT","Cyber Security","FAC_UGN","Dr.A.Ugendhar")
        e("IT-4C",7,"IT",0,2,"CE-IT-203","U21PC701IT","Internet of Things","FAC_RVS","Dr.DBV Ravi Sankar")
        e("IT-4C",7,"IT",0,3,"CE-IT-203","U21PW781IT","Project Work-I","FAC_UGN","Dr.A.Ugendhar")
        e("IT-4C",7,"IT",0,4,"CE-IT-203","U21PW781IT","Project Work-I","FAC_JSW","J.Sowjanya")
        e("IT-4C",7,"IT",0,5,"CE-IT-203","U21PE754IT","Software Project Management","FAC_SWA","M.Swapna")
        e("IT-4C",7,"IT",0,6,"CE-IT-203","U21PC702IT","Network Security","FAC_RAM","K.Ramya Madhavi")
        # TUE
        e("IT-4C",7,"IT",1,1,"CE-IT-203","U21OE831CE","Road Safety Engineering","FAC_SWA_CIV","Mrs.S.Swathi")
        e("IT-4C",7,"IT",1,2,"CE-IT-203","U21PE864IT","Agile Software Engineering","FAC_VASU","M.Vasundhara")
        e("IT-4C",7,"IT",1,3,"CE-IT-203","U21PE742IT","Cyber Security","FAC_UGN","Dr.A.Ugendhar")
        e("IT-4C",7,"IT",1,4,"CE-IT-203","U21PC702IT","Network Security","FAC_RAM","K.Ramya Madhavi")
        e("IT-4C",7,"IT",1,5,"CE-IT-203","U21PC701IT","Internet of Things","FAC_RVS","Dr.DBV Ravi Sankar")
        e("IT-4C",7,"IT",1,6,"CE-IT-203","U21PE754IT","Software Project Management","FAC_SWA","M.Swapna")
        # WED
        e("IT-4C",7,"IT",2,1,"CE-IT-213","U21PE742IT","Cyber Security","FAC_UGN","Dr.A.Ugendhar")
        e("IT-4C",7,"IT",2,2,"CE-IT-213","U21PC702IT","Network Security","FAC_RAM","K.Ramya Madhavi")
        e("IT-4C",7,"IT",2,3,"CE-IT-18","U21PC781IT","IoT Lab","FAC_RVS","Dr.DBV Ravi Sankar",batch="1")
        e("IT-4C",7,"IT",2,3,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_RAM","K.Ramya Madhavi",batch="2")
        e("IT-4C",7,"IT",2,4,"CE-IT-18","U21PC781IT","IoT Lab","FAC_RVS","Dr.DBV Ravi Sankar",batch="1")
        e("IT-4C",7,"IT",2,4,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_RAM","K.Ramya Madhavi",batch="2")
        e("IT-4C",7,"IT",2,5,"CE-IT-213","U21PW781IT","Project Work-I","FAC_SRI","K.Srilaxmi")
        e("IT-4C",7,"IT",2,6,"CE-IT-213","U21PW781IT","Project Work-I","FAC_JSW","J.Sowjanya")
        # THU
        e("IT-4C",7,"IT",3,1,"CE-IT-213","U21PE754IT","Software Project Management","FAC_SWA","M.Swapna")
        e("IT-4C",7,"IT",3,2,"CE-IT-213","U21PE864IT","Agile Software Engineering","FAC_VASU","M.Vasundhara")
        e("IT-4C",7,"IT",3,3,"CE-IT-213","U21PW782IT","Summer Internship-II Evaluation","FAC_UGN","Dr.A.Ugendhar")
        e("IT-4C",7,"IT",3,4,"CE-IT-213","U21OE831CE","Road Safety Engineering","FAC_SWA_CIV","Mrs.S.Swathi")
        e("IT-4C",7,"IT",3,5,"CE-IT-212","U21PW781IT","Project Work-I","FAC_SWA","M.Swapna")
        e("IT-4C",7,"IT",3,6,"CE-IT-212","U21PW781IT","Project Work-I","FAC_JSW","J.Sowjanya")
        # FRI
        e("IT-4C",7,"IT",4,1,"CE-IT-18","U21PC781IT","IoT Lab","FAC_RVS","Dr.DBV Ravi Sankar",batch="2")
        e("IT-4C",7,"IT",4,1,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_UGN","Dr.A.Ugendhar",batch="1")
        e("IT-4C",7,"IT",4,2,"CE-IT-18","U21PC781IT","IoT Lab","FAC_RVS","Dr.DBV Ravi Sankar",batch="2")
        e("IT-4C",7,"IT",4,2,"CE-IT-211","U21PC782IT","CN & NS Lab","FAC_UGN","Dr.A.Ugendhar",batch="1")
        e("IT-4C",7,"IT",4,3,"CE-IT-202","COUNSELLING","Counselling","FAC_KAR","P.Karthik")
        e("IT-4C",7,"IT",4,4,"CE-IT-202","U21PC701IT","Internet of Things","FAC_RVS","Dr.DBV Ravi Sankar")
        e("IT-4C",7,"IT",4,5,"CE-IT-101","U21OE831CE","Road Safety Engineering","FAC_SWA_CIV","Mrs.S.Swathi")
        e("IT-4C",7,"IT",4,6,"CE-IT-101","U21PE864IT","Agile Software Engineering","FAC_VASU","M.Vasundhara")

        # ══════════════════════════════════════════════════════════════════════════
        # 10. Civil Engineering Semester-III (Room: CE-206)
        # ══════════════════════════════════════════════════════════════════════════
        # MON
        e("Civil-3",3,"Civil",0,1,"SUR-LAB-CE","U25PC381CE","Surveying Lab","FAC_SWA_CIV","Mrs.S.Swathi",batch="G1")
        e("Civil-3",3,"Civil",0,1,"EG-LAB-CE","U25PC382CE","Engineering Geology Lab","FAC_PBK","Dr.P.Bharath Kumar",batch="G2")
        e("Civil-3",3,"Civil",0,2,"SUR-LAB-CE","U25PC381CE","Surveying Lab","FAC_SWA_CIV","Mrs.S.Swathi",batch="G1")
        e("Civil-3",3,"Civil",0,2,"EG-LAB-CE","U25PC382CE","Engineering Geology Lab","FAC_PBK","Dr.P.Bharath Kumar",batch="G2")
        e("Civil-3",3,"Civil",0,3,"CE-206","U25ES301CE","Civil Engineering Materials","FAC_SWA_CIV","Mrs.S.Swathi")
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
        # WED
        e("Civil-3",3,"Civil",2,1,"EG-LAB-CE","U25PC382CE","Engineering Geology Lab","FAC_PBK","Dr.P.Bharath Kumar",batch="G1")
        e("Civil-3",3,"Civil",2,1,"FM-LAB-CE","U25PC383CE","Fluid Mechanics Lab","FAC_KRS","Mr.K.Ravi Sekhar",batch="G2")
        e("Civil-3",3,"Civil",2,2,"EG-LAB-CE","U25PC382CE","Engineering Geology Lab","FAC_PBK","Dr.P.Bharath Kumar",batch="G1")
        e("Civil-3",3,"Civil",2,2,"FM-LAB-CE","U25PC383CE","Fluid Mechanics Lab","FAC_KRS","Mr.K.Ravi Sekhar",batch="G2")
        e("Civil-3",3,"Civil",2,3,"CE-206","U25PC301CE","Surveying and Geomatics","FAC_VSC","Dr. V. Shiva Chandra")
        e("Civil-3",3,"Civil",2,4,"CE-206","U25ES301CE","Civil Engineering Materials","FAC_SWA_CIV","Mrs.S.Swathi")
        e("Civil-3",3,"Civil",2,5,"CE-206","U25PC302CE","Engineering Geology","FAC_PBK","Dr.P.Bharath Kumar")
        e("Civil-3",3,"Civil",2,6,"CE-206","U25PC302CE","Engineering Geology","FAC_PBK","Dr.P.Bharath Kumar")
        # THU
        e("Civil-3",3,"Civil",3,1,"CE-206","U25BSNO3MT","Probability & Statistics","FAC_BHA","Dr. D. Bhagya")
        e("Civil-3",3,"Civil",3,2,"CE-206","U25BSNO3MT","Probability & Statistics","FAC_BHA","Dr. D. Bhagya")
        e("Civil-3",3,"Civil",3,3,"CE-206","U25PC301CE","Surveying and Geomatics","FAC_VSC","Dr. V. Shiva Chandra")
        e("Civil-3",3,"Civil",3,4,"CE-206","U25PC303CE","Fluid Mechanics","FAC_KRS","Mr.K.Ravi Sekhar")
        e("Civil-3",3,"Civil",3,5,"CE-206","U25ES302CE","Engineering Mechanics","FAC_CAK","Dr. C. Arvind Kumar")
        e("Civil-3",3,"Civil",3,6,"CE-206","COUNSELLING","Counselling","FAC_UDA","Dr. B. Udaysree")
        # FRI
        e("Civil-3",3,"Civil",4,1,"SUR-LAB-CE","U25PC381CE","Surveying Lab","FAC_SWA_CIV","Mrs.S.Swathi",batch="G2")
        e("Civil-3",3,"Civil",4,1,"FM-LAB-CE","U25PC383CE","Fluid Mechanics Lab","FAC_KRS","Mr.K.Ravi Sekhar",batch="G1")
        e("Civil-3",3,"Civil",4,2,"SUR-LAB-CE","U25PC381CE","Surveying Lab","FAC_SWA_CIV","Mrs.S.Swathi",batch="G2")
        e("Civil-3",3,"Civil",4,2,"FM-LAB-CE","U25PC383CE","Fluid Mechanics Lab","FAC_KRS","Mr.K.Ravi Sekhar",batch="G1")
        e("Civil-3",3,"Civil",4,3,"CE-206","U25PC301CE","Surveying and Geomatics","FAC_VSC","Dr. V. Shiva Chandra")
        e("Civil-3",3,"Civil",4,4,"CE-206","U25BSNO3MT","Probability & Statistics","FAC_BHA","Dr. D. Bhagya")
        e("Civil-3",3,"Civil",4,5,"CE-206","COUNSELLING","Counselling","FAC_UDA","Dr. B. Udaysree")
        e("Civil-3",3,"Civil",4,6,"CE-206","LIBRARY","Library Session","FAC_UDA","Dr. B. Udaysree")
        # SAT
        e("Civil-3",3,"Civil",5,1,"CE-IT-104","U25PC384CE","CACED Lab","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-3",3,"Civil",5,2,"CE-IT-104","U25PC384CE","CACED Lab","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-3",3,"Civil",5,3,"CE-206","U25PC303CE","Fluid Mechanics","FAC_KRS","Mr.K.Ravi Sekhar")
        e("Civil-3",3,"Civil",5,4,"CE-206","U25ES301CE","Civil Engineering Materials","FAC_SWA_CIV","Mrs.S.Swathi")
        e("Civil-3",3,"Civil",5,5,"CE-206","SPORTS","Sports / Fitness","FAC_UDA","Dr. B. Udaysree")
        e("Civil-3",3,"Civil",5,6,"CE-206","SPORTS","Sports / Fitness","FAC_UDA","Dr. B. Udaysree")

        # ══════════════════════════════════════════════════════════════════════════
        # 11. Civil Engineering Semester-V (Room: CE-205)
        # ══════════════════════════════════════════════════════════════════════════
        # MON
        e("Civil-5",5,"Civil",0,1,"CE-205","U21PC502CE","Transportation Engineering","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-5",5,"Civil",0,2,"CE-205","U21PC501CE","Foundation Engineering","FAC_SAN","Dr. R. Sandhya Rani")
        e("Civil-5",5,"Civil",0,3,"CE-205","U21PC505CE","Engineering Hydrology","FAC_KRS","Mr.K.Ravi Sekhar")
        e("Civil-5",5,"Civil",0,4,"CE-205","U21PC504CE","Structural Analysis-I","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-5",5,"Civil",0,5,"CE-205","U21PC506CE","Environmental Engineering","FAC_KSB","Dr. K. Sai Baba")
        e("Civil-5",5,"Civil",0,6,"CE-205","SSIP","Soft Skills","FAC_GNK","Dr.G.Nikhil Kumar")
        # TUE
        e("Civil-5",5,"Civil",1,1,"CE-205","U21PC501CE","Foundation Engineering","FAC_SAN","Dr. R. Sandhya Rani")
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
        e("Civil-5",5,"Civil",2,4,"CE-205","U21PC501CE","Foundation Engineering","FAC_SAN","Dr. R. Sandhya Rani")
        e("Civil-5",5,"Civil",2,5,"TE-LAB","U21PC581CE","Transportation Engineering Lab","FAC_SAN","Dr. R. Sandhya Rani",batch="G2")
        e("Civil-5",5,"Civil",2,5,"EE-LAB","U21PC582CE","Environmental Engineering Lab","FAC_KSB","Dr. K. Sai Baba",batch="G1")
        e("Civil-5",5,"Civil",2,6,"TE-LAB","U21PC581CE","Transportation Engineering Lab","FAC_SAN","Dr. R. Sandhya Rani",batch="G2")
        e("Civil-5",5,"Civil",2,6,"EE-LAB","U21PC582CE","Environmental Engineering Lab","FAC_KSB","Dr. K. Sai Baba",batch="G1")
        # THU
        e("Civil-5",5,"Civil",3,1,"CE-205","U21PC502CE","Transportation Engineering","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-5",5,"Civil",3,2,"CE-205","U21PC503CE","Design of RCC Structures-II","FAC_UDA","Dr. B. Udaysree")
        e("Civil-5",5,"Civil",3,3,"CE-205","U21PC502CE","Transportation Engineering","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-5",5,"Civil",3,4,"CE-205","U21PC506CE","Environmental Engineering","FAC_KSB","Dr. K. Sai Baba")
        e("Civil-5",5,"Civil",3,5,"CE-205","U21MCN01PY","Essence of Indian Traditional Knowledge","FAC_PRK","Mr. Prashanth Kuberkar")
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
        e("Civil-5",5,"Civil",5,3,"CE-205","U21PC501CE","Foundation Engineering","FAC_SAN","Dr. R. Sandhya Rani")
        e("Civil-5",5,"Civil",5,4,"CE-205","U21MCN01PY","Essence of Indian Traditional Knowledge","FAC_PRK","Mr. Prashanth Kuberkar")
        e("Civil-5",5,"Civil",5,5,"CE-205","U21PC505CE","Engineering Hydrology","FAC_KRS","Mr.K.Ravi Sekhar")
        e("Civil-5",5,"Civil",5,6,"CE-205","LIBRARY","Library Session","FAC_KRS","Mr.K.Ravi Sekhar")

        # ══════════════════════════════════════════════════════════════════════════
        # 12. Civil Engineering Semester-VII (Room: CE-204)
        # ══════════════════════════════════════════════════════════════════════════
        # MON
        e("Civil-7",7,"Civil",0,1,"CE-204","U21PC701CE","Estimation and Specifications","FAC_CAK","Dr. C. Arvind Kumar")
        e("Civil-7",7,"Civil",0,2,"CE-204","U21PC701CE","Estimation and Specifications","FAC_CAK","Dr. C. Arvind Kumar")
        e("Civil-7",7,"Civil",0,3,"CE-204","U21PE751CE","Transportation and Land Use Planning","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-7",7,"Civil",0,4,"CE-204","U21OE831ME","Material Handling","FAC_RHN","Mr. R. Hari Nath")
        e("Civil-7",7,"Civil",0,5,"CE-204","U21PE861CE","Construction Management & Administration","FAC_SAN","Dr. R. Sandhya Rani")
        e("Civil-7",7,"Civil",0,6,"CE-204","U21PE741CE","Disaster Mitigation and Management","FAC_VRU","Mrs. K. Vrushali")
        # TUE
        e("Civil-7",7,"Civil",1,1,"CE-204","U21PE871CE","Prestressed Concrete","FAC_UDA","Dr. B. Udaysree")
        e("Civil-7",7,"Civil",1,2,"CE-204","U21OE831ME","Material Handling","FAC_RHN","Mr. R. Hari Nath")
        e("Civil-7",7,"Civil",1,3,"CE-204","U21PE751CE","Transportation and Land Use Planning","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-7",7,"Civil",1,4,"CE-204","U21PE861CE","Construction Management & Administration","FAC_SAN","Dr. R. Sandhya Rani")
        e("Civil-7",7,"Civil",1,5,"CE-204","U21PE741CE","Disaster Mitigation and Management","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-7",7,"Civil",1,6,"CE-204","U21MCN01PO","Indian Constitution","FAC_PBH","Phanindra Bharadwaja")
        # WED
        e("Civil-7",7,"Civil",2,1,"CE-204","U21PE861CE","Construction Management & Administration","FAC_SAN","Dr. R. Sandhya Rani")
        e("Civil-7",7,"Civil",2,2,"CE-204","LIBRARY","Library Session","FAC_NAV","Mr. T. Naveen Kumar")
        e("Civil-7",7,"Civil",2,3,"CE-204","U21PC701CE","Estimation and Specifications","FAC_CAK","Dr. C. Arvind Kumar")
        e("Civil-7",7,"Civil",2,4,"CE-204","U21PE751CE","Transportation and Land Use Planning","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-7",7,"Civil",2,5,"CE-204","U21PE871CE","Prestressed Concrete","FAC_UDA","Dr. B. Udaysree")
        e("Civil-7",7,"Civil",2,6,"CE-204","LIBRARY","Library Session","FAC_NAV","Mr. T. Naveen Kumar")
        # THU
        e("Civil-7",7,"Civil",3,1,"CSE-LAB-IV","U21PC781CE","Civil Engineering Programming Lab","FAC_SWA_CIV","Mrs.S.Swathi")
        e("Civil-7",7,"Civil",3,2,"CSE-LAB-IV","U21PC781CE","Civil Engineering Programming Lab","FAC_SWA_CIV","Mrs.S.Swathi")
        e("Civil-7",7,"Civil",3,3,"CE-204","U21MCN01PO","Indian Constitution","FAC_PBH","Phanindra Bharadwaja")
        e("Civil-7",7,"Civil",3,4,"CE-204","U21PC701CE","Estimation and Specifications","FAC_CAK","Dr. C. Arvind Kumar")
        e("Civil-7",7,"Civil",3,5,"CE-204","U21PE871CE","Prestressed Concrete","FAC_UDA","Dr. B. Udaysree")
        e("Civil-7",7,"Civil",3,6,"CE-204","SPORTS","Sports / Fitness","FAC_NAV","Mr. T. Naveen Kumar")
        # FRI
        e("Civil-7",7,"Civil",4,1,"CE-204","U21PE871CE","Prestressed Concrete","FAC_UDA","Dr. B. Udaysree")
        e("Civil-7",7,"Civil",4,2,"CE-204","U21PE861CE","Construction Management & Administration","FAC_SAN","Dr. R. Sandhya Rani")
        e("Civil-7",7,"Civil",4,3,"CE-204","U21PE741CE","Disaster Mitigation and Management","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-7",7,"Civil",4,4,"CE-204","U21PE751CE","Transportation and Land Use Planning","FAC_GNG","Dr. G. Narendra Goud")
        e("Civil-7",7,"Civil",4,5,"CE-204","U21PE741CE","Disaster Mitigation and Management","FAC_VRU","Mrs. K. Vrushali")
        e("Civil-7",7,"Civil",4,6,"CE-204","U21OE831ME","Material Handling","FAC_RHN","Mr. R. Hari Nath")
        # SAT
        for p in range(1,7):
            e("Civil-7",7,"Civil",5,p,"CE-204","U21PW782CE","Project work - I","FAC_NAV","Mr. T. Naveen Kumar")

        db.commit()
        total_e = db.query(TimetableEntryModel).count()
        print(f"✅ Successfully seeded {total_e} timetable entries across 12 sections and 28 campus locations!")

    except Exception as exc:
        db.rollback()
        print("❌ Error seeding timetable database:", exc)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_all()

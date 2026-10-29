"""
The accreditation frameworks as data: every NAAC metric (Revised Accreditation Framework, autonomous colleges) and
every NBA criterion (Self Assessment Report, UG Engineering, Tier-I), with what each needs: years of data, the unit,
the evidence the peer team asks for, and the live CampusSphere metric that fills it (if any).

NAAC and NBA revise their manuals (NAAC announced binary accreditation and maturity-based levels in 2024; NBA
revises its SAR formats). VERSION says which manuals this follows: the IQAC should confirm them against the
official manuals for MVSR's next cycle, and this file is the one place to change.

  kind    QnM: quantitative, checked by DVV against documents (NAAC ~70% of the score)
          QlM: qualitative, judged by the peer team from the write-up and the visit
  unit    pct | count | ratio | days | lakh (rupees, lakh) | options (A-E) | text | yes_no
  level   institution | programme (NBA is always per programme)
  live    id of the metric in metrics.METRICS that computes the current year's value from CampusSphere's records
"""
NAAC_VERSION = "NAAC Revised Accreditation Framework · Autonomous Colleges (verify against the current manual)"
NBA_VERSION = "NBA Self Assessment Report · UG Engineering, Tier-I (verify against the current SAR format)"

NAAC_YEARS = 5      # the assessment period: the last five completed academic years
NBA_YEARS = 3       # CAY, CAYm1, CAYm2 (some criteria use graduating batches LYG, LYGm1, LYGm2)


def _m(code, title, kind="QnM", unit="pct", evidence=(), live=None, years=None, level="institution"):
    return {"code": code, "title": title, "kind": kind, "unit": unit, "evidence": list(evidence), "live": live,
            "years": years, "level": level}


DOCS_POLICY = "Policy document and minutes approving it"
DOCS_LIST = "List in the NAAC data template, year-wise"

NAAC_CRITERIA = [
    ("1", "Curricular Aspects", 150),
    ("2", "Teaching-Learning and Evaluation", 300),
    ("3", "Research, Innovations and Extension", 150),
    ("4", "Infrastructure and Learning Resources", 100),
    ("5", "Student Support and Progression", 100),
    ("6", "Governance, Leadership and Management", 100),
    ("7", "Institutional Values and Best Practices", 100),
]

NAAC_EXTENDED_PROFILE = [
    _m("EP1.1", "Programmes offered", unit="count", evidence=["Programme list approved by the Academic Council"]),
    _m("EP2.1", "Students enrolled (all years)", unit="count", evidence=["Year-wise enrolled-students list"], live="enrolment"),
    _m("EP2.2", "Outgoing / final-year students", unit="count", evidence=["Final-year students list"]),
    _m("EP2.3", "Students appeared in the university / autonomous examinations", unit="count", evidence=["Exam Cell certificate"]),
    _m("EP3.1", "Full-time teachers", unit="count", evidence=["Faculty list with appointment letters"], live="sfr"),
    _m("EP3.2", "Sanctioned posts", unit="count", evidence=["Sanction letters from the management / affiliating university"]),
    _m("EP4.1", "Classrooms and seminar halls", unit="count", evidence=["Room list"], live="facilities"),
    _m("EP4.2", "Total expenditure excluding salary (₹ lakh)", unit="lakh", evidence=["Audited statements of accounts"], live="library"),
    _m("EP4.3", "Computers for academic use", unit="count", evidence=["Stock register extract"], live="library"),
]

NAAC_METRICS = [
    # ── Criterion 1 ──
    _m("1.1.1", "Curricula relevant to local, national, regional and global needs", "QlM", "text", ["Curriculum documents", "BoS minutes"]),
    _m("1.1.2", "Programmes where syllabus revision was carried out", unit="pct", evidence=["BoS and Academic Council minutes"]),
    _m("1.1.3", "Courses focusing on employability / entrepreneurship / skill development", unit="pct",
       evidence=["Course list with syllabi highlighting the focus"], live="curriculum"),
    _m("1.2.1", "New courses introduced", unit="count", evidence=["Academic Council minutes", "Course list"]),
    _m("1.2.2", "Programmes with Choice Based Credit System / electives", unit="pct", evidence=["Academic Council minutes", "Scheme of instruction"]),
    _m("1.3.1", "Cross-cutting issues (gender, environment, ethics) in the curriculum", "QlM", "text", ["Course list and syllabi"]),
    _m("1.3.2", "Value-added courses offered", unit="count", evidence=["Brochure, attendance and certificates per course"]),
    _m("1.3.3", "Students enrolled in value-added courses", unit="pct", evidence=["Enrolment list per course"]),
    _m("1.3.4", "Students doing field projects / internships", unit="pct", evidence=["Internship letters and completion certificates"], live="placement"),
    _m("1.4.1", "Structured feedback on the syllabus from students, teachers, employers, alumni", unit="options",
       evidence=["Sample filled forms", "Feedback analysis", "Action-taken report"], live="feedback"),
    _m("1.4.2", "Feedback processes: collected, analysed, acted upon and published", unit="options",
       evidence=["Feedback analysis and action-taken report on the website"], live="feedback"),
    # ── Criterion 2 ──
    _m("2.1.1", "Enrolment against sanctioned intake", unit="pct", evidence=["Sanctioned intake (AICTE approval)", "Admitted-students list"], live="enrolment"),
    _m("2.1.2", "Seats filled against reserved categories", unit="pct", evidence=["Reservation policy (state government)", "Category-wise admissions"]),
    _m("2.2.1", "Learning levels assessed; programmes for slow and advanced learners", "QlM", "text", ["Remedial and advanced programme records"]),
    _m("2.2.2", "Student – full-time teacher ratio", unit="ratio", evidence=["Student and teacher lists"], live="sfr"),
    _m("2.3.1", "Student-centric methods (experiential, participative, problem solving)", "QlM", "text", ["Course files, lesson plans"]),
    _m("2.3.2", "ICT-enabled tools used for teaching", "QlM", "text", ["Room ICT list, LMS usage"], live="ict"),
    _m("2.3.3", "Mentor to students ratio", unit="ratio", evidence=["Mentor allocation list", "Mentoring records"], live="mentoring"),
    _m("2.4.1", "Full-time teachers against sanctioned posts", unit="pct", evidence=["Sanction letters", "Appointment letters"], live="cadre"),
    _m("2.4.2", "Full-time teachers with PhD / NET / SET / SLET", unit="pct", evidence=["Degree certificates"], live="faculty_quality"),
    _m("2.4.3", "Average teaching experience of full-time teachers (years)", unit="count", evidence=["Experience certificates"], live="faculty_quality"),
    _m("2.5.1", "Days from the last semester-end exam to the declaration of results", unit="days", evidence=["Exam timetables", "Result notifications"], live="results"),
    _m("2.5.2", "Student complaints / grievances about evaluation", unit="pct", evidence=["Grievance register and resolution"], live="results"),
    _m("2.5.3", "IT integration and reforms in the examination procedures", "QlM", "text", ["Exam Cell process document"]),
    _m("2.5.4", "Automation of the examination division", unit="options", evidence=["Exam management system screenshots, contract"]),
    _m("2.6.1", "Programme and course outcomes stated and communicated", "QlM", "text", ["POs and COs on the website and in course files"]),
    _m("2.6.2", "Attainment of programme and course outcomes evaluated", "QlM", "text", ["CO-PO attainment sheets"], live="outcomes"),
    _m("2.6.3", "Pass percentage of students", unit="pct", evidence=["Result analysis per programme"], live="results"),
    _m("2.7.1", "Student Satisfaction Survey (conducted by NAAC)", "QnM", "text", ["NAAC's online survey"], years=1, live="feedback"),
    # ── Criterion 3 ──
    _m("3.1.1", "Grants for research projects from government and non-government agencies (₹ lakh)", unit="lakh",
       evidence=["Sanction letters", "Utilisation certificates"], live="research"),
    _m("3.1.2", "Teachers recognised as research guides", unit="pct", evidence=["Recognition letters from the university"], live="faculty_quality"),
    _m("3.1.3", "Teachers with research projects", unit="pct", evidence=["Sanction letters"], live="research"),
    _m("3.2.1", "Ecosystem for innovation, incubation and IPR", "QlM", "text", ["Incubation centre records, startup list"]),
    _m("3.2.2", "Workshops / seminars on research methodology, IPR and entrepreneurship", unit="count", evidence=["Reports with photos and attendance"], live="extension"),
    _m("3.3.1", "PhDs awarded per recognised guide", unit="ratio", evidence=["PhD award notifications"]),
    _m("3.3.2", "Research papers in UGC-CARE / indexed journals per teacher", unit="ratio", evidence=["First page of each paper with the journal's indexing"], live="research"),
    _m("3.3.3", "Books, chapters and conference papers per teacher", unit="ratio", evidence=["Cover page and ISBN"], live="research"),
    _m("3.4.1", "Extension activities in the neighbourhood community", "QlM", "text", ["Activity reports"]),
    _m("3.4.2", "Awards for extension activities", unit="count", evidence=["Award certificates"]),
    _m("3.4.3", "Extension and outreach programmes (NSS, NCC, Swachh Bharat...)", unit="count", evidence=["Reports with photos and attendance"], live="extension"),
    _m("3.5.1", "Collaborative activities: research, faculty exchange, internships, on-the-job training", unit="count", evidence=["Collaboration documents"], live="extension"),
    _m("3.5.2", "Functional MoUs with institutions and industries", unit="count", evidence=["Signed MoUs and activity under each"], live="extension"),
    # ── Criterion 4 ──
    _m("4.1.1", "Adequate classrooms, laboratories, sports and cultural facilities", "QlM", "text", ["Room list, lab list, photos"], live="facilities"),
    _m("4.1.2", "Expenditure on infrastructure augmentation, excluding salary", unit="pct", evidence=["Audited statements, highlighted"], live="library"),
    _m("4.2.1", "Library automated with an integrated library management system", "QlM", "text", ["ILMS licence, screenshots"], live="library"),
    _m("4.2.2", "Subscription to e-resources (e-journals, e-books, Shodhganga, databases)", unit="options", evidence=["Subscription receipts"], live="library"),
    _m("4.2.3", "Expenditure on books and journals (₹ lakh)", unit="lakh", evidence=["Audited statements"], live="library"),
    _m("4.2.4", "Library usage per day by teachers and students", unit="pct", evidence=["Library footfall register"], live="library"),
    _m("4.3.1", "IT facilities, Wi-Fi and their regular update", "QlM", "text", ["IT policy, upgrade invoices"], live="ict"),
    _m("4.3.2", "Student – computer ratio", unit="ratio", evidence=["Stock register"], live="library"),
    _m("4.3.3", "Internet bandwidth", unit="options", evidence=["ISP bills"], live="library"),
    _m("4.4.1", "Expenditure on maintenance of physical and academic facilities", unit="pct", evidence=["Audited statements"], live="library"),
    # ── Criterion 5 ──
    _m("5.1.1", "Students benefited by scholarships and freeships", unit="pct", evidence=["Sanction letters, beneficiary lists"], live="scholarships"),
    _m("5.1.2", "Capacity building: soft skills, language, life skills, ICT", unit="options", evidence=["Programme reports"]),
    _m("5.1.3", "Students benefited by career counselling and competitive-exam guidance", unit="pct", evidence=["Attendance lists"]),
    _m("5.1.4", "Grievance redressal including sexual harassment and ragging", unit="options", evidence=["Committee orders, minutes, cases handled"], live="turnaround"),
    _m("5.2.1", "Outgoing students placed", unit="pct", evidence=["Offer letters", "Placement list"], live="placement"),
    _m("5.2.2", "Outgoing students progressing to higher education", unit="pct", evidence=["Admission letters / ID cards"], live="activities"),
    _m("5.2.3", "Students qualifying in state / national / international exams (GATE, GRE, CAT...)", unit="pct", evidence=["Score cards"], live="activities"),
    _m("5.3.1", "Awards / medals for sports and cultural activities", unit="count", evidence=["Certificates"], live="activities"),
    _m("5.3.2", "Student council and student representation on bodies", "QlM", "text", ["Council constitution and minutes"]),
    _m("5.3.3", "Sports and cultural events organised", unit="count", evidence=["Event reports"], live="activities"),
    _m("5.4.1", "Alumni association contribution", "QlM", "text", ["Alumni association registration, activities"]),
    _m("5.4.2", "Alumni contribution (₹ lakh)", unit="options", evidence=["Receipts"], live="activities"),
    # ── Criterion 6 ──
    _m("6.1.1", "Governance reflecting the vision and mission", "QlM", "text", ["Vision, mission, perspective plan"]),
    _m("6.1.2", "Decentralisation and participative management", "QlM", "text", ["Committee structure, minutes"], live="governance"),
    _m("6.2.1", "Strategic / perspective plan deployed", "QlM", "text", ["Perspective plan and its review"]),
    _m("6.2.2", "E-governance in administration, finance, admissions, examinations", unit="options",
       evidence=["ERP documentation, screenshots, invoices"], live="egov"),
    _m("6.2.3", "Functioning of institutional bodies (policies, minutes)", "QlM", "text", ["Minutes of GB, AC, BoS, Finance Committee"], live="governance"),
    _m("6.3.1", "Welfare measures for teaching and non-teaching staff", "QlM", "text", ["Policy documents"]),
    _m("6.3.2", "Teachers given financial support for conferences and professional bodies", unit="pct", evidence=["Sanction letters, receipts"]),
    _m("6.3.3", "Professional development / administrative training programmes organised", unit="count", evidence=["Reports and attendance"], live="research"),
    _m("6.3.4", "Teachers attending FDPs, refresher and orientation courses", unit="pct", evidence=["Certificates"], live="research"),
    _m("6.4.1", "Internal and external financial audits", "QlM", "text", ["Audit reports"]),
    _m("6.4.2", "Funds / grants from non-government bodies and philanthropists (₹ lakh)", unit="lakh", evidence=["Receipts, audited statements"]),
    _m("6.5.1", "IQAC institutionalising quality assurance", "QlM", "text", ["IQAC minutes and initiatives"], live="governance"),
    _m("6.5.2", "Review of teaching-learning through IQAC", "QlM", "text", ["Academic audit reports"], live="turnaround"),
    _m("6.5.3", "Quality assurance initiatives (AQARs, audits, NIRF, ISO...)", unit="options", evidence=["AQAR uploads, NIRF data, certificates"]),
    # ── Criterion 7 ──
    _m("7.1.1", "Gender equity: programmes and facilities", "QlM", "text", ["Gender audit, programme reports"], live="green"),
    _m("7.1.2", "Alternate energy and energy conservation", unit="options", evidence=["Solar installation invoices, photos"], live="green"),
    _m("7.1.3", "Waste management (solid, liquid, e-waste, hazardous)", "QlM", "text", ["Agreements, photos"], live="green"),
    _m("7.1.4", "Water conservation (rainwater harvesting, recharge, reuse)", unit="options", evidence=["Photos, geo-tagged"], live="green"),
    _m("7.1.5", "Green campus initiatives", unit="options", evidence=["Policy, photos"], live="green"),
    _m("7.1.6", "Green, energy and environment audits", unit="options", evidence=["Audit reports"], live="green"),
    _m("7.1.7", "Disabled-friendly, barrier-free environment", unit="options", evidence=["Photos, facility list"]),
    _m("7.1.8", "Inclusive environment: tolerance and harmony", "QlM", "text", ["Activity reports"]),
    _m("7.1.9", "Sensitisation to constitutional obligations", "QlM", "text", ["Activity reports"]),
    _m("7.1.10", "Code of conduct for students, teachers, administrators", unit="options", evidence=["Code of conduct on the website"]),
    _m("7.1.11", "National and international commemorative days and festivals", "QlM", "text", ["Reports with photos"]),
    _m("7.2.1", "Two best practices", "QlM", "text", ["Best practice write-ups in NAAC format"]),
    _m("7.3.1", "Institutional distinctiveness", "QlM", "text", ["Write-up"]),
]

NBA_CRITERIA = [
    ("1", "Vision, Mission and Programme Educational Objectives", 60),
    ("2", "Programme Curriculum and Teaching-Learning Processes", 120),
    ("3", "Course Outcomes and Programme Outcomes", 120),
    ("4", "Students' Performance", 150),
    ("5", "Faculty Information and Contributions", 200),
    ("6", "Facilities and Technical Support", 80),
    ("7", "Continuous Improvement", 50),
    ("8", "First Year Academics", 50),
    ("9", "Student Support Systems", 50),
    ("10", "Governance, Institutional Support and Financial Resources", 120),
]

P = "programme"
NBA_METRICS = [
    _m("1.1", "Vision and mission of the department", "QlM", "text", ["Vision and mission, where displayed"], level=P),
    _m("1.2", "Programme Educational Objectives (PEOs)", "QlM", "text", ["PEO statements"], level=P),
    _m("1.3", "Dissemination of vision, mission and PEOs", "QlM", "text", ["Website, notice boards, curriculum book"], level=P),
    _m("1.4", "Process for defining vision, mission and PEOs", "QlM", "text", ["DAB / PAC minutes"], live="governance", level=P),
    _m("1.5", "Consistency of PEOs with the mission", "QlM", "text", ["PEO-mission mapping"], level=P),
    _m("2.1", "Programme curriculum: structure, gaps, delivery of content beyond the syllabus", "QlM", "text",
       ["Curriculum, gap analysis, BoS minutes"], live="curriculum", level=P),
    _m("2.2", "Teaching-learning processes: quality of tests, assignments, projects, industry interaction", "QlM", "text",
       ["Course files, project reports, industry visit reports"], live="continuity", level=P),
    _m("3.1", "Course outcomes, CO-PO and CO-PSO mapping", "QlM", "text", ["CO statements, mapping matrices"], live="outcomes", level=P),
    _m("3.2", "Attainment of course outcomes (direct and indirect)", unit="pct", evidence=["Assessment-wise CO attainment sheets"], live="outcomes", level=P),
    _m("3.3", "Attainment of programme outcomes and programme-specific outcomes", unit="pct", evidence=["PO attainment sheets, exit surveys"], live="outcomes", level=P),
    _m("4.1", "Enrolment ratio", unit="pct", evidence=["Sanctioned intake, admissions"], live="enrolment", level=P),
    _m("4.2", "Success rate in the stipulated period (with and without backlogs)", unit="pct", evidence=["Batch-wise results"], live="results", level=P),
    _m("4.3", "Academic performance in the third year", unit="ratio", evidence=["Result analysis"], live="results", level=P),
    _m("4.4", "Academic performance in the second year", unit="ratio", evidence=["Result analysis"], live="results", level=P),
    _m("4.5", "Placement, higher studies and entrepreneurship", unit="pct", evidence=["Offer letters, admission letters, startup proof"], live="placement", level=P),
    _m("4.6", "Professional activities: chapters, events, publications, participation", unit="count", evidence=["Event reports"], live="activities", level=P),
    _m("5.1", "Student-Faculty Ratio (SFR)", unit="ratio", evidence=["Student and faculty lists"], live="sfr", level=P),
    _m("5.2", "Faculty Cadre Proportion", unit="ratio", evidence=["Appointment letters"], live="cadre", level=P),
    _m("5.3", "Faculty qualification (PhD / M.Tech)", unit="ratio", evidence=["Degree certificates"], live="faculty_quality", level=P),
    _m("5.4", "Faculty retention", unit="pct", evidence=["Joining and relieving records"], live="faculty_quality", level=P),
    _m("5.5", "Innovations by the faculty in teaching and learning", "QlM", "text", ["Material, peer review"], level=P),
    _m("5.6", "Faculty as participants / resource persons in FDPs and STTPs", unit="count", evidence=["Certificates"], live="research", level=P),
    _m("5.7", "Research and development: publications, PhDs, sponsored research, consultancy", unit="count",
       evidence=["Papers, sanction letters"], live="research", level=P),
    _m("5.8", "Faculty performance appraisal and development system", "QlM", "text", ["Appraisal policy and records"], live="load", level=P),
    _m("5.9", "Visiting / adjunct / emeritus faculty", unit="count", evidence=["Appointment orders, session records"], level=P),
    _m("6.1", "Adequate and well-equipped laboratories and technical manpower", "QlM", "text", ["Lab list, equipment, staff"], live="facilities", level=P),
    _m("6.2", "Additional facilities created to improve quality of learning", "QlM", "text", ["Facility list"], live="ict", level=P),
    _m("6.3", "Maintenance of laboratories and overall ambience", "QlM", "text", ["Maintenance registers"], live="utilisation", level=P),
    _m("6.4", "Project laboratory", "QlM", "text", ["Project lab records"], level=P),
    _m("6.5", "Safety measures in laboratories", "QlM", "text", ["Safety signage, extinguishers, photos"], level=P),
    _m("7.1", "Actions taken on the results of PO evaluation", "QlM", "text", ["PO gap action reports"], live="feedback", level=P),
    _m("7.2", "Academic audit and actions taken", "QlM", "text", ["Audit reports"], live="governance", level=P),
    _m("7.3", "Improvement in placement, higher studies and entrepreneurship", unit="pct", evidence=["Trend over three years"], live="placement", level=P),
    _m("7.4", "Improvement in the quality of students admitted", unit="ratio", evidence=["Admission ranks over three years"], level=P),
    _m("8.1", "First-year Student-Faculty Ratio", unit="ratio", evidence=["First-year lists"], live="sfr", level=P),
    _m("8.2", "Qualification of faculty teaching first-year courses", unit="ratio", evidence=["Degree certificates"], level=P),
    _m("8.3", "First-year academic performance", unit="ratio", evidence=["Result analysis"], level=P),
    _m("8.4", "Attainment of COs of first-year courses", unit="pct", evidence=["CO attainment sheets"], level=P),
    _m("8.5", "Attainment of POs from first-year courses", unit="pct", evidence=["PO attainment sheets"], level=P),
    _m("9.1", "Mentoring system for students", "QlM", "text", ["Mentor allocation, meeting records"], live="mentoring", level=P),
    _m("9.2", "Feedback analysis and reward / corrective measures", "QlM", "text", ["Feedback analysis, action taken"], live="feedback", level=P),
    _m("9.3", "Feedback on facilities", "QlM", "text", ["Feedback forms and analysis"], live="feedback", level=P),
    _m("9.4", "Self-learning (NPTEL, MOOCs)", "QlM", "text", ["Course certificates"], level=P),
    _m("9.5", "Career guidance, training and placement", "QlM", "text", ["Placement cell records"], live="placement", level=P),
    _m("9.6", "Entrepreneurship cell", "QlM", "text", ["E-cell activities"], level=P),
    _m("9.7", "Co-curricular and extra-curricular activities", "QlM", "text", ["Event reports"], live="activities", level=P),
    _m("10.1", "Organisation, governance and transparency", "QlM", "text", ["Organisation chart, service rules, website"], live="governance", level=P),
    _m("10.2", "Budget allocation, utilisation and public accounting (institution)", unit="lakh", evidence=["Audited statements"], live="library", level=P),
    _m("10.3", "Programme-specific budget allocation and utilisation", unit="lakh", evidence=["Budget statements"], live="library", level=P),
    _m("10.4", "Library and internet", "QlM", "text", ["Library holdings, e-resources, bandwidth"], live="library", level=P),
]

FRAMEWORKS = {
    "naac": {"version": NAAC_VERSION, "years": NAAC_YEARS, "criteria": NAAC_CRITERIA, "metrics": NAAC_METRICS,
             "profile": NAAC_EXTENDED_PROFILE},
    "nba": {"version": NBA_VERSION, "years": NBA_YEARS, "criteria": NBA_CRITERIA, "metrics": NBA_METRICS, "profile": []},
}


def criterion_of(code: str) -> str:
    """'2.6.3' -> '2'; Extended Profile codes ('EP2.1') -> 'EP'."""
    return "EP" if code.startswith("EP") else code.split(".")[0]


def metric(framework: str, code: str):
    fw = FRAMEWORKS[framework]
    return next((m for m in fw["metrics"] + fw["profile"] if m["code"] == code), None)


def years_for(framework: str, m: dict) -> int:
    return m.get("years") or FRAMEWORKS[framework]["years"]


def academic_years(n: int, current: str) -> list:
    """The year in progress (`current`, "2026-27") and the n completed years before it, newest first. NAAC's
    assessment period is the completed years; the year in progress shows what CampusSphere records live."""
    start = int(current[:4])
    return [f"{y}-{(y + 1) % 100:02d}" for y in range(start, start - n - 1, -1)]

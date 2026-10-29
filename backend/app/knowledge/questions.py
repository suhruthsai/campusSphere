"""
The questions people ask about MVSR Engineering College, by audience. Written from research into what
parents, students, visitors and staff commonly ask (public Q&A threads and admission forums, read only,
not copied) and grounded in the sections of the official website. Answers always come from the crawled
official pages, never from here.

Each entry: (question, words the right page should contain), or None when the website has no answer (Mitra
should say so). The evaluation (tests/eval_knowledge.py) checks that search finds a passage containing one of
those words for every question; Mitra's panel uses
the questions as suggestions. Questions people ask Mitra are logged (kb_asked) to grow this list.
"""

QUESTIONS = {
    "parents": [
        ("What is the fee structure for B.E. courses?", ["fee structure", "tuition"]),
        ("How do I pay the college fees online?", ["online payment", "pay fee", "payment"]),
        ("Is fee reimbursement available under TS ePASS?", ["scholarship", "epass", "reimbursement"]),
        ("What scholarships can my child get?", ["scholarship"]),
        ("Is there a hostel for girls on campus?", ["hostel"]),
        ("Who do I contact about the hostel?", ["hostel"]),
        ("Does the college provide bus transport, and on which routes?", ["transport", "bus"]),
        ("How are the placements at MVSR?", ["placement"]),
        ("Which companies come for campus placements?", ["compan", "recruit", "placement"]),
        ("Is the college affiliated to Osmania University?", ["osmania"]),
        ("Is MVSR an autonomous college?", ["autonomous"]),
        ("Is the college accredited by NBA or NAAC?", ["nba", "naac", "accredit"]),
        ("What is the college's NIRF ranking?", ["nirf"]),
        ("Is the campus safe? Is there an anti-ragging committee?", ["ragging"]),
        ("Is there a women protection or grievance cell?", ["women", "grievance"]),
        ("What is the refund policy if we cancel admission?", ["refund", "cancellation"]),
        ("How do I contact the principal?", ["principal"]),
        ("What is the college's phone number and email?", ["contact", "phone", "email"]),
        ("Is there medical or health care support on campus?", ["health", "medical"]),
        ("What food is available in the canteen?", ["canteen"]),
        ("What are the attendance rules for students?", ["attendance"]),
        ("Who founded the college and who runs it?", ["founder", "society", "matrusri"]),
    ],
    "students": [
        ("Where can I find the syllabus for my branch?", ["syllabus"]),
        ("Where is the academic calendar?", ["academic calendar", "almanac"]),
        ("Where can I get previous question papers?", ["question paper"]),
        ("When is the B.E. exam time table released?", ["time table", "timetable", "exam"]),
        ("How do I apply for revaluation or a photocopy of my answer script?", ["revaluation", "r.v", "photocopy"]),
        ("What is the supplementary exam fee?", ["supple", "fee notification"]),
        ("Who is the Controller of Examinations?", ["exam branch", "controller"]),
        ("How do I get internships through the college?", ["internship"]),
        ("What training does the placement cell give?", ["training", "placement"]),
        ("Which student clubs can I join?", ["club"]),
        ("Does the college have NCC and NSS?", ["ncc", "nss"]),
        ("What is SAE BAJA at MVSR?", ["baja"]),
        ("What are the library timings and e-resources?", ["library", "e-resources"]),
        ("Is there a computer centre for students?", ["computer cent"]),
        ("What sports facilities are there?", ["sports", "physical education", "games"]),
        ("How do I apply for a scholarship?", ["scholarship"]),
        ("Where is the faculty list of my department?", ["faculty"]),
        ("Where can I check my attendance?", ["attendance"]),
        ("What are the B.E. rules and regulations?", ["rules", "regulation"]),
        ("Does the college have an entrepreneurship or innovation cell?", ["iic", "entrepreneur", "edc", "innovation"]),
        ("What university ranks have MVSR students got?", ["rank"]),
        ("What industry training programmes are there?", ["industry"]),
        ("Can I do a minor degree?", ["minor"]),
    ],
    "visitors": [
        ("Where is MVSR Engineering College located?", ["nadergul", "address"]),
        ("How do I reach the campus?", ["nadergul", "address", "contact", "transport"]),
        ("Which courses does MVSR offer?", ["b.e", "m.e", "mba", "courses"]),
        ("Which departments are there?", ["department", "civil", "mechanical"]),
        ("When was the college established?", ["1981", "established"]),
        ("Who is the chairman of the college?", ["chairman"]),
        ("Who is the principal?", ["principal"]),
        ("What facilities are available on campus?", ["facilities"]),
        ("Does the college offer an MBA?", ["mba"]),
        ("How do I get admission to M.E. or M.Tech?", ["pg admission", "m.e", "m.tech", "pgecet"]),
        ("How do I get admission to B.E.?", ["ug admission", "eapcet", "admission"]),
        ("What are the eligibility conditions for admission?", ["eligibility"]),
        ("Is there a college video or virtual tour?", ["video"]),
        ("What research and development work happens here?", ["r & d", "research"]),
        ("Which MoUs has the college signed?", ["mou"]),
        ("How do alumni stay connected with the college?", ["alumni"]),
        ("Is there a bank or ATM on campus?", ["bank", "atm"]),
    ],
    "administration": [
        ("Where are the AICTE mandatory disclosures?", ["aicte", "mandatory disclosure"]),
        ("What is the AICTE permanent ID of the college?", ["aicte permanent", "aicte"]),
        ("What does the IQAC do?", ["iqac", "quality assurance"]),
        ("Where is the NIRF data submitted by the college?", ["nirf"]),
        ("Which programmes are NBA accredited and until when?", ["nba", "validity"]),
        ("Where are the audit reports?", ["audit"]),   # reports aren't published; the Accounts Section page covers audits
        ("What administrative committees are there?", ["committee"]),
        ("How does the grievance redressal process work?", ["grievance"]),
        ("What are the staff rules and regulations?", ["staff rules", "rules"]),
        ("What is the recruitment procedure for faculty?", ["recruitment"]),
        ("What is the college's strategic plan?", ["strategic plan"]),
        ("What is the vision and mission of the college?", ["vision", "mission"]),
        ("What quality policy and ISO certification does the college have?", ["iso", "quality polic"]),
        ("Who are on the governing body?", ["governing body"]),
        ("What grants and consultancy work does the college do?", ["grant", "consultancy"]),
    ],
}


def all_questions() -> list:
    """[(audience, question, expected words)]"""
    return [(aud, q, exp) for aud, items in QUESTIONS.items() for q, exp in items]

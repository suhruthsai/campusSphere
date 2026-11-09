# CampusSphere — MVSR Engineering College Digital Twin & Student Services

CampusSphere is a 3D digital twin of **MVSR Engineering College, Nadergul** with the college's student
services built into it. Students click the building where a service happens (the Admin Office, the Exam
Cell, the Placement Cell) to request documents, then watch each request move from desk to desk on the
3D map until they download a digitally approved, QR-verifiable PDF.

Built with **React 18 + Vite + Tailwind**, **Three.js**, **FastAPI + SQLAlchemy** (SQLite or Postgres)
and **ReportLab**. The AI assistant runs on **Groq** (server-side key).

---

## 🌟 Features

### 🏛️ 3D campus twin (home page)
- Every building at its real position (GPS-anchored), real sun position, live weather (Open-Meteo).
- Live class markers from the timetable, campus clock phases (arrival, breaks, lunch), walking students.
- Walking routes on the real path network, camera fly-to, building info, 3D room walkthrough with CCTV view.
- **Map controls** on the right of the 3D view: hold the arrows to move, rotate, tilt, zoom slider, ⌂ to reset. Also
  right-drag (or Shift-drag) to move, pinch to zoom on phones, and the keyboard whenever the map is on screen (no
  click needed; ignored while typing in a box): arrows / WASD, Q E rotate, R F tilt, + − zoom, 0 reset. Keys go by
  position, so they work on Telugu / Hindi keyboard layouts too. On phones the controls start folded into a small button.
- Your own items on the map: request envelopes, the Joining Day "next stop" beacon, no-dues clearance pins.

### 📄 Student services
- Service counters: **Admin Office** (Bonafide, TC, Conduct, Course Completion, Medium of Instruction),
  **Placement Cell** (NOC), **Exam Cell** (Provisional Certificate, CMM, Transcripts).
- Approval chains: Mentor → Class In-charge → Associate HOD → HOD → Principal (Bonafide/NOC);
  HOD → Principal (leaving documents); Controller of Examinations → Principal → Exam Cell upload & dispatch.
- Online document fees (test mode), overdue flags per desk, PDF with approval trail and QR code,
  public verification page `/verify/<code>`.

### 🎓 Joining (after TGEAPCET counselling)
- Allotment details, document checklist that adapts to category/reimbursement/board, private uploads,
  Admin Office verification, college fees (test payments + receipts), original-certificates register
  with acknowledgement slips, enrolment (roll number, section, mentor).

### 🚪 Leaving the college
- No-dues clearance by 7 sections (library, accounts, department, transport, Exam Cell, placement, sports),
  dues paid online or settled at the counter, No-Dues Certificate, then TC and other leaving documents.

### 📅 Timetable intelligence (real data: IT and Civil, 12 sections, 468 classes a week)
- Student and faculty home pages (my classes today, next class, substitutes).
- Analytics (room usage, busiest periods, departments, teaching load), Labs, Floors with a time machine,
  timetable editor with a clash report (combined classes excluded), faculty substitutions.
- Room utilisation model (scikit-learn) with next-week forecasts and room decisions.

### 🧭 Navigation & AI
- **Find a place** (one page, three tabs): route finder (real walking distance/time, "show on the campus map"),
  campus directory, inside a building. **Rooms** (classrooms, labs, floors) is one page with tabs too.
- **Mitra, the talking 3D guide**: a hologram on the campus map. Ask by voice or text in English, हिंदी or
  తెలుగు ("Where does my daughter collect her bonafide certificate?"); she answers aloud, walks the real
  paths to the Admin Office with the camera following, points at the building and explains what to do there.
  Tours of up to four stops. Voice through Sarvam AI (`SARVAM_API_KEY`), browser voices otherwise.
- **Visitor view** is the front page `/` (no account; old `/visit` links redirect there): parents explore the campus
  with Mitra. Visitors only get public information (buildings, rooms, services, classes now), rate-limited per IP.

### 🛠️ Admin
- Users (add, edit, CSV import/export, password reset), buildings, approver roles, clearance officers,
  joining and document fees, dashboard with live weather and classes in session.
- **College roll list** (Services → Roll list): the branch roll lists imported from PDF. A student's roll
  number is checked against it when they fill in their profile (year and section must match, branch is
  taken from the list), and one roll number can belong to only one account.

### 🤖 Mitra Agent (signed-in students)
- **Morning Brief** on the student and faculty home pages (`GET /api/v1/ai/brief`): today's classes (now / next),
  substitutes, where each request is waiting, what's ready or needs paying; faculty also see approvals waiting for
  them. Built from the timetable and requests with no AI call; **Listen** has Mitra read it aloud.
- **Ask for a document in plain words** (English, Hindi, Telugu): *"I need a NOC for the Smart India Hackathon,
  8–9 December"*. Mitra checks it exactly as the Services page would and shows it with **Confirm & submit**; nothing is
  submitted until the student taps it (`POST /api/v1/ai/guide/confirm`). Proposals are signed, expire in 15 minutes,
  work only for the student they were made for, and can't be used as a login token.
- **"Where is my request?"**: Mitra says which desk has it and for how long, and walks there on the 3D campus.
- Visitors and staff never get these tools. Tests: `python tests/run_all.py mitra_agent` (no AI needed).

### 🏆 Accreditation Autopilot (admins and the Principal: Quality menu)
- **Civil & IT Block pilot:** timetables, faculty and rooms are loaded for Civil and IT, so both pages cover those
  programmes. Pick *Civil & IT*, *Civil* or *IT*; NBA accredits each programme separately, so it shows one at a time.
  Requests, joining and no-dues count only for students of the chosen departments.
- **Placeholder roll list** while a branch's official list isn't available:
  `python backend/app/db/generate_placeholder_roster.py --branch CIVIL --per-class 70` adds 70 invented students per
  year with `GEN-` roll numbers (no real roll number can match them) and a visible note on the Roll list page; metrics
  built on them show as *Simulated*. Remove them with `--remove` once the official list is imported.
- **NAAC / NBA evidence** (`/accreditation`): 25 metrics mapped to the NAAC criteria and NBA SAR criteria, recomputed
  from the timetable, roll list, faculty profiles, approval trails, joining and no-dues records on every visit.
  Each metric shows its source table and status (*Live records*, *Test mode*, *Simulated*, *Not captured*), and the
  gaps list says what to start recording to close each one. **Download evidence pack** gives an A4 PDF for the IQAC.
- **Desk turnaround wall** (`/accreditation/desks`): every approver desk, no-dues unit and the Admissions desk timed
  against the 24-hour desk target from the approval timestamps, slowest first, with the oldest waiting requests,
  a pin to show each desk on the 3D campus, a one-minute refresh and a full-screen TV mode for an office display.
- Criterion numbers follow the NAAC revised framework and NBA SAR; the IQAC should confirm them against the manual it files under.

### 🧑‍🎓 Menus by role (`GET /api/v1/auth/me/roles` decides what each person sees)
| Role | Menus |
|---|---|
| Student | My Day · Attendance · Notices · Certificates · Campus · Joining / Leaving (only while they apply) |
| Faculty | My Day · Attendance · Notices · Approvals (if they approve) · Timetable & Rooms · **HOD:** Department (Substitutions, analytics, room utilisation) · **My desks** only for what they hold (No-dues, Exam Cell, Principal: Accreditation) |
| Admin Office | Office (Approvals, Admissions, Originals, Roll list, No-dues if assigned) · Notices · Campus |
| Admin | Office · Management (Dashboard, Accreditation, Desk turnaround, Attendance, Analytics, Room utilisation) · System (Users, Timetable, Substitutions, Approvers, Fees, Buildings, Rooms, Mitra's knowledge) · Notices · Campus |

Mitra is the one assistant. The sample-data pages (Library, Crowd, AI Predictions, Recommendations) and the old
floating bot are gone from the menus; old links go to the person's home page.

### 📋 Attendance (`/attendance`)
- **Faculty mark by period** from the timetable: everyone starts present, tap the absentees (tap again: late).
  The teacher, the day's substitute, the HOD or an admin may mark; the teacher can correct for 24 hours after class
  (HOD and admins any time). Marks are against the **roll list** (roll numbers), so they count from day one.
- **Lab batches** 1/2 and G1/G2 split the class by roll number (first / second half); **electives** start empty and
  the teacher ticks who takes them, so nobody is marked absent from a class they don't take. Moves are remembered.
- **Students:** overall and per subject, with exact advice: *"You can miss 3 classes in a row and stay at 75%"* or
  *"Attend the next 6 in a row to get back to 75%"*, and, once the semester dates are set, bunks left this semester.
- **Rules (admin):** 75% required, 65% condonation floor (below it: detention), correction window. Semesters are
  automatic (1 July – 31 December, 1 January – 30 June) and percentages count the current semester only; an admin
  can set other dates for a semester.
  Reports: section (lowest first), and the overview by section for HODs, the Principal and admins.
- The Morning Brief warns students below / near 75% and reminds faculty of periods not marked yet; the accreditation
  attendance metric uses these marks (*Live*).

### 📢 Notices (`/notices`)
- Everyone reads what's meant for them (college, department, year, section; students or staff); urgent first, and
  urgent / new ones appear in the Morning Brief. Posting: Principal and admins anyone, Admin Office anyone, HODs their
  department, faculty students of a class in their department. Authors (and the Principal) can take notices down.

### 🔄 Substitutions
- HODs arrange substitutions for **their own department** (Department → Substitutions); admins for every department.
  The clash check and the audit trail are unchanged; the log names who arranged it.

### 👩‍🏫 Faculty accounts
- `python backend/app/db/create_faculty_accounts.py` creates an account for every faculty member in the faculty list,
  with the same email as their faculty profile: that email links the account to its timetable (My Day, Attendance,
  section reports). It skips anyone who already has an account and emails nobody. Logins (temporary passwords) go to
  `backend/app/db/faculty_accounts.local.txt` (git-ignored, personal data) for the Admin Office to hand out; faculty
  change the password under My account. `--dry-run` previews, `--remove` deletes only the accounts it created.

**Payments run in test mode only.**

---

## 🏗️ Project structure

```
backend/app/
├── api/v1/endpoints/     # REST API: auth, buildings, routing, timetable, classrooms, substitutions,
│                         #   services (certificates), joining, leaving, utilization, ai, ...
├── student_services/     # Document catalogue, approval workflow, PDFs, receipts, payments, joining rules
├── ai/                   # Groq assistant helpers, room-utilisation model
├── core/                 # Settings, security (JWT), rate limiting, campus (India) clock
├── db/                   # Session, column migrations, timetable seeder, demo-accounts seeder
├── models/               # SQLAlchemy models (campus, services, admissions, leaving)
└── main.py               # FastAPI app entry point
src/
├── components/three/     # SuhruthDigitalTwin.jsx (3D campus), twinExtras.js, room walkthrough
├── components/services/  # Service counter, request timeline
├── components/joining/   # Joining UI, test checkout
├── pages/                # Dashboards, services, joining, leaving, navigation, admin, AI, monitoring
├── store/                # Zustand store (camera flights, chat, route requests)
├── utils/                # API client, campus helpers
└── App.jsx               # Routes (role-guarded)
```

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js** 18+ and **npm**
- **Python** 3.10+

### 2. Configuration (secrets)
Copy `.env.example` to `.env` in the project root and fill in `SECRET_KEY`, `ADMIN_PASSWORD` and `GROQ_API_KEY`.
- If `ADMIN_PASSWORD` is empty, a random admin password is generated and printed **once** on first startup.
- The Groq key is used **only by the backend** (`/api/v1/ai/chat`); never expose it as a `VITE_` variable.
- Login is rate-limited: 5 failed attempts per account per IP (or 20 per IP, or 50 per account overall) lock further attempts for 15 minutes. Behind a reverse proxy, set `TRUSTED_PROXY_HOPS` (Render: `1`) so real client IPs are used.
- There is no public sign-up: the college creates every account (roll lists, the faculty list, or an admin in *Admin → Users*). New accounts and admin password resets get a temporary password, and until it is changed under *My account* the API answers only `/auth/me`, `/auth/me/roles` and `/auth/change-password` (403 everywhere else).

### 3. Backend Setup (FastAPI + SQLite)
Run these from the **project root** (the code imports `backend.app...`):
```bash
# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Start the backend on port 8000 (an empty database is seeded automatically on first start)
python3 -m uvicorn backend.app.main:app --reload --port 8000
```
Backend API will be running at `http://127.0.0.1:8000` (API Docs at `http://127.0.0.1:8000/docs`).

### 4. Frontend Setup (React + Vite)
```bash
# In the project root directory
npm install

# Start the Vite development server (proxies /api and /ws to port 8000)
npm run dev
```
Frontend application will be accessible at `http://localhost:5173`.

---

## 🤖 Classroom Utilization Model
**AI → Room Utilization** (admin/faculty) forecasts next week's attendance for every timetabled session and turns it into room decisions.

- **Data:** per-session headcounts in `class_session_logs`. Until real headcounts are recorded, 16 weeks of history are *simulated* from the real timetable (`backend/app/ai/utilization/simulator.py`). Faculty can record real headcounts via `POST /api/v1/ai/utilization/sessions`; recorded rows replace simulated ones.
- **Model:** scikit-learn `HistGradientBoostingRegressor` predicting each session's attendance rate from session type, batch, slot, room, academic-calendar facts (days to exams, holidays) and faculty/section history, blended with the session's own past average. A second "slot model" answers *what if this class moved?*
- **Evaluation:** trained on weeks 1–12, tested on weeks 13–16 against non-ML baselines; 80% prediction ranges are split-conformal calibrated. Results are shown on the page's **Model** tab and returned by `GET /api/v1/ai/utilization/model`.
- **Decisions:** timetable clashes, overflow risk, reschedule/swap suggestions scored by the model, low-attendance flags and under-used rooms (`GET /api/v1/ai/utilization/report`).
- The model trains automatically in the background at startup (~20 s) and retrains when its database changes; admins can retrain from the page.

---

## 👥 Demo accounts
To try the approval chains, create demo approvers, a demo student, the Admin Office and the CoE:
```bash
PYTHONPATH=. python3 backend/app/db/seed_services_demo.py
```
Their logins are written to `backend/app/db/demo_accounts.local.txt` (git-ignored — never commit it).

---

## 🧪 Database Seeder
The server seeds the timetable **only when the database is empty**, so restarts and redeploys never overwrite edits.
To wipe and fully reseed the Civil & IT Block timetable (this **deletes all timetable entries**):
```bash
PYTHONPATH=. python3 backend/app/db/seed_all_timetables.py
```

### Roll lists
Import a branch's roll-list PDF (one branch and year per file; existing roll numbers are updated):
```bash
pip install pdfplumber
python backend/app/db/import_roll_lists.py --branch IT --year 4 "IT Roll List.pdf" --dry-run   # check first
python backend/app/db/import_roll_lists.py --branch IT --year 4 "IT Roll List.pdf"
```
Problems in the source (invalid emails, roll numbers that don't match the year, one email shared by two
students) are printed and kept as notes on the row. The PDFs are personal data: keep them out of git.

---

## ✅ Tests
With the backend running and the demo accounts seeded, run every API suite (services, admin, joining,
leaving, timetable writes, timetable truth, current class, roll list, the AI guide's data tools, and a sweep
of every GET endpoint):
```bash
python tests/run_all.py            # or: python tests/run_all.py roll_list joining
```
They create throwaway accounts and records and remove them afterwards. Point them at another server with
`CAMPUS_API=http://host:port`.

---

## ☁️ Deployment (Render backend + Vercel frontend)

**1. Backend on Render** — create a Blueprint from this repo; `render.yaml` provisions the API and a Postgres database.
In the Render dashboard set:
| Variable | Value |
|---|---|
| `ADMIN_PASSWORD` | Password for the first admin account (set **before** the first deploy) |
| `GROQ_API_KEY` | Groq key for the AI assistant |
| `SARVAM_API_KEY` | Optional: Sarvam AI key for Mitra's Telugu / Hindi / English voice |
| `CORS_ORIGINS` | Your Vercel URL, e.g. `https://campussphere.vercel.app` (comma-separate several) |

`SECRET_KEY` is generated automatically. Render checks `/health` to confirm the API and database are up.

**2. Frontend on Vercel** — import the repo (framework: Vite) and set one environment variable:
| Variable | Value |
|---|---|
| `VITE_API_URL` | The Render service URL, e.g. `https://campussphere-backend.onrender.com` |

The browser then calls the API and WebSockets on Render directly. Redeploy the frontend after changing `VITE_API_URL` (it's baked in at build time).

**Docker (any host):**
```bash
docker build -f backend/Dockerfile -t campussphere-backend .
docker run -p 8000:8000 --env-file .env campussphere-backend
```

**Free-tier caveats**
- Render's free web service sleeps after inactivity; the first request after that takes ~1 minute.
- The filesystem is ephemeral: uploaded room media (`media_uploads/`) and joining documents / issued PDFs (`private_uploads/`) are lost on every redeploy. Use object storage (S3, Cloudinary, …) or a paid persistent disk for real uploads.
- Render's free Postgres database expires after a limited period; check Render's current terms and back up your data.

---

## 🔒 License & Credits
Developed for **CampusSphere Intelligent Digital Twin Platform**.

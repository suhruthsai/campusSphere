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
- Route finder (real walking distance/time, "show on the campus map"), campus directory, indoor floors view.
- AI assistant (Groq) that answers campus questions and can fly the 3D camera to a building.

### 🛠️ Admin
- Users (add, edit, CSV import/export, password reset), buildings, approver roles, clearance officers,
  joining and document fees, dashboard with live weather and classes in session.

**Sample data, clearly labelled in the app:** Library/Crowd/Attendance monitoring, AI Predictions and
Recommendations have no sensor or attendance source yet. Payments run in **test mode** only.

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
- Public sign-ups can create **student** accounts (active immediately) or **faculty** accounts (pending until an admin approves them in *Admin → Users*). Admin and staff accounts can only be created by an admin.

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

---

## ☁️ Deployment (Render backend + Vercel frontend)

**1. Backend on Render** — create a Blueprint from this repo; `render.yaml` provisions the API and a Postgres database.
In the Render dashboard set:
| Variable | Value |
|---|---|
| `ADMIN_PASSWORD` | Password for the first admin account (set **before** the first deploy) |
| `GROQ_API_KEY` | Groq key for the AI assistant |
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

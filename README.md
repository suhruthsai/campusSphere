# CampusSphere — AI-Powered Smart Campus Intelligence & 3D Digital Twin

CampusSphere is a next-generation, real-time **3D Smart Campus Intelligence & Digital Twin Platform** built with **React**, **Three.js**, **FastAPI**, **SQLAlchemy**, and **Tailwind CSS**. 

The platform bridges real-world campus architecture with spatial intelligence, timetable-aware classroom occupancy, 3D room walkthroughs with student and faculty avatars, and multi-camera CCTV monitoring.

---

## 🌟 Key Features

### 🏛️ 1. Civil & IT Block 3D Digital Twin
- **Neoclassical Architectural Facade**: Custom-modeled grand portico featuring 4 towering Ionic columns, classical pediment gable roof with relief dentils, multi-pane arched glass windows, and grand white tiered marble entrance stairs with silver handrails.
- **Sculpture & Landscaping**: Dark granite tiered pedestal with a bronze bust statue facing the courtyard, curbed driveway, and manicured evergreen topiary lawns.
- **Real-World GPS Anchoring**: All 29 campus structures and pathways anchored to precise real-world coordinates.

### 🎒 2. High-Fidelity 3D Room Walkthrough & Interior Twin
- **Interactive 3D Classrooms**:
  - Red-topped laminate desks arranged in dual columns with center walking aisle.
  - 20 seated student avatars in vibrant college attire with open notebooks and pens.
  - 3D Teacher avatar at the front podium pointing towards the lecture board.
  - Floating 3D holographic faculty nameplate and dynamic whiteboard with live handwritten lecture notes.
- **Executive Board Room / Director's Office**:
  - Long wood-grain conference table with ergonomic executive chairs and tan director chair.
  - Projector, standing easel whiteboard, split AC unit, and slatted ceiling downlights.
- **Multi-Camera POVs**:
  - `👀 3D Orbit`: 360° pan, rotate, and zoom.
  - `👨‍🏫 Teacher POV`: View students from the podium.
  - `🎒 Student POV`: View the teacher and whiteboard from student desks.
  - `📹 CCTV Cam POV`: Corner security camera view.

### 📅 3. Comprehensive 12-Section Timetable Intelligence
- **466 Full-Week Timetable Entries** (Monday through Saturday, Periods 1–6):
  - **Information Technology**: IT-2A, IT-2B, IT-2C, IT-3A, IT-3B, IT-3C, IT-4A, IT-4B, IT-4C.
  - **Civil Engineering**: Civil Sem-III (with G1/G2 lab batches), Civil Sem-V (with G1/G2 batches), Civil Sem-VII (CEP lab & PW-1).
- **Time-Aware Resolution**: Real-time evaluation of occupied vs. free classrooms based on the college schedule, with period simulation controls.

### 📹 4. Live CCTV Multi-Screen Surveillance Wall
- Quad-screen security video matrix displaying live classroom camera feeds with timestamps, resolution indicators, and scanlines.

---

## 🏗️ System Architecture

```
CampusSphere/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/     # REST Endpoints (classrooms, timetable, buildings, events, auth)
│   │   ├── db/                   # Database session, models, and seed_all_timetables.py
│   │   ├── models/               # SQLAlchemy models (Campus, Classroom, TimetableEntry, User)
│   │   └── main.py               # FastAPI application entry point
│   ├── Dockerfile
│   └── requirements.txt          # Python backend dependencies
│
├── src/
│   ├── components/
│   │   ├── three/
│   │   │   ├── SuhruthDigitalTwin.jsx   # Main 3D Campus Scene & Building Meshes
│   │   │   ├── RoomInterior3DModal.jsx  # Interactive 3D Room Walkthrough Modal
│   │   │   └── CampusScene.jsx
│   │   ├── timetable/
│   │   │   └── ClassroomInfoPanel.jsx   # Timetable schedule & physical room popup
│   │   └── AIAssistant.jsx              # AI Campus Assistant
│   ├── pages/                           # Application pages (Home, Timetables, Analytics, Events)
│   ├── store/useCampusStore.js          # Global Zustand state management
│   ├── utils/api.js                     # Frontend API client
│   └── App.jsx                          # Route manager
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js** 18+ and **npm**
- **Python** 3.10+

### 2. Backend Setup (FastAPI + SQLite)
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed the complete 12-section timetable and campus database
PYTHONPATH=.. python3 app/db/seed_all_timetables.py

# Start the backend server on port 8000
python3 -m uvicorn app.main:app --reload --port 8000
```
Backend API will be running at `http://127.0.0.1:8000` (API Docs at `http://127.0.0.1:8000/docs`).

### 3. Frontend Setup (React + Vite)
```bash
# In the project root directory
npm install

# Start the Vite development server
npm run dev
```
Frontend application will be accessible at `http://localhost:5173`.

---

## 🧪 Database Seeder
To regenerate or reseed the complete Civil & IT Block timetable database at any time:
```bash
PYTHONPATH=. python3 backend/app/db/seed_all_timetables.py
```

---

## 🔒 License & Credits
Developed for **CampusSphere Intelligent Digital Twin Platform**.

// SuhruthDigitalTwin.jsx — Interactive 3D Digital Twin anchored to Real Campus GPS
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { Layers, X } from 'lucide-react';
import { useCampusStore } from '../../store/useCampusStore.js';
import ClassroomInfoPanel from '../timetable/ClassroomInfoPanel.jsx';
// The room walkthrough is a second large 3D scene; load it only when a room is opened
const RoomInterior3DModal = lazy(() => import('./RoomInterior3DModal.jsx'));
import { buildingsApi, classroomsApi, joiningApi, leavingApi, servicesApi, timetableApi } from '../../utils/api.js';
import { PLACE_NAMES } from '../joining/joiningUi.jsx';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import ServiceCounter, { COUNTER_NAMES } from '../services/ServiceCounter.jsx';
import { fmtWaiting, whereNow } from '../services/requestUi.jsx';
import {
  istNow, solarPosition, skyDirection, periodsFrom, liveSessionsByBuilding, campusPhase,
  createSignpost, createPlaque, createFlowerBed, createCourtyardGarden, createBollardLamp,
  createLiveMarker, createCrowd, createIntroPath, createDocToken, createClearancePin,
} from './twinExtras.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { dedupeMaterials, mergeStaticMeshes, disposeObject, disposeRenderer } from './sceneOptimizer.js';

// Max real point/spot lights switched on at night. Each visible light is evaluated for
// every pixel of every lit surface (~4 ms/frame each on an integrated GPU), so the
// original ~100 made night mode unusably slow. 12 keeps the area floodlights, the
// auditorium lights and the main building entrances.
const NIGHT_LIGHT_BUDGET = 12;

// One additive "pool of light" decal per street-lamp head, merged into a single mesh.
function createLightPools(scene, streetLights) {
  if (!streetLights.length) return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,205,140,0.9)');
  grad.addColorStop(0.45, 'rgba(255,185,110,0.35)');
  grad.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  scene.updateMatrixWorld(true);
  const pos = new THREE.Vector3();
  const quads = [];
  streetLights.forEach(({ light1, light2 }) => {
    [light1, light2].forEach((l) => {
      l.getWorldPosition(pos);
      const g = new THREE.PlaneGeometry(18, 18);
      g.rotateX(-Math.PI / 2);
      g.translate(pos.x, 0.65, pos.z);
      quads.push(g);
    });
  });
  const geometry = mergeGeometries(quads);
  quads.forEach((g) => g.dispose());
  const material = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.renderOrder = 1;
  scene.add(mesh);
  return mesh;
}

// Gate sign lettering: white on navy, canvas sized to the sign's aspect ratio.
function textTextureForGate(lines, aspect) {
  const height = 160;
  const width = Math.round(height * aspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0D2137';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, width - 12, height - 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach(({ text, font }, i) => {
    ctx.font = font;
    let size = parseInt(font.match(/(\d+)px/)[1], 10);
    while (ctx.measureText(text).width > width * 0.92 && size > 10) {
      size -= 2;
      ctx.font = font.replace(/\d+px/, `${size}px`);
    }
    ctx.fillText(text, width / 2, (height / (lines.length + 1)) * (i + 1) + (i === 0 ? 6 : 0));
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Class periods of the seeded timetable; used for the campus clock if the timetable can't be loaded.
const DEFAULT_PERIODS = [
  { n: 1, start: 570, end: 630 }, { n: 2, start: 630, end: 690 }, { n: 3, start: 700, end: 760 },
  { n: 4, start: 760, end: 820 }, { n: 5, start: 855, end: 915 }, { n: 6, start: 915, end: 975 },
];
const INTRO_SEEN_KEY = 'mvsr-twin-intro-seen';
const INTRO_SECONDS = 11;

// ══════════════════════════════════════════════════════════════════════════════
// 1. REAL-WORLD GPS ANCHOR
// ══════════════════════════════════════════════════════════════════════════════
// Scene origin = centroid of the MVSR campus outline in OpenStreetMap (way 557838247).
// The campus grid is turned 3.57° clockwise from true north; the scene is built
// axis-aligned to that grid, so toGPS() rotates back before converting to lat/lon.
// Survey data: docs/mvsr-survey/mvsr_survey.json
const CENTER_LAT = 17.2814455;
const CENTER_LON = 78.5396206;
const GRID_ROTATION = (3.57 * Math.PI) / 180;
const LAT_PER_M = 1 / 110574;
const LON_PER_M = 1 / (111320 * Math.cos((CENTER_LAT * Math.PI) / 180));

function toGPS(x, z) {
  const east  = x * Math.cos(GRID_ROTATION) - z * Math.sin(GRID_ROTATION);
  const south = x * Math.sin(GRID_ROTATION) + z * Math.cos(GRID_ROTATION);
  const lat = CENTER_LAT - south * LAT_PER_M;
  const lon = CENTER_LON + east * LON_PER_M;
  return { lat, lon };
}

function fmtGPS(g) {
  return `${g.lat.toFixed(6)}, ${g.lon.toFixed(6)}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CAMPUS DATA
// ══════════════════════════════════════════════════════════════════════════════
const FLOOR_H = 3.2;

// ── Student Profiles for Realism ──────────────────────────────────────────────
const STUDENT_PROFILES = [
  { id: 'student_0', name: 'Alex', dept: 'Computer Science (3rd Yr)', activity: 'Walking to Central Library' },
  { id: 'student_1', name: 'Sam', dept: 'Mechanical Engineering (2nd Yr)', activity: 'Stressed about thermodynamics' },
  { id: 'student_2', name: 'Jordan', dept: 'Architecture (4th Yr)', activity: 'Sketching buildings' },
  { id: 'student_3', name: 'Casey', dept: 'Business (3rd Yr)', activity: 'Pitching startup ideas' },
  { id: 'student_4', name: 'Taylor', dept: 'Arts (1st Yr)', activity: 'Relaxing near Central Park' },
  { id: 'student_5', name: 'Sneha Reddy', dept: 'Civil Engineering (4th Yr)', activity: 'Going to Examination Dept' },
  { id: 'student_6', name: 'Karthik Nair', dept: 'Science & Humanities (1st Yr)', activity: 'Relaxing near Central Park' },
  { id: 'student_7', name: 'Meera Joshi', dept: 'Computer Science (2nd Yr)', activity: 'Walking from Back Gate' },
];

const BUILDINGS = [
  { 
    id: 'rnd', name: 'R&D', type: 'Research & Development', depts: ['Research & Development'], x: -14, z: 70, w: 21, d: 26, rotY: Math.PI, shape: 'box', color: 0x14b8a6, gate: { x: -14, z: 55 }, link: { x: -14, z: 47 }, 
    stats: { 
      floors: 2, classes: 0, washrooms: 2, staffCabins: 0, labs: 6, 
      layoutData: [
        { floor: "Ground Floor", rooms: [
            ...Array.from({length: 3}, (_, i) => ({ type: 'lab', label: `R&D Lab (RD-G0${i+1})` })),
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}
          ] 
        },
        { floor: "First Floor", rooms: [
            ...Array.from({length: 3}, (_, i) => ({ type: 'lab', label: `R&D Lab (RD-10${i+1})` }))
          ] 
        }
      ]
    } 
  },
  { 
    id: 'cant', name: 'Canteen', type: 'Canteen', depts: ['Canteen'], x: -40, z: 75.5, w: 31, d: 17, rotY: Math.PI, shape: 'box', color: 0xf97316, gate: { x: -40, z: 65 }, link: { x: -40, z: 47 }, 
    stats: { 
      floors: 2, classes: 0, washrooms: 0, staffCabins: 1, labs: 0, 
      layoutData: [
        { floor: "Ground Floor", rooms: [
            {type: 'food', label: 'Bakery'}, {type: 'food', label: 'Tiffins & Meals'}, {type: 'food', label: 'Tea & Coffee'},
            {type: 'seminar', label: 'Student Dining Area'}, {type: 'seminar', label: 'Staff Dining Area'}
          ] 
        },
        { floor: "First Floor", rooms: [
            {type: 'sports', label: 'Table Tennis'}, {type: 'gym', label: 'Gymnasium'}, {type: 'sports', label: 'Carroms'},
            {type: 'cabin', label: 'Sports Staff Cabin'}
          ] 
        }
      ]
    } 
  },
  { 
    id: 'cad', name: 'CAD Lab', type: 'Lab', depts: ['CAD Lab'], x: -106, z: 83, w: 32, d: 21, rotY: Math.PI, shape: 'box', color: 0x3b82f6, gate: { x: -106, z: 70.5 }, link: { x: -106, z: 47 }, 
    stats: { 
      floors: 1, classes: 0, washrooms: 0, staffCabins: 0, labs: 3, 
      layoutData: [
        { floor: "Ground Floor", rooms: [
            {type: 'lab', label: 'CAD Lab 1'}, {type: 'lab', label: 'CAD Lab 2'}, {type: 'lab', label: 'CAD Lab 3'}
          ] 
        }
      ]
    } 
  },
  { 
    id: 'exam', name: 'Examination Department', type: 'Admin', depts: ['Examination Department'], x: -105, z: 110, w: 42, d: 23, rotY: Math.PI, shape: 'box', color: 0xec4899, gate: { x: -105, z: 96.5 }, link: { x: -129.5, z: 96.5 }, 
    stats: { 
      floors: 4, classes: 15, washrooms: 4, staffCabins: 1, labs: 1, 
      layoutData: [
        { floor: "Ground Floor", rooms: [
            {type: 'lab', label: 'Lab (EX-G01)'},
            {type: 'hod', label: 'Exam Control Room'}
          ] 
        },
        { floor: "First Floor", rooms: [
            ...Array.from({length: 5}, (_, i) => ({ type: 'class', label: `Class (EX-10${i+1})` })),
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}
          ] 
        },
        { floor: "Second Floor", rooms: [
            ...Array.from({length: 5}, (_, i) => ({ type: 'class', label: `Class (EX-20${i+1})` })),
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}
          ] 
        },
        { floor: "Third Floor", rooms: [
            ...Array.from({length: 5}, (_, i) => ({ type: 'class', label: `Class (EX-30${i+1})` }))
          ] 
        }
      ]
    } 
  },
  { 
    id: 'sh', name: 'S&H Block', type: 'Academic', depts: ['Science & Humanities'], x: -162.5, z: 85, w: 41, d: 40, rotY: Math.PI, court: { w: 9, d: 9 }, shape: 'box', color: 0x6366f1, gate: { x: -162.5, z: 63 }, link: { x: -162.5, z: 47 }, 
    stats: { 
      floors: 4, classes: 15, washrooms: 4, staffCabins: 3, labs: 7, 
      layoutData: [
        { floor: "Ground Floor", rooms: [
            {type: 'lab', label: 'Chem Lab (SH-G01)'}, {type: 'lab', label: 'Phys Lab (SH-G02)'}, {type: 'lab', label: 'Workshop (SH-G03)'},
            {type: 'cabin', label: 'Staff Cabin (G04)'}, {type: 'cabin', label: 'Staff Cabin (G05)'}
          ] 
        },
        { floor: "First Floor", rooms: [
            ...Array.from({length: 7}, (_, i) => ({ type: 'class', label: `Class (SH-10${i+1})` })),
            {type: 'lab', label: 'Comp Lab (SH-108)'}, {type: 'cabin', label: 'Girls Common Room'},
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}
          ] 
        },
        { floor: "Second Floor", rooms: [
            {type: 'lab', label: 'English Lab (SH-201)'}, {type: 'lab', label: 'Comp Lab (SH-202)'}, {type: 'lab', label: 'Graphics Lab (SH-203)'}
          ] 
        },
        { floor: "Third Floor", rooms: [
            ...Array.from({length: 8}, (_, i) => ({ type: 'class', label: `Class (SH-30${i+1})` })),
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}
          ] 
        }
      ]
    } 
  },

  { 
    id: 'ece', name: 'ECE', type: 'Academic', depts: ['Electronics & Communication Engg.'], x: -7, z: 18, w: 35, d: 51, rotY: Math.PI, shape: 'box', color: 0x0ea5e9, gate: { x: -7, z: -9.5 }, link: { x: -7, z: -20 }, 
    stats: { 
      floors: 2, classes: 7, washrooms: 4, staffCabins: 2, labs: 7, 
      layoutData: [
        { floor: "Ground Floor", rooms: [
            ...Array.from({length: 3}, (_, i) => ({ type: 'lab', label: `ECE Lab (EC-G0${i+1})` })),
            {type: 'lab', label: 'IoT Lab (EC-G04)'},
            {type: 'cabin', label: 'Staffroom 1'}, {type: 'cabin', label: 'Staffroom 2'},
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}
          ] 
        },
        { floor: "First Floor", rooms: [
            ...Array.from({length: 7}, (_, i) => ({ type: 'class', label: `Class (EC-10${i+1})` })),
            ...Array.from({length: 3}, (_, i) => ({ type: 'lab', label: `Lab (EC-10${i+8})` })),
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}
          ] 
        }
      ]
    } 
  },
  { 
    id: 'cse', name: 'CSE', type: 'Academic', depts: ['Computer Science Engg.'], x: -50, z: 19.5, w: 34, d: 46, rotY: Math.PI, court: { w: 10, d: 7 }, shape: 'box', color: 0x8b5cf6, gate: { x: -50, z: -6 }, link: { x: -50, z: -20 }, 
        stats: { 
      floors: 3, classes: 16, washrooms: 6, staffCabins: 5, labs: 8, 
      layoutData: [
        { floor: "Ground Floor", rooms: [
            {type: 'lab', id: 'LAB-2', label: 'Lab-2'},
            {type: 'lab', id: 'LAB-3', label: 'WP Lab (Lab-3)'},
            {type: 'lab', id: 'LAB-4', label: 'OS Lab (Lab-4)'},
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}, 
            {type: 'cabin', label: 'Teacher Cabin'}, {type: 'cabin', label: 'Teacher Cabin'}, {type: 'hod', label: 'HOD Cabin'}
          ] 
        },
        { floor: "First Floor", rooms: [
            {type: 'lab', id: 'LAB-6', label: 'MPMC Lab (Lab-6)'},
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}, 
            {type: 'cabin', label: 'Teacher Cabin'}, {type: 'hod', label: 'HOD Cabin'}
          ] 
        },
        { floor: "Second Floor", rooms: [
            {type: 'class', id: 'CS-201', label: 'Classroom CS-201'},
            {type: 'class', id: 'CS-210', label: 'Classroom CS-210'},
            {type: 'class', id: 'CS-211', label: 'Classroom CS-211'},
            {type: 'class', id: 'CS-212', label: 'Classroom CS-212'},
            {type: 'class', id: 'ME-209', label: 'Classroom ME-209'},
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}
          ] 
        }
      ]
    } 
  },
  { id: 'mecheee',  name: 'Mech & EEE',           type: 'Academic',               depts: ['Mechanical Engg.', 'Electrical & Electronics Engg.'], x: -102, z: 18.5, w: 44, d: 50, rotY: Math.PI, court: { w: 13, d: 13 }, shape: 'box',  color: 0xf59e0b, gate: { x: -102, z: -9 }, link: { x: -102, z: -20 }, stats: { floors: 0, classes: 0, washrooms: 0, staffCabins: 0, labs: 0 } },
  { 
    id: 'civilit', name: 'Civil & IT Block', type: 'Academic', depts: ['Civil Engineering', 'Information Technology'], x: -158, z: 20, w: 46, d: 47, rotY: Math.PI, court: { w: 14, d: 14 }, shape: 'box', color: 0x10b981, gate: { x: -158, z: -6 }, link: { x: -158, z: -20 }, 
    stats: { 
      floors: 3, classes: 8, washrooms: 6, staffCabins: 4, labs: 8, 
      layoutData: [
        { floor: "Ground Floor", rooms: [
            {type: 'admin', label: 'Administration', id: 'ADMINISTRATION', location_type: 'ADMINISTRATION'},
            {type: 'lab', label: 'IoT Lab (CE-IT-18)', id: 'CE-IT-18', location_type: 'LABORATORY'},
            {type: 'lab', label: 'Surveying Lab (Civil)', id: 'SUR-LAB-CE', location_type: 'LABORATORY'},
            {type: 'lab', label: 'Engineering Geology Lab', id: 'EG-LAB-CE', location_type: 'LABORATORY'},
            {type: 'lab', label: 'Fluid Mechanics Lab (FM Lab)', id: 'FM-LAB-CE', location_type: 'LABORATORY'},
            {type: 'lab', label: 'Transportation Engg Lab', id: 'TE-LAB', location_type: 'LABORATORY'},
            {type: 'lab', label: 'Environmental Engg Lab', id: 'EE-LAB', location_type: 'LABORATORY'},
            {type: 'lab', label: 'Concrete Technology Lab', id: 'CT-LAB', location_type: 'LABORATORY'},
            {type: 'lab', label: 'Ada Lab (CRT)', id: 'ADA-LAB', location_type: 'LABORATORY'},
            {type: 'lab', label: 'Charles Babbage Lab (CB-01)', id: 'CB-01', location_type: 'LABORATORY'},
            {type: 'lab', label: 'CSE Lab-IV (CEP Lab)', id: 'CSE-LAB-IV', location_type: 'LABORATORY'},
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}
          ] 
        },
        { floor: "First Floor", rooms: [
            {type: 'office', label: 'Principal / Directors Office', id: 'PRINCIPAL-OFFICE', location_type: 'OFFICE'},
            {type: 'staff', label: 'IT Staff Room', id: 'IT-STAFF-ROOM', location_type: 'STAFF_ROOM'},
            {type: 'class', label: 'CE-IT-101', id: 'CE-IT-101', location_type: 'CLASSROOM'},
            {type: 'class', label: 'CE-IT-102', id: 'CE-IT-102', location_type: 'CLASSROOM'},
            {type: 'office', label: 'Civil Department Office', id: 'CIVIL-DEPT-OFFICE', location_type: 'DEPARTMENT_OFFICE'},
            {type: 'office', label: 'IQAC Room', id: 'IQAC-ROOM', location_type: 'OFFICE'},
            {type: 'lab', label: 'CE-IT-104 (Computer Lab)', id: 'CE-IT-104', location_type: 'LABORATORY'},
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}
          ] 
        },
        { floor: "Second Floor", rooms: [
            {type: 'class', label: 'CE-IT-201', id: 'CE-IT-201', location_type: 'CLASSROOM'},
            {type: 'class', label: 'CE-IT-202', id: 'CE-IT-202', location_type: 'CLASSROOM'},
            {type: 'class', label: 'CE-IT-203', id: 'CE-IT-203', location_type: 'CLASSROOM'},
            {type: 'lab', label: 'CE-IT-211 (Lab)', id: 'CE-IT-211', location_type: 'LABORATORY'},
            {type: 'class', label: 'CE-IT-212', id: 'CE-IT-212', location_type: 'CLASSROOM'},
            {type: 'class', label: 'CE-IT-213', id: 'CE-IT-213', location_type: 'CLASSROOM'},
            {type: 'lab', label: 'Electronics Laboratory (CE-IT-214)', id: 'CE-IT-214', location_type: 'LABORATORY'},
            {type: 'class', label: 'CE-204', id: 'CE-204', location_type: 'CLASSROOM'},
            {type: 'class', label: 'CE-205', id: 'CE-205', location_type: 'CLASSROOM'},
            {type: 'class', label: 'CE-206', id: 'CE-206', location_type: 'CLASSROOM'},
            {type: 'seminar', label: 'KVR Conference Hall', id: 'KVR-CONF-HALL', location_type: 'CONFERENCE_HALL'},
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}
          ] 
        }
      ]
    } 
  },

  { 
    id: 'lib', name: 'Library', type: 'Library', depts: ['Library'], x: -63, z: -59, w: 31, d: 31, shape: 'box', color: 0xd946ef, gate: { x: -63, z: -41 }, link: { x: -63, z: -30 }, 
    stats: { 
      floors: 2, classes: 3, washrooms: 2, staffCabins: 1, labs: 0, 
      layoutData: [
        { floor: "Ground Floor", rooms: [
            {type: 'cabin', label: 'Book Issue & Collection'},
            {type: 'seminar', label: 'Main Reading Hall'},
            {type: 'cabin', label: 'Staff Cabin'},
            {type: 'washroom', label: 'Boys Washroom'}
          ] 
        },
                { floor: "First Floor", rooms: [
            {type: 'lab', id: 'ADA-LIB', label: 'Ada Lovelace Lab', location_type: 'LABORATORY'},
            {type: 'class', label: 'Study Hall 1'}, {type: 'class', label: 'Study Hall 2'}, {type: 'class', label: 'Study Hall 3'},
            {type: 'washroom', label: 'Girls Washroom'}
          ] 
        }
      ]
    } 
  },
  {
    // Beside the Library on its east side; room list is a placeholder.
    id: 'placement', name: 'Placement Cell', type: 'Admin', depts: ['Training & Placement'], x: -33, z: -50, w: 14, d: 17, floors: 3, shape: 'box', color: 0x7c3aed, gate: { x: -33, z: -39 }, link: { x: -33, z: -30 },
    stats: {
      floors: 3, classes: 0, washrooms: 2, staffCabins: 1, labs: 1,
      layoutData: [
        { floor: "Ground Floor", rooms: [
            {type: 'office', label: 'Placement Office'}, {type: 'cabin', label: 'Reception & Waiting Area'},
            {type: 'washroom', label: 'Boys Washroom'}, {type: 'washroom', label: 'Girls Washroom'}
          ]
        },
        { floor: "First Floor", rooms: [
            {type: 'cabin', label: 'Interview Room 1'}, {type: 'cabin', label: 'Interview Room 2'},
            {type: 'cabin', label: 'Interview Room 3'}, {type: 'seminar', label: 'Group Discussion Room'}
          ]
        },
        { floor: "Second Floor", rooms: [
            {type: 'seminar', label: 'Pre-Placement Talk Hall'}, {type: 'lab', label: 'Online Assessment Lab'}
          ]
        }
      ]
    }
  },
  { id: 'aud',       name: 'Auditorium',            type: 'Auditorium',             depts: ['Auditorium'],                                         x: -139, z: -58, w: 50, d: 22, rotY: Math.PI, shape: 'oval', color: 0xf43f5e, gate: { x: -139, z: -45 }, link: { x: -139, z: -30 }, stats: { floors: 0, classes: 0, washrooms: 0, staffCabins: 0, labs: 0 } },
  // Gates sit on the boundary wall; rotY turns the gate so its outward face (local +x) points off campus.
  { id: 'frontgate', name: 'MVSR Engineering College',    type: 'Entrance',               depts: [],                                                     x: -229, z: -25, w: 8, d: 30,  rotY: Math.PI,     gateSpan: 30, shape: 'box',  color: 0x334155, gate: { x: -225, z: -20 }, link: { x: -189, z: -20 } },
  { id: 'backgate',  name: 'Back Gate',             type: 'Entrance',               depts: [],                                                     x: 20,  z: -79, w: 40, d: 8,   rotY: Math.PI / 2, gateSpan: 40, shape: 'box',  color: 0x334155, gate: { x: 20,  z: -76 }, link: { x: 20, z: -70 } },
  // Hostels are turned 90° to face east, so w is their north-south length and d their east-west depth.
  { id: 'boyshostel',name: 'Boys Hostel',           type: 'Hostel',                 depts: ['Accommodation'],                                      x: -190.5, z: -58, w: 39, d: 25, rotY: Math.PI / 2, shape: 'box',  color: 0x3b82f6, gate: { x: -176, z: -58 }, link: { x: -176, z: -30 } },
  { id: 'girlshostel',name:'Girls Hostel',          type: 'Hostel',                 depts: ['Accommodation'],                                      x: -208, z: 77.5, w: 69, d: 30, rotY: Math.PI / 2, shape: 'box',  color: 0xec4899, gate: { x: -191, z: 77.5 }, link: { x: -189, z: 77.5 } },
  { id: 'security',  name: 'Security Room',         type: 'Admin',                  depts: ['Security'],                                           x: -215, z: -40, w: 6,  d: 6,  shape: 'box',  color: 0x475569, gate: { x: -215, z: -36.5 }, link: { x: -215, z: -30 } },
];

// Boundary wall runs [x1, z1, x2, z2], traced from the OSM campus outline. The gaps at
// x 0..40 (north) and z -40..-10 (west) are filled by the main gate and back gate models.
const WALL_RUNS = [
  [-229, -79, 0, -79], [40, -79, 103, -72], [103, -72, 224, -53], [224, -53, 228, 24],
  [228, 24, 166, 54], [166, 54, 168, 85], [168, 85, -57, 85], [-57, 85, -60, 122],
  [-60, 122, -229, 122], [-229, 122, -229, -10], [-229, -40, -229, -79],
];

function wallSegment([x1, z1, x2, z2], i) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  return {
    name: `Wall ${i + 1}`, x: (x1 + x2) / 2, z: (z1 + z2) / 2, w: len, d: 1, h: 3,
    rotY: Math.atan2(-(z2 - z1), x2 - x1), shape: 'box', color: 0x1A202C, hideLabel: true,
  };
}

// A flat ground following an outline [[x, z], ...]; x/z/w/d are its bounding box.
function polygonGround(name, points, extra) {
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  return { name, shape: 'polygon', points, x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, ...extra };
}

function insidePolygon(points, x, z) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i];
    const [xj, zj] = points[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const GROUNDS = [
  // Open grounds & courts
  // West edge stops at x 28, leaving a bench walk (x 23-28) between the east road and the ground
  polygonGround('Ground', [[28, -55], [150, -55], [218, -48], [222, 22], [163, 50], [165, 83], [28, 83]], { color: 0xD9C49A, hideLabel: true }),
  { name: 'Parking (Cars)',     x: 59,   z: 9,    w: 52,  d: 40,  h: 0.38, shape: 'box',  color: 0x4B4F54, hideLabel: true },
  { name: 'Parking (Buses)',    x: 84,   z: -38,  w: 36,  d: 30,  h: 0.38, shape: 'box',  color: 0x4B4F54, hideLabel: true },
  // One full-size court running north-south (green court, blue surround on the imagery)
  { name: 'Basketball Court',   x: 6,    z: 69,   w: 18,  d: 30,  shape: 'box',  color: 0x2F7D4F, hideLabel: true },
  { name: 'Rock Garden',        x: -211, z: 15,   w: 32,  d: 46,  shape: 'box',  color: 0x6FA85A },
  // Smaller structures seen on satellite imagery (not named in any source)
  { name: 'Bank & ATM',         x: -211, z: -55,  w: 15,  d: 17,  h: 4,   shape: 'box', color: 0xCBD5E1 },
  { name: 'S&H Annex',          x: -163.5, z: 112, w: 40, d: 13,  h: 4,   shape: 'box', color: 0xE2E8F0, hideLabel: true },
  { name: 'Workshop Shed',      x: -76,  z: 88,   w: 13,  d: 48,  h: 5,   shape: 'box', color: 0x6B7280, hideLabel: true },
  // Public roads outside the wall
  { name: 'Road (Badangpet-Nadergul Main Rd)', x: -5, z: -91, w: 520, d: 10, shape: 'box', color: 0x4A4A4A },
  { name: 'Road (West)',        x: -248, z: 15,   w: 10,  d: 250, shape: 'box', color: 0x4A4A4A, hideLabel: true },
  // Campus roads & paths (centrelines from OSM)
  { name: 'Road (Back Gate Lane)', x: 20, z: -50, w: 10, d: 60, shape: 'box', color: 0x4A4A4A, hideLabel: true },
  { name: 'Path (Boulevard North)',  x: -104.5, z: -30, w: 249, d: 5, shape: 'box', color: 0x4A4A4A, hideLabel: true },
  { name: 'Path (Boulevard South)',  x: -104.5, z: -20, w: 249, d: 5, shape: 'box', color: 0x4A4A4A },
  { name: 'Main Curbed Median',      x: -127, z: -25, w: 114, d: 5, h: 0.6, shape: 'curbed-median', hideLabel: true },
  { name: 'Main Curbed Median 2',    x: -22,  z: -25, w: 68,  d: 5, h: 0.6, shape: 'curbed-median', hideLabel: true },
  { name: 'Path (East)',             x: 20,   z: 13.5, w: 6,  d: 67,  shape: 'box', color: 0x4A4A4A, hideLabel: true },
  { name: 'Path (South)',            x: -84,  z: 47,  w: 210, d: 5,   shape: 'box', color: 0x4A4A4A },
  { name: 'Path (West)',             x: -189, z: 39,  w: 5,   d: 145, shape: 'box', color: 0x4A4A4A, hideLabel: true },
  { name: 'Path (Civil-EEE)',        x: -129.5, z: 13.5, w: 4, d: 67, shape: 'box', color: 0x4A4A4A, hideLabel: true },
  { name: 'Path (S&H-Exam)',         x: -129.5, z: 77, w: 5,  d: 60,  shape: 'box', color: 0x4A4A4A, hideLabel: true },
  // Access road from the back-gate lane to the bus bay and car park
  { name: 'Road (Car Park Access)',  x: 41,   z: -40,  w: 32, d: 6, h: 0.39, shape: 'box', color: 0x4A4A4A, hideLabel: true },
  { name: 'Road (Car Park Entry)',   x: 57,   z: -25,  w: 6,  d: 30, h: 0.39, shape: 'box', color: 0x4A4A4A, hideLabel: true },
  { name: 'Road (CSE-ECE)',          x: -28.75, z: 13.5, w: 6, d: 67, shape: 'box', color: 0x4A4A4A, hideLabel: true },
  { name: 'Path (EEE-CSE)',          x: -73.5, z: 13.5, w: 4,  d: 67,  shape: 'box', color: 0x4A4A4A, hideLabel: true },
  ...WALL_RUNS.map(wallSegment),
];

// Ground boxes that block trees and benches (walls are thin and rotated, so they are left out).
const SOLID_GROUNDS = GROUNDS.filter((g) => !g.name.startsWith('Wall'));

// ══════════════════════════════════════════════════════════════════════════════
// 3. DIJKSTRA GRAPH  (kept in sync with backend/app/api/v1/endpoints/routing.py)
// ══════════════════════════════════════════════════════════════════════════════
const NODES = {
  // Back gate lane (x = 20)
  V_GATE: { x: 20, z: -70 }, V_N: { x: 20, z: -30 }, V_S: { x: 20, z: -20 },
  // Boulevard, north lane (z = -30)
  N_LIB: { x: -63, z: -30 }, N_PLC: { x: -33, z: -30 }, N_AUD: { x: -139, z: -30 }, N_BOYS: { x: -176, z: -30 }, N_W: { x: -189, z: -30 }, N_SEC: { x: -215, z: -30 },
  // Boulevard, south lane (z = -20)
  L_ECE: { x: -7, z: -20 }, P3_N: { x: -28.75, z: -20 }, L_CSE: { x: -50, z: -20 }, L_MID: { x: -63, z: -20 }, P2_N: { x: -73.5, z: -20 },
  L_MECH: { x: -102, z: -20 }, P1_N: { x: -129.5, z: -20 }, L_CIV: { x: -158, z: -20 }, W_N: { x: -189, z: -20 },
  // West road (x = -189)
  W_S: { x: -189, z: 47 }, W_GIRLS: { x: -189, z: 77.5 },
  // South road (z = 47)
  S_SH: { x: -162.5, z: 47 }, P1_S: { x: -129.5, z: 47 }, S_CAD: { x: -106, z: 47 }, P2_S: { x: -73.5, z: 47 },
  S_CANT: { x: -40, z: 47 }, P3_S: { x: -28.75, z: 47 }, S_RND: { x: -14, z: 47 }, E_S: { x: 20, z: 47 },
  // S&H-Exam road, east road, parking
  I_EXAM: { x: -129.5, z: 96.5 },
  // Car park access road and the car park's north aisle
  D_LANE: { x: 20, z: -40 }, D_TURN: { x: 57, z: -40 }, PK_N: { x: 57, z: -7 },
};

const EDGE_LIST = [
  ['V_GATE', 'D_LANE'], ['D_LANE', 'V_N'], ['D_LANE', 'D_TURN'], ['D_TURN', 'PK_N'], ['V_N', 'V_S'],
  ['V_N', 'N_PLC'], ['N_PLC', 'N_LIB'], ['N_LIB', 'N_AUD'], ['N_AUD', 'N_BOYS'], ['N_BOYS', 'N_W'], ['N_W', 'N_SEC'],
  ['V_S', 'L_ECE'], ['L_ECE', 'P3_N'], ['P3_N', 'L_CSE'], ['L_CSE', 'L_MID'], ['L_MID', 'P2_N'], ['P2_N', 'L_MECH'],
  ['L_MECH', 'P1_N'], ['P1_N', 'L_CIV'], ['L_CIV', 'W_N'],
  ['N_W', 'W_N'], ['N_LIB', 'L_MID'],
  ['W_N', 'W_S'], ['W_S', 'W_GIRLS'],
  ['W_S', 'S_SH'], ['S_SH', 'P1_S'], ['P1_S', 'S_CAD'], ['S_CAD', 'P2_S'], ['P2_S', 'S_CANT'],
   ['S_CANT', 'P3_S'], ['P3_S', 'S_RND'], ['S_RND', 'E_S'],
  ['P1_N', 'P1_S'], ['P2_N', 'P2_S'], ['P3_N', 'P3_S'], ['P1_S', 'I_EXAM'],
  ['V_S', 'E_S'],
  ['backgate', 'V_GATE'], ['security', 'N_SEC'], ['lib', 'N_LIB'], ['boyshostel', 'N_BOYS'],
  ['frontgate', 'W_N'], ['civilit', 'L_CIV'], ['mecheee', 'L_MECH'], ['cse', 'L_CSE'], ['ece', 'L_ECE'],
  ['girlshostel', 'W_GIRLS'], ['sh', 'S_SH'], ['exam', 'I_EXAM'], ['cad', 'S_CAD'],
  ['cant', 'S_CANT'], ['rnd', 'S_RND'], ['aud', 'N_AUD'], ['placement', 'N_PLC'],
];

BUILDINGS.forEach((b) => { NODES[b.id] = b.gate; });

function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

const ADJACENCY = {};
Object.keys(NODES).forEach((k) => { ADJACENCY[k] = []; });
EDGE_LIST.forEach(([a, c]) => {
  const w = dist(NODES[a], NODES[c]);
  ADJACENCY[a].push({ to: c, w });
  ADJACENCY[c].push({ to: a, w });
});



// ══════════════════════════════════════════════════════════════════════════════
// 4. MAIN REACT COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SuhruthDigitalTwin() {
  const mountRef = useRef(null);
  // Select only what this component needs — subscribing to the whole store re-rendered
  // this (very large) component on every telemetry message.
  const openChatWithTarget = useCampusStore((state) => state.openChatWithTarget);

  // State
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [floorMode, setFloorMode]               = useState('all');
  const [isVisualizerOpen, setIsVisualizerOpen] = useState(false);
  const [visualizerFloor, setVisualizerFloor]   = useState(0);
  const [selectedRoom, setSelectedRoom]         = useState(null);
  const [room3DModal, setRoom3DModal]           = useState(null);
  const [room3DModalTime, setRoom3DModalTime]   = useState(null);
  // Pause the campus render loop while the room walkthrough covers it
  const room3DOpenRef = useRef(false);
  useEffect(() => { room3DOpenRef.current = !!room3DModal; }, [room3DModal]);
  const [simulatedDateTime, setSimulatedDateTime] = useState(null);
  const [fromBuilding, setFromBuilding]         = useState('cant');
  const [toBuilding, setToBuilding]             = useState('lib');
  const [routeInfo, setRouteInfo]               = useState(null);
  const [routeMode, setRouteMode]               = useState('walk');
  // A route asked for by the Navigation page
  const routeRequest = useCampusStore((state) => state.routeRequest);
  const pendingRouteRef = useRef(null);
  const [routeNonce, setRouteNonce] = useState(0);   // re-runs the draw even if the panel already shows this pair
  const [isNightMode, setIsNightMode]           = useState(false);
  const [cameraMode, setCameraMode]             = useState('orbit');
  // Live campus: classes in session per building, the campus clock phase and the real sun
  const [liveInfo, setLiveInfo]                 = useState({ sessions: {}, phase: null });
  const [introPlaying, setIntroPlaying]         = useState(false);
  // Student Services: the service counter modal and the document tokens on the map
  const { user } = useAuth();
  const [counterOpen, setCounterOpen]           = useState(null);
  const [roomCounts, setRoomCounts]             = useState({});   // { buildingId: { classes, labs, rooms } } from the room list
  const [buildingRooms, setBuildingRooms]       = useState({});   // { buildingId: [room, ...] } from the room list
  const docTokenApiRef  = useRef(null);
  // Joining Day quest: the new student's application and the gold "next stop" beacon
  const [joining, setJoining]                   = useState(null);
  const questApiRef     = useRef(null);
  // Leaving the college: one pin per no-dues section (amber waiting, red dues, green cleared)
  const clearanceApiRef = useRef(null);
  const liveRef         = useRef({ sessions: {}, phase: campusPhase(DEFAULT_PERIODS, istNow()) });
  const liveMarkersRef  = useRef({});
  const nightRef        = useRef(false);
  const applySunRef     = useRef(null);
  const introRef        = useRef({ active: false, t: 0 });

  const cameraModeRef = useRef('orbit');
  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  // Weather Store State
  const fetchWeather = useCampusStore((state) => state.fetchWeather);
  const weatherData  = useCampusStore((state) => state.weatherData);
  const isRaining    = useCampusStore((state) => state.isRaining);
  const toggleRain   = useCampusStore((state) => state.toggleRain);
  const initWebSocket = useCampusStore((state) => state.initWebSocket);

  useEffect(() => {
    initWebSocket();
  }, [initWebSocket]);

  // Three.js Refs
  const sceneRef        = useRef(null);
  const ambientLightRef = useRef(null);
  const sunRef          = useRef(null);
  const celestialSunRef = useRef(null);
  const celestialMoonRef= useRef(null);
  const rainSystemRef   = useRef(null);
  const floor1Ref       = useRef([]);
  const floor2Ref       = useRef([]);
  const routeLineRef    = useRef(null);
  const routeDotRef     = useRef(null);
  const routeAnimTRef   = useRef(0);
  const routePtsRef     = useRef(null);
  const streetLightsRef = useRef([]);
  const nightLightsRef  = useRef([]);
  const glowPoolsRef    = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 1000;
    let height = container.clientHeight || 600;

    // Reset refs to avoid duplicates in React Strict Mode
    streetLightsRef.current = [];
    nightLightsRef.current = [];

    // Scene & Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x11151b);
    scene.fog = new THREE.Fog(0x11151b, 420, 1100);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2500);
    const target = new THREE.Vector3(-10, 4, 15);
    let radius = 340, theta = Math.PI * 0.28, phi = Math.PI * 0.32;

    function updateCamera() {
      phi = Math.max(0.15, Math.min(1.35, phi));
      radius = Math.max(60, Math.min(650, radius));
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.sin(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(target);
    }
    updateCamera();

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    // Limit pixel ratio to 1 or 1.25 max to drastically reduce fill rate bottlenecks on Retina screens
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Pickable objects for raycasting
    const pickable = [];

    // Scene
    scene.background = new THREE.Color(0xEDEAE0);
    sceneRef.current = scene;

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(amb);
    ambientLightRef.current = amb;

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.05);
    sun.position.set(-130, 230, 130);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -290; sun.shadow.camera.right = 290;
    sun.shadow.camera.top = 290;   sun.shadow.camera.bottom = -290;
    sun.shadow.camera.far = 700;
    scene.add(sun);
    sunRef.current = sun;

    const fill = new THREE.DirectionalLight(0x9db8d6, 0.35);
    fill.position.set(170, 120, -130);
    scene.add(fill);

    // Base Ground Plane
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 250),
      new THREE.MeshStandardMaterial({ color: 0xEDEAE0, roughness: 1 })
    );
    base.rotation.x = -Math.PI / 2;
    base.receiveShadow = true;
    base.position.set(-5, 0, 15);
    scene.add(base);

    const grid = new THREE.GridHelper(520, 104, 0xbfb9a6, 0xd9d5c8);
    grid.position.set(-5, 0.02, 15);
    grid.material.opacity = 0.5;
    grid.material.transparent = true;
    scene.add(grid);

    // Celestial Bodies (Sun & Moon Meshes)
    const sunGeom = new THREE.SphereGeometry(12, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff0aa, fog: false });
    const celestialSun = new THREE.Mesh(sunGeom, sunMat);
    celestialSun.position.set(-170, 250, 170);
    scene.add(celestialSun);
    celestialSunRef.current = celestialSun;

    const moonGeom = new THREE.SphereGeometry(10, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xc4c7cc, fog: false });
    const celestialMoon = new THREE.Mesh(moonGeom, moonMat);
    celestialMoon.position.set(170, 210, -170);
    celestialMoon.visible = false;
    scene.add(celestialMoon);
    celestialMoonRef.current = celestialMoon;

    // Rain Particle System
    const rainCount = 4000;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 520 - 5;
      rainPos[i * 3 + 1] = Math.random() * 150;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 250 + 15;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x88bbff,
      size: 0.3,
      transparent: true,
      opacity: 0.6
    });
    const rainSystem = new THREE.Points(rainGeo, rainMat);
    rainSystem.visible = false; // Initially off
    scene.add(rainSystem);
    rainSystemRef.current = rainSystem;

    // Canvas Label Maker
    // Every floating name label, so the fly-in can hide them for a clean shot
    const labelSprites = [];
    const setLabelsVisible = (v) => labelSprites.forEach((l) => { l.visible = v; });

    function makeLabel(text, opts = {}) {
      const scale = opts.scale || 1;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const fontSize = 40;
      ctx.font = `600 ${fontSize}px sans-serif`;
      const padX = 22;
      const lines = text.split('\n');
      let maxW = 0;
      lines.forEach((l) => { maxW = Math.max(maxW, ctx.measureText(l).width); });
      canvas.width = maxW + padX * 2;
      canvas.height = fontSize * 1.25 * lines.length + 20;
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.fillStyle = 'rgba(15,19,25,0.82)';
      roundRect(ctx, 0, 0, canvas.width, canvas.height, 16);
      ctx.fill();
      ctx.fillStyle = '#f4f2ea';
      ctx.textBaseline = 'top';
      lines.forEach((l, i) => { ctx.fillText(l, padX, 10 + i * fontSize * 1.25); });
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
      const sprite = new THREE.Sprite(mat);
      const worldW = (canvas.width / canvas.height) * 5.4 * scale;
      sprite.scale.set(worldW, 5.4 * scale, 1);
      sprite.renderOrder = 999;
      labelSprites.push(sprite);
      return sprite;
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    // court = { w, d } cuts an open courtyard through the middle of a box footprint.
    function footprintGeometry(shape, w, d, h, court) {
      if (shape === 'oval') {
        const geo = new THREE.CylinderGeometry(w / 2, w / 2, h, 40);
        geo.scale(1, 1, d / w);
        return geo;
      }
      if (court) {
        const outline = new THREE.Shape();
        outline.moveTo(-w / 2, -d / 2);
        outline.lineTo(w / 2, -d / 2);
        outline.lineTo(w / 2, d / 2);
        outline.lineTo(-w / 2, d / 2);
        outline.closePath();
        const hole = new THREE.Path();
        hole.moveTo(-court.w / 2, -court.d / 2);
        hole.lineTo(-court.w / 2, court.d / 2);
        hole.lineTo(court.w / 2, court.d / 2);
        hole.lineTo(court.w / 2, -court.d / 2);
        hole.closePath();
        outline.holes.push(hole);
        const geo = new THREE.ExtrudeGeometry(outline, { depth: h, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, -h / 2, 0);
        return geo;
      }
      return new THREE.BoxGeometry(w, h, d);
    }

    function createBench(x, z, rotation) {
      const benchGrp = new THREE.Group();
      benchGrp.position.set(x, 0, z);
      if (rotation) benchGrp.rotation.y = rotation;

      // Brightened wood color so they pop out from the grass/path visually
      const seatMat = new THREE.MeshStandardMaterial({ color: 0xD27D2D, roughness: 0.8 });
      const legMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.8 });

      // Scaled up x2 for visibility on the map
      const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 1.0), seatMat);
      seat.position.set(0, 0.6, 0);
      seat.castShadow = true;
      benchGrp.add(seat);

      const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 0.2), seatMat);
      back.position.set(0, 1.1, -0.4);
      back.castShadow = true;
      benchGrp.add(back);

      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.8), legMat);
      leg1.position.set(-1.2, 0.3, 0);
      leg1.castShadow = true;
      benchGrp.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.8), legMat);
      leg2.position.set(1.2, 0.3, 0);
      leg2.castShadow = true;
      benchGrp.add(leg2);

      scene.add(benchGrp);
    }

    // Footprint of a building in world space (hostels are turned 90°, which swaps w and d).
    const footprintOf = (b) => {
      const turned = Math.abs(Math.sin(b.rotY || 0)) > 0.5;
      return { x: b.x, z: b.z, w: turned ? b.d : b.w, d: turned ? b.w : b.d };
    };
    const SOLID_RECTS = [...BUILDINGS.map(footprintOf), ...SOLID_GROUNDS];

    // True when (x, z) is inside the campus wall and clear of every building, road and ground.
    const isOpenGround = (x, z, margin = 3) => {
      let inside = false;
      WALL_RUNS.forEach(([x1, z1, x2, z2]) => {
        if ((z1 > z) !== (z2 > z) && x < ((x2 - x1) * (z - z1)) / (z2 - z1) + x1) inside = !inside;
      });
      if (!inside) return false;
      return !SOLID_RECTS.some((r) => (r.points
        ? insidePolygon(r.points, x, z)
        : Math.abs(x - r.x) < r.w / 2 + margin && Math.abs(z - r.z) < r.d / 2 + margin));
    };

    // Street Light Helper
    const createStreetLight = (x, z) => {
      const group = new THREE.Group();
      
      const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 7, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x2A2D34, metalness: 0.6, roughness: 0.4 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 3.5;
      pole.castShadow = true;
      group.add(pole);
      
      // Arm 1
      const arm1Geo = new THREE.CylinderGeometry(0.08, 0.08, 2, 8);
      const arm1 = new THREE.Mesh(arm1Geo, poleMat);
      arm1.rotation.x = Math.PI / 2;
      arm1.position.set(0, 6.8, 1);
      group.add(arm1);
      
      // Arm 2
      const arm2 = arm1.clone();
      arm2.position.set(0, 6.8, -1);
      group.add(arm2);
      
      // Lamp Housing 1 & 2
      const headGeo = new THREE.BoxGeometry(0.4, 0.2, 0.8);
      const head1 = new THREE.Mesh(headGeo, poleMat);
      head1.position.set(0, 6.8, 2);
      group.add(head1);
      
      const head2 = head1.clone();
      head2.position.set(0, 6.8, -2);
      group.add(head2);
      
      // Bulb 1 & 2
      const bulbGeo = new THREE.PlaneGeometry(0.3, 0.6);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const bulb1 = new THREE.Mesh(bulbGeo, bulbMat);
      bulb1.rotation.x = Math.PI / 2;
      bulb1.position.set(0, 6.69, 2);
      group.add(bulb1);
      
      const bulb2 = bulb1.clone();
      bulb2.position.set(0, 6.69, -2);
      group.add(bulb2);
      
      const light1 = new THREE.PointLight(0xffddaa, 0, 40, 1.5);
      light1.position.set(0, 6.4, 2);
      group.add(light1);

      const light2 = new THREE.PointLight(0xffddaa, 0, 40, 1.5);
      light2.position.set(0, 6.4, -2);
      group.add(light2);
      
      // Position base on top of the median
      group.position.set(x, 0.6, z);
      scene.add(group);

      streetLightsRef.current.push({ bulbMat, light1, light2 });
    };

    // Add Double-arm street lights along the boulevard median (gap at the library crossing)
    for (let x = -175; x <= -85; x += 15) createStreetLight(x, -25);
    for (let x = -45; x <= 0; x += 15) createStreetLight(x, -25);

    // Benches facing the library entrance
    createBench(-71, -38, 0);
    createBench(-55, -38, 0);

    // Benches on the walkway in front of the academic blocks
    createBench(-140, -13, 0);
    createBench(-118, -13, 0);
    createBench(-88, -13, 0);
    createBench(-60, -13, 0);

    // Benches all the way down the walk at the edge of the Ground, facing the field (as in the original design)
    for (let z = -13; z <= 41; z += 6) {
      createBench(25.5, z, Math.PI / 2);
    }
    // Walkway lamps in the gaps between the benches (lit with the street lamps at night)
    [-4, 2, 14, 20, 32, 38].forEach((z) => {
      const lamp = createBollardLamp(24.2, z);
      scene.add(lamp.group);
      streetLightsRef.current.push(lamp);
    });

    // ══════════════════════════════════════════════════════════════════════════
    // REALISTIC 3D TREES & GREENERY GENERATOR
    // ══════════════════════════════════════════════════════════════════════════
    function createTree(x, z, scale = 1, type = 'oak') {
      const treeGrp = new THREE.Group();
      treeGrp.position.set(x, 0, z);

      const barkMat = new THREE.MeshStandardMaterial({ color: 0x4A3525, roughness: 0.9 });
      
      if (type === 'pine') {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.35 * scale, 3 * scale, 6), barkMat);
        trunk.position.y = 1.5 * scale;
        treeGrp.add(trunk);

        const pineMat = new THREE.MeshStandardMaterial({ color: 0x1E3812, roughness: 0.8 });
        for (let i = 0; i < 3; i++) {
          const coneRadius = (1.8 - i * 0.4) * scale;
          const coneH = (2.5 - i * 0.4) * scale;
          const cone = new THREE.Mesh(new THREE.ConeGeometry(coneRadius, coneH, 6), pineMat);
          cone.position.y = (2.8 + i * 1.4) * scale;
          treeGrp.add(cone);
        }
      } else if (type === 'palm') {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 5 * scale, 6), barkMat);
        trunk.position.y = 2.5 * scale;
        treeGrp.add(trunk);

        const leafMat = new THREE.MeshStandardMaterial({ color: 0x3E8E2D, roughness: 0.6, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
          const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * scale, 2.2 * scale), leafMat);
          leaf.position.set(0, 5 * scale, 0);
          leaf.rotation.x = Math.PI / 3;
          leaf.rotation.y = (i * Math.PI) / 2.5;
          treeGrp.add(leaf);
        }
      } else {
        // Oak / Deciduous
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scale, 0.45 * scale, 3.5 * scale, 6), barkMat);
        trunk.position.y = 1.75 * scale;
        treeGrp.add(trunk);

        const folMat1 = new THREE.MeshStandardMaterial({ color: 0x3A5F0B, roughness: 0.8 });
        const folMat2 = new THREE.MeshStandardMaterial({ color: 0x487012, roughness: 0.8 });
        
        const f1 = new THREE.Mesh(new THREE.SphereGeometry(1.6 * scale, 8, 8), folMat1);
        f1.position.set(0, 4.2 * scale, 0);
        treeGrp.add(f1);

        const f2 = new THREE.Mesh(new THREE.SphereGeometry(1.2 * scale, 8, 8), folMat2);
        f2.position.set(0.7 * scale, 4.6 * scale, -0.3 * scale);
        treeGrp.add(f2);
      }

      scene.add(treeGrp);
    }

    // Populate Campus Trees
    // 1. Trees along the boulevard median (the satellite view shows a continuous tree line)
    for (let x = -180; x <= 6; x += 12) {
      if (Math.abs(x + 63) < 9) continue; // library crossing
      createTree(x, -25, 0.85, x % 24 === 0 ? 'palm' : 'oak');
    }
    // 2. Tree belts just inside the boundary wall and around the open ground
    const treeLines = [
      { from: [-170, -36], to: [12, -36], step: 11, type: 'oak' },     // north side of boulevard
      { from: [-220, -73], to: [16, -73], step: 10, type: 'pine' },    // north wall
      { from: [44, -66], to: [210, -45], step: 12, type: 'pine' },     // north-east wall
      { from: [-223, -70], to: [-223, 118], step: 10, type: 'oak' },   // west wall
      { from: [-180, 53], to: [-30, 53], step: 13, type: 'oak' },      // south road verge
      { from: [160, 30], to: [160, 80], step: 10, type: 'oak' },       // east of the ground
      { from: [-50, 81], to: [150, 81], step: 12, type: 'pine' },      // south wall (east part)
    ];
    treeLines.forEach(({ from: [x1, z1], to: [x2, z2], step, type }) => {
      const n = Math.max(1, Math.round(Math.hypot(x2 - x1, z2 - z1) / step));
      for (let i = 0; i <= n; i++) {
        const x = x1 + ((x2 - x1) * i) / n;
        const z = z1 + ((z2 - z1) * i) / n;
        if (isOpenGround(x, z, 2)) createTree(x, z, 0.9 + (i % 3) * 0.1, i % 4 === 0 ? 'palm' : type);
      }
    });
    // 3. Oaks between the benches on the Ground's bench walk
    [-10, 8, 26, 44].forEach((z) => createTree(26.5, z, 1.0, 'oak'));

    // ══════════════════════════════════════════════════════════════════════════
    // LANDSCAPING: flower beds flanking the entrances on the boulevard side
    // ══════════════════════════════════════════════════════════════════════════
    let bedSeed = 1;
    ['civilit', 'mecheee', 'cse', 'ece', 'lib', 'placement'].forEach((id) => {
      const b = BUILDINGS.find((x) => x.id === id);
      const facesSouth = !b.rotY;                      // library & placement cell face the boulevard to the south
      const z = facesSouth ? b.z + b.d / 2 + 2 : b.z - b.d / 2 - 2.2;
      const left = b.x - b.w / 2 + 1.2;
      const right = b.x + b.w / 2 - 1.2;
      [[left, b.gate.x - 3.2], [b.gate.x + 3.2, right]].forEach(([x1, x2]) => {
        if (x2 - x1 > 2) scene.add(createFlowerBed((x1 + x2) / 2, z, x2 - x1, 1.6, bedSeed++));
      });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // WAYFINDING: fingerposts at the main junctions + name plaques at entrances
    // ══════════════════════════════════════════════════════════════════════════
    [
      // Just inside the main gate
      [-212, -13, [
        { label: 'Academic Blocks · Library', heading: 'east' },
        { label: 'Boys Hostel · Bank', heading: 'north' },
        { label: 'Girls Hostel · S&H · Exam', heading: 'south' },
      ]],
      // In front of CSE, by the CSE-ECE road
      [-37, -12, [
        { label: 'ECE · Car Park · Back Gate', heading: 'east' },
        { label: 'Mech & EEE · Civil · Main Gate', heading: 'west' },
        { label: 'Library · Placement Cell', heading: 'north' },
        { label: 'Canteen · R&D (via road)', heading: 'south' },
      ]],
      // South road, by the canteen
      [-24, 53, [
        { label: 'Basketball · Ground', heading: 'east' },
        { label: 'S&H · Exam · CAD Lab', heading: 'west' },
        { label: 'CSE · ECE', heading: 'north' },
      ]],
      // Inside the back gate
      [28, -66, [
        { label: 'Academic Blocks · Library', heading: 'south' },
        { label: 'Car Park · Bus Bay', heading: 'east' },
      ]],
    ].forEach(([x, z, boards]) => scene.add(createSignpost(x, z, boards)));

    BUILDINGS.forEach((b) => {
      if (!b.gate || !b.link || ['frontgate', 'backgate', 'security'].includes(b.id)) return;
      const dx = b.link.x - b.gate.x;
      const dz = b.link.z - b.gate.z;
      const len = Math.hypot(dx, dz) || 1;
      // Beside the entrance path, facing the road the path leads to
      scene.add(createPlaque(b.gate.x - (dz / len) * 4, b.gate.z + (dx / len) * 4, Math.atan2(dx, dz), b.name));
    });

    // ══════════════════════════════════════════════════════════════════════════
    // REALISTIC GARDEN FEATURES
    // ══════════════════════════════════════════════════════════════════════════
    function createBush(x, z, scale = 1) {
      const bushMat = new THREE.MeshStandardMaterial({ color: 0x3A5F0B, roughness: 0.9 });
      const bushGeo = new THREE.SphereGeometry(0.8 * scale, 7, 7);
      const bush = new THREE.Mesh(bushGeo, bushMat);
      bush.position.set(x, 0.4 * scale, z);
      bush.castShadow = true;
      scene.add(bush);
    }

    function createFountain(x, z) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      const stoneMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8 });
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x3399ff, roughness: 0.1, transparent: true, opacity: 0.8 });

      const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.4, 24), stoneMat);
      base.position.y = 0.2;
      base.castShadow = true;
      group.add(base);

      const water = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.45, 24), waterMat);
      water.position.y = 0.2;
      group.add(water);

      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 2, 12), stoneMat);
      pillar.position.y = 1;
      pillar.castShadow = true;
      group.add(pillar);

      const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.2, 16), stoneMat);
      tier1.position.y = 2;
      tier1.castShadow = true;
      group.add(tier1);

      const topWater = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.25, 16), waterMat);
      topWater.position.y = 2;
      group.add(topWater);

      scene.add(group);
    }

    // Populate the Rock Garden (west edge of campus)
    const GX = -211, GZ = 15;
    createFountain(GX, GZ);

    // Cross pathways inside garden
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(28, 0.36, 3), new THREE.MeshStandardMaterial({ color: 0xC9C4B8, roughness: 1 }));
    p1.position.set(GX, 0.18, GZ);
    p1.receiveShadow = true;
    scene.add(p1);

    const p2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.36, 42), new THREE.MeshStandardMaterial({ color: 0xC9C4B8, roughness: 1 }));
    p2.position.set(GX, 0.18, GZ);
    p2.receiveShadow = true;
    scene.add(p2);

    // Benches around fountain
    createBench(GX, GZ + 5, 0); // North
    createBench(GX, GZ - 5, Math.PI); // South
    createBench(GX - 5, GZ, Math.PI / 2); // West
    createBench(GX + 5, GZ, -Math.PI / 2); // East

    // Bushes at corners
    createBush(GX - 12, GZ + 10, 1.2); createBush(GX - 10, GZ + 9, 0.9);
    createBush(GX + 12, GZ - 10, 1.3); createBush(GX + 10, GZ - 9, 1.0);
    createBush(GX - 12, GZ - 10, 1.1); createBush(GX + 12, GZ + 10, 1.1);

    // Boulders that give the Rock Garden its name
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8C8577, roughness: 0.95 });
    [[-9, -16, 1.6], [8, -17, 1.2], [-11, 17, 1.4], [10, 15, 1.8], [-4, -19, 0.9], [5, 19, 1.0]].forEach(([dx, dz, r]) => {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
      rock.position.set(GX + dx, r * 0.6, GZ + dz);
      rock.rotation.set(dx, dz, 0);
      rock.castShadow = true;
      scene.add(rock);
    });

    // Additional Garden Trees
    createTree(GX - 10, GZ - 8, 1.1, 'oak');
    createTree(GX + 9, GZ - 8, 0.9, 'pine');
    createTree(GX - 10, GZ + 8, 1.2, 'oak');
    createTree(GX + 9, GZ + 8, 1.0, 'palm');

    // ══════════════════════════════════════════════════════════════════════════
    // REALISTIC SPORTS GROUNDS
    // ══════════════════════════════════════════════════════════════════════════
    function createBasketballCourtFeatures(cx, cz, cw, cd) {
      // Built with the long axis along local x, then turned to match the court.
      const court = new THREE.Group();
      court.position.set(cx, 0, cz);
      if (cd > cw) court.rotation.y = Math.PI / 2;
      scene.add(court);
      const x = 0, z = 0;
      const w = Math.max(cw, cd), d = Math.min(cw, cd);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const h = 0.36;

      const createLine = (lx, lz, lw, ld) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.05, ld), lineMat);
        line.position.set(lx, h, lz);
        court.add(line);
      };

      createLine(x, z, 0.3, d - 2); // Center line
      createLine(x, z - d/2 + 1, w - 2, 0.3); // Top line
      createLine(x, z + d/2 - 1, w - 2, 0.3); // Bottom line
      createLine(x - w/2 + 1, z, 0.3, d - 2); // Left line
      createLine(x + w/2 - 1, z, 0.3, d - 2); // Right line
      
      const circleGeo = new THREE.RingGeometry(1.5, 1.8, 24);
      const circle = new THREE.Mesh(circleGeo, lineMat);
      circle.rotation.x = -Math.PI / 2;
      circle.position.set(x, h, z);
      court.add(circle);

      const hoopMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9 });
      const backboardMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      
      const createHoop = (hx, hz, rotY) => {
        const grp = new THREE.Group();
        grp.position.set(hx, 0, hz);
        grp.rotation.y = rotY;
        
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 8), hoopMat);
        pole.position.y = 1.5;
        grp.add(pole);
        
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.1), backboardMat);
        board.position.set(0, 3, 0.2);
        grp.add(board);
        
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 24), new THREE.MeshStandardMaterial({color: 0xff0000}));
        rim.rotation.x = -Math.PI / 2;
        rim.position.set(0, 2.7, 0.5);
        grp.add(rim);

        court.add(grp);
      };
      
      createHoop(x - w/2 + 1.2, z, Math.PI / 2);
      createHoop(x + w/2 - 1.2, z, -Math.PI / 2);
    }

    // Cricket pitch and boundary rope on the open part of the ground
    function createCricketFeatures(cx, cz, boundaryR) {
      const pitch = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0xC2A36B, roughness: 1 }));
      pitch.position.set(cx, 0.37, cz);
      scene.add(pitch);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      [-8.8, 8.8].forEach((dz) => {
        const crease = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 0.15), lineMat);
        crease.position.set(cx, 0.41, cz + dz);
        scene.add(crease);
      });
      const rope = new THREE.Mesh(new THREE.RingGeometry(boundaryR - 0.4, boundaryR, 64), lineMat);
      rope.rotation.x = -Math.PI / 2;
      rope.position.set(cx, 0.38, cz);
      scene.add(rope);
    }

    createCricketFeatures(126, 20, 30);
    createBasketballCourtFeatures(6, 69, 18, 30);

    // ══════════════════════════════════════════════════════════════════════════
    // REALISTIC PARKING LOTS & VEHICLES
    // ══════════════════════════════════════════════════════════════════════════
    function createVehicle(x, z, rotY, type, scale = 1) {
      const group = new THREE.Group();
      group.position.set(x, 0.4, z);
      group.rotation.y = rotY;
      
      const colors = [0x990000, 0x111155, 0xdddddd, 0x222222, 0xffffff, 0xaaaaaa, 0x005500, 0xcc8800];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.7 });
      const windowMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 });
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

      if (type === 'car') {
        const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2 * scale, 0.6 * scale, 4 * scale), bodyMat);
        lowerBody.position.y = 0.5 * scale;
        lowerBody.castShadow = true;
        group.add(lowerBody);

        const upperBody = new THREE.Mesh(new THREE.BoxGeometry(1.8 * scale, 0.5 * scale, 2.2 * scale), windowMat);
        upperBody.position.set(0, 1.05 * scale, -0.2 * scale);
        upperBody.castShadow = true;
        group.add(upperBody);

        const wheelGeo = new THREE.CylinderGeometry(0.35 * scale, 0.35 * scale, 0.2 * scale, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        
        const w1 = new THREE.Mesh(wheelGeo, wheelMat);
        w1.position.set(-1.0 * scale, 0.35 * scale, 1.2 * scale);
        w1.castShadow = true;
        
        const w2 = new THREE.Mesh(wheelGeo, wheelMat);
        w2.position.set(1.0 * scale, 0.35 * scale, 1.2 * scale);
        w2.castShadow = true;
        
        const w3 = new THREE.Mesh(wheelGeo, wheelMat);
        w3.position.set(-1.0 * scale, 0.35 * scale, -1.2 * scale);
        w3.castShadow = true;
        
        const w4 = new THREE.Mesh(wheelGeo, wheelMat);
        w4.position.set(1.0 * scale, 0.35 * scale, -1.2 * scale);
        w4.castShadow = true;
        
        group.add(w1, w2, w3, w4);
      } else if (type === 'bike') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 0.6 * scale, 1.8 * scale), bodyMat);
        body.position.y = 0.6 * scale;
        body.castShadow = true;
        group.add(body);

        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 0.2 * scale, 0.8 * scale), new THREE.MeshStandardMaterial({color: 0x111111}));
        seat.position.set(0, 0.9 * scale, 0);
        group.add(seat);

        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 0.8 * scale, 8), wheelMat);
        handle.rotation.z = Math.PI / 2;
        handle.position.set(0, 1.0 * scale, 0.7 * scale);
        group.add(handle);

        const wheelGeo = new THREE.CylinderGeometry(0.35 * scale, 0.35 * scale, 0.1 * scale, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        
        const w1 = new THREE.Mesh(wheelGeo, wheelMat);
        w1.position.set(0, 0.35 * scale, 0.9 * scale);
        w1.castShadow = true;
        
        const w2 = new THREE.Mesh(wheelGeo, wheelMat);
        w2.position.set(0, 0.35 * scale, -0.9 * scale);
        w2.castShadow = true;
        
        group.add(w1, w2);
      }
      
      return group;
    }

    let smartParkingSpots = [];

    function createParkingLotFeatures() {
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const paint = (x, z, w, d) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), lineMat);
        line.position.set(x, 0.4, z);
        scene.add(line);
      };

      // Car park: 4 rows x 15 bays = 60 bays, one per spot in the backend telemetry
      // (spot_0..spot_59). Rows run east-west; aisles at z -10..-4, 6..12 and 22..28.
      const BAY_W = 2.6, BAY_D = 5, X0 = 39.5, BAYS = 15;
      const ROWS = [
        { z0: -4, face: Math.PI }, // nose north, onto the north aisle
        { z0: 1,  face: 0 },       // back-to-back with row 1, nose south
        { z0: 12, face: Math.PI },
        { z0: 17, face: 0 },
      ];
      const rowLen = BAY_W * BAYS;
      let spotId = 0;
      ROWS.forEach(({ z0, face }) => {
        for (let i = 0; i <= BAYS; i++) paint(X0 + i * BAY_W, z0 + BAY_D / 2, 0.12, BAY_D); // bay dividers
        for (let i = 0; i < BAYS; i++) {
          smartParkingSpots.push({ id: `spot_${spotId++}`, x: X0 + BAY_W * (i + 0.5), z: z0 + BAY_D / 2, rotY: face });
        }
      });
      paint(X0 + rowLen / 2, 1, rowLen, 0.12);  // back line between rows 1 and 2
      paint(X0 + rowLen / 2, 17, rowLen, 0.12); // back line between rows 3 and 4
      // Dashed centre lines down each aisle
      [-7, 9, 25].forEach((az) => {
        for (let x = X0 + 1; x < X0 + rowLen - 1; x += 3) paint(x, az, 1.4, 0.12);
      });

      // College buses in the bus bay (yellow fleet visible on satellite imagery)
      const busMat = new THREE.MeshStandardMaterial({ color: 0xF2C230, roughness: 0.6 });
      const busGlass = new THREE.MeshStandardMaterial({ color: 0x1F2937, roughness: 0.2, metalness: 0.6 });
      for (let i = 0; i < 6; i++) {
        const bus = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, 11), busMat);
        body.position.y = 1.9;
        body.castShadow = true;
        const glass = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.9, 10), busGlass);
        glass.position.y = 2.6;
        bus.add(body, glass);
        bus.position.set(72 + i * 4.6, 0.38, -38);
        scene.add(bus);
      }
      // Bus bays painted around the six buses
      for (let i = 0; i <= 6; i++) paint(69.7 + i * 4.6, -38, 0.12, 12);
      paint(69.7 + 13.8, -44, 27.6, 0.12);

      // Initialize Zustand state with smartParkingSpots
      const initialStoreSpots = smartParkingSpots.map(s => ({ id: s.id, occupied: Math.random() > 0.3 }));
      useCampusStore.getState().initParkingSpots(initialStoreSpots);

      // Create geometry for each spot (bay tint + car)
      smartParkingSpots = smartParkingSpots.map((s, idx) => {
        const occupied = initialStoreSpots[idx].occupied;
        const group = new THREE.Group();
        group.position.set(s.x, 0.39, s.z);
        group.rotation.y = s.rotY;

        // Bay tint: soft green while free, hidden while a car is parked
        const indicator = new THREE.Mesh(
          new THREE.PlaneGeometry(BAY_W - 0.4, BAY_D - 0.4),
          new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: occupied ? 0 : 0.35 })
        );
        indicator.rotation.x = -Math.PI / 2;
        indicator.position.y = 0.02;
        group.add(indicator);

        // Vehicle (relative to group, so 0,0,0)
        const v = createVehicle(0, 0, 0, 'car', 0.95);
        v.position.y -= 0.4; // offset the vehicle height since createVehicle sets y=0.4
        v.visible = occupied;
        group.add(v);

        scene.add(group);

        return { ...s, group, indicator, vehicle: v };
      });
    }

    createParkingLotFeatures();

    // Subscribe to parking changes in Zustand to update 3D scene.
    // (The plain zustand store only supports subscribe(listener), so compare manually.)
    const spotsById = new Map(smartParkingSpots.map((s) => [s.id, s]));
    const unsubParking = useCampusStore.subscribe((state, prev) => {
      const parkingData = state.parkingData;
      if (parkingData === prev.parkingData || !parkingData || !parkingData.spots) return;

      parkingData.spots.forEach(storeSpot => {
        const meshSpot = spotsById.get(storeSpot.id);
        if (meshSpot) {
          meshSpot.vehicle.visible = storeSpot.occupied;
          meshSpot.indicator.material.opacity = storeSpot.occupied ? 0 : 0.35;
        }
      });
    });


    // ══════════════════════════════════════════════════════════════════════════
    // REALISTIC 3D STUDENTS & ANIMATION SYSTEM
    // ══════════════════════════════════════════════════════════════════════════
    const studentList = [];

    function createStudentMesh(shirtColor = 0x3B82F6, pantsColor = 0x1E293B) {
      const group = new THREE.Group();

      const skinMat = new THREE.MeshStandardMaterial({ color: 0xF5CBA7, roughness: 0.6 });
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
      const bagMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });

      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.4), shirtMat);
      torso.position.y = 1.35;
      torso.castShadow = true;
      group.add(torso);

      // Backpack
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.25), bagMat);
      bag.position.set(0, 1.35, -0.3);
      bag.castShadow = true;
      group.add(bag);

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), skinMat);
      head.position.y = 2.05;
      head.castShadow = true;
      group.add(head);

      // Hair/Cap
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      hair.position.y = 2.08;
      group.add(hair);

      // Left Leg
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), pantsMat);
      legL.position.set(-0.16, 0.5, 0);
      legL.castShadow = true;
      group.add(legL);

      // Right Leg
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), pantsMat);
      legR.position.set(0.16, 0.5, 0);
      legR.castShadow = true;
      group.add(legR);

      // Left Arm
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), shirtMat);
      armL.position.set(-0.42, 1.3, 0);
      armL.castShadow = true;
      group.add(armL);

      // Right Arm
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), shirtMat);
      armR.position.set(0.42, 1.3, 0);
      armR.castShadow = true;
      group.add(armR);

      group.scale.set(0.7, 0.7, 0.7);
      return { group, legL, legR, armL, armR };
    }

    // Static Students sitting on benches / chatting
    const staticConfigs = [
      { x: -71, z: -37, rot: 0, profileIdx: 2 },
      { x: -55, z: -37, rot: 0, profileIdx: 4 },
      { x: -140, z: -12, rot: 0, profileIdx: 5 },
      { x: -118, z: -12, rot: 0, profileIdx: 6 },
      { x: 25.5, z: -1, rot: Math.PI / 2, profileIdx: 1 }, // on a bench at the edge of the Ground
    ];

    staticConfigs.forEach((cfg) => {
      const prof = STUDENT_PROFILES[cfg.profileIdx % STUDENT_PROFILES.length];
      const s = createStudentMesh(0xEF4444 + cfg.profileIdx * 0x112233, 0x1E293B);
      s.group.position.set(cfg.x, 0, cfg.z);
      s.group.rotation.y = cfg.rot;
      const userDataObj = {
        building: {
          id: prof.id,
          name: prof.name,
          type: 'Campus Student',
          depts: [prof.dept, prof.activity],
          x: cfg.x,
          z: cfg.z,
        },
      };
      s.group.userData = userDataObj;
      s.group.children.forEach(c => { c.userData = userDataObj; pickable.push(c); });
      scene.add(s.group);
      studentList.push(s);
    });

    // Animated Walking Students along Campus Pathways
    const walkerRoutes = [
      {
        prof: STUDENT_PROFILES[0],
        color: 0x3B82F6,
        pts: [new THREE.Vector3(-180, 0, -14.5), new THREE.Vector3(10, 0, -14.5)],
        speed: 4,
      },
      {
        prof: STUDENT_PROFILES[3],
        color: 0x10B981,
        pts: [new THREE.Vector3(13, 0, -75), new THREE.Vector3(13, 0, -36)],
        speed: 3.5,
      },
      {
        prof: STUDENT_PROFILES[7],
        color: 0xF59E0B,
        pts: [new THREE.Vector3(-129.5, 0, -14), new THREE.Vector3(-129.5, 0, 44)],
        speed: 4.2,
      },
    ];

    const activeWalkers = walkerRoutes.map((r) => {
      const s = createStudentMesh(r.color, 0x0F172A);
      const userDataObj = {
        building: {
          id: r.prof.id,
          name: r.prof.name,
          type: 'Walking Student',
          depts: [r.prof.dept, r.prof.activity],
          x: r.pts[0].x,
          z: r.pts[0].z,
        },
      };
      s.group.userData = userDataObj;
      s.group.children.forEach(c => { c.userData = userDataObj; pickable.push(c); });
      scene.add(s.group);
      return {
        ...s,
        pts: r.pts,
        speed: r.speed,
        progress: Math.random(),
        forward: true,
      };
    });

    // Build Buildings
    const floor1List = [];
    const floor2List = [];
    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);

    BUILDINGS.forEach((b) => {
      const grp = new THREE.Group();
      grp.position.set(b.x, 0, b.z);
      if (b.rotY) grp.rotation.y = b.rotY;

      // --- Entrance pathway from the building's gate to its road (b.link) ---
      if (b.gate && b.link && b.id !== 'frontgate' && b.id !== 'backgate') {
        const dx = b.link.x - b.gate.x;
        const dz = b.link.z - b.gate.z;
        const pathLen = Math.hypot(dx, dz);
        if (pathLen > 0.5) {
          const pathGeo = new THREE.BoxGeometry(4, 0.35, pathLen);
          const pathMat = new THREE.MeshStandardMaterial({ color: 0xC9C4B8, roughness: 1 });
          const pathMesh = new THREE.Mesh(pathGeo, pathMat);
          pathMesh.position.set((b.gate.x + b.link.x) / 2, 0.18, (b.gate.z + b.link.z) / 2);
          pathMesh.rotation.y = Math.atan2(dx, dz);
          pathMesh.receiveShadow = true;
          scene.add(pathMesh);
        }
      }

      const baseColor = new THREE.Color(b.color);
      const f1Color = baseColor.clone().offsetHSL(0, 0, -0.04);
      const f2Color = baseColor.clone().offsetHSL(0, 0, 0.09);

      // Floor 1
      const f1geo = footprintGeometry(b.shape, b.w, b.d, FLOOR_H, b.court);
      const f1mat = new THREE.MeshStandardMaterial({ color: f1Color, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 1 });
      const f1 = new THREE.Mesh(f1geo, f1mat);
      f1.position.y = FLOOR_H / 2;
      f1.castShadow = true; f1.receiveShadow = true;
      f1.userData = { building: b, floor: 1 };
      grp.add(f1); floor1List.push(f1); pickable.push(f1);

      const floors = b.floors || 2;
      if (floors >= 2) {
        // Floor 2
        const f2geo = footprintGeometry(b.shape, b.w * 0.985, b.d * 0.985, FLOOR_H, b.court);
        const f2mat = new THREE.MeshStandardMaterial({ color: f2Color, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 1 });
        const f2 = new THREE.Mesh(f2geo, f2mat);
        f2.position.y = FLOOR_H + FLOOR_H / 2;
        f2.castShadow = true; f2.receiveShadow = true;
        f2.userData = { building: b, floor: 2 };
        grp.add(f2); floor2List.push(f2); pickable.push(f2);
      }
      // Floors above the first floor count as upper floors for the floor-mode toggle
      for (let level = 3; level <= floors; level++) {
        const fGeo = footprintGeometry(b.shape, b.w * 0.985, b.d * 0.985, FLOOR_H, b.court);
        const fMat = new THREE.MeshStandardMaterial({ color: level % 2 ? f1Color : f2Color, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 1 });
        const fN = new THREE.Mesh(fGeo, fMat);
        fN.position.y = FLOOR_H * (level - 1) + FLOOR_H / 2;
        fN.castShadow = true; fN.receiveShadow = true;
        fN.userData = { building: b, floor: level };
        grp.add(fN); floor2List.push(fN); pickable.push(fN);

        const levelSlab = new THREE.Mesh(footprintGeometry(b.shape, b.w * 1.02, b.d * 1.02, 0.22, b.court),
          new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.9 }));
        levelSlab.position.y = FLOOR_H * (level - 1);
        grp.add(levelSlab);
      }

      // Slabs
      const slabGeo = footprintGeometry(b.shape, b.w * 1.02, b.d * 1.02, 0.22, b.court);
      const slab = new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.9 }));
      slab.position.y = FLOOR_H;
      grp.add(slab);

      if (floors >= 2) {
        const roofGeo = footprintGeometry(b.shape, b.w * 1.02, b.d * 1.02, 0.22, b.court);
        // Light concrete, like the flat RCC roofs on the satellite imagery
        const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xB5AFA3, roughness: 0.9 }));
        roof.position.y = FLOOR_H * floors + 0.11;
        grp.add(roof);
      }

      // ══════════════════════════════════════════════════════════════════════
      // CIVIL & IT BLOCK ARCHITECTURAL FACADE (NEOCLASSICAL GRAND ENTRANCE)
      // ══════════════════════════════════════════════════════════════════════
      if (b.id === 'civilit') {
        const facadeMat = new THREE.MeshStandardMaterial({ color: 0xBA6B44, roughness: 0.65 });
        const whiteStoneMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.35 });
        const darkGraniteMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.25, metalness: 0.2 });
        const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xC5A059, roughness: 0.3, metalness: 0.8 });
        const railMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.1, metalness: 0.9 });

        // Override floor 1 & 2 facade styling
        f1.material = facadeMat;
        if (floor2List.length > 0 && floor2List[floor2List.length - 1]) {
          floor2List[floor2List.length - 1].material = facadeMat;
        }

        // 1. Classical White Triangular Pediment / Gable Roof over Grand Portico
        const pedimentW = 13.0;
        const pedimentH = 3.2;
        const pedimentD = 3.8;

        const pedShape = new THREE.Shape();
        pedShape.moveTo(-pedimentW / 2, 0);
        pedShape.lineTo(0, pedimentH);
        pedShape.lineTo(pedimentW / 2, 0);
        pedShape.closePath();

        const pedGeo = new THREE.ExtrudeGeometry(pedShape, { depth: pedimentD, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12 });
        const pedMesh = new THREE.Mesh(pedGeo, whiteStoneMat);
        pedMesh.position.set(0, (floors * FLOOR_H) - 0.2, b.d / 2 - 0.5);
        grp.add(pedMesh);

        // 2. Four Monumental White Columns (Tuscan/Ionic)
        const colH = (floors * FLOOR_H) - 0.2;
        const colSpacing = 3.4;
        const colZ = b.d / 2 + 2.8;

        [-1.5, -0.5, 0.5, 1.5].forEach((posMultiplier) => {
          const colX = posMultiplier * colSpacing;
          const colGrp = new THREE.Group();
          colGrp.position.set(colX, 0, colZ);

          // Column Shaft
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, colH, 20), whiteStoneMat);
          shaft.position.y = colH / 2;
          shaft.castShadow = true;
          shaft.receiveShadow = true;
          colGrp.add(shaft);

          // Capital (Top)
          const capital = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), whiteStoneMat);
          capital.position.y = colH - 0.15;
          colGrp.add(capital);

          // Plinth Base (Bottom)
          const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), whiteStoneMat);
          basePlinth.position.y = 0.2;
          colGrp.add(basePlinth);

          grp.add(colGrp);
        });

        // 3. Portico Ceiling / Entablature Slab
        const entablature = new THREE.Mesh(new THREE.BoxGeometry(pedimentW + 0.8, 0.6, pedimentD + 0.6), whiteStoneMat);
        entablature.position.set(0, (floors * FLOOR_H) - 0.5, b.d / 2 + 1.4);
        grp.add(entablature);

        // 4. Arched Windows & Grand Central Arched Entrance on Facade
        const archWindowGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.1, 16, 1, false, 0, Math.PI);
        // Plain transparent glass. (transmission: 0.85 here made three.js render the whole
        // campus a second time every frame, just for these few arched windows.)
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x93C5FD, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.7 });

        // Central Grand Arched Portal
        const portalArch = new THREE.Mesh(archWindowGeo, glassMat);
        portalArch.rotation.z = Math.PI / 2;
        portalArch.rotation.y = Math.PI / 2;
        portalArch.position.set(0, 3.8, b.d / 2 + 0.05);
        grp.add(portalArch);

        const portalBase = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.5), glassMat);
        portalBase.position.set(0, 2.5 / 2, b.d / 2 + 0.05);
        grp.add(portalBase);

        // Flanking Arched Windows on Left & Right
        [-4.2, 4.2].forEach((wx) => {
          const wArch = new THREE.Mesh(archWindowGeo, glassMat);
          wArch.rotation.z = Math.PI / 2;
          wArch.rotation.y = Math.PI / 2;
          wArch.position.set(wx, 4.2, b.d / 2 + 0.05);
          grp.add(wArch);

          const wBase = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.8), glassMat);
          wBase.position.set(wx, 2.4, b.d / 2 + 0.05);
          grp.add(wBase);
        });

        // 5. Grand White Tiered Marble Stairs Leading to Entrance
        const stepCount = 6;
        const stairWidth = 11.0;
        for (let s = 0; s < stepCount; s++) {
          const stepW = stairWidth - s * 0.35;
          const stepH = 0.22;
          const stepD = 0.6;
          const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH * (stepCount - s), stepD), whiteStoneMat);
          stepMesh.position.set(0, (stepH * (stepCount - s)) / 2, b.d / 2 + 3.2 + s * stepD);
          stepMesh.receiveShadow = true;
          grp.add(stepMesh);
        }

        // Silver Handrails along Stairs
        [-stairWidth / 2 + 0.2, stairWidth / 2 - 0.2].forEach((rx) => {
          const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.8), railMat);
          rail.rotation.x = Math.PI / 4;
          rail.position.set(rx, 1.2, b.d / 2 + 4.8);
          grp.add(rail);
        });

        // 6. Bronze Bust Statue on Dark Granite Pedestal (Facing Courtyard)
        const statueGrp = new THREE.Group();
        statueGrp.position.set(0, 0, b.d / 2 + 7.6);

        // Multi-tiered Granite Base
        const base1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 1.8), darkGraniteMat);
        base1.position.y = 0.175;
        statueGrp.add(base1);

        const base2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.4), darkGraniteMat);
        base2.position.y = 0.75;
        statueGrp.add(base2);

        const base3 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.0), darkGraniteMat);
        base3.position.y = 1.4;
        statueGrp.add(base3);

        // Gold/Bronze Bust Sculpture
        const bustChest = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.38), bronzeMat);
        bustChest.position.y = 1.85;
        statueGrp.add(bustChest);

        const bustHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), bronzeMat);
        bustHead.position.y = 2.25;
        statueGrp.add(bustHead);

        grp.add(statueGrp);

        // 7. Manicured Green Lawns & Shaped Shrubs Flanking Entrance
        const lawnMat = new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.9 });
        const shrubMat = new THREE.MeshStandardMaterial({ color: 0x1B5E20, roughness: 0.85 });

        [-7.5, 7.5].forEach((lx) => {
          const lawn = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 5.5), lawnMat);
          lawn.position.set(lx, 0.08, b.d / 2 + 5.0);
          lawn.receiveShadow = true;
          grp.add(lawn);

          // Spherically shaped topiary shrubs
          for (let sz of [-1.5, 0.5, 2.0]) {
            const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 10), shrubMat);
            shrub.position.set(lx, 0.65, b.d / 2 + 5.0 + sz);
            shrub.castShadow = true;
            grp.add(shrub);
          }
        });
      } else if (b.id === 'mecheee') {
        const facadeMat = new THREE.MeshStandardMaterial({ color: 0x4B5E6D, roughness: 0.8 }); // Slate blue
        const whiteStoneMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.4 });
        const silverPillarMat = new THREE.MeshStandardMaterial({ color: 0xD0D5DB, roughness: 0.3, metalness: 0.5 });
        const woodFrameMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.6 });
        const darkGlassMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.1, metalness: 0.8 });
        
        // Override floor materials
        f1.material = facadeMat;
        if (floor2List.length > 0 && floor2List[floor2List.length - 1]) {
          floor2List[floor2List.length - 1].material = facadeMat;
        }

        // 1. Portico Pediment (Triangular)
        const pedimentW = 10.0;
        const pedimentH = 2.2;
        const pedimentD = 3.5;
        const pedShape = new THREE.Shape();
        pedShape.moveTo(-pedimentW / 2, 0);
        pedShape.lineTo(0, pedimentH);
        pedShape.lineTo(pedimentW / 2, 0);
        pedShape.closePath();
        const pedGeo = new THREE.ExtrudeGeometry(pedShape, { depth: pedimentD, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1 });
        const pedMesh = new THREE.Mesh(pedGeo, whiteStoneMat);
        pedMesh.position.set(0, (floors * FLOOR_H) + 0.3, b.d / 2 - 0.5);
        grp.add(pedMesh);

        // 2. Portico Roof Base Slab
        const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(pedimentW + 0.4, 0.5, pedimentD + 0.4), whiteStoneMat);
        roofSlab.position.set(0, (floors * FLOOR_H) + 0.05, b.d / 2 + 1.25);
        grp.add(roofSlab);

        // 3. Waffled Coffered Ceiling (Under Portico Roof)
        const coffGrp = new THREE.Group();
        const coffBeamMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.9 });
        for (let ix = -4.5; ix <= 4.5; ix += 1.5) {
          const vertBeam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, pedimentD), coffBeamMat);
          vertBeam.position.set(ix, 0, 0);
          coffGrp.add(vertBeam);
        }
        for (let iz = -1.5; iz <= 1.5; iz += 1.5) {
          const horizBeam = new THREE.Mesh(new THREE.BoxGeometry(pedimentW - 0.2, 0.2, 0.15), coffBeamMat);
          horizBeam.position.set(0, 0, iz);
          coffGrp.add(horizBeam);
        }
        coffGrp.position.set(0, (floors * FLOOR_H) - 0.1, b.d / 2 + 1.25);
        grp.add(coffGrp);

        // 4. Four Silver Metallic Pillars
        const colH = (floors * FLOOR_H) - 0.2;
        const colSpacing = 2.8;
        for (let i = 0; i < 4; i++) {
          const cx = -colSpacing * 1.5 + (i * colSpacing);
          const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, colH, 24), silverPillarMat);
          pillar.position.set(cx, colH / 2 + 0.1, b.d / 2 + 2.5);
          pillar.castShadow = true; pillar.receiveShadow = true;
          grp.add(pillar);
        }

        // 5. Grand Wide Staircase with metal railings
        const stairW = pedimentW - 1.0;
        const stairCount = 10;
        const stepH = 0.15;
        const stepD = 0.4;
        const stairGrp = new THREE.Group();
        for (let i = 0; i < stairCount; i++) {
          const step = new THREE.Mesh(new THREE.BoxGeometry(stairW, stepH, stepD * (stairCount - i)), whiteStoneMat);
          step.position.set(0, stepH / 2 + (i * stepH), b.d / 2 + 0.5 + ((stairCount - i) * stepD / 2));
          step.receiveShadow = true;
          stairGrp.add(step);
        }
        grp.add(stairGrp);

        // Handrails
        const railMat = new THREE.MeshStandardMaterial({ color: 0x9CA3AF, roughness: 0.2, metalness: 0.8 });
        [-stairW/2 + 0.2, stairW/2 - 0.2].forEach(rx => {
          const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5.0, 8), railMat);
          rail.rotation.x = Math.PI / 2 + Math.atan2(stepH, stepD);
          rail.position.set(rx, 1.0, b.d / 2 + 2.5);
          grp.add(rail);
        });

        // 6. Large Wood-Framed Windows
        [-6.5, 6.5].forEach(wx => {
          const winFrame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4.5, 0.2), woodFrameMat);
          winFrame.position.set(wx, 2.5, b.d / 2 + 0.05);
          const glass = new THREE.Mesh(new THREE.BoxGeometry(2.3, 4.3, 0.22), darkGlassMat);
          glass.position.set(wx, 2.5, b.d / 2 + 0.05);
          
          const mVert = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.5, 0.25), woodFrameMat);
          mVert.position.set(wx, 2.5, b.d / 2 + 0.05);
          const mHoriz = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 0.25), woodFrameMat);
          mHoriz.position.set(wx, 2.5, b.d / 2 + 0.05);
          
          grp.add(winFrame, glass, mVert, mHoriz);
        });

        // Main Entrance Double Doors
        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.2, 0.2), woodFrameMat);
        doorFrame.position.set(0, 1.6 + (stairCount*stepH), b.d / 2 + 0.05);
        const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.0, 0.22), darkGlassMat);
        doorGlass.position.set(0, 1.6 + (stairCount*stepH), b.d / 2 + 0.05);
        grp.add(doorFrame, doorGlass);

        // Small Potted Plants on steps
        const potMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
        const plantMat = new THREE.MeshStandardMaterial({ color: 0x4CAF50, roughness: 0.8 });
        [-stairW/2 + 0.8, stairW/2 - 0.8].forEach(px => {
          const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4), potMat);
          pot.position.set(px, stepH*2 + 0.2, b.d/2 + 0.5 + (stairCount-2)*stepD);
          const plant = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), plantMat);
          plant.position.set(px, stepH*2 + 0.5, b.d/2 + 0.5 + (stairCount-2)*stepD);
          grp.add(pot, plant);
        });
      } else if (b.id === 'cse') {
        const facadeMat = new THREE.MeshStandardMaterial({ color: 0xE6BCA9, roughness: 0.8 }); // Peach/beige
        const gridMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.4 }); // White grid
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x1E3A8A, roughness: 0.1, metalness: 0.8 }); // Blueish glass

        // 1. Define the hollow shape for the courtyard
        const cseShape = new THREE.Shape();
        cseShape.moveTo(-b.w / 2, -b.d / 2);
        cseShape.lineTo(b.w / 2, -b.d / 2);
        cseShape.lineTo(b.w / 2, b.d / 2);
        cseShape.lineTo(-b.w / 2, b.d / 2);
        cseShape.lineTo(-b.w / 2, -b.d / 2);

        const innerW = b.court?.w ?? 7.0;
        const innerD = b.court?.d ?? 5.0;
        const hole = new THREE.Path();
        hole.moveTo(-innerW / 2, -innerD / 2);
        hole.lineTo(-innerW / 2, innerD / 2);
        hole.lineTo(innerW / 2, innerD / 2);
        hole.lineTo(innerW / 2, -innerD / 2);
        hole.lineTo(-innerW / 2, -innerD / 2);
        cseShape.holes.push(hole);

        // Helper to create hollow box geometry (extruded along Y)
        const createHollowGeo = (h) => {
          const geo = new THREE.ExtrudeGeometry(cseShape, { depth: h, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);
          geo.translate(0, -h/2, 0); // Center vertically
          return geo;
        };

        // Override existing f1 and f2 geometries
        const f1GeoHollow = createHollowGeo(FLOOR_H);
        f1.geometry.dispose();
        f1.geometry = f1GeoHollow;
        f1.material = facadeMat;
        
        const f2Obj = floor2List.find(f => f.userData.building.id === 'cse');
        if (f2Obj) {
          f2Obj.geometry.dispose();
          f2Obj.geometry = createHollowGeo(FLOOR_H);
          f2Obj.material = facadeMat;
        }

        // Replace slab and roof geometries to match the hollow shape
        grp.children.forEach(child => {
          if (child !== f1 && child !== f2Obj) {
             if (child.geometry && child.geometry.type === 'BoxGeometry') {
                child.geometry.dispose();
                child.geometry = createHollowGeo(0.22);
             }
          }
        });

        // 2. White Structural Grid & Windows (Front and Back facades)
        [-1, 1].forEach(dir => {
            const zFace = dir * (b.d / 2 + 0.05);
            for (let x = -b.w/2 + 0.5; x <= b.w/2 - 0.5; x += 3.25) {
                const vert = new THREE.Mesh(new THREE.BoxGeometry(0.4, floors * FLOOR_H, 0.15), gridMat);
                vert.position.set(x, (floors * FLOOR_H)/2, zFace);
                grp.add(vert);
            }
            // Horizontal bands
            for (let y = 0.5; y <= floors * FLOOR_H; y += FLOOR_H) {
                const horiz = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.5, 0.15), gridMat);
                horiz.position.set(0, y, zFace);
                grp.add(horiz);
            }
            
            // Windows & Entrance
            for (let x = -b.w/2 + 2.125; x <= b.w/2 - 2.0; x += 3.25) {
                if (dir === 1 && Math.abs(x) < 1.0) {
                   // Main entrance recess & doors
                   const entrance = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.5, 0.2), new THREE.MeshStandardMaterial({color: 0x111111}));
                   entrance.position.set(0, 1.75, zFace);
                   grp.add(entrance);
                } else {
                   const win1 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 0.1), glassMat);
                   win1.position.set(x, 2.5, zFace);
                   const win2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 0.1), glassMat);
                   win2.position.set(x, FLOOR_H + 2.5, zFace);
                   grp.add(win1, win2);
                }
            }
        });

        // 3. Checkered Plaza (outside entrance)
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#E2E8F0'; ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#334155'; 
        ctx.fillRect(0, 0, 128, 128); ctx.fillRect(128, 128, 128, 128);
        const checkTex = new THREE.CanvasTexture(canvas);
        checkTex.wrapS = THREE.RepeatWrapping; checkTex.wrapT = THREE.RepeatWrapping;
        checkTex.repeat.set(4, 3);
        const checkMat = new THREE.MeshStandardMaterial({ map: checkTex, roughness: 0.9 });
        
        const plaza = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 6), checkMat);
        plaza.position.set(0, 0.1, b.d/2 + 3.0);
        plaza.receiveShadow = true;
        grp.add(plaza);

        // 4. Internal Courtyard Details
        // Base (Dirt/Grass)
        const courtMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 1 });
        const courtBase = new THREE.Mesh(new THREE.BoxGeometry(innerW, 0.2, innerD), courtMat);
        courtBase.position.set(0, 0.1, 0);
        courtBase.receiveShadow = true;
        grp.add(courtBase);

        const grassMat = new THREE.MeshStandardMaterial({ color: 0x4CAF50, roughness: 0.9 });
        const grassPatch = new THREE.Mesh(new THREE.BoxGeometry(innerW - 1, 0.25, innerD - 1), grassMat);
        grassPatch.position.set(0, 0.1, 0);
        grp.add(grassPatch);

        // Palm Tree in the center
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3.5, 8), new THREE.MeshStandardMaterial({color: 0x5D4037}));
        trunk.position.set(0, 1.75, 0);
        grp.add(trunk);
        
        const leavesGrp = new THREE.Group();
        const leafMat = new THREE.MeshStandardMaterial({color: 0x2E7D32, side: THREE.DoubleSide});
        for(let i=0; i<8; i++) {
            const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 3.5), leafMat);
            leaf.rotation.x = -Math.PI / 3;
            leaf.position.set(0, 1.2, 1.5);
            
            const pivot = new THREE.Group();
            pivot.rotation.y = (Math.PI / 4) * i;
            pivot.add(leaf);
            leavesGrp.add(pivot);
        }
        leavesGrp.position.set(0, 3.0, 0);
        grp.add(leavesGrp);

        // Silver Metal Railings around the courtyard on Floor 2
        const railMat = new THREE.MeshStandardMaterial({ color: 0xB0BEC5, metalness: 0.8, roughness: 0.3 });
        const railH = 1.2;
        const addRail = (w, d, px, pz, rotY) => {
            const topRail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.05), railMat);
            topRail.position.set(px, FLOOR_H + railH, pz);
            if(rotY) topRail.rotation.y = rotY;
            grp.add(topRail);
            
            // Add vertical stanchions
            const count = Math.floor(w / 1.5);
            for(let i=0; i<=count; i++) {
               const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, railH, 0.05), railMat);
               const offset = -w/2 + (i * (w/count));
               if (rotY) {
                   st.position.set(px, FLOOR_H + railH/2, pz + offset);
               } else {
                   st.position.set(px + offset, FLOOR_H + railH/2, pz);
               }
               grp.add(st);
            }
        };
        addRail(innerW, 0, 0, -innerD/2, 0);
        addRail(innerW, 0, 0, innerD/2, 0);
        addRail(innerD, 0, -innerW/2, 0, Math.PI/2);
        addRail(innerD, 0, innerW/2, 0, Math.PI/2);
      } else if (b.id === 'ece') {
        const facadeMat = new THREE.MeshStandardMaterial({ color: 0xD4A373, roughness: 0.8 }); // Mustard yellow
        const whiteCeilingMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.9 });
        const stairMat = new THREE.MeshStandardMaterial({ color: 0xA3A8B0, roughness: 0.9 });
        const woodDoorMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.7 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.1, metalness: 0.8 });

        // 1. Custom Shape for Floor 1 (with recessed entrance)
        const recessW = 8.0;
        const recessD = 2.5;
        
        const f1Shape = new THREE.Shape();
        f1Shape.moveTo(-b.w / 2, -b.d / 2);
        f1Shape.lineTo(b.w / 2, -b.d / 2);
        f1Shape.lineTo(b.w / 2, b.d / 2);
        f1Shape.lineTo(recessW / 2, b.d / 2);
        f1Shape.lineTo(recessW / 2, b.d / 2 - recessD);
        f1Shape.lineTo(-recessW / 2, b.d / 2 - recessD);
        f1Shape.lineTo(-recessW / 2, b.d / 2);
        f1Shape.lineTo(-b.w / 2, b.d / 2);
        f1Shape.lineTo(-b.w / 2, -b.d / 2);

        const f1Geo = new THREE.ExtrudeGeometry(f1Shape, { depth: FLOOR_H, bevelEnabled: false });
        f1Geo.rotateX(-Math.PI / 2);
        f1Geo.translate(0, -FLOOR_H/2, 0); // Center vertically like standard BoxGeometry
        
        f1.geometry.dispose();
        f1.geometry = f1Geo;
        f1.material = facadeMat;
        
        // Floor 2 stays as a regular box, but update its color
        const f2Obj = floor2List.find(f => f.userData.building.id === 'ece');
        if (f2Obj) f2Obj.material = facadeMat;

        // The ceiling of the recess (white)
        const ceiling = new THREE.Mesh(new THREE.BoxGeometry(recessW, 0.1, recessD), whiteCeilingMat);
        ceiling.position.set(0, FLOOR_H - 0.05, b.d / 2 - recessD / 2);
        grp.add(ceiling);

        // Notice boards on the recessed walls
        const boardMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 1 });
        const b1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), boardMat);
        b1.position.set(-recessW / 2 + 1.0, 1.8, b.d / 2 - recessD + 0.05);
        const b2 = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), boardMat);
        b2.position.set(recessW / 2 - 1.5, 1.8, b.d / 2 - recessD + 0.05);
        grp.add(b1, b2);

        // Main Doors inside recess
        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.0, 0.1), woodDoorMat);
        doorFrame.position.set(0, 1.5, b.d / 2 - recessD + 0.05);
        const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.8, 0.12), glassMat);
        doorGlass.position.set(0, 1.5, b.d / 2 - recessD + 0.05);
        grp.add(doorFrame, doorGlass);

        // 2. Stairs & Checkered Ramp
        const stairW = 5.5;
        const rampW = 2.5;
        const stairCount = 6;
        const stepH = 0.15;
        const stepD = 0.5;
        const rampL = stepD * stairCount;
        const rampH = stepH * stairCount;
        
        const stairGrp = new THREE.Group();
        for (let i = 0; i < stairCount; i++) {
          const step = new THREE.Mesh(new THREE.BoxGeometry(stairW, stepH, stepD * (stairCount - i)), stairMat);
          step.position.set(-1.25, stepH / 2 + (i * stepH), b.d / 2 + (stepD * (stairCount - i)) / 2);
          step.receiveShadow = true;
          stairGrp.add(step);
        }
        grp.add(stairGrp);

        // Procedural yellow/tan checkered texture for ramp
        const rCanvas = document.createElement('canvas');
        rCanvas.width = 128; rCanvas.height = 128;
        const rCtx = rCanvas.getContext('2d');
        rCtx.fillStyle = '#EBC662'; // Yellow tile
        rCtx.fillRect(0, 0, 128, 128);
        rCtx.fillStyle = '#D98F56'; // Tan/Orange tile
        rCtx.fillRect(0, 0, 64, 64); rCtx.fillRect(64, 64, 64, 64);
        
        const rTex = new THREE.CanvasTexture(rCanvas);
        rTex.wrapS = THREE.RepeatWrapping; rTex.wrapT = THREE.RepeatWrapping;
        rTex.repeat.set(4, 6);
        const rampMat = new THREE.MeshStandardMaterial({ map: rTex, roughness: 0.9 });
        
        // Inclined Ramp Geometry (wedge)
        const rampShape = new THREE.Shape();
        rampShape.moveTo(0, 0); // Bottom back
        rampShape.lineTo(-rampL, 0); // Bottom front
        rampShape.lineTo(0, rampH); // Top back
        rampShape.lineTo(0, 0);
        
        const rampGeo = new THREE.ExtrudeGeometry(rampShape, { depth: rampW, bevelEnabled: false });
        rampGeo.rotateY(Math.PI / 2);
        const rampMesh = new THREE.Mesh(rampGeo, rampMat);
        rampMesh.position.set(1.5, 0, b.d / 2);
        grp.add(rampMesh);
        
        // Metal handrail between stairs and ramp
        const railMat = new THREE.MeshStandardMaterial({ color: 0xB0BEC5, metalness: 0.7, roughness: 0.3 });
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, Math.sqrt(rampL*rampL + rampH*rampH), 8), railMat);
        rail.rotation.x = Math.PI / 2 + Math.atan2(rampH, rampL);
        rail.position.set(1.5, rampH / 2 + 0.9, b.d / 2 + rampL / 2);
        grp.add(rail);

        // 3. Striped Planter Box
        const planterW = 3.0;
        const planterD = 2.0;
        const planterH = 0.5;
        
        const pCanvas = document.createElement('canvas');
        pCanvas.width = 128; pCanvas.height = 32;
        const pCtx = pCanvas.getContext('2d');
        pCtx.fillStyle = '#FFD54F'; pCtx.fillRect(0, 0, 128, 32); // Yellow
        pCtx.fillStyle = '#212121'; pCtx.fillRect(0, 0, 32, 32); pCtx.fillRect(64, 0, 32, 32); // Black stripes
        const pTex = new THREE.CanvasTexture(pCanvas);
        pTex.wrapS = THREE.RepeatWrapping;
        pTex.repeat.set(4, 1);
        const stripeMat = new THREE.MeshStandardMaterial({ map: pTex, roughness: 0.8 });
        
        const planter = new THREE.Mesh(new THREE.BoxGeometry(planterW, planterH, planterD), stripeMat);
        planter.position.set(5.5, planterH / 2, b.d / 2 + planterD / 2);
        grp.add(planter);
        
        // Green bushes in planter
        const bushMat = new THREE.MeshStandardMaterial({ color: 0x4CAF50, roughness: 0.9 });
        for (let i = -1; i <= 1; i++) {
           const bush = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), bushMat);
           bush.position.set(5.5 + (i * 0.8), planterH + 0.2, b.d / 2 + planterD / 2);
           grp.add(bush);
        }
      } else if (b.id === 'sh') {
        const facadeMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.8 }); // Stark white
        const gridMat = new THREE.MeshStandardMaterial({ color: 0xBC544B, roughness: 0.7 }); // Terracotta
        const chajjaMat = new THREE.MeshStandardMaterial({ color: 0x8B95A1, roughness: 0.9 }); // Grey concrete
        const windowMat = new THREE.MeshStandardMaterial({ color: 0x1A2530, roughness: 0.2, metalness: 0.6 }); // Dark glass
        
        const shFloors = 4;
        
        // 1. Dispose default generic geometry and make a full 4-floor solid white box
        f1.geometry.dispose();
        f1.geometry = footprintGeometry(b.shape, b.w, b.d, FLOOR_H * shFloors, b.court);
        f1.material = facadeMat;
        f1.position.y = (FLOOR_H * shFloors) / 2; // Center vertically for 4 floors
        
        const f2Obj = floor2List.find(f => f.userData.building.id === 'sh');
        if (f2Obj) f2Obj.visible = false; // Hide the default floor 2
        grp.children.forEach(c => {
          if (c !== f1 && c.geometry && c.geometry.type !== 'TextGeometry') {
             c.visible = false; // Hide generic slabs, roof
          }
        });

        // Add a single custom roof slab for the entire building
        const roofSlab = new THREE.Mesh(footprintGeometry(b.shape, b.w * 1.02, b.d * 1.02, 0.4, b.court), gridMat);
        roofSlab.position.y = FLOOR_H * shFloors + 0.2;
        grp.add(roofSlab);

        // 2. Facade Grid & Windows
        const cols = 7; // 7 columns
        const colW = b.w / cols;
        const gridThickness = 0.3;
        const gridDepth = 0.4;
        
        const frontGrid = new THREE.Group();
        frontGrid.position.set(0, 0, b.d / 2);
        
        // Vertical grid lines
        for (let i = 0; i <= cols; i++) {
           const vLine = new THREE.Mesh(new THREE.BoxGeometry(gridThickness, FLOOR_H * shFloors, gridDepth), gridMat);
           vLine.position.set(-b.w / 2 + (i * colW), (FLOOR_H * shFloors) / 2, gridDepth / 2);
           frontGrid.add(vLine);
        }
        
        // Horizontal grid lines and windows for each floor
        for (let f = 0; f < shFloors; f++) {
           const floorY = f * FLOOR_H;
           // Horizontal beam (floor divider)
           const hLine = new THREE.Mesh(new THREE.BoxGeometry(b.w + gridThickness, gridThickness, gridDepth), gridMat);
           hLine.position.set(0, floorY, gridDepth / 2);
           frontGrid.add(hLine);
           
           // Top horizontal beam for the top floor
           if (f === shFloors - 1) {
             const hTop = new THREE.Mesh(new THREE.BoxGeometry(b.w + gridThickness, gridThickness, gridDepth), gridMat);
             hTop.position.set(0, floorY + FLOOR_H, gridDepth / 2);
             frontGrid.add(hTop);
           }
           
           // Windows and Chajjas for each cell
           for (let c = 0; c < cols; c++) {
              // Skip middle 3 columns on ground floor for entrance
              if (f === 0 && (c >= 2 && c <= 4)) continue;
              
              const cellCenter = -b.w / 2 + (c * colW) + (colW / 2);
              
              // Window
              const winW = colW - 0.8;
              const winH = FLOOR_H - 1.2;
              const win = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.1), windowMat);
              win.position.set(cellCenter, floorY + FLOOR_H / 2 + 0.2, 0.05);
              frontGrid.add(win);
              
              // Chajja (Projecting Awning)
              const chajja = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.4, 0.15, 0.8), chajjaMat);
              chajja.position.set(cellCenter, floorY + winH + 0.9, 0.4);
              frontGrid.add(chajja);
           }
        }
        grp.add(frontGrid);
        
        // 3. Grand Entrance Portico
        const porticoW = colW * 3;
        const porticoD = 4.0;
        const porticoH = 0.6;
        
        // Canopy
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(porticoW + 1.0, porticoH, porticoD), chajjaMat);
        canopy.position.set(0, FLOOR_H + 0.3, b.d / 2 + porticoD / 2 - 0.5);
        grp.add(canopy);
        
        // Pillars
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.8 }); // White pillars
        [-porticoW/2, porticoW/2].forEach(px => {
           const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, FLOOR_H + 0.3, 0.8), pillarMat);
           pillar.position.set(px, (FLOOR_H + 0.3)/2, b.d / 2 + porticoD - 1.0);
           grp.add(pillar);
        });
        
        // Entrance doors (recessed slightly)
        const door = new THREE.Mesh(new THREE.BoxGeometry(4.0, 3.0, 0.1), windowMat);
        door.position.set(0, 1.5, b.d / 2 + 0.1);
        grp.add(door);

        // 4. Custom Distinctive Palm Tree
        const treeX = -3.5; // Offset left of entrance
        const treeZ = b.d / 2 + 6.0; // In front of the building
        
        // Trunk
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4E342E, roughness: 1 });
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 12, 7);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(treeX, 6, treeZ);
        // Slightly curved/angled trunk for organic look
        trunk.rotation.z = -0.05;
        grp.add(trunk);
        
        // Hanging Seed/Fruit Cluster
        const seedMat = new THREE.MeshStandardMaterial({ color: 0xA1B56C, roughness: 0.9 });
        const seedCluster = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 2.5, 4, 8), seedMat);
        seedCluster.position.set(treeX + 0.8, 8.5, treeZ);
        seedCluster.rotation.z = Math.PI / 6; // Angled hanging
        grp.add(seedCluster);
        
        // Small stem connecting seed cluster to trunk
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5), trunkMat);
        stem.position.set(treeX + 0.4, 10.0, treeZ);
        stem.rotation.z = Math.PI / 4;
        grp.add(stem);
        
        // Palm Leaves
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.8, side: THREE.DoubleSide });
        for (let i = 0; i < 6; i++) {
            const leafShape = new THREE.Shape();
            leafShape.moveTo(0, 0);
            leafShape.quadraticCurveTo(2, 1, 4, -1);
            leafShape.quadraticCurveTo(2, -0.5, 0, 0);
            const leafGeo = new THREE.ShapeGeometry(leafShape);
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.set(treeX, 11.5, treeZ);
            leaf.rotation.y = (i * Math.PI) / 3;
            leaf.rotation.z = 0.2;
            grp.add(leaf);
        }
      } else if (b.id === 'exam') {
        const examFloors = 4;
        const facadeMat = new THREE.MeshStandardMaterial({ color: 0xE8D595, roughness: 0.9 }); // Light yellow/tan
        const finMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, roughness: 0.3, metalness: 0.7 }); // Golden bronze
        const windowMat = new THREE.MeshStandardMaterial({ color: 0x1A2530, roughness: 0.2, metalness: 0.6 }); // Dark glass
        const grilleMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.8 }); // White grille
        const gateMat = new THREE.MeshStandardMaterial({ color: 0xA0AAB5, roughness: 0.6, metalness: 0.5 }); // Metal accordion gate
        const signBoardMat = new THREE.MeshStandardMaterial({ color: 0x2563EB, roughness: 0.6 }); // Blue sign
        
        // 1. Dispose default generic geometry and make a full solid yellow box
        f1.geometry.dispose();
        f1.geometry = footprintGeometry(b.shape, b.w, b.d, FLOOR_H * examFloors);
        f1.material = facadeMat;
        f1.position.y = (FLOOR_H * examFloors) / 2; // Center vertically
        
        grp.children.forEach(c => {
          if (c !== f1 && c.geometry && c.geometry.type !== 'TextGeometry') {
             c.visible = false; // Hide generic slabs, roof, f2
          }
        });

        // Add Horizontal Grooves to facade
        const grooveMat = new THREE.MeshStandardMaterial({ color: 0xD4C17C, roughness: 0.9 });
        for (let i = 1; i < examFloors * 4; i++) { // 4 grooves per floor
           const groove = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.05, 0.1, b.d + 0.05), grooveMat);
           groove.position.y = i * (FLOOR_H / 4);
           grp.add(groove);
        }

        // 2. The Golden Metallic Fin on the left
        const finW = 3.5;
        const finD = 2.5;
        const fin = new THREE.Mesh(new THREE.BoxGeometry(finW, FLOOR_H * examFloors + 1.0, finD), finMat);
        fin.position.set(-b.w / 2 + finW / 2 + 1, (FLOOR_H * examFloors + 1.0) / 2, b.d / 2 + 0.2); // Slightly projecting front
        grp.add(fin);
        
        // Fin horizontal lines
        for(let i = 1; i < examFloors * 4; i++) {
           const line = new THREE.Mesh(new THREE.BoxGeometry(finW + 0.1, 0.05, finD + 0.1), windowMat);
           line.position.set(fin.position.x, i * (FLOOR_H / 4), fin.position.z);
           grp.add(line);
        }

        // 3. Windows & Security Grilles
        const winCols = 4;
        const winW = 2.2;
        const winH = 2.5;
        
        for (let f = 0; f < examFloors; f++) {
           const floorY = f * FLOOR_H;
           for (let c = 0; c < winCols; c++) {
              if (f === 0 && c === 1) continue; // Skip for entrance
              
              const wx = -1.5 + (c * 3.0); 
              
              // Window
              const win = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.1), windowMat);
              win.position.set(wx, floorY + winH/2 + 0.8, b.d / 2 + 0.05);
              grp.add(win);
              
              // Ground floor security grilles
              if (f === 0) {
                 const grilleGroup = new THREE.Group();
                 grilleGroup.position.set(wx, floorY + winH/2 + 0.8, b.d / 2 + 0.15);
                 // Vertical bars
                 for(let i=0; i<6; i++) {
                    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, winH, 0.05), grilleMat);
                    vBar.position.x = -winW/2 + 0.2 + (i * 0.36);
                    grilleGroup.add(vBar);
                 }
                 // Horizontal bars
                 for(let i=0; i<5; i++) {
                    const hBar = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.05, 0.05), grilleMat);
                    hBar.position.y = -winH/2 + 0.2 + (i * 0.52);
                    grilleGroup.add(hBar);
                 }
                 grp.add(grilleGroup);
              }
           }
        }

        // 4. Entrance & Accordion Gates
        const entX = 1.5;
        const entW = 2.8;
        const entH = 3.2;
        
        const gateGroup = new THREE.Group();
        gateGroup.position.set(entX, entH / 2, b.d / 2 + 0.1);
        
        // Accordion metal gate details
        for (let i = 0; i < 14; i++) {
           // Zig-zag criss-cross metal
           const cross = new THREE.Mesh(new THREE.BoxGeometry(0.1, entH, 0.1), gateMat);
           cross.position.set(-entW/2 + 0.1 + (i * 0.2), 0, 0);
           cross.rotation.z = i % 2 === 0 ? 0.2 : -0.2;
           gateGroup.add(cross);
           
           // Vertical connector
           const vGate = new THREE.Mesh(new THREE.BoxGeometry(0.05, entH, 0.1), gateMat);
           vGate.position.set(-entW/2 + 0.1 + (i * 0.2), 0, 0.05);
           gateGroup.add(vGate);
        }
        grp.add(gateGroup);

        // 5. The Chair Mountain (Stacked old desks/chairs)
        const chairMountain = new THREE.Group();
        chairMountain.position.set(6.0, 0, b.d / 2 + 2.5); // Right side in front
        
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 1.0 });
        const rustyMat = new THREE.MeshStandardMaterial({ color: 0x594A42, roughness: 0.9, metalness: 0.3 });
        
        for (let i = 0; i < 35; i++) {
           const chair = new THREE.Group();
           
           // Seat/Desk top
           const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), woodMat);
           seat.position.y = 0.5;
           chair.add(seat);
           
           // Legs
           for(let lx of [-0.4, 0.4]) {
              for(let lz of [-0.4, 0.4]) {
                 const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), rustyMat);
                 leg.position.set(lx, 0.25, lz);
                 chair.add(leg);
              }
           }
           
           // Backrest
           const back = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.1), woodMat);
           back.position.set(0, 0.8, -0.45);
           chair.add(back);
           
           // Randomize position and rotation to make a pile
           const radius = Math.random() * 2.5;
           const angle = Math.random() * Math.PI * 2;
           const height = Math.random() * 2.0;
           
           chair.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
           chair.rotation.set(
              Math.random() * Math.PI, 
              Math.random() * Math.PI, 
              Math.random() * Math.PI
           );
           
           chairMountain.add(chair);
        }
        grp.add(chairMountain);
        
        // 6. The "EXAMINATION BRANCH" Blue Signboard
        const signGroup = new THREE.Group();
        signGroup.position.set(entX + 2.5, 0, b.d / 2 + 2.0);
        
        // Sign legs
        const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5);
        const signLeg1 = new THREE.Mesh(legGeo, rustyMat);
        signLeg1.position.set(-0.8, 0.75, 0);
        const signLeg2 = new THREE.Mesh(legGeo, rustyMat);
        signLeg2.position.set(0.8, 0.75, 0);
        signGroup.add(signLeg1, signLeg2);
        
        // Sign board
        const board = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.1), signBoardMat);
        board.position.set(0, 1.25, 0);
        signGroup.add(board);
        
        grp.add(signGroup);
      } else if (b.id === 'cant') {
        const cantFloors = b.stats?.floors || 2;
        const yellowMat = new THREE.MeshStandardMaterial({ color: 0xFDB813, roughness: 0.9 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.8 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.3, metalness: 0.5 });
        const signMat = new THREE.MeshStandardMaterial({ color: 0x3B82F6, roughness: 0.8 }); // Blue sign
        const darkCaveMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 1.0 }); // Dark interior for open doors
        
        // Hide generic
        f1.geometry.dispose();
        f1.visible = false;
        grp.children.forEach(c => {
          if (c !== f1 && c.geometry && c.geometry.type !== 'TextGeometry') {
             c.visible = false;
          }
        });
        
        // 1. The Split Facade
        const sideW = 4;
        const centerW = b.w - (sideW * 2);
        
        // Center Yellow Block
        const centerBlock = new THREE.Mesh(new THREE.BoxGeometry(centerW, FLOOR_H * cantFloors, b.d), yellowMat);
        centerBlock.position.set(0, (FLOOR_H * cantFloors)/2, 0);
        grp.add(centerBlock);
        
        // Left White Block
        const leftBlock = new THREE.Mesh(new THREE.BoxGeometry(sideW, FLOOR_H * cantFloors, b.d), whiteMat);
        leftBlock.position.set(-b.w/2 + sideW/2, (FLOOR_H * cantFloors)/2, 0);
        grp.add(leftBlock);
        
        // Right White Block
        const rightBlock = new THREE.Mesh(new THREE.BoxGeometry(sideW, FLOOR_H * cantFloors, b.d), whiteMat);
        rightBlock.position.set(b.w/2 - sideW/2, (FLOOR_H * cantFloors)/2, 0);
        grp.add(rightBlock);
        
        // 2. Elevated Entrance
        // Concrete steps
        const stepMat = new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.9 });
        for(let s=0; s<3; s++) {
           const stepW = 6.0;
           const stepD = 1.5 - (s * 0.4);
           const stepH = 0.2;
           const step = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH, stepD), stepMat);
           step.position.set(0, s * stepH + stepH/2, b.d/2 + stepD/2);
           grp.add(step);
        }
        
        // Open Entrance Doors (Dark void)
        const doorVoid = new THREE.Mesh(new THREE.BoxGeometry(4.0, 3.0, 0.1), darkCaveMat);
        doorVoid.position.set(0, 0.6 + 1.5, b.d/2 + 0.05);
        grp.add(doorVoid);
        
        // Frame around doors
        const frameW = 4.2;
        const frameH = 3.2;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(frameW, frameH, 0.2), whiteMat);
        frame.position.set(0, 0.6 + frameH/2, b.d/2 + 0.01);
        grp.add(frame);
        // Put the void slightly in front to clip through the frame
        doorVoid.position.z = frame.position.z + 0.11;
        
        // 3. Signage & Wall Posters
        // CANTEEN Blue sign
        const cantSign = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.8, 0.1), signMat);
        cantSign.position.set(0, FLOOR_H * cantFloors - 1.0, b.d/2 + 0.05);
        grp.add(cantSign);
        
        // Faded text blocks (abstract representation)
        const fadedMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 1.0 });
        for (let i = 0; i < 7; i++) {
           const letter = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.1), fadedMat);
           letter.position.set(-1.2 + (i * 0.4), FLOOR_H * cantFloors - 1.8, b.d/2 + 0.05);
           letter.rotation.z = (Math.random() - 0.5) * 0.2;
           grp.add(letter);
        }
        
        // Wall Posters
        const posterMat1 = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.9 }); // Dark poster
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.1), posterMat1);
        p1.position.set(2.5, 2.0, b.d/2 + 0.05);
        grp.add(p1);
        
        const posterMat2 = new THREE.MeshStandardMaterial({ color: 0x3B82F6, roughness: 0.9 }); // Blue poster
        const p2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.1), posterMat2);
        p2.position.set(2.5, 5.0, b.d/2 + 0.05);
        grp.add(p2);
        
        const plasticFreeMat = new THREE.MeshStandardMaterial({ color: 0x1D4ED8, roughness: 0.9 });
        const pFree = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 16), plasticFreeMat);
        pFree.rotation.x = Math.PI/2;
        pFree.position.set(-2.5, 2.5, b.d/2 + 0.05);
        grp.add(pFree);
        
        // 4. Windows on White Flanks
        for (let f = 0; f < cantFloors; f++) {
           const floorY = f * FLOOR_H;
           // Left window
           const lWin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 0.1), glassMat);
           lWin.position.set(-b.w/2 + sideW/2, floorY + 2.0, b.d/2 + 0.05);
           grp.add(lWin);
           // Right window
           const rWin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 0.1), glassMat);
           rWin.position.set(b.w/2 - sideW/2, floorY + 2.0, b.d/2 + 0.05);
           grp.add(rWin);
        }
        
        // 5. String-Light Trees in foreground
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 1.0 });
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xFFF8E7 }); // Glowing string lights
        
        [-b.w/2 - 1.0, b.w/2 + 1.0].forEach(tx => {
           const tree = new THREE.Group();
           tree.position.set(tx, 0, b.d/2 + 4.0);
           
           const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 14, 7);
           const trunk = new THREE.Mesh(trunkGeo, trunkMat);
           trunk.position.y = 7.0;
           tree.add(trunk);
           
           // Wrap string lights
           for (let i = 0; i < 40; i++) {
              const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), lightMat);
              const h = 0.5 + (i * 0.25);
              const angle = i * 1.2;
              const radius = 0.45;
              light.position.set(Math.cos(angle)*radius, h, Math.sin(angle)*radius);
              tree.add(light);
           }
           
           grp.add(tree);
        });
      } else if (b.id === 'rnd') {
        const rndFloors = b.stats?.floors || 2;
        const totalH = rndFloors * FLOOR_H;
        
        const brickMat = new THREE.MeshStandardMaterial({ color: 0xC14538, roughness: 1.0 }); // Deep red brick
        const darkGlassMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.1, metalness: 0.8 }); // Black glass
        const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.9 }); // Dark grey concrete
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.6, metalness: 0.4 }); // Grey metal pipe
        
        // Hide default f1 and generic children
        f1.geometry.dispose();
        f1.visible = false;
        grp.children.forEach(c => {
          if (c !== f1 && c.geometry && c.geometry.type !== 'TextGeometry') {
             c.visible = false;
          }
        });
        
        // 1. The Main Block
        const mainBlock = new THREE.Mesh(new THREE.BoxGeometry(b.w, totalH, b.d), brickMat);
        mainBlock.position.set(0, totalH/2, 0);
        grp.add(mainBlock);
        
        // Procedural horizontal brick grooves
        const grooveMat = new THREE.MeshStandardMaterial({ color: 0x992B20, roughness: 1.0 });
        for(let i=1; i < totalH * 4; i++) {
            const groove = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.02, 0.05, b.d + 0.02), grooveMat);
            groove.position.set(0, i * 0.25, 0);
            grp.add(groove);
        }
        
        // 2. The Central Portal Structure
        const portalGroup = new THREE.Group();
        portalGroup.position.set(0, 0, b.d/2);
        
        // Huge protruding brick pillars
        const pillarW = 2.0;
        const pillarD = 1.8;
        const pillarH = totalH + 0.5; // Slightly taller than main building
        
        const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(pillarW, pillarH, pillarD), brickMat);
        leftPillar.position.set(-2.5, pillarH/2, pillarD/2 - 0.2);
        portalGroup.add(leftPillar);
        
        const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(pillarW, pillarH, pillarD), brickMat);
        rightPillar.position.set(2.5, pillarH/2, pillarD/2 - 0.2);
        portalGroup.add(rightPillar);
        
        // Horizontal Lintel capping the portal
        const lintelW = 7.0; // Spans across the pillars
        const lintelH = 1.0;
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(lintelW, lintelH, pillarD), brickMat);
        lintel.position.set(0, pillarH - lintelH/2, pillarD/2 - 0.2);
        portalGroup.add(lintel);
        
        // Deep Recessed Entryway (Dark Glass)
        const recessW = 3.0;
        const recessH = pillarH - lintelH;
        const recessGlass = new THREE.Mesh(new THREE.BoxGeometry(recessW, recessH, 0.1), darkGlassMat);
        recessGlass.position.set(0, recessH/2, 0.1);
        portalGroup.add(recessGlass);
        
        grp.add(portalGroup);
        
        // 3. Grey Concrete Accents
        // Roofline bands on the side wings
        const roofBand = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.2, 0.4, b.d + 0.2), concreteMat);
        roofBand.position.set(0, totalH - 0.2, 0);
        grp.add(roofBand);
        
        // Lower decorative bands on the sides
        const lowerBand = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.2, 0.3, b.d + 0.2), concreteMat);
        lowerBand.position.set(0, totalH/2 + 0.5, 0);
        grp.add(lowerBand);
        
        // Stepped brackets and downpipes
        [-b.w/2 + 0.8, b.w/2 - 0.8].forEach(wx => {
            // Stepped bracket
            for(let s=0; s<3; s++) {
                const step = new THREE.Mesh(new THREE.BoxGeometry(1.2 - (s*0.2), 0.15, 0.4), concreteMat);
                step.position.set(wx, totalH - 1.0 - (s*0.15), b.d/2 + 0.1);
                grp.add(step);
            }
            // Vertical downpipe
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, totalH - 1.5, 8), pipeMat);
            pipe.position.set(wx, (totalH - 1.5)/2, b.d/2 + 0.2);
            grp.add(pipe);
        });
        
        // 4. Foreground Environment (Foliage hanging down)
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x4CAF50, roughness: 0.8, side: THREE.DoubleSide });
        for(let i=0; i<15; i++) {
            const leafGeo = new THREE.SphereGeometry(0.8, 5, 5);
            // Squish the sphere to look like a leaf cluster
            leafGeo.scale(1, 0.3, 1);
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            // Randomly position in the upper foreground
            leaf.position.set(
                (Math.random() - 0.5) * (b.w + 4), 
                totalH + Math.random() * 2.0, 
                b.d/2 + 3.0 + Math.random() * 2.0
            );
            leaf.rotation.set(Math.random(), Math.random(), Math.random());
            grp.add(leaf);
        }
      } else if (b.id === 'lib') {
        const libFloors = b.stats?.floors || 2;
        const totalH = libFloors * FLOOR_H;
        
        const yellowMat = new THREE.MeshStandardMaterial({ color: 0xFCE68C, roughness: 0.8 }); // Light yellow
        const mustardMat = new THREE.MeshStandardMaterial({ color: 0xEAB308, roughness: 0.9 }); // Dark yellow/mustard
        const blueGlassMat = new THREE.MeshStandardMaterial({ color: 0x38BDF8, roughness: 0.1, metalness: 0.8 }); // Highly reflective glass
        const signTextMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF }); // White text block
        const concreteMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.9 });
        const railingMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.4, metalness: 0.7 });
        const mullionMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.7 }); // White window frames
        const beamMat = new THREE.MeshStandardMaterial({ color: 0xFDE047, roughness: 0.9 }); // Slightly darker yellow for structural beams
        
        // Hide default f1
        f1.geometry.dispose();
        f1.visible = false;
        grp.children.forEach(c => {
          if (c !== f1 && c.geometry && c.geometry.type !== 'TextGeometry') {
             c.visible = false;
          }
        });
        
        // 1. The Main Building Grid (Structural Columns & Beams)
        const centerW = 6.0;
        const sideW = (b.w - centerW) / 2;
        
        // Let's create a solid back wall for the side wings
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, totalH, b.d - 1.0), yellowMat);
        leftWall.position.set(-b.w/2 + sideW/2, totalH/2, -0.5);
        grp.add(leftWall);
        
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, totalH, b.d - 1.0), yellowMat);
        rightWall.position.set(b.w/2 - sideW/2, totalH/2, -0.5);
        grp.add(rightWall);
        
        // Side wing windows with detailed frames and mullions
        const zFrontSide = b.d/2 - 0.5 + 0.1; // Front face of the wall
        for (let wIdx = 0; wIdx < 2; wIdx++) {
            const xOffset = wIdx === 0 ? -b.w/2 + sideW/2 : b.w/2 - sideW/2;
            
            // Two window columns per wing
            for (let i = -1; i <= 1; i += 2) {
                const wx = xOffset + (i * 1.5);
                
                // Upper Floor Window
                const uWinH = 2.5; const uWinW = 1.8;
                const uWinY = totalH - 2.0;
                
                // Glass
                const uGlass = new THREE.Mesh(new THREE.BoxGeometry(uWinW, uWinH, 0.1), blueGlassMat);
                uGlass.position.set(wx, uWinY, zFrontSide);
                grp.add(uGlass);
                
                // Outer Frame (Top, Bottom, Left, Right)
                const tFrame = new THREE.Mesh(new THREE.BoxGeometry(uWinW + 0.1, 0.1, 0.15), mullionMat);
                tFrame.position.set(wx, uWinY + uWinH/2, zFrontSide + 0.05);
                const bFrame = new THREE.Mesh(new THREE.BoxGeometry(uWinW + 0.1, 0.1, 0.15), mullionMat);
                bFrame.position.set(wx, uWinY - uWinH/2, zFrontSide + 0.05);
                const lFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, uWinH + 0.1, 0.15), mullionMat);
                lFrame.position.set(wx - uWinW/2, uWinY, zFrontSide + 0.05);
                const rFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, uWinH + 0.1, 0.15), mullionMat);
                rFrame.position.set(wx + uWinW/2, uWinY, zFrontSide + 0.05);
                
                // Inner Cross Mullions (2x2 grid)
                const cV = new THREE.Mesh(new THREE.BoxGeometry(0.05, uWinH, 0.15), mullionMat);
                cV.position.set(wx, uWinY, zFrontSide + 0.05);
                const cH = new THREE.Mesh(new THREE.BoxGeometry(uWinW, 0.05, 0.15), mullionMat);
                cH.position.set(wx, uWinY, zFrontSide + 0.05);
                
                grp.add(tFrame, bFrame, lFrame, rFrame, cV, cH);
                
                // Lower Floor Window (Taller)
                const lWinH = 3.2;
                const lWinY = 1.6;
                const lGlass = new THREE.Mesh(new THREE.BoxGeometry(uWinW, lWinH, 0.1), blueGlassMat);
                lGlass.position.set(wx, lWinY, zFrontSide);
                grp.add(lGlass);
                
                // Outer Frame
                const ltFrame = new THREE.Mesh(new THREE.BoxGeometry(uWinW + 0.1, 0.1, 0.15), mullionMat);
                ltFrame.position.set(wx, lWinY + lWinH/2, zFrontSide + 0.05);
                const lbFrame = new THREE.Mesh(new THREE.BoxGeometry(uWinW + 0.1, 0.1, 0.15), mullionMat);
                lbFrame.position.set(wx, lWinY - lWinH/2, zFrontSide + 0.05);
                const llFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, lWinH + 0.1, 0.15), mullionMat);
                llFrame.position.set(wx - uWinW/2, lWinY, zFrontSide + 0.05);
                const lrFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, lWinH + 0.1, 0.15), mullionMat);
                lrFrame.position.set(wx + uWinW/2, lWinY, zFrontSide + 0.05);
                
                // Inner Cross Mullions (3 vertical panes, 2 horizontal)
                const lcV = new THREE.Mesh(new THREE.BoxGeometry(0.05, lWinH, 0.15), mullionMat);
                lcV.position.set(wx, lWinY, zFrontSide + 0.05);
                const lcH1 = new THREE.Mesh(new THREE.BoxGeometry(uWinW, 0.05, 0.15), mullionMat);
                lcH1.position.set(wx, lWinY + 0.5, zFrontSide + 0.05);
                const lcH2 = new THREE.Mesh(new THREE.BoxGeometry(uWinW, 0.05, 0.15), mullionMat);
                lcH2.position.set(wx, lWinY - 0.5, zFrontSide + 0.05);
                
                grp.add(ltFrame, lbFrame, llFrame, lrFrame, lcV, lcH1, lcH2);
            }
        }
        
        // Structural Columns & Beams projecting from the side wings
        for (let wIdx = 0; wIdx < 2; wIdx++) {
            const xBase = wIdx === 0 ? -b.w/2 : b.w/2 - sideW;
            // 3 vertical columns per wing
            for(let c=0; c<=2; c++) {
                const col = new THREE.Mesh(new THREE.BoxGeometry(0.4, totalH, 0.4), beamMat);
                col.position.set(xBase + (c * (sideW/2)), totalH/2, b.d/2 - 0.5);
                grp.add(col);
            }
            // 3 horizontal beams per wing (roof, mid, base)
            const hRoof = new THREE.Mesh(new THREE.BoxGeometry(sideW, 0.4, 0.4), beamMat);
            hRoof.position.set(xBase + sideW/2, totalH - 0.2, b.d/2 - 0.5);
            const hMid = new THREE.Mesh(new THREE.BoxGeometry(sideW, 0.4, 0.4), beamMat);
            hMid.position.set(xBase + sideW/2, totalH/2 - 0.2, b.d/2 - 0.5);
            const hBase = new THREE.Mesh(new THREE.BoxGeometry(sideW, 0.4, 0.4), beamMat);
            hBase.position.set(xBase + sideW/2, 0.2, b.d/2 - 0.5);
            grp.add(hRoof, hMid, hBase);
        }
        
        // 2. Central Recessed Section & Massive Pilasters
        const recessD = 2.0;
        const centerBlock = new THREE.Mesh(new THREE.BoxGeometry(centerW, totalH, b.d - recessD), yellowMat);
        centerBlock.position.set(0, totalH/2, -recessD/2);
        grp.add(centerBlock);
        
        // Heavy Mustard Pilasters
        const pilasterW = 1.2;
        const pilasterD = b.d + 0.4;
        const leftPilaster = new THREE.Mesh(new THREE.BoxGeometry(pilasterW, totalH + 0.8, pilasterD), mustardMat);
        leftPilaster.position.set(-centerW/2 - pilasterW/2, totalH/2 + 0.4, 0);
        grp.add(leftPilaster);
        
        const rightPilaster = new THREE.Mesh(new THREE.BoxGeometry(pilasterW, totalH + 0.8, pilasterD), mustardMat);
        rightPilaster.position.set(centerW/2 + pilasterW/2, totalH/2 + 0.4, 0);
        grp.add(rightPilaster);
        
        const zFrontCenter = b.d/2 - recessD + 0.05;
        
        // Massive Central Upper Glass Grid
        const cgW = centerW - 1.5;
        const cgH = 3.5;
        const centerGlass = new THREE.Mesh(new THREE.BoxGeometry(cgW, cgH, 0.1), blueGlassMat);
        centerGlass.position.set(0, totalH - 2.5, zFrontCenter);
        grp.add(centerGlass);
        
        // Dense Mullion Grid for central glass (4x3 panes)
        // Borders
        const cbT = new THREE.Mesh(new THREE.BoxGeometry(cgW + 0.1, 0.1, 0.15), mullionMat); cbT.position.set(0, totalH - 2.5 + cgH/2, zFrontCenter + 0.05);
        const cbB = new THREE.Mesh(new THREE.BoxGeometry(cgW + 0.1, 0.1, 0.15), mullionMat); cbB.position.set(0, totalH - 2.5 - cgH/2, zFrontCenter + 0.05);
        const cbL = new THREE.Mesh(new THREE.BoxGeometry(0.1, cgH + 0.1, 0.15), mullionMat); cbL.position.set(-cgW/2, totalH - 2.5, zFrontCenter + 0.05);
        const cbR = new THREE.Mesh(new THREE.BoxGeometry(0.1, cgH + 0.1, 0.15), mullionMat); cbR.position.set(cgW/2, totalH - 2.5, zFrontCenter + 0.05);
        grp.add(cbT, cbB, cbL, cbR);
        // Inner Vertical
        for(let v=1; v<=3; v++) {
            const mv = new THREE.Mesh(new THREE.BoxGeometry(0.05, cgH, 0.15), mullionMat);
            mv.position.set(-cgW/2 + (v * cgW/4), totalH - 2.5, zFrontCenter + 0.05);
            grp.add(mv);
        }
        // Inner Horizontal
        for(let h=1; h<=2; h++) {
            const mh = new THREE.Mesh(new THREE.BoxGeometry(cgW, 0.05, 0.15), mullionMat);
            mh.position.set(0, totalH - 2.5 - cgH/2 + (h * cgH/3), zFrontCenter + 0.05);
            grp.add(mh);
        }
        
        // Circular Emblem
        const emblemGrp = new THREE.Group();
        emblemGrp.position.set(0, totalH - 0.5, zFrontCenter);
        const embBack = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 32), signTextMat);
        embBack.rotation.x = Math.PI / 2;
        const embRing = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 8, 32), mullionMat);
        embRing.position.z = 0.05;
        emblemGrp.add(embBack, embRing);
        grp.add(emblemGrp);
        
        // LIBRARY Sign Block
        const libSign = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 0.1), signTextMat);
        libSign.position.set(0, totalH/2 - 0.2, zFrontCenter);
        grp.add(libSign);
        // Small sign legs
        const sLeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), mullionMat); sLeg1.position.set(-1.0, totalH/2 - 0.2 - 0.3, zFrontCenter);
        const sLeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), mullionMat); sLeg2.position.set(1.0, totalH/2 - 0.2 - 0.3, zFrontCenter);
        grp.add(sLeg1, sLeg2);
        
        // Ground floor entrance doors (dark glass)
        const entranceDoors = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.5, 0.1), blueGlassMat);
        entranceDoors.position.set(0, 1.25, zFrontCenter - 0.5);
        grp.add(entranceDoors);
        // Door frame
        const doorFrameT = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.1, 0.2), mullionMat); doorFrameT.position.set(0, 2.5, zFrontCenter - 0.45);
        const doorFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.2), mullionMat); doorFrameL.position.set(-2.0, 1.25, zFrontCenter - 0.45);
        const doorFrameR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.2), mullionMat); doorFrameR.position.set(2.0, 1.25, zFrontCenter - 0.45);
        const doorFrameM = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.2), mullionMat); doorFrameM.position.set(0, 1.25, zFrontCenter - 0.45);
        grp.add(doorFrameT, doorFrameL, doorFrameR, doorFrameM);
        
        // 3. The Grand Staircase & Parapets
        const stairCount = 12;
        const stairStepH = 0.20;
        const stairStepD = 0.55;
        const stairW = b.w + 6.0; // Even wider
        
        const stairGroup = new THREE.Group();
        stairGroup.position.set(0, 0, b.d/2);
        
        for (let s = 0; s < stairCount; s++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(stairW, stairStepH, stairStepD * (stairCount - s)), concreteMat);
            const zPos = (stairStepD * (stairCount - s)) / 2 + (s * stairStepD);
            step.position.set(0, s * stairStepH + stairStepH/2, zPos);
            stairGroup.add(step);
            
            // Potted plants on random steps
            if (s % 3 === 0) {
                const potMat = new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.8 });
                const plantMat = new THREE.MeshStandardMaterial({ color: 0x15803D, roughness: 1.0 });
                
                [-stairW/2 + 1.5, stairW/2 - 1.5].forEach(px => {
                    const offset = (Math.random() - 0.5) * 1.5;
                    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.4), potMat);
                    pot.position.set(px + offset, s * stairStepH + stairStepH + 0.2, zPos);
                    
                    // Random plant shape (sphere or tall cone)
                    const isShrub = Math.random() > 0.5;
                    const plant = isShrub 
                        ? new THREE.Mesh(new THREE.SphereGeometry(0.4, 7, 7), plantMat)
                        : new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 7), plantMat);
                    
                    plant.position.set(px + offset, s * stairStepH + stairStepH + (isShrub ? 0.5 : 0.7), zPos);
                    stairGroup.add(pot, plant);
                });
            }
        }
        
        // Massive Concrete Parapets (Sloped walls flanking stairs)
        // We simulate a slope using a rotated box
        const parapetW = 1.0;
        const parapetLength = Math.sqrt(Math.pow(stairCount*stairStepH, 2) + Math.pow(stairCount*stairStepD, 2)) + 0.5;
        const parapetAngle = Math.atan2(stairStepH, stairStepD);
        
        const parapetGeo = new THREE.BoxGeometry(parapetW, 0.8, parapetLength);
        const lParapet = new THREE.Mesh(parapetGeo, concreteMat);
        lParapet.position.set(-stairW/2 - parapetW/2, (stairCount*stairStepH)/2, (stairCount*stairStepD)/2);
        lParapet.rotation.x = -parapetAngle;
        stairGroup.add(lParapet);
        
        const rParapet = new THREE.Mesh(parapetGeo, concreteMat);
        rParapet.position.set(stairW/2 + parapetW/2, (stairCount*stairStepH)/2, (stairCount*stairStepD)/2);
        rParapet.rotation.x = -parapetAngle;
        stairGroup.add(rParapet);
        
        // Metal Handrails inside the parapets
        const railGeo = new THREE.CylinderGeometry(0.06, 0.06, parapetLength);
        const lRail = new THREE.Mesh(railGeo, railingMat);
        lRail.rotation.x = Math.atan2(stairStepD, stairStepH) + Math.PI/2;
        lRail.position.set(-centerW/2 - 2.5, (stairCount*stairStepH)/2 + 1.2, (stairCount*stairStepD)/2);
        stairGroup.add(lRail);
        
        const rRail = lRail.clone();
        rRail.position.x = centerW/2 + 2.5;
        stairGroup.add(rRail);
        
        grp.add(stairGroup);
        
        // 4. Roof Railings (More detailed)
        const roofRailH = 0.9;
        const rMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.5, roughness: 0.5 });
        const roofRailGrp = new THREE.Group();
        roofRailGrp.position.y = totalH;
        
        // Top and mid rail lines
        const topRailing = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.05, 0.05), rMat);
        topRailing.position.set(0, roofRailH, b.d/2);
        const midRailing = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.03, 0.03), rMat);
        midRailing.position.set(0, roofRailH/2, b.d/2);
        roofRailGrp.add(topRailing, midRailing);
        
        // Dense vertical posts
        for(let px = -b.w/2; px <= b.w/2; px += 1.0) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, roofRailH, 0.05), rMat);
            post.position.set(px, roofRailH/2, b.d/2);
            roofRailGrp.add(post);
        }
        
        grp.add(roofRailGrp);
        
        // 5. The Massive Left Tree
        // Procedurally generating a sprawling oak-like tree
        const hugeTree = new THREE.Group();
        hugeTree.position.set(-b.w/2 - 3.0, 0, b.d/2 + 2.0);
        
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 1.0 });
        const giantLeafMat = new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.9 });
        
        // Main trunk
        const mainTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 8, 9), trunkMat);
        mainTrunk.position.y = 4.0;
        hugeTree.add(mainTrunk);
        
        // Branches & Leaf clusters
        for(let bIdx=0; bIdx<20; bIdx++) {
            // Branch
            const bh = 3.0 + Math.random() * 3.0;
            const branchGeo = new THREE.CylinderGeometry(0.1, 0.4, bh, 5);
            const branch = new THREE.Mesh(branchGeo, trunkMat);
            
            // Randomly angle branches outwards
            const angleY = Math.random() * Math.PI * 2;
            const angleZ = 0.5 + Math.random() * 0.8;
            branch.rotation.set(0, angleY, angleZ);
            
            // Branch starts halfway up the trunk
            const startY = 3.0 + Math.random() * 4.0;
            branch.position.set(0, startY, 0);
            
            // Push it out along its local Y (which points diagonally outwards)
            branch.translateY(bh/2);
            hugeTree.add(branch);
            
            // Huge Leaf cluster at the end of the branch
            const leafGeo = new THREE.DodecahedronGeometry(2.0 + Math.random() * 2.5);
            // Squish it slightly flat
            leafGeo.scale(1.0, 0.6, 1.0);
            const cluster = new THREE.Mesh(leafGeo, giantLeafMat);
            
            cluster.position.copy(branch.position);
            cluster.translateY(bh/2); // move to tip of branch
            hugeTree.add(cluster);
        }
        
        // Scale the entire tree up slightly
        hugeTree.scale.set(1.2, 1.2, 1.2);
        
        grp.add(hugeTree);
      } else if (b.id === 'aud') {
        // ─── The Grand MVSR Auditorium ────────────────────────────────────
        // A masterpiece of sweeping curves, glass facades, and acoustic bronze ribs.

        f1.geometry.dispose();
        f1.visible = false;
        grp.children.forEach(c => { if (c !== f1) c.visible = false; });

        // Dimensions & Materials
        const aW = b.w; // 50
        const aD = b.d; // 22
        const rx = aW / 2 - 2;
        const rz = aD / 2 - 2;

        const mTitanium = new THREE.MeshStandardMaterial({ color: 0xF8F9FA, roughness: 0.4, metalness: 0.3 });
        const mBronze   = new THREE.MeshStandardMaterial({ color: 0xB08D57, roughness: 0.6, metalness: 0.8 });
        const mGlassDay = new THREE.MeshStandardMaterial({ color: 0x0A192F, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.85 });
        const mGlassGlow= new THREE.MeshStandardMaterial({ color: 0xFFE082, emissive: 0xFFB300, emissiveIntensity: 0.8, roughness: 0.2 });
        const mConcrete = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
        const mCarpet   = new THREE.MeshStandardMaterial({ color: 0x900C3F, roughness: 0.9 }); // Red carpet entrance

        // The glass will glow intensely at night
        const isNight = useCampusStore.getState().weather?.isDay === false; // rough check, but we rely on the NightLights ref anyway
        const glassMat = mGlassDay; // we'll use a trick: place point lights inside to illuminate the glass

        // 1. ── The Sweeping Aerodynamic Roof ──
        const audShape = new THREE.Shape();
        const xBack = -14;   // maps to building +Z (back)
        const xFront = 20;   // maps to building -Z (front/canopy)
        const yBack = 6;
        const yMid = 18;
        const yFront = 24;

        audShape.moveTo(xBack, yBack);
        audShape.quadraticCurveTo(2, yMid, xFront, yFront);     // top outer curve
        audShape.lineTo(xFront - 0.5, yFront - 1.2);            // front lip
        audShape.quadraticCurveTo(2, yMid - 2.5, xBack, yBack - 2); // inner ceiling curve
        audShape.lineTo(xBack, yBack);                          // close shape

        const extSettings = { depth: aW - 2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.4, bevelSegments: 3, curveSegments: 32 };
        const roofGeo = new THREE.ExtrudeGeometry(audShape, extSettings);
        const roof = new THREE.Mesh(roofGeo, mTitanium);
        // Rotate so extrusion X maps to local Z, and extrusion Z maps to local X
        roof.rotation.y = Math.PI / 2;
        roof.position.set(-aW/2 + 1, 0, 0); // Center along X
        grp.add(roof);


        // 2. ── The Main Oval Body (Vertex Mapped to Roof Curve) ──
        // We split the oval into two halves: Front (Glass), Back (Bronze Ribs)
        const modifyVertices = (geo) => {
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const vy = pos.getY(i);
            const vz = pos.getZ(i); // local Z. Back is +11, Front is -11
            // Height formula matching the roof curve roughly
            const h = 15.5 - vz * 0.45 - (vz * vz) * 0.015; 
            if (vy > 0) pos.setY(i, h);
            else pos.setY(i, 0);
          }
          geo.computeVertexNormals();
          return geo;
        };

        // Front Half (Glass Curtain Wall)
        const frontGeo = new THREE.CylinderGeometry(rx, rx, 1, 64, 8, false, Math.PI, Math.PI);
        frontGeo.scale(1, 1, rz / rx);
        modifyVertices(frontGeo);
        const frontBody = new THREE.Mesh(frontGeo, glassMat);
        grp.add(frontBody);

        // Glass mullions (vertical frames)
        for (let a = Math.PI; a <= Math.PI * 2; a += Math.PI / 12) {
          const vx = Math.cos(a) * rx;
          const vz = Math.sin(a) * rz;
          const h = 15.5 - vz * 0.45 - (vz * vz) * 0.015;
          const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.4), mTitanium);
          mullion.position.set(vx, h/2, vz);
          mullion.rotation.y = -a + Math.PI/2;
          grp.add(mullion);
        }

        // Back Half (Solid Acoustic Bronze Ribs)
        const backGeo = new THREE.CylinderGeometry(rx - 0.2, rx - 0.2, 1, 64, 8, false, 0, Math.PI);
        backGeo.scale(1, 1, rz / rx);
        modifyVertices(backGeo);
        const backBody = new THREE.Mesh(backGeo, mConcrete);
        grp.add(backBody);

        // Bronze Ribs wrapped around the back
        for (let a = 0; a <= Math.PI; a += Math.PI / 18) {
          const vx = Math.cos(a) * rx;
          const vz = Math.sin(a) * rz;
          const h = 15.5 - vz * 0.45 - (vz * vz) * 0.015;
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.8, h + 0.5, 0.6), mBronze);
          rib.position.set(vx, h/2, vz);
          rib.rotation.y = -a + Math.PI/2;
          grp.add(rib);
          
          // Uplight at the base of every other rib
          if (a % (Math.PI/9) < 0.01) {
            const upL = new THREE.PointLight(0xFFD700, 0, 12, 1.5);
            upL.position.set(vx * 1.05, 0.5, vz * 1.05);
            grp.add(upL);
            nightLightsRef.current.push({ light: upL, onIntensity: 8 });
          }
        }


        // 3. ── Grand Entrance Plaza & Red Carpet ──
        const stepsW = 20;
        const stepsD = 8;
        const stepsGeo = new THREE.BoxGeometry(stepsW, 0.2, stepsD);
        for(let s = 0; s < 5; s++) {
          const step = new THREE.Mesh(stepsGeo, mConcrete);
          step.scale.set(1 - s * 0.05, 1, 1 - s * 0.1);
          step.position.set(0, s * 0.2 + 0.1, -rz - stepsD/2 + s * 0.8);
          grp.add(step);
        }
        
        // Red carpet running up the stairs
        const carpet = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, stepsD + 2), mCarpet);
        carpet.position.set(0, 0.6, -rz - stepsD/2 + 1);
        carpet.rotation.x = -Math.PI / 24;
        grp.add(carpet);

        // Entrance Doors
        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 0.5), mTitanium);
        doorFrame.position.set(0, 2.25, -rz + 0.5);
        grp.add(doorFrame);
        const doors = new THREE.Mesh(new THREE.BoxGeometry(7.5, 4.2, 0.6), mGlassDay);
        doors.position.set(0, 2.25, -rz + 0.5);
        grp.add(doors);


        // 4. ── Marquee Sign "MVSR AUDITORIUM" ──
        const signBoard = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 0.5), mBronze);
        signBoard.position.set(0, 6.5, -rz + 1.2);
        // Tilt sign to face slightly downward
        signBoard.rotation.x = Math.PI / 16;
        grp.add(signBoard);

        const signText = new THREE.Mesh(new THREE.BoxGeometry(15, 1.2, 0.6), mGlassGlow);
        signText.position.set(0, 6.5, -rz + 1.2);
        signText.rotation.x = Math.PI / 16;
        grp.add(signText);

        // Sign Spotlight
        const signLight = new THREE.PointLight(0xFFFFFF, 0, 15, 1.2);
        signLight.position.set(0, 8, -rz - 2);
        grp.add(signLight);
        nightLightsRef.current.push({ light: signLight, onIntensity: 15 });


        // 5. ── Massive Interior Chandelier Glow (Visible through glass) ──
        // We place intense warm lights inside the glass curtain wall
        [-6, 0, 6].forEach(lx => {
          const inLight = new THREE.PointLight(0xFFD700, 0, 30, 1.5);
          inLight.position.set(lx, 5, -rz + 4);
          grp.add(inLight);
          nightLightsRef.current.push({ light: inLight, onIntensity: 25 });
        });

        // 6. ── Roof Edge LED Strip ──
        // A glowing ring tracing the canopy edge
        const ledGeo = new THREE.TorusGeometry(aW/2 - 1, 0.15, 8, 64, Math.PI);
        const mLED = new THREE.MeshStandardMaterial({ color: 0x00E5FF, emissive: 0x00E5FF, emissiveIntensity: 2.0 });
        const led = new THREE.Mesh(ledGeo, mLED);
        led.rotation.x = Math.PI / 2;
        led.position.set(0, yFront - 1.8, -1.5); // position near canopy lip
        // the torus needs to match the curve, but a simple torus at the lip gives a cool sci-fi halo effect
        // We'll scale it to make it elliptical
        led.scale.set(1, aD/aW, 1);
        grp.add(led);

        // Halo glow light
        const haloLight = new THREE.PointLight(0x00E5FF, 0, 40, 1.5);
        haloLight.position.set(0, yFront - 2, -rz);
        grp.add(haloLight);
        nightLightsRef.current.push({ light: haloLight, onIntensity: 15 });

      } else if (b.id === 'frontgate' || b.id === 'backgate') {
        // ─── MVSR Engineering College Main Gate & Back Gate ──────────────────
        // Hide the default box
        f1.geometry.dispose();
        f1.visible = false;
        // Local +x is the outward face; b.rotY turns it to face off campus.
        grp.rotation.y = b.rotY ?? (b.id === 'backgate' ? -Math.PI / 2 : 0);
        grp.children.forEach(c => { if (c !== f1) c.visible = false; });

        // ── Materials ──────────────────────────────────────────────────────
        const gCharcoal = new THREE.MeshStandardMaterial({ color: 0x1E2A35, roughness: 0.9, metalness: 0.1 });
        const gDarkSlate = new THREE.MeshStandardMaterial({ color: 0x2D3E50, roughness: 0.85 });
        const gWhite     = new THREE.MeshStandardMaterial({ color: 0xF0F4F8, roughness: 0.8 });
        const gRed       = new THREE.MeshStandardMaterial({ color: 0xC0392B, roughness: 0.8 });
        const gIron      = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.7, metalness: 0.6 });
        const gGold      = new THREE.MeshStandardMaterial({ color: 0xD4AF37, roughness: 0.5, metalness: 0.7 });
        const gConcrete  = new THREE.MeshStandardMaterial({ color: 0x9CA3AF, roughness: 0.95 });
        const gBlueSign  = new THREE.MeshStandardMaterial({ color: 0x0D2137, roughness: 0.8 });
        const gWhiteSign = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.7 });
        const gTreeTrunk = new THREE.MeshStandardMaterial({ color: 0x3B2314, roughness: 1.0 });
        const gLeaf1     = new THREE.MeshStandardMaterial({ color: 0x1B5E20, roughness: 0.95 });
        const gLeaf2     = new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.95 });
        const gLeaf3     = new THREE.MeshStandardMaterial({ color: 0x388E3C, roughness: 0.95 });

        // ── Gate arch orientation:
        // frontgate is at x:81 (east boundary). Gate spans along Z-axis.
        // Vehicles enter from +X side. Gate faces +X (outward).
        // Local coords: arch spans z direction, x is depth of wall.
        const gArchHalfSpan = 9.0;   // half-width of entrance opening
        const gPylonH       = 8.0;   // pylon height
        const gPylonW       = 3.0;   // pylon width (z-axis)
        const gPylonD       = 4.0;   // pylon depth (x-axis)
        const gArchBeamH    = 2.0;   // arch beam height
        const gArchBeamD    = 3.0;   // arch beam depth

        // ── 1. The Two Massive Entrance Pylons ─────────────────────────────
        [-gArchHalfSpan, gArchHalfSpan].forEach((pz, pIdx) => {
          // Main pylon body
          const pylonBody = new THREE.Mesh(new THREE.BoxGeometry(gPylonD, gPylonH, gPylonW), gCharcoal);
          pylonBody.position.set(0, gPylonH/2, pz + (pIdx === 0 ? -gPylonW/2 : gPylonW/2));
          grp.add(pylonBody);

          // Pylon cap (slightly wider, lighter)
          const cap = new THREE.Mesh(new THREE.BoxGeometry(gPylonD + 0.3, 0.5, gPylonW + 0.3), gDarkSlate);
          cap.position.set(0, gPylonH + 0.25, pz + (pIdx === 0 ? -gPylonW/2 : gPylonW/2));
          grp.add(cap);

          // Pylon base plinth
          const plinth = new THREE.Mesh(new THREE.BoxGeometry(gPylonD + 0.6, 0.6, gPylonW + 0.6), gDarkSlate);
          plinth.position.set(0, 0.3, pz + (pIdx === 0 ? -gPylonW/2 : gPylonW/2));
          grp.add(plinth);

          // Gold accent strips on pylon (horizontal bands)
          for (let band = 0; band < 3; band++) {
            const bY = 1.5 + band * 2.0;
            const strip = new THREE.Mesh(new THREE.BoxGeometry(gPylonD + 0.05, 0.08, gPylonW + 0.05), gGold);
            strip.position.set(0, bY, pz + (pIdx === 0 ? -gPylonW/2 : gPylonW/2));
            grp.add(strip);
          }
        });

        // ── 2. Grand Overhead Arch Beam ────────────────────────────────────
        const gBeamTotalZ = gArchHalfSpan * 2 + gPylonW * 2 + 1.0; // full beam width
        
        // White outer top capping frame
        const topFrame = new THREE.Mesh(new THREE.BoxGeometry(gArchBeamD + 0.4, 0.5, gBeamTotalZ + 0.4), gWhite);
        topFrame.position.set(0, gPylonH + gArchBeamH + 0.25, 0);
        grp.add(topFrame);

        // Dark signboard body
        const archBeam = new THREE.Mesh(new THREE.BoxGeometry(gArchBeamD, gArchBeamH, gBeamTotalZ), gBlueSign);
        archBeam.position.set(0, gPylonH + gArchBeamH/2, 0);
        grp.add(archBeam);

        // White bottom trim
        const bottomTrim = new THREE.Mesh(new THREE.BoxGeometry(gArchBeamD + 0.2, 0.25, gBeamTotalZ + 0.2), gWhite);
        bottomTrim.position.set(0, gPylonH + 0.125, 0);
        grp.add(bottomTrim);

        // "MVSR ENGINEERING COLLEGE (AUTONOMOUS)" sign panel on front face of beam
        const signPanel = new THREE.Mesh(new THREE.BoxGeometry(0.1, gArchBeamH - 0.4, gBeamTotalZ - 0.6), gBlueSign);
        signPanel.position.set(gArchBeamD/2 + 0.05, gPylonH + gArchBeamH/2, 0);
        grp.add(signPanel);

        // College name as white raised block (simulating letter text)
        // Simulate "MVSR ENGINEERING COLLEGE (AUTONOMOUS)" with a raised slab + small blocks
        const nameSign = new THREE.Mesh(new THREE.BoxGeometry(0.12, gArchBeamH - 0.6, gBeamTotalZ - 1.5), gWhiteSign);
        nameSign.position.set(gArchBeamD/2 + 0.06, gPylonH + gArchBeamH/2, 0);
        grp.add(nameSign);

        // Readable lettering over the sign: outer face names the gate, inner face greets you on campus
        const outerText = b.id === 'frontgate'
          ? [{ text: 'MVSR ENGINEERING COLLEGE', font: 'bold 60px serif' }, { text: '(AUTONOMOUS) · NADERGUL', font: '600 30px sans-serif' }]
          : [{ text: 'MVSR ENGINEERING COLLEGE', font: 'bold 60px serif' }, { text: 'BACK GATE', font: '600 30px sans-serif' }];
        const signW = gBeamTotalZ - 1.5;
        const signH = gArchBeamH - 0.6;
        [[gArchBeamD / 2 + 0.13, Math.PI / 2, outerText],
          [-(gArchBeamD / 2 + 0.03), -Math.PI / 2, [{ text: 'MVSR ENGINEERING COLLEGE', font: 'bold 60px serif' }, { text: 'Estd. 1981', font: '600 30px sans-serif' }]]]
          .forEach(([x, rotY, lines]) => {
            const tex = textTextureForGate(lines, signW / signH);
            const plate = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), new THREE.MeshBasicMaterial({ map: tex }));
            plate.position.set(x, gPylonH + gArchBeamH / 2, 0);
            plate.rotation.y = rotY;
            grp.add(plate);
          });

        // Individual raised letter slabs for MVSR (bold caps look)
        const letterLabels = ['M','V','S','R','E','N','G','I','N','E','E','R','I','N','G'];
        const totalLetters = letterLabels.length;
        const letterSpacing = (gBeamTotalZ - 3.0) / totalLetters;
        letterLabels.forEach((_, li) => {
          const lz = -(gBeamTotalZ/2 - 1.5) + li * letterSpacing + letterSpacing/2;
          const letter = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.3), gWhiteSign);
          letter.position.set(gArchBeamD/2 + 0.07, gPylonH + gArchBeamH * 0.6, lz);
          grp.add(letter);
        });

        // College emblem circle on arch (left side)
        const emblemCircle = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 24), gWhiteSign);
        emblemCircle.rotation.x = Math.PI/2;
        emblemCircle.position.set(gArchBeamD/2 + 0.08, gPylonH + gArchBeamH/2, -gBeamTotalZ/2 + 1.5);
        grp.add(emblemCircle);

        const emblemRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 24), gGold);
        emblemRing.position.set(gArchBeamD/2 + 0.16, gPylonH + gArchBeamH/2, -gBeamTotalZ/2 + 1.5);
        grp.add(emblemRing);

        // "Sponsored by Matrusri Education Society" lower dark board
        const lowerBoard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, gArchHalfSpan * 1.2), gBlueSign);
        lowerBoard.position.set(gArchBeamD/2 + 0.05, gPylonH/2 - 0.5, 0);
        grp.add(lowerBoard);
        const lowerText = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, gArchHalfSpan * 1.1), gWhiteSign);
        lowerText.position.set(gArchBeamD/2 + 0.06, gPylonH/2 - 0.5, 0);
        grp.add(lowerText);

        // ── 3. Signature MVSR Vertical Tower ──────────────────────────────
        // The iconic tall white pillar with red "MVSR" on the face — right pylon side
        const towerX   = 0;
        const towerZ   = gArchHalfSpan + gPylonW/2; // just outside right pylon
        const towerW   = 1.8;
        const towerD   = 1.8;
        const towerH   = gPylonH + gArchBeamH + 5.5; // tall, rising above arch

        // Tower main body (white)
        const towerBody = new THREE.Mesh(new THREE.BoxGeometry(towerD, towerH, towerW), gWhite);
        towerBody.position.set(towerX, towerH/2, towerZ);
        grp.add(towerBody);

        // Tower base plinth (wider)
        const towerBase = new THREE.Mesh(new THREE.BoxGeometry(towerD + 0.6, 0.7, towerW + 0.6), gDarkSlate);
        towerBase.position.set(towerX, 0.35, towerZ);
        grp.add(towerBase);

        // Tower cap
        const towerCap = new THREE.Mesh(new THREE.BoxGeometry(towerD + 0.4, 0.5, towerW + 0.4), gGold);
        towerCap.position.set(towerX, towerH + 0.25, towerZ);
        grp.add(towerCap);

        // "MVSR" bold red letter blocks on front face of tower (stacked vertically)
        const mvsrLetters = ['M', 'V', 'S', 'R'];
        const mvsrStartY  = towerH * 0.45;
        const mvsrSpacing = 2.0;
        mvsrLetters.forEach((letter, li) => {
          const ly = mvsrStartY + li * mvsrSpacing;
          const mBlock = new THREE.Mesh(new THREE.BoxGeometry(towerD + 0.12, 1.6, towerW - 0.2), gRed);
          mBlock.position.set(towerX, ly, towerZ);
          grp.add(mBlock);

          // Highlight strip on each letter block
          const highlight = new THREE.Mesh(new THREE.BoxGeometry(towerD + 0.13, 0.06, towerW), gWhite);
          highlight.position.set(towerX, ly + 0.82, towerZ);
          grp.add(highlight);
        });

        // College name text below MVSR (small white blocks)
        const subText = new THREE.Mesh(new THREE.BoxGeometry(towerD + 0.12, 0.5, towerW - 0.3), gWhiteSign);
        subText.position.set(towerX, mvsrStartY - 1.2, towerZ);
        grp.add(subText);

        // Emblem on tower top
        const towerEmblem = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.18, 24), gWhiteSign);
        towerEmblem.rotation.x = Math.PI/2;
        towerEmblem.position.set(towerX, towerH - 0.6, towerZ);
        grp.add(towerEmblem);
        const towerEmblemRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 24), gGold);
        towerEmblemRing.position.set(towerX, towerH - 0.6, towerZ);
        grp.add(towerEmblemRing);

        // ── 4. Wrought-Iron Black Gate Panels ─────────────────────────────
        const gGateH        = gPylonH - 0.8;
        const gateOpeningZ  = gArchHalfSpan * 1.8; // full opening span
        const numBars       = 28;
        const barSpacing    = gateOpeningZ / numBars;

        // Gate frame (top and bottom horizontal rails)
        const gateTopRail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, gateOpeningZ), gIron);
        gateTopRail.position.set(gArchBeamD/2 - 0.5, gGateH - 0.1, 0);
        grp.add(gateTopRail);

        const gateMidRail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, gateOpeningZ), gIron);
        gateMidRail.position.set(gArchBeamD/2 - 0.5, gGateH * 0.5, 0);
        grp.add(gateMidRail);

        const gateBotRail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, gateOpeningZ), gIron);
        gateBotRail.position.set(gArchBeamD/2 - 0.5, 0.4, 0);
        grp.add(gateBotRail);

        // Vertical bars with pointed tops
        for (let gi = 0; gi < numBars; gi++) {
          const gz = -gateOpeningZ/2 + gi * barSpacing + barSpacing/2;
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, gGateH, 0.12), gIron);
          bar.position.set(gArchBeamD/2 - 0.5, gGateH/2, gz);
          grp.add(bar);

          // Pointed spear top on every other bar
          if (gi % 2 === 0) {
            const spear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 4), gIron);
            spear.position.set(gArchBeamD/2 - 0.5, gGateH + 0.2, gz);
            grp.add(spear);
          }
        }

        // ── 5. Boundary Walls extending N and S from pylons ───────────────
        const wallH        = 3.5;
        const wallThick    = 1.0;
        const wallSpan     = b.gateSpan ?? (b.id === 'backgate' ? b.w : b.d);
        const wallLength   = Math.max(0, (wallSpan - gArchHalfSpan * 2 - gPylonW * 2) / 2); // each side
        const wallOffset   = gArchHalfSpan + gPylonW + wallLength / 2;

        if (wallLength > 0) {
          [-1, 1].forEach(side => {
            // Wall body
            const wall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, wallLength), gCharcoal);
          wall.position.set(0, wallH/2, side * wallOffset);
          grp.add(wall);

          // Wall top coping (cap)
          const cope = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 0.2, 0.3, wallLength + 0.1), gDarkSlate);
          cope.position.set(0, wallH + 0.15, side * wallOffset);
          grp.add(cope);

          // Small decorative pilasters every 8 units along the wall
          const numPilasters = Math.floor(wallLength / 8);
          for (let pi = 0; pi < numPilasters; pi++) {
            const pz = side * (gArchHalfSpan + gPylonW + pi * 8 + 4);
            const pilaster = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 0.3, wallH + 0.5, 0.5), gDarkSlate);
            pilaster.position.set(0, (wallH + 0.5)/2, pz);
            grp.add(pilaster);
          }
        });
        }


        // ── 7. Central Flagpole ────────────────────────────────────────────
        const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 14, 8), gWhite);
        flagPole.position.set(-6, 7, 0);
        grp.add(flagPole);

        // Flag (simple coloured quad)
        const flagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 2.5),
          new THREE.MeshStandardMaterial({ color: 0xFF9933, side: THREE.DoubleSide, roughness: 0.9 }));
        flagMesh.position.set(-6, 13.5, 1.25);
        grp.add(flagMesh);

        // Flagpole top ball
        const fpBall = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.8, roughness: 0.3 }));
        fpBall.position.set(-6, 14.05, 0);
        grp.add(fpBall);

        // Flagpole base
        const fpBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.5, 10), gConcrete);
        fpBase.position.set(-6, 0.25, 0);
        grp.add(fpBase);

        // ── 8. Gate Night Lights ────────────────────────────────────────────
        const gl1 = new THREE.PointLight(0xFFF3D0, 0, 20, 1.8);
        gl1.position.set(gArchBeamD/2 + 0.2, gPylonH + gArchBeamH - 0.5, -gArchHalfSpan/2);
        grp.add(gl1);
        nightLightsRef.current.push({ light: gl1, onIntensity: 15 });

        const gl2 = new THREE.PointLight(0xFFF3D0, 0, 20, 1.8);
        gl2.position.set(gArchBeamD/2 + 0.2, gPylonH + gArchBeamH - 0.5, gArchHalfSpan/2);
        grp.add(gl2);
        nightLightsRef.current.push({ light: gl2, onIntensity: 15 });

        // Warm amber spotlight on MVSR tower at night
        const gl3 = new THREE.PointLight(0xFF8C00, 0, 18, 2.0);
        gl3.position.set(towerX + 3, towerH * 0.7, towerZ);
        grp.add(gl3);
        nightLightsRef.current.push({ light: gl3, onIntensity: 12 });
      } else if (b.id === 'boyshostel' || b.id === 'girlshostel') {
        // ─── MVSR Hostel — Enhanced with Full Lighting ───────────────────────

        f1.geometry.dispose();
        f1.visible = false;
        grp.rotation.y = b.rotY ?? -Math.PI / 2; // Front (local +z) faces the college
        grp.children.forEach(c => { if (c !== f1) c.visible = false; });

        const hFloors   = 6;
        const hFloorH   = FLOOR_H;
        const hTotalH   = hFloors * hFloorH;
        const hW        = b.w;
        const hD        = b.d;
        const isBoys    = b.id === 'boyshostel';
        const accentClr = isBoys ? 0x1565C0 : 0xAD1457; // blue for boys, pink for girls

        // ── Premium Materials ────────────────────────────────────────────────
        const hNavy     = new THREE.MeshStandardMaterial({ color: 0x1E2D5F, roughness: 0.8,  metalness: 0.05 });
        const hBrick    = new THREE.MeshStandardMaterial({ color: 0x6B1F1F, roughness: 1.0  });
        const hBrickLt  = new THREE.MeshStandardMaterial({ color: 0x8B3030, roughness: 0.98 }); // lighter brick variant
        const hWhite    = new THREE.MeshStandardMaterial({ color: 0xEFF3F8, roughness: 0.8  });
        const hConcrete = new THREE.MeshStandardMaterial({ color: 0xC8D0DC, roughness: 0.92 });
        const hFrameMat = new THREE.MeshStandardMaterial({ color: 0xF0F4FA, roughness: 0.7  });
        const hGrille   = new THREE.MeshStandardMaterial({ color: 0x8898A8, roughness: 0.8,  metalness: 0.3 });
        const hRailing  = new THREE.MeshStandardMaterial({ color: 0x606880, roughness: 0.6,  metalness: 0.5 });
        const hAccent   = new THREE.MeshStandardMaterial({ color: accentClr, roughness: 0.8 });

        // Emissive window glass — warm interior glow
        const hWinDay   = new THREE.MeshStandardMaterial({ color: 0x0D1A2A, roughness: 0.2, metalness: 0.4 });
        const hWinGlow  = new THREE.MeshStandardMaterial({ color: 0xFFF8E1, emissive: 0xFFE082, emissiveIntensity: 0.6, roughness: 0.3 });

        // ── 1. Vertical Stripe Facade — both front (z+) and back (z-) ─────────
        const hStripes = [
          { w: 2.1, mat: hNavy  },
          { w: 2.6, mat: hBrick },
          { w: 1.4, mat: hNavy  },
          { w: 3.2, mat: hWhite },
          { w: 1.4, mat: hNavy  },
          { w: 2.6, mat: hBrick },
          { w: 1.7, mat: hNavy  },
        ];
        const totalSW = hStripes.reduce((s, r) => s + r.w, 0);
        const hSc     = hW / totalSW;

        let curX = -hW / 2;
        hStripes.forEach((stripe, si) => {
          const sw = stripe.w * hSc;
          // Main body slab
          const body = new THREE.Mesh(new THREE.BoxGeometry(sw, hTotalH, hD), stripe.mat);
          body.position.set(curX + sw/2, hTotalH/2, 0);
          grp.add(body);

          // Brick relief texture: subtle raised panels on brick stripes
          if (stripe.mat === hBrick) {
            for (let fl = 0; fl < hFloors; fl++) {
              const panel = new THREE.Mesh(new THREE.BoxGeometry(sw - 0.15, hFloorH - 0.25, 0.08), hBrickLt);
              panel.position.set(curX + sw/2, fl * hFloorH + hFloorH/2, hD/2 + 0.04);
              grp.add(panel);
            }
          }
          curX += sw;
        });

        // ── 2. Horizontal Floor Bands ──────────────────────────────────────────
        for (let fl = 0; fl <= hFloors; fl++) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(hW + 0.2, 0.22, hD + 0.1), hConcrete);
          band.position.set(0, fl * hFloorH, 0);
          grp.add(band);
        }

        // ── 3. Corner Columns (4 vertical columns, one at each corner) ─────────
        [[-hW/2, -hD/2], [-hW/2, hD/2], [hW/2, -hD/2], [hW/2, hD/2]].forEach(([cx, cz]) => {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, hTotalH + 1.0, 0.6), hConcrete);
          col.position.set(cx, hTotalH/2, cz);
          grp.add(col);
          const colCap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), hNavy);
          colCap.position.set(cx, hTotalH + 0.15, cz);
          grp.add(colCap);
        });

        // ── 4. Windows + Emissive Glow + White Concrete Awnings ───────────────
        const hWinW      = 1.55;
        const hWinH      = 1.05;
        const hAwningW   = hWinW + 0.55;
        const hAwningH   = 0.14;
        const hAwningD   = 0.60;
        const hWinYBase  = hFloorH * 0.56;
        const zFront     = hD / 2 + 0.05;
        const hWinCols   = 6;
        const hWinSpacing = hW / (hWinCols + 1);

        for (let fl = 1; fl <= hFloors; fl++) {
          const baseY = (fl - 1) * hFloorH;
          const winY  = baseY + hWinYBase;

          for (let col = 1; col <= hWinCols; col++) {
            const wx = -hW/2 + col * hWinSpacing;

            // Alternate: even windows glow warmly (rooms with lights on)
            const isLit = (fl + col) % 3 !== 0; // most windows lit
            const glassMat = isLit ? hWinGlow : hWinDay;

            // Window glass
            const glass = new THREE.Mesh(new THREE.BoxGeometry(hWinW, hWinH, 0.09), glassMat);
            glass.position.set(wx, winY, zFront);
            grp.add(glass);

            // Outer frame — top / bottom / left / right
            const fT = new THREE.Mesh(new THREE.BoxGeometry(hWinW + 0.14, 0.09, 0.12), hFrameMat);
            fT.position.set(wx, winY + hWinH/2 + 0.045, zFront + 0.01);
            const fB = new THREE.Mesh(new THREE.BoxGeometry(hWinW + 0.14, 0.09, 0.12), hFrameMat);
            fB.position.set(wx, winY - hWinH/2 - 0.045, zFront + 0.01);
            const fL = new THREE.Mesh(new THREE.BoxGeometry(0.09, hWinH + 0.12, 0.12), hFrameMat);
            fL.position.set(wx - hWinW/2 - 0.045, winY, zFront + 0.01);
            const fR = new THREE.Mesh(new THREE.BoxGeometry(0.09, hWinH + 0.12, 0.12), hFrameMat);
            fR.position.set(wx + hWinW/2 + 0.045, winY, zFront + 0.01);
            grp.add(fT, fB, fL, fR);

            // Center vertical pane divider
            const div = new THREE.Mesh(new THREE.BoxGeometry(0.05, hWinH, 0.11), hFrameMat);
            div.position.set(wx, winY, zFront + 0.01);
            grp.add(div);

            // Metal horizontal grilles (3 bars)
            for (let gr = 1; gr <= 3; gr++) {
              const gy = winY - hWinH/2 + gr * (hWinH / 4);
              const grille = new THREE.Mesh(new THREE.BoxGeometry(hWinW - 0.1, 0.045, 0.07), hGrille);
              grille.position.set(wx, gy, zFront + 0.02);
              grp.add(grille);
            }

            // Window sill (small ledge below window)
            const sill = new THREE.Mesh(new THREE.BoxGeometry(hWinW + 0.3, 0.08, 0.18), hConcrete);
            sill.position.set(wx, winY - hWinH/2 - 0.09, zFront + 0.07);
            grp.add(sill);

            // ── THE SIGNATURE WHITE CONCRETE SUN-SHADE AWNING ──
            const awning = new THREE.Mesh(new THREE.BoxGeometry(hAwningW, hAwningH, hAwningD), hConcrete);
            awning.position.set(wx, winY + hWinH/2 + hAwningH + 0.1, zFront + hAwningD/2 - 0.05);
            grp.add(awning);

            // Awning front drip edge
            const drip = new THREE.Mesh(new THREE.BoxGeometry(hAwningW, 0.07, 0.07), hFrameMat);
            drip.position.set(wx, winY + hWinH/2 + 0.08, zFront + hAwningD - 0.01);
            grp.add(drip);

            // Awning support brackets
            [-hWinW/3, hWinW/3].forEach(bx => {
              const brkt = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, hAwningD * 0.65), hConcrete);
              brkt.position.set(wx + bx, winY + hWinH/2 + 0.1, zFront + hAwningD * 0.32);
              grp.add(brkt);
            });
          }
        }

        // ── 5. Corridor / Balcony Railings on each floor ──────────────────────
        // A thin continuous ledge + railing runs across the full width at each floor
        for (let fl = 1; fl <= hFloors; fl++) {
          const ledgeY = (fl - 1) * hFloorH + 0.12;

          // Continuous ledge slab
          const ledge = new THREE.Mesh(new THREE.BoxGeometry(hW + 0.2, 0.12, 0.22), hConcrete);
          ledge.position.set(0, ledgeY, zFront + 0.06);
          grp.add(ledge);

          // Railing top rail
          const rail = new THREE.Mesh(new THREE.BoxGeometry(hW + 0.2, 0.06, 0.06), hRailing);
          rail.position.set(0, ledgeY + 0.9, zFront + 0.06);
          grp.add(rail);

          // Railing posts every 1.5 units
          for (let px = -hW/2; px <= hW/2; px += 1.5) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), hRailing);
            post.position.set(px, ledgeY + 0.45, zFront + 0.06);
            grp.add(post);
          }
        }

        // ── 6. Wall Sconce Lights (on facade between floors) ─────────────────
        // These are the small wall-mounted exterior lights seen on hostels
        const sconcePositions = [];
        [-hW/4, 0, hW/4].forEach(sx => {
          for (let fl = 1; fl <= hFloors; fl++) {
            sconcePositions.push({ x: sx, y: fl * hFloorH - 0.4 });
          }
        });

        const sconceMat = new THREE.MeshStandardMaterial({
          color: 0xFFE0A0, emissive: 0xFFCC44, emissiveIntensity: 1.2, roughness: 0.5
        });

        sconcePositions.forEach(sp => {
          // Small glowing disc (the light bulb)
          const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), sconceMat);
          sconce.position.set(sp.x, sp.y, zFront + 0.15);
          grp.add(sconce);

          // Sconce housing (small bracket box)
          const housing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.22), hConcrete);
          housing.position.set(sp.x, sp.y, zFront + 0.1);
          grp.add(housing);

          // Night point light from each sconce
          const sLight = new THREE.PointLight(0xFFEE88, 0, 8, 2.0);
          sLight.position.set(sp.x, sp.y, zFront + 0.3);
          grp.add(sLight);
          nightLightsRef.current.push({ light: sLight, onIntensity: 4 });
        });

        // ── 7. Ground Floor Entrance ──────────────────────────────────────────
        const entW = 3.5; const entH = 2.6; const canD = 1.3;

        // Entrance door glass
        const entDoor = new THREE.Mesh(new THREE.BoxGeometry(entW, entH, 0.1), hWinDay);
        entDoor.position.set(0, entH/2, zFront);
        grp.add(entDoor);

        // Door frame
        [[-entW/2 - 0.06, 0.09, entH/2], [entW/2 + 0.06, 0.09, entH/2]].forEach(([ex, ew, eh]) => {
          const f = new THREE.Mesh(new THREE.BoxGeometry(ew, entH, 0.14), hFrameMat);
          f.position.set(ex, eh, zFront); grp.add(f);
        });
        const entTop = new THREE.Mesh(new THREE.BoxGeometry(entW + 0.2, 0.1, 0.14), hFrameMat);
        entTop.position.set(0, entH + 0.05, zFront); grp.add(entTop);

        // Entrance canopy with accent colour band
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(entW + 2.0, 0.22, canD), hConcrete);
        canopy.position.set(0, entH + 0.11, zFront + canD/2 - 0.06); grp.add(canopy);
        const canFront = new THREE.Mesh(new THREE.BoxGeometry(entW + 2.0, 0.35, 0.08), hAccent);
        canFront.position.set(0, entH + 0.0, zFront + canD - 0.01); grp.add(canFront);

        // Entrance warm flood light
        const entLight = new THREE.PointLight(isBoys ? 0xAADDFF : 0xFFAACC, 0, 12, 1.8);
        entLight.position.set(0, entH + 0.5, zFront + 1.0);
        grp.add(entLight);
        nightLightsRef.current.push({ light: entLight, onIntensity: 10 });

        // ── 8. Podium / Base Platform ─────────────────────────────────────────
        const podium = new THREE.Mesh(new THREE.BoxGeometry(hW + 1.0, 0.5, hD + 0.5), hConcrete);
        podium.position.set(0, -0.25, 0);
        grp.add(podium);

        // Pathway lights along the front of the building
        for (let px = -hW/2 + 1; px <= hW/2 - 1; px += 3.5) {
          const postMat = new THREE.MeshStandardMaterial({ color: 0x607080, metalness: 0.5 });
          const lampGeo = new THREE.MeshStandardMaterial({
            color: 0xFFFF88, emissive: 0xFFFF00, emissiveIntensity: 1.5
          });
          const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 6), postMat);
          lampPost.position.set(px, 0.7, zFront + 2.5);
          grp.add(lampPost);

          const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), lampGeo);
          lampHead.position.set(px, 1.42, zFront + 2.5);
          grp.add(lampHead);

          const pathLight = new THREE.PointLight(0xFFFF99, 0, 6, 2.5);
          pathLight.position.set(px, 1.6, zFront + 2.5);
          grp.add(pathLight);
          nightLightsRef.current.push({ light: pathLight, onIntensity: 3 });
        }

        // ── 9. Rooftop Parapet + Accent Lighting ──────────────────────────────
        const parapH  = 1.0;
        const parapBody = new THREE.Mesh(new THREE.BoxGeometry(hW + 0.1, parapH, hD + 0.1), hNavy);
        parapBody.position.set(0, hTotalH + parapH/2, 0);
        grp.add(parapBody);

        // Accent colour band along the top of parapet
        const parapBand = new THREE.Mesh(new THREE.BoxGeometry(hW + 0.1, 0.18, hD + 0.1), hAccent);
        parapBand.position.set(0, hTotalH + parapH - 0.09, 0);
        grp.add(parapBand);

        // White coping cap
        const parapCap = new THREE.Mesh(new THREE.BoxGeometry(hW + 0.35, 0.18, hD + 0.35), hConcrete);
        parapCap.position.set(0, hTotalH + parapH + 0.09, 0);
        grp.add(parapCap);

        // Rooftop flood lights (pointing downward on facade)
        [-hW/3, 0, hW/3].forEach(rx => {
          const roofLight = new THREE.SpotLight(isBoys ? 0xCCEEFF : 0xFFCCEE, 0, 20, Math.PI/5, 0.5);
          roofLight.position.set(rx, hTotalH + parapH + 0.5, hD/2 + 0.3);
          roofLight.target.position.set(rx, 0, hD/2 - 2);
          grp.add(roofLight);
          grp.add(roofLight.target);
          nightLightsRef.current.push({ light: roofLight, onIntensity: 8 });
        });

        // ── 10. Hostel Name Sign Board ────────────────────────────────────────
        const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 4.5), hAccent);
        signBoard.position.set(hW/2 + 0.06, 5.0, 0);
        grp.add(signBoard);
        const signText = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 4.0), hFrameMat);
        signText.position.set(hW/2 + 0.07, 5.0, 0);
        grp.add(signText);

        // Sign glow light
        const signLight = new THREE.PointLight(accentClr, 0, 8, 1.5);
        signLight.position.set(hW/2 + 1.0, 5.0, 0);
        grp.add(signLight);
        nightLightsRef.current.push({ light: signLight, onIntensity: 6 });
      }
      // Lawn, planters and a shade tree in open courtyards (CSE has its own courtyard garden)
      if (b.court && b.id !== 'cse') grp.add(createCourtyardGarden(b.court));

      const label = makeLabel(b.name, { scale: b.shape === 'oval' ? 1.05 : 1 });
      label.position.set(0, (floors * FLOOR_H) + 3.2, 0);
      grp.add(label);

      grp.userData = { building: b };
      buildingGroup.add(grp);

      // Night mode entryway light
      if (b.gate) {
        const light = new THREE.PointLight(0xffddaa, 0, 25, 1.5);
        light.position.set(b.gate.x, 2, b.gate.z);
        scene.add(light);
        nightLightsRef.current.push({ light, onIntensity: 20 });
      }
    });

    // Live-session markers for every building that can host classes
    const liveMarkersGroup = new THREE.Group();
    scene.add(liveMarkersGroup);
    liveMarkersRef.current = {};
    BUILDINGS.forEach((b) => {
      if (['frontgate', 'backgate', 'security', 'boyshostel', 'girlshostel'].includes(b.id)) return;
      const levels = ['sh', 'exam'].includes(b.id) ? 4 : (b.floors || 2);
      const marker = createLiveMarker(footprintOf(b), 21, levels * FLOOR_H + 0.4);
      liveMarkersGroup.add(marker.group);
      marker.setCount(liveRef.current.sessions[b.id]?.length || 0); // in case the scene is rebuilt mid-session
      liveMarkersRef.current[b.id] = marker;
    });

    // Students walking between buildings; how many depends on the campus clock
    const crowd = createCrowd({ scene, poolSize: 40, makeStudent: createStudentMesh, nodes: NODES, adjacency: ADJACENCY });

    // Document tokens: one glowing envelope per active request of the signed-in student
    const tokenLayer = new THREE.Group();
    scene.add(tokenLayer);
    const docTokens = new Map();
    const TOKEN_SHORT = {
      bonafide: 'Bonafide', noc: 'NOC', tc: 'TC', conduct: 'Conduct', course_completion: 'Completion',
      moi: 'MOI', provisional: 'PC', cmm: 'CMM', transcripts: 'Transcripts',
    };
    const RECENT_MS = 7 * 24 * 3600 * 1000; // issued documents stay on the map for a week
    docTokenApiRef.current = {
      sync(requests) {
        const now = Date.now();
        const active = requests.filter((r) => ['in_review', 'processing', 'awaiting_payment'].includes(r.status)
          || (r.status === 'approved' && r.issued_at && now - new Date(`${r.issued_at}Z`).getTime() < RECENT_MS));
        const byPlace = {};
        active.forEach((r) => { (byPlace[r.location] ||= []).push(r); });
        const keep = new Set();
        Object.entries(byPlace).forEach(([place, list]) => {
          const b = BUILDINGS.find((x) => x.id === place);
          if (!b) return;
          list.forEach((r, i) => {
            keep.add(r.id);
            let token = docTokens.get(r.id);
            const isNew = !token;
            if (isNew) {
              token = createDocToken();
              tokenLayer.add(token.group);
              pickable.push(...token.pickables);
              docTokens.set(r.id, token);
            }
            const x = b.x + (i - (list.length - 1) / 2) * 8;
            token.moveTo(x, b.z, isNew);
            const name = TOKEN_SHORT[r.doc_type] || r.doc_name;
            if (r.status === 'approved') token.setInfo(`✅ ${name} ready · ${r.counter_name}`, 'ready');
            else if (r.status === 'awaiting_payment') token.setInfo(`💳 ${name} · fee ₹${r.amount} due`, 'quest');
            else if (r.status === 'processing') token.setInfo(`🖨 ${name} · being prepared`, 'review');
            else if (r.overdue) token.setInfo(`⚠ ${name} · ${r.current_label} · ${fmtWaiting(r.waiting_hours)}`, 'overdue');
            else token.setInfo(`📄 ${name} · with ${r.current_label}`, 'review');
            token.setUserData({ building: {
              id: `doc-${r.id}`, name: r.doc_name, type: 'Your request', requestId: r.id,
              depts: [whereNow(r), r.ref_no], x, z: b.z,
            } });
          });
        });
        docTokens.forEach((token, id) => {
          if (keep.has(id)) return;
          tokenLayer.remove(token.group);
          token.pickables.forEach((m) => { const k = pickable.indexOf(m); if (k >= 0) pickable.splice(k, 1); });
          token.dispose();
          docTokens.delete(id);
        });
      },
    };

    // Joining Day: one gold beacon over the joinee's next stop (a building or the Bank & ATM)
    let questToken = null;
    questApiRef.current = {
      set(place, text) {
        const spot = BUILDINGS.find((b) => b.id === place) || GROUNDS.find((g) => g.name === place);
        if (!spot) return this.clear();
        const isNew = !questToken;
        if (isNew) {
          questToken = createDocToken();
          tokenLayer.add(questToken.group);
          pickable.push(...questToken.pickables);
        }
        questToken.moveTo(spot.x, spot.z, isNew);
        questToken.setInfo(text, 'quest');
        questToken.setUserData({ building: {
          id: 'joining-quest', name: 'Joining Day', type: 'Your next stop', depts: [text.replace(/^🎓\s*/, ''), PLACE_NAMES[place] || place],
          x: spot.x, z: spot.z, quest: true,
        } });
      },
      clear() {
        if (!questToken) return;
        tokenLayer.remove(questToken.group);
        questToken.pickables.forEach((m) => { const k = pickable.indexOf(m); if (k >= 0) pickable.splice(k, 1); });
        questToken.dispose();
        questToken = null;
      },
    };

    // Leaving the college: a pin on every no-dues section's building
    const clearancePins = new Map();   // unit -> pin
    const CLEARANCE_WORDS = { pending: 'waiting', dues: 'dues', cleared: 'cleared' };
    clearanceApiRef.current = {
      sync(exitRec) {
        const items = exitRec ? exitRec.items : [];
        const keep = new Set();
        items.forEach((it) => {
          const b = BUILDINGS.find((x) => x.id === it.place);
          const g = b ? null : GROUNDS.find((x) => x.name === it.place);
          if (!b && !g) return;
          keep.add(it.unit);
          let pin = clearancePins.get(it.unit);
          if (!pin) {
            const fp = b ? footprintOf(b) : { x: g.x, z: g.z, w: g.w, d: g.d };
            const roof = b ? (['sh', 'exam'].includes(b.id) ? 4 : (b.floors || 2)) * FLOOR_H : 1;
            pin = createClearancePin(fp, roof);
            tokenLayer.add(pin.group);
            pickable.push(...pin.pickables);
            clearancePins.set(it.unit, pin);
          }
          const text = it.status === 'dues' ? `${it.label} · ₹${it.dues_amount} due` : `${it.label} · ${CLEARANCE_WORDS[it.status]}`;
          pin.setState(it.status, text);
          pin.setUserData({ building: {
            id: `clearance-${it.unit}`, name: `${it.label} · no-dues`, type: 'Your clearance', clearance: true,
            depts: [it.status === 'dues' ? `Dues ₹${it.dues_amount}: ${it.remarks}` : it.status === 'cleared' ? `Cleared by ${it.acted_by}` : 'Waiting for this section',
              PLACE_NAMES[it.place] || it.place],
            x: (b || g).x, z: (b || g).z,
          } });
        });
        clearancePins.forEach((pin, unit) => {
          if (keep.has(unit)) return;
          tokenLayer.remove(pin.group);
          pin.pickables.forEach((m) => { const k = pickable.indexOf(m); if (k >= 0) pickable.splice(k, 1); });
          pin.dispose();
          clearancePins.delete(unit);
        });
      },
    };

    // Arrival fly-in: ends exactly at the default orbit view
    const introEnd = camera.position.clone();
    const introPath = createIntroPath(introEnd, target.clone());

    floor1Ref.current = floor1List;
    floor2Ref.current = floor2List;

    // Grounds & Roads
    GROUNDS.forEach((g) => {
      let mesh;
      const h = g.h || 0.35;
      if (g.shape === 'oval') {
        const geo = new THREE.CylinderGeometry(g.w / 2, g.w / 2, h, 40);
        geo.scale(1, 1, g.d / g.w);
        mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: g.color, roughness: 1 }));
      } else if (g.shape === 'curbed-median') {
        mesh = new THREE.Group();
        const curbThickness = 0.8;
        
        const getStripedMat = (length) => {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, 64, 128);
            ctx.fillStyle = '#FFC107'; ctx.fillRect(64, 0, 64, 128);
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(Math.max(1, Math.floor(length / 2.5)), 1);
            tex.colorSpace = THREE.SRGBColorSpace;
            return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
        };

        const topMat = getStripedMat(g.w);
        const sideMat = getStripedMat(g.d);

        const edge1 = new THREE.Mesh(new THREE.BoxGeometry(g.w, h, curbThickness), topMat);
        edge1.position.set(0, 0, -g.d/2 + curbThickness/2);
        const edge2 = new THREE.Mesh(new THREE.BoxGeometry(g.w, h, curbThickness), topMat);
        edge2.position.set(0, 0, g.d/2 - curbThickness/2);
        
        const innerD = g.d - curbThickness * 2;
        const edge3 = new THREE.Mesh(new THREE.BoxGeometry(innerD, h, curbThickness), sideMat);
        edge3.rotation.y = Math.PI / 2;
        edge3.position.set(-g.w/2 + curbThickness/2, 0, 0);
        const edge4 = new THREE.Mesh(new THREE.BoxGeometry(innerD, h, curbThickness), sideMat);
        edge4.rotation.y = Math.PI / 2;
        edge4.position.set(g.w/2 - curbThickness/2, 0, 0);
        
        const innerW = g.w - curbThickness * 2;
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x4F7942, roughness: 1 });
        const grass = new THREE.Mesh(new THREE.BoxGeometry(innerW, h + 0.1, innerD), grassMat);
        grass.position.set(0, 0.05, 0);
        
        mesh.add(edge1, edge2, edge3, edge4, grass);
            } else {
        let mat = new THREE.MeshStandardMaterial({ color: g.color, roughness: 1 });
        
        // --- INTERACTIVE GROUND UPGRADES ---
        if (g.name.startsWith('Basketball Court')) {
          const cvs = document.createElement('canvas');
          cvs.width = 512; cvs.height = 256;
          const ctx = cvs.getContext('2d');
          ctx.fillStyle = '#3A6EA5'; ctx.fillRect(0, 0, 512, 256); // blue surround
          ctx.fillStyle = '#2F7D4F'; ctx.fillRect(10, 10, 492, 236);  // green court
          ctx.fillStyle = '#C8693A'; ctx.fillRect(10, 80, 100, 96); ctx.fillRect(402, 80, 100, 96); // keys
          ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6;
          // Court outline
          ctx.strokeRect(10, 10, 492, 236);
          // Center line and circle
          ctx.beginPath(); ctx.moveTo(256, 10); ctx.lineTo(256, 246); ctx.stroke();
          ctx.beginPath(); ctx.arc(256, 128, 40, 0, 2*Math.PI); ctx.stroke();
          // Keys
          ctx.strokeRect(10, 80, 100, 96);
          ctx.strokeRect(402, 80, 100, 96);
          // 3pt arcs
          ctx.beginPath(); ctx.arc(10, 128, 120, -Math.PI/2.5, Math.PI/2.5); ctx.stroke();
          ctx.beginPath(); ctx.arc(502, 128, 120, Math.PI - Math.PI/2.5, Math.PI + Math.PI/2.5); ctx.stroke();
          const tex = new THREE.CanvasTexture(cvs);
          tex.colorSpace = THREE.SRGBColorSpace;
          if (g.d > g.w) { tex.center.set(0.5, 0.5); tex.rotation = Math.PI / 2; } // court runs north-south
          mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
        } else if (g.name.includes('Garden') || g.name === 'Ground') {
          // Add a procedural-looking grass pattern
          const cvs = document.createElement('canvas');
          cvs.width = 256; cvs.height = 256;
          const ctx = cvs.getContext('2d');
          const isSand = g.name === 'Ground'; // the open ground is bare sand on the imagery
          ctx.fillStyle = isSand ? '#D9C49A' : '#6FA85A';
          ctx.fillRect(0, 0, 256, 256);
          for(let i=0; i<150; i++) {
            if (isSand) ctx.fillStyle = (Math.random()>0.5)? '#C8B07F' : '#E6D6B0';
            else ctx.fillStyle = (Math.random()>0.5)? '#5b8e45' : '#8ab974';
            ctx.beginPath(); ctx.arc(Math.random()*256, Math.random()*256, Math.random()*4+2, 0, 2*Math.PI); ctx.fill();
          }
          const tex = new THREE.CanvasTexture(cvs);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
          // Polygon UVs are in metres, box UVs span the whole face
          if (g.shape === 'polygon') tex.repeat.set(1 / 4, 1 / 4);
          else tex.repeat.set(g.w/4, g.d/4);
          mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1.0 });
        }
        // ------------------------------------
        
        let geo;
        if (g.shape === 'polygon') {
          const outline = new THREE.Shape(g.points.map(([px, pz]) => new THREE.Vector2(px - g.x, -(pz - g.z))));
          geo = new THREE.ExtrudeGeometry(outline, { depth: h, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);
          geo.translate(0, -h / 2, 0);
        } else {
          geo = new THREE.BoxGeometry(g.w, h, g.d);
        }
        mesh = new THREE.Mesh(geo, mat);
      }
      mesh.position.set(g.x, h / 2, g.z);
      if (g.rotY) mesh.rotation.y = g.rotY;
      mesh.receiveShadow = true;
      
      // Make it pickable/interactive!
      if (!g.name.includes('Road') && !g.name.includes('Path')) {
         mesh.userData = { building: { id: g.name, name: g.name, type: 'Campus Zone', x: g.x, z: g.z, w: g.w, d: g.d } };
         pickable.push(mesh);
      }
      
      scene.add(mesh);

      // Add dashed white lines for paths and roads
      if (g.name.includes('Path') || g.name.includes('Road')) {
        const isHoriz = g.w > g.d;
        const length = isHoriz ? g.w : g.d;
        const dashLen = 2.0;
        const gap = 3.0;
        const step = dashLen + gap;
        const numDashes = Math.floor(length / step);
        const start = -length / 2 + step / 2;
        
        const dashGeo = new THREE.BoxGeometry(isHoriz ? dashLen : 0.3, 0.02, isHoriz ? 0.3 : dashLen);
        const dashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.1 });
        
        for (let i = 0; i < numDashes; i++) {
          const pos = start + i * step;
          const dash = new THREE.Mesh(dashGeo, dashMat);
          dash.position.set(g.x + (isHoriz ? pos : 0), h + 0.01, g.z + (isHoriz ? 0 : pos));
          dash.receiveShadow = true;
          scene.add(dash);
        }
      }

      if (!g.hideLabel) {
        const label = makeLabel(g.name, { scale: 0.72 });
        label.position.set(g.x, 1.6, g.z);
        label.material.opacity = 0.85;
        scene.add(label);
      }

      // Night mode area light
      const hasAreaLight = g.name.startsWith('Basketball Court') || g.name.includes('Garden') ||
        g.name === 'Ground' || g.name.includes('Parking');
      if (hasAreaLight) {
        // use a warm or cool color based on the ground type
        const color = g.name.includes('Parking') ? 0xaaddff : 0xffeebb;
        const light = new THREE.PointLight(color, 0, 65, 1.2);
        light.position.set(g.x, 8, g.z);
        scene.add(light);
        nightLightsRef.current.push({ light, onIntensity: 50 });
      }
    });

    // Walkway Network (Dashed lines)
    const netMat = new THREE.LineDashedMaterial({ color: 0x8a93a0, dashSize: 1.4, gapSize: 1, transparent: true, opacity: 0.35 });
    EDGE_LIST.forEach(([a, c]) => {
      const pa = NODES[a], pc = NODES[c];
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pa.x, 0.4, pa.z),
        new THREE.Vector3(pc.x, 0.4, pc.z),
      ]);
      const line = new THREE.Line(geo, netMat);
      line.computeLineDistances();
      scene.add(line);
    });

    // Orbit Drag Controls
    let dragging = false, lastX = 0, lastY = 0, moved = false;
    let wasShuttle = false;

    const skipIntro = () => {
      if (!introRef.current.active) return;
      introRef.current.active = false;
      setLabelsVisible(true);
      setIntroPlaying(false);
      updateCamera();
    };

    const onPointerDown = (e) => {
      skipIntro();
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      moved = false;
    };

    const onPointerUpWindow = () => { dragging = false; };

    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      if (cameraModeRef.current === 'shuttle' || cameraModeRef.current === 'student') return;
      theta -= dx * 0.0055;
      phi -= dy * 0.0045;
      updateCamera();
    };

    const onWheel = (e) => {
      e.preventDefault();
      skipIntro();
      if (cameraModeRef.current === 'shuttle' || cameraModeRef.current === 'student') return;
      radius += e.deltaY * 0.14;
      updateCamera();
    };

    // Click Selection Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClickRaycast = (e) => {
      if (moved) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(pickable);
      if (hits.length) {
        const ud = hits[0].object.userData;
        if (ud && ud.building) {
          setSelectedBuilding(ud.building);
          
          // Trigger drone fly to the target
          useCampusStore.getState().setAIFlyTarget(ud.building.id || ud.building.name);

          if (ud.building.type === 'Campus Student' || ud.building.type === 'Walking Student') {
            openChatWithTarget(ud.building.id);
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUpWindow);
    window.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('pointerup', onClickRaycast);

    // ResizeObserver for reliable canvas sizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // ══════════════════════════════════════════════════════════════════════════
    // LIVE TRANSIT & AUTONOMOUS BOT TRACKING
    // ══════════════════════════════════════════════════════════════════════════
    const liveTransitGroup = new THREE.Group();
    scene.add(liveTransitGroup);

    // 1. Campus Shuttles (Strictly uses safe corridors to avoid ANY building clipping)
    // Loop: boulevard north lane west -> west road south -> south road east ->
    // EEE-CSE path north -> boulevard south lane east -> back-gate lane to the start.
    const shuttlePts = [
      new THREE.Vector3(18, 0.6, -30),
      new THREE.Vector3(-60, 0.6, -30),
      new THREE.Vector3(-140, 0.6, -30),
      new THREE.Vector3(-187, 0.6, -30),
      new THREE.Vector3(-189, 0.6, -28),
      new THREE.Vector3(-189, 0.6, 10),
      new THREE.Vector3(-189, 0.6, 45),
      new THREE.Vector3(-187, 0.6, 47),
      new THREE.Vector3(-130, 0.6, 47),
      new THREE.Vector3(-75.5, 0.6, 47),
      new THREE.Vector3(-73.5, 0.6, 45),
      new THREE.Vector3(-73.5, 0.6, 10),
      new THREE.Vector3(-73.5, 0.6, -18),
      new THREE.Vector3(-71.5, 0.6, -20),
      new THREE.Vector3(-20, 0.6, -20),
      new THREE.Vector3(18, 0.6, -20),
      new THREE.Vector3(20, 0.6, -22),
      new THREE.Vector3(20, 0.6, -28),
    ];
    // Tension 0.1 makes the corners sharper so it stays on the paths better
    const shuttleCurve = new THREE.CatmullRomCurve3(shuttlePts, true, 'catmullrom', 0.1);

    // Dedicated glowing shuttle lane on the paths
    const trackGeo = new THREE.TubeGeometry(shuttleCurve, 300, 0.15, 8, true);
    const trackMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF, transparent: true, opacity: 0.1 });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    liveTransitGroup.add(trackMesh);

    const shuttles = [];
    for (let i = 0; i < 4; i++) {
      const shuttleGeo = new THREE.BoxGeometry(1.8, 2.2, 4.5);
      const shuttleMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, metalness: 0.4, roughness: 0.2, emissive: 0x00E5FF, emissiveIntensity: 0.5
      });
      const shuttle = new THREE.Mesh(shuttleGeo, shuttleMat);
      shuttle.castShadow = true;
      // (The emissive body supplies the cyan glow. A real PointLight per shuttle cost
      //  every lit pixel in the scene an extra light evaluation, every frame.)
      liveTransitGroup.add(shuttle);
      // Slower speed for campus paths
      shuttles.push({ mesh: shuttle, offset: i * 0.25, speed: 0.02 });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PERFORMANCE: prepare the scene before the first frame
    // ══════════════════════════════════════════════════════════════════════════
    // 1. Night lights start hidden. three.js compiles every light into every shader
    //    (even at intensity 0), and the first frame used to compile with ~100 point
    //    lights — over a minute of shader compilation on Windows/Direct3D.
    streetLightsRef.current.forEach(({ light1, light2 }) => { light1.visible = false; light2.visible = false; });
    nightLightsRef.current.forEach(({ light }) => { light.visible = false; });

    // 2. Fake the street-lamp light pools with one additive glow mesh instead of
    //    ~40 real point lights (a single draw call; shown only at night).
    glowPoolsRef.current = createLightPools(scene, streetLightsRef.current);

    // 3. Merge static, non-interactive meshes per material (thousands of draw calls -> hundreds).
    //    Anything that moves, toggles, is clickable or has per-object material changes is excluded.
    const dynamicObjects = [
      liveTransitGroup,
      rainSystemRef.current, celestialSunRef.current, celestialMoonRef.current,
      ...activeWalkers.map((w) => w.group),
      ...studentList.map((s) => s.group),
      ...smartParkingSpots.map((s) => s.group),
      ...floor1Ref.current, ...floor2Ref.current,
      ...pickable,
      liveMarkersGroup, crowd.group, tokenLayer,
    ];
    // Many objects get their own copy of an identical material; share them first so they can merge.
    // Street-lamp bulb materials are recoloured at night through refs, so they keep their identity.
    dedupeMaterials(scene, {
      exclude: dynamicObjects,
      lockedMaterials: streetLightsRef.current.map((s) => s.bulbMat),
    });
    const mergeStats = mergeStaticMeshes(scene, { exclude: dynamicObjects });
    if (import.meta.env.DEV) console.info(`[twin] merged ${mergeStats.before} static meshes into ${mergeStats.after}`);

    // Real sun over Nadergul. At night the key light comes from a moon opposite the sun.
    const warmLow = new THREE.Color(0xffb36b);
    const noonWhite = new THREE.Color(0xfff4e0);
    applySunRef.current = (date = new Date()) => {
      const { azimuth, elevation } = solarPosition(date, CENTER_LAT, CENTER_LON);
      const up = elevation > 0.03;
      const sunDir = skyDirection(azimuth, Math.max(elevation, 0.06), GRID_ROTATION);
      const moonDir = skyDirection(azimuth + Math.PI, 0.8, GRID_ROTATION);
      sun.position.copy(up ? sunDir : moonDir).multiplyScalar(330);
      celestialSun.position.copy(sunDir).multiplyScalar(650);
      celestialMoon.position.copy(moonDir).multiplyScalar(650);
      celestialSun.visible = !nightRef.current && up;
      if (!nightRef.current) {
        const k = THREE.MathUtils.clamp(Math.sin(elevation) / 0.5, 0, 1); // 0 at the horizon, 1 from ~30° up
        sun.intensity = 0.45 + 0.6 * k;
        sun.color.lerpColors(warmLow, noonWhite, k);
      }
      return { azimuth, elevation, up };
    };
    applySunRef.current();

    // 4. Don't draw while the 3D view is scrolled out of sight.
    let onScreen = true;
    const visibilityObserver = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; });
    visibilityObserver.observe(container);

    // Animation Loop
    let animId;
    const clock = new THREE.Clock();
    
    // For Cinematic Drone Pan
    let currentDroneTarget = null;
    let droneStartTarget = new THREE.Vector3();
    let droneEndTarget = new THREE.Vector3();
    let droneStartTheta = 0;
    let droneStartPhi = 0;
    let droneStartRadius = 0;
    let droneProgress = 1; // 1 means arrived
    const DRONE_DURATION = 2.5; // seconds

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      if (!onScreen || room3DOpenRef.current) return;

      // ── Arrival fly-in ──────────────────────────────────────────────────────
      if (introRef.current.active) {
        if (introRef.current.t === 0) setLabelsVisible(false);
        introRef.current.t = Math.min(1, introRef.current.t + Math.min(dt, 0.05) / INTRO_SECONDS);
        const shot = introPath(introRef.current.t);
        camera.position.copy(shot.position);
        camera.lookAt(shot.target);
        if (introRef.current.t >= 1) {
          introRef.current.active = false;
          setLabelsVisible(true);
          setIntroPlaying(false);
          updateCamera();
        }
      }

      // ── Handle AI Drone Camera Panning ──────────────────────────────────────
      const flyTargetObj = useCampusStore.getState().aiFlyTarget;
      const currentFlyId = flyTargetObj ? flyTargetObj.id : null;
      const currentFlyTs = flyTargetObj ? flyTargetObj.ts : null;
      
      if (currentFlyId && currentFlyTs !== currentDroneTarget && !introRef.current.active) {
        // Start new drone flight!
        currentDroneTarget = currentFlyTs;
        // Exact id, then exact name, then partial name (so 'mecheee' doesn't land on 'ECE')
        const flyId = currentFlyId.toLowerCase();
        let b = BUILDINGS.find((x) => x.id === currentFlyId)
          || BUILDINGS.find((x) => x.name.toLowerCase() === flyId)
          || BUILDINGS.find((x) => x.name.toLowerCase().includes(flyId))
          || BUILDINGS.find((x) => flyId.includes(x.name.toLowerCase()) && x.name.length > 3);
        if (!b) b = GROUNDS.find(g => g.name.toLowerCase() === currentFlyId.toLowerCase());
        
        if (b) {
          droneStartTarget.copy(target);
          droneEndTarget.set(b.x, 4, b.z); // target center of building
          droneStartTheta = theta;
          droneStartPhi = phi;
          droneStartRadius = radius;
          droneProgress = 0;
        }
      } else if (!currentFlyId && currentDroneTarget !== null) {
        currentDroneTarget = null; // reset if cleared
      }

      if (droneProgress < 1) {
        droneProgress += dt / DRONE_DURATION;
        if (droneProgress > 1) droneProgress = 1;
        
        // Smooth step easing (cinematic)
        const t = droneProgress * droneProgress * (3 - 2 * droneProgress); 
        
        target.lerpVectors(droneStartTarget, droneEndTarget, t);
        
        // Slightly rotate and zoom in for a nice aerial reveal
        const targetTheta = droneStartTheta + Math.PI * 0.25; 
        const targetPhi = 0.5; // Look slightly more top-down
        const targetRadius = 120; // Zoom in

        theta = THREE.MathUtils.lerp(droneStartTheta, targetTheta, t);
        phi = THREE.MathUtils.lerp(droneStartPhi, targetPhi, t);
        radius = THREE.MathUtils.lerp(droneStartRadius, targetRadius, t);
        
        updateCamera();
      }

      // ── Handle AI Highlighting ──────────────────────────────────────────────
      const highlights = useCampusStore.getState().aiHighlightTypes;
      const isAnyHighlighted = highlights.length > 0;
      
      const applyHighlight = (meshList) => {
        meshList.forEach(m => {
          const b = m.userData.building;
          if (!b) return;
          const isHighlighted = isAnyHighlighted && highlights.some(h => b.type.toLowerCase().includes(h.toLowerCase()));
          
          if (isAnyHighlighted) {
            if (isHighlighted) {
              m.material.emissive.setHex(b.color);
              m.material.emissiveIntensity = 0.6 + Math.sin(clock.getElapsedTime() * 3) * 0.2; // pulsing glow
              m.material.opacity = 1.0;
            } else {
              m.material.emissive.setHex(0x000000);
              m.material.emissiveIntensity = 0;
              m.material.opacity = 0.15; // dim others
            }
          } else {
            // Restore normal
            m.material.emissive.setHex(0x000000);
            m.material.emissiveIntensity = 0;
            // Floor mode respects opacity
            const mode = useCampusStore.getState().floorMode || 'all';
            const f = m.userData.floor;
            if (mode === 'all') m.material.opacity = 1;
            else if (mode === '1') m.material.opacity = (f === 1) ? 1 : 0.12;
            else if (mode === '2') m.material.opacity = (f === 2) ? 1 : 0.12;
          }
        });
      };
      
      applyHighlight(floor1Ref.current);
      applyHighlight(floor2Ref.current);

      if (routePtsRef.current && routePtsRef.current.length > 1) {
        const speed = 12;
        let total = 0;
        const pts = routePtsRef.current;
        for (let i = 0; i < pts.length - 1; i++) total += pts[i].distanceTo(pts[i + 1]);
        routeAnimTRef.current = (routeAnimTRef.current + dt * speed) % total;
        let acc = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const segLen = pts[i].distanceTo(pts[i + 1]);
          if (routeAnimTRef.current <= acc + segLen) {
            const t = (routeAnimTRef.current - acc) / segLen;
            routeDotRef.current?.position.lerpVectors(pts[i], pts[i + 1], t);
            break;
          }
          acc += segLen;
        }
      }

      // ── Animate Walking Students ──────────────────────────────────────────────
      const time = clock.getElapsedTime();
      activeWalkers.forEach((w) => {
        const p1 = w.pts[0];
        const p2 = w.pts[1];
        const segLen = p1.distanceTo(p2);
        const step = (dt * w.speed) / segLen;

        if (w.forward) {
          w.progress += step;
          if (w.progress >= 1) { w.progress = 1; w.forward = false; }
        } else {
          w.progress -= step;
          if (w.progress <= 0) { w.progress = 0; w.forward = true; }
        }

        w.group.position.lerpVectors(p1, p2, w.progress);
        const dir = new THREE.Vector3().subVectors(w.forward ? p2 : p1, w.forward ? p1 : p2).normalize();
        w.group.rotation.y = Math.atan2(dir.x, dir.z);

        // Limb swinging animation
        const swing = Math.sin(time * 7) * 0.4;
        w.legL.rotation.x = swing;
        w.legR.rotation.x = -swing;
        w.armL.rotation.x = -swing;
        w.armR.rotation.x = swing;

        if (cameraModeRef.current === 'student' && w === activeWalkers[0]) {
          wasShuttle = true; // Use same flag to restore orbit
          const camPos = w.group.position.clone().add(new THREE.Vector3(0, 1.5, 0));
          const lookAtPos = camPos.clone().add(dir.clone().multiplyScalar(5));
          camera.position.copy(camPos);
          camera.lookAt(lookAtPos);
        }
      });

      // ── Live campus: session markers and the crowd ─────────────────────────
      Object.values(liveMarkersRef.current).forEach((m) => m.update(time, nightRef.current));
      crowd.update(Math.min(dt, 0.1), time, liveRef.current.phase);
      docTokens.forEach((t) => t.update(Math.min(dt, 0.1), time));
      questToken?.update(Math.min(dt, 0.1), time);
      clearancePins.forEach((pin) => pin.update(time));

      // ── Animate Live Transit ──────────────────────────────────────────────
      shuttles.forEach((s, idx) => {
        const t = (time * s.speed + s.offset) % 1;
        const pos = shuttleCurve.getPointAt(t);
        const lookAtPos = shuttleCurve.getPointAt((t + 0.01) % 1);
        s.mesh.position.copy(pos);
        s.mesh.lookAt(lookAtPos);

        if (cameraModeRef.current === 'shuttle' && idx === 0) {
          wasShuttle = true;
          const forward = new THREE.Vector3().subVectors(lookAtPos, pos).normalize();
          const camPos = pos.clone().add(new THREE.Vector3(0, 1.2, 0)).add(forward.clone().multiplyScalar(1.0));
          camera.position.copy(camPos);
          camera.lookAt(lookAtPos.clone().add(new THREE.Vector3(0, 1.2, 0)));
        }
      });

      // ── Animate Rain ─────────────────────────────────────────────────────────
      if (rainSystemRef.current && rainSystemRef.current.visible) {
        const positions = rainSystemRef.current.geometry.attributes.position.array;
        for (let i = 1; i < positions.length; i += 3) {
          positions[i] -= 2.5; // fall speed
          if (positions[i] < 0) {
            positions[i] = 150; // reset to sky
          }
        }
        rainSystemRef.current.geometry.attributes.position.needsUpdate = true;
      }

      if (cameraModeRef.current === 'orbit' && wasShuttle) {
        updateCamera();
        wasShuttle = false;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      if (typeof unsubParking === 'function') unsubParking();
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener('pointerup', onPointerUpWindow);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('pointerup', onClickRaycast);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      // Free GPU memory and the WebGL context; previously every visit leaked both
      disposeObject(scene);
      disposeRenderer(renderer);
      sceneRef.current = null;
      glowPoolsRef.current = null;
    };
  }, []);

  // ── Arrival fly-in: once per browser session ───────────────────────────────
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(INTRO_SEEN_KEY) === '1'; sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* storage blocked */ }
    if (!seen) {
      introRef.current = { active: true, t: 0 };
      setIntroPlaying(true);
    }
  }, []);

  const playIntro = () => {
    setCameraMode('orbit');
    introRef.current = { active: true, t: 0 };
    setIntroPlaying(true);
  };
  const skipIntroButton = () => {
    introRef.current.t = 1; // the render loop finishes on the orbit view
  };

  // ── Live campus clock: timetable sessions, campus phase and the sun, every minute ──
  useEffect(() => {
    let cancelled = false;
    let entries = [];
    let classrooms = [];
    let periods = DEFAULT_PERIODS;
    let firstTick = true;

    const tick = () => {
      const now = istNow();
      const sessions = liveSessionsByBuilding(entries, classrooms, now);
      const phase = campusPhase(periods, now);
      liveRef.current = { sessions, phase };
      Object.entries(liveMarkersRef.current).forEach(([id, m]) => m.setCount(sessions[id]?.length || 0));
      setLiveInfo({ sessions, phase });

      const sunNow = applySunRef.current?.();
      // Until the weather service answers, day/night follows the real sun
      if (sunNow && firstTick && !useCampusStore.getState().weatherData) setIsNightMode(!sunNow.up);
      firstTick = false;
    };

    Promise.all([timetableApi.list(), classroomsApi.list()])
      .then(([tt, rooms]) => {
        if (cancelled) return;
        entries = Array.isArray(tt) ? tt : [];
        classrooms = Array.isArray(rooms) ? rooms : [];
        // Room counts per building from the room list (shown instead of the twin's own estimates)
        const counts = {};
        classrooms.forEach((r) => {
          const c = (counts[r.building] ||= { classes: 0, labs: 0, rooms: 0 });
          c.rooms += 1;
          if (r.location_type === 'CLASSROOM') c.classes += 1;
          if (r.location_type === 'LABORATORY') c.labs += 1;
        });
        setRoomCounts(counts);
        setBuildingRooms(classrooms.reduce((m, r) => ({ ...m, [r.building]: [...(m[r.building] || []), r] }), {}));
        if (entries.length) periods = periodsFrom(entries);
        tick();
      })
      .catch(() => { /* no timetable: the clock still runs on DEFAULT_PERIODS */ });

    tick();
    const timer = setInterval(tick, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // ── Student Services: keep the document tokens in step with my requests ───
  const refreshDocTokens = React.useCallback(() => {
    if (user?.role !== 'student') return;
    servicesApi.myRequests()
      .then((list) => docTokenApiRef.current?.sync(list))
      .catch(() => { /* the map simply shows no tokens */ });
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'student') {
      docTokenApiRef.current?.sync([]);
      return undefined;
    }
    refreshDocTokens();
    const timer = setInterval(refreshDocTokens, 20000);
    return () => clearInterval(timer);
  }, [user?.role, refreshDocTokens]);

  // ── Joining Day: follow the new student's next stop ───────────────────────
  useEffect(() => {
    if (user?.role !== 'student') {
      setJoining(null);
      questApiRef.current?.clear();
      return undefined;
    }
    const refresh = () => joiningApi.mine().then((app) => {
      setJoining(app);
      const next = app && app.status !== 'enrolled' ? app.progress.find((p) => !p.done) : null;
      if (next) questApiRef.current?.set(next.place, `🎓 Next: ${next.label}`);
      else questApiRef.current?.clear();
    }).catch(() => { /* no quest shown */ });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [user?.role]);

  // ── Leaving: keep the clearance pins in step with my no-dues clearance ────
  useEffect(() => {
    if (user?.role !== 'student') {
      clearanceApiRef.current?.sync(null);
      return undefined;
    }
    // Once everything is cleared the pins stay for a week, then the map goes quiet
    const refresh = () => leavingApi.mine().then((ex) => {
      const stale = ex?.cleared_at && Date.now() - new Date(`${ex.cleared_at}Z`).getTime() > 7 * 24 * 3600 * 1000;
      clearanceApiRef.current?.sync(stale ? null : ex);
    }).catch(() => { /* no pins shown */ });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [user?.role]);

  const joiningNext = joining && joining.status !== 'enrolled' ? joining.progress.find((p) => !p.done) : null;

  useEffect(() => {
    const req = pendingRouteRef.current;
    if (!req || fromBuilding !== req.from || toBuilding !== req.to) return undefined;
    // The scene may still be building on first load; try until it's ready
    const timer = setInterval(() => {
      if (!sceneRef.current) return;
      clearInterval(timer);
      pendingRouteRef.current = null;
      handleFindRoute();
      useCampusStore.setState({ routeRequest: null });
    }, 300);
    return () => clearInterval(timer);
  }, [fromBuilding, toBuilding, routeNonce]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle Day/Night Toggle ────────────────────────────────────────────────
  useEffect(() => {
    nightRef.current = isNightMode;
    if (!sceneRef.current) return;
    if (isNightMode) {
      sceneRef.current.background = new THREE.Color(0x0a0f1d);
      if (ambientLightRef.current) {
        ambientLightRef.current.color.setHex(0x1a263b);
        ambientLightRef.current.intensity = 0.25;
      }
      if (sunRef.current) {
        sunRef.current.color.setHex(0x446699);
        sunRef.current.intensity = 0.2;
      }
      if (celestialSunRef.current) celestialSunRef.current.visible = false;
      if (celestialMoonRef.current) celestialMoonRef.current.visible = true;
      
      // Street lamps: glowing bulbs + the shared light-pool decal instead of real lights
      streetLightsRef.current.forEach((lightObj) => {
        lightObj.bulbMat.color.setHex(0xffaa55);
      });
      if (glowPoolsRef.current) glowPoolsRef.current.visible = true;

      // Only the most prominent accent lights (widest reach x brightness) become real lights
      const ranked = [...nightLightsRef.current].sort(
        (a, b) => b.onIntensity * b.light.distance - a.onIntensity * a.light.distance
      );
      ranked.forEach((obj, i) => {
        const on = i < NIGHT_LIGHT_BUDGET;
        obj.light.intensity = on ? obj.onIntensity : 0;
        obj.light.visible = on;
      });
    } else {
      sceneRef.current.background = new THREE.Color(0xEDEAE0);
      if (ambientLightRef.current) {
        ambientLightRef.current.color.setHex(0xffffff);
        ambientLightRef.current.intensity = 0.55;
      }
      if (sunRef.current) {
        sunRef.current.color.setHex(0xfff4e0);
        sunRef.current.intensity = 1.05;
      }
      if (celestialSunRef.current) celestialSunRef.current.visible = true;
      if (celestialMoonRef.current) celestialMoonRef.current.visible = false;
      
      streetLightsRef.current.forEach((lightObj) => {
        lightObj.bulbMat.color.setHex(0xffffff);
      });
      if (glowPoolsRef.current) glowPoolsRef.current.visible = false;
      nightLightsRef.current.forEach((obj) => {
        obj.light.intensity = 0;
        obj.light.visible = false;
      });
    }
    // Keep the light where the real sun (or moon) is
    applySunRef.current?.();
  }, [isNightMode]);

  // ── Handle Weather Data Sync ───────────────────────────────────────────────
  useEffect(() => {
    if (weatherData) {
      setIsNightMode(!weatherData.isDay);
    }
  }, [weatherData?.isDay]);

  useEffect(() => {
    if (rainSystemRef.current) {
      rainSystemRef.current.visible = isRaining;
    }
  }, [isRaining]);

  // Fetch weather once on mount
  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // ── Handle Floor Mode Toggle ───────────────────────────────────────────────
  const handleFloorChange = (mode) => {
    setFloorMode(mode);
    floor1Ref.current.forEach((m) => {
      m.material.opacity = mode === '2' ? 0.12 : 1;
      m.castShadow = mode !== '2';
    });
    floor2Ref.current.forEach((m) => {
      m.material.opacity = mode === '1' ? 0.12 : 1;
      m.castShadow = mode !== '1';
    });
  };

  // ── A route asked for elsewhere (Navigation page): fill the panel, then draw it ──
  useEffect(() => {
    if (!routeRequest) return;
    pendingRouteRef.current = routeRequest;
    setRouteMode('walk');
    setFromBuilding(routeRequest.from);
    setToBuilding(routeRequest.to);
    setRouteNonce((n) => n + 1);
  }, [routeRequest]);

  // ── Handle Find Route ──────────────────────────────────────────────────────
  const handleFindRoute = async () => {
    if (fromBuilding === toBuilding) return;
    
    let result;
    try {
      result = await buildingsApi.route(fromBuilding, toBuilding, routeMode);
    } catch (err) {
      setRouteInfo({ error: 'Failed to fetch route from API.' });
      return;
    }

    const scene = sceneRef.current;
    if (!scene) return;

    // Clear previous route
    if (routeLineRef.current) { scene.remove(routeLineRef.current); routeLineRef.current = null; }
    if (routeDotRef.current)  { scene.remove(routeDotRef.current);  routeDotRef.current  = null; }

    // Draw route line
    const pts = result.path_coords.map((coord) => new THREE.Vector3(coord.x, 0.6, coord.z));
    routePtsRef.current = pts;

    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: routeMode === 'drive' ? 0xF59E0B : 0x00E5FF, linewidth: 3 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    routeLineRef.current = line;

    // Draw animated marker dot
    const dotGeo = new THREE.SphereGeometry(1.1, 16, 16);
    const dotMat = new THREE.MeshStandardMaterial({ color: routeMode === 'drive' ? 0xF59E0B : 0x00E5FF, emissive: routeMode === 'drive' ? 0xF59E0B : 0x00E5FF, emissiveIntensity: 0.6 });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(pts[0]);
    scene.add(dot);
    routeDotRef.current = dot;
    routeAnimTRef.current = 0;

    const meters = result.distance.toFixed(0);
    const mins = Math.max(1, Math.round(result.distance / 1.4 / 60));
    setRouteInfo({
      fromName: BUILDINGS.find((b) => b.id === fromBuilding)?.name,
      toName: BUILDINGS.find((b) => b.id === toBuilding)?.name,
      meters,
      mins
    });
  };

  const handleClearRoute = () => {
    const scene = sceneRef.current;
    if (scene) {
      if (routeLineRef.current) { scene.remove(routeLineRef.current); routeLineRef.current = null; }
      if (routeDotRef.current)  { scene.remove(routeDotRef.current);  routeDotRef.current  = null; }
    }
    routePtsRef.current = null;
    setRouteInfo(null);
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#11151b]"
      style={{ height: 'calc(100vh - 120px)', minHeight: 540 }}
    >
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing" />

      {introPlaying && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-end pb-28">
          <p className="font-serif text-2xl font-bold tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-3xl">
            Welcome to MVSR Engineering College
          </p>
          <p className="mt-1 font-mono text-xs tracking-widest text-slate-200 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
            NADERGUL · HYDERABAD
          </p>
          <button
            onClick={skipIntroButton}
            className="pointer-events-auto mt-4 rounded-full border border-white/30 bg-black/50 px-4 py-1.5 font-mono text-xs text-white backdrop-blur transition hover:bg-black/70"
          >
            Skip intro ⏭
          </button>
        </div>
      )}

      {/* ── Top HUD Header ─────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 flex items-start justify-between z-20">
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-wider text-[#f4f2ea]">MVSR ENGINEERING COLLEGE</h1>
          <p className="font-mono text-[9px] sm:text-[10px] tracking-widest text-slate-400">DIGITAL TWIN · ANCHORED TO REAL CAMPUS GPS</p>
          
          {weatherData && (
            <div className="mt-2 pointer-events-auto inline-flex items-center gap-2 rounded-md border border-white/10 bg-[#141a22]/80 px-2 py-1 backdrop-blur-md font-mono text-[10px] text-slate-300">
              <span className="text-white font-bold">{weatherData.temp}°C</span>
              <div className="w-px h-3 bg-white/20" />
              <span>{weatherData.condition}</span>
              <div className="w-px h-3 bg-white/20" />
              <span className="text-[#00E5FF]">HYD (Real-Time)</span>
            </div>
          )}
        </div>

        {/* Legend Panel */}
        <div className="pointer-events-auto hidden flex-col items-end gap-1.5 rounded-xl border border-white/10 bg-[#141a22]/80 p-2.5 backdrop-blur-md sm:flex">
          {[
            { label: 'Academic', color: 'bg-indigo-500' },
            { label: 'Admin / Library', color: 'bg-fuchsia-500' },
            { label: 'Labs / R&D', color: 'bg-teal-500' },
            { label: 'Recreation', color: 'bg-orange-500' },
            { label: 'Boys Hostel', color: 'bg-blue-500' },
            { label: 'Girls Hostel', color: 'bg-pink-500' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 font-mono text-[10px] tracking-wide text-slate-300">
              <span>{item.label}</span>
              <div className={`h-2.5 w-2.5 rounded-full ${item.color} shadow-sm shadow-black/50`} />
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute top-4 right-4 z-20 hidden font-mono text-[10px] tracking-wider text-slate-400 text-right leading-relaxed md:block">
        DRAG TO ORBIT · SCROLL TO ZOOM<br />CLICK A BLOCK FOR DETAILS &amp; GPS
      </div>

      {/* ── Navigation / Routing Panel ──────────────────────────────────────── */}
      <div className="pointer-events-auto absolute top-4 left-4 z-20 w-48 sm:w-56 rounded-xl border border-white/10 bg-[#141a22]/90 p-3.5 backdrop-blur-md">
        <h2 className="mb-2 text-xs font-bold tracking-wider text-slate-200">WALKING ROUTE</h2>
        
        <label className="block font-mono text-[10px] text-slate-400 mb-1">FROM</label>
        <select
          value={fromBuilding}
          onChange={(e) => setFromBuilding(e.target.value)}
          className="mb-2 w-full rounded-md border border-white/15 bg-[#1a2029] px-2.5 py-1 text-xs text-[#e8e6dd] outline-none"
        >
          {BUILDINGS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <label className="block font-mono text-[10px] text-slate-400 mb-1">TO</label>
        <select
          value={toBuilding}
          onChange={(e) => setToBuilding(e.target.value)}
          className="mb-3 w-full rounded-md border border-white/15 bg-[#1a2029] px-2.5 py-1 text-xs text-[#e8e6dd] outline-none"
        >
          {BUILDINGS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>



        <div className="flex gap-2">
          <button
            onClick={handleFindRoute}
            className="flex-1 rounded-md bg-[#F5A623] px-3 py-1.5 font-mono text-xs font-bold text-[#1c1206] transition hover:bg-[#e0951a]"
          >
            Find Route
          </button>
          <button
            onClick={handleClearRoute}
            className="rounded-md border border-white/15 bg-transparent px-3 py-1.5 font-mono text-xs text-slate-300 transition hover:bg-white/10"
          >
            Clear
          </button>
        </div>

        {routeInfo && (
          <div className="mt-3 border-t border-white/10 pt-2 font-mono text-xs text-slate-200">
            {routeInfo.error ? (
              <p className="text-red-400">{routeInfo.error}</p>
            ) : (
              <>
                <p><b className={routeInfo.mode === 'drive' ? "text-[#F59E0B]" : "text-[#00E5FF]"}>{routeInfo.fromName}</b> → <b className={routeInfo.mode === 'drive' ? "text-[#F59E0B]" : "text-[#00E5FF]"}>{routeInfo.toName}</b></p>
                <p className="mt-1 text-[11px] text-slate-400">{routeInfo.meters} m · ~{routeInfo.mins} min {routeInfo.mode}</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Floor & Night Mode Toggle Bar ───────────────────────────────────── */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 rounded-xl border border-white/10 bg-[#141a22]/90 p-1.5 backdrop-blur-md">
        {[
          { key: 'all', label: 'All Floors' },
          { key: '1',   label: 'Ground Floor' },
          { key: '2',   label: 'First Floor' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => handleFloorChange(f.key)}
            className={`rounded-lg px-3 py-1 font-mono text-xs font-medium transition ${
              floorMode === f.key ? 'bg-[#3B6FA0] text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}

        <div className="w-px bg-white/15 my-0.5 mx-1" />

        <button
          onClick={() => setIsNightMode(!isNightMode)}
          className={`rounded-lg px-3 py-1 font-mono text-xs font-semibold transition flex items-center gap-1.5 ${
            isNightMode ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
          }`}
        >
          {isNightMode ? '🌙 Night Mode' : '☀️ Day Mode'}
        </button>

        <button
          onClick={toggleRain}
          className={`rounded-lg px-3 py-1 font-mono text-xs font-semibold transition flex items-center gap-1.5 ${
            isRaining ? 'bg-blue-500 text-white shadow-md' : 'bg-slate-800 text-blue-300 hover:bg-slate-700'
          }`}
        >
          {isRaining ? '🌧️ Raining' : '☁️ Rain Off'}
        </button>

        <div className="w-px bg-white/15 my-0.5 mx-1" />

        <button
          onClick={() => setCameraMode(cameraMode === 'shuttle' ? 'orbit' : 'shuttle')}
          className={`rounded-lg px-3 py-1 font-mono text-xs font-semibold transition flex items-center gap-1.5 ${
            cameraMode === 'shuttle' ? 'bg-[#00E5FF] text-slate-900 shadow-md' : 'bg-slate-800 text-[#00E5FF] hover:bg-slate-700'
          }`}
        >
          {cameraMode === 'shuttle' ? '👀 Orbit View' : '🎥 Ride Shuttle'}
        </button>

        <button
          onClick={() => setCameraMode(cameraMode === 'student' ? 'orbit' : 'student')}
          className={`rounded-lg px-3 py-1 font-mono text-xs font-semibold transition flex items-center gap-1.5 ${
            cameraMode === 'student' ? 'bg-fuchsia-500 text-white shadow-md' : 'bg-slate-800 text-fuchsia-400 hover:bg-slate-700'
          }`}
        >
          {cameraMode === 'student' ? '👀 Orbit View' : '🚶 Student View'}
        </button>

        <button
          onClick={playIntro}
          className="rounded-lg px-3 py-1 font-mono text-xs font-semibold transition flex items-center gap-1.5 bg-slate-800 text-amber-300 hover:bg-slate-700"
        >
          🎬 Fly-in
        </button>
      </div>

      {/* ── Joining Day card: Campus Passport stamps and the next stop ─────── */}
      {joiningNext && (
        <div className="pointer-events-auto absolute bottom-4 left-4 z-20 w-60 rounded-xl border border-amber-300/40 bg-[#141a22]/90 p-3 text-[#e8e6dd] backdrop-blur-md">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-300">Joining Day · Campus Passport</p>
          <div className="mt-2 flex gap-1">
            {joining.progress.map((p, i) => (
              <span key={p.key} title={p.label}
                className={`grid h-7 flex-1 place-items-center rounded-md text-sm ${p.done ? 'bg-emerald-500/25' : p.key === joiningNext.key ? 'animate-pulse bg-amber-400/25' : 'bg-white/5 opacity-50'}`}>
                {['🚪', '📄', '🔍', '🏦', '📜', '🎓'][i]}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-300">Next: <b className="text-white">{joiningNext.label}</b> · {PLACE_NAMES[joiningNext.place] || joiningNext.place}</p>
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => useCampusStore.getState().setAIFlyTarget(joiningNext.place)}
              className="flex-1 rounded-md border border-amber-300/50 py-1 text-xs font-bold text-amber-200 hover:bg-amber-400/15">Go there</button>
            <Link to="/joining" className="flex-1 rounded-md bg-amber-400 py-1 text-center text-xs font-bold text-slate-900 hover:bg-amber-300">Open joining</Link>
          </div>
        </div>
      )}

      {/* ── Info Panel (Selected Building + Real GPS) ───────────────────────── */}
      <div className="pointer-events-auto absolute bottom-4 right-4 z-20 w-56 sm:w-64 rounded-xl border border-white/10 bg-[#141a22]/90 p-3.5 text-[#e8e6dd] backdrop-blur-md">
        {selectedBuilding ? (
          <div className="relative">
            <button
              onClick={() => setSelectedBuilding(null)}
              aria-label="Close building details"
              className="absolute -right-1.5 -top-1.5 rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-sm sm:text-base font-bold text-white mb-0.5 pr-6">{selectedBuilding.name}</h3>
            <p className="font-mono text-[10px] font-bold text-[#7fa8d6] uppercase tracking-wider mb-2">{selectedBuilding.type}</p>
            {COUNTER_NAMES[selectedBuilding.id] && (
              <button
                onClick={() => setCounterOpen(selectedBuilding.id)}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-md border border-amber-300/60 bg-amber-400/15 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-400/25"
              >
                🏛️ {COUNTER_NAMES[selectedBuilding.id]} · open the counter
              </button>
            )}
            {user?.role === 'student' && (selectedBuilding.id === 'frontgate' || selectedBuilding.id === 'Bank & ATM' || selectedBuilding.quest) && (
              <Link to="/joining" className="mb-2 block w-full rounded-md border border-amber-300/60 bg-amber-400/15 py-1.5 text-center text-xs font-bold text-amber-200 transition hover:bg-amber-400/25">
                {selectedBuilding.id === 'Bank & ATM' ? '🏦 Pay college fees' : selectedBuilding.quest ? '🎓 Continue joining' : '🚪 Joining desk · new students'} →
              </Link>
            )}
            {selectedBuilding.clearance && (
              <Link to="/leaving" className="mb-2 block w-full rounded-md border border-amber-300/60 bg-amber-400/15 py-1.5 text-center text-xs font-bold text-amber-200 transition hover:bg-amber-400/25">
                Open my no-dues clearance →
              </Link>
            )}
            {selectedBuilding.requestId && (
              <Link to="/services" className="mb-2 block w-full rounded-md border border-cyan-400/50 bg-cyan-500/10 py-1.5 text-center text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20">
                Track in My Requests →
              </Link>
            )}
            {liveInfo.sessions[selectedBuilding.id]?.length > 0 && (
              <div className="mb-2 rounded-md border border-cyan-400/30 bg-cyan-500/10 p-2">
                <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-bold text-cyan-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  LIVE NOW · {liveInfo.sessions[selectedBuilding.id].length} classes in session
                </p>
                <ul className="space-y-0.5 text-[10px] text-slate-300">
                  {liveInfo.sessions[selectedBuilding.id].slice(0, 4).map((c, i) => (
                    <li key={i} className="truncate">{c.room} · {c.subject} ({c.section})</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedBuilding.depts && selectedBuilding.depts.length > 0 && (
              <ul className="mb-2 pl-4 text-xs text-slate-300 list-disc space-y-0.5">
                {selectedBuilding.depts.map((d) => <li key={d}>{d}</li>)}
              </ul>
            )}
            {roomCounts[selectedBuilding?.id] && (
              <p className="mt-3 border-t border-white/10 pt-2 font-mono text-[10px] text-slate-400">
                FROM THE ROOM LIST: <span className="text-white">{roomCounts[selectedBuilding.id].classes} classrooms · {roomCounts[selectedBuilding.id].labs} labs · {roomCounts[selectedBuilding.id].rooms} rooms in all</span>
              </p>
            )}
            {selectedBuilding?.stats && (selectedBuilding.stats.layoutData
              || (!roomCounts[selectedBuilding?.id] && Object.values(selectedBuilding.stats).some((v) => typeof v === 'number' && v > 0))) && (
              <div className="mt-3 border-t border-white/10 pt-2">
                {/* The twin's own estimates only where the room list has nothing for this building, and never all-zero */}
                {!roomCounts[selectedBuilding?.id] && Object.values(selectedBuilding.stats).some((v) => typeof v === 'number' && v > 0) && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-slate-400">
                  <div className="flex justify-between"><span>FLOORS</span><span className="text-white font-semibold">{selectedBuilding.stats.floors > 1 ? `G + ${selectedBuilding.stats.floors - 1}` : 'G'}</span></div>
                  <div className="flex justify-between"><span>CLASSES</span><span className="text-white font-semibold">{selectedBuilding?.stats?.classes}</span></div>
                  <div className="flex justify-between"><span>LABS</span><span className="text-white font-semibold">{selectedBuilding?.stats?.labs}</span></div>
                  <div className="flex justify-between"><span>CABINS</span><span className="text-white font-semibold">{selectedBuilding?.stats?.staffCabins}</span></div>
                  <div className="flex justify-between col-span-2"><span>WASHROOMS</span><span className="text-white font-semibold">{selectedBuilding?.stats?.washrooms}</span></div>
                </div>
                )}
                {selectedBuilding?.stats?.layoutData && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <button 
                      onClick={() => { setVisualizerFloor(0); setIsVisualizerOpen(true); }}
                      className="w-full rounded-md bg-[#00E5FF]/20 border border-[#00E5FF]/50 py-1.5 text-xs font-bold text-[#00E5FF] transition hover:bg-[#00E5FF]/30 flex items-center justify-center gap-2"
                    >
                      👀 Floor Plan Layout
                    </button>
                    {(() => {
                      // A real classroom of this building (the walkthrough needs a room from the room list)
                      const room = (buildingRooms[selectedBuilding.id] || []).find((r) => r.location_type === 'CLASSROOM')
                        || (buildingRooms[selectedBuilding.id] || [])[0];
                      if (!room) return null;
                      const floorText = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor'][room.floor] || `Floor ${room.floor}`;
                      return (
                    <button 
                      onClick={() => setRoom3DModal({ id: room.id, name: room.name, floor: floorText, location_type: room.location_type })}
                      className="w-full rounded-md bg-gradient-to-r from-cyan-500/30 to-blue-600/30 border border-cyan-400 py-1.5 text-xs font-bold text-white shadow-lg transition hover:from-cyan-500/50 hover:to-blue-600/50 flex items-center justify-center gap-2"
                    >
                      🚀 3D Room Walkthrough
                    </button>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between border-t border-white/10 pt-1 mt-2 font-mono text-xs text-slate-400">
              <span>GPS ANCHOR</span><span className="text-[#00E5FF] font-semibold">{fmtGPS(toGPS(selectedBuilding.x, selectedBuilding.z))}</span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Select any building to see its name, type, departments, and real-world GPS position. Use Walking Route to navigate.
          </p>
        )}
      </div>

      {/* ── Floor Plan Visualizer Modal ─────────────────────────────────────── */}
      {/* Modals are portalled to <body>: inside the page's <main> (z-10) they would sit
          under the fixed app header (z-50) whatever their own z-index, hiding the close button. */}
      {isVisualizerOpen && selectedBuilding && selectedBuilding?.stats?.layoutData && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm pointer-events-auto">
          <div className="w-full max-w-4xl bg-[#141a22] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-[#00E5FF]" />
                  {selectedBuilding.name} - Interior Layout
                </h2>
                <p className="text-sm text-slate-400">{selectedBuilding.type}</p>
              </div>
              <button onClick={() => setIsVisualizerOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Floor Tabs */}
            <div className="flex border-b border-white/10 px-6 pt-4 gap-4 overflow-x-auto">
              {selectedBuilding?.stats?.layoutData.map((floorObj, idx) => (
                <button
                  key={idx}
                  onClick={() => setVisualizerFloor(idx)}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    visualizerFloor === idx 
                      ? 'border-[#00E5FF] text-[#00E5FF]' 
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  {floorObj.floor}
                </button>
              ))}
            </div>

            {/* Grid Layout Area */}
            <div className="flex-1 overflow-auto p-6 bg-[#0f141a]">
              {(() => {
                const floorData = selectedBuilding?.stats?.layoutData[visualizerFloor];
                if (!floorData || !floorData.rooms) return <div className="text-slate-400 text-center py-10">No layout data available for this floor.</div>;
                
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-5xl mx-auto">
                    {floorData.rooms.map((room, idx) => {
                      let bgColor = 'bg-slate-800';
                      let borderColor = 'border-slate-700';
                      let textColor = 'text-slate-300';
                      let icon = '🚪';
                      let colSpan = 'col-span-1';
                      
                      if (room.type === 'class') {
                        bgColor = 'bg-blue-900/30'; borderColor = 'border-blue-500/50'; textColor = 'text-blue-300'; icon = '📚';
                      } else if (room.type === 'lab') {
                        bgColor = 'bg-emerald-900/30'; borderColor = 'border-emerald-500/50'; textColor = 'text-emerald-300'; icon = '🔬';
                      } else if (room.type === 'washroom') {
                        bgColor = 'bg-cyan-900/30'; borderColor = 'border-cyan-500/50'; textColor = 'text-cyan-300'; icon = '🚻';
                      } else if (room.type === 'cabin' || room.type === 'hod') {
                        bgColor = 'bg-amber-900/30'; borderColor = 'border-amber-500/50'; textColor = 'text-amber-300'; icon = '💼';
                        if (room.type === 'hod') colSpan = 'col-span-1 md:col-span-2';
                      } else if (room.type === 'seminar') {
                        bgColor = 'bg-purple-900/30'; borderColor = 'border-purple-500/50'; textColor = 'text-purple-300'; icon = '🎤';
                        colSpan = 'col-span-2 md:col-span-4';
                      } else if (room.type === 'food') {
                        bgColor = 'bg-orange-900/30'; borderColor = 'border-orange-500/50'; textColor = 'text-orange-300'; icon = '🍔';
                      } else if (room.type === 'sports') {
                        bgColor = 'bg-yellow-900/30'; borderColor = 'border-yellow-500/50'; textColor = 'text-yellow-300'; icon = '🏓';
                      } else if (room.type === 'gym') {
                        bgColor = 'bg-red-900/30'; borderColor = 'border-red-500/50'; textColor = 'text-red-300'; icon = '🏋️';
                      }

                      const isNonTimetableCard = room.type === 'admin' || room.location_type === 'ADMINISTRATION' || room.id === 'ADMINISTRATION' || 
                                                room.type === 'iqac' || room.id?.toUpperCase().includes('IQAC') || room.label?.toUpperCase().includes('IQAC') || 
                                                room.type === 'principal' || room.id?.toUpperCase().includes('PRINCIPAL') || room.label?.toUpperCase().includes('PRINCIPAL') ||
                                                room.type === 'office' || room.type === 'staff' || room.location_type === 'STAFF_ROOM' || room.location_type === 'OFFICE' ||
                                                room.id?.toUpperCase().includes('STAFF') || room.label?.toUpperCase().includes('STAFF') ||
                                                room.id?.toUpperCase().includes('DEPT') || room.label?.toUpperCase().includes('DEPT') ||
                                                room.id?.toUpperCase().includes('OFFICE') || room.label?.toUpperCase().includes('OFFICE') ||
                                                room.type === 'washroom' || room.type === 'restroom' || room.id?.toUpperCase().includes('WASHROOM') || room.label?.toUpperCase().includes('WASHROOM') ||
                                                room.type === 'seminar' || room.location_type === 'CONFERENCE_HALL' || room.id?.toUpperCase().includes('KVR');

                      return (
                        <div 
                          key={idx} 
                          className={`${colSpan} flex flex-col justify-between p-3.5 rounded-xl border ${bgColor} ${borderColor} shadow-inner min-h-[110px] transition-all hover:border-cyan-400 group relative`}
                        >
                          <div 
                            onClick={() => setSelectedRoom({ ...room, floor: floorData.floor })}
                            className="cursor-pointer flex flex-col items-center flex-1"
                          >
                            <span className="text-2xl mb-1.5">{icon}</span>
                            <span className={`font-mono text-xs font-bold text-center ${textColor}`}>{room.label}</span>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-white/10 flex gap-1.5">
                            {!isNonTimetableCard && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRoom({ ...room, floor: floorData.floor });
                                }}
                                className="flex-1 rounded bg-slate-700/60 hover:bg-slate-600 text-[10px] font-mono font-semibold text-slate-200 py-1 transition text-center"
                              >
                                📅 Timetable
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRoom3DModal({ ...room, floor: floorData.floor, id: room.id || room.label });
                              }}
                              className="flex-1 rounded bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-400 text-[10px] font-mono font-bold text-cyan-200 py-1 transition text-center shadow-sm"
                            >
                              🚀 3D View
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            
            {/* Legend footer */}
            <div className="bg-[#141a22] border-t border-white/10 px-6 py-3 flex gap-4 text-xs font-mono text-slate-400 justify-center flex-wrap">
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-900/30 border border-blue-500/50"></div> Classroom</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-900/30 border border-emerald-500/50"></div> Laboratory</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-900/30 border border-amber-500/50"></div> Cabin</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-cyan-900/30 border border-cyan-500/50"></div> Washroom</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-900/30 border border-purple-500/50"></div> Hall/Area</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-900/30 border border-orange-500/50"></div> Food</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-900/30 border border-yellow-500/50"></div> Sports</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Student Services counter (portals itself to <body>) ─────────────── */}
      {counterOpen && (
        <ServiceCounter counterId={counterOpen} onClose={() => setCounterOpen(null)} onCreated={refreshDocTokens} />
      )}

      {/* ── Live Timetable & Classroom Info Panel Modal ─────────────────────────────────── */}
      {selectedRoom && createPortal(
        <ClassroomInfoPanel
          classroomId={selectedRoom.id || (selectedRoom.label?.includes('(') ? selectedRoom.label.split('(')[1]?.replace(')', '') : selectedRoom.label)}
          simulatedDateTime={simulatedDateTime}
          onClose={() => setSelectedRoom(null)}
          onOpen3DView={(r, slot) => {
            setSelectedRoom(null);
            setRoom3DModal(r);
            setRoom3DModalTime(slot);
          }}
        />,
        document.body
      )}

      {/* ── Interactive 3D Room Interior Walkthrough Modal ──────────────────────────────── */}
      {room3DModal && createPortal(
        <Suspense fallback={null}>
        <RoomInterior3DModal
          room={room3DModal}
          classroomId={room3DModal.id || (room3DModal.label?.includes('(') ? room3DModal.label.split('(')[1]?.replace(')', '') : room3DModal.label)}
          simulatedDateTime={room3DModalTime}
          onClose={() => {
            setRoom3DModal(null);
            setRoom3DModalTime(null);
          }}
          onOpenTimetable={() => {
            setSelectedRoom(room3DModal);
            setRoom3DModal(null);
          }}
        />
        </Suspense>,
        document.body
      )}
    </div>
  );
}

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { X, Eye, Video, Users, Calendar, GraduationCap, BookOpen, Clock, ChevronDown } from 'lucide-react';
import { classroomsApi } from '../../utils/api';

const TIME_SLOTS = [
  { label: 'Monday P1 (09:30 - 10:30)', value: '2026-08-10T09:30' },
  { label: 'Monday P2 (10:30 - 11:30)', value: '2026-08-10T10:30' },
  { label: 'Monday P3 (11:40 - 12:40)', value: '2026-08-10T11:40' },
  { label: 'Tuesday P1 (09:30 - 10:30)', value: '2026-08-11T09:30' },
  { label: 'Tuesday P2 (10:30 - 11:30)', value: '2026-08-11T10:30' },
  { label: 'Wednesday P1 (09:30 - 10:30)', value: '2026-08-12T09:30' },
  { label: 'Thursday P1 (09:30 - 10:30)', value: '2026-08-13T09:30' },
  { label: 'Thursday P3 (11:40 - 12:40)', value: '2026-08-13T11:40' },
  { label: 'Friday P1 (09:30 - 10:30)', value: '2026-08-14T09:30' },
  { label: 'Saturday P1 (09:30 - 10:30)', value: '2026-08-15T09:30' },
];

function getCleanRoomId(rawId) {
  if (!rawId) return 'CE-IT-101';
  let str = String(rawId).trim();
  if (str.includes('(') && str.includes(')')) {
    const match = str.match(/\(([^)]+)\)/);
    if (match && match[1]) str = match[1];
  }
  str = str.replace(/^(Classroom|Lab|Class)\s+/i, '').trim();
  return str || 'CE-IT-101';
}

export default function RoomInterior3DModal({ room, classroomId, onClose, onOpenTimetable }) {
  const mountRef = useRef(null);
  const [activeCamView, setActiveCamView] = useState('orbit'); // 'orbit', 'teacher', 'student', 'cctv'
  const [showCCTVOverlay, setShowCCTVOverlay] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('2026-08-10T09:30'); // Default to Monday P1 (College active hours)
  const [scheduleData, setScheduleData] = useState(null);
  const [weekData, setWeekData] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const fansRef = useRef([]);

  const cleanId = getCleanRoomId(classroomId || room?.id || room?.label);

  const isBoardRoom = ['PRINCIPAL-OFFICE', 'IQAC-ROOM', 'CIVIL-DEPT-OFFICE', 'IT-STAFF-ROOM'].includes(cleanId) || 
                      room?.type === 'office' || room?.location_type === 'OFFICE' || room?.location_type === 'STAFF_ROOM';
  const isLab = room?.type === 'lab' || room?.location_type === 'LABORATORY' || cleanId.includes('LAB');

  // Fetch Live Academic & Faculty Data from Backend SQL Database
  const loadSchedule = useCallback(async () => {
    if (!cleanId) return;
    setLoadingSchedule(true);
    try {
      const [cur, wk] = await Promise.all([
        classroomsApi.getCurrent(cleanId, selectedSlot),
        classroomsApi.getWeek(cleanId).catch(() => null)
      ]);
      setScheduleData(cur);
      setWeekData(wk);
    } catch (e) {
      console.warn("Could not load current classroom schedule", e);
    } finally {
      setLoadingSchedule(false);
    }
  }, [cleanId, selectedSlot]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Robust Faculty & Subject Resolution
  const activeEntry = scheduleData?.current_entry || 
                      scheduleData?.next_entry || 
                      (weekData?.entries && weekData.entries[0]) || 
                      (weekData?.schedule && Object.values(weekData.schedule).flat()[0]) || 
                      null;

  const teacherName = activeEntry?.faculty_name || (isBoardRoom ? 'Dr. M. Kameswara Rao (Principal)' : cleanId.startsWith('CE-2') ? 'Dr. G. Narendra Goud' : 'Dr. B. Vasavi');
  const subjectName = activeEntry?.subject_name || (isBoardRoom ? 'Academic Council & Executive Review' : cleanId.startsWith('CE-2') ? 'Transportation Engineering' : 'Data Structures using C');
  const sectionName = activeEntry?.section || (cleanId.startsWith('CE-2') ? 'Civil Sem-V' : 'IT-2A');
  const timeSlot = activeEntry ? `${activeEntry.start_time} - ${activeEntry.end_time}` : '09:30 - 10:30 (P1)';
  const dayName = scheduleData?.day_name || 'Monday';

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // ── Scene, Camera & Renderer ─────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isBoardRoom ? 0x181e26 : 0x0f172a);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 4.5, 9.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 20;
    controls.target.set(0, 1.4, 0);
    controlsRef.current = controls;

    // ── Lighting Setup ───────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, isBoardRoom ? 0.75 : 0.9);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff8ee, 1.3);
    sunLight.position.set(8, 7.5, 5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 25;
    sunLight.shadow.bias = -0.001;
    scene.add(sunLight);

    const spot1 = new THREE.PointLight(isBoardRoom ? 0xffd8a8 : 0xdbeafe, 1.2, 12);
    spot1.position.set(-2.5, 3.8, 0);
    scene.add(spot1);

    const spot2 = new THREE.PointLight(isBoardRoom ? 0xffd8a8 : 0xdbeafe, 1.2, 12);
    spot2.position.set(2.5, 3.8, 0);
    scene.add(spot2);

    // ── Room Shell Dimensions ────────────────────────────────────────────────
    const roomW = 12;
    const roomD = 14;
    const roomH = 4.2;

    // 1. Polished Floor
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fctx = floorCanvas.getContext('2d');
    fctx.fillStyle = isBoardRoom ? '#E8E1D5' : '#F8FAFC';
    fctx.fillRect(0, 0, 512, 512);
    fctx.strokeStyle = '#CBD5E1';
    fctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) {
      fctx.moveTo(i, 0); fctx.lineTo(i, 512);
      fctx.moveTo(0, i); fctx.lineTo(512, i);
    }
    fctx.stroke();
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 7);

    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.18, metalness: 0.08 });
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // 2. Ceiling with LED Panels
    const ceilMat = new THREE.MeshStandardMaterial({ color: isBoardRoom ? 0x2C221E : 0xF1F5F9, roughness: 0.8 });
    const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilMat);
    ceilMesh.position.y = roomH;
    ceilMesh.rotation.x = Math.PI / 2;
    scene.add(ceilMesh);

    const ledMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const ledPositions = [[-2.5, -3], [2.5, -3], [-2.5, 0], [2.5, 0], [-2.5, 3], [2.5, 3]];
    ledPositions.forEach(([lx, lz]) => {
      const led = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), ledMat);
      led.position.set(lx, roomH - 0.02, lz);
      led.rotation.x = Math.PI / 2;
      scene.add(led);
    });

    // 3. Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xFDFBF7, roughness: 0.9 });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMat);
    backWall.position.set(0, roomH / 2, -roomD / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
    leftWall.position.set(-roomW / 2, roomH / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
    rightWall.position.set(roomW / 2, roomH / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);

    // Window Glass Panes on Right Wall
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x93C5FD, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.1, transmission: 0.9 });
    for (let wz = -4; wz <= 4; wz += 4) {
      const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 2.6), new THREE.MeshStandardMaterial({ color: 0x374151 }));
      winFrame.position.set(roomW / 2 - 0.05, 2.2, wz);
      scene.add(winFrame);

      const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.0), glassMat);
      glass.position.set(roomW / 2 - 0.06, 2.2, wz);
      glass.rotation.y = -Math.PI / 2;
      scene.add(glass);
    }

    // ── Ceiling Fans ─────────────────────────────────────────────────────────
    const fans = [];
    const fanPositions = [[0, -3], [0, 1.5], [-3, 0], [3, 0]];
    fanPositions.forEach(([fx, fz]) => {
      const fanGrp = new THREE.Group();
      fanGrp.position.set(fx, roomH - 0.5, fz);

      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6), new THREE.MeshStandardMaterial({ color: 0x1E293B }));
      fanGrp.add(rod);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12), new THREE.MeshStandardMaterial({ color: 0x1E293B }));
      hub.position.y = -0.3;
      fanGrp.add(hub);

      const bladesGrp = new THREE.Group();
      bladesGrp.position.y = -0.3;
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 1.1), new THREE.MeshStandardMaterial({ color: 0x334155 }));
        blade.position.z = 0.55;
        const bladePivot = new THREE.Group();
        bladePivot.rotation.y = (i * Math.PI * 2) / 3;
        bladePivot.add(blade);
        bladesGrp.add(bladePivot);
      }
      fanGrp.add(bladesGrp);
      scene.add(fanGrp);
      fans.push(bladesGrp);
    });
    fansRef.current = fans;

    // ══════════════════════════════════════════════════════════════════════════
    // DYNAMIC WHITEBOARD WITH REAL PROFESSOR & COURSE LECTURE CONTENT
    // ══════════════════════════════════════════════════════════════════════════
    const wbCanvas = document.createElement('canvas');
    wbCanvas.width = 1024;
    wbCanvas.height = 512;
    const wbCtx = wbCanvas.getContext('2d');
    wbCtx.fillStyle = '#FFFFFF';
    wbCtx.fillRect(0, 0, 1024, 512);

    // Board Header Banner
    wbCtx.fillStyle = '#0F172A';
    wbCtx.fillRect(20, 20, 984, 70);
    wbCtx.fillStyle = '#38BDF8';
    wbCtx.font = 'bold 28px sans-serif';
    wbCtx.fillText(`DEPARTMENT OF IT & CIVIL · ${sectionName}`, 40, 65);

    // Board Content Details
    wbCtx.fillStyle = '#1E293B';
    wbCtx.font = 'bold 36px sans-serif';
    wbCtx.fillText(`📚 ${subjectName}`, 50, 150);

    wbCtx.fillStyle = '#047857';
    wbCtx.font = 'bold 32px sans-serif';
    wbCtx.fillText(`👩‍🏫 Faculty: ${teacherName}`, 50, 210);

    wbCtx.fillStyle = '#475569';
    wbCtx.font = '24px sans-serif';
    wbCtx.fillText(`⏱ ${dayName} Schedule: ${timeSlot} | Classroom: ${cleanId}`, 50, 265);

    // Simulated Lecture Notes
    wbCtx.strokeStyle = '#0284C7';
    wbCtx.lineWidth = 3;
    wbCtx.beginPath();
    wbCtx.moveTo(50, 305);
    wbCtx.lineTo(950, 305);
    wbCtx.stroke();

    wbCtx.fillStyle = '#334155';
    wbCtx.font = '26px sans-serif';
    wbCtx.fillText(`• Core Concept: Algorithmic Complexity & Architecture`, 50, 355);
    wbCtx.fillText(`• Live Demonstration & Practical Exercise in Session`, 50, 405);
    wbCtx.fillText(`• Classroom Attendance & Timetable: 100% Synchronized`, 50, 455);

    const wbTexture = new THREE.CanvasTexture(wbCanvas);
    const wbMat = new THREE.MeshStandardMaterial({ map: wbTexture, roughness: 0.25 });

    const wbFrame = new THREE.Mesh(new THREE.BoxGeometry(6.6, 2.4, 0.08), new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.6 }));
    wbFrame.position.set(0, 2.2, -roomD / 2 + 0.05);
    scene.add(wbFrame);

    const wbSurface = new THREE.Mesh(new THREE.PlaneGeometry(6.3, 2.1), wbMat);
    wbSurface.position.set(0, 2.2, -roomD / 2 + 0.1);
    scene.add(wbSurface);

    // ══════════════════════════════════════════════════════════════════════════
    // 3D TEACHER / PROFESSOR AVATAR & FLOATING NAMEPLATE
    // ══════════════════════════════════════════════════════════════════════════
    const teacherGrp = new THREE.Group();
    teacherGrp.position.set(-1.2, 0, -4.6);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xE0AC69, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.8 });
    const tShirtMat = new THREE.MeshStandardMaterial({ color: isBoardRoom ? 0x1E3A8A : 0x0F766E, roughness: 0.5 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.6 });

    const tHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), skinMat);
    tHead.position.y = 1.72;
    teacherGrp.add(tHead);

    const tHair = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
    tHair.position.y = 1.74;
    teacherGrp.add(tHair);

    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.8 }));
    glasses.position.set(0, 1.72, 0.14);
    teacherGrp.add(glasses);

    const tTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.68, 12), tShirtMat);
    tTorso.position.y = 1.25;
    tTorso.castShadow = true;
    teacherGrp.add(tTorso);

    const tLeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 10), pantsMat);
    tLeg1.position.set(-0.1, 0.45, 0);
    teacherGrp.add(tLeg1);

    const tLeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 10), pantsMat);
    tLeg2.position.set(0.1, 0.45, 0);
    teacherGrp.add(tLeg2);

    const tArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.6), tShirtMat);
    tArmR.position.set(0.32, 1.35, 0.15);
    tArmR.rotation.z = -Math.PI / 4;
    tArmR.rotation.x = -Math.PI / 6;
    teacherGrp.add(tArmR);

    const stylus = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25), new THREE.MeshStandardMaterial({ color: 0xEF4444 }));
    stylus.position.set(0.55, 1.55, 0.3);
    stylus.rotation.z = -Math.PI / 4;
    teacherGrp.add(stylus);

    // Floating 3D Teacher Name Banner
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 512;
    bannerCanvas.height = 160;
    const bctx = bannerCanvas.getContext('2d');
    bctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    bctx.roundRect(10, 10, 492, 140, 18);
    bctx.fill();
    bctx.strokeStyle = '#00E5FF';
    bctx.lineWidth = 4;
    bctx.stroke();

    bctx.fillStyle = '#F59E0B';
    bctx.font = 'bold 24px sans-serif';
    bctx.fillText('👩‍🏫 ACTIVE FACULTY', 30, 45);

    bctx.fillStyle = '#FFFFFF';
    bctx.font = 'bold 30px sans-serif';
    bctx.fillText(teacherName, 30, 85);

    bctx.fillStyle = '#38BDF8';
    bctx.font = '22px sans-serif';
    bctx.fillText(subjectName.slice(0, 32), 30, 125);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const bannerMat = new THREE.SpriteMaterial({ map: bannerTex, depthTest: false, transparent: true });
    const teacherSprite = new THREE.Sprite(bannerMat);
    teacherSprite.position.set(0, 2.4, 0);
    teacherSprite.scale.set(2.4, 0.75, 1);
    teacherGrp.add(teacherSprite);

    scene.add(teacherGrp);

    // ══════════════════════════════════════════════════════════════════════════
    // FURNITURE & SEATED STUDENTS IN ROWS (MATCHED TO PHOTOS 3 & 4)
    // ══════════════════════════════════════════════════════════════════════════
    if (isBoardRoom) {
      const tableMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.3, metalness: 0.1 });
      const confTable = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 7.2), tableMat);
      confTable.position.set(0, 0.85, 0.5);
      confTable.castShadow = true;
      confTable.receiveShadow = true;
      scene.add(confTable);

      for (let lz of [-2.5, 0, 2.5]) {
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.25), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        base.position.set(0, 0.4, 0.5 + lz);
        scene.add(base);
      }

      const chairMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.6 });
      const dirChairMat = new THREE.MeshStandardMaterial({ color: 0xB8860B, roughness: 0.5 });

      const dirChair = createExecutiveChair(dirChairMat);
      dirChair.position.set(0, 0, -3.8);
      scene.add(dirChair);

      for (let z = -2.2; z <= 3.2; z += 1.3) {
        const cLeft = createExecutiveChair(chairMat);
        cLeft.position.set(-2.2, 0, 0.5 + z);
        cLeft.rotation.y = Math.PI / 2;
        scene.add(cLeft);

        const cRight = createExecutiveChair(chairMat);
        cRight.position.set(2.2, 0, 0.5 + z);
        cRight.rotation.y = -Math.PI / 2;
        scene.add(cRight);
      }

      const easel = createStandingWhiteboard();
      easel.position.set(3.5, 0, -4.5);
      easel.rotation.y = -Math.PI / 6;
      scene.add(easel);

      const ac = createACUnit();
      ac.position.set(-4.5, 3.2, -6.8);
      scene.add(ac);

    } else {
      // ── CLASSROOM INTERIOR WITH SEATED STUDENTS ────────────────────────────
      const podium = createTeacherPodium();
      podium.position.set(-2.6, 0, -4.5);
      scene.add(podium);

      const tTable = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.85, 0.8), new THREE.MeshStandardMaterial({ color: 0x94A3B8 }));
      tTable.position.set(2.2, 0.42, -4.8);
      scene.add(tTable);

      const studentShirtColors = [
        0x2563EB, // Royal Blue
        0xDC2626, // Crimson Red
        0x16A34A, // Emerald Green
        0xF59E0B, // Bright Yellow
        0x9333EA, // Purple
        0x0D9488, // Teal
        0xBE185D, // Pink
        0x475569, // Charcoal
        0xEA580C, // Orange
        0x0284C7, // Sky Blue
      ];

      const deskRows = 5;
      const rowSpacing = 1.65;
      const startZ = -2.8;

      let studentCount = 0;

      for (let r = 0; r < deskRows; r++) {
        const currentZ = startZ + r * rowSpacing;

        // Left Desk Bench
        const leftDesk = createRedTopDesk();
        leftDesk.position.set(-2.6, 0, currentZ);
        scene.add(leftDesk);

        const leftChair1 = createStudentChair();
        leftChair1.position.set(-3.2, 0, currentZ + 0.45);
        scene.add(leftChair1);

        const leftChair2 = createStudentChair();
        leftChair2.position.set(-2.0, 0, currentZ + 0.45);
        scene.add(leftChair2);

        const student1 = createSeatedStudent(studentShirtColors[studentCount % studentShirtColors.length]);
        student1.position.set(-3.2, 0, currentZ + 0.45);
        scene.add(student1);
        studentCount++;

        const student2 = createSeatedStudent(studentShirtColors[studentCount % studentShirtColors.length]);
        student2.position.set(-2.0, 0, currentZ + 0.45);
        scene.add(student2);
        studentCount++;

        addDeskSupplies(-3.2, currentZ);
        addDeskSupplies(-2.0, currentZ);

        // Right Desk Bench
        const rightDesk = createRedTopDesk();
        rightDesk.position.set(2.6, 0, currentZ);
        scene.add(rightDesk);

        const rightChair1 = createStudentChair();
        rightChair1.position.set(2.0, 0, currentZ + 0.45);
        scene.add(rightChair1);

        const rightChair2 = createStudentChair();
        rightChair2.position.set(3.2, 0, currentZ + 0.45);
        scene.add(rightChair2);

        const student3 = createSeatedStudent(studentShirtColors[studentCount % studentShirtColors.length]);
        student3.position.set(2.0, 0, currentZ + 0.45);
        scene.add(student3);
        studentCount++;

        const student4 = createSeatedStudent(studentShirtColors[studentCount % studentShirtColors.length]);
        student4.position.set(3.2, 0, currentZ + 0.45);
        scene.add(student4);
        studentCount++;

        addDeskSupplies(2.0, currentZ);
        addDeskSupplies(3.2, currentZ);
      }

      const cctv = createCCTVCamera();
      cctv.position.set(roomW / 2 - 0.4, roomH - 0.4, -roomD / 2 + 0.4);
      cctv.rotation.y = -Math.PI / 4;
      scene.add(cctv);
    }

    // ── Helper Models ────────────────────────────────────────────────────────
    function createSeatedStudent(shirtHex) {
      const grp = new THREE.Group();
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xD8A064, roughness: 0.75 });
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtHex, roughness: 0.6 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.8 });

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), skinMat);
      head.position.y = 1.08;
      grp.add(head);

      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 14, 0, Math.PI * 2, 0, Math.PI / 1.8), hairMat);
      hair.position.y = 1.1;
      grp.add(hair);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.17, 0.45, 10), shirtMat);
      torso.position.set(0, 0.72, -0.05);
      torso.rotation.x = Math.PI / 18;
      torso.castShadow = true;
      grp.add(torso);

      const thighs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.45), pantsMat);
      thighs.position.set(0, 0.48, -0.22);
      grp.add(thighs);

      const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.35), shirtMat);
      armL.position.set(-0.16, 0.7, -0.25);
      armL.rotation.x = Math.PI / 3;
      grp.add(armL);

      const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.35), shirtMat);
      armR.position.set(0.16, 0.7, -0.25);
      armR.rotation.x = Math.PI / 3;
      grp.add(armR);

      return grp;
    }

    function addDeskSupplies(deskX, deskZ) {
      const nbMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.9 });
      const nb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.015, 0.22), nbMat);
      nb.position.set(deskX, 0.8, deskZ);
      scene.add(nb);

      const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16), new THREE.MeshStandardMaterial({ color: 0x2563EB }));
      pen.rotation.z = Math.PI / 2;
      pen.rotation.y = Math.PI / 6;
      pen.position.set(deskX + 0.18, 0.81, deskZ);
      scene.add(pen);
    }

    function createRedTopDesk() {
      const grp = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.65), new THREE.MeshStandardMaterial({ color: 0xDC2626, roughness: 0.4 }));
      top.position.set(0, 0.78, 0);
      top.castShadow = true;
      grp.add(top);

      const front = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.72, 0.03), new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.7 }));
      front.position.set(0, 0.38, -0.28);
      grp.add(front);

      const legMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.6, metalness: 0.7 });
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.76, 0.6), legMat);
      leg1.position.set(-1.15, 0.38, 0);
      grp.add(leg1);
      const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.76, 0.6), legMat);
      leg2.position.set(1.15, 0.38, 0);
      grp.add(leg2);
      return grp;
    }

    function createStudentChair() {
      const grp = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.05, 0.45), new THREE.MeshStandardMaterial({ color: 0x1E293B }));
      seat.position.set(0, 0.45, 0);
      grp.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.04), new THREE.MeshStandardMaterial({ color: 0x0F172A }));
      back.position.set(0, 0.72, 0.2);
      grp.add(back);
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 }));
      legs.position.set(0, 0.225, 0);
      grp.add(legs);
      return grp;
    }

    function createTeacherPodium() {
      const grp = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.6), new THREE.MeshStandardMaterial({ color: 0x334155 }));
      base.position.set(0, 0.55, 0);
      grp.add(base);
      const slantedTop = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.65), new THREE.MeshStandardMaterial({ color: 0x64748B }));
      slantedTop.position.set(0, 1.12, 0);
      slantedTop.rotation.x = Math.PI / 12;
      grp.add(slantedTop);
      return grp;
    }

    function createExecutiveChair(material) {
      const grp = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.65), material);
      seat.position.set(0, 0.5, 0);
      grp.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.1), material);
      back.position.set(0, 0.95, -0.28);
      grp.add(back);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 }));
      stand.position.set(0, 0.25, 0);
      grp.add(stand);
      return grp;
    }

    function createStandingWhiteboard() {
      const grp = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.05), new THREE.MeshStandardMaterial({ color: 0x475569 }));
      frame.position.set(0, 1.35, 0);
      grp.add(frame);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
      board.position.set(0, 1.35, 0.03);
      grp.add(board);
      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6), new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.7 }));
      leg1.position.set(-0.7, 0.8, 0);
      grp.add(leg1);
      const leg2 = leg1.clone();
      leg2.position.set(0.7, 0.8, 0);
      grp.add(leg2);
      return grp;
    }

    function createACUnit() {
      return new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.3), new THREE.MeshStandardMaterial({ color: 0xF8FAFC }));
    }

    function createCCTVCamera() {
      const grp = new THREE.Group();
      const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.15), new THREE.MeshStandardMaterial({ color: 0x1E293B }));
      grp.add(mount);
      const cam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.35), new THREE.MeshStandardMaterial({ color: 0xF1F5F9 }));
      cam.position.set(0, -0.12, 0.1);
      cam.rotation.x = Math.PI / 6;
      grp.add(cam);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0x00E5FF }));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, -0.16, 0.28);
      grp.add(lens);
      return grp;
    }

    // ── Animation Loop ───────────────────────────────────────────────────────
    let reqId;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      controls.update();

      fans.forEach((f) => {
        f.rotation.y += 0.06;
      });

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [cleanId, isBoardRoom, teacherName, subjectName, sectionName, timeSlot, dayName]);

  // Handle Preset Camera Views
  const setCameraView = (view) => {
    setActiveCamView(view);
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (view === 'teacher') {
      cam.position.set(-1.2, 1.8, -4.8);
      ctrl.target.set(0, 1.2, 1.5);
    } else if (view === 'student') {
      cam.position.set(0, 1.4, 4.2);
      ctrl.target.set(0, 1.8, -6.5);
    } else if (view === 'cctv') {
      cam.position.set(5.2, 3.8, -5.8);
      ctrl.target.set(0, 1.0, 0);
    } else {
      cam.position.set(0, 4.5, 9.5);
      ctrl.target.set(0, 1.4, 0);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-2 sm:p-5 backdrop-blur-lg pointer-events-auto animate-fadeIn" style={{ zIndex: 99999 }}>
      <div className="relative w-full max-w-6xl h-[92vh] bg-[#0f172a] rounded-2xl border border-cyan-500/30 shadow-[0_0_50px_rgba(0,229,255,0.2)] overflow-hidden flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-3 bg-[#141e33] flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00E5FF]/20 border border-[#00E5FF]/40 text-[#00E5FF]">
              {isBoardRoom ? <Users className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {room?.name || room?.label || cleanId}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30 font-mono">
                  {isBoardRoom ? '🏛️ Executive / Board Room' : isLab ? '🔬 Laboratory' : '📚 Active Classroom'}
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-mono flex items-center gap-2">
                <span>Civil & IT Block · {room?.floor || 'Floor Level'}</span>
                <span>·</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5" /> Faculty: {teacherName}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period / Schedule Selector */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-white/15 px-2.5 py-1 rounded-lg">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                className="bg-transparent text-xs text-slate-200 font-mono font-semibold outline-none cursor-pointer"
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value} className="bg-slate-900 text-white">
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onOpenTimetable}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 px-3.5 py-1.5 text-xs font-semibold text-indigo-300 transition"
            >
              <Calendar className="h-4 w-4" /> Full Timetable
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 3D Canvas Viewport */}
        <div className="relative flex-1 bg-gradient-to-b from-[#0f172a] to-[#020617] overflow-hidden" ref={mountRef}>
          
          {/* Top Camera Controls Overlay */}
          <div className="absolute top-4 left-4 z-10 flex gap-2 rounded-xl border border-white/10 bg-[#0f172a]/90 p-1.5 backdrop-blur-md">
            {[
              { id: 'orbit', label: '👀 3D Orbit' },
              { id: 'teacher', label: '👨‍🏫 Teacher POV' },
              { id: 'student', label: '🎒 Student POV' },
              { id: 'cctv', label: '📹 CCTV Cam' },
            ].map((cam) => (
              <button
                key={cam.id}
                onClick={() => setCameraView(cam.id)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  activeCamView === cam.id
                    ? 'bg-[#00E5FF] text-slate-950 shadow-md font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {cam.label}
              </button>
            ))}

            <div className="w-px bg-white/15 my-0.5 mx-1" />

            <button
              onClick={() => setShowCCTVOverlay(!showCCTVOverlay)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition flex items-center gap-1.5 ${
                showCCTVOverlay ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
              }`}
            >
              <Video className="h-3.5 w-3.5" /> {showCCTVOverlay ? 'Hide CCTV Matrix' : 'Live CCTV Matrix'}
            </button>
          </div>

          {/* Teacher & Active Course Banner (Top Right in 3D) */}
          <div className="absolute top-4 right-4 z-10 hidden sm:flex flex-col gap-1.5 rounded-xl border border-white/15 bg-slate-900/90 p-3 shadow-xl backdrop-blur-md max-w-sm font-mono">
            <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold">
              <span>● LIVE ACADEMIC SESSION</span>
              <span>{timeSlot}</span>
            </div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan-400" />
              <span className="truncate">{subjectName}</span>
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-2">
              <GraduationCap className="h-3.5 w-3.5 text-emerald-400" />
              <span>Prof: <b className="text-emerald-300">{teacherName}</b></span>
            </div>
          </div>

          {/* CCTV Multi-Screen Video Wall Overlay (Matched to Photo 1) */}
          {showCCTVOverlay && (
            <div className="absolute bottom-4 right-4 z-20 w-80 sm:w-96 rounded-xl border border-white/20 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl animate-fadeIn">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                <span className="text-[11px] font-mono font-bold text-amber-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  SECURITY CCTV FEEDS · CIVIL & IT BLOCK
                </span>
                <span className="text-[10px] font-mono text-slate-400">REC ● LIVE</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {['CAM 01 · CE-IT-101', 'CAM 02 · CE-IT-102', 'CAM 03 · CE-IT-202', 'CAM 04 · BOARD ROOM'].map((camName, i) => (
                  <div key={i} className="relative aspect-video bg-slate-900 rounded border border-slate-700 overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-between p-1">
                      <span className="text-[9px] font-mono text-emerald-400 font-bold">{camName}</span>
                      <div className="flex justify-between items-center text-[8px] font-mono text-slate-400">
                        <span>1080P 30FPS</span>
                        <span className="text-red-400">● LIVE</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Room Specs Overlay */}
          <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-white/10 bg-[#0f172a]/90 px-4 py-2.5 backdrop-blur-md">
            <div className="flex items-center gap-4 text-xs font-mono text-slate-300 flex-wrap">
              <span>👥 Students Seated: <b className="text-emerald-400">20 Students in Rows</b></span>
              <span>👩‍🏫 Teacher: <b className="text-cyan-300">{teacherName}</b></span>
              <span>🪑 Total Capacity: <b className="text-white">{isBoardRoom ? '18 Seats' : '65 Seats'}</b></span>
              <span>💡 False Ceiling: <b className="text-white">Active LED Grid</b></span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

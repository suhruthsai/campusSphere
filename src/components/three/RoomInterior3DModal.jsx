import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

export default function RoomInterior3DModal({ room, classroomId, simulatedDateTime, onClose, onOpenTimetable }) {
  const mountRef = useRef(null);
  const [activeCamView, setActiveCamView] = useState('orbit'); // 'orbit', 'teacher', 'student', 'cctv'
  const [showCCTVOverlay, setShowCCTVOverlay] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(simulatedDateTime !== undefined && simulatedDateTime !== null ? simulatedDateTime : '2026-08-10T09:30'); // Default to Monday P1 (College active hours)
  const [scheduleData, setScheduleData] = useState(null);
  const [weekData, setWeekData] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const fansRef = useRef([]);

  const cleanId = getCleanRoomId(classroomId || room?.id || room?.label);

  const isIQACRoom = cleanId.toUpperCase().includes('IQAC') || 
                     (room?.label && room.label.toUpperCase().includes('IQAC')) || 
                     (room?.id && room.id.toUpperCase().includes('IQAC')) ||
                     room?.location_type === 'IQAC_ROOM';

  const isPrincipalOffice = cleanId.toUpperCase().includes('PRINCIPAL') || 
                            (room?.label && room.label.toUpperCase().includes('PRINCIPAL')) || 
                            (room?.id && room.id.toUpperCase().includes('PRINCIPAL')) ||
                            room?.location_type === 'PRINCIPAL_OFFICE';

  const isWashroom = cleanId.toUpperCase().includes('WASHROOM') || 
                     (room?.label && room.label.toUpperCase().includes('WASHROOM')) || 
                     (room?.id && room.id.toUpperCase().includes('WASHROOM')) ||
                     room?.type === 'restroom' || room?.type === 'washroom';

  const isStaffRoom = cleanId.toUpperCase().includes('STAFF') || 
                      cleanId.toUpperCase().includes('DEPT') ||
                      (room?.label && (room.label.toUpperCase().includes('STAFF') || room.label.toUpperCase().includes('DEPT'))) || 
                      (room?.id && (room.id.toUpperCase().includes('STAFF') || room.id.toUpperCase().includes('DEPT'))) ||
                      room?.type === 'office' || room?.location_type === 'STAFF_ROOM' || room?.location_type === 'OFFICE';

  const isCivilDept = cleanId.toUpperCase().includes('CIVIL-DEPT') || 
                      cleanId.toUpperCase().includes('CIVIL_DEPT') ||
                      (room?.label && room.label.toUpperCase().includes('CIVIL') && room.label.toUpperCase().includes('DEPT')) ||
                      (room?.id && room.id.toUpperCase().includes('CIVIL') && room.id.toUpperCase().includes('DEPT')) ||
                      cleanId === 'CIVIL-DEPT-OFFICE';

  const isBoardRoom = !isIQACRoom && !isPrincipalOffice && !isCivilDept && (['IT-STAFF-ROOM'].includes(cleanId) || 
                      room?.type === 'office' || room?.location_type === 'OFFICE' || room?.location_type === 'STAFF_ROOM');
  const isLab = room?.type === 'lab' || room?.location_type === 'LABORATORY' || cleanId.includes('LAB');
  const isAdminLobby = cleanId.toUpperCase().includes('ADMIN') || (room?.location_type && room.location_type.toUpperCase().includes('ADMIN')) || (room?.type && room.type.toLowerCase() === 'admin');

  const isFMLab = cleanId.toUpperCase().includes('FM-LAB') || 
                  cleanId.toUpperCase().includes('FLUID') || 
                  (room?.label && room.label.toUpperCase().includes('FLUID')) || 
                  (room?.id && room.id.toUpperCase().includes('FM-LAB'));

  const isEELab = cleanId.toUpperCase().includes('EE-LAB') || 
                  cleanId.toUpperCase().includes('ENVIR') || 
                  (room?.label && room.label.toUpperCase().includes('ENVIR')) || 
                  (room?.id && room.id.toUpperCase().includes('EE-LAB'));

  const isCTLab = cleanId.toUpperCase().includes('CT-LAB') || 
                  cleanId.toUpperCase().includes('CONCRETE') || 
                  (room?.label && room.label.toUpperCase().includes('CONCRETE')) || 
                  (room?.id && room.id.toUpperCase().includes('CT-LAB'));

  const isIoTLab = cleanId.toUpperCase().includes('IOT-LAB') || 
                   cleanId.toUpperCase().includes('IOT') || 
                   (room?.label && room.label.toUpperCase().includes('IOT')) || 
                   (room?.id && room.id.toUpperCase().includes('IOT-LAB'));

  const isFirstFloorCompLab = cleanId.toUpperCase().includes('CE-IT-104') || 
                              cleanId.toUpperCase().includes('COMP-LAB') || 
                              cleanId.toUpperCase().includes('COMP') || 
                              cleanId.toUpperCase().includes('COMPUTER') || 
                              (room?.label && room.label.toUpperCase().includes('COMPUTER')) || 
                              (room?.id && (room.id.toUpperCase().includes('CE-IT-104') || room.id.toUpperCase().includes('COMP')));

  const isNonTimetableFacility = isAdminLobby || isIQACRoom || isPrincipalOffice || isStaffRoom || isWashroom || isBoardRoom || isCivilDept;

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

  useEffect(() => {
    if (simulatedDateTime !== undefined && simulatedDateTime !== null) {
      setSelectedSlot(simulatedDateTime);
    }
  }, [simulatedDateTime]);

  // Robust Faculty & Subject Resolution
  const activeEntry = scheduleData?.current_entry || 
                      scheduleData?.next_entry || 
                      (weekData?.entries && weekData.entries[0]) || 
                      (weekData?.schedule && Object.values(weekData.schedule).flat()[0]) || 
                      null;

  const teacherName = activeEntry?.faculty_name || (isBoardRoom ? 'Dr. M. Kameswara Rao (Principal)' : cleanId.startsWith('CE-2') ? 'Dr. G. Narendra Goud' : 'Dr. B. Vasavi');
  const subjectName = activeEntry?.subject_name || (isBoardRoom ? 'Academic Council & Executive Review' : cleanId.startsWith('CE-2') ? 'Fluid Mechanics Lab' : 'Data Structures using C');
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
    if (isAdminLobby) {
      camera.position.set(0, 6.5, 12.5);
    } else if (isIQACRoom) {
      camera.position.set(0, 4.2, 9.2);
    } else if (isPrincipalOffice) {
      camera.position.set(0, 3.8, 8.5);
    } else if (isCivilDept) {
      camera.position.set(0, 4.5, 10.5);
    } else if (isFMLab || isEELab || isCTLab || isIoTLab || isFirstFloorCompLab) {
      camera.position.set(0, 4.8, 12.5);
    } else {
      camera.position.set(0, 4.5, 9.5);
    }
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
    controls.maxDistance = 25;
    controls.target.set(0, isAdminLobby ? 1.8 : 1.4, 0);
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
    const roomW = isAdminLobby ? 18 : isIQACRoom ? 11 : isPrincipalOffice ? 11 : isCivilDept ? 16 : isFMLab || isEELab || isCTLab || isIoTLab || isFirstFloorCompLab ? 18 : 12;
    const roomD = isAdminLobby ? 20 : isIQACRoom ? 13 : isPrincipalOffice ? 12 : isCivilDept ? 14 : isFMLab || isEELab || isCTLab || isIoTLab || isFirstFloorCompLab ? 16 : 14;
    const roomH = isAdminLobby ? 6.5 : isIQACRoom ? 4.0 : isPrincipalOffice ? 3.8 : isCivilDept ? 4.0 : isFMLab || isEELab || isCTLab || isIoTLab || isFirstFloorCompLab ? 4.2 : 4.2;

    const fans = [];

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

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.45, 10), shirtMat);
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

    function createSeatedOfficial(options = {}) {
      const {
        suitColor = 0x1E3A8A,
        skinColor = 0xD8A064,
        hairColor = 0x111111,
        title = 'Official',
        name = 'Faculty Member',
        isPrincipal = false,
        headAngleY = 0,
        armGesture = false
      } = options;

      const grp = new THREE.Group();
      const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
      const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.8 });
      const suitMat = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.5 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.8 });

      // Lower Body (Pants/Thighs resting on chair)
      const thighs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.44), pantsMat);
      thighs.position.set(0, 0.48, 0.12);
      grp.add(thighs);

      // Torso / Suit Jacket
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.18, 0.52, 12), suitMat);
      torso.position.set(0, 0.76, 0);
      torso.castShadow = true;
      grp.add(torso);

      // Collar & Tie for Principal
      if (isPrincipal) {
        const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.04), new THREE.MeshBasicMaterial({ color: 0xFFFFFF }));
        shirt.position.set(0, 0.88, 0.18);
        grp.add(shirt);

        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.05), new THREE.MeshBasicMaterial({ color: 0xDC2626 }));
        tie.position.set(0, 0.82, 0.19);
        grp.add(tie);

        const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.08), new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.8 }));
        glasses.position.set(0, 1.15, 0.15);
        grp.add(glasses);
      }

      // Head Group (Rotated towards conversation partner)
      const headGrp = new THREE.Group();
      headGrp.position.set(0, 1.14, 0);
      headGrp.rotation.y = headAngleY;

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), skinMat);
      head.castShadow = true;
      headGrp.add(head);

      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.8), hairMat);
      hair.position.y = 0.02;
      headGrp.add(hair);

      grp.add(headGrp);

      // Arms (Talking/Gesturing postures)
      const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.38), suitMat);
      armL.position.set(-0.2, 0.74, 0.12);
      armL.rotation.x = Math.PI / 3.5;
      grp.add(armL);

      const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.38), suitMat);
      if (armGesture) {
        armR.position.set(0.2, 0.78, 0.22);
        armR.rotation.x = Math.PI / 3;
        armR.rotation.y = -Math.PI / 6;
        armR.rotation.z = -Math.PI / 6;
      } else {
        armR.position.set(0.2, 0.74, 0.12);
        armR.rotation.x = Math.PI / 3.5;
      }
      grp.add(armR);

      // Floating 3D Name Banner Sprite
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.beginPath();
      ctx.roundRect(10, 10, 492, 108, 16);
      ctx.fill();
      ctx.strokeStyle = isPrincipal ? '#F59E0B' : '#00E5FF';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.fillStyle = isPrincipal ? '#F59E0B' : '#00E5FF';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';

      const displayName = name || (isPrincipal ? 'Faculty Professor' : '');

      if (displayName) {
        ctx.fillText(title, 256, 46);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(displayName, 256, 88);
      } else {
        ctx.fillText(title, 256, 68);
      }

      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(0, 1.75, 0);
      sprite.scale.set(2.2, 0.55, 1);
      grp.add(sprite);

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

    if (isIQACRoom) {
      // ══════════════════════════════════════════════════════════════════════════
      // 🏛️ IQAC ROOM (INTERNAL QUALITY ASSURANCE CELL) — 3D VISUAL RECONSTRUCTION
      // Matched precisely to User Reference Photo
      // ══════════════════════════════════════════════════════════════════════════

      // 1. Light Cream Polished Tile Floor
      const floorCanvas = document.createElement('canvas');
      floorCanvas.width = 512;
      floorCanvas.height = 512;
      const fctx = floorCanvas.getContext('2d');
      fctx.fillStyle = '#FAF7F0';
      fctx.fillRect(0, 0, 512, 512);
      fctx.strokeStyle = '#E2DDD0';
      fctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 64) {
        fctx.moveTo(i, 0); fctx.lineTo(i, 512);
        fctx.moveTo(0, i); fctx.lineTo(512, i);
      }
      fctx.stroke();
      const floorTex = new THREE.CanvasTexture(floorCanvas);
      floorTex.wrapS = THREE.RepeatWrapping;
      floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(10, 12);

      const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.12, metalness: 0.08 });
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // 2. Wood Slat False Ceiling with White Perimeter Tray (Matched to Photo)
      const woodSlatCanvas = document.createElement('canvas');
      woodSlatCanvas.width = 512;
      woodSlatCanvas.height = 512;
      const wctx = woodSlatCanvas.getContext('2d');
      wctx.fillStyle = '#3E2415';
      wctx.fillRect(0, 0, 512, 512);
      wctx.fillStyle = '#1D0F08';
      for (let y = 0; y < 512; y += 16) {
        wctx.fillRect(0, y, 512, 3);
      }
      const woodSlatTex = new THREE.CanvasTexture(woodSlatCanvas);
      woodSlatTex.wrapS = THREE.RepeatWrapping;
      woodSlatTex.wrapT = THREE.RepeatWrapping;
      woodSlatTex.repeat.set(6, 6);

      const centerWoodCeilMat = new THREE.MeshStandardMaterial({ map: woodSlatTex, roughness: 0.4 });
      const centerWoodCeil = new THREE.Mesh(new THREE.PlaneGeometry(roomW - 2.4, roomD - 2.4), centerWoodCeilMat);
      centerWoodCeil.position.set(0, roomH, 0);
      centerWoodCeil.rotation.x = Math.PI / 2;
      scene.add(centerWoodCeil);

      // White Perimeter Tray Border
      const trayMat = new THREE.MeshStandardMaterial({ color: 0xF1F5F9, roughness: 0.7 });
      const trayThickness = 0.15;
      
      const trayFront = new THREE.Mesh(new THREE.BoxGeometry(roomW, trayThickness, 1.2), trayMat);
      trayFront.position.set(0, roomH - trayThickness/2, -roomD/2 + 0.6);
      scene.add(trayFront);

      const trayBack = new THREE.Mesh(new THREE.BoxGeometry(roomW, trayThickness, 1.2), trayMat);
      trayBack.position.set(0, roomH - trayThickness/2, roomD/2 - 0.6);
      scene.add(trayBack);

      const trayLeft = new THREE.Mesh(new THREE.BoxGeometry(1.2, trayThickness, roomD - 2.4), trayMat);
      trayLeft.position.set(-roomW/2 + 0.6, roomH - trayThickness/2, 0);
      scene.add(trayLeft);

      const trayRight = new THREE.Mesh(new THREE.BoxGeometry(1.2, trayThickness, roomD - 2.4), trayMat);
      trayRight.position.set(roomW/2 - 0.6, roomH - trayThickness/2, 0);
      scene.add(trayRight);

      // Recessed Warm LED Spotlights
      const spotLightMat = new THREE.MeshBasicMaterial({ color: 0xFFF7ED });
      const spotGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16);
      const spotCoords = [
        [-3.5, -4.5], [0, -4.5], [3.5, -4.5],
        [-3.5, 4.5], [0, 4.5], [3.5, 4.5],
        [-4.5, -2], [-4.5, 2], [4.5, -2], [4.5, 2]
      ];
      spotCoords.forEach(([sx, sz]) => {
        const spotMesh = new THREE.Mesh(spotGeom, spotLightMat);
        spotMesh.position.set(sx, roomH - 0.01, sz);
        scene.add(spotMesh);

        const pLight = new THREE.PointLight(0xFFF1D6, 0.6, 7);
        pLight.position.set(sx, roomH - 0.2, sz);
        scene.add(pLight);
      });

      // Ceiling Fans (White, 3-blade)
      [[-2.0, -1.5], [2.0, 1.5]].forEach(([fx, fz]) => {
        const fanGrp = new THREE.Group();
        fanGrp.position.set(fx, roomH - 0.35, fz);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
        fanGrp.add(rod);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
        hub.position.y = -0.2;
        fanGrp.add(hub);
        const bladesGrp = new THREE.Group();
        bladesGrp.position.y = -0.2;
        for (let i = 0; i < 3; i++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.95), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
          blade.position.z = 0.48;
          const bladePivot = new THREE.Group();
          bladePivot.rotation.y = (i * Math.PI * 2) / 3;
          bladePivot.add(blade);
          bladesGrp.add(bladePivot);
        }
        fanGrp.add(bladesGrp);
        scene.add(fanGrp);
        fans.push(bladesGrp);
      });

      // Ceiling Mounted Multimedia Video Projector
      const projGrp = new THREE.Group();
      projGrp.position.set(-1.0, roomH - 0.4, -2.8);
      const projMount = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35), new THREE.MeshStandardMaterial({ color: 0xE2E8F0 }));
      projGrp.add(projMount);
      const projBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.38), new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.3 }));
      projBody.position.y = -0.22;
      projGrp.add(projBody);
      const projLens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06), new THREE.MeshBasicMaterial({ color: 0x00E5FF }));
      projLens.rotation.x = Math.PI / 2;
      projLens.position.set(0.12, -0.22, 0.2);
      projGrp.add(projLens);
      scene.add(projGrp);

      // 3. Smooth Cream Plaster Walls
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xFAF8F5, roughness: 0.85 });
      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMat);
      backWall.position.set(0, roomH / 2, -roomD / 2);
      backWall.receiveShadow = true;
      scene.add(backWall);

      const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
      leftWall.position.set(-roomW / 2, roomH / 2, 0);
      leftWall.rotation.y = Math.PI / 2;
      leftWall.receiveShadow = true;
      scene.add(leftWall);

      const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
      rightWall.position.set(roomW / 2, roomH / 2, 0);
      rightWall.rotation.y = -Math.PI / 2;
      scene.add(rightWall);

      // Left Wall: Split AC Unit & Stabilizer Box (Matched to Photo)
      const acUnit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.28), new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.3 }));
      acUnit.position.set(-roomW / 2 + 0.15, 3.1, -4.2);
      scene.add(acUnit);

      const acLed = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.08), new THREE.MeshBasicMaterial({ color: 0x38BDF8 }));
      acLed.position.set(-roomW / 2 + 0.3, 3.0, -3.6);
      scene.add(acLed);

      const stabBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.16), new THREE.MeshStandardMaterial({ color: 0xFEF08A, roughness: 0.5 }));
      stabBox.position.set(-roomW / 2 + 0.1, 2.9, -3.0);
      scene.add(stabBox);

      // Back Wall: Cream Wooden Door & Electrical Box with Wires
      const doorMat = new THREE.MeshStandardMaterial({ color: 0xFDF6E3, roughness: 0.6 });
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.06), new THREE.MeshStandardMaterial({ color: 0xD4A373 }));
      doorFrame.position.set(-1.8, 1.1, -roomD / 2 + 0.03);
      scene.add(doorFrame);

      const doorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), doorMat);
      doorMesh.position.set(-1.8, 1.1, -roomD / 2 + 0.07);
      scene.add(doorMesh);

      const doorHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12), new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.9 }));
      doorHandle.rotation.z = Math.PI / 2;
      doorHandle.position.set(-1.4, 1.05, -roomD / 2 + 0.1);
      scene.add(doorHandle);

      // Back Wall Electrical Wire Conduit Box (Matched to Photo)
      const elecBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.12), new THREE.MeshStandardMaterial({ color: 0xF8FAFC }));
      elecBox.position.set(2.2, 3.2, -roomD / 2 + 0.06);
      scene.add(elecBox);

      // Wire bundle harness
      for (let w = -0.12; w <= 0.12; w += 0.04) {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6), new THREE.MeshStandardMaterial({ color: 0x1E293B }));
        wire.position.set(2.2 + w, 2.8, -roomD / 2 + 0.08);
        scene.add(wire);
      }

      // Right Wall: Tripod Easel Whiteboard (Matched to Photo)
      const easelGrp = new THREE.Group();
      easelGrp.position.set(roomW / 2 - 1.8, 0, -2.8);
      easelGrp.rotation.y = -Math.PI / 5;

      const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.25, 0.04), new THREE.MeshStandardMaterial({ color: 0xD4A373 }));
      boardFrame.position.y = 1.35;
      easelGrp.add(boardFrame);

      const boardSurface = new THREE.Mesh(new THREE.PlaneGeometry(1.82, 1.18), new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.2 }));
      boardSurface.position.set(0, 1.35, 0.025);
      easelGrp.add(boardSurface);

      const tray = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.8 }));
      tray.position.set(0, 0.72, 0.05);
      easelGrp.add(tray);

      const legMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.6 });
      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 1.5), legMat);
      leg1.position.set(-0.75, 0.75, -0.15);
      leg1.rotation.z = 0.12;
      easelGrp.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 1.5), legMat);
      leg2.position.set(0.75, 0.75, -0.15);
      leg2.rotation.z = -0.12;
      easelGrp.add(leg2);

      const legBack = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 1.5), legMat);
      legBack.position.set(0, 0.75, 0.35);
      legBack.rotation.x = -0.25;
      easelGrp.add(legBack);

      scene.add(easelGrp);

      // Black Presentation Podium / Lectern
      const podiumMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
      const podiumBase = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.15, 0.52), podiumMat);
      podiumBase.position.set(roomW / 2 - 2.5, 0.575, -4.2);
      scene.add(podiumBase);

      const podiumTop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.55), podiumMat);
      podiumTop.position.set(roomW / 2 - 2.5, 1.18, -4.2);
      podiumTop.rotation.x = Math.PI / 16;
      scene.add(podiumTop);

      // Back Right Corner: UPS & Battery Rack Unit (Matched to Photo)
      const rackGrp = new THREE.Group();
      rackGrp.position.set(roomW / 2 - 1.2, 0, -5.2);
      const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x1E293B }));
      rackFrame.position.y = 0.6;
      rackGrp.add(rackFrame);

      for (let b = 0; b < 6; b++) {
        const batX = (b % 2 === 0) ? -0.22 : 0.22;
        const batY = 0.25 + Math.floor(b / 2) * 0.35;
        const battery = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.42), new THREE.MeshStandardMaterial({ color: 0xF8FAFC }));
        battery.position.set(batX, batY, 0);
        rackGrp.add(battery);
      }
      scene.add(rackGrp);

      // 4. Central Executive Conference Table & Seating (Matched to Photo)
      const tableW = 3.6;
      const tableD = 7.6;
      const tableH = 0.78;

      const confTableGrp = new THREE.Group();
      confTableGrp.position.set(-0.5, 0, 0.2);

      const tableTopMat = new THREE.MeshStandardMaterial({ color: 0xD4A373, roughness: 0.35 });
      const tableTop = new THREE.Mesh(new THREE.BoxGeometry(tableW, 0.08, tableD), tableTopMat);
      tableTop.position.y = tableH;
      tableTop.castShadow = true;
      confTableGrp.add(tableTop);

      // Dark edge trim
      const edgeMat = new THREE.MeshStandardMaterial({ color: 0x4A2E1B, roughness: 0.5 });
      const edgeFront = new THREE.Mesh(new THREE.BoxGeometry(tableW + 0.08, 0.1, 0.06), edgeMat);
      edgeFront.position.set(0, tableH, -tableD/2 - 0.03);
      confTableGrp.add(edgeFront);
      const edgeBack = new THREE.Mesh(new THREE.BoxGeometry(tableW + 0.08, 0.1, 0.06), edgeMat);
      edgeBack.position.set(0, tableH, tableD/2 + 0.03);
      confTableGrp.add(edgeBack);

      // Table Legs / Base Columns
      const legMatT = new THREE.MeshStandardMaterial({ color: 0x27150C, roughness: 0.7 });
      for (let lz of [-2.4, 0, 2.4]) {
        const legCol = new THREE.Mesh(new THREE.BoxGeometry(2.4, tableH - 0.08, 0.35), legMatT);
        legCol.position.set(0, (tableH - 0.08)/2, lz);
        confTableGrp.add(legCol);
      }

      // Executive Head Seats (Left Side Head)
      // Chair 1: Dark Brown Leather Chair
      const brownChairMat = new THREE.MeshStandardMaterial({ color: 0x2C1A11, roughness: 0.4 });
      const brownChair = createExecutiveChair(brownChairMat);
      brownChair.position.set(-tableW/2 - 0.5, 0, -tableD/2 + 0.9);
      brownChair.rotation.y = Math.PI / 2;
      confTableGrp.add(brownChair);

      // Chair 2: Tan / Camel Leather Chair
      const tanChairMat = new THREE.MeshStandardMaterial({ color: 0xC68B45, roughness: 0.4 });
      const tanChair = createExecutiveChair(tanChairMat);
      tanChair.position.set(-tableW/2 - 0.5, 0, -tableD/2 + 2.2);
      tanChair.rotation.y = Math.PI / 2;
      confTableGrp.add(tanChair);

      // Member Chairs (Black Mesh High-Back Chairs along Table Sides)
      const meshChairMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.6 });
      for (let z = -2.2; z <= 3.2; z += 1.25) {
        // Left side seats (starting after head executive seats)
        if (z > -1.2) {
          const cLeft = createExecutiveChair(meshChairMat);
          cLeft.position.set(-tableW/2 - 0.5, 0, z);
          cLeft.rotation.y = Math.PI / 2;
          confTableGrp.add(cLeft);
        }

        // Right side seats
        const cRight = createExecutiveChair(meshChairMat);
        cRight.position.set(tableW/2 + 0.5, 0, z);
        cRight.rotation.y = -Math.PI / 2;
        confTableGrp.add(cRight);
      }

      // 5. SEATED PRINCIPAL & TEACHERS IN ACTIVE CONVERSATION (TITLES ONLY)
      // Principal Avatar in Head Dark Brown Leather Chair
      const principalAvatar = createSeatedOfficial({
        suitColor: 0x1E3A8A, // Royal Navy Blue Suit
        skinColor: 0xDAA520,
        hairColor: 0x333333,
        title: '🏛️ PRINCIPAL',
        name: '',
        isPrincipal: true,
        headAngleY: Math.PI / 4, // Turned right towards Coordinator
        armGesture: true
      });
      principalAvatar.position.set(-tableW/2 - 0.5, 0, -tableD/2 + 0.9);
      principalAvatar.rotation.y = Math.PI / 2;
      confTableGrp.add(principalAvatar);

      // IQAC Coordinator Avatar in Head Tan Leather Chair
      const coordinatorAvatar = createSeatedOfficial({
        suitColor: 0x881337, // Burgundy / Crimson Blazer
        skinColor: 0xE0AC69,
        hairColor: 0x1A1A1A,
        title: '👩‍🏫 IQAC COORDINATOR',
        name: '',
        isPrincipal: false,
        headAngleY: -Math.PI / 4, // Turned left towards Principal
        armGesture: false
      });
      coordinatorAvatar.position.set(-tableW/2 - 0.5, 0, -tableD/2 + 2.2);
      coordinatorAvatar.rotation.y = Math.PI / 2;
      confTableGrp.add(coordinatorAvatar);

      // Civil HOD Avatar in Left Side Mesh Chair
      const civilHodAvatar = createSeatedOfficial({
        suitColor: 0x065F46, // Dark Emerald Green Suit
        title: '👨‍🏫 CIVIL HOD',
        name: '',
        headAngleY: -Math.PI / 5,
        armGesture: true
      });
      civilHodAvatar.position.set(-tableW/2 - 0.5, 0, 0.05);
      civilHodAvatar.rotation.y = Math.PI / 2;
      confTableGrp.add(civilHodAvatar);

      // IT HOD Avatar in Right Side Mesh Chair
      const itHodAvatar = createSeatedOfficial({
        suitColor: 0x0369A1, // Deep Cyan Blazer
        title: '💻 IT HOD',
        name: '',
        headAngleY: Math.PI / 5,
        armGesture: false
      });
      itHodAvatar.position.set(tableW/2 + 0.5, 0, -tableD/2 + 2.2);
      itHodAvatar.rotation.y = -Math.PI / 2;
      confTableGrp.add(itHodAvatar);

      // Floating Live Discussion Dialogue Banner above Head Table
      const chatCanvas = document.createElement('canvas');
      chatCanvas.width = 512;
      chatCanvas.height = 120;
      const chatCtx = chatCanvas.getContext('2d');
      chatCtx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      chatCtx.roundRect(10, 10, 492, 100, 16);
      chatCtx.fill();
      chatCtx.strokeStyle = '#00E5FF';
      chatCtx.lineWidth = 3;
      chatCtx.stroke();

      chatCtx.fillStyle = '#00E5FF';
      chatCtx.font = 'bold 22px sans-serif';
      chatCtx.fillText('💬 LIVE ACADEMIC AUDIT SESSION', 30, 45);

      chatCtx.fillStyle = '#F8FAFC';
      chatCtx.font = 'bold 18px monospace';
      chatCtx.fillText('Principal & Faculty Discussing IQAC Quality Metrics', 30, 85);

      const chatTex = new THREE.CanvasTexture(chatCanvas);
      const chatSpriteMat = new THREE.SpriteMaterial({ map: chatTex, transparent: true });
      const chatSprite = new THREE.Sprite(chatSpriteMat);
      chatSprite.position.set(-tableW/2 + 0.4, tableH + 1.85, 0.6);
      chatSprite.scale.set(3.2, 0.75, 1);
      confTableGrp.add(chatSprite);

      // Table Accessories: Miniature Clear Water Bottles & Gooseneck Mic
      const bottleMat = new THREE.MeshPhysicalMaterial({ color: 0x60A5FA, transparent: true, opacity: 0.7, roughness: 0.1, transmission: 0.8 });
      const capMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });

      for (let z = -2.5; z <= 3.0; z += 1.25) {
        // Left bottle
        const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16), bottleMat);
        b1.position.set(-tableW/2 + 0.4, tableH + 0.12, z);
        confTableGrp.add(b1);
        const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04), capMat);
        c1.position.set(-tableW/2 + 0.4, tableH + 0.22, z);
        confTableGrp.add(c1);

        // Right bottle
        const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16), bottleMat);
        b2.position.set(tableW/2 - 0.4, tableH + 0.12, z);
        confTableGrp.add(b2);
        const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04), capMat);
        c2.position.set(tableW/2 - 0.4, tableH + 0.22, z);
        confTableGrp.add(c2);
      }

      // Gooseneck Microphone on Front Table Section
      const micBase = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.14), new THREE.MeshStandardMaterial({ color: 0x111827 }));
      micBase.position.set(0.6, tableH + 0.04, 2.5);
      confTableGrp.add(micBase);

      const micStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35), new THREE.MeshStandardMaterial({ color: 0x1E293B }));
      micStem.position.set(0.6, tableH + 0.2, 2.45);
      micStem.rotation.x = -Math.PI / 8;
      confTableGrp.add(micStem);

      const micHead = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), new THREE.MeshStandardMaterial({ color: 0x475569 }));
      micHead.position.set(0.6, tableH + 0.35, 2.38);
      confTableGrp.add(micHead);

      scene.add(confTableGrp);

    } else if (isPrincipalOffice) {
      // ══════════════════════════════════════════════════════════════════════════
      // 🏛️ PRINCIPAL'S OFFICE (CABIN) — 3D VISUAL RECONSTRUCTION & INTERACTIVE
      // Matched precisely to User Reference Photo
      // ══════════════════════════════════════════════════════════════════════════

      // 1. Light Beige/Cream Polished Floor
      const floorCanvas = document.createElement('canvas');
      floorCanvas.width = 512;
      floorCanvas.height = 512;
      const fctx = floorCanvas.getContext('2d');
      fctx.fillStyle = '#FAF7F0';
      fctx.fillRect(0, 0, 512, 512);
      fctx.strokeStyle = '#E2DDD0';
      fctx.lineWidth = 1.5;
      for (let i = 0; i <= 512; i += 64) {
        fctx.moveTo(i, 0); fctx.lineTo(i, 512);
        fctx.moveTo(0, i); fctx.lineTo(512, i);
      }
      fctx.stroke();
      const floorTex = new THREE.CanvasTexture(floorCanvas);
      floorTex.wrapS = THREE.RepeatWrapping;
      floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(10, 10);

      const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.1, metalness: 0.05 });
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // White Ceiling
      const ceilMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.8 });
      const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilMat);
      ceilMesh.position.set(0, roomH, 0);
      ceilMesh.rotation.x = Math.PI / 2;
      scene.add(ceilMesh);

      // Recessed Warm LED Spotlights
      const spotGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16);
      const spotLightMat = new THREE.MeshBasicMaterial({ color: 0xFFF7ED });
      [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5], [0, 0]].forEach(([sx, sz]) => {
        const sm = new THREE.Mesh(spotGeom, spotLightMat);
        sm.position.set(sx, roomH - 0.01, sz);
        scene.add(sm);
        const pl = new THREE.PointLight(0xFFF1D6, 0.7, 8);
        pl.position.set(sx, roomH - 0.2, sz);
        scene.add(pl);
      });

      // 2. BACK WALL: Stacked Stone / Ledger Stone Wallpaper (Matched to Photo)
      const stoneCanvas = document.createElement('canvas');
      stoneCanvas.width = 512;
      stoneCanvas.height = 512;
      const sctx = stoneCanvas.getContext('2d');
      sctx.fillStyle = '#78716C';
      sctx.fillRect(0, 0, 512, 512);

      const stoneColors = ['#57534E', '#78716C', '#A8A29E', '#44403C', '#292524', '#D6D3D1', '#8C857B'];
      for (let y = 0; y < 512; y += 16) {
        let x = (y / 16 % 2 === 0) ? 0 : -20;
        while (x < 512) {
          const w = 40 + Math.floor(Math.sin(x + y) * 20 + 20);
          sctx.fillStyle = stoneColors[(x + y) % stoneColors.length];
          sctx.fillRect(x, y, w - 2, 14);
          sctx.fillStyle = 'rgba(0,0,0,0.3)';
          sctx.fillRect(x, y + 13, w, 3);
          x += w;
        }
      }
      const stoneTex = new THREE.CanvasTexture(stoneCanvas);
      stoneTex.wrapS = THREE.RepeatWrapping;
      stoneTex.wrapT = THREE.RepeatWrapping;
      stoneTex.repeat.set(4, 3);

      const backWallMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8 });
      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), backWallMat);
      backWall.position.set(0, roomH / 2, -roomD / 2);
      backWall.receiveShadow = true;
      scene.add(backWall);

      // Left Wall (Off-white plaster)
      const leftWallMat = new THREE.MeshStandardMaterial({ color: 0xF5F5F4, roughness: 0.9 });
      const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), leftWallMat);
      leftWall.position.set(-roomW / 2, roomH / 2, 0);
      leftWall.rotation.y = Math.PI / 2;
      leftWall.receiveShadow = true;
      scene.add(leftWall);

      // 3. RIGHT WALL: Window with Bars & White Pull-down Roller Shade Blind (Matched to Photo)
      const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), leftWallMat);
      rightWall.position.set(roomW / 2, roomH / 2, 0);
      rightWall.rotation.y = -Math.PI / 2;
      scene.add(rightWall);

      // Window Frame & Glass
      const winW = 4.2;
      const winH = 2.4;
      const winZ = -1.2;
      const winY = 1.9;

      const winFrameMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.3 });
      const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, winH + 0.2, winW + 0.2), winFrameMat);
      winFrame.position.set(roomW / 2 - 0.05, winY, winZ);
      scene.add(winFrame);

      const glassMat = new THREE.MeshStandardMaterial({ color: 0x93C5FD, transparent: true, opacity: 0.45, roughness: 0.1 });
      const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glassMat);
      glassPane.position.set(roomW / 2 - 0.08, winY, winZ);
      glassPane.rotation.y = -Math.PI / 2;
      scene.add(glassPane);

      // Vertical Security Grill Bars (Silver metal)
      const barMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.8, roughness: 0.3 });
      for (let bz = winZ - winW/2 + 0.3; bz <= winZ + winW/2 - 0.3; bz += 0.4) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, winH), barMat);
        bar.position.set(roomW / 2 - 0.07, winY, bz);
        scene.add(bar);
      }

      // White Pull-down Roller Shade Blind (Top half covering)
      const blindMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.6 });
      const blind = new THREE.Mesh(new THREE.PlaneGeometry(winW + 0.1, winH * 0.55), blindMat);
      blind.position.set(roomW / 2 - 0.09, winY + winH * 0.22, winZ);
      blind.rotation.y = -Math.PI / 2;
      scene.add(blind);

      // Wall-Mounted White Electric Fan in Upper Right Corner (Matched to Photo)
      const fanGrp = new THREE.Group();
      fanGrp.position.set(roomW / 2 - 0.4, roomH - 0.6, -roomD / 2 + 0.8);
      const fanMount = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2), winFrameMat);
      fanMount.rotation.z = Math.PI / 2;
      fanGrp.add(fanMount);
      const fanCage = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0xE2E8F0, wireframe: true }));
      fanCage.rotation.x = Math.PI / 2;
      fanCage.position.set(-0.15, 0, 0);
      fanGrp.add(fanCage);
      scene.add(fanGrp);

      // 4. POLISHED MAHOGANY EXECUTIVE DESK (Matched to Photo)
      const deskW = 3.6;
      const deskD = 1.9;
      const deskH = 0.78;
      const deskZ = -2.2;

      const mahogMat = new THREE.MeshStandardMaterial({ color: 0x3B1E08, roughness: 0.3 });
      const deskTop = new THREE.Mesh(new THREE.BoxGeometry(deskW, 0.08, deskD), mahogMat);
      deskTop.position.set(0, deskH, deskZ);
      deskTop.castShadow = true;
      scene.add(deskTop);

      // Desk Side Panels
      const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.12, deskH - 0.08, deskD - 0.1), mahogMat);
      panelL.position.set(-deskW/2 + 0.1, (deskH - 0.08)/2, deskZ);
      scene.add(panelL);

      const panelR = new THREE.Mesh(new THREE.BoxGeometry(0.12, deskH - 0.08, deskD - 0.1), mahogMat);
      panelR.position.set(deskW/2 - 0.1, (deskH - 0.08)/2, deskZ);
      scene.add(panelR);

      // Modesty Panel
      const modesty = new THREE.Mesh(new THREE.BoxGeometry(deskW - 0.2, deskH - 0.1, 0.06), mahogMat);
      modesty.position.set(0, (deskH - 0.1)/2, deskZ + deskD/2 - 0.05);
      scene.add(modesty);

      // 5. SEATED PRINCIPAL 3D AVATAR (Matched to Photo)
      // Executive Leather Swivel Chair behind Desk
      const chairBaseMat = new THREE.MeshStandardMaterial({ color: 0x27150C, roughness: 0.6 });
      const chairCushionMat = new THREE.MeshStandardMaterial({ color: 0xFFB74D, roughness: 0.4 });
      const pChairGrp = new THREE.Group();
      pChairGrp.position.set(0, 0, deskZ - 0.95);

      const pChairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.7), chairCushionMat);
      pChairSeat.position.y = 0.5;
      pChairGrp.add(pChairSeat);

      const pChairBack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.95, 0.12), chairCushionMat);
      pChairBack.position.set(0, 0.98, -0.3);
      pChairGrp.add(pChairBack);

      const pChairFrame = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.98, 0.06), chairBaseMat);
      pChairFrame.position.set(0, 0.98, -0.36);
      pChairGrp.add(pChairFrame);

      const pChairStand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.38, 0.48), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 }));
      pChairStand.position.y = 0.24;
      pChairGrp.add(pChairStand);

      scene.add(pChairGrp);

      // Seated Principal Avatar
      const principalAvatar = createSeatedOfficial({
        suitColor: 0x1E293B, // Dark Charcoal Suit
        skinColor: 0xDAA520,
        hairColor: 0x222222,
        title: '🏛️ PRINCIPAL',
        name: '',
        isPrincipal: true,
        headAngleY: 0,
        armGesture: true
      });
      principalAvatar.position.set(0, 0, deskZ - 0.95);
      scene.add(principalAvatar);

      // 6. DESK EQUIPMENT & ACCESSORIES (Matched to Photo)
      // Light Blue Document Inbox Tray (Left desk side)
      const trayMat = new THREE.MeshStandardMaterial({ color: 0x38BDF8, roughness: 0.4 });
      const docTray = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.65), trayMat);
      docTray.position.set(-1.2, deskH + 0.08, deskZ + 0.1);
      scene.add(docTray);

      const paperMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
      const paperStack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.58), paperMat);
      paperStack.position.set(-1.2, deskH + 0.12, deskZ + 0.1);
      scene.add(paperStack);

      // Pen Holder with Colored Pens & Desktop Flowers
      const penHolder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0xF59E0B, metalness: 0.6 }));
      penHolder.position.set(-0.65, deskH + 0.115, deskZ + 0.25);
      scene.add(penHolder);

      // Desktop Framed Photo
      const photoFrame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.04), new THREE.MeshStandardMaterial({ color: 0x451A03 }));
      photoFrame.position.set(-0.15, deskH + 0.2, deskZ - 0.4);
      photoFrame.rotation.y = Math.PI / 8;
      scene.add(photoFrame);

      // Dual Monitor Setup & Computer Systems (Matched to Photo)
      // Main Black Monitor / TV
      const mainMonBody = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.08), new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.3 }));
      mainMonBody.position.set(0.65, deskH + 0.38, deskZ - 0.1);
      scene.add(mainMonBody);

      const mainMonStand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.15, 0.15), new THREE.MeshStandardMaterial({ color: 0x1E293B }));
      mainMonStand.position.set(0.65, deskH + 0.08, deskZ - 0.1);
      scene.add(mainMonStand);

      // Secondary Laptop Screen (Open dashboard)
      const lapBody = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.02, 0.35), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 }));
      lapBody.position.set(1.3, deskH + 0.05, deskZ - 0.15);
      scene.add(lapBody);

      const lapScreen = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.02), new THREE.MeshStandardMaterial({ color: 0x0F172A }));
      lapScreen.position.set(1.3, deskH + 0.22, deskZ - 0.3);
      lapScreen.rotation.x = -Math.PI / 12;
      scene.add(lapScreen);

      // All-in-One White Desktop Printer (Right of Monitor)
      const printerBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.48), new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.3 }));
      printerBody.position.set(0.9, deskH + 0.2, deskZ - 0.55);
      scene.add(printerBody);

      // 7. THREE EXECUTIVE VISITOR CHAIRS (Matched to Photo)
      // Lined up directly in front of desk, facing the Principal
      const visSeatMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.5 });
      const visFrameMat = new THREE.MeshStandardMaterial({ color: 0x27150C, roughness: 0.6 });

      [-0.95, 0, 0.95].forEach((vx) => {
        const vChairGrp = new THREE.Group();
        vChairGrp.position.set(vx, 0, deskZ + 1.45);
        vChairGrp.rotation.y = Math.PI;

        const vSeat = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.55), visSeatMat);
        vSeat.position.y = 0.46;
        vChairGrp.add(vSeat);

        const vBack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.55, 0.08), visSeatMat);
        vBack.position.set(0, 0.75, 0.24);
        vChairGrp.add(vBack);

        const vArmL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.52), visFrameMat);
        vArmL.position.set(-0.31, 0.64, 0);
        vChairGrp.add(vArmL);

        const vArmR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.52), visFrameMat);
        vArmR.position.set(0.31, 0.64, 0);
        vChairGrp.add(vArmR);

        const vLeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.44), visFrameMat);
        vLeg1.position.set(-0.26, 0.22, -0.22);
        vChairGrp.add(vLeg1);
        const vLeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.44), visFrameMat);
        vLeg2.position.set(0.26, 0.22, -0.22);
        vChairGrp.add(vLeg2);
        const vLeg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.44), visFrameMat);
        vLeg3.position.set(-0.26, 0.22, 0.22);
        vChairGrp.add(vLeg3);
        const vLeg4 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.44), visFrameMat);
        vLeg4.position.set(0.26, 0.22, 0.22);
        vChairGrp.add(vLeg4);

        scene.add(vChairGrp);
      });

      // 8. FOREGROUND POLKA-DOT PATTERNED LOUNGE SOFA (Matched to Photo)
      const sofaCanvas = document.createElement('canvas');
      sofaCanvas.width = 256;
      sofaCanvas.height = 256;
      const sfctx = sofaCanvas.getContext('2d');
      sfctx.fillStyle = '#F8FAFC';
      sfctx.fillRect(0, 0, 256, 256);
      sfctx.fillStyle = '#78350F';
      for (let x = 32; x < 256; x += 64) {
        for (let y = 32; y < 256; y += 64) {
          sfctx.beginPath();
          sfctx.arc(x, y, 14, 0, Math.PI * 2);
          sfctx.fill();
        }
      }
      const sofaTex = new THREE.CanvasTexture(sofaCanvas);
      sofaTex.wrapS = THREE.RepeatWrapping;
      sofaTex.wrapT = THREE.RepeatWrapping;
      sofaTex.repeat.set(4, 2);

      const sofaMat = new THREE.MeshStandardMaterial({ map: sofaTex, roughness: 0.7 });
      const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.38, 0.85), sofaMat);
      sofaBase.position.set(roomW / 2 - 1.6, 0.25, roomD / 2 - 1.8);
      sofaBase.rotation.y = -Math.PI / 6;
      scene.add(sofaBase);

      const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.18), sofaMat);
      sofaBack.position.set(roomW / 2 - 1.4, 0.65, roomD / 2 - 1.4);
      sofaBack.rotation.y = -Math.PI / 6;
      scene.add(sofaBack);

      // CCTV Camera in Top Corner
      const cctv = createCCTVCamera();
      cctv.position.set(-roomW / 2 + 0.4, roomH - 0.4, roomD / 2 - 0.4);
      cctv.rotation.y = Math.PI / 4;
      scene.add(cctv);

    } else if (isCivilDept) {
      // ══════════════════════════════════════════════════════════════════════════
      // 🏛️ CIVIL ENGINEERING DEPARTMENT SUITE & SEPARATE HOD CABIN — 3D VISUAL RECONSTRUCTION
      // Matched precisely to User Reference Photo
      // ══════════════════════════════════════════════════════════════════════════

      // 1. Light Beige/Cream Floor Tiles
      const floorCanvas = document.createElement('canvas');
      floorCanvas.width = 512;
      floorCanvas.height = 512;
      const fctx = floorCanvas.getContext('2d');
      fctx.fillStyle = '#FAF7F0';
      fctx.fillRect(0, 0, 512, 512);
      fctx.strokeStyle = '#E2DDD0';
      fctx.lineWidth = 1.5;
      for (let i = 0; i <= 512; i += 64) {
        fctx.moveTo(i, 0); fctx.lineTo(i, 512);
        fctx.moveTo(0, i); fctx.lineTo(512, i);
      }
      fctx.stroke();
      const floorTex = new THREE.CanvasTexture(floorCanvas);
      floorTex.wrapS = THREE.RepeatWrapping;
      floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(16, 14);

      const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.12, metalness: 0.05 });
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // White Ceiling
      const ceilMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.8 });
      const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilMat);
      ceilMesh.position.set(0, roomH, 0);
      ceilMesh.rotation.x = Math.PI / 2;
      scene.add(ceilMesh);

      // Recessed Spotlights
      const spotGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16);
      const spotLightMat = new THREE.MeshBasicMaterial({ color: 0xFFF7ED });
      [[-5, -3], [-5, 3], [0, -3], [0, 3], [5, -3], [5, 3]].forEach(([sx, sz]) => {
        const sm = new THREE.Mesh(spotGeom, spotLightMat);
        sm.position.set(sx, roomH - 0.01, sz);
        scene.add(sm);
        const pl = new THREE.PointLight(0xFFF1D6, 0.6, 8);
        pl.position.set(sx, roomH - 0.2, sz);
        scene.add(pl);
      });

      // 2. GLASS & METAL PARTITION WALL (Dividing HOD Cabin & Staff Room)
      const partX = -1.5;
      const partMat = new THREE.MeshStandardMaterial({ color: 0x93C5FD, transparent: true, opacity: 0.4, roughness: 0.1 });
      const partFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });

      // Solid lower wall panel
      const partLower = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, roomD - 3.0), partFrameMat);
      partLower.position.set(partX, 0.55, -1.5);
      scene.add(partLower);

      // Upper Glass panes
      const partGlass = new THREE.Mesh(new THREE.PlaneGeometry(roomD - 3.0, roomH - 1.1), partMat);
      partGlass.position.set(partX, 1.1 + (roomH - 1.1)/2, -1.5);
      partGlass.rotation.y = Math.PI / 2;
      scene.add(partGlass);

      // Doorway Frame over open door gap
      const doorArch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 2.5), partFrameMat);
      doorArch.position.set(partX, roomH - 0.1, roomD/2 - 1.25);
      scene.add(doorArch);

      // 3. ZONE A: CIVIL HOD SEPARATE CABIN (Left Side, Matched to Photo)
      // Warm Light Yellow/Beige Walls
      const hodWallMat = new THREE.MeshStandardMaterial({ color: 0xFEF9C3, roughness: 0.85 });
      
      const backWallHOD = new THREE.Mesh(new THREE.PlaneGeometry(roomW/2 - 1.5, roomH), hodWallMat);
      backWallHOD.position.set(-roomW/2 + (roomW/2 - 1.5)/2, roomH/2, -roomD/2);
      backWallHOD.receiveShadow = true;
      scene.add(backWallHOD);

      const leftWallHOD = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), hodWallMat);
      leftWallHOD.position.set(-roomW/2, roomH/2, 0);
      leftWallHOD.rotation.y = Math.PI / 2;
      leftWallHOD.receiveShadow = true;
      scene.add(leftWallHOD);

      // Windows with Silver Grills & Tan/Cream Fabric Curtains (Matched to Photo)
      const winW = 3.2;
      const winH = 2.2;
      const winFrameMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
      const barMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.8 });

      // Back Window
      const bWinFrame = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.2, winH + 0.2, 0.08), winFrameMat);
      bWinFrame.position.set(-4.5, 2.0, -roomD/2 + 0.04);
      scene.add(bWinFrame);

      for (let bx = -4.5 - winW/2 + 0.3; bx <= -4.5 + winW/2 - 0.3; bx += 0.4) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, winH), barMat);
        bar.position.set(bx, 2.0, -roomD/2 + 0.06);
        scene.add(bar);
      }

      // Full-length Tan Fabric Drapes (Matched to Photo)
      const drapeMat = new THREE.MeshStandardMaterial({ color: 0xD4A373, roughness: 0.8 });
      const drapeL = new THREE.Mesh(new THREE.BoxGeometry(0.65, winH + 0.4, 0.12), drapeMat);
      drapeL.position.set(-4.5 - winW/2 - 0.2, 1.9, -roomD/2 + 0.1);
      scene.add(drapeL);

      const drapeR = new THREE.Mesh(new THREE.BoxGeometry(0.65, winH + 0.4, 0.12), drapeMat);
      drapeR.position.set(-4.5 + winW/2 + 0.2, 1.9, -roomD/2 + 0.1);
      scene.add(drapeR);

      // Wall-Mounted Switchboard Box with Cable Conduit Wiring (Matched to Photo)
      const swBox = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.08), new THREE.MeshStandardMaterial({ color: 0xF8FAFC }));
      swBox.position.set(-roomW/2 + 0.06, 2.3, -2.8);
      scene.add(swBox);

      for (let w = -0.1; w <= 0.1; w += 0.05) {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.2), new THREE.MeshStandardMaterial({ color: 0x475569 }));
        wire.position.set(-roomW/2 + 0.07, 1.7, -2.8 + w);
        wire.rotation.z = Math.PI / 2;
        scene.add(wire);
      }

      // Two Tall Grey Steel Filing Cupboards behind HOD Desk (Matched to Photo)
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.5, metalness: 0.4 });
      for (let cx of [-5.2, -3.8]) {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.1, 0.55), steelMat);
        cab.position.set(cx, 1.05, -roomD/2 + 0.3);
        cab.castShadow = true;
        scene.add(cab);

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.04), new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.9 }));
        handle.position.set(cx + 0.1, 1.05, -roomD/2 + 0.6);
        scene.add(handle);
      }

      // HOD Executive Desk & Blue/Purple Glass Top Runner (Matched to Photo)
      const deskW = 3.4;
      const deskD = 1.8;
      const deskH = 0.78;
      const deskZ = -2.2;
      const deskX = -4.5;

      const hodDeskBase = new THREE.Mesh(new THREE.BoxGeometry(deskW, 0.08, deskD), new THREE.MeshStandardMaterial({ color: 0x3B1E08, roughness: 0.4 }));
      hodDeskBase.position.set(deskX, deskH, deskZ);
      hodDeskBase.castShadow = true;
      scene.add(hodDeskBase);

      const glassRunnerMat = new THREE.MeshStandardMaterial({ color: 0x8B5CF6, transparent: true, opacity: 0.65, roughness: 0.1 });
      const glassRunner = new THREE.Mesh(new THREE.PlaneGeometry(deskW - 0.2, deskD - 0.2), glassRunnerMat);
      glassRunner.position.set(deskX, deskH + 0.045, deskZ);
      glassRunner.rotation.x = -Math.PI / 2;
      scene.add(glassRunner);

      // Desk Leg Supports
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.1, deskH - 0.08, deskD - 0.1), new THREE.MeshStandardMaterial({ color: 0x27150C }));
      legL.position.set(deskX - deskW/2 + 0.08, (deskH - 0.08)/2, deskZ);
      scene.add(legL);

      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.1, deskH - 0.08, deskD - 0.1), new THREE.MeshStandardMaterial({ color: 0x27150C }));
      legR.position.set(deskX + deskW/2 - 0.08, (deskH - 0.08)/2, deskZ);
      scene.add(legR);

      // Seated Civil HOD Avatar in Light Blue Chair working on Pink Shirt (Matched to Photo)
      const hodChairMat = new THREE.MeshStandardMaterial({ color: 0x7DD3FC, roughness: 0.6 });
      const hodChairGrp = new THREE.Group();
      hodChairGrp.position.set(deskX, 0, deskZ - 0.9);

      const hodSeat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.1, 0.65), hodChairMat);
      hodSeat.position.y = 0.48;
      hodChairGrp.add(hodSeat);

      const hodBack = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.85, 0.1), hodChairMat);
      hodBack.position.set(0, 0.92, -0.28);
      hodChairGrp.add(hodBack);

      scene.add(hodChairGrp);

      const civilHodAvatar = createSeatedOfficial({
        suitColor: 0xF472B6, // Pink Collared Shirt (Matched to Photo)
        skinColor: 0xDAA520,
        hairColor: 0x111111,
        title: '👨‍🏫 CIVIL HOD',
        name: '',
        isPrincipal: false,
        headAngleY: 0,
        armGesture: true
      });
      civilHodAvatar.position.set(deskX, 0, deskZ - 0.9);
      scene.add(civilHodAvatar);

      // Laptop (Open Grey Laptop) on HOD Desk (Matched to Photo)
      const lapBase = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.02, 0.32), new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.8 }));
      lapBase.position.set(deskX, deskH + 0.06, deskZ - 0.1);
      scene.add(lapBase);

      const lapSc = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.02), new THREE.MeshStandardMaterial({ color: 0x0F172A }));
      lapSc.position.set(deskX, deskH + 0.2, deskZ - 0.25);
      lapSc.rotation.x = -Math.PI / 10;
      scene.add(lapSc);

      // Translucent Purple Water Bottle on Desk (Matched to Photo)
      const purpBotMat = new THREE.MeshPhysicalMaterial({ color: 0xA855F7, transparent: true, opacity: 0.75, roughness: 0.1, transmission: 0.8 });
      const purpBot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.24), purpBotMat);
      purpBot.position.set(deskX + 1.2, deskH + 0.16, deskZ + 0.3);
      scene.add(purpBot);

      // Desktop Printer (Grey All-in-One Printer on left desk)
      const printer = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.45), new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.4 }));
      printer.position.set(deskX - 1.1, deskH + 0.18, deskZ + 0.1);
      scene.add(printer);

      // Two Red Fabric Cushioned Visitor Chairs facing HOD Desk (Matched to Photo)
      const redSeatMat = new THREE.MeshStandardMaterial({ color: 0xDC2626, roughness: 0.6 });
      [-0.7, 0.7].forEach((rx) => {
        const vGrp = new THREE.Group();
        vGrp.position.set(deskX + rx, 0, deskZ + 1.35);
        vGrp.rotation.y = Math.PI;

        const s = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.52), redSeatMat);
        s.position.y = 0.44;
        vGrp.add(s);

        const b = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.08), redSeatMat);
        b.position.set(0, 0.72, 0.22);
        vGrp.add(b);

        scene.add(vGrp);
      });

      // 4. ZONE B: CIVIL FACULTY STAFF ROOM (Right Side)
      const staffWallMat = new THREE.MeshStandardMaterial({ color: 0xF5F5F4, roughness: 0.9 });
      const backWallStaff = new THREE.Mesh(new THREE.PlaneGeometry(roomW/2 + 1.5, roomH), staffWallMat);
      backWallStaff.position.set(1.5 + (roomW/2 - 1.5)/2, roomH/2, -roomD/2);
      scene.add(backWallStaff);

      const rightWallStaff = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), staffWallMat);
      rightWallStaff.position.set(roomW/2, roomH/2, 0);
      rightWallStaff.rotation.y = -Math.PI / 2;
      scene.add(rightWallStaff);

      // 4 Faculty Workstation Pods
      const staffDeskMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
      const staffScreenMat = new THREE.MeshStandardMaterial({ color: 0x2563EB, roughness: 0.5 });
      const monitorMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.3 });

      [[-2.2, 1.5], [1.8, 1.5], [-2.2, 5.0], [1.8, 5.0]].forEach(([sz, sx]) => {
        const podGrp = new THREE.Group();
        podGrp.position.set(sx, 0, sz);

        const d = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.8), staffDeskMat);
        d.position.y = 0.72;
        podGrp.add(d);

        const scr = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.38, 0.02), staffScreenMat);
        scr.position.set(0, 0.93, -0.39);
        podGrp.add(scr);

        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.03), monitorMat);
        mon.position.set(0, 0.98, -0.1);
        podGrp.add(mon);

        // Black Mesh Swivel Chair
        const c = createExecutiveChair(new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.6 }));
        c.position.set(0, 0, 0.55);
        podGrp.add(c);

        scene.add(podGrp);
      });

      // Civil Department Blueprint & Helmet Storage Rack
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.45), rackMat);
      rack.position.set(roomW/2 - 0.8, 0.9, -roomD/2 + 0.5);
      scene.add(rack);

      const helmetMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, roughness: 0.3 });
      for (let hx of [-0.3, 0.3]) {
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
        helmet.position.set(roomW/2 - 0.8 + hx, 1.85, -roomD/2 + 0.5);
        scene.add(helmet);
      }

      // CCTV Camera in Corner
      const cctv = createCCTVCamera();
      cctv.position.set(-roomW / 2 + 0.4, roomH - 0.4, roomD / 2 - 0.4);
      cctv.rotation.y = Math.PI / 4;
      scene.add(cctv);

    } else if (isFMLab) {
      // ══════════════════════════════════════════════════════════════════════════
      // 💧 FLUID MECHANICS LABORATORY — 3D VISUAL RECONSTRUCTION
      // Matched precisely to User Reference Photos 1, 2 & 3
      // ══════════════════════════════════════════════════════════════════════════

      // 1. Pale Aqua/Cyan Plaster Walls & Polished Terrazzo Floor
      const floorCanvas = document.createElement('canvas');
      floorCanvas.width = 512;
      floorCanvas.height = 512;
      const fctx = floorCanvas.getContext('2d');
      fctx.fillStyle = '#E2E8F0';
      fctx.fillRect(0, 0, 512, 512);
      fctx.strokeStyle = '#CBD5E1';
      fctx.lineWidth = 1;
      for (let i = 0; i <= 512; i += 64) {
        fctx.moveTo(i, 0); fctx.lineTo(i, 512);
        fctx.moveTo(0, i); fctx.lineTo(512, i);
      }
      fctx.stroke();
      const floorTex = new THREE.CanvasTexture(floorCanvas);
      floorTex.wrapS = THREE.RepeatWrapping;
      floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(17, 15);

      const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.15, metalness: 0.05 });
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // Pale Aqua Plaster Wall Material (Matched to Photos)
      const fmWallMat = new THREE.MeshStandardMaterial({ color: 0xCFFAFE, roughness: 0.85 });

      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), fmWallMat);
      backWall.position.set(0, roomH/2, -roomD/2);
      backWall.receiveShadow = true;
      scene.add(backWall);

      const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), fmWallMat);
      leftWall.position.set(-roomW/2, roomH/2, 0);
      leftWall.rotation.y = Math.PI / 2;
      leftWall.receiveShadow = true;
      scene.add(leftWall);

      const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), fmWallMat);
      rightWall.position.set(roomW/2, roomH/2, 0);
      rightWall.rotation.y = -Math.PI / 2;
      rightWall.receiveShadow = true;
      scene.add(rightWall);

      // Ceiling with 3-Blade Dark Brown Ceiling Fans & Suspended Tube Lights (Matched to Photo 2 & 3)
      const ceilMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.8 });
      const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilMat);
      ceilMesh.position.set(0, roomH, 0);
      ceilMesh.rotation.x = Math.PI / 2;
      scene.add(ceilMesh);

      const fanMat = new THREE.MeshStandardMaterial({ color: 0x451A03, roughness: 0.4 });
      [[-4, -3], [-4, 3], [2, -3], [2, 3], [6, 0]].forEach(([fx, fz]) => {
        const fanGrp = new THREE.Group();
        fanGrp.position.set(fx, roomH - 0.35, fz);

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35), fanMat);
        stem.position.y = 0.175;
        fanGrp.add(stem);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06), fanMat);
        fanGrp.add(hub);

        for (let a = 0; a < 3; a++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.01, 0.08), fanMat);
          blade.rotation.y = (a * Math.PI * 2) / 3;
          blade.position.set(Math.cos(blade.rotation.y)*0.3, 0, Math.sin(blade.rotation.y)*0.3);
          fanGrp.add(blade);
        }
        scene.add(fanGrp);
        fans.push(fanGrp);
      });

      // 2. EDUCATIONAL WALL CHARTS & DIAGRAMS (Back Wall - Matched to Photo 2 & 3)
      const chartMat = new THREE.MeshBasicMaterial({ color: 0xF8FAFC });
      const chartBorderMat = new THREE.MeshStandardMaterial({ color: 0x0284C7 });
      [1.5, 3.8, 6.1].forEach((cx) => {
        const chartFrame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 0.04), chartBorderMat);
        chartFrame.position.set(cx, 2.6, -roomD/2 + 0.04);
        scene.add(chartFrame);

        const chartFace = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.7), chartMat);
        chartFace.position.set(cx, 2.6, -roomD/2 + 0.065);
        scene.add(chartFace);
      });

      // Brown Plaid Fabric Windows on Right Wall (Matched to Photo 2 & 3)
      const plaidMat = new THREE.MeshStandardMaterial({ color: 0x92400E, roughness: 0.8 });
      [-3, 1, 4].forEach((wz) => {
        const wCurtain = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 1.1), plaidMat);
        wCurtain.position.set(roomW/2 - 0.1, 2.3, wz);
        scene.add(wCurtain);
      });

      // 3. ZONE 1: PUMPS & TURBINES TEST RIGS (Left Foreground - Matched to Photo 3)
      // Centrifugal Pump Test Rig with Dark Blue Electric Motor
      const pumpGrp = new THREE.Group();
      pumpGrp.position.set(-5.5, 0, 3.5);

      const motorMat = new THREE.MeshStandardMaterial({ color: 0x1E40AF, roughness: 0.3, metalness: 0.6 });
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.7), motorMat);
      motor.rotation.z = Math.PI / 2;
      motor.position.set(0, 0.45, 0);
      pumpGrp.add(motor);

      const pumpCasing = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.22), new THREE.MeshStandardMaterial({ color: 0x1E3A8A, metalness: 0.7 }));
      pumpCasing.position.set(0.45, 0.45, 0);
      pumpGrp.add(pumpCasing);

      // Steel Pipe Loop leading to Dial Pressure Gauges
      const pipeMat = new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.8, roughness: 0.2 });
      const pipeVert = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8), pipeMat);
      pipeVert.position.set(0.45, 1.3, 0);
      pumpGrp.add(pipeVert);

      const pipeHoriz = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5), pipeMat);
      pipeHoriz.rotation.z = Math.PI / 2;
      pipeHoriz.position.set(-0.3, 2.2, 0);
      pumpGrp.add(pipeHoriz);

      // Dial Gauge
      const gaugeFace = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
      gaugeFace.rotation.x = Math.PI / 2;
      gaugeFace.position.set(-0.3, 2.2, 0.08);
      pumpGrp.add(gaugeFace);

      scene.add(pumpGrp);

      // Francis Turbine / Pelton Wheel Rig with Blue Casing & Control Panel (Matched to Photo 3)
      const turbineGrp = new THREE.Group();
      turbineGrp.position.set(-5.5, 0, -0.5);

      const turbBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x334155 }));
      turbBase.position.y = 0.25;
      turbineGrp.add(turbBase);

      const turbCasing = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3), new THREE.MeshStandardMaterial({ color: 0x2563EB, metalness: 0.5 }));
      turbCasing.position.set(0, 0.8, 0);
      turbineGrp.add(turbCasing);

      // Control Panel Box with switches and gauges
      const panelBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.22), new THREE.MeshStandardMaterial({ color: 0xF1F5F9, roughness: 0.3 }));
      panelBox.position.set(0, 1.25, 0.5);
      turbineGrp.add(panelBox);

      scene.add(turbineGrp);

      // Double-Door Grey Steel Cabinets on Left Wall (Matched to Photo 3)
      for (let cz of [-3.8, -2.4]) {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.1, 1.2), new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.5, metalness: 0.4 }));
        cab.position.set(-roomW/2 + 0.35, 1.05, cz);
        scene.add(cab);
      }

      // Wall Clock & Framed Portrait on Left Pillar (Matched to Photo 3)
      const clockMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
      clockMesh.position.set(-roomW/2 + 0.05, 3.2, -4.5);
      scene.add(clockMesh);

      const portraitMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.35), new THREE.MeshStandardMaterial({ color: 0x78350F }));
      portraitMesh.position.set(-roomW/2 + 0.05, 2.5, -4.5);
      scene.add(portraitMesh);

      // 4. ZONE 2: HYDRAULIC FLUMES & MANOMETER RIGS (Right & Center - Matched to Photo 2)
      // Long Slate Blue Test Channel / Flume (Venturimeter & Orifice Meter)
      const flumeGrp = new THREE.Group();
      flumeGrp.position.set(1.0, 0, 0);

      const flumeChan = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 4.2), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3 }));
      flumeChan.position.y = 0.8;
      flumeGrp.add(flumeChan);

      // Blue Overhead Supply Pipes
      const bluePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.2), new THREE.MeshStandardMaterial({ color: 0x0284C7, metalness: 0.6 }));
      bluePipe.position.set(0, 1.6, 0);
      flumeGrp.add(bluePipe);

      // Water Measuring Collection Tank with Scale
      const tankMat = new THREE.MeshStandardMaterial({ color: 0x0284C7, roughness: 0.3, transparent: true, opacity: 0.85 });
      const tank = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.85, 1.4), tankMat);
      tank.position.set(0, 0.435, 2.6);
      flumeGrp.add(tank);

      scene.add(flumeGrp);

      // Bernoulli & Reynolds Dye Flow Tube Rig (Center Right)
      const bernGrp = new THREE.Group();
      bernGrp.position.set(4.5, 0, -1.0);

      const bernFrame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), new THREE.MeshStandardMaterial({ color: 0x64748B }));
      bernFrame.position.y = 0.8;
      bernGrp.add(bernFrame);

      // Vertical Glass Tube with Red Dye Injection Pot
      const glassTube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), new THREE.MeshPhysicalMaterial({ color: 0xE0F2FE, transparent: true, opacity: 0.4, transmission: 0.9 }));
      glassTube.position.set(0, 1.0, 0);
      bernGrp.add(glassTube);

      const dyePot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16), new THREE.MeshStandardMaterial({ color: 0xDC2626 }));
      dyePot.position.set(0, 1.7, 0);
      bernGrp.add(dyePot);

      scene.add(bernGrp);

      // 5. ZONE 3: BLACKBOARD LECTURE AREA & INSTRUCTOR DESK (Matched to Photos 1, 2 & 3)
      // Blackboard with Realistic Chalk Writings & Hydraulic Equations (Matched to Photo 1)
      const boardW = 3.6;
      const boardH = 1.8;
      const bbFrame = new THREE.Mesh(new THREE.BoxGeometry(boardW + 0.15, boardH + 0.15, 0.06), new THREE.MeshStandardMaterial({ color: 0x38240D }));
      bbFrame.position.set(-1.0, 2.3, -roomD/2 + 0.04);
      scene.add(bbFrame);

      const bbCanvas = document.createElement('canvas');
      bbCanvas.width = 1024;
      bbCanvas.height = 512;
      const bbCtx = bbCanvas.getContext('2d');
      bbCtx.fillStyle = '#0F172A';
      bbCtx.fillRect(0, 0, 1024, 512);

      // Chalk equations & title
      bbCtx.font = 'bold 32px monospace';
      bbCtx.fillStyle = '#F8FAFC';
      bbCtx.fillText('FLUID MECHANICS LAB: BERNOULLI & VENTURIMETER', 40, 60);

      bbCtx.font = '26px monospace';
      bbCtx.fillStyle = '#E2E8F0';
      bbCtx.fillText('1. Bernoulli: P1/γ + v1²/2g + z1 = P2/γ + v2²/2g + z2', 40, 130);
      bbCtx.fillText('2. Discharge Q = Cd · [A1·A2 / √(A1² - A2²)] · √(2gΔh)', 40, 200);
      bbCtx.fillText('3. Reynolds No: Re = (ρ · v · D) / μ  [Laminar < 2000]', 40, 270);
      bbCtx.fillText('4. Friction Loss hf = (4f · L · v²) / (2g · D)', 40, 340);

      // Venturimeter Diagram
      bbCtx.strokeStyle = '#38BDF8';
      bbCtx.lineWidth = 4;
      bbCtx.beginPath();
      bbCtx.moveTo(680, 380); bbCtx.lineTo(760, 380); bbCtx.lineTo(810, 410); bbCtx.lineTo(920, 410);
      bbCtx.moveTo(680, 490); bbCtx.lineTo(760, 490); bbCtx.lineTo(810, 460); bbCtx.lineTo(920, 460);
      bbCtx.stroke();
      bbCtx.fillStyle = '#F59E0B';
      bbCtx.fillText('Throat', 815, 440);

      const bbTex = new THREE.CanvasTexture(bbCanvas);
      const bbFace = new THREE.Mesh(new THREE.PlaneGeometry(boardW, boardH), new THREE.MeshStandardMaterial({ map: bbTex, roughness: 0.85 }));
      bbFace.position.set(-1.0, 2.3, -roomD/2 + 0.075);
      scene.add(bbFace);

      // Red Wall Fire Extinguisher (Matched to Photo 1)
      const exting = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0xDC2626 }));
      exting.position.set(1.4, 2.1, -roomD/2 + 0.12);
      scene.add(exting);

      // Multi-Tube Differential Pressure Manometer Stand (Matched to Photo 2)
      const manoStandGrp = new THREE.Group();
      manoStandGrp.position.set(3.2, 0, -2.8);

      const manoBoard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.08), new THREE.MeshStandardMaterial({ color: 0xD4A373, roughness: 0.6 }));
      manoBoard.position.y = 1.2;
      manoStandGrp.add(manoBoard);

      for (let mx = -0.4; mx <= 0.4; mx += 0.16) {
        const glassT = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3), new THREE.MeshPhysicalMaterial({ color: 0xE0F2FE, transparent: true, opacity: 0.5, transmission: 0.9 }));
        glassT.position.set(mx, 1.2, 0.06);
        manoStandGrp.add(glassT);

        // Fluid Level Inside Tube
        const fluidH = 0.3 + Math.abs(Math.sin(mx * 10)) * 0.7;
        const fluidCol = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, fluidH), new THREE.MeshStandardMaterial({ color: 0xDC2626 }));
        fluidCol.position.set(mx, 0.65 + fluidH/2, 0.065);
        manoStandGrp.add(fluidCol);
      }
      scene.add(manoStandGrp);

      // Realistic Physical Water Material for Flume & Measuring Tanks
      const realWaterMat = new THREE.MeshPhysicalMaterial({
        color: 0x0EA5E9,
        transmission: 0.88,
        opacity: 0.8,
        transparent: true,
        roughness: 0.05,
        ior: 1.333,
        thickness: 0.4
      });

      const tankWater = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.6, 1.35), realWaterMat);
      tankWater.position.set(1.0, 0.5, 2.6);
      scene.add(tankWater);

      // Instructor Desk with White & Red Lever-Arch Binders (Matched to Photos 2 & 3)
      const instDeskX = 2.0;
      const instDeskZ = 3.2;
      const instDesk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.76, 0.9), new THREE.MeshStandardMaterial({ color: 0x78350F, roughness: 0.5 }));
      instDesk.position.set(instDeskX, 0.38, instDeskZ);
      scene.add(instDesk);

      // Stacked Lever-Arch Binders (White with Red Spines - Matched to Photos 2 & 3)
      const binder1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.08), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
      binder1.position.set(instDeskX - 0.4, 0.92, instDeskZ - 0.1);
      scene.add(binder1);

      const binderSpine1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.02), new THREE.MeshStandardMaterial({ color: 0xDC2626 }));
      binderSpine1.position.set(instDeskX - 0.4, 0.92, instDeskZ - 0.05);
      scene.add(binderSpine1);

      // Seated Instructor Avatar in Cream Shirt (Matched to Photos 2 & 3)
      const instChair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0xD4A373 }));
      instChair.position.set(instDeskX, 0.4, instDeskZ - 0.7);
      scene.add(instChair);

      const instAvatar = createSeatedOfficial({
        suitColor: 0xFEF08A, // Light Cream Shirt (Matched to Photo)
        skinColor: 0xDAA520,
        hairColor: 0x111111,
        title: '👨‍🏫 INSTRUCTOR',
        name: '',
        isPrincipal: false,
        headAngleY: 0,
        armGesture: true
      });
      instAvatar.position.set(instDeskX, 0, instDeskZ - 0.7);
      scene.add(instAvatar);

      // Bright Blue Steel Storage Cabinet & Cardboard Box (Matched to Photo 1)
      const blueCab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.6), new THREE.MeshStandardMaterial({ color: 0x2563EB, roughness: 0.4 }));
      blueCab.position.set(-4.2, 1.0, -roomD/2 + 0.35);
      scene.add(blueCab);

      const cardBox = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.5), new THREE.MeshStandardMaterial({ color: 0xD97706, roughness: 0.9 }));
      cardBox.position.set(-4.2, 2.225, -roomD/2 + 0.35);
      scene.add(cardBox);

      // 4 Rows of Wooden Dual Benches & Seated Students (Matched to Photo 1)
      const benchMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.6 });
      const studentShirtColors = [0x2563EB, 0xDC2626, 0x16A34A, 0xF59E0B, 0x9333EA, 0x0D9488];

      for (let r = 0; r < 4; r++) {
        const bz = -2.5 + r * 1.5;
        const benchGrp = new THREE.Group();
        benchGrp.position.set(-1.0, 0, bz);

        const bTable = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.72, 0.48), benchMat);
        bTable.position.y = 0.36;
        benchGrp.add(bTable);

        const bSeat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.42, 0.35), benchMat);
        bSeat.position.set(0, 0.21, 0.55);
        benchGrp.add(bSeat);

        scene.add(benchGrp);

        // Seated Student Avatars
        if (r < 3) {
          [-0.6, 0.6].forEach((sx, idx) => {
            const stColor = studentShirtColors[(r * 2 + idx) % studentShirtColors.length];
            const stAvatar = createSeatedOfficial({
              suitColor: stColor,
              skinColor: 0xD97706,
              hairColor: 0x1E293B,
              title: `STUDENT S${r*2 + idx + 1}`,
              name: '',
              isPrincipal: false,
              headAngleY: 0,
              armGesture: false
            });
            stAvatar.position.set(-1.0 + sx, 0, bz + 0.55);
            scene.add(stAvatar);
          });
        }
      }

      // Standing 3D Teacher Avatar at the Blackboard/Rig Teaching
      const teacherName = scheduleData?.current_entry?.faculty_name || scheduleData?.faculty_name || scheduleData?.faculty || scheduleData?.teacher || 'Dr. V. Shiva Chandra';
      const teacherAvatar = createSeatedOfficial({
        suitColor: 0x1E40AF, // Blue Shirt
        skinColor: 0xD97706,
        hairColor: 0x1E293B,
        title: '👨‍🏫 FLUID MECHANICS PROFESSOR',
        name: teacherName,
        isPrincipal: true,
        headAngleY: Math.PI / 4,
        armGesture: true
      });
      teacherAvatar.position.set(-1.0, 0, -4.8);
      scene.add(teacherAvatar);

      // CCTV Camera in Top Corner
      const cctv = createCCTVCamera();
      cctv.position.set(-roomW / 2 + 0.4, roomH - 0.4, roomD / 2 - 0.4);
      cctv.rotation.y = Math.PI / 4;
      scene.add(cctv);

    } else if (isEELab) {
      // ══════════════════════════════════════════════════════════════════════════
      // 🌿 ENVIRONMENTAL ENGINEERING LABORATORY — 3D VISUAL RECONSTRUCTION
      // Matched precisely to User Reference Photos 1, 2 & 3
      // ══════════════════════════════════════════════════════════════════════════

      // 1. Pale Mint/Aqua Plaster Walls & Polished Light Grey Floor
      const floorCanvas = document.createElement('canvas');
      floorCanvas.width = 512;
      floorCanvas.height = 512;
      const fctx = floorCanvas.getContext('2d');
      fctx.fillStyle = '#E2E8F0';
      fctx.fillRect(0, 0, 512, 512);
      fctx.strokeStyle = '#CBD5E1';
      fctx.lineWidth = 1.5;
      for (let i = 0; i <= 512; i += 64) {
        fctx.moveTo(i, 0); fctx.lineTo(i, 512);
        fctx.moveTo(0, i); fctx.lineTo(512, i);
      }
      fctx.stroke();
      const floorTex = new THREE.CanvasTexture(floorCanvas);
      floorTex.wrapS = THREE.RepeatWrapping;
      floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(17, 15);

      const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.15, metalness: 0.05 });
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // Pale Mint/Aqua Plaster Wall Material (Matched to Photos 1, 2 & 3)
      const eeWallMat = new THREE.MeshStandardMaterial({ color: 0xECFDF5, roughness: 0.85 });

      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), eeWallMat);
      backWall.position.set(0, roomH/2, -roomD/2);
      backWall.receiveShadow = true;
      scene.add(backWall);

      const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), eeWallMat);
      leftWall.position.set(-roomW/2, roomH/2, 0);
      leftWall.rotation.y = Math.PI / 2;
      leftWall.receiveShadow = true;
      scene.add(leftWall);

      const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), eeWallMat);
      rightWall.position.set(roomW/2, roomH/2, 0);
      rightWall.rotation.y = -Math.PI / 2;
      rightWall.receiveShadow = true;
      scene.add(rightWall);

      // Ceiling with 3-Blade Dark Brown Ceiling Fans & Suspended Tube Lights (Matched to Photos)
      const ceilMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.8 });
      const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilMat);
      ceilMesh.position.set(0, roomH, 0);
      ceilMesh.rotation.x = Math.PI / 2;
      scene.add(ceilMesh);

      const fanMat = new THREE.MeshStandardMaterial({ color: 0x451A03, roughness: 0.4 });
      [[-4, -3], [-4, 3], [2, -3], [2, 3], [6, 0]].forEach(([fx, fz]) => {
        const fanGrp = new THREE.Group();
        fanGrp.position.set(fx, roomH - 0.35, fz);

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35), fanMat);
        stem.position.y = 0.175;
        fanGrp.add(stem);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06), fanMat);
        fanGrp.add(hub);

        for (let a = 0; a < 3; a++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.01, 0.08), fanMat);
          blade.rotation.y = (a * Math.PI * 2) / 3;
          blade.position.set(Math.cos(blade.rotation.y)*0.3, 0, Math.sin(blade.rotation.y)*0.3);
          fanGrp.add(blade);
        }
        scene.add(fanGrp);
        fans.push(fanGrp);
      });

      // Brown Plaid Fabric Windows on Right Wall (Matched to Photo 1 & 2)
      const plaidMat = new THREE.MeshStandardMaterial({ color: 0x92400E, roughness: 0.8 });
      [-3, 1, 4].forEach((wz) => {
        const wCurtain = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 1.1), plaidMat);
        wCurtain.position.set(roomW/2 - 0.1, 2.3, wz);
        scene.add(wCurtain);
      });

      // 2. ZONE 1: LONG WHITE CERAMIC TILED LABORATORY ISLAND BENCH (Matched to Photo 2)
      const islandGrp = new THREE.Group();
      islandGrp.position.set(4.5, 0, 0);

      // Concrete Counter Base
      const cBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.82, 10.5), new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.7 }));
      cBase.position.y = 0.41;
      islandGrp.add(cBase);

      // White Ceramic Tile Top
      const tileTopCanvas = document.createElement('canvas');
      tileTopCanvas.width = 512; tileTopCanvas.height = 512;
      const tctx = tileTopCanvas.getContext('2d');
      tctx.fillStyle = '#FFFFFF'; tctx.fillRect(0, 0, 512, 512);
      tctx.strokeStyle = '#E2E8F0'; tctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 32) {
        tctx.moveTo(i, 0); tctx.lineTo(i, 512);
        tctx.moveTo(0, i); tctx.lineTo(512, i);
      }
      tctx.stroke();
      const tileTopTex = new THREE.CanvasTexture(tileTopCanvas);
      tileTopTex.wrapS = THREE.RepeatWrapping; tileTopTex.wrapT = THREE.RepeatWrapping;
      tileTopTex.repeat.set(4, 20);

      const tileTopMat = new THREE.MeshStandardMaterial({ map: tileTopTex, roughness: 0.1, metalness: 0.05 });
      const tileTop = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.08, 10.56), tileTopMat);
      tileTop.position.y = 0.86;
      islandGrp.add(tileTop);

      // Integrated Ceramic Sinks & Swan-Neck Chrome Faucets
      const sinkMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.2 });
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.95, roughness: 0.1 });

      [-3.5, 0, 3.5].forEach((sz) => {
        const sink = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.25, 0.55), sinkMat);
        sink.position.set(0, 0.75, sz);
        islandGrp.add(sink);

        // Chrome Swan-Neck Faucet
        const f1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.32), chromeMat);
        f1.position.set(0, 1.05, sz - 0.22);
        islandGrp.add(f1);

        const f2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18), chromeMat);
        f2.rotation.x = Math.PI / 2;
        f2.position.set(0, 1.2, sz - 0.13);
        islandGrp.add(f2);
      });

      // Chemical Reagent Bottles on Island Bench (Clear & Amber Bottles)
      const clearGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.5, transmission: 0.9 });
      const amberGlassMat = new THREE.MeshPhysicalMaterial({ color: 0xD97706, transparent: true, opacity: 0.6, transmission: 0.8 });

      for (let bz = -4.0; bz <= 4.0; bz += 1.2) {
        const botMat = bz % 2 === 0 ? clearGlassMat : amberGlassMat;
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.18), botMat);
        bottle.position.set(-0.5, 0.99, bz);
        islandGrp.add(bottle);
      }

      scene.add(islandGrp);

      // 3. ZONE 2: ENVIRONMENTAL ANALYTICAL INSTRUMENTS (Matched to Photo 3)
      // 6-Spindle Jar Test Flocculator Apparatus (Key Environmental Equipment - Matched to Photo 3)
      const jarTestGrp = new THREE.Group();
      jarTestGrp.position.set(-5.0, 0, 0);

      const jarBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.65), new THREE.MeshStandardMaterial({ color: 0x1E293B }));
      jarBase.position.y = 0.8;
      jarTestGrp.add(jarBase);

      const jarTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.45), new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.3 }));
      jarTop.position.set(0, 1.45, -0.1);
      jarTestGrp.add(jarTop);

      // 6 Vertical Stainless Steel Stirrer Rods & Glass Beakers with Water Samples
      for (let i = 0; i < 6; i++) {
        const jx = -0.65 + i * 0.26;

        // Stirrer Rod
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6), chromeMat);
        rod.position.set(jx, 1.15, -0.1);
        jarTestGrp.add(rod);

        // Glass Beaker
        const beaker = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24), clearGlassMat);
        beaker.position.set(jx, 0.98, -0.1);
        jarTestGrp.add(beaker);

        // Water Sample Inside Beaker
        const wSamp = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.18), new THREE.MeshStandardMaterial({ color: 0x0EA5E9, transparent: true, opacity: 0.7 }));
        wSamp.position.set(jx, 0.95, -0.1);
        jarTestGrp.add(wSamp);
      }

      scene.add(jarTestGrp);

      // Digital pH Meter & Turbidimeter on Workbench (Matched to Photo 3)
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.76, 0.8), new THREE.MeshStandardMaterial({ color: 0x78350F, roughness: 0.5 }));
      bench.position.set(-5.0, 0.38, 3.0);
      scene.add(bench);

      const phMeter = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.28), new THREE.MeshStandardMaterial({ color: 0xF1F5F9 }));
      phMeter.position.set(-5.2, 0.84, 2.9);
      scene.add(phMeter);

      const phArm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.25), chromeMat);
      phArm.position.set(-5.0, 0.92, 3.0);
      scene.add(phArm);

      // Blue BOD Incubator Cabinet & Silver Sample Storage Refrigerator (Matched to Photos 1, 2 & 3)
      const bodIncubator = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.75), new THREE.MeshStandardMaterial({ color: 0x0284C7, roughness: 0.3 }));
      bodIncubator.position.set(-roomW/2 + 0.5, 0.9, -2.5);
      scene.add(bodIncubator);

      const fridge = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.9, 0.8), new THREE.MeshStandardMaterial({ color: 0xCBD5E1, metalness: 0.8, roughness: 0.2 }));
      fridge.position.set(-roomW/2 + 0.5, 0.95, -4.2);
      scene.add(fridge);

      // Grey Steel Storage Cabinets on Back Wall (Matched to Photo 1 & 2)
      for (let cx of [2.0, 3.4]) {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.55), new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.5, metalness: 0.4 }));
        cab.position.set(cx, 1.05, -roomD/2 + 0.3);
        scene.add(cab);
      }

      // 4. ZONE 3: BLACKBOARD LECTURE AREA & OVAL WALL CLOCK (Matched to Photo 1 & 2)
      // Large Wall Blackboard framed in dark wood
      const boardW = 3.6;
      const boardH = 1.8;
      const bbFrame = new THREE.Mesh(new THREE.BoxGeometry(boardW + 0.15, boardH + 0.15, 0.06), new THREE.MeshStandardMaterial({ color: 0x38240D }));
      bbFrame.position.set(-1.0, 2.3, -roomD/2 + 0.04);
      scene.add(bbFrame);

      const bbCanvas = document.createElement('canvas');
      bbCanvas.width = 1024; bbCanvas.height = 512;
      const bbCtx = bbCanvas.getContext('2d');
      bbCtx.fillStyle = '#0F172A'; bbCtx.fillRect(0, 0, 1024, 512);

      bbCtx.font = 'bold 32px monospace'; bbCtx.fillStyle = '#F8FAFC';
      bbCtx.fillText('ENVIRONMENTAL ENG LAB: WATER QUALITY ANALYSIS', 40, 60);

      bbCtx.font = '26px monospace'; bbCtx.fillStyle = '#E2E8F0';
      bbCtx.fillText('1. pH Scale & Alkalinity: pH = -log[H+]', 40, 130);
      bbCtx.fillText('2. Turbidity (NTU): Nephelometric Scatter Test', 40, 200);
      bbCtx.fillText('3. Jar Test Coagulation: Optimum Alum Dosage (mg/L)', 40, 270);
      bbCtx.fillText('4. BOD5 Test: BOD5 = (D1 - D2) / P [at 20°C Incubation]', 40, 340);

      const bbTex = new THREE.CanvasTexture(bbCanvas);
      const bbFace = new THREE.Mesh(new THREE.PlaneGeometry(boardW, boardH), new THREE.MeshStandardMaterial({ map: bbTex, roughness: 0.85 }));
      bbFace.position.set(-1.0, 2.3, -roomD/2 + 0.075);
      scene.add(bbFace);

      // Oval Wall Clock Mounted Directly Above Blackboard (Matched to Photo 2)
      const clockFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0xD4A373 }));
      clockFrame.rotation.x = Math.PI / 2;
      clockFrame.position.set(-1.0, 3.45, -roomD/2 + 0.05);
      scene.add(clockFrame);

      const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: 0xFFFFFF }));
      clockFace.position.set(-1.0, 3.45, -roomD/2 + 0.075);
      scene.add(clockFace);

      // 4 Rows of Light Wood Dual Benches & Seated Students (Matched to Photos 1 & 2)
      const lightBenchMat = new THREE.MeshStandardMaterial({ color: 0xFDE68A, roughness: 0.5 });
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });
      const studentShirtColors = [0x2563EB, 0xDC2626, 0x16A34A, 0xF59E0B, 0x9333EA, 0x0D9488];

      for (let r = 0; r < 4; r++) {
        const bz = -2.5 + r * 1.5;
        const benchGrp = new THREE.Group();
        benchGrp.position.set(-1.0, 0, bz);

        const bTable = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.72, 0.48), lightBenchMat);
        bTable.position.y = 0.36;
        benchGrp.add(bTable);

        const bSeat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.42, 0.35), lightBenchMat);
        bSeat.position.set(0, 0.21, 0.55);
        benchGrp.add(bSeat);

        // Metal Leg Frame
        const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.8), frameMat);
        l1.position.set(-1.0, 0.36, 0.25);
        benchGrp.add(l1);

        const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.8), frameMat);
        l2.position.set(1.0, 0.36, 0.25);
        benchGrp.add(l2);

        scene.add(benchGrp);

        // Seated Student Avatars
        if (r < 3) {
          [-0.6, 0.6].forEach((sx, idx) => {
            const stColor = studentShirtColors[(r * 2 + idx) % studentShirtColors.length];
            const stAvatar = createSeatedOfficial({
              suitColor: stColor,
              skinColor: 0xD97706,
              hairColor: 0x1E293B,
              title: `STUDENT S${r*2 + idx + 1}`,
              name: '',
              isPrincipal: false,
              headAngleY: 0,
              armGesture: false
            });
            stAvatar.position.set(-1.0 + sx, 0, bz + 0.55);
            scene.add(stAvatar);
          });
        }
      }

      // Standing 3D Teacher Avatar at the Blackboard
      const teacherName = scheduleData?.current_entry?.faculty_name || scheduleData?.faculty_name || scheduleData?.faculty || scheduleData?.teacher || 'Dr. C. Arvind Kumar';
      const teacherAvatar = createSeatedOfficial({
        suitColor: 0x047857, // Emerald Green Shirt
        skinColor: 0xD97706,
        hairColor: 0x1E293B,
        title: '👨‍🏫 ENVIRONMENTAL PROFESSOR',
        name: teacherName,
        isPrincipal: true,
        headAngleY: Math.PI / 4,
        armGesture: true
      });
      teacherAvatar.position.set(-1.0, 0, -4.8);
      scene.add(teacherAvatar);

      // CCTV Camera in Top Corner
      const cctv = createCCTVCamera();
      cctv.position.set(-roomW / 2 + 0.4, roomH - 0.4, roomD / 2 - 0.4);
      cctv.rotation.y = Math.PI / 4;
      scene.add(cctv);

    } else if (isCTLab) {
      // ══════════════════════════════════════════════════════════════════════════
      // 🏗️ CONCRETE TECHNOLOGY LABORATORY — HYPER-REALISTIC 3D RECONSTRUCTION
      // Matched precisely to User Reference Photos 1, 2, 3, 4 & 5
      // ══════════════════════════════════════════════════════════════════════════

      // 1. Pale Aqua/Cyan Plaster Walls & Polished Light Grey Floor
      const floorCanvas = document.createElement('canvas');
      floorCanvas.width = 512;
      floorCanvas.height = 512;
      const fctx = floorCanvas.getContext('2d');
      fctx.fillStyle = '#E2E8F0';
      fctx.fillRect(0, 0, 512, 512);
      fctx.strokeStyle = '#CBD5E1';
      fctx.lineWidth = 1.5;
      for (let i = 0; i <= 512; i += 64) {
        fctx.moveTo(i, 0); fctx.lineTo(i, 512);
        fctx.moveTo(0, i); fctx.lineTo(512, i);
      }
      fctx.stroke();
      const floorTex = new THREE.CanvasTexture(floorCanvas);
      floorTex.wrapS = THREE.RepeatWrapping;
      floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(17, 15);

      const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.15, metalness: 0.05 });
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // Pale Aqua Plaster Wall Material (Matched to Photos 1, 2, 3, 4 & 5)
      const ctWallMat = new THREE.MeshStandardMaterial({ color: 0xCFFAFE, roughness: 0.85 });

      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), ctWallMat);
      backWall.position.set(0, roomH/2, -roomD/2);
      backWall.receiveShadow = true;
      scene.add(backWall);

      const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), ctWallMat);
      leftWall.position.set(-roomW/2, roomH/2, 0);
      leftWall.rotation.y = Math.PI / 2;
      leftWall.receiveShadow = true;
      scene.add(leftWall);

      const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), ctWallMat);
      rightWall.position.set(roomW/2, roomH/2, 0);
      rightWall.rotation.y = -Math.PI / 2;
      rightWall.receiveShadow = true;
      scene.add(rightWall);

      // Ceiling with 3-Blade Dark Brown Ceiling Fans & Suspended Tube Lights
      const ceilMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.8 });
      const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilMat);
      ceilMesh.position.set(0, roomH, 0);
      ceilMesh.rotation.x = Math.PI / 2;
      scene.add(ceilMesh);

      const fanMat = new THREE.MeshStandardMaterial({ color: 0x451A03, roughness: 0.4 });
      [[-4, -3], [-4, 3], [2, -3], [2, 3], [6, 0]].forEach(([fx, fz]) => {
        const fanGrp = new THREE.Group();
        fanGrp.position.set(fx, roomH - 0.35, fz);

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35), fanMat);
        stem.position.y = 0.175;
        fanGrp.add(stem);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06), fanMat);
        fanGrp.add(hub);

        for (let a = 0; a < 3; a++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.01, 0.08), fanMat);
          blade.rotation.y = (a * Math.PI * 2) / 3;
          blade.position.set(Math.cos(blade.rotation.y)*0.3, 0, Math.sin(blade.rotation.y)*0.3);
          fanGrp.add(blade);
        }
        scene.add(fanGrp);
        fans.push(fanGrp);
      });

      // Brown Plaid Fabric Windows on Right Wall (Matched to Photos 1, 2, 3 & 5)
      const plaidMat = new THREE.MeshStandardMaterial({ color: 0x92400E, roughness: 0.8 });
      [-3, 1, 4].forEach((wz) => {
        const wCurtain = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 1.1), plaidMat);
        wCurtain.position.set(roomW/2 - 0.1, 2.3, wz);
        scene.add(wCurtain);
      });

      // 2. ZONE 1: UNIVERSAL COMPRESSION TESTING MACHINE (UTM - 2000kN) & ANALOG DIAL CONSOLE (Photo 4 Matched)
      const utmGrp = new THREE.Group();
      utmGrp.position.set(-5.2, 0, -1.0);

      // Heavy 4-Column Dark Green Steel Loading Frame
      const utmSteelMat = new THREE.MeshStandardMaterial({ color: 0x065F46, metalness: 0.85, roughness: 0.15 });
      const chromeColMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.95, roughness: 0.05 });

      const utmBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 1.2), utmSteelMat);
      utmBase.position.y = 0.225;
      utmGrp.add(utmBase);

      const utmCross = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.2), utmSteelMat);
      utmCross.position.y = 2.4;
      utmGrp.add(utmCross);

      // 4 Solid Chrome Tie-Rod Columns
      [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]].forEach(([cx, cz]) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 2.2, 24), chromeColMat);
        col.position.set(cx, 1.3, cz);
        utmGrp.add(col);
      });

      // Hydraulic Compression Platens & Concrete Test Cube Specimen
      const platenMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.9, roughness: 0.1 });
      const lowerPlaten = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.7), platenMat);
      lowerPlaten.position.set(0, 0.9, 0);
      utmGrp.add(lowerPlaten);

      const upperPlaten = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.7), platenMat);
      upperPlaten.position.set(0, 1.6, 0);
      utmGrp.add(upperPlaten);

      // 150mm Concrete Cube Specimen undergoing test
      const testCube = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.9 }));
      testCube.position.set(0, 1.175, 0);
      utmGrp.add(testCube);

      // Analog Dial Gauge Console Cabinet (Photo 4 Matched)
      const consoleMat = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.35 });
      const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.7), consoleMat);
      consoleBox.position.set(1.5, 0.9, 0);
      utmGrp.add(consoleBox);

      // Canvas-rendered Dial Gauge for 2000 kN UTM Machine Console
      const dialCanvas = document.createElement('canvas');
      dialCanvas.width = 512; dialCanvas.height = 512;
      const dctx = dialCanvas.getContext('2d');
      dctx.fillStyle = '#FFFFFF'; dctx.beginPath(); dctx.arc(256, 256, 240, 0, Math.PI*2); dctx.fill();
      dctx.strokeStyle = '#1E293B'; dctx.lineWidth = 8; dctx.stroke();

      dctx.strokeStyle = '#0F172A'; dctx.lineWidth = 4;
      dctx.beginPath(); dctx.arc(256, 256, 210, 0, Math.PI*2); dctx.stroke();

      dctx.fillStyle = '#0F172A'; dctx.font = 'bold 20px sans-serif'; dctx.textAlign = 'center'; dctx.textBaseline = 'middle';
      for (let i = 0; i <= 20; i++) {
        const angle = -Math.PI * 0.75 + (i / 20) * (Math.PI * 1.5);
        const r1 = 208;
        const r2 = i % 5 === 0 ? 180 : 194;
        dctx.lineWidth = i % 5 === 0 ? 4 : 2;
        dctx.beginPath();
        dctx.moveTo(256 + Math.cos(angle)*r1, 256 + Math.sin(angle)*r1);
        dctx.lineTo(256 + Math.cos(angle)*r2, 256 + Math.sin(angle)*r2);
        dctx.stroke();

        if (i % 5 === 0) {
          const val = i * 100;
          const rText = 155;
          dctx.fillText(val.toString(), 256 + Math.cos(angle)*rText, 256 + Math.sin(angle)*rText);
        }
      }
      dctx.font = 'bold 22px sans-serif'; dctx.fillStyle = '#0284C7';
      dctx.fillText('COMPRESSION LOAD (kN)', 256, 320);
      dctx.font = '16px monospace'; dctx.fillStyle = '#64748B';
      dctx.fillText('CAPACITY: 2000 kN', 256, 350);

      const dialTex = new THREE.CanvasTexture(dialCanvas);

      const dialFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0xD4A373, metalness: 0.8, roughness: 0.2 }));
      dialFrame.rotation.x = Math.PI / 2;
      dialFrame.position.set(1.5, 1.35, 0.36);
      utmGrp.add(dialFrame);

      const dialFace = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshBasicMaterial({ map: dialTex }));
      dialFace.position.set(1.5, 1.35, 0.39);
      utmGrp.add(dialFace);

      // Red Indicator Needle
      const needle = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.28, 0.01), new THREE.MeshBasicMaterial({ color: 0xDC2626 }));
      needle.position.set(1.5, 1.35, 0.4);
      needle.rotation.z = -Math.PI / 3;
      utmGrp.add(needle);

      // Console Controls: Emergency Stop Button & Digital LED Readout
      const eStop = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05), new THREE.MeshStandardMaterial({ color: 0xEF4444 }));
      eStop.rotation.x = Math.PI / 2;
      eStop.position.set(1.2, 0.65, 0.36);
      utmGrp.add(eStop);

      const ledScreen = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.02), new THREE.MeshBasicMaterial({ color: 0x00E5FF }));
      ledScreen.position.set(1.65, 0.65, 0.36);
      utmGrp.add(ledScreen);

      scene.add(utmGrp);

      // Row of 4 Framed Wall Portraits on Left Wall above Steel Shelves (Photo 4 Matched)
      const shelfMat = new THREE.MeshStandardMaterial({ color: 0x64748B });
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.6, 2.4), shelfMat);
      shelf.position.set(-roomW/2 + 0.3, 0.8, 3.0);
      scene.add(shelf);

      for (let pz of [2.0, 2.7, 3.4, 4.1]) {
        const pFrame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.35), new THREE.MeshStandardMaterial({ color: 0x78350F }));
        pFrame.position.set(-roomW/2 + 0.05, 2.3, pz);
        scene.add(pFrame);
      }

      // 3. ZONE 2: PINK/PURPLE TILED WORKBENCHES & CONCRETE RIGS (Matched to Photos 1, 2, 3 & 5)
      const pinkTileCanvas = document.createElement('canvas');
      pinkTileCanvas.width = 512; pinkTileCanvas.height = 512;
      const pctx = pinkTileCanvas.getContext('2d');
      pctx.fillStyle = '#C084FC'; pctx.fillRect(0, 0, 512, 512);
      pctx.strokeStyle = '#A855F7'; pctx.lineWidth = 3;
      for (let i = 0; i <= 512; i += 64) {
        pctx.moveTo(i, 0); pctx.lineTo(i, 512);
        pctx.moveTo(0, i); pctx.lineTo(512, i);
      }
      pctx.stroke();
      const pinkTileTex = new THREE.CanvasTexture(pinkTileCanvas);
      pinkTileTex.wrapS = THREE.RepeatWrapping; pinkTileTex.wrapT = THREE.RepeatWrapping;
      pinkTileTex.repeat.set(4, 12);
      const pinkTileMat = new THREE.MeshStandardMaterial({ map: pinkTileTex, roughness: 0.1, metalness: 0.05 });

      const benchTopMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.15 });

      [[-1.0, -1.0], [4.2, -1.0]].forEach(([bx, bz]) => {
        const benchGrp = new THREE.Group();
        benchGrp.position.set(bx, 0, bz);

        // Pink/Purple Tiled Base Structure (Matched to Photos 1, 2, 3 & 5)
        const pBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 6.5), pinkTileMat);
        pBase.position.y = 0.4;
        benchGrp.add(pBase);

        const pTop = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.08, 6.56), benchTopMat);
        pTop.position.y = 0.84;
        benchGrp.add(pTop);

        // Steel Cube Moulds (150mm) & Slump Test Cones on Workbenches
        const mouldMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.15 });
        for (let mz = -2.5; mz <= 2.5; mz += 1.6) {
          // 150mm Steel Cube Mould with Wingnuts
          const mould = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), mouldMat);
          mould.position.set(-0.4, 1.0, mz);
          benchGrp.add(mould);

          // Slump Test Cone & Tamping Rod
          const slumpCone = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.32, 16), mouldMat);
          slumpCone.position.set(0.4, 1.04, mz);
          benchGrp.add(slumpCone);

          const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45), chromeColMat);
          rod.rotation.z = Math.PI / 4;
          rod.position.set(0.55, 1.02, mz);
          benchGrp.add(rod);
        }

        scene.add(benchGrp);
      });

      // Compaction Factor Apparatus (Dual Conical Hoppers on Tripod Frame)
      const cfGrp = new THREE.Group();
      cfGrp.position.set(0.4, 0.88, 1.2);

      const cfMat = new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.8, roughness: 0.2 });
      const h1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 0.25, 16), cfMat);
      h1.position.y = 0.6;
      cfGrp.add(h1);

      const h2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.08, 0.22, 16), cfMat);
      h2.position.y = 0.3;
      cfGrp.add(h2);

      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 16), cfMat);
      cyl.position.y = 0.05;
      cfGrp.add(cyl);

      for (let a = 0; a < 3; a++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75), cfMat);
        leg.rotation.z = 0.1;
        leg.rotation.y = (a * Math.PI * 2) / 3;
        leg.position.set(Math.cos(leg.rotation.y)*0.18, 0.38, Math.sin(leg.rotation.y)*0.18);
        cfGrp.add(leg);
      }

      scene.add(cfGrp);

      // Motorized Steel Vibrating Table for Concrete Compaction (Matched to Photos)
      const vibGrp = new THREE.Group();
      vibGrp.position.set(-1.0, 0, 3.8);

      const vibTable = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.8), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 }));
      vibTable.position.y = 0.375;
      vibGrp.add(vibTable);

      const vibMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0x1E40AF }));
      vibMotor.position.set(0, 0.2, 0);
      vibGrp.add(vibMotor);

      scene.add(vibGrp);

      // Stacked Cement Bags near Wall (Matched to Photos 1, 2, 3 & 5)
      const cementMat = new THREE.MeshStandardMaterial({ color: 0xD4A373, roughness: 0.9 });
      for (let cz = -4.5; cz <= -3.0; cz += 0.5) {
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.25, 0.45), cementMat);
        bag.position.set(-roomW/2 + 0.6, 0.125 + (cz + 4.5)*0.3, cz);
        scene.add(bag);
      }

      // Grey Steel Storage Cabinets (Matched to Photos 1 & 5)
      for (let cx of [2.0, 3.4]) {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.55), new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.5, metalness: 0.4 }));
        cab.position.set(cx, 1.05, -roomD/2 + 0.3);
        scene.add(cab);
      }

      // 4. ZONE 3: STUDENTS IN DARK BLUE LAB COATS & FACULTY (Matched to Photos 1, 2, 3 & 5)
      // 6 Student 3D Avatars wearing Dark Blue Laboratory Coats/Uniforms
      [[-0.6, -2.5], [-0.6, 0.5], [4.6, -2.5], [4.6, 0.5], [4.6, 2.5], [-5.0, 2.5]].forEach(([sx, sz], idx) => {
        const studentAvatar = createSeatedOfficial({
          suitColor: 0x1E3A8A, // Dark Blue Lab Coat (Matched to Photo)
          skinColor: 0xD97706,
          hairColor: 0x1E293B,
          title: `STUDENT S${idx + 1}`,
          name: '',
          isPrincipal: false,
          headAngleY: Math.PI / 6,
          armGesture: true
        });
        studentAvatar.position.set(sx, 0, sz);
        scene.add(studentAvatar);
      });

      // Standing 3D Teacher Avatar at the UTM Machine/Blackboard
      const teacherName = scheduleData?.current_entry?.faculty_name || scheduleData?.faculty_name || scheduleData?.faculty || scheduleData?.teacher || 'Dr. B. Udaysree';
      const teacherAvatar = createSeatedOfficial({
        suitColor: 0x1E40AF, // Blue Shirt
        skinColor: 0xD97706,
        hairColor: 0x1E293B,
        title: '👨‍🏫 CONCRETE TECH PROFESSOR',
        name: teacherName,
        isPrincipal: true,
        headAngleY: Math.PI / 4,
        armGesture: true
      });
      teacherAvatar.position.set(-3.5, 0, -1.0);
      scene.add(teacherAvatar);

      // CCTV Camera in Top Corner
      const cctv = createCCTVCamera();
      cctv.position.set(-roomW / 2 + 0.4, roomH - 0.4, roomD / 2 - 0.4);
      cctv.rotation.y = Math.PI / 4;
      scene.add(cctv);

    } else if (isIoTLab) {
      // ══════════════════════════════════════════════════════════════════════════
      // 📟 IOT & EMBEDDED SYSTEMS LABORATORY — 3D VISUAL RECONSTRUCTION
      // Matched precisely to User Reference Photos 1 & 2
      // ══════════════════════════════════════════════════════════════════════════

      // 1. Warm Pale Cream Plaster Walls & Polished Light Grey Floor
      const floorCanvas = document.createElement('canvas');
      floorCanvas.width = 512;
      floorCanvas.height = 512;
      const fctx = floorCanvas.getContext('2d');
      fctx.fillStyle = '#E2E8F0';
      fctx.fillRect(0, 0, 512, 512);
      fctx.strokeStyle = '#CBD5E1';
      fctx.lineWidth = 1.5;
      for (let i = 0; i <= 512; i += 64) {
        fctx.moveTo(i, 0); fctx.lineTo(i, 512);
        fctx.moveTo(0, i); fctx.lineTo(512, i);
      }
      fctx.stroke();
      const floorTex = new THREE.CanvasTexture(floorCanvas);
      floorTex.wrapS = THREE.RepeatWrapping;
      floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(17, 15);

      const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.15, metalness: 0.05 });
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // Warm Pale Cream Plaster Wall Material (Matched to Photos 1 & 2)
      const iotWallMat = new THREE.MeshStandardMaterial({ color: 0xFEF9C3, roughness: 0.85 });

      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), iotWallMat);
      backWall.position.set(0, roomH/2, -roomD/2);
      backWall.receiveShadow = true;
      scene.add(backWall);

      const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), iotWallMat);
      leftWall.position.set(-roomW/2, roomH/2, 0);
      leftWall.rotation.y = Math.PI / 2;
      leftWall.receiveShadow = true;
      scene.add(leftWall);

      const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), iotWallMat);
      rightWall.position.set(roomW/2, roomH/2, 0);
      rightWall.rotation.y = -Math.PI / 2;
      rightWall.receiveShadow = true;
      scene.add(rightWall);

      // Ceiling with 3-Blade Dark Brown Ceiling Fans & Suspended Tube Lights
      const ceilMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.8 });
      const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilMat);
      ceilMesh.position.set(0, roomH, 0);
      ceilMesh.rotation.x = Math.PI / 2;
      scene.add(ceilMesh);

      const fanMat = new THREE.MeshStandardMaterial({ color: 0x451A03, roughness: 0.4 });
      [[-4, -3], [-4, 3], [2, -3], [2, 3], [6, 0]].forEach(([fx, fz]) => {
        const fanGrp = new THREE.Group();
        fanGrp.position.set(fx, roomH - 0.35, fz);

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35), fanMat);
        stem.position.y = 0.175;
        fanGrp.add(stem);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06), fanMat);
        fanGrp.add(hub);

        for (let a = 0; a < 3; a++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.01, 0.08), fanMat);
          blade.rotation.y = (a * Math.PI * 2) / 3;
          blade.position.set(Math.cos(blade.rotation.y)*0.3, 0, Math.sin(blade.rotation.y)*0.3);
          fanGrp.add(blade);
        }
        scene.add(fanGrp);
        fans.push(fanGrp);
      });

      // 2. ZONE 1: TEAK WOOD COMPUTER WORKSTATIONS WITH POWER SOCKET TRUNKING (Matched to Photo 1)
      const teakMat = new THREE.MeshStandardMaterial({ color: 0xB45309, roughness: 0.45 });
      const socketTrunkMat = new THREE.MeshStandardMaterial({ color: 0x78350F, roughness: 0.4 });
      const whiteSocketMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.2 });

      const pcMonitorMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.2, metalness: 0.8 });
      const pcScreenMat = new THREE.MeshBasicMaterial({ color: 0x0284C7 });
      const stoolMat = new THREE.MeshStandardMaterial({ color: 0xD4A373, roughness: 0.5 });

      [[-5.2, -1.0], [1.0, -1.0], [5.2, -1.0]].forEach(([bx, bz]) => {
        const benchGrp = new THREE.Group();
        benchGrp.position.set(bx, 0, bz);

        // Teak Wood Counter Desk Top
        const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 7.5), teakMat);
        deskTop.position.y = 0.74;
        benchGrp.add(deskTop);

        // Legs
        [-3.6, 3.6].forEach((lz) => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.74, 0.06), teakMat);
          leg.position.set(0, 0.37, lz);
          benchGrp.add(leg);
        });

        // Elevated Teak Wood Power Socket Trunking Raceway behind Monitors (Matched to Photo 1)
        const trunking = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 7.5), socketTrunkMat);
        trunking.position.set(-0.6, 0.88, 0);
        benchGrp.add(trunking);

        // White Power Switches & Sockets mounted along the trunking
        for (let sz = -3.2; sz <= 3.2; sz += 0.8) {
          const socket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.18), whiteSocketMat);
          socket.position.set(-0.47, 0.88, sz);
          benchGrp.add(socket);
        }

        // Desktop Computer Stations & Round Wooden Lab Stools
        for (let pz = -2.8; pz <= 2.8; pz += 1.4) {
          // Monitor Screen
          const monFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.55), pcMonitorMat);
          monFrame.position.set(0.1, 1.05, pz);
          benchGrp.add(monFrame);

          const monScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.35), pcScreenMat);
          monScreen.rotation.y = Math.PI / 2;
          monScreen.position.set(0.141, 1.05, pz);
          benchGrp.add(monScreen);

          // Keyboard
          const kb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.45), pcMonitorMat);
          kb.position.set(0.4, 0.78, pz);
          benchGrp.add(kb);

          // Round Wooden Lab Stool (Matched to Photo 1)
          const stoolTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), stoolMat);
          stoolTop.position.set(0.8, 0.48, pz);
          benchGrp.add(stoolTop);

          const stoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.46), new THREE.MeshStandardMaterial({ color: 0x334155 }));
          stoolLeg.position.set(0.8, 0.23, pz);
          benchGrp.add(stoolLeg);
        }

        scene.add(benchGrp);
      });

      // 3. ZONE 2: IOT MICROCONTROLLER DEVELOPMENT TRAINER KIT IN WOODEN CASE (Photo 2 Matched - Key Equipment!)
      const iotKitGrp = new THREE.Group();
      iotKitGrp.position.set(1.0, 0.8, 0.5);

      // Opened Wooden Briefcase (Matched to Photo 2)
      const woodCaseMat = new THREE.MeshStandardMaterial({ color: 0xFDE68A, roughness: 0.4 });
      const greenVelvetMat = new THREE.MeshStandardMaterial({ color: 0x14532D, roughness: 0.9 });

      const caseBase = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.65), woodCaseMat);
      caseBase.position.y = 0.03;
      iotKitGrp.add(caseBase);

      const caseLid = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.65), woodCaseMat);
      caseLid.rotation.z = Math.PI * 0.45; // Angled open lid
      caseLid.position.set(-0.24, 0.25, 0);
      iotKitGrp.add(caseLid);

      const velvetLining = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.01, 0.61), greenVelvetMat);
      velvetLining.position.y = 0.065;
      iotKitGrp.add(velvetLining);

      // Green PCB Circuit Board (Matched to Photo 2)
      const pcbMat = new THREE.MeshStandardMaterial({ color: 0x16A34A, roughness: 0.3 });
      const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.55), pcbMat);
      pcb.position.y = 0.08;
      iotKitGrp.add(pcb);

      // 16x2 Character LCD Screen Module (Backlit Yellow/Green - Matched to Photo 2)
      const lcdCanvas = document.createElement('canvas');
      lcdCanvas.width = 256; lcdCanvas.height = 128;
      const lctx = lcdCanvas.getContext('2d');
      lctx.fillStyle = '#84CC16'; lctx.fillRect(0, 0, 256, 128);
      lctx.fillStyle = '#0F172A'; lctx.font = 'bold 22px monospace';
      lctx.fillText('IoT SENSORS OK', 20, 50);
      lctx.fillText('TEMP: 26.5°C 8051', 15, 95);

      const lcdTex = new THREE.CanvasTexture(lcdCanvas);
      const lcdScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.09), new THREE.MeshBasicMaterial({ map: lcdTex }));
      lcdScreen.rotation.x = -Math.PI / 2;
      lcdScreen.position.set(0.08, 0.1, -0.15);
      iotKitGrp.add(lcdScreen);

      // Gray Ribbon Cable & IC Chips (Matched to Photo 2)
      const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.6 });
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.22), ribbonMat);
      ribbon.rotation.x = 0.3;
      ribbon.position.set(-0.05, 0.14, 0);
      iotKitGrp.add(ribbon);

      // Microcontroller IC DIP Chips & 4x4 Keypad Buttons
      const icMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, metalness: 0.8 });
      const dipIC = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.18), icMat);
      dipIC.position.set(-0.1, 0.1, -0.1);
      iotKitGrp.add(dipIC);

      const keypadMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
      const keypad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.12), keypadMat);
      keypad.position.set(0.08, 0.095, 0.15);
      iotKitGrp.add(keypad);

      scene.add(iotKitGrp);

      // 4. ZONE 3: CENTRAL DISCUSSION AREA & WALL CHARTS (Matched to Photo 1)
      // Blue Upholstered Discussion Chairs (Matched to Photo 1)
      const blueChairMat = new THREE.MeshStandardMaterial({ color: 0x2563EB, roughness: 0.6 });
      const metalFrameMat = new THREE.MeshStandardMaterial({ color: 0x1E293B });

      [[-2.0, 1.2], [-2.0, 2.4], [-3.2, 1.8]].forEach(([cx, cz]) => {
        const chairGrp = new THREE.Group();
        chairGrp.position.set(cx, 0, cz);

        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.46), blueChairMat);
        seat.position.y = 0.45;
        chairGrp.add(seat);

        const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.06), blueChairMat);
        back.position.set(0, 0.68, -0.2);
        chairGrp.add(back);

        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45), metalFrameMat);
        leg.position.y = 0.225;
        chairGrp.add(leg);

        scene.add(chairGrp);
      });

      // Teak-Framed Large Wall Blackboard (Left Wall) & IT Charts (Right Wall)
      const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.8, 4.2), teakMat);
      boardFrame.position.set(-roomW/2 + 0.04, 2.3, -2.0);
      scene.add(boardFrame);

      const bbCanvas = document.createElement('canvas');
      bbCanvas.width = 1024; bbCanvas.height = 512;
      const bbCtx = bbCanvas.getContext('2d');
      bbCtx.fillStyle = '#0F172A'; bbCtx.fillRect(0, 0, 1024, 512);

      bbCtx.font = 'bold 32px monospace'; bbCtx.fillStyle = '#F8FAFC';
      bbCtx.fillText('DEPARTMENT OF IT: IOT & EMBEDDED SYSTEMS LAB', 30, 60);

      bbCtx.fillText('1. Microcontroller 8051 / ESP32 Architecture', 30, 130);
      bbCtx.fillText('2. I2C & SPI Protocol: LCD 16x2 Interface', 30, 200);
      bbCtx.fillText('3. Sensor Interfacing: DHT11 & Ultrasonic ADC', 30, 270);
      bbCtx.fillText('4. MQTT Cloud Telemetry & Node-RED Flow', 30, 340);

      const bbTex = new THREE.CanvasTexture(bbCanvas);
      const bbFace = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 1.7), new THREE.MeshStandardMaterial({ map: bbTex, roughness: 0.85 }));
      bbFace.rotation.y = Math.PI / 2;
      bbFace.position.set(-roomW/2 + 0.075, 2.3, -2.0);
      scene.add(bbFace);

      // IT Department Wall Charts (Right Wall - Photo 1 Matched)
      for (let pz of [-3.0, 1.0]) {
        const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.3 }));
        chart.rotation.y = -Math.PI / 2;
        chart.position.set(roomW/2 - 0.05, 2.4, pz);
        scene.add(chart);
      }

      // Grey Steel Lockers on Back Wall (Matched to Photo 1)
      for (let cx of [-3.0, -1.6]) {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.55), new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.5, metalness: 0.4 }));
        cab.position.set(cx, 1.05, -roomD/2 + 0.3);
        scene.add(cab);
      }

      // 5. 3D AVATARS (STUDENTS & FACULTY)
      // 6 Seated Student Avatars working on PCs and IoT Kits
      [[-4.5, -2.8], [-4.5, 0.0], [1.7, -2.8], [1.7, 0.0], [1.7, 2.8], [5.9, 0.0]].forEach(([sx, sz], idx) => {
        const studentAvatar = createSeatedOfficial({
          suitColor: [0x2563EB, 0xDC2626, 0x16A34A, 0xF59E0B, 0x9333EA, 0x0D9488][idx % 6],
          skinColor: 0xD97706,
          hairColor: 0x1E293B,
          title: `STUDENT S${idx + 1}`,
          name: '',
          isPrincipal: false,
          headAngleY: Math.PI / 4,
          armGesture: true
        });
        studentAvatar.position.set(sx, 0, sz);
        scene.add(studentAvatar);
      });

      // Standing 3D Teacher Avatar at the IoT Trainer Kit
      const teacherName = scheduleData?.current_entry?.faculty_name || scheduleData?.faculty_name || scheduleData?.faculty || scheduleData?.teacher || 'Ch.Srujana';
      const teacherAvatar = createSeatedOfficial({
        suitColor: 0x0284C7, // Sky Blue Shirt
        skinColor: 0xD97706,
        hairColor: 0x1E293B,
        title: '👨‍🏫 IOT & EMBEDDED SYSTEMS PROFESSOR',
        name: teacherName,
        isPrincipal: true,
        headAngleY: Math.PI / 4,
        armGesture: true
      });
      teacherAvatar.position.set(1.0, 0, 1.2);
      scene.add(teacherAvatar);

      // CCTV Camera in Top Corner
      const cctv = createCCTVCamera();
      cctv.position.set(-roomW / 2 + 0.4, roomH - 0.4, roomD / 2 - 0.4);
      cctv.rotation.y = Math.PI / 4;
      scene.add(cctv);

    } else if (isFirstFloorCompLab) {
      // ══════════════════════════════════════════════════════════════════════════
      // 💻 FIRST FLOOR COMPUTER LABORATORY — HYPER-REALISTIC 3D RECONSTRUCTION
      // Matched precisely to User Reference Photos 1, 2 & 3
      // ══════════════════════════════════════════════════════════════════════════

      // 1. Warm Cream Plaster Walls & Polished Light Grey Floor
      const floorCanvas = document.createElement('canvas');
      floorCanvas.width = 512;
      floorCanvas.height = 512;
      const fctx = floorCanvas.getContext('2d');
      fctx.fillStyle = '#E2E8F0';
      fctx.fillRect(0, 0, 512, 512);
      fctx.strokeStyle = '#CBD5E1';
      fctx.lineWidth = 1.5;
      for (let i = 0; i <= 512; i += 64) {
        fctx.moveTo(i, 0); fctx.lineTo(i, 512);
        fctx.moveTo(0, i); fctx.lineTo(512, i);
      }
      fctx.stroke();
      const floorTex = new THREE.CanvasTexture(floorCanvas);
      floorTex.wrapS = THREE.RepeatWrapping;
      floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(18, 16);

      const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.15, metalness: 0.05 });
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // Warm Cream Plaster Wall Material (Matched to Photos 1, 2 & 3)
      const creamWallMat = new THREE.MeshStandardMaterial({ color: 0xFEF9C3, roughness: 0.85 });

      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), creamWallMat);
      backWall.position.set(0, roomH/2, -roomD/2);
      backWall.receiveShadow = true;
      scene.add(backWall);

      const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), creamWallMat);
      leftWall.position.set(-roomW/2, roomH/2, 0);
      leftWall.rotation.y = Math.PI / 2;
      leftWall.receiveShadow = true;
      scene.add(leftWall);

      const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), creamWallMat);
      rightWall.position.set(roomW/2, roomH/2, 0);
      rightWall.rotation.y = -Math.PI / 2;
      rightWall.receiveShadow = true;
      scene.add(rightWall);

      // Front Wall Projection Screen (Photo 2 Matched)
      const projScreenMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.2 });
      const projScreen = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.5), projScreenMat);
      projScreen.position.set(0, 2.5, -roomD/2 + 0.05);
      scene.add(projScreen);

      // Ceiling with Recessed LED Panels & Suspended Digital Projector (Photo 2 Matched)
      const ceilMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.8 });
      const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilMat);
      ceilMesh.position.set(0, roomH, 0);
      ceilMesh.rotation.x = Math.PI / 2;
      scene.add(ceilMesh);

      // Digital Ceiling-Mounted Projector (Photo 2 Matched)
      const projGrp = new THREE.Group();
      projGrp.position.set(0, roomH - 0.4, -1.0);

      const projStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4), new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.8 }));
      projStem.position.y = 0.2;
      projGrp.add(projStem);

      const projBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.38), new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.2 }));
      projGrp.add(projBody);

      const projLens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: 0x0284C7 }));
      projLens.rotation.x = Math.PI / 2;
      projLens.position.set(0, 0, -0.19);
      projGrp.add(projLens);

      scene.add(projGrp);

      // Wall-Mounted Split Air Conditioner Units with LED Temp (Photos 2 & 3 Matched)
      const acCanvas = document.createElement('canvas');
      acCanvas.width = 128; acCanvas.height = 64;
      const actx = acCanvas.getContext('2d');
      actx.fillStyle = '#10B981'; actx.fillRect(0, 0, 128, 64);
      actx.fillStyle = '#0F172A'; actx.font = 'bold 28px monospace';
      actx.fillText('22°C', 25, 42);
      const acTex = new THREE.CanvasTexture(acCanvas);

      [[-5.0, -roomD/2 + 0.2], [5.0, -roomD/2 + 0.2], [roomW/2 - 0.2, 0]].forEach(([ax, az]) => {
        const acGrp = new THREE.Group();
        acGrp.position.set(ax, roomH - 0.6, az);

        const acUnit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.28), new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.2 }));
        acGrp.add(acUnit);

        const acDisp = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.08), new THREE.MeshBasicMaterial({ map: acTex }));
        acDisp.position.set(0.35, 0, 0.141);
        acGrp.add(acDisp);

        scene.add(acGrp);
      });

      // Bright Yellow Fabric Windows & Curtains (Photos 1, 2 & 3 Matched)
      const yellowCurtainMat = new THREE.MeshStandardMaterial({ color: 0xFACC15, roughness: 0.8 });
      [-4.0, 0, 4.0].forEach((wz) => {
        const curtainGrp = new THREE.Group();
        curtainGrp.position.set(roomW/2 - 0.1, 2.3, wz);

        const curtain = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 1.2), yellowCurtainMat);
        curtainGrp.add(curtain);

        // Curtain Rod
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4), new THREE.MeshStandardMaterial({ color: 0x475569 }));
        rod.rotation.x = Math.PI / 2;
        rod.position.set(-0.06, 1.2, 0);
        curtainGrp.add(rod);

        scene.add(curtainGrp);
      });

      // 2. ZONE 1: WHITE LAMINATE COMPUTER COUNTERS FACING FRONT BOARD (Matched to Photos 1, 2 & 3)
      const deskMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.25 });
      const dividerMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.4 });
      const socketTrunkMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.3 });
      const whiteSocketMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.2 });

      const monitorMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.2, metalness: 0.8 });
      const blueChairMat = new THREE.MeshStandardMaterial({ color: 0x2563EB, roughness: 0.5 });
      const chairFrameMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.7 });

      // Canvas-Rendered VS Code Editor Screen Texture for HP Monitors (Hyper-Realistic!)
      const codeCanvas = document.createElement('canvas');
      codeCanvas.width = 512; codeCanvas.height = 320;
      const cctx = codeCanvas.getContext('2d');
      cctx.fillStyle = '#0F172A'; cctx.fillRect(0, 0, 512, 320);

      // VS Code Title Bar & Sidebar
      cctx.fillStyle = '#1E293B'; cctx.fillRect(0, 0, 512, 30);
      cctx.fillStyle = '#38BDF8'; cctx.font = '14px monospace';
      cctx.fillText('App.jsx - CampusSphere Computer Lab System', 15, 20);

      cctx.fillStyle = '#1E293B'; cctx.fillRect(0, 30, 40, 290);

      // Code Lines
      cctx.font = '13px monospace';
      cctx.fillStyle = '#F43F5E'; cctx.fillText('import', 55, 60);
      cctx.fillStyle = '#F8FAFC'; cctx.fillText(' React, { useState } ', 115, 60);
      cctx.fillStyle = '#F43F5E'; cctx.fillText('from', 270, 60);
      cctx.fillStyle = '#10B981'; cctx.fillText(" 'react';", 310, 60);

      cctx.fillStyle = '#38BDF8'; cctx.fillText('function', 55, 95);
      cctx.fillStyle = '#FACC15'; cctx.fillText(' ComputerLab()', 125, 95);
      cctx.fillStyle = '#F8FAFC'; cctx.fillText(' {', 255, 95);

      cctx.fillStyle = '#F43F5E'; cctx.fillText('  const', 55, 130);
      cctx.fillStyle = '#F8FAFC'; cctx.fillText(' [hpMonitors] = useState(', 110, 130);
      cctx.fillStyle = '#10B981'; cctx.fillText("'20 Widescreens'", 305, 130);
      cctx.fillStyle = '#F8FAFC'; cctx.fillText(');', 440, 130);

      cctx.fillStyle = '#38BDF8'; cctx.fillText('  return', 55, 165);
      cctx.fillStyle = '#F8FAFC'; cctx.fillText(' <div className=', 110, 165);
      cctx.fillStyle = '#10B981'; cctx.fillText('"lab-online"', 250, 165);
      cctx.fillStyle = '#F8FAFC'; cctx.fillText(' />;', 350, 165);

      cctx.fillStyle = '#64748B'; cctx.fillText('// STATUS: 20 HP STATIONS ONLINE (FACING BOARD)', 55, 210);

      const codeTex = new THREE.CanvasTexture(codeCanvas);

      // 4 Long Horizontal Computer Counter Rows Facing the Board (-Z Direction)
      [-4.2, -1.5, 1.5, 4.2].forEach((rz) => {
        const rowGrp = new THREE.Group();
        rowGrp.position.set(0, 0, rz);

        // White Counter Top Running Left-to-Right Across Room
        const cTop = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.06, 0.8), deskMat);
        cTop.position.y = 0.74;
        rowGrp.add(cTop);

        // Front Modesty / Center Privacy Divider Panel Facing Front Board
        const divider = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.35, 0.04), dividerMat);
        divider.position.set(0, 0.945, -0.38);
        rowGrp.add(divider);

        // White Power Socket Trunking Raceway
        const trunking = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.16, 0.18), socketTrunkMat);
        trunking.position.set(0, 0.85, -0.3);
        rowGrp.add(trunking);

        for (let sx = -5.5; sx <= 5.5; sx += 1.8) {
          const socket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.04), whiteSocketMat);
          socket.position.set(sx, 0.85, -0.2);
          rowGrp.add(socket);
        }

        // Support Legs
        [-6.5, 0, 6.5].forEach((lx) => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.74, 0.78), deskMat);
          leg.position.set(lx, 0.37, 0);
          rowGrp.add(leg);
        });

        // 5 HP Widescreen LCD Monitors & Blue Swivel Chairs Per Row (All Facing Board!)
        [-5.0, -2.5, 0, 2.5, 5.0].forEach((px) => {
          // HP Stand Base & Stem
          const monBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.02, 16), monitorMat);
          monBase.position.set(px, 0.78, -0.2);
          rowGrp.add(monBase);

          const monStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22), monitorMat);
          monStem.position.set(px, 0.89, -0.2);
          rowGrp.add(monStem);

          // Widescreen Frame facing forward towards `-Z`
          const monFrame = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.38, 0.06), monitorMat);
          monFrame.position.set(px, 1.05, -0.2);
          rowGrp.add(monFrame);

          // Active VS Code Screen facing student (`+Z` face showing code screen)
          const monScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.35), new THREE.MeshBasicMaterial({ map: codeTex }));
          monScreen.position.set(px, 1.05, -0.169);
          rowGrp.add(monScreen);

          // Keyboard & Mouse in front of monitor
          const kb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.18), monitorMat);
          kb.position.set(px, 0.78, 0.15);
          rowGrp.add(kb);

          // Blue Ergonomic Swivel Computer Chair (Facing Board!)
          const chairGrp = new THREE.Group();
          chairGrp.position.set(px, 0, 0.55);

          // Cushion Seat
          const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.46), blueChairMat);
          seat.position.y = 0.45;
          chairGrp.add(seat);

          // Curved Backrest (Behind seat)
          const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.06), blueChairMat);
          back.position.set(0, 0.68, 0.2);
          chairGrp.add(back);

          // Armrests
          [-0.26, 0.26].forEach((armX) => {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.28), chairFrameMat);
            arm.position.set(armX, 0.58, 0);
            chairGrp.add(arm);
          });

          // 5-Star Swivel Base
          const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 5), chairFrameMat);
          base.position.y = 0.08;
          chairGrp.add(base);

          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36), chairFrameMat);
          stem.position.y = 0.26;
          chairGrp.add(stem);

          rowGrp.add(chairGrp);
        });

        scene.add(rowGrp);
      });

      // 3. ZONE 2: TEACHER WORKSTATION & FRONT BOARD (Photo 2 Matched)
      const tDeskGrp = new THREE.Group();
      tDeskGrp.position.set(-6.5, 0, -6.2);

      const tDesk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.76, 1.2), new THREE.MeshStandardMaterial({ color: 0x78350F, roughness: 0.5 }));
      tDesk.position.y = 0.38;
      tDeskGrp.add(tDesk);

      const tMon1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.08), monitorMat);
      tMon1.position.set(-0.4, 1.05, 0);
      tDeskGrp.add(tMon1);

      const tMon2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.08), monitorMat);
      tMon2.position.set(0.4, 1.05, 0);
      tDeskGrp.add(tMon2);

      scene.add(tDeskGrp);

      // 4. 3D AVATARS (STUDENTS FACING FRONT BOARD & PROFESSOR)
      // 6 Seated Student 3D Avatars placed in chairs facing forward (`headAngleY = 0`)
      [[-5.0, -3.65], [0, -3.65], [5.0, -3.65], [-2.5, -0.95], [2.5, -0.95], [0, 2.05]].forEach(([sx, sz], idx) => {
        const studentAvatar = createSeatedOfficial({
          suitColor: [0x2563EB, 0xDC2626, 0x16A34A, 0xF59E0B, 0x9333EA, 0x0D9488][idx % 6],
          skinColor: 0xD97706,
          hairColor: 0x1E293B,
          title: `STUDENT S${idx + 1}`,
          name: '',
          isPrincipal: false,
          headAngleY: 0, // Facing Forward towards Board!
          armGesture: true
        });
        studentAvatar.position.set(sx, 0, sz);
        scene.add(studentAvatar);
      });

      // Standing 3D Teacher Avatar at Front Desk Facing Students
      const teacherName = scheduleData?.current_entry?.faculty_name || scheduleData?.faculty_name || scheduleData?.faculty || scheduleData?.teacher || 'Phanindra Bharadwaja';
      const teacherAvatar = createSeatedOfficial({
        suitColor: 0x1E40AF, // Blue Shirt
        skinColor: 0xD97706,
        hairColor: 0x1E293B,
        title: '👨‍🏫 INFORMATION TECHNOLOGY PROFESSOR',
        name: teacherName,
        isPrincipal: true,
        headAngleY: Math.PI, // Facing Students!
        armGesture: true
      });
      teacherAvatar.position.set(-6.5, 0, -5.0);
      scene.add(teacherAvatar);

      // CCTV Camera in Top Corner
      const cctv = createCCTVCamera();
      cctv.position.set(-roomW / 2 + 0.4, roomH - 0.4, roomD / 2 - 0.4);
      cctv.rotation.y = Math.PI / 4;
      scene.add(cctv);

    } else if (isAdminLobby) {
      // ══════════════════════════════════════════════════════════════════════════
      // 🏛️ CENTRAL ADMINISTRATION LOBBY — 3D VISUALIZATION
      // ══════════════════════════════════════════════════════════════════════════

      // 1. Polished Marble Floor with High Gloss Reflections
      const floorCanvas = document.createElement('canvas');
      floorCanvas.width = 512;
      floorCanvas.height = 512;
      const fctx = floorCanvas.getContext('2d');
      fctx.fillStyle = '#FAFAF9';
      fctx.fillRect(0, 0, 512, 512);
      fctx.strokeStyle = '#E2E8F0';
      fctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 64) {
        fctx.moveTo(i, 0); fctx.lineTo(i, 512);
        fctx.moveTo(0, i); fctx.lineTo(512, i);
      }
      fctx.stroke();
      const floorTex = new THREE.CanvasTexture(floorCanvas);
      floorTex.wrapS = THREE.RepeatWrapping;
      floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(12, 14);

      const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.08, metalness: 0.15 });
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // 2. Coffered Ceiling with Beams and Hanging Lights
      const ceilMat = new THREE.MeshStandardMaterial({ color: 0xF1F5F9, roughness: 0.8 });
      const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilMat);
      ceilMesh.position.y = roomH;
      ceilMesh.rotation.x = Math.PI / 2;
      scene.add(ceilMesh);

      const beamMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.8 });
      const beamDepth = 0.25;
      const beamWidth = 0.15;
      for (let x = -roomW/2 + 2; x < roomW/2; x += 2) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(beamWidth, beamDepth, roomD), beamMat);
        beam.position.set(x, roomH - beamDepth/2, 0);
        scene.add(beam);
      }
      for (let z = -roomD/2 + 2; z < roomD/2; z += 2) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(roomW, beamDepth, beamWidth), beamMat);
        beam.position.set(0, roomH - beamDepth/2, z);
        scene.add(beam);
      }

      // Hanging Amber Lightbulbs
      const bulbGeom = new THREE.SphereGeometry(0.08, 16, 16);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xFFE082 });
      const wireMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
      for (let x = -roomW/2 + 3; x < roomW/2; x += 4) {
        for (let z = -roomD/2 + 3; z < roomD/2; z += 4) {
          const wireLen = 0.8;
          const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, wireLen), wireMat);
          wire.position.set(x, roomH - wireLen/2, z);
          scene.add(wire);

          const bulb = new THREE.Mesh(bulbGeom, bulbMat);
          bulb.position.set(x, roomH - wireLen, z);
          scene.add(bulb);

          const pLight = new THREE.PointLight(0xFFB300, 0.5, 8);
          pLight.position.set(x, roomH - wireLen - 0.1, z);
          scene.add(pLight);
        }
      }

      // 3. Walls & Accent Stripes
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xF5F5F4, roughness: 0.9 });
      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMat);
      backWall.position.set(0, roomH / 2, -roomD / 2);
      backWall.receiveShadow = true;
      scene.add(backWall);

      const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
      leftWall.position.set(-roomW / 2, roomH / 2, 0);
      leftWall.rotation.y = Math.PI / 2;
      leftWall.receiveShadow = true;
      scene.add(leftWall);

      // Yellow/Orange vertical wall accent stripes
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, roughness: 0.8 });
      for (let x = -roomW/2 + 2.5; x < roomW/2; x += 4) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, roomH, 0.08), stripeMat);
        stripe.position.set(x, roomH / 2, -roomD / 2 + 0.04);
        scene.add(stripe);
      }

      // Right Wall: Dark Bronze Glass Cabins
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x271a15, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.85 });
      const glassFrameMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.5 });
      const rightWallOffset = roomW / 2 - 0.1;
      for (let z = -roomD/2 + 2; z < roomD/2 - 2; z += 4) {
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 3.2), glassMat);
        pane.position.set(rightWallOffset, 1.6, z);
        pane.rotation.y = -Math.PI / 2;
        scene.add(pane);

        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.2, 0.1), glassFrameMat);
        frame.position.set(rightWallOffset, 1.6, z - 1.65);
        scene.add(frame);
      }

      // 4. Cylindrical Support Pillars
      const colMat = new THREE.MeshStandardMaterial({ color: 0xFAFAF9, roughness: 0.7 });
      const colGeom = new THREE.CylinderGeometry(0.32, 0.32, roomH, 24);
      const columnPositions = [
        [-roomW/2 + 3.2, 0],
        [-roomW/2 + 3.2, -roomD/3],
        [-roomW/2 + 3.2, roomD/3],
        [roomW/6, -roomD/4]
      ];
      columnPositions.forEach(([cx, cz]) => {
        const column = new THREE.Mesh(colGeom, colMat);
        column.position.set(cx, roomH / 2, cz);
        column.castShadow = true;
        column.receiveShadow = true;
        scene.add(column);
      });

      // 5. Mezzanine Platform & Black Metal Railings
      const mezMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.7 });
      const mezH = 0.25;
      const mezY = 3.2;
      const leftMez = new THREE.Mesh(new THREE.BoxGeometry(3.5, mezH, roomD), mezMat);
      leftMez.position.set(-roomW/2 + 1.75, mezY, 0);
      leftMez.castShadow = true;
      leftMez.receiveShadow = true;
      scene.add(leftMez);

      const railMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.5 });
      const railH = 0.95;
      const leftRailBottom = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, roomD), railMat);
      leftRailBottom.position.set(-roomW/2 + 3.5, mezY + 0.05, 0);
      scene.add(leftRailBottom);

      const leftRailTop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, roomD), railMat);
      leftRailTop.position.set(-roomW/2 + 3.5, mezY + railH, 0);
      scene.add(leftRailTop);

      for (let z = -roomD/2; z <= roomD/2; z += 1.2) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, railH), railMat);
        post.position.set(-roomW/2 + 3.5, mezY + railH/2, z);
        scene.add(post);
      }

      // 6. Long Gold-Framed Officials Portrait Board
      const boardD = 10;
      const boardMat = new THREE.MeshStandardMaterial({ color: 0xD97706, roughness: 0.3, metalness: 0.4 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, boardD), boardMat);
      board.position.set(-roomW/2 + 3.4, mezY - 0.2, 0);
      board.castShadow = true;
      scene.add(board);

      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1E1B4B, roughness: 0.8 });
      const photoMat = new THREE.MeshStandardMaterial({ color: 0xFDF0D5, roughness: 0.9 });
      const numFrames = 12;
      const startZ = -boardD/2 + 0.5;
      const stepZ = (boardD - 1.0) / (numFrames - 1);
      for (let i = 0; i < numFrames; i++) {
        const cz = startZ + i * stepZ;
        const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.45), frameMat);
        frameMesh.position.set(-roomW/2 + 3.51, mezY - 0.2, cz);
        scene.add(frameMesh);

        const photoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.52, 0.37), photoMat);
        photoMesh.position.set(-roomW/2 + 3.52, mezY - 0.2, cz);
        scene.add(photoMesh);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0x475569 }));
        head.position.set(-roomW/2 + 3.525, mezY - 0.16, cz);
        scene.add(head);

        const suit = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.22), new THREE.MeshBasicMaterial({ color: 0x1E293B }));
        suit.position.set(-roomW/2 + 3.525, mezY - 0.26, cz);
        scene.add(suit);
      }

      // 7. Reception Desk Counter & TV Screen Backdrop
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.7 });
      const panelHeight = 3.2;
      const backPanel = new THREE.Mesh(new THREE.BoxGeometry(0.15, panelHeight, 4.2), panelMat);
      backPanel.position.set(-roomW/2 + 4.8, panelHeight/2, 0);
      backPanel.castShadow = true;
      scene.add(backPanel);

      const stripeMatPanel = new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.8 });
      for (let z = -1.8; z <= 1.8; z += 0.4) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, panelHeight, 0.08), stripeMatPanel);
        stripe.position.set(-roomW/2 + 4.89, panelHeight/2, z);
        scene.add(stripe);
      }

      const tvFrameMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.4 });
      const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 2.0), tvFrameMat);
      tvFrame.position.set(-roomW/2 + 4.92, 1.8, 0);
      scene.add(tvFrame);

      const tvCanvas = document.createElement('canvas');
      tvCanvas.width = 512;
      tvCanvas.height = 256;
      const tvCtx = tvCanvas.getContext('2d');
      tvCtx.fillStyle = '#1E3A8A';
      tvCtx.fillRect(0, 0, 512, 256);
      tvCtx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
      tvCtx.lineWidth = 1;
      for (let x = 0; x <= 512; x += 32) {
        tvCtx.beginPath(); tvCtx.moveTo(x, 0); tvCtx.lineTo(x, 256); tvCtx.stroke();
      }
      for (let y = 0; y <= 256; y += 32) {
        tvCtx.beginPath(); tvCtx.moveTo(0, y); tvCtx.lineTo(512, y); tvCtx.stroke();
      }
      tvCtx.fillStyle = '#00E5FF';
      tvCtx.font = 'bold 34px sans-serif';
      tvCtx.textAlign = 'center';
      tvCtx.fillText('SUHRUTH UNIVERSITY', 256, 100);
      tvCtx.fillStyle = '#FFFFFF';
      tvCtx.font = '22px sans-serif';
      tvCtx.fillText('ADMINISTRATIVE CORE HIERARCHY', 256, 150);
      tvCtx.fillStyle = '#00FFB3';
      tvCtx.font = 'bold 18px monospace';
      tvCtx.fillText('● SYSTEM ONLINE · FULLY OPERATIONAL', 256, 200);

      const tvTex = new THREE.CanvasTexture(tvCanvas);
      const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.12, 1.92), new THREE.MeshBasicMaterial({ map: tvTex }));
      tvScreen.position.set(-roomW/2 + 4.965, 1.8, 0);
      scene.add(tvScreen);

      // Reception Desk
      const deskD = 3.6;
      const deskBodyMat = new THREE.MeshStandardMaterial({ color: 0x78350F, roughness: 0.5 });
      const deskTopMat = new THREE.MeshStandardMaterial({ color: 0xFAFAF9, roughness: 0.2 });
      const deskBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, deskD - 0.1), deskBodyMat);
      deskBody.position.set(-roomW/2 + 5.9, 0.5, 0);
      deskBody.castShadow = true;
      scene.add(deskBody);

      const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, deskD), deskTopMat);
      deskTop.position.set(-roomW/2 + 5.9, 1.02, 0);
      deskTop.castShadow = true;
      scene.add(deskTop);

      const ledStripeMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B });
      const ledStripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, deskD - 0.2), ledStripeMat);
      ledStripe.position.set(-roomW/2 + 6.42, 0.08, 0);
      scene.add(ledStripe);

      // Receptionist Avatar
      const staffSkin = new THREE.MeshStandardMaterial({ color: 0xD97706, roughness: 0.6 });
      const staffShirt = new THREE.MeshStandardMaterial({ color: 0x1E40AF, roughness: 0.5 });
      const stChair = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.6), new THREE.MeshStandardMaterial({ color: 0x334155 }));
      stChair.position.set(-roomW/2 + 5.3, 0.3, 0);
      scene.add(stChair);

      const stBody = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.6), staffShirt);
      stBody.position.set(-roomW/2 + 5.3, 0.8, 0);
      scene.add(stBody);

      const stHead = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), staffSkin);
      stHead.position.set(-roomW/2 + 5.3, 1.2, 0);
      scene.add(stHead);

      // 8. Visitor Waiting Area (Chairs in Rows)
      const seatGeom = new THREE.BoxGeometry(0.48, 0.06, 0.46);
      const backGeom = new THREE.BoxGeometry(0.48, 0.42, 0.06);
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.5 });
      const chairFrameMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.95, roughness: 0.1 });
      const legGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.42);

      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          const cx = -roomW/2 + 9.5 + r * 1.4;
          const cz = -roomD/4 + c * 1.2;

          const chairGroup = new THREE.Group();
          chairGroup.position.set(cx, 0, cz);
          chairGroup.rotation.y = -Math.PI / 2;

          const seat = new THREE.Mesh(seatGeom, seatMat);
          seat.position.y = 0.42;
          chairGroup.add(seat);

          const back = new THREE.Mesh(backGeom, seatMat);
          back.position.set(0, 0.65, 0.2);
          chairGroup.add(back);

          const l1 = new THREE.Mesh(legGeom, chairFrameMat);
          l1.position.set(-0.2, 0.21, -0.2);
          chairGroup.add(l1);
          const l2 = new THREE.Mesh(legGeom, chairFrameMat);
          l2.position.set(0.2, 0.21, -0.2);
          chairGroup.add(l2);
          const l3 = new THREE.Mesh(legGeom, chairFrameMat);
          l3.position.set(-0.2, 0.21, 0.2);
          chairGroup.add(l3);
          const l4 = new THREE.Mesh(legGeom, chairFrameMat);
          l4.position.set(0.2, 0.21, 0.2);
          chairGroup.add(l4);

          scene.add(chairGroup);
        }
      }

      // 9. Office Workstations behind Glass
      const cabinDeskMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
      const screenMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.7 });
      const monitorMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.3 });
      const screenGlowMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF });

      [-roomD/3, 0, roomD/3].forEach((cz) => {
        const officeGroup = new THREE.Group();
        officeGroup.position.set(roomW / 2 - 2.0, 0, cz);

        const desk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.8), cabinDeskMat);
        desk.position.y = 0.72;
        officeGroup.add(desk);

        const stand1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.74, 0.8), cabinDeskMat);
        stand1.position.set(-0.68, 0.37, 0);
        officeGroup.add(stand1);

        const stand2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.74, 0.8), cabinDeskMat);
        stand2.position.set(0.68, 0.37, 0);
        officeGroup.add(stand2);

        const screen = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.02), screenMat);
        screen.position.set(0, 0.915, -0.39);
        officeGroup.add(screen);

        const monitorScreen = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.03), monitorMat);
        monitorScreen.position.set(0, 0.98, -0.1);
        officeGroup.add(monitorScreen);

        const screenGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.26), screenGlowMat);
        screenGlow.position.set(0, 0.98, -0.08);
        officeGroup.add(screenGlow);

        scene.add(officeGroup);
      });

      // 10. Staircase (Rear Left)
      const stairMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.8 });
      const numSteps = 16;
      const stepRise = 3.2 / numSteps;
      const stepRun = 3.5 / numSteps;
      for (let i = 0; i < numSteps; i++) {
        const stepH = (i + 1) * stepRise;
        const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, stepH, stepRun), stairMat);
        stepMesh.position.set(-roomW/2 + 0.8, stepH / 2, -roomD/2 + 0.8 + i * stepRun);
        scene.add(stepMesh);
      }

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
      try {
        cancelAnimationFrame(reqId);
      } catch (e) {
        console.warn("Error cancelling animation frame:", e);
      }
      try {
        window.removeEventListener('resize', handleResize);
      } catch (e) {}
      try {
        if (controls) {
          controls.dispose();
        }
      } catch (e) {}
      try {
        if (renderer) {
          renderer.dispose();
        }
      } catch (e) {}
      try {
        if (container && renderer && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      } catch (e) {}
    };
  }, [cleanId, isBoardRoom, teacherName, subjectName, sectionName, timeSlot, dayName]);

  // Handle Preset Camera Views
  const setCameraView = (view) => {
    setActiveCamView(view);
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (isAdminLobby) {
      if (view === 'teacher') {
        // Receptionist POV
        cam.position.set(-3.8, 1.3, 0);
        ctrl.target.set(7, 1.2, 0);
      } else if (view === 'student') {
        // Visitor Waiting Area POV
        cam.position.set(4.5, 1.0, 0);
        ctrl.target.set(-3.1, 1.1, 0);
      } else if (view === 'cctv') {
        // High CCTV corner view
        cam.position.set(8, 6.0, 9);
        ctrl.target.set(0, 1.0, 0);
      } else {
        // Default 3D Overview
        cam.position.set(0, 6.5, 12.5);
        ctrl.target.set(0, 1.8, 0);
      }
    } else if (isIQACRoom) {
      if (view === 'teacher') {
        // Board Executive POV
        cam.position.set(-3.8, 1.4, -2.2);
        ctrl.target.set(2.0, 1.2, 0.8);
      } else if (view === 'student') {
        // Presenter POV
        cam.position.set(3.2, 1.5, -2.8);
        ctrl.target.set(-1.0, 1.1, 0.5);
      } else if (view === 'cctv') {
        cam.position.set(4.8, 3.6, 5.5);
        ctrl.target.set(0, 1.0, -1.0);
      } else {
        // 3D Overview
        cam.position.set(0, 4.2, 9.2);
        ctrl.target.set(0, 1.2, 0);
      }
    } else if (isPrincipalOffice) {
      if (view === 'teacher') {
        // Principal Desk POV (Direct view facing Principal)
        cam.position.set(0, 1.35, -0.6);
        ctrl.target.set(0, 1.2, -2.5);
      } else if (view === 'student') {
        // Visitor Chair POV
        cam.position.set(0.9, 1.2, -0.6);
        ctrl.target.set(0, 1.2, -2.5);
      } else if (view === 'cctv') {
        cam.position.set(4.5, 3.4, 4.5);
        ctrl.target.set(0, 1.0, -1.5);
      } else {
        // 3D Overview
        cam.position.set(0, 3.8, 8.5);
        ctrl.target.set(0, 1.2, -1.5);
      }
    } else {
      if (view === 'teacher') {
        cam.position.set(-1.2, 1.8, -4.8);
        ctrl.target.set(0, 1.2, 1.5);
      } else if (view === 'student') {
        cam.position.set(0, 1.4, 4.2);
        ctrl.target.set(0, 1.8, -6.5);
      } else if (view === 'cctv') {
        cam.position.set(5.2, 3.8, -5.8);
        ctrl.target.set(0, 1.0, 0);
    } else if (isFMLab) {
      if (view === 'teacher') {
        // Teacher POV (Facing Professor & Blackboard)
        cam.position.set(-1.0, 1.4, -2.5);
        ctrl.target.set(-1.0, 1.5, -4.8);
      } else if (view === 'student') {
        // Student Seated POV from Wooden Benches
        cam.position.set(-1.0, 1.15, 2.0);
        ctrl.target.set(-1.0, 1.5, -3.5);
      } else if (view === 'cctv') {
        // Hydraulic Rigs Close-Up POV
        cam.position.set(3.5, 2.2, 3.5);
        ctrl.target.set(1.0, 0.8, -0.5);
      } else {
        // 3D Lab Overview
        cam.position.set(0, 4.8, 11.5);
        ctrl.target.set(0, 1.2, 0);
      }
    } else if (isEELab) {
      if (view === 'teacher') {
        // Teacher POV (Facing Professor & Blackboard)
        cam.position.set(-1.0, 1.4, -2.5);
        ctrl.target.set(-1.0, 1.5, -4.8);
      } else if (view === 'student') {
        // Student Seated POV from Light Wood Benches
        cam.position.set(-1.0, 1.15, 2.0);
        ctrl.target.set(-1.0, 1.5, -3.5);
      } else if (view === 'cctv') {
        // Jar Test Flocculator & Tiled Island Bench POV
        cam.position.set(-3.5, 2.0, 1.2);
        ctrl.target.set(3.5, 1.0, 0);
      } else {
        // 3D Lab Overview
        cam.position.set(0, 4.8, 11.5);
        ctrl.target.set(0, 1.2, 0);
      }
    } else if (isCTLab) {
      if (view === 'teacher') {
        // Teacher POV (Facing Professor & UTM Machine)
        cam.position.set(-3.5, 1.4, 1.2);
        ctrl.target.set(-5.2, 1.3, -1.0);
      } else if (view === 'student') {
        // Student POV at Pink Tiled Testing Workbenches
        cam.position.set(-1.0, 1.4, 2.2);
        ctrl.target.set(-1.0, 1.0, -1.0);
      } else if (view === 'cctv') {
        // UTM Compression Machine & Dial Console POV
        cam.position.set(-3.0, 2.2, 1.8);
        ctrl.target.set(-5.2, 1.3, -1.0);
      } else {
        // 3D Lab Overview
        cam.position.set(0, 4.8, 11.5);
        ctrl.target.set(0, 1.2, 0);
      }
    } else if (isIoTLab) {
      if (view === 'teacher') {
        // Teacher POV (Facing Professor at IoT Kit)
        cam.position.set(1.0, 1.4, 2.5);
        ctrl.target.set(1.0, 1.1, 0.5);
      } else if (view === 'student') {
        // Student POV at Teak Computer Workstation
        cam.position.set(-4.5, 1.2, 1.0);
        ctrl.target.set(-5.2, 1.1, -1.0);
      } else if (view === 'cctv') {
        // IoT Microcontroller Briefcase Trainer Kit Close-Up POV
        cam.position.set(1.0, 1.35, 1.1);
        ctrl.target.set(1.0, 0.9, 0.5);
      } else {
        // 3D Lab Overview
        cam.position.set(0, 4.8, 11.5);
        ctrl.target.set(0, 1.2, 0);
      }
    } else if (isFirstFloorCompLab) {
      if (view === 'teacher') {
        // Teacher POV (Facing Professor & Front Desk)
        cam.position.set(-7.2, 1.4, -3.0);
        ctrl.target.set(-7.2, 1.2, -6.0);
      } else if (view === 'student') {
        // Student POV at HP Widescreen Monitor Station
        cam.position.set(-0.6, 1.2, 2.0);
        ctrl.target.set(-0.6, 1.05, 0);
      } else if (view === 'cctv') {
        // Computer Rows Close-Up POV
        cam.position.set(0, 3.2, 5.0);
        ctrl.target.set(0, 1.0, 0);
      } else {
        // 3D Lab Overview
        cam.position.set(0, 4.8, 12.5);
        ctrl.target.set(0, 1.2, 0);
      }
    } else {
      cam.position.set(0, 4.5, 9.5);
      ctrl.target.set(0, 1.4, 0);
    }
    }
  };

  return createPortal(
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
                  {isAdminLobby ? '🏛️ Central Administration Lobby' : isIQACRoom ? '🏛️ IQAC Conference Room' : isPrincipalOffice ? '🏛️ Principal Executive Cabin' : isCivilDept ? '🏛️ Civil Department & HOD Cabin' : isFMLab ? '💧 Fluid Mechanics Laboratory' : isEELab ? '🌿 Environmental Engineering Lab' : isCTLab ? '🏗️ Concrete Technology Lab' : isIoTLab ? '📟 IoT & Embedded Systems Lab' : isFirstFloorCompLab ? '💻 First Floor Computer Lab' : isWashroom ? '🚻 Washroom Facility' : isBoardRoom || isStaffRoom ? '🏛️ Faculty Staff Office' : isLab ? '🔬 Laboratory' : '📚 Active Classroom'}
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-mono flex items-center gap-2">
                <span>Civil & IT Block · {room?.floor || 'Ground Floor'}</span>
                <span>·</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  {isAdminLobby ? '🏛️ Executive Administrative Hub' : isIQACRoom ? '🏛️ Internal Quality Assurance Cell' : isPrincipalOffice ? '🏛️ Office of the Executive Principal' : isCivilDept ? '🏛️ Office of the Civil Engineering Department' : isWashroom ? '🚻 Hygiene & Restroom Facility' : isBoardRoom || isStaffRoom ? '🏛️ Faculty & Departmental Hub' : `Faculty: ${teacherName}`}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period / Schedule Selector (Hidden for Non-Timetable Facilities) */}
            {!isNonTimetableFacility && (
              <>
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
              </>
            )}
            <button
              onClick={() => {
                // 3D Room Interior Walkthrough Modal — Synchronized with Backend Timetables & Administration Lobby & IQAC Room Visual Reconstruction
                if (typeof onClose === 'function') {
                  onClose();
                } else {
                  console.warn("onClose is not a function:", onClose);
                }
              }}
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
              { id: 'orbit', label: isAdminLobby || isIQACRoom || isPrincipalOffice || isCivilDept || isFMLab || isEELab || isCTLab || isIoTLab || isFirstFloorCompLab ? '👀 3D Overview' : '👀 3D Orbit' },
              { id: 'teacher', label: isAdminLobby ? '👩‍💼 Receptionist POV' : isIQACRoom ? '👔 Board POV' : isPrincipalOffice ? '👔 Principal Desk POV' : isCivilDept ? '👔 HOD Cabin POV' : isFMLab || isEELab || isCTLab || isIoTLab || isFirstFloorCompLab ? '👨‍🏫 Teacher POV' : '👨‍🏫 Teacher POV' },
              { id: 'student', label: isAdminLobby ? '🪑 Visitor POV' : isIQACRoom ? '🎤 Presenter POV' : isPrincipalOffice ? '🪑 Visitor Chair POV' : isCivilDept ? '👩‍🏫 Staff Room POV' : isFMLab || isEELab || isCTLab || isIoTLab || isFirstFloorCompLab ? '🎒 Student Bench POV' : '🎒 Student POV' },
              { id: 'cctv', label: isFMLab ? '💧 Rigs POV' : isEELab ? '🔬 Jar Test POV' : isCTLab ? '🏗️ UTM POV' : isIoTLab ? '📟 IoT Kit POV' : isFirstFloorCompLab ? '🖥️ PC Rows POV' : '📹 CCTV Cam' },
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

          {/* Teacher & Active Course Banner (Hidden for Non-Timetable Facilities) */}
          {!isNonTimetableFacility && (
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
          )}

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
              {isAdminLobby ? (
                <>
                  <span>👥 Visitor Seating: <b className="text-emerald-400">12 Chairs in Rows</b></span>
                  <span>👩‍💼 Core Staff: <b className="text-cyan-300">Registrar & Accounts</b></span>
                  <span>🏛️ Administration: <b className="text-white">Central Lobby</b></span>
                  <span>💡 Ceiling: <b className="text-white">Coffered Grid + Amber Bulbs</b></span>
                </>
              ) : isIQACRoom ? (
                <>
                  <span>🪑 Seating: <b className="text-emerald-400">12 Mesh & 2 Leather Executive Chairs</b></span>
                  <span>💡 Ceiling: <b className="text-cyan-300">Teak Wood Slat + LED Spotlights</b></span>
                  <span>📽️ Equipment: <b className="text-white">Ceiling Projector & Tripod Board</b></span>
                  <span>🏛️ Facility: <b className="text-white">Internal Quality Assurance Cell</b></span>
                </>
              ) : isPrincipalOffice ? (
                <>
                  <span>👤 Principal: <b className="text-emerald-400">Executive Cabin</b></span>
                  <span>🧱 Wall: <b className="text-cyan-300">Stacked Slate Stone Tile</b></span>
                  <span>🖥️ Setup: <b className="text-white">Dual Monitor & Printer</b></span>
                  <span>🪑 Seating: <b className="text-white">3 Visitor Chairs & Sofa</b></span>
                </>
              ) : isCivilDept ? (
                <>
                  <span>👨‍🏫 HOD Cabin: <b className="text-emerald-400">Separate Executive Suite</b></span>
                  <span>🏢 Staff Room: <b className="text-cyan-300">4 Faculty Workstations</b></span>
                  <span>🧱 Walls: <b className="text-white">Yellow Plaster & Tan Drapes</b></span>
                  <span>🪑 Seating: <b className="text-white">HOD Chair & 2 Red Visitor Chairs</b></span>
                </>
              ) : isFMLab ? (
                <>
                  <span>💧 Equipment: <b className="text-emerald-400">Venturimeter, Bernoulli & Pump Rigs</b></span>
                  <span>👥 Seated Class: <b className="text-cyan-300">6 Students on Wooden Benches</b></span>
                  <span>👨‍🏫 Faculty: <b className="text-white">Professor & Instructor</b></span>
                  <span>📊 Wall Charts: <b className="text-white">Flow Formulas & Manometer Scales</b></span>
                </>
              ) : isEELab ? (
                <>
                  <span>🔬 Equipment: <b className="text-emerald-400">Jar Test Machine & pH Meters</b></span>
                  <span>🧪 Workstation: <b className="text-cyan-300">White Tiled Island Bench & Sinks</b></span>
                  <span>👥 Seated Class: <b className="text-white">6 Students on Light Wood Benches</b></span>
                  <span>📊 Wall Clock: <b className="text-white">Oval Clock & BOD Incubator</b></span>
                </>
              ) : isCTLab ? (
                <>
                  <span>🏗️ Compression UTM: <b className="text-emerald-400">2000kN Machine & Dial Console</b></span>
                  <span>🧪 Workbenches: <b className="text-cyan-300">Pink Tiled Tables & Slump Cones</b></span>
                  <span>👥 Lab Class: <b className="text-white">6 Students in Blue Lab Coats</b></span>
                  <span>📊 Cube Moulds: <b className="text-white">150mm Steel Moulds & Vibrating Table</b></span>
                </>
              ) : isIoTLab ? (
                <>
                  <span>📟 Trainer Kit: <b className="text-emerald-400">8051 / ESP32 Wooden Briefcase & LCD 16x2</b></span>
                  <span>🖥️ Workstations: <b className="text-cyan-300">Teak Wood Counters & Power Socket Trunking</b></span>
                  <span>👥 Lab Class: <b className="text-white">6 Students at PC Workstations</b></span>
                  <span>🪑 Seating: <b className="text-white">Wooden Lab Stools & Blue Discussion Chairs</b></span>
                </>
              ) : isFirstFloorCompLab ? (
                <>
                  <span>💻 Workstations: <b className="text-emerald-400">20 HP Widescreen LCD Monitors & Desks</b></span>
                  <span>🛡️ Privacy: <b className="text-cyan-300">Center Modesty Dividers & Power Channels</b></span>
                  <span>👥 Lab Class: <b className="text-white">6 Students in Blue Swivel Chairs</b></span>
                  <span>📽️ Equipment: <b className="text-white">Ceiling Projector & Split AC Units</b></span>
                </>
              ) : (
                <>
                  <span>👥 Students Seated: <b className="text-emerald-400">20 Students in Rows</b></span>
                  <span>👩‍🏫 Teacher: <b className="text-cyan-300">{teacherName}</b></span>
                  <span>🪑 Total Capacity: <b className="text-white">{isBoardRoom ? '18 Seats' : '65 Seats'}</b></span>
                  <span>💡 False Ceiling: <b className="text-white">Active LED Grid</b></span>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}

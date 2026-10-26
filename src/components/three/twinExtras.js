// twinExtras.js — scene systems for the MVSR digital twin that sit on top of the campus model:
// real sun position, live class sessions from the timetable, campus crowds, wayfinding signs,
// landscaping and the arrival fly-in. Kept free of React so SuhruthDigitalTwin.jsx only wires them up.
import * as THREE from 'three';

// ══════════════════════════════════════════════════════════════════════════════
// Time & sun
// ══════════════════════════════════════════════════════════════════════════════

/** Day of week (0 = Monday, as in the backend's weekday()) and minutes since midnight in IST. */
export function istNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  return { dow, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const fmtMinutes = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Approximate solar position (accurate to well under a degree, plenty for lighting).
 * Returns azimuth (radians, clockwise from true north) and elevation (radians above the horizon).
 */
export function solarPosition(date, lat, lon) {
  const rad = Math.PI / 180;
  const d = date.getTime() / 86400000 - 10957.5; // days since J2000.0
  const g = ((357.529 + 0.98560028 * d) % 360) * rad;
  const q = (280.459 + 0.98564736 * d) % 360;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = ((gmst + lon / 15) * 15) * rad - ra;
  const phi = lat * rad;
  const elevation = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const azimuth = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  return { azimuth: (azimuth + 2 * Math.PI) % (2 * Math.PI), elevation };
}

/**
 * Unit vector toward a sky position, in scene axes (x = campus east, z = campus south, y = up).
 * gridRotation is how far the campus grid is turned clockwise from true north.
 */
export function skyDirection(azimuth, elevation, gridRotation) {
  const east = Math.sin(azimuth) * Math.cos(elevation);
  const south = -Math.cos(azimuth) * Math.cos(elevation);
  return new THREE.Vector3(
    east * Math.cos(gridRotation) + south * Math.sin(gridRotation),
    Math.sin(elevation),
    -east * Math.sin(gridRotation) + south * Math.cos(gridRotation),
  ).normalize();
}

// ══════════════════════════════════════════════════════════════════════════════
// Timetable: periods, live sessions, campus phase
// ══════════════════════════════════════════════════════════════════════════════

/** Distinct class periods [{ n, start, end }] (minutes), from the timetable entries. */
export function periodsFrom(entries) {
  const byNumber = new Map();
  entries.forEach((e) => {
    if (!byNumber.has(e.period_number)) {
      byNumber.set(e.period_number, { n: e.period_number, start: toMinutes(e.start_time), end: toMinutes(e.end_time) });
    }
  });
  return [...byNumber.values()].sort((a, b) => a.start - b.start);
}

/** Classes in session right now, grouped by building id: { [buildingId]: [session, ...] }. */
export function liveSessionsByBuilding(entries, classrooms, { dow, minutes }) {
  const buildingOf = new Map(classrooms.map((c) => [c.id, { building: c.building, name: c.name }]));
  const out = {};
  entries.forEach((e) => {
    if (e.day_of_week !== dow) return;
    if (minutes < toMinutes(e.start_time) || minutes >= toMinutes(e.end_time)) return;
    const room = buildingOf.get(e.classroom_id);
    if (!room?.building) return;
    (out[room.building] ||= []).push({
      room: room.name || e.classroom_id, subject: e.subject_name, faculty: e.faculty_name,
      section: e.section, start: e.start_time, end: e.end_time,
    });
  });
  return out;
}

/**
 * What the campus is doing at this time, from the class periods:
 * { phase, label, crowd (0..1 share of the crowd pool walking) }.
 */
export function campusPhase(periods, { dow, minutes }) {
  if (!periods.length || dow === 6) {
    return { phase: 'closed', label: dow === 6 ? 'Sunday · campus closed' : 'No timetable loaded', crowd: 0.05 };
  }
  const first = periods[0];
  const last = periods[periods.length - 1];
  if (minutes >= first.start - 45 && minutes < first.start) {
    return { phase: 'arrival', label: `Students arriving · Period ${first.n} at ${fmtMinutes(first.start)}`, crowd: 0.85 };
  }
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (minutes >= p.start && minutes < p.end) {
      // The first and last few minutes of a period still have stragglers on the paths
      const edge = minutes - p.start < 5 || p.end - minutes <= 3;
      return { phase: 'class', label: `Period ${p.n} · ${fmtMinutes(p.start)}–${fmtMinutes(p.end)}`, crowd: edge ? 0.45 : 0.12 };
    }
    const next = periods[i + 1];
    if (next && minutes >= p.end && minutes < next.start) {
      const lunch = next.start - p.end >= 30;
      return {
        phase: lunch ? 'lunch' : 'break',
        label: `${lunch ? 'Lunch break' : 'Short break'} · Period ${next.n} at ${fmtMinutes(next.start)}`,
        crowd: lunch ? 0.8 : 1,
      };
    }
  }
  if (minutes >= last.end && minutes < last.end + 45) return { phase: 'leaving', label: 'Classes over · students leaving', crowd: 0.85 };
  if (minutes >= last.end && minutes < 21 * 60) return { phase: 'evening', label: 'After hours · hostel students around', crowd: 0.2 };
  return { phase: 'closed', label: 'Night · campus quiet', crowd: 0.03 };
}

// ══════════════════════════════════════════════════════════════════════════════
// Canvas text
// ══════════════════════════════════════════════════════════════════════════════

/** Draw centred lines of text on a coloured board and return it as a texture. */
export function textTexture(lines, { width = 512, height = 128, bg = '#0D2137', fg = '#FFFFFF', font = 'bold 54px sans-serif', border = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = Math.max(4, height * 0.05);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
  }
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const list = Array.isArray(lines) ? lines : [lines];
  list.forEach((line, i) => {
    const f = typeof line === 'object' ? line.font : font;
    const text = typeof line === 'object' ? line.text : line;
    ctx.font = f;
    // shrink to fit
    let size = parseInt(f.match(/(\d+)px/)[1], 10);
    while (ctx.measureText(text).width > width * 0.92 && size > 10) {
      size -= 2;
      ctx.font = f.replace(/\d+px/, `${size}px`);
    }
    ctx.fillText(text, width / 2, (height / (list.length + 1)) * (i + 1));
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A two-sided board: separate textures for its front (+z) and back (-z) faces. */
function twoSidedBoard(w, h, frontTex, backTex, frameColor = 0x1E293B) {
  const grp = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.08), new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.6 }));
  grp.add(frame);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: frontTex }));
  front.position.z = 0.045;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: backTex }));
  back.position.z = -0.045;
  back.rotation.y = Math.PI;
  grp.add(front, back);
  return grp;
}

// ══════════════════════════════════════════════════════════════════════════════
// Wayfinding
// ══════════════════════════════════════════════════════════════════════════════

const HEADING = { east: 0, north: Math.PI / 2, west: Math.PI, south: -Math.PI / 2 }; // scene north = -z

/** Fingerpost: boards = [{ label, heading: 'east' | 'west' | 'north' | 'south' }], top board first. */
export function createSignpost(x, z, boards) {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 });
  const poleH = 3.2 + boards.length * 0.75;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, poleH, 10), poleMat);
  pole.position.y = poleH / 2;
  pole.castShadow = true;
  grp.add(pole);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.7, roughness: 0.3 }));
  cap.position.y = poleH + 0.05;
  grp.add(cap);

  boards.forEach(({ label, heading }, i) => {
    const arm = new THREE.Group();
    arm.position.y = poleH - 0.45 - i * 0.75;
    arm.rotation.y = HEADING[heading];
    const style = { width: 640, height: 96, bg: '#0D2137', fg: '#F8FAFC', font: 'bold 46px sans-serif' };
    // Board points along local +x: read from +z its arrow points right, from -z it points left
    const board = twoSidedBoard(2.9, 0.48, textTexture(`${label}  ➜`, style), textTexture(`⬅  ${label}`, style), 0xD4AF37);
    board.position.x = 1.55;
    arm.add(board);
    grp.add(arm);
  });
  return grp;
}

/** Low entrance plaque with the building name, facing along rotY (local +z). */
export function createPlaque(x, z, rotY, name, accent = '#00B4D8') {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  grp.rotation.y = rotY;
  const stone = new THREE.MeshStandardMaterial({ color: 0x9CA3AF, roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.4, 0.9), stone);
  base.position.y = 0.2;
  base.castShadow = true;
  grp.add(base);
  const tex = textTexture([{ text: name.toUpperCase(), font: 'bold 50px sans-serif' }, { text: 'MVSR ENGINEERING COLLEGE', font: '600 26px sans-serif' }],
    { width: 640, height: 200, bg: '#0F172A', fg: '#F1F5F9', border: accent });
  const board = twoSidedBoard(3.4, 1.06, tex, tex, 0x111827);
  board.position.y = 1.05;
  grp.add(board);
  return grp;
}

// ══════════════════════════════════════════════════════════════════════════════
// Landscaping
// ══════════════════════════════════════════════════════════════════════════════

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const FLOWER_COLORS = [0xE11D48, 0xF59E0B, 0xFDE047, 0xF97316, 0xEC4899, 0xFFFFFF, 0xA855F7];

/** Raised flower bed (w along x, d along z) with instanced blooms and a few shrubs. */
export function createFlowerBed(x, z, w, d, seed = 1) {
  const rand = seededRandom(seed * 7919 + 13);
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  const curb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), new THREE.MeshStandardMaterial({ color: 0xB8B2A6, roughness: 0.9 }));
  curb.position.y = 0.175;
  curb.receiveShadow = true;
  grp.add(curb);
  const soil = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.06, d - 0.3), new THREE.MeshStandardMaterial({ color: 0x5B3A1E, roughness: 1 }));
  soil.position.y = 0.36;
  grp.add(soil);

  const count = Math.max(6, Math.round(w * d * 4));
  const blooms = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshStandardMaterial({ roughness: 0.7 }), count);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const s = 0.7 + rand() * 0.6;
    m.makeScale(s, s, s).setPosition((rand() - 0.5) * (w - 0.5), 0.5 + rand() * 0.12, (rand() - 0.5) * (d - 0.5));
    blooms.setMatrixAt(i, m);
    blooms.setColorAt(i, c.setHex(FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)]));
  }
  grp.add(blooms);

  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x2F6B2A, roughness: 0.9 });
  const shrubs = Math.max(1, Math.round(w / 5));
  for (let i = 0; i < shrubs; i++) {
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), shrubMat);
    shrub.position.set(-w / 2 + (w / shrubs) * (i + 0.5), 0.7, 0);
    shrub.scale.y = 0.8;
    shrub.castShadow = true;
    grp.add(shrub);
  }
  return grp;
}

/** Lawn, corner planters and a shade tree for a building courtyard (building-local coordinates). */
export function createCourtyardGarden(court) {
  const grp = new THREE.Group();
  const lawn = new THREE.Mesh(new THREE.BoxGeometry(court.w - 0.6, 0.12, court.d - 0.6), new THREE.MeshStandardMaterial({ color: 0x5E9E4B, roughness: 1 }));
  lawn.position.y = 0.06;
  lawn.receiveShadow = true;
  grp.add(lawn);
  const path = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, court.d - 0.6), new THREE.MeshStandardMaterial({ color: 0xC9C4B8, roughness: 1 }));
  path.position.y = 0.07;
  grp.add(path);

  const planterMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.8 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3E7D2E, roughness: 0.9 });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const px = sx * (court.w / 2 - 1.3);
    const pz = sz * (court.d / 2 - 1.3);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.7, 12), planterMat);
    pot.position.set(px, 0.35, pz);
    grp.add(pot);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), leafMat);
    bush.position.set(px, 1.1, pz);
    grp.add(bush);
  });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x4A3525, roughness: 0.9 }));
  trunk.position.set(court.w / 4, 1.6, 0);
  grp.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(Math.min(2.6, court.w / 4), 10, 8), leafMat);
  crown.position.set(court.w / 4, 4.2, 0);
  crown.castShadow = true;
  grp.add(crown);
  return grp;
}

/**
 * Walkway lamp. Returns the same shape as a street light entry ({ bulbMat, light1, light2 })
 * so the twin's night mode and light-pool decals treat it like the boulevard lamps.
 */
export function createBollardLamp(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const metal = new THREE.MeshStandardMaterial({ color: 0x1F2937, metalness: 0.6, roughness: 0.4 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3, 8), metal);
  post.position.y = 1.5;
  group.add(post);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.25, 12), metal);
  hood.position.y = 3.1;
  group.add(hood);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), bulbMat);
  bulb.position.y = 2.9;
  group.add(bulb);
  const light1 = new THREE.PointLight(0xffddaa, 0, 14, 1.5);
  light1.position.set(0, 2.9, 0.4);
  const light2 = new THREE.PointLight(0xffddaa, 0, 14, 1.5);
  light2.position.set(0, 2.9, -0.4);
  group.add(light1, light2);
  return { group, bulbMat, light1, light2 };
}

// ══════════════════════════════════════════════════════════════════════════════
// Live session markers
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Pulsing outline on the ground, a "LIVE" badge and (at night) a warm window glow around a
 * building footprint { x, z, w, d }. setCount(n) shows/hides it; update(time, night) animates it.
 */
export function createLiveMarker(fp, badgeHeight, glowHeight) {
  const grp = new THREE.Group();
  grp.position.set(fp.x, 0, fp.z);
  grp.visible = false;

  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF, transparent: true, opacity: 0.8, depthWrite: false });
  const pad = 2.2, t = 0.6;
  [[0, -(fp.d / 2 + pad), fp.w + pad * 2, t], [0, fp.d / 2 + pad, fp.w + pad * 2, t],
    [-(fp.w / 2 + pad), 0, t, fp.d + pad * 2], [fp.w / 2 + pad, 0, t, fp.d + pad * 2]].forEach(([x, z, w, d]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), ringMat);
    bar.position.set(x, 0.45, z);
    grp.add(bar);
  });

  // Warm "lit windows" shell, only shown at night
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xFFB347, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(fp.w + 0.6, glowHeight, fp.d + 0.6), glowMat);
  glow.position.y = glowHeight / 2;
  glow.visible = false;
  grp.add(glow);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  badge.scale.set(16, 4, 1);
  badge.position.y = badgeHeight;
  badge.renderOrder = 1000;
  grp.add(badge);

  let shown = -1;
  const setCount = (n) => {
    grp.visible = n > 0;
    if (n === shown || n <= 0) { shown = n; return; }
    shown = n;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(8,47,73,0.92)';
    ctx.beginPath();
    ctx.roundRect(4, 14, 504, 100, 50);
    ctx.fill();
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#FF3B5C';
    ctx.beginPath();
    ctx.arc(62, 64, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E0FBFF';
    ctx.font = 'bold 46px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LIVE · ${n} class${n === 1 ? '' : 'es'}`, 96, 66);
    tex.needsUpdate = true;
  };

  const update = (time, night) => {
    if (!grp.visible) return;
    ringMat.opacity = 0.45 + Math.sin(time * 3) * 0.35;
    glow.visible = night;
  };
  return { group: grp, setCount, update };
}

// ══════════════════════════════════════════════════════════════════════════════
// Document tokens (Student Services): a glowing envelope over the building where a
// request is right now; it flies in an arc to the next desk when an approver signs.
// ══════════════════════════════════════════════════════════════════════════════

const TOKEN_HEIGHT = 22;
const FLIGHT_SECONDS = 3;

function glowTexture(rgb) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},0.9)`);
  g.addColorStop(0.4, `rgba(${rgb},0.35)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function createDocToken() {
  const group = new THREE.Group();
  const float = new THREE.Group();          // bobbing part (envelope, glow, label)
  float.position.y = TOKEN_HEIGHT;
  group.add(float);

  const paperMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, emissive: 0x00E5FF, emissiveIntensity: 0.35, roughness: 0.4 });
  const envelope = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 2.3), paperMat);
  const flap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.05, 3), paperMat);
  flap.rotation.y = Math.PI / 2;
  flap.position.set(0, 0.18, -0.35);
  flap.scale.set(1, 1, 0.75);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0xDC2626, emissive: 0x7F1D1D }));
  seal.position.set(0, 0.2, 0.15);
  const envelopeGrp = new THREE.Group();
  envelopeGrp.add(envelope, flap, seal);
  envelopeGrp.rotation.x = -0.35;
  float.add(envelopeGrp);

  const glowMats = {
    review: new THREE.SpriteMaterial({ map: glowTexture('0,229,255'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    overdue: new THREE.SpriteMaterial({ map: glowTexture('255,70,90'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    ready: new THREE.SpriteMaterial({ map: glowTexture('52,211,153'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    quest: new THREE.SpriteMaterial({ map: glowTexture('251,191,36'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  // Per-tone colours: beam/emissive, label background, label border
  const TONES = {
    review: [0x00E5FF, 'rgba(8,47,73,0.92)', '#00E5FF'],
    overdue: [0xFF465A, 'rgba(76,5,25,0.92)', '#FF465A'],
    ready: [0x34D399, 'rgba(2,44,34,0.92)', '#34D399'],
    quest: [0xFBBF24, 'rgba(69,26,3,0.92)', '#FBBF24'],   // Joining Day: next stop
  };
  const glow = new THREE.Sprite(glowMats.review);
  glow.scale.set(11, 11, 1);
  float.add(glow);

  // Beam from the envelope down to the building it is at
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.5, TOKEN_HEIGHT, 10, 1, true), beamMat);
  beam.position.y = TOKEN_HEIGHT / 2;
  group.add(beam);

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 112;
  const labelTex = new THREE.CanvasTexture(canvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, depthTest: false, transparent: true }));
  label.scale.set(20, 3.5, 1);
  label.position.y = 4.2;
  label.renderOrder = 1001;
  float.add(label);

  let tone = 'review';
  let lastText = '';
  const setInfo = (text, nextTone) => {
    tone = nextTone;
    glow.material = glowMats[tone];
    beamMat.color.setHex(TONES[tone][0]);
    paperMat.emissive.setHex(TONES[tone][0]);
    if (text === lastText) return;
    lastText = text;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = TONES[tone][1];
    ctx.beginPath();
    ctx.roundRect(4, 8, canvas.width - 8, canvas.height - 16, 44);
    ctx.fill();
    ctx.strokeStyle = TONES[tone][2];
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#F1F5F9';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 40;
    while (ctx.measureText(text).width > canvas.width - 50 && size > 18) {
      size -= 2;
      ctx.font = `bold ${size}px sans-serif`;
    }
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    labelTex.needsUpdate = true;
  };

  // Flight between buildings
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  let flightT = 1;
  const moveTo = (x, z, instant = false) => {
    if (instant) {
      group.position.set(x, 0, z);
      to.set(x, 0, z);
      flightT = 1;
      return;
    }
    if (Math.abs(to.x - x) < 0.01 && Math.abs(to.z - z) < 0.01) return;
    from.copy(group.position);
    to.set(x, 0, z);
    flightT = 0;
  };

  const update = (dt, time) => {
    if (flightT < 1) {
      flightT = Math.min(1, flightT + dt / FLIGHT_SECONDS);
      const e = flightT * flightT * (3 - 2 * flightT);
      group.position.lerpVectors(from, to, e);
      // Rise in an arc on the way; the beam hides while flying
      float.position.y = TOKEN_HEIGHT + Math.sin(e * Math.PI) * 18;
      beam.visible = flightT >= 1;
    } else {
      float.position.y = TOKEN_HEIGHT + Math.sin(time * 2) * 0.6;
    }
    envelopeGrp.rotation.y = time * 0.8;
    const pulse = tone === 'ready' ? 0.5 : 0.35 + Math.sin(time * (tone === 'overdue' ? 6 : tone === 'quest' ? 4 : 3)) * 0.2;
    paperMat.emissiveIntensity = pulse;
    beamMat.opacity = 0.2 + pulse * 0.4;
  };

  // Everything clickable shares one userData object
  const pickables = [envelope, flap, seal, label];
  const setUserData = (ud) => pickables.forEach((m) => { m.userData = ud; });

  const dispose = () => {
    group.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material && !Object.values(glowMats).includes(o.material)) o.material.dispose?.();
    });
    Object.values(glowMats).forEach((m) => { m.map.dispose(); m.dispose(); });
    labelTex.dispose();
  };

  return { group, setInfo, moveTo, update, setUserData, pickables, dispose };
}

// ══════════════════════════════════════════════════════════════════════════════
// No-dues clearance pins (leaving the college): a coloured outline around each
// section's building and a badge on a pole — amber waiting, red dues, green cleared.
// ══════════════════════════════════════════════════════════════════════════════

const CLEARANCE_TONES = {
  pending: { hex: 0xFBBF24, css: '#FBBF24', bg: 'rgba(69,26,3,0.92)', mark: '…' },
  dues:    { hex: 0xFF465A, css: '#FF465A', bg: 'rgba(76,5,25,0.92)', mark: '₹' },
  cleared: { hex: 0x34D399, css: '#34D399', bg: 'rgba(2,44,34,0.92)', mark: '✓' },
};

/** fp: footprint { x, z, w, d }; roof: building height. setState(status, text) recolours it. */
export function createClearancePin(fp, roof) {
  const grp = new THREE.Group();
  grp.position.set(fp.x, 0, fp.z);

  const ringMat = new THREE.MeshBasicMaterial({ color: CLEARANCE_TONES.pending.hex, transparent: true, opacity: 0.85, depthWrite: false });
  const pad = 4.5, t = 0.9;
  [[0, -(fp.d / 2 + pad), fp.w + pad * 2, t], [0, fp.d / 2 + pad, fp.w + pad * 2, t],
    [-(fp.w / 2 + pad), 0, t, fp.d + pad * 2], [fp.w / 2 + pad, 0, t, fp.d + pad * 2]].forEach(([x, z, w, d]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), ringMat);
    bar.position.set(x, 0.5, z);
    grp.add(bar);
  });

  // Pole from the building's north-west corner up to the badge
  const cornerX = -fp.w / 2 + 2, cornerZ = -fp.d / 2 + 2;
  const top = roof + 9;
  const poleMat = new THREE.MeshBasicMaterial({ color: CLEARANCE_TONES.pending.hex, transparent: true, opacity: 0.7, depthWrite: false });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, top - 0.5, 8), poleMat);
  pole.position.set(cornerX, (top - 0.5) / 2 + 0.5, cornerZ);
  grp.add(pole);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  badge.scale.set(16, 3.5, 1);
  badge.position.set(cornerX, top + 1.6, cornerZ);
  badge.renderOrder = 1002;
  grp.add(badge);

  let status = 'pending';
  let lastText = '';
  const setState = (nextStatus, text) => {
    status = nextStatus;
    const tone = CLEARANCE_TONES[status];
    ringMat.color.setHex(tone.hex);
    poleMat.color.setHex(tone.hex);
    if (text + status === lastText) return;
    lastText = text + status;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 112);
    ctx.fillStyle = tone.bg;
    ctx.beginPath();
    ctx.roundRect(4, 10, 504, 92, 46);
    ctx.fill();
    ctx.strokeStyle = tone.css;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = tone.css;
    ctx.beginPath();
    ctx.arc(56, 56, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0B1220';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tone.mark, 56, 58);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    let size = 38;
    ctx.font = `bold ${size}px sans-serif`;
    while (ctx.measureText(text).width > 400 && size > 22) { size -= 2; ctx.font = `bold ${size}px sans-serif`; }
    ctx.fillText(text, 100, 58);
    tex.needsUpdate = true;
  };

  const update = (time) => {
    // Waiting and dues pulse; cleared stays steady
    ringMat.opacity = status === 'cleared' ? 0.75 : 0.5 + Math.sin(time * 2.5) * 0.35;
  };

  const pickables = [badge];
  const setUserData = (ud) => { badge.userData = ud; };
  const dispose = () => {
    grp.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    tex.dispose();
  };
  return { group: grp, setState, update, setUserData, pickables, dispose };
}

// ══════════════════════════════════════════════════════════════════════════════
// Crowds
// ══════════════════════════════════════════════════════════════════════════════

function shortestPath(adjacency, from, to) {
  const dist = { [from]: 0 };
  const prev = {};
  const open = new Set([from]);
  const done = new Set();
  while (open.size) {
    let u = null;
    open.forEach((k) => { if (u === null || dist[k] < dist[u]) u = k; });
    open.delete(u);
    if (u === to) break;
    done.add(u);
    (adjacency[u] || []).forEach(({ to: v, w }) => {
      if (done.has(v)) return;
      const alt = dist[u] + w;
      if (dist[v] === undefined || alt < dist[v]) { dist[v] = alt; prev[v] = u; open.add(v); }
    });
  }
  if (dist[to] === undefined) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return path;
}

const ACADEMIC = ['civilit', 'mecheee', 'cse', 'ece', 'sh', 'exam', 'cad', 'rnd', 'lib', 'placement'];
const ARRIVALS = ['frontgate', 'frontgate', 'frontgate', 'backgate', 'boyshostel', 'girlshostel'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** Where a new walker goes in each campus phase: [from, to] building ids. */
function tripFor(phase) {
  switch (phase) {
    case 'arrival': return [pick(ARRIVALS), pick(ACADEMIC)];
    case 'leaving': return [pick(ACADEMIC), pick(ARRIVALS)];
    case 'lunch':   return [pick(ACADEMIC), Math.random() < 0.7 ? 'cant' : pick(['lib', 'placement', 'boyshostel', 'girlshostel'])];
    case 'evening':
    case 'closed':  return [pick(['boyshostel', 'girlshostel']), pick(['cant', 'lib', 'boyshostel', 'girlshostel'])];
    default:        return [pick([...ACADEMIC, 'cant']), pick([...ACADEMIC, 'cant'])];
  }
}

const SHIRTS = [0x3B82F6, 0xEF4444, 0x10B981, 0xF59E0B, 0x8B5CF6, 0xEC4899, 0xFFFFFF, 0x0EA5E9, 0x14B8A6, 0xF97316];
const PANTS = [0x1E293B, 0x0F172A, 0x334155, 0x1E3A8A, 0x3F3F46];

/**
 * A pool of students who walk the campus graph between buildings. update(dt, time, phase)
 * keeps round(phase.crowd * poolSize) of them walking, each on a fresh trip for the phase.
 */
export function createCrowd({ scene, poolSize, makeStudent, nodes, adjacency }) {
  const group = new THREE.Group();
  scene.add(group);
  const walkers = [];
  for (let i = 0; i < poolSize; i++) {
    const s = makeStudent(SHIRTS[i % SHIRTS.length], PANTS[i % PANTS.length]);
    s.group.visible = false;
    group.add(s.group);
    walkers.push({ ...s, active: false, pts: null, seg: 0, segT: 0, speed: 1.3, phaseOffset: Math.random() * 6 });
  }

  const startTrip = (w, phase) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const [from, to] = tripFor(phase);
      if (from === to || !nodes[from] || !nodes[to]) continue;
      const ids = shortestPath(adjacency, from, to);
      if (!ids || ids.length < 2) continue;
      // Keep to one side of the walkway so walkers don't all share the centreline
      const side = (Math.random() - 0.5) * 2.4;
      w.pts = ids.map((id) => new THREE.Vector3(nodes[id].x + side, 0, nodes[id].z + side));
      // Mid-trip on spawn, so a crowd appears spread out instead of bunched at the doors
      w.seg = Math.floor(Math.random() * (w.pts.length - 1) * 0.6);
      w.segT = Math.random();
      w.speed = 1.2 + Math.random() * 0.6;
      w.active = true;
      w.group.visible = true;
      return;
    }
  };

  const dir = new THREE.Vector3();
  const update = (dt, time, phase) => {
    const target = Math.round(phase.crowd * poolSize);
    let active = walkers.filter((w) => w.active).length;
    for (const w of walkers) {
      if (active >= target) break;
      if (!w.active) { startTrip(w, phase.phase); active++; }
    }

    walkers.forEach((w) => {
      if (!w.active) return;
      const a = w.pts[w.seg];
      const b = w.pts[w.seg + 1];
      const len = Math.max(0.01, a.distanceTo(b));
      w.segT += (dt * w.speed) / len;
      while (w.segT >= 1 && w.active) {
        w.segT -= 1;
        w.seg++;
        if (w.seg >= w.pts.length - 1) {
          // Arrived: walk on with a new trip, or step out of view when the crowd is thinning
          w.active = false;
          w.group.visible = false;
          if (walkers.filter((o) => o.active).length < target) startTrip(w, phase.phase);
        }
      }
      if (!w.active) return;
      const p = w.pts[w.seg];
      const q = w.pts[w.seg + 1];
      w.group.position.lerpVectors(p, q, w.segT);
      dir.subVectors(q, p);
      w.group.rotation.y = Math.atan2(dir.x, dir.z);
      const swing = Math.sin((time + w.phaseOffset) * 7 * (w.speed / 1.4)) * 0.4;
      w.legL.rotation.x = swing;
      w.legR.rotation.x = -swing;
      w.armL.rotation.x = -swing;
      w.armR.rotation.x = swing;
    });
  };
  return { group, update };
}

// ══════════════════════════════════════════════════════════════════════════════
// Arrival fly-in
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Camera path from the Badangpet road, in through the main gate, down the boulevard and up to
 * the orbit view that ends at endPos looking at endTarget. Returns sample(t) for t in [0, 1].
 */
export function createIntroPath(endPos, endTarget) {
  const pos = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-330, 16, -18),
    new THREE.Vector3(-262, 7, -20),
    new THREE.Vector3(-215, 5.5, -20),
    new THREE.Vector3(-150, 6, -20),
    new THREE.Vector3(-80, 9, -19),
    new THREE.Vector3(-20, 30, 5),
    new THREE.Vector3(80, 95, 90),
    endPos.clone(),
  ], false, 'centripetal');
  const look = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-229, 6, -22),
    new THREE.Vector3(-160, 5, -20),
    new THREE.Vector3(-90, 6, -18),
    new THREE.Vector3(-40, 6, -10),
    new THREE.Vector3(-20, 5, 10),
    endTarget.clone(),
  ], false, 'centripetal');
  return (t) => {
    const e = t * t * (3 - 2 * t); // ease in-out
    return { position: pos.getPointAt(e), target: look.getPointAt(Math.min(1, e * 1.08)) };
  };
}

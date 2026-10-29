// guideAvatar.js — Mitra, the hologram guide who walks visitors across the twin. Free of React like
// twinExtras.js: SuhruthDigitalTwin.jsx creates her, calls update() every frame and walkTo() for each
// leg of a tour (planned by the backend, /ai/guide/chat).
import * as THREE from 'three';
import { shortestPath, textTexture } from './twinExtras.js';

const CYAN = 0x00e5ff;
const SCALE = 2.1;           // larger than life, so she reads at campus zoom
const MIN_SPEED = 9;         // world units / second
const MAX_LEG_SECONDS = 16;  // long walks speed up so no leg drags on

function holoMaterial(opacity) {
  return new THREE.MeshBasicMaterial({
    color: CYAN, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

/** A limb that swings from its top end (shoulder / hip). */
function limb(len, radius, mat, wire) {
  const pivot = new THREE.Group();
  const geo = new THREE.CapsuleGeometry(radius, len - radius * 2, 4, 10);
  const solid = new THREE.Mesh(geo, mat);
  const lines = new THREE.Mesh(geo, wire);
  solid.position.y = lines.position.y = -len / 2;
  pivot.add(solid, lines);
  return pivot;
}

/** The speech bubble: wrapped lines on a rounded card (works for Telugu / Devanagari with system fonts). */
function bubbleTexture(text) {
  const W = 1024, PAD = 40, LINE = 70, MAX_LINES = 3;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = '600 52px "Nirmala UI", "Noto Sans Telugu", "Noto Sans Devanagari", system-ui, sans-serif';
  ctx.font = font;
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > W - PAD * 2 && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > MAX_LINES) { lines.length = MAX_LINES; lines[MAX_LINES - 1] += ' …'; }
  canvas.width = W;
  canvas.height = PAD * 2 + lines.length * LINE + 30;
  const h = canvas.height - 30;
  ctx.fillStyle = 'rgba(4, 14, 32, 0.88)';
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.9)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(4, 4, W - 8, h - 8, 34);
  ctx.moveTo(W / 2 - 26, h - 4); ctx.lineTo(W / 2, h + 24); ctx.lineTo(W / 2 + 26, h - 4);
  ctx.fill();
  ctx.stroke();
  ctx.font = font;
  ctx.fillStyle = '#E6FBFF';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, PAD + LINE * (i + 0.5)));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: W / canvas.height };
}

/**
 * Mitra. nodes / adjacency are the twin's walking graph; buildings gives the centre she points at
 * on arrival. walkTo(placeId) resolves when she gets there. She starts hidden at `start`.
 */
export function createGuide({ scene, nodes, adjacency, buildings, start = 'frontgate' }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const body = new THREE.Group();     // everything that bobs; the ring stays on the ground
  body.scale.setScalar(SCALE);
  group.add(body);
  const solid = holoMaterial(0.42);
  const wire = new THREE.MeshBasicMaterial({ color: 0x9ff6ff, wireframe: true, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
  const add = (geo, y, mat = solid) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    body.add(m);
    return m;
  };
  add(new THREE.CapsuleGeometry(0.27, 0.62, 4, 14), 1.38);             // torso
  add(new THREE.CapsuleGeometry(0.28, 0.62, 4, 14), 1.38, wire);
  add(new THREE.ConeGeometry(0.36, 0.55, 18, 1, true), 0.98);          // kurta hem
  add(new THREE.SphereGeometry(0.24, 18, 14), 2.06);                   // head
  add(new THREE.SphereGeometry(0.25, 12, 10), 2.06, wire);
  const bun = add(new THREE.SphereGeometry(0.11, 10, 8), 2.2);         // hair bun
  bun.position.z = -0.2;

  const armL = limb(0.72, 0.075, solid, wire); armL.position.set(-0.36, 1.68, 0);
  const armR = limb(0.72, 0.075, solid, wire); armR.position.set(0.36, 1.68, 0);
  const legL = limb(0.86, 0.09, solid, wire);  legL.position.set(-0.13, 0.9, 0);
  const legR = limb(0.86, 0.09, solid, wire);  legR.position.set(0.13, 0.9, 0);
  body.add(armL, armR, legL, legR);

  // Halo ring and a faint beam of light: she's visible from the overview too
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.95, 48), holoMaterial(0.55));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(2.5, 2.62, 48, 1, 0, Math.PI * 1.4), holoMaterial(0.4));
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.1;
  const beamMat = holoMaterial(0.07);
  beamMat.side = THREE.DoubleSide;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 60, 24, 1, true), beamMat);
  beam.position.y = 30;
  const glow = new THREE.PointLight(CYAN, 6, 16, 2);
  glow.position.y = 3;
  group.add(ring, ring2, beam, glow);

  const tag = new THREE.Sprite(new THREE.SpriteMaterial({
    map: textTexture('MITRA · AI GUIDE', { width: 512, height: 96, bg: 'rgba(0,0,0,0)', fg: '#00E5FF', font: 'bold 44px sans-serif' }),
    transparent: true, depthWrite: false,
  }));
  tag.scale.set(6, 1.1, 1);
  tag.position.y = 6.2;
  group.add(tag);

  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  bubble.visible = false;
  bubble.renderOrder = 10;
  group.add(bubble);

  // ── State ───────────────────────────────────────────────────────────────────
  let at = start;
  const startNode = nodes[start];
  group.position.set(startNode.x, 0, startNode.z);
  let pts = null, seg = 0, segT = 0, speed = MIN_SPEED, arrive = null;
  let pointAt = null;       // the building / area centre she's pointing at
  let target = null;        // where this leg's pointing goes (null: the building at the node)
  let appear = 0;           // 0 → 1 materialise
  let wanted = false;
  const heading = new THREE.Vector3(0, 0, 1);
  const tmp = new THREE.Vector3();

  const centreOf = (id) => {
    const b = buildings.find((x) => x.id === id);
    return b ? new THREE.Vector3(b.x, 0, b.z) : null;
  };

  function nearestNode() {
    let best = at, bestD = Infinity;
    for (const id of Object.keys(adjacency)) {
      const n = nodes[id];
      const d = Math.hypot(n.x - group.position.x, n.z - group.position.z);
      if (d < bestD) { best = id; bestD = d; }
    }
    return best;
  }

  /**
   * Walk the paths to graph node `node`, then turn to `look` ({x, z}: an area such as the cricket ground)
   * or, without it, the building with that id, and point at it. Resolves on arrival.
   */
  function walkTo(node, look = null) {
    return new Promise((resolve) => {
      // A new leg replaces an unfinished one: re-route from the nearest path node, not through buildings
      const from = pts ? nearestNode() : at;
      arrive?.();
      target = look ? new THREE.Vector3(look.x, 0, look.z) : null;
      const ids = nodes[node] ? shortestPath(adjacency, from, node) : null;
      if (!ids || ids.length < 2) {            // already there (or unknown): just turn and point
        at = nodes[node] ? node : at;
        pts = null;
        pointAt = target || centreOf(at);
        resolve();
        return;
      }
      pts = [group.position.clone(), ...ids.slice(1).map((id) => new THREE.Vector3(nodes[id].x, 0, nodes[id].z))];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) total += pts[i].distanceTo(pts[i + 1]);
      speed = Math.max(MIN_SPEED, total / MAX_LEG_SECONDS);
      seg = 0; segT = 0; pointAt = null;
      arrive = () => { arrive = null; resolve(); };
      at = node;
    });
  }

  function say(text) {
    if (bubble.material.map) bubble.material.map.dispose();
    if (!text) { bubble.visible = false; bubble.material.map = null; return; }
    const { tex, aspect } = bubbleTexture(text);
    bubble.material.map = tex;
    bubble.material.needsUpdate = true;
    const h = 15 / aspect;
    bubble.scale.set(15, h, 1);
    bubble.position.y = 7.2 + h / 2;
    bubble.visible = true;
  }

  function update(dt, time) {
    appear = THREE.MathUtils.clamp(appear + (wanted ? dt : -dt) * 1.6, 0, 1);
    group.visible = appear > 0;
    if (!group.visible) return;
    body.scale.set(SCALE, SCALE * appear, SCALE);
    beam.scale.y = appear;

    const walking = !!pts;
    if (walking) {
      const a = pts[seg], b = pts[seg + 1];
      segT += (dt * speed) / Math.max(0.01, a.distanceTo(b));
      while (segT >= 1 && pts) {
        segT -= 1;
        seg++;
        if (seg >= pts.length - 1) {
          group.position.copy(pts[pts.length - 1]);
          pts = null;
          pointAt = target || centreOf(at);
          arrive?.();
        }
      }
      if (pts) {
        group.position.lerpVectors(pts[seg], pts[seg + 1], segT);
        heading.subVectors(pts[seg + 1], pts[seg]).normalize();
      }
    }

    // Face the way she walks, or the building she's presenting
    if (!pts && pointAt) heading.copy(tmp.subVectors(pointAt, group.position).setY(0).normalize());
    const yaw = Math.atan2(heading.x, heading.z);
    let d = yaw - group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    group.rotation.y += d * Math.min(1, dt * 8);

    const swing = pts ? Math.sin(time * 9) * 0.5 : 0;
    legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, swing, 0.3);
    legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, -swing, 0.3);
    armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, -swing * 0.8, 0.3);
    // Right arm: swings while walking, points (forward and up) at the building on arrival
    const point = !pts && pointAt ? -1.35 : swing * 0.8;
    armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, point, 0.12);
    armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, !pts && pointAt ? -0.25 : 0, 0.12);

    body.position.y = 0.25 + Math.sin(time * 2.2) * 0.12;        // she floats a little
    solid.opacity = 0.38 + Math.sin(time * 14) * 0.03 + (Math.sin(time * 1.3) > 0.97 ? -0.2 : 0);  // hologram flicker
    ring.rotation.z = time * 0.8;
    ring2.rotation.z = -time * 1.4;
    ring.material.opacity = 0.45 + Math.sin(time * 3) * 0.15;
  }

  /** Fast-forward the current leg (the visitor pressed Next). */
  function hurry() {
    if (pts) speed = Math.max(speed, 70);
  }

  /** Stop where she is (the tour was cancelled). */
  function halt() {
    if (!pts) return;
    pts = null;
    arrive = null;
    at = nearestNode();
  }

  return {
    group,
    walkTo,
    hurry,
    halt,
    say,
    update,
    show(v) { wanted = v; },
    get visible() { return group.visible; },
    get walking() { return !!pts; },
    get at() { return at; },
    position: group.position,
    heading,
  };
}

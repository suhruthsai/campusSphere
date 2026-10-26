// Scene performance helpers for the hand-built three.js scenes.
//
// The campus is modelled from thousands of small meshes (every window, post and
// stripe is its own mesh), which costs one draw call each — plus another in the
// shadow pass. Merging static meshes that share a material collapses those into
// a handful of draw calls without changing how anything looks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function isVisibleChain(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function attributeSignature(geometry) {
  const attrs = Object.keys(geometry.attributes).sort().map((name) => {
    const a = geometry.attributes[name];
    return `${name}:${a.itemSize}:${a.array.constructor.name}:${a.normalized}`;
  });
  return `${geometry.index ? 'i' : 'n'}|${attrs.join(',')}`;
}

/**
 * Merge static, opaque, non-interactive meshes that share a material.
 *
 * @param {THREE.Object3D} root   usually the scene (must have an identity transform)
 * @param {object} options
 * @param {Iterable<THREE.Object3D>} options.exclude  objects (and their descendants) to leave
 *        untouched — anything that moves, toggles visibility, is raycast-picked, or has its
 *        material changed per-object.
 * @returns {{ before: number, after: number }} mesh counts considered
 */
export function mergeStaticMeshes(root, { exclude = [] } = {}) {
  root.updateMatrixWorld(true);

  const excluded = new Set();
  for (const obj of exclude) obj?.traverse?.((c) => excluded.add(c));

  // How many meshes use each geometry, so we only dispose geometries nobody else needs
  const geometryUsers = new Map();
  root.traverse((o) => {
    if (o.isMesh) geometryUsers.set(o.geometry, (geometryUsers.get(o.geometry) || 0) + 1);
  });

  const buckets = new Map();
  const skipped = {};
  const skip = (reason) => { skipped[reason] = (skipped[reason] || 0) + 1; };
  root.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh) return;
    if (excluded.has(m)) return skip('excluded');
    if (m.children.length) return skip('has children');     // something is attached to it (e.g. a light)
    if (Array.isArray(m.material)) return skip('multi-material');
    if (m.material.transparent) return skip('transparent'); // keep per-object depth sorting
    // (geometry.groups are ignored here: BoxGeometry always has per-face groups, but
    //  with a single material they don't affect rendering)
    if (m.morphTargetInfluences) return skip('morph targets');
    if (!m.geometry.attributes.position) return skip('no position');
    if (!isVisibleChain(m)) return skip('hidden');
    // A mirrored transform flips triangle winding; only safe for double-sided materials
    if (m.matrixWorld.determinant() < 0 && m.material.side !== THREE.DoubleSide) return skip('mirrored');

    const key = [m.material.uuid, m.castShadow, m.receiveShadow, m.renderOrder, attributeSignature(m.geometry)].join('|');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
  });

  let before = 0;
  let after = 0;
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) { skip('unique material'); continue; }
    const geometries = meshes.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld));
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (!merged) continue;

    const first = meshes[0];
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.name = `merged:${first.material.name || first.material.type}`;
    mesh.matrixAutoUpdate = false; // static: never recompute its matrix
    root.add(mesh);

    for (const m of meshes) {
      m.parent.remove(m);
      const remaining = geometryUsers.get(m.geometry) - 1;
      geometryUsers.set(m.geometry, remaining);
      if (remaining === 0) m.geometry.dispose();
    }
    before += meshes.length;
    after += 1;
  }
  return { before, after, skipped };
}

const SKIP_KEYS = new Set(['uuid', 'id', 'name', 'version', 'userData', '_listeners', 'defines', 'onBuild', 'onBeforeRender', 'onBeforeCompile']);

function materialKey(m) {
  const parts = [m.type];
  for (const k of Object.keys(m).sort()) {
    if (SKIP_KEYS.has(k)) continue;
    const v = m[k];
    if (v === null || v === undefined || typeof v === 'function') parts.push(`${k}=-`);
    else if (typeof v !== 'object') parts.push(`${k}=${v}`);
    else if (v.isColor) parts.push(`${k}=#${v.getHexString()}`);
    else if (v.isTexture) parts.push(`${k}=t:${v.uuid}`);
    else if (v.isVector2 || v.isVector3 || v.isEuler) parts.push(`${k}=${v.toArray().join(',')}`);
    else return null; // something we can't compare safely (arrays, uniforms, ...): leave it alone
  }
  return parts.join('|');
}

/**
 * Make meshes that use identical-looking materials share one material instance, so
 * mergeStaticMeshes can combine them. Materials used by excluded objects, or listed in
 * `lockedMaterials` (because code mutates them later), are never replaced.
 */
export function dedupeMaterials(root, { exclude = [], lockedMaterials = [] } = {}) {
  const locked = new Set(lockedMaterials);
  for (const obj of exclude) obj?.traverse?.((c) => {
    (Array.isArray(c.material) ? c.material : c.material ? [c.material] : []).forEach((m) => locked.add(m));
  });

  // Materials also used by lines/points/sprites stay as they are
  root.traverse((o) => { if (!o.isMesh && o.material) [].concat(o.material).forEach((m) => locked.add(m)); });

  const canonical = new Map();
  const replaced = new Set();
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || locked.has(o.material)) return;
    const key = materialKey(o.material);
    if (key === null) return;
    const shared = canonical.get(key);
    if (!shared) { canonical.set(key, o.material); return; }
    if (shared !== o.material) { replaced.add(o.material); o.material = shared; }
  });
  replaced.forEach((m) => m.dispose());
  return { replaced: replaced.size, unique: canonical.size };
}

/** Free every geometry, material and texture under `root` (call when a scene unmounts). */
export function disposeObject(root) {
  const textures = new Set();
  const materials = new Set();
  root.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => materials.add(m));
  });
  for (const m of materials) {
    for (const value of Object.values(m)) if (value && value.isTexture) textures.add(value);
    m.dispose();
  }
  textures.forEach((t) => t.dispose());
}

/** Fully release a WebGLRenderer, including its GPU context (browsers cap live contexts at ~16). */
export function disposeRenderer(renderer) {
  renderer.dispose();
  renderer.forceContextLoss();
}

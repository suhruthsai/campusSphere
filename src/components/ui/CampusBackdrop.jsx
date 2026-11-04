// CampusBackdrop — the big campus picture behind the sign-in card and the dashboard heroes.
// Drop a real photo at  public/images/campus-hero.jpg  (wide, ~2000px, JPG) and it is used everywhere.
// Until then a drawn skyline (night in dark theme, golden hour in light theme) fills the same slot.
import { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext.jsx';

export const HERO_PHOTO = '/images/campus-hero.jpg';

let photoProbe = null;   // one check for the whole session, so a missing file isn't requested again and again
function probePhoto() {
  if (!photoProbe) {
    photoProbe = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = HERO_PHOTO;
    });
  }
  return photoProbe;
}

export default function CampusBackdrop({ className = '', position = 'center' }) {
  const [hasPhoto, setHasPhoto] = useState(false);
  useEffect(() => {
    let alive = true;
    probePhoto().then((ok) => { if (alive) setHasPhoto(ok); });
    return () => { alive = false; };
  }, []);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {hasPhoto
        ? <img src={HERO_PHOTO} alt="" className="h-full w-full object-cover" style={{ objectPosition: position }} />
        : <CampusSkyline />}
    </div>
  );
}

// Tiny seeded random, so the drawing is the same on every render
function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

const GROUND = 410;

// Main blocks: x, width, height, roof style
const BLOCKS = [
  { x: 40, w: 150, h: 150, roof: 'flat' },
  { x: 215, w: 120, h: 215, roof: 'tower' },
  { x: 365, w: 210, h: 135, roof: 'flat' },
  { x: 610, w: 170, h: 190, roof: 'dome' },
  { x: 815, w: 135, h: 160, roof: 'flat' },
  { x: 975, w: 175, h: 125, roof: 'flat' },
];

function Windows({ x, y, w, h, seed, lit, dim }) {
  const r = rng(seed);
  const cols = Math.max(3, Math.floor(w / 17));
  const rows = Math.max(3, Math.floor(h / 20));
  const cw = (w - 16) / cols;
  const rh = (h - 18) / rows;
  const out = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const on = r() > 0.38;
      out.push(<rect key={`${i}-${j}`} x={x + 8 + i * cw + 2} y={y + 9 + j * rh + 3} width={cw - 5} height={rh - 7} rx="1.5"
        fill={on ? lit : dim} opacity={on ? 0.95 : 0.55} />);
    }
  }
  return <g>{out}</g>;
}

function Block({ b, i, p }) {
  const y = GROUND - b.h;
  return (
    <g>
      <rect x={b.x} y={y} width={b.w} height={b.h} fill={`url(#wall${p.k})`} />
      <rect x={b.x} y={y} width={b.w} height="5" fill={p.roofEdge} opacity="0.9" />
      {b.roof === 'tower' && (
        <>
          <rect x={b.x + b.w / 2 - 22} y={y - 34} width="44" height="34" fill={`url(#wall${p.k})`} />
          <rect x={b.x + b.w / 2 - 1.5} y={y - 74} width="3" height="40" fill={p.roofEdge} />
          <circle cx={b.x + b.w / 2} cy={y - 76} r="4" fill={p.beacon} />
          <circle cx={b.x + b.w / 2} cy={y - 76} r="11" fill={p.beacon} opacity="0.25" />
        </>
      )}
      {b.roof === 'dome' && <path d={`M ${b.x + 18} ${y} A ${b.w / 2 - 18} ${b.w / 2 - 18} 0 0 1 ${b.x + b.w - 18} ${y} Z`} fill={`url(#wall${p.k})`} />}
      <Windows x={b.x} y={y + 6} w={b.w} h={b.h - 12} seed={101 + i * 37} lit={p.lit} dim={p.dim} />
    </g>
  );
}

export function CampusSkyline() {
  const { isLight } = useTheme();
  const r = rng(7);
  const p = isLight
    ? { k: 'L', skyTop: '#7cc4ff', skyMid: '#cfe6ff', skyLow: '#ffd9b0', glow: '#ffb86b', far: '#9fb4d9', wallA: '#5f7fb8', wallB: '#2f4a86', roofEdge: '#243b73',
        lit: '#fff1c2', dim: '#3a5594', beacon: '#ff6b6b', lakeTop: '#8fc2ee', lakeLow: '#3f72b4', tree: '#2f7a62', tree2: '#3f946f', body: '#fff4cf', stars: 0 }
    : { k: 'D', skyTop: '#050b24', skyMid: '#1a1f5c', skyLow: '#6a3a86', glow: '#ff8a5c', far: '#23306f', wallA: '#2a3f86', wallB: '#10194a', roofEdge: '#5b7bd6',
        lit: '#ffd97a', dim: '#1b2a63', beacon: '#ff5d73', lakeTop: '#1b2a78', lakeLow: '#070d33', tree: '#0d4a52', tree2: '#126b6a', body: '#fff7dc', stars: 46 };

  const far = [];
  for (let x = -10; x < 1220; x += 34 + r() * 36) {
    const h = 55 + r() * 95;
    far.push(<rect key={x} x={x} y={GROUND - h} width={30 + r() * 30} height={h} fill={p.far} opacity="0.55" />);
  }
  const stars = Array.from({ length: p.stars }, (_, i) => (
    <circle key={i} cx={r() * 1200} cy={r() * 230} r={0.6 + r() * 1.3} fill="#fff"
      style={{ animation: `twinkle ${2.4 + r() * 3}s ease-in-out ${r() * 3}s infinite` }} />
  ));
  const trees = Array.from({ length: 22 }, (_, i) => {
    const x = 12 + i * 55 + (i % 3) * 8;
    const s = 16 + (i % 4) * 5;
    return <g key={i}><rect x={x - 1.5} y={GROUND - 6} width="3" height="10" fill={p.wallB} /><circle cx={x} cy={GROUND - 12 - s / 3} r={s} fill={i % 2 ? p.tree : p.tree2} /></g>;
  });

  const scene = (
    <g>
      {far}
      {BLOCKS.map((b, i) => <Block key={i} b={b} i={i} p={p} />)}
      {trees}
    </g>
  );

  return (
    <svg viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="presentation">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.skyTop} />
          <stop offset="0.6" stopColor={p.skyMid} />
          <stop offset="1" stopColor={p.skyLow} />
        </linearGradient>
        <linearGradient id={`wall${p.k}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.wallA} />
          <stop offset="1" stopColor={p.wallB} />
        </linearGradient>
        <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.lakeTop} />
          <stop offset="1" stopColor={p.lakeLow} />
        </linearGradient>
        <radialGradient id="horizon" cx="0.5" cy="1" r="0.7">
          <stop offset="0" stopColor={p.glow} stopOpacity="0.75" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="body" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={p.body} stopOpacity="1" />
          <stop offset="1" stopColor={p.body} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="640" fill="url(#sky)" />
      <rect width="1200" height={GROUND} fill="url(#horizon)" />
      {stars}
      <circle cx="930" cy="110" r="70" fill="url(#body)" opacity="0.55" />
      <circle cx="930" cy="110" r="26" fill={p.body} />
      {scene}
      <rect x="0" y={GROUND} width="1200" height={640 - GROUND} fill="url(#lake)" />
      <g transform={`translate(0 ${GROUND * 2}) scale(1 -1)`} opacity="0.26" style={{ filter: 'blur(1.6px)' }}>{scene}</g>
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={60 + i * 128 + (i % 2) * 40} y={GROUND + 28 + i * 20} width={90 + (i % 3) * 40} height="1.6" rx="0.8" fill="#fff" opacity="0.14" />
      ))}
    </svg>
  );
}

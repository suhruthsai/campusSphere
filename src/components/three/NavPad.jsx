// NavPad.jsx — on-screen controls for the 3D campus: move, rotate, tilt, zoom and reset. Buttons work
// while held (smooth) and as a tap (a short nudge); the render loop in SuhruthDigitalTwin.jsx reads navRef
// every frame. The same controls are on the keyboard once the map is focused (see NAV_KEYS).
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Home, Minus, Move, Plus, RotateCcw, RotateCw, X } from 'lucide-react';

// key → [navRef field, value]
export const NAV_KEYS = {
  ArrowUp: ['panZ', 1], w: ['panZ', 1], W: ['panZ', 1],
  ArrowDown: ['panZ', -1], s: ['panZ', -1], S: ['panZ', -1],
  ArrowLeft: ['panX', -1], a: ['panX', -1], A: ['panX', -1],
  ArrowRight: ['panX', 1], d: ['panX', 1], D: ['panX', 1],
  q: ['rotate', 1], Q: ['rotate', 1], e: ['rotate', -1], E: ['rotate', -1],
  r: ['tilt', -1], R: ['tilt', -1], f: ['tilt', 1], F: ['tilt', 1],
  '+': ['zoom', -1], '=': ['zoom', -1], '-': ['zoom', 1], _: ['zoom', 1],
};
// The same keys by their physical position (e.code), so they work on any layout (Telugu, Hindi, ...) and on the numpad
const NAV_CODES = {
  ArrowUp: ['panZ', 1], KeyW: ['panZ', 1], ArrowDown: ['panZ', -1], KeyS: ['panZ', -1],
  ArrowLeft: ['panX', -1], KeyA: ['panX', -1], ArrowRight: ['panX', 1], KeyD: ['panX', 1],
  KeyQ: ['rotate', 1], KeyE: ['rotate', -1], KeyR: ['tilt', -1], KeyF: ['tilt', 1],
  Equal: ['zoom', -1], NumpadAdd: ['zoom', -1], Minus: ['zoom', 1], NumpadSubtract: ['zoom', 1],
};
const RESET_CODES = new Set(['Digit0', 'Numpad0', 'Home']);
const navKey = (e) => NAV_CODES[e.code] || NAV_KEYS[e.key];
const NUDGE_MS = 220;   // a tap moves as much as holding for this long

/** Keyboard handlers for the map container: hold a key to move, 0 or Home to reset. */
const keyDownAt = {};   // key → when it went down, so a quick tap still nudges the view

/** Typing somewhere (a text box, a dropdown, an editable area) keeps the keys for itself. */
function typingIn(el) {
  if (!el || el === document.body) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * The keyboard moves the campus whenever at least a third of the 3D map is on screen: no need to click it first.
 * Keys typed into a text box or dropdown (Mitra's chat, the route finder) are left alone, and when the map is
 * scrolled away the arrow keys scroll the page as usual.
 */
export function useNavKeyboard(navRef, boxRef) {
  const visible = useRef(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const io = new IntersectionObserver(([entry]) => { visible.current = entry.intersectionRatio >= 0.33; },
      { threshold: [0, 0.33, 0.66, 1] });
    io.observe(box);

    const clearAll = () => Object.assign(navRef.current, { panX: 0, panZ: 0, rotate: 0, tilt: 0, zoom: 0 });
    const onKeyDown = (e) => {
      if (!visible.current || e.ctrlKey || e.metaKey || e.altKey || typingIn(document.activeElement)) return;
      if (RESET_CODES.has(e.code) || e.key === '0' || e.key === 'Home') { navRef.current.reset = true; e.preventDefault(); return; }
      const map = navKey(e);
      if (!map) return;
      if (!e.repeat) keyDownAt[e.code || e.key] = performance.now();
      navRef.current[map[0]] = map[1];
      e.preventDefault();   // the arrow keys move the map instead of scrolling the page
    };
    const onKeyUp = (e) => {
      const map = navKey(e);
      if (!map) return;
      const release = () => { if (navRef.current[map[0]] === map[1]) navRef.current[map[0]] = 0; };
      const left = NUDGE_MS - (performance.now() - (keyDownAt[e.code || e.key] || 0));
      if (left > 0) setTimeout(release, left);
      else release();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearAll);   // switching windows mid-press must not leave the camera moving
    return () => {
      io.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearAll);
      clearAll();
    };
  }, [navRef, boxRef]);
}

function PadButton({ navRef, field, value, label, children, className = '' }) {
  const held = useRef(0);   // when the press started (0 = not pressed)
  const release = () => { if (navRef.current[field] === value) navRef.current[field] = 0; };
  const start = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* some pens / old browsers: holding still works */ }
    held.current = performance.now();
    navRef.current[field] = value;
  };
  const stop = () => {
    if (!held.current) return;
    const left = NUDGE_MS - (performance.now() - held.current);   // a quick tap still moves a little
    held.current = 0;
    if (left > 0) setTimeout(release, left);
    else release();
  };
  const nudge = () => {   // keyboard Enter / Space on the button itself
    navRef.current[field] = value;
    setTimeout(() => { if (navRef.current[field] === value) navRef.current[field] = 0; }, NUDGE_MS);
  };
  return (
    <button type="button" aria-label={label} title={label}
      onPointerDown={start} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); nudge(); } }}
      className={`grid h-9 w-9 select-none place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-white active:scale-95 active:bg-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${className}`}
      style={{ touchAction: 'none' }}>
      {children}
    </button>
  );
}

/** crowded: another panel (a building's details) needs the right side, so the pad folds away for it. */
export default function NavPad({ navRef, zoomListenerRef, crowded = false }) {
  // Open on bigger screens; on a phone it starts as a small button so the map stays visible.
  // Phones: near the top right (the legend is hidden there) so the floating assistant button can't cover it
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 640);
  const [zoom, setZoom] = useState(30);

  useEffect(() => {
    zoomListenerRef.current = setZoom;
    return () => { zoomListenerRef.current = null; };
  }, [zoomListenerRef]);

  useEffect(() => { if (crowded) setOpen(false); }, [crowded]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Show the map controls" title="Map controls"
        className="pointer-events-auto absolute right-4 top-20 z-20 grid h-11 w-11 place-items-center sm:top-1/2 sm:-translate-y-1/2 rounded-xl border border-cyan-300/30 bg-[#141a22]/90 text-cyan-200 shadow-lg backdrop-blur-md transition hover:bg-[#1b2430]">
        <Move size={18} />
      </button>
    );
  }

  const p = { navRef };
  return (
    <div className="pointer-events-auto absolute right-4 top-20 z-20 w-[8.75rem] rounded-xl sm:top-1/2 sm:-translate-y-1/2 border border-white/10 bg-[#141a22]/90 p-2.5 shadow-lg backdrop-blur-md"
      role="group" aria-label="Map controls">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[9px] font-bold tracking-widest text-slate-400">MOVE</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide the map controls" title="Hide"
          className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-white"><X size={12} /></button>
      </div>

      {/* Move: arrows around Reset */}
      <div className="grid grid-cols-3 justify-items-center gap-1">
        <span />
        <PadButton {...p} field="panZ" value={1} label="Move forward"><ChevronUp size={16} /></PadButton>
        <span />
        <PadButton {...p} field="panX" value={-1} label="Move left"><ChevronLeft size={16} /></PadButton>
        <button type="button" onClick={() => { navRef.current.reset = true; }} aria-label="Reset the view" title="Reset view (0)"
          className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 transition hover:bg-cyan-300/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60">
          <Home size={15} />
        </button>
        <PadButton {...p} field="panX" value={1} label="Move right"><ChevronRight size={16} /></PadButton>
        <span />
        <PadButton {...p} field="panZ" value={-1} label="Move back"><ChevronDown size={16} /></PadButton>
        <span />
      </div>

      {/* Rotate and tilt */}
      <div className="mt-2 grid grid-cols-4 gap-1">
        <PadButton {...p} field="rotate" value={1} label="Rotate left" className="!h-8 !w-full"><RotateCcw size={14} /></PadButton>
        <PadButton {...p} field="rotate" value={-1} label="Rotate right" className="!h-8 !w-full"><RotateCw size={14} /></PadButton>
        <PadButton {...p} field="tilt" value={-1} label="Tilt to look down" className="!h-8 !w-full">
          <span className="text-[10px] font-bold leading-none">⤓</span>
        </PadButton>
        <PadButton {...p} field="tilt" value={1} label="Tilt to the horizon" className="!h-8 !w-full">
          <span className="text-[10px] font-bold leading-none">⤒</span>
        </PadButton>
      </div>

      {/* Zoom slider */}
      <div className="mt-2 flex items-center gap-1">
        <PadButton {...p} field="zoom" value={1} label="Zoom out" className="!h-7 !w-7 shrink-0"><Minus size={13} /></PadButton>
        <input type="range" min={0} max={100} value={zoom} aria-label="Zoom"
          onChange={(e) => { const v = Number(e.target.value); setZoom(v); navRef.current.setZoom = v; }}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-cyan-300" />
        <PadButton {...p} field="zoom" value={-1} label="Zoom in" className="!h-7 !w-7 shrink-0"><Plus size={13} /></PadButton>
      </div>

      <p className="mt-2 hidden text-center font-mono text-[8.5px] leading-snug text-slate-500 md:block">
        KEYS: ARROWS / WASD · Q E · + −<br />R F TILT · 0 RESET
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CampusScene.jsx  —  Suhruth University 3-D Digital Twin  (CINEMATIC EDITION)
//  Tech: React Three Fiber · Three.js · @react-three/drei
// ─────────────────────────────────────────────────────────────────────────────

import { Html, OrbitControls, Stars, Line } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { buildings } from '../../data/campus.js';
import LiveTransit from './LiveTransit.jsx';

// ── Colour palette ─────────────────────────────────────────────────────────
const C = {
  cyan:   '#00E5FF',
  violet: '#7B61FF',
  mint:   '#00FFB3',
  amber:  '#F59E0B',
  ground: '#030915',
  grid:   '#0a2244',
};

// ── Main export ───────────────────────────────────────────────────────────────
export default function CampusScene({ activeBuilding, onSelectBuilding, nightMode }) {
  return (
    <div className="relative h-[34rem] overflow-hidden rounded-2xl lg:h-[46rem]"
         style={{ boxShadow: '0 0 0 1px rgba(0,229,255,0.18), 0 32px 80px rgba(0,0,0,0.7)' }}>
      <Canvas camera={{ position: [2, 19, 16], fov: 55 }} dpr={[1, 2]} shadows>
        {/* ── Atmosphere ── */}
        <color attach="background" args={[nightMode ? '#020814' : '#071229']} />
        <fog attach="fog" args={[nightMode ? '#020814' : '#071229', 20, 44]} />

        {/* ── Lighting ── */}
        <ambientLight intensity={nightMode ? 0.22 : 0.50} />
        <directionalLight
          position={[8, 16, 8]}
          intensity={nightMode ? 0.6 : 1.2}
          color={nightMode ? '#a0c4ff' : '#fff8f0'}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={50}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        {/* Accent fill lights */}
        <pointLight position={[-8, 10, -5]} intensity={nightMode ? 5 : 3}   color={C.cyan}   />
        <pointLight position={[ 8,  8,  5]} intensity={nightMode ? 4 : 2.5} color={C.violet} />
        <pointLight position={[ 0, 10,  0]} intensity={nightMode ? 3 : 1.8} color={C.mint}   />
        <pointLight position={[ 0,  4,  8]} intensity={nightMode ? 2 : 1}   color={C.amber}  />

        {nightMode && (
          <Stars radius={120} depth={30} count={3000} factor={4} fade speed={0.8} />
        )}

        {/* ── Ground ── */}
        <Ground nightMode={nightMode} />

        {/* ── Left strip ── */}
        <SportsGround  nightMode={nightMode} />
        <BasketballCourt nightMode={nightMode} />
        <ParkingStrip  nightMode={nightMode} />

        {/* ── Landmarks ── */}
        <Garden position={[3.5, 0, -5.0]} />
        <CircularParking position={[-5.5, 0.01, 4.5]} />

        {/* ── Walkways ── */}
        <WalkArea       nightMode={nightMode} />
        <PedestrianPath nightMode={nightMode} />

        {/* ── Main Gate ── */}
        <MainGate nightMode={nightMode} />

        {/* ── Data routes ── */}
        <RouteNetwork />
        <DataParticles />
        <LiveTransit nightMode={nightMode} />

        {/* ── Academic buildings ── */}
        {buildings.map((b) => (
          <CampusBuilding
            key={b.id}
            building={b}
            active={activeBuilding?.id === b.id}
            onSelect={() => onSelectBuilding(b)}
          />
        ))}

        {/* ── Ambient rings ── */}
        <EnergyRings />

        <OrbitControls
          enablePan
          enableZoom
          minDistance={7}
          maxDistance={34}
          maxPolarAngle={Math.PI / 2.08}
          makeDefault
        />
      </Canvas>

      {/* Corner scan-line overlay */}
      <div className="pointer-events-none absolute inset-0"
           style={{
             background: 'linear-gradient(to bottom, rgba(0,229,255,0.03) 0%, transparent 12%, transparent 88%, rgba(0,229,255,0.04) 100%)',
             backgroundSize: '100% 3px',
           }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#020814] to-transparent" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ground — reflective dark plane with glowing grid
// ─────────────────────────────────────────────────────────────────────────────
function Ground({ nightMode }) {
  const materialRef = useRef();

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uNightMode.value = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uNightMode.value,
        nightMode ? 1 : 0,
        0.05
      );
    }
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uNightMode: { value: nightMode ? 1 : 0 },
    uColorGrid: { value: new THREE.Color('#00E5FF') },
    uColorDayGrid: { value: new THREE.Color('#64748b') },
  }), []);

  const vertexShader = `
    varying vec2 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform float uNightMode;
    uniform vec3 uColorGrid;
    uniform vec3 uColorDayGrid;
    
    varying vec2 vWorldPosition;

    void main() {
      vec2 gridUv = vWorldPosition * 2.0; 
      vec2 grid = fract(gridUv);
      
      float line = smoothstep(0.96, 1.0, grid.x) + smoothstep(0.96, 1.0, grid.y) +
                   smoothstep(0.0, 0.04, grid.x) + smoothstep(0.0, 0.04, grid.y);
      line = clamp(line, 0.0, 1.0);
      
      vec2 fineGridUv = vWorldPosition * 10.0;
      vec2 fineGrid = fract(fineGridUv);
      float fineLine = smoothstep(0.95, 1.0, fineGrid.x) + smoothstep(0.95, 1.0, fineGrid.y) +
                       smoothstep(0.0, 0.05, fineGrid.x) + smoothstep(0.0, 0.05, fineGrid.y);
      fineLine = clamp(fineLine, 0.0, 1.0) * 0.3; 
      
      float totalGrid = clamp(line + fineLine, 0.0, 1.0);

      float distToCenter = length(vWorldPosition);
      float pulse = sin(distToCenter * 1.5 - uTime * 2.0) * 0.5 + 0.5;
      
      float fade = smoothstep(13.0, 4.0, distToCenter);

      vec3 gridColor = mix(uColorDayGrid, uColorGrid, uNightMode);
      float activePulse = mix(0.0, pulse * 0.8, uNightMode);
      float alpha = totalGrid * (0.3 + activePulse) * fade;

      gl_FragColor = vec4(gridColor, alpha);
    }
  `;

  return (
    <group>
      {/* Base reflective surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[26, 26, 1, 1]} />
        <meshStandardMaterial
          color={nightMode ? '#030c1a' : '#cbd5e1'}
          metalness={0.8}
          roughness={0.2}
          envMapIntensity={0.5}
        />
      </mesh>
      
      {/* Procedural Grid Overlay */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <planeGeometry args={[26, 26, 1, 1]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sports Ground (green turf, left-centre)
// ─────────────────────────────────────────────────────────────────────────────
function SportsGround({ nightMode }) {
  return (
    <group position={[-7.2, 0.01, 0.5]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.8, 7.5]} />
        <meshStandardMaterial
          color={nightMode ? '#0a2a10' : '#14532d'}
          roughness={0.92} metalness={0.02}
        />
      </mesh>
      {/* Field stripes */}
      {[-2.2, -0.75, 0.75, 2.2].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, z]}>
          <planeGeometry args={[2.6, 0.035]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.5} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
        <ringGeometry args={[0.62, 0.66, 40]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      {[-3.2, 3.2].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, z]}>
          <planeGeometry args={[1.3, 0.85]} />
          <meshBasicMaterial color="#16a34a" transparent opacity={0.22} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Basketball court (top-left, orange markings)
// ─────────────────────────────────────────────────────────────────────────────
function BasketballCourt({ nightMode }) {
  return (
    <group position={[-7.2, 0.01, -4.8]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.8, 1.8]} />
        <meshStandardMaterial color={nightMode ? '#111827' : '#1c2951'} roughness={0.8} metalness={0.06} />
      </mesh>
      {[[-1.35, 0], [1.35, 0]].map(([x], i) => (
        <mesh key={`v${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.007, 0]}>
          <planeGeometry args={[0.04, 1.65]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.9} />
        </mesh>
      ))}
      {[-0.72, 0.72].map((z, i) => (
        <mesh key={`h${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, z]}>
          <planeGeometry args={[2.75, 0.04]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.9} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[0.28, 0.32, 32]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      {[-1.2, 1.2].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.65, 6]} />
            <meshBasicMaterial color="#94a3b8" />
          </mesh>
          <mesh position={[0, 0.88, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.13, 0.008, 8, 28]} />
            <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={nightMode ? 0.8 : 0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Parking strip (bottom-left)
// ─────────────────────────────────────────────────────────────────────────────
function ParkingStrip({ nightMode }) {
  return (
    <group position={[-7.2, 0.01, 4.5]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.8, 3.2]} />
        <meshStandardMaterial color={nightMode ? '#111111' : '#1e293b'} roughness={0.96} metalness={0.12} />
      </mesh>
      {[-1.1, -0.4, 0.4, 1.1].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.006, 0]}>
          <planeGeometry args={[0.04, 2.8]} />
          <meshBasicMaterial color="#4b5563" transparent opacity={0.55} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
        <ringGeometry args={[0.56, 0.61, 24]} />
        <meshBasicMaterial color="#6b7280" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Circular parking (bottom-row)
// ─────────────────────────────────────────────────────────────────────────────
function CircularParking({ position }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.95, 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.96} metalness={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <ringGeometry args={[0.72, 0.77, 32]} />
        <meshBasicMaterial color="#4b5563" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Garden (top-right, animated rotating foliage)
// ─────────────────────────────────────────────────────────────────────────────
function Garden({ position }) {
  const foliageRef = useRef();
  useFrame((s) => {
    if (foliageRef.current) foliageRef.current.rotation.y = s.clock.elapsedTime * 0.18;
  });
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[1.05, 36]} />
        <meshStandardMaterial color="#15803d" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[0.84, 0.90, 36]} />
        <meshBasicMaterial color="#a16207" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
      {/* Trunk */}
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.065, 0.085, 0.85, 8]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      {/* Canopy */}
      <mesh ref={foliageRef} position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.5, 9, 7]} />
        <meshStandardMaterial color="#166534" roughness={0.85} emissive="#14532d" emissiveIntensity={0.2} />
      </mesh>
      {/* Bushes */}
      {Array.from({ length: 9 }).map((_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.72, 0.2, Math.sin(a) * 0.72]}>
            <sphereGeometry args={[0.17, 6, 5]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#166534' : '#15803d'} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Horizontal Walk Area
// ─────────────────────────────────────────────────────────────────────────────
function WalkArea({ nightMode }) {
  return (
    <group position={[-1.6, 0.012, 0.75]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11.5, 0.95]} />
        <meshStandardMaterial color={nightMode ? '#0f1e35' : '#1e3a5f'} roughness={0.82} metalness={0.1} />
      </mesh>
      {[-0.43, 0.43].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, z]}>
          <planeGeometry args={[11.5, 0.03]} />
          <meshBasicMaterial color={C.cyan} transparent opacity={0.28} />
        </mesh>
      ))}
      {Array.from({ length: 16 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-5.3 + i * 0.75, 0.008, 0]}>
          <planeGeometry args={[0.35, 0.035]} />
          <meshBasicMaterial color={C.cyan} transparent opacity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Vertical pedestrian cut-through between Exam & S&H
// ─────────────────────────────────────────────────────────────────────────────
function PedestrianPath({ nightMode }) {
  return (
    <group position={[0.22, 0.012, -3.4]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.58, 3.6]} />
        <meshStandardMaterial color={nightMode ? '#0f1e35' : '#1e3a5f'} roughness={0.85} metalness={0.05} />
      </mesh>
      {[-0.25, 0.25].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.006, 0]}>
          <planeGeometry args={[0.03, 3.6]} />
          <meshBasicMaterial color={C.cyan} transparent opacity={0.22} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Gate (right edge — full campus height, animated)
// ─────────────────────────────────────────────────────────────────────────────
function MainGate({ nightMode }) {
  const glowRef = useRef();
  useFrame((s) => {
    if (!glowRef.current) return;
    glowRef.current.children.forEach((child, i) => {
      if (child.material?.emissiveIntensity !== undefined) {
        child.material.emissiveIntensity =
          (nightMode ? 0.6 : 0.18) + Math.sin(s.clock.elapsedTime * 1.3 + i * 0.9) * 0.14;
      }
    });
  });

  const pillarZ = [-5.2, -3.4, -1.6, 0.2, 2.0, 3.8];

  return (
    <group position={[6.8, 0, -0.7]}>
      {/* Top rail */}
      <mesh position={[0, 2.72, 0]}>
        <boxGeometry args={[0.2, 0.2, 13.5]} />
        <meshStandardMaterial color="#94a3b8" emissive={C.cyan} emissiveIntensity={nightMode ? 0.45 : 0.12} metalness={0.92} roughness={0.08} />
      </mesh>
      {/* Sign board */}
      <mesh position={[0, 3.08, 0]}>
        <boxGeometry args={[0.08, 0.52, 3.8]} />
        <meshStandardMaterial color="#0c1f44" emissive={C.cyan} emissiveIntensity={nightMode ? 0.4 : 0.14} />
      </mesh>

      {/* Pillars */}
      <group ref={glowRef}>
        {pillarZ.map((z, i) => (
          <group key={i}>
            <mesh position={[0, 1.35, z]} castShadow>
              <boxGeometry args={[0.24, 2.7, 0.24]} />
              <meshStandardMaterial
                color="#cbd5e1"
                emissive={C.cyan}
                emissiveIntensity={nightMode ? 0.5 : 0.12}
                metalness={0.88}
                roughness={0.12}
              />
            </mesh>
            {/* Cap */}
            <mesh position={[0, 2.76, z]}>
              <boxGeometry args={[0.34, 0.14, 0.34]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.08} />
            </mesh>
            {nightMode && (
              <pointLight position={[0, 2.85, z]} intensity={1.0} color={C.cyan} distance={2.8} decay={2} />
            )}
          </group>
        ))}
      </group>

      {/* Entrance arch (double pillar) */}
      {[-0.5, 0.5].map((z) => (
        <mesh key={z} position={[-0.5, 1.4, z + 0.2]} castShadow>
          <boxGeometry args={[0.3, 2.9, 0.3]} />
          <meshStandardMaterial color="#e2e8f0" emissive={C.cyan} emissiveIntensity={nightMode ? 0.65 : 0.2} metalness={0.88} roughness={0.08} />
        </mesh>
      ))}
      <mesh position={[-0.5, 2.88, 0.2]}>
        <boxGeometry args={[0.24, 0.24, 1.3]} />
        <meshStandardMaterial color="#94a3b8" emissive={C.cyan} emissiveIntensity={0.35} metalness={0.92} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Individual academic building (with glowing neon edges)
// ─────────────────────────────────────────────────────────────────────────────
function CampusBuilding({ building, active, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const groupRef   = useRef();
  const edgesRef   = useRef();
  const isOval     = building.shape === 'oval';
  const colorObj   = useMemo(() => new THREE.Color(building.color), [building.color]);

  useFrame((s) => {
    if (!groupRef.current) return;
    const baseY = building.height / 2;
    groupRef.current.position.y = baseY + Math.sin(s.clock.elapsedTime * 1.5 + building.x * 0.8) * 0.035;

    // Pulse edge brightness on active
    if (edgesRef.current) {
      edgesRef.current.material.opacity =
        (active ? 0.85 : hovered ? 0.65 : 0.28) +
        Math.sin(s.clock.elapsedTime * 2.5 + building.x) * 0.1;
    }
  });

  const handlers = {
    onClick:       (e) => { e.stopPropagation(); onSelect(); },
    onPointerOver: (e) => { e.stopPropagation(); setHovered(true);  document.body.style.cursor = 'pointer'; },
    onPointerOut:  ()  => {                      setHovered(false); document.body.style.cursor = 'default'; },
  };

  const emissive = (active || hovered) ? 0.48 : 0.14;

  return (
    <group ref={groupRef} position={[building.x, 0, building.z]}>
      {isOval ? (
        /* ── Auditorium dome ── */
        <group {...handlers}>
          <mesh castShadow scale={[1.7, 1, 1.08]}>
            <cylinderGeometry args={[0.78, 0.9, building.height, 30]} />
            <meshStandardMaterial color={building.color} emissive={building.color} emissiveIntensity={emissive} metalness={0.48} roughness={0.22} transparent opacity={0.88} />
          </mesh>
          <mesh position={[0, building.height / 2 + 0.03, 0]} scale={[1.7, 0.92, 1.08]}>
            <sphereGeometry args={[0.78, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={building.color} emissive={building.color} emissiveIntensity={emissive * 0.6} metalness={0.52} roughness={0.28} />
          </mesh>
          {/* Oval glow ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -building.height / 2, 0]} scale={[1.7, 1.08, 1]}>
            <ringGeometry args={[0.88, 0.95, 32]} />
            <meshBasicMaterial color={building.color} transparent opacity={active ? 0.7 : 0.35} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ) : (
        /* ── Box building ── */
        <group>
          <mesh castShadow receiveShadow {...handlers}>
            <boxGeometry args={[1.15, building.height, 1.15]} />
            <meshStandardMaterial color={building.color} emissive={building.color} emissiveIntensity={emissive} metalness={0.55} roughness={0.22} transparent opacity={0.87} />
          </mesh>

          {/* Neon wireframe edges */}
          <lineSegments ref={edgesRef}>
            <edgesGeometry args={[new THREE.BoxGeometry(1.18, building.height + 0.02, 1.18)]} />
            <lineBasicMaterial color={building.color} transparent opacity={0.35} />
          </lineSegments>

          {/* Roof cap */}
          <mesh position={[0, building.height / 2 + 0.048, 0]}>
            <boxGeometry args={[1.32, 0.09, 1.32]} />
            <meshStandardMaterial color="#ffffff" emissive={building.color} emissiveIntensity={0.55} />
          </mesh>

          {/* Ground floor accent band */}
          <mesh position={[0, -building.height / 2 + 0.14, 0]}>
            <boxGeometry args={[1.19, 0.08, 1.19]} />
            <meshStandardMaterial color={building.color} emissive={building.color} emissiveIntensity={0.65} transparent opacity={0.72} />
          </mesh>

          <WindowGrid height={building.height} color={building.color} />
        </group>
      )}

      {/* Active selection ring */}
      {active && (
        <PulsingRing color={building.color} y={-building.height / 2 + 0.01} />
      )}

      {/* Tooltip */}
      {(hovered || active) && (
        <Html center position={[0, building.height / 2 + (isOval ? 1.25 : 1.05), 0]} distanceFactor={9}>
          <div
            className="w-48 rounded-2xl border p-3 text-xs text-white backdrop-blur-xl"
            style={{
              background: 'rgba(2,8,20,0.88)',
              borderColor: building.color + '50',
              boxShadow: `0 0 24px ${building.color}30`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: building.color }} />
              <strong className="font-bold" style={{ color: building.color }}>
                {building.name}
              </strong>
            </div>
            <p className="text-slate-400 mb-2">{building.type}</p>
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${building.occupancy}%`, background: `linear-gradient(90deg, ${building.color}, ${building.color}88)` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">Occupancy</span>
              <span style={{ color: building.color }}>{building.occupancy}%</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Pulsing selection ring
// ─────────────────────────────────────────────────────────────────────────────
function PulsingRing({ color, y }) {
  const ref = useRef();
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime;
    const scale = 1 + Math.sin(t * 3) * 0.12;
    ref.current.scale.setScalar(scale);
    ref.current.material.opacity = 0.55 + Math.sin(t * 3) * 0.2;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <ringGeometry args={[0.72, 0.80, 36]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Window grid
// ─────────────────────────────────────────────────────────────────────────────
function WindowGrid({ height, color }) {
  const rows = Math.max(2, Math.floor(height * 2.4));
  return (
    <group>
      {Array.from({ length: rows }).map((_, row) =>
        [-0.585, 0.585].map((x) => (
          <mesh key={`${row}-${x}`}
                position={[x, -height / 2 + 0.36 + row * (height / rows) * 1.05, 0.042]}>
            <boxGeometry args={[0.016, 0.09, 0.9]} />
            <meshBasicMaterial color={color} transparent opacity={0.42} />
          </mesh>
        )),
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Route network (pulsing tubes between buildings)
// ─────────────────────────────────────────────────────────────────────────────
function RouteNetwork() {
  const segments = useMemo(() => {
    const P = (i) => new THREE.Vector3(buildings[i].x, 0.06, buildings[i].z);
    return [
      [P(0), P(1)], [P(1), P(2)], [P(2), P(3)], [P(3), P(4)],   // top row
      [P(5), P(6)], [P(6), P(7)], [P(7), P(8)],                   // middle row
      [P(1), P(6)], [P(3), P(7)], [P(4), P(8)],                   // verticals
      [P(6), P(9)], [P(9), P(10)],                                 // bottom
    ];
  }, []);

  return (
    <group>
      {segments.map((pts, i) => (
        <RouteTube key={i} points={pts} index={i} />
      ))}
    </group>
  );
}

function RouteTube({ points, index }) {
  const ref   = useRef();
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const tube  = useMemo(() => new THREE.TubeGeometry(curve, 36, 0.024, 7, false), [curve]);
  const color = index % 3 === 0 ? C.cyan : index % 3 === 1 ? C.mint : C.violet;

  useFrame((s) => {
    if (ref.current) {
      ref.current.material.opacity = 0.32 + Math.sin(s.clock.elapsedTime * 2 + index * 0.8) * 0.18;
    }
  });

  return (
    <mesh ref={ref} geometry={tube}>
      <meshBasicMaterial color={color} transparent opacity={0.45} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Data particles — glowing dots racing along route paths
// ─────────────────────────────────────────────────────────────────────────────
function DataParticles() {
  const paths = useMemo(() => {
    const P = (i) => new THREE.Vector3(buildings[i].x, 0.18, buildings[i].z);
    const pairs = [
      [P(0), P(1)], [P(1), P(6)], [P(6), P(9)],
      [P(5), P(6)], [P(3), P(7)], [P(9), P(10)],
    ];
    return pairs.map((pts) => ({
      curve: new THREE.CatmullRomCurve3(pts),
      color: [C.cyan, C.mint, C.violet, C.cyan, C.mint, C.violet][pairs.indexOf(pts) % 3] ?? C.cyan,
    }));
  }, []);

  return (
    <group>
      {paths.map((path, pi) =>
        [0, 0.4, 0.7].map((offset, di) => (
          <Particle key={`${pi}-${di}`} curve={path.curve} color={path.color} offset={offset} speed={0.18 + pi * 0.04} />
        )),
      )}
    </group>
  );
}

function Particle({ curve, color, offset, speed }) {
  const ref = useRef();
  const pos = useMemo(() => new THREE.Vector3(), []);

  useFrame((s) => {
    if (!ref.current) return;
    const t = ((s.clock.elapsedTime * speed + offset) % 1 + 1) % 1;
    curve.getPoint(t, pos);
    ref.current.position.copy(pos);
    ref.current.material.opacity = Math.sin(t * Math.PI) * 0.9 + 0.1;
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.06, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ambient energy rings (slowly rotating, centred on campus)
// ─────────────────────────────────────────────────────────────────────────────
function EnergyRings() {
  const ref = useRef();
  useFrame((s) => {
    if (ref.current) ref.current.rotation.z = s.clock.elapsedTime * 0.14;
  });
  return (
    <group ref={ref} position={[-1.0, 0.07, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
      {[5, 7.5, 10.5].map((r, i) => (
        <mesh key={r}>
          <ringGeometry args={[r, r + 0.022, 100]} />
          <meshBasicMaterial
            color={i === 1 ? C.violet : C.cyan}
            transparent
            opacity={0.13 - i * 0.03}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

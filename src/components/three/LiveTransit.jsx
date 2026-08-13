import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { buildings } from '../../data/campus.js';

const C = {
  cyan:   '#00E5FF',
  violet: '#7B61FF',
  mint:   '#00FFB3',
  amber:  '#F59E0B',
};

// Inner loop path for shuttles
const getShuttleRoute = () => {
  const points = [
    new THREE.Vector3(4.0, 0.08, 0.8),   // Right walk area
    new THREE.Vector3(-4.0, 0.08, 0.8),  // Left walk area
    new THREE.Vector3(-4.0, 0.08, -2.0), // Left upper path
    new THREE.Vector3(4.0, 0.08, -2.0),  // Right upper path
  ];
  return new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.2);
};

// Internal delivery paths for bots linking all areas
const getBotRoutes = () => {
  const routes = [];
  // Connect every building to 2 other random buildings to cover the campus thoroughly
  buildings.forEach((b1, i) => {
    const b2 = buildings[(i + 3) % buildings.length];
    const b3 = buildings[(i + 7) % buildings.length];
    
    const P1 = new THREE.Vector3(b1.x, 0.05, b1.z);
    const P2 = new THREE.Vector3(b2.x, 0.05, b2.z);
    const P3 = new THREE.Vector3(b3.x, 0.05, b3.z);
    
    // Add some arc/curve to the path instead of straight lines
    const mid1 = P1.clone().lerp(P2, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5));
    const mid2 = P1.clone().lerp(P3, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5));

    routes.push(new THREE.CatmullRomCurve3([P1, mid1, P2]));
    routes.push(new THREE.CatmullRomCurve3([P1, mid2, P3]));
  });
  return routes;
};

function Shuttle({ curve, offset = 0, speed = 0.05, nightMode }) {
  const groupRef = useRef();
  
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = ((state.clock.elapsedTime * speed + offset) % 1 + 1) % 1;
    
    // Get current position
    const pos = curve.getPointAt(t);
    // Get point slightly ahead to calculate rotation
    const lookAtPos = curve.getPointAt((t + 0.01) % 1);
    
    groupRef.current.position.copy(pos);
    groupRef.current.lookAt(lookAtPos);
  });

  return (
    <group ref={groupRef}>
      {/* Shuttle Body */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.4, 0.4, 0.9]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.2} />
      </mesh>
      
      {/* Windows (Dark glass) */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.42, 0.15, 0.7]} />
        <meshStandardMaterial color="#020617" roughness={0.1} />
      </mesh>

      {/* Headlights */}
      <mesh position={[-0.12, 0.2, 0.46]}>
        <boxGeometry args={[0.1, 0.08, 0.02]} />
        <meshStandardMaterial color={C.cyan} emissive={C.cyan} emissiveIntensity={nightMode ? 2.5 : 1} />
      </mesh>
      <mesh position={[0.12, 0.2, 0.46]}>
        <boxGeometry args={[0.1, 0.08, 0.02]} />
        <meshStandardMaterial color={C.cyan} emissive={C.cyan} emissiveIntensity={nightMode ? 2.5 : 1} />
      </mesh>

      {/* Taillights */}
      <mesh position={[-0.12, 0.2, -0.46]}>
        <boxGeometry args={[0.12, 0.08, 0.02]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={nightMode ? 2 : 0.8} />
      </mesh>
      <mesh position={[0.12, 0.2, -0.46]}>
        <boxGeometry args={[0.12, 0.08, 0.02]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={nightMode ? 2 : 0.8} />
      </mesh>
      
      {/* Night mode light projection */}
      {nightMode && (
        <pointLight position={[0, 0.3, 1.5]} intensity={1.5} distance={4} color={C.cyan} />
      )}
    </group>
  );
}

function DeliveryBot({ curve, offset, speed, color }) {
  const groupRef = useRef();

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = ((state.clock.elapsedTime * speed + offset) % 1 + 1) % 1;
    
    // Ping-pong movement (0 to 1 to 0) to keep bots bouncing between buildings
    let pingPongT = t < 0.5 ? t * 2 : (1 - t) * 2;
    
    const movingForward = t < 0.5;
    let lookAtT = movingForward ? pingPongT + 0.01 : pingPongT - 0.01;
    
    // Prevent lookAtT from equaling pingPongT or going out of bounds
    if (lookAtT >= 1) { lookAtT = 1; pingPongT = 0.99; }
    if (lookAtT <= 0) { lookAtT = 0; pingPongT = 0.01; }
    
    const pos = curve.getPointAt(pingPongT);
    const lookAtPos = curve.getPointAt(lookAtT);
    
    groupRef.current.position.copy(pos);
    groupRef.current.lookAt(lookAtPos);
    
    // Hover effect
    groupRef.current.position.y += Math.sin(state.clock.elapsedTime * 10 + offset * 100) * 0.02;
  });

  return (
    <group ref={groupRef}>
      {/* Bot Body */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.2, 0.2, 0.3]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Glowing Payload/Beacon */}
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
      </mesh>
      {/* Ground Light (Hover glow) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.25, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

export default function LiveTransit({ nightMode }) {
  console.log("LiveTransit rendering, nightMode:", nightMode);
  const shuttleRoute = useMemo(() => getShuttleRoute(), []);
  const botRoutes = useMemo(() => getBotRoutes(), []);
  
  const botColors = [C.cyan, C.mint, C.amber, C.violet];

  return (
    <group>
      <Html position={[0, 5, 0]} center>
        <div style={{ color: 'red', fontSize: '50px', background: 'white', padding: '10px', border: '5px solid red' }}>
          DEBUG: LIVE TRANSIT MOUNTED
        </div>
      </Html>
      {/* Shuttles on the inner loop */}
      <Shuttle curve={shuttleRoute} offset={0} speed={0.015} nightMode={nightMode} />
      <Shuttle curve={shuttleRoute} offset={0.33} speed={0.015} nightMode={nightMode} />
      <Shuttle curve={shuttleRoute} offset={0.66} speed={0.015} nightMode={nightMode} />

      {/* Autonomous bots on internal routes */}
      {botRoutes.map((curve, idx) => (
        <DeliveryBot 
          key={idx} 
          curve={curve} 
          offset={(idx * 0.07) % 1} 
          speed={0.03 + (idx % 3) * 0.01} 
          color={botColors[idx % botColors.length]} 
        />
      ))}
    </group>
  );
}

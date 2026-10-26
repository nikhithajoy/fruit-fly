"use client";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";

type SimState = {
  x: number; y: number; heading: number; pn: number; trend: number;
  eating: boolean; distance: number; time: number;
};

const FLY_SCALE = 3;   // draw the fly 3x life size so it's visible on the table

// ---------- the fly ----------

const LEG_COLOR = "#1b1410";
const LEGS = [
  // side: +1 left, -1 right; spread: +1 front, 0 middle, -1 hind; tripodA: which half of the gait
  { side: 1, spread: 1, attachX: 0.55, tripodA: true },
  { side: 1, spread: 0, attachX: 0.4, tripodA: false },
  { side: 1, spread: -1, attachX: 0.25, tripodA: true },
  { side: -1, spread: 1, attachX: 0.55, tripodA: false },
  { side: -1, spread: 0, attachX: 0.4, tripodA: true },
  { side: -1, spread: -1, attachX: 0.25, tripodA: false },
];

function Segment({ from, to, radius }: { from: number[]; to: number[]; radius: number }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const direction = b.clone().sub(a);
  const length = direction.length();
  const middle = a.clone().add(b).multiplyScalar(0.5);
  const rotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), direction.normalize());
  return (
    <mesh position={middle} quaternion={rotation} castShadow>
      <cylinderGeometry args={[radius, radius * 0.7, length, 6]} />
      <meshStandardMaterial color={LEG_COLOR} roughness={0.6} />
    </mesh>
  );
}

function FlyModel({ stateRef }: { stateRef: MutableRefObject<SimState | null> }) {
  const body = useRef<THREE.Group>(null!);
  const legs = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }) => {
    const s = stateRef.current;
    if (!s) return;
    body.current.position.set(s.x, 0, -s.y);
    body.current.rotation.y = s.heading;

    const gait = clock.elapsedTime * 14;
    legs.current.forEach((leg, i) => {
      if (!leg) return;
      const phase = LEGS[i].tripodA ? 0 : Math.PI;
      leg.rotation.y = s.eating ? 0 : 0.35 * Math.sin(gait + phase);
    });
  });

  return (
    <group ref={body} scale={FLY_SCALE}>
      {/* head with large red compound eyes */}
      <mesh position={[1.05, 0.62, 0]} castShadow>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshStandardMaterial color="#5a4632" roughness={0.5} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[1.12, 0.7, 0.22 * side]} castShadow>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color="#9b1c1c" roughness={0.25} metalness={0.1} />
        </mesh>
      ))}
      {/* thorax */}
      <mesh position={[0.4, 0.62, 0]} scale={[1.2, 0.95, 0.95]} castShadow>
        <sphereGeometry args={[0.45, 32, 32]} />
        <meshStandardMaterial color="#6b5a43" roughness={0.6} />
      </mesh>
      {/* abdomen */}
      <mesh position={[-0.55, 0.55, 0]} scale={[1.55, 0.8, 0.9]} castShadow>
        <sphereGeometry args={[0.45, 32, 32]} />
        <meshStandardMaterial color="#3d2f22" roughness={0.5} />
      </mesh>
      {/* translucent wings folded back over the abdomen */}
      {[1, -1].map((side) => (
        <group key={side} position={[-0.35, 0.98, 0.18 * side]} rotation={[0, 0.28 * side, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.6, 0, 0]} scale={[1.9, 0.6, 1]}>
            <circleGeometry args={[0.5, 32]} />
            <meshStandardMaterial color="#d8e6f0" transparent opacity={0.35}
                                  side={THREE.DoubleSide} roughness={0.1} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {/* six jointed legs */}
      {LEGS.map((leg, i) => (
        <group key={i} ref={(el) => { legs.current[i] = el; }}
               position={[leg.attachX, 0.5, 0.25 * leg.side]}>
          <Segment from={[0, 0, 0]} to={[0.3 * leg.spread, 0.3, 0.55 * leg.side]} radius={0.05} />
          <Segment from={[0.3 * leg.spread, 0.3, 0.55 * leg.side]}
                   to={[0.65 * leg.spread, -0.5, 1.0 * leg.side]} radius={0.04} />
        </group>
      ))}
    </group>
  );
}

// ---------- the world ----------

function Table({ onClick }: { onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={onClick}>
        <circleGeometry args={[100, 128]} />
        <meshStandardMaterial color="#b98b5e" roughness={0.75} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
        <planeGeometry args={[800, 800]} />
        <meshStandardMaterial color="#2b2b2b" roughness={1} />
      </mesh>
    </group>
  );
}

function Food({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x, 0, -y]}>
      <mesh position={[0, 5.5, 0]} castShadow>
        <sphereGeometry args={[6, 48, 48]} />
        <meshStandardMaterial color="#b3261e" roughness={0.35} />
      </mesh>
      <mesh position={[0, 12.3, 0]} rotation={[0, 0, 0.2]} castShadow>
        <cylinderGeometry args={[0.35, 0.5, 3.2]} />
        <meshStandardMaterial color="#5b3a1e" />
      </mesh>
      {/* a faint glow showing roughly where the smell spreads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[30, 64]} />
        <meshBasicMaterial color="#9be15d" transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---------- the panel ----------

const buttonStyle = {
  padding: "6px 12px", border: "1px solid #888", borderRadius: 6,
  cursor: "pointer", background: "transparent", color: "white",
};

function Panel({ state, hasFood, onRemove, onReset }: {
  state: SimState | null; hasFood: boolean; onRemove: () => void; onReset: () => void;
}) {
  const pn = state?.pn ?? 0;
  const trend = state?.trend ?? 0;
  const status = !hasFood ? "No food: wandering"
    : state?.eating ? "Found it: eating!"
    : trend > 2 ? "Smell getting stronger: keep going"
    : trend < -2 ? "Smell fading: try another direction"
    : "Searching";

  return (
    <div style={{
      position: "absolute", top: 16, left: 16, width: 330, padding: 16, borderRadius: 12,
      background: "rgba(0,0,0,0.6)", color: "white", fontFamily: "sans-serif",
      fontSize: 14, lineHeight: 1.6,
    }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Connectome fly</div>
      <div style={{ opacity: 0.8 }}>Click the table to place food. Drag to rotate, scroll to zoom.</div>
      <hr style={{ opacity: 0.2, margin: "12px 0" }} />
      <div>Status: {status}</div>
      <div>Distance to food: {hasFood && state ? `${state.distance.toFixed(0)} mm` : "–"}</div>
      <div style={{ marginTop: 8 }}>Vinegar projection neurons: {pn.toFixed(0)} Hz</div>
      <div style={{ height: 8, background: "#333", borderRadius: 4 }}>
        <div style={{ width: `${Math.min(100, (pn / 220) * 100)}%`, height: "100%",
                      background: "#9be15d", borderRadius: 4 }} />
      </div>
      <div>Trend: {trend.toFixed(1)}</div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button style={buttonStyle} onClick={onRemove}>Remove food</button>
        <button style={buttonStyle} onClick={onReset}>Reset fly</button>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, opacity: 0.6 }}>
        The fly smells with a 625-neuron circuit extracted from the MaleCNS connectome
        (CC-BY 4.0), running live in your browser. A simple run-and-tumble rule turns
        its signal into movement.
      </div>
    </div>
  );
}

// ---------- the page ----------

export default function Home() {
  const stateRef = useRef<SimState | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [food, setFood] = useState<[number, number] | null>(null);
  const [panelState, setPanelState] = useState<SimState | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("../lib/sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event) => { stateRef.current = event.data; };
    workerRef.current = worker;
    const timer = setInterval(() => setPanelState(stateRef.current), 100);
    return () => { worker.terminate(); clearInterval(timer); };
  }, []);

  function placeFood(event: ThreeEvent<MouseEvent>) {
    console.log("table clicked", event.point, "drag distance:", event.delta);
    if (event.delta > 3) return;        // ignore the end of a drag
    if (event.delta > 3) return;        // ignore the end of a drag
    event.stopPropagation();
    const x = event.point.x;
    const y = -event.point.z;
    if (Math.hypot(x, y) > 92) return;  // keep the food on the table
    setFood([x, y]);
    workerRef.current?.postMessage({ type: "food", x, y });
  }

  return (
    <main style={{ width: "100vw", height: "100vh", position: "relative", background: "#111" }}>
      <Canvas shadows camera={{ position: [0, 150, 150], fov: 45 }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[60, 140, 40]} intensity={1.6} castShadow
                          shadow-mapSize={[2048, 2048]}
                          shadow-camera-left={-120} shadow-camera-right={120}
                          shadow-camera-top={120} shadow-camera-bottom={-120} />
        <Environment preset="apartment" />
        <Table onClick={placeFood} />
        {food && <Food x={food[0]} y={food[1]} />}
        <FlyModel stateRef={stateRef} />
        <ContactShadows position={[0, 0.06, 0]} opacity={0.45} scale={220} blur={2.5} far={15} />
        <OrbitControls target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.2}
                       minDistance={25} maxDistance={400} />
      </Canvas>
      <Panel
        state={panelState}
        hasFood={food !== null}
        onRemove={() => { setFood(null); workerRef.current?.postMessage({ type: "remove-food" }); }}
        onReset={() => workerRef.current?.postMessage({ type: "reset" })}
      />
    </main>
  );
}
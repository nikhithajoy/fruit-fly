"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Fly from "@/components/Fly";
import Kitchen from "@/components/Kitchen";
import GameHud from "@/components/hud/GameHud";
import SimpleHud from "@/components/hud/SimpleHud";
import { CREDITS, type Controls, type LogEntry } from "@/components/hud/shared";
import { makeRandom } from "@/lib/brain";
import { ROOM, SURFACES, firstHit, isFree, type Vec3 } from "@/lib/kitchen";
import type { SimState } from "@/lib/sim";

const FOOD_RADIUS = 0.04;

// Where a click landed, if it's on a flat, upward-facing surface the food can sit on.
function surfacePoint(event: ThreeEvent<MouseEvent | PointerEvent>): Vec3 | null {
  if (!event.face) return null;
  const normal = event.face.normal.clone().transformDirection(event.object.matrixWorld);
  if (normal.y < 0.9) return null;
  const { x, y, z } = event.point;
  if (!isFree([x, y + FOOD_RADIUS, z], FOOD_RADIUS * 0.5)) return null;
  return [x, y, z];
}

// ---------- the food ----------

function Food({ at }: { at: Vec3 }) {
  const smell = useRef<THREE.Points>(null!);
  const particles = useMemo(() => {
    const random = makeRandom(7);
    const positions = new Float32Array(80 * 3);
    for (let i = 0; i < 80; i++) {
      const r = 0.05 + random() * 0.3;
      const angle = random() * 2 * Math.PI;
      positions.set([r * Math.cos(angle), random() * 0.4, r * Math.sin(angle)], i * 3);
    }
    return positions;
  }, []);

  // a wisp of smell drifting up from the fruit
  useFrame((_, delta) => {
    const attribute = smell.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    for (let i = 1; i < array.length; i += 3) array[i] = (array[i] + delta * 0.08) % 0.4;
    attribute.needsUpdate = true;
    smell.current.rotation.y += delta * 0.2;
  });

  return (
    <group position={at}>
      <mesh position={[0, FOOD_RADIUS, 0]} castShadow>
        <sphereGeometry args={[FOOD_RADIUS, 48, 48]} />
        <meshStandardMaterial color="#b3261e" roughness={0.35} />
      </mesh>
      <mesh position={[0, 2 * FOOD_RADIUS + 0.008, 0]} rotation={[0, 0, 0.2]} castShadow>
        <cylinderGeometry args={[0.0025, 0.0035, 0.022]} />
        <meshStandardMaterial color="#5b3a1e" />
      </mesh>
      <points ref={smell}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particles, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#9be15d" size={0.012} transparent opacity={0.5} depthWrite={false} />
      </points>
    </group>
  );
}

function PlacementMarker({ at }: { at: Vec3 }) {
  return (
    <mesh position={[at[0], at[1] + 0.003, at[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.035, 0.045, 32]} />
      <meshBasicMaterial color="#9be15d" transparent opacity={0.8} />
    </mesh>
  );
}

// ---------- the camera ----------

const CAMERA_MARGIN = 0.15;   // m: how close the camera may get to a wall, floor or ceiling
const CAMERA_MIN = new THREE.Vector3(...ROOM.min).addScalar(CAMERA_MARGIN);
const CAMERA_MAX = new THREE.Vector3(...ROOM.max).subScalar(CAMERA_MARGIN);

const FOLLOW_DISTANCE = 0.6;  // m: the furthest the camera sits from the fly when following

// Keeps the camera inside the kitchen. When following, it slides the orbit target
// along with the fly and, like a third-person game camera, moves in closer whenever
// furniture (say, the tabletop) would block the view, then eases back out.
function CameraRig({ flyPosition, follow }: { flyPosition: THREE.Vector3; follow: boolean }) {
  const controls = useThree((state) => state.controls) as unknown as
    { target: THREE.Vector3; update: () => void } | null;
  const shift = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const wanted = useRef(FOLLOW_DISTANCE);   // distance the viewer chose, by zooming
  const placed = useRef(0);                  // distance we left the camera at last frame

  useFrame(({ camera }) => {
    if (!controls) return;
    if (follow) {
      shift.copy(flyPosition).sub(controls.target).multiplyScalar(0.08);
      controls.target.add(shift);
      camera.position.add(shift);

      offset.copy(camera.position).sub(controls.target);
      const distance = offset.length();
      // any change since last frame came from the viewer zooming
      if (Math.abs(distance - placed.current) > 1e-3) wanted.current = Math.min(distance, FOLLOW_DISTANCE);
      offset.setLength(wanted.current);
      const target = controls.target.toArray() as Vec3;
      const ideal = controls.target.clone().add(offset).toArray() as Vec3;
      const clear = Math.max(0.05, firstHit(target, ideal, 0.03) * wanted.current - 0.03);
      const next = Math.min(clear, distance + 0.02);    // snap in, ease out
      camera.position.copy(controls.target).add(offset.setLength(next));
    }
    camera.position.clamp(CAMERA_MIN, CAMERA_MAX);
    controls.update();
    placed.current = camera.position.distanceTo(controls.target);
  });
  return null;
}

// ---------- the page ----------

const TRAIL_LENGTH = 150;    // mini-map trail points, sampled 10 times a second
const LOG_LENGTH = 200;      // console lines kept

const HELP = "Commands: pause, resume, follow, unfollow, reset, drop food <place>, remove food, " +
  `clear, about, exit. Places: ${SURFACES.map((s) => s.name).join(", ")}.`;

export default function Home() {
  const stateRef = useRef<SimState | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const eventsRef = useRef<LogEntry[]>([]);    // simulation events not yet shown
  const trailRef = useRef<Vec3[]>([]);
  const flyPosition = useMemo(() => new THREE.Vector3(), []);
  const [food, setFood] = useState<Vec3 | null>(null);
  const [placedOnce, setPlacedOnce] = useState(false);
  const [hover, setHover] = useState<Vec3 | null>(null);
  const [follow, setFollow] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameMode, setGameMode] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [panelState, setPanelState] = useState<SimState | null>(null);
  const [trail, setTrail] = useState<Vec3[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    const worker = new Worker(new URL("../lib/sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<SimState>) => {
      stateRef.current = event.data;
      eventsRef.current.push(...event.data.events);
    };
    workerRef.current = worker;
    const timer = setInterval(() => {
      const s = stateRef.current;
      setPanelState(s);
      if (s) {
        const points = trailRef.current;
        const last = points[points.length - 1];
        const moved = last ? Math.hypot(s.x - last[0], s.y - last[1], s.z - last[2]) : Infinity;
        if (moved > 0.5) points.length = 0;        // the fly was reset: start a new trail
        if (moved > 0.02) {
          points.push([s.x, s.y, s.z]);
          if (points.length > TRAIL_LENGTH) points.shift();
          setTrail([...points]);
        }
      }
      const fresh = eventsRef.current.splice(0);
      if (fresh.length) setLog((lines) => [...lines, ...fresh].slice(-LOG_LENGTH));
    }, 100);
    return () => { worker.terminate(); clearInterval(timer); };
  }, []);

  const post = (message: object) => workerRef.current?.postMessage(message);

  function dropFood(at: Vec3) {
    setFood(at);
    setPlacedOnce(true);
    post({ type: "food", x: at[0], y: at[1], z: at[2] });
  }

  function removeFood() {
    if (!food) return;
    setFood(null);
    post({ type: "remove-food" });
  }

  function setPausedTo(value: boolean) {
    setPaused(value);
    post({ type: value ? "pause" : "resume" });
  }

  const controls: Controls = {
    paused,
    follow,
    togglePause: () => setPausedTo(!paused),
    toggleFollow: () => setFollow((f) => !f),
    reset: () => post({ type: "reset" }),
    removeFood,
    toggleGameMode: () => setGameMode((g) => !g),
  };

  function addLog(...entries: LogEntry[]) {
    setLog((lines) => [...lines, ...entries].slice(-LOG_LENGTH));
  }
  const say = (text: string) => addLog({ time: null, source: "system", text });

  function runCommand(input: string) {
    const text = input.trim().toLowerCase().replace(/\s+/g, " ");
    if (!text) return;
    addLog({ time: null, source: "you", text: input.trim() });

    const place = text.match(/^(?:drop|place|put)(?: food)?(?: on)?(?: the)? (.+)$/)?.[1];
    if (place) {
      const surface = SURFACES.find((s) => s.name === place);
      if (surface) dropFood(surface.spot);
      else say(`There's no "${place}". Try: ${SURFACES.map((s) => s.name).join(", ")}.`);
      return;
    }
    switch (text) {
      case "help": return say(HELP);
      case "pause": setPausedTo(true); return say("Simulation paused.");
      case "resume": case "play": setPausedTo(false); return say("Simulation resumed.");
      case "follow": setFollow(true); return say("Camera following the fly.");
      case "unfollow": setFollow(false); return say("Camera free.");
      case "reset": return controls.reset();
      case "remove food": case "remove": return food ? removeFood() : say("There's no food to remove.");
      case "drop": case "drop food": return say("Where? For example: drop food table");
      case "clear": return setLog([]);
      case "about": return say(CREDITS);
      case "exit": return setGameMode(false);
      default: return say(`Unknown command "${text}". Type help.`);
    }
  }

  // Keyboard shortcuts, ignored while typing in the console.
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT") {
      if (e.key === "Escape") target.blur();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === " ") {
      e.preventDefault();
      controls.togglePause();
    }
    else if (key === "f") controls.toggleFollow();
    else if (key === "r") controls.reset();
    else if (key === "x") removeFood();
    else if (key === "g") controls.toggleGameMode();
    else if (key === "`" && gameMode) setConsoleOpen((open) => !open);
    else if (key === "enter" && gameMode && consoleOpen) document.getElementById("console-input")?.focus();
  });
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function placeFood(event: ThreeEvent<MouseEvent>) {
    if (event.delta > 3) return;        // ignore the end of a drag
    event.stopPropagation();
    const at = surfacePoint(event);
    if (at) dropFood(at);
  }

  function hoverSurface(event: ThreeEvent<PointerEvent> | null) {
    if (event) event.stopPropagation();
    setHover(event ? surfacePoint(event) : null);
  }

  return (
    <main style={{ width: "100vw", height: "100vh", position: "relative", background: "#111",
                   overflow: "hidden", cursor: hover ? "pointer" : "default" }}>
      <Canvas shadows camera={{ position: [1.8, 2.0, 1.3], fov: 60, near: 0.01, far: 20 }}>
        <color attach="background" args={["#f1ead9"]} />
        <ambientLight intensity={0.35} />
        <hemisphereLight args={["#fff8ee", "#8a7a66", 0.5]} />
        <directionalLight position={[-1.5, 4, 3]} intensity={1.4} castShadow
                          shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005}
                          shadow-camera-left={-4} shadow-camera-right={4}
                          shadow-camera-top={4} shadow-camera-bottom={-4} />
        <Environment preset="apartment" environmentIntensity={0.4} />
        <Kitchen onClick={placeFood} onHover={hoverSurface} />
        {hover && <PlacementMarker at={hover} />}
        {food && <Food at={food} />}
        <Fly stateRef={stateRef} position={flyPosition} paused={paused} />
        <OrbitControls makeDefault target={[-0.3, 0.8, -0.6]} maxPolarAngle={Math.PI / 2.05}
                       minDistance={follow ? 0.05 : 0.15} maxDistance={4} />
        <CameraRig flyPosition={flyPosition} follow={follow} />
      </Canvas>
      {/* the HUD lets clicks through to the kitchen except on its own panels */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {gameMode ? (
          <GameHud state={panelState} hasFood={food !== null} food={food} trail={trail} log={log}
                   consoleOpen={consoleOpen} onToggleConsole={() => setConsoleOpen((open) => !open)}
                   onCommand={runCommand} controls={controls} />
        ) : (
          <SimpleHud state={panelState} hasFood={food !== null} showHint={!placedOnce} controls={controls} />
        )}
      </div>
    </main>
  );
}

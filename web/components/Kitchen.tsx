"use client";

import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  BACK_COUNTER, CHAIRS, COUNTER_TOP, FRIDGE, HOOD, ROOM, SIDE_COUNTER, SINK, STOVE,
  TABLE_LEGS, TABLE_TOP, UPPER_LEFT, UPPER_RIGHT, WINDOW, boxCenter, boxSize, type Box, type Vec3,
} from "@/lib/kitchen";

const CABINET = "#6f8f7f";
const COUNTERTOP = "#ece7de";
const STEEL = "#b9bfc4";
const WOOD = "#a0703f";
const HANDLE = "#2e2e2e";

function Block({ box, color, roughness = 0.6, metalness = 0 }: {
  box: Box; color: string; roughness?: number; metalness?: number;
}) {
  return (
    <mesh position={boxCenter(box)} castShadow receiveShadow>
      <boxGeometry args={boxSize(box)} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

const box = (min: Vec3, max: Vec3): Box => ({ min, max });

// A run of base cabinets with a countertop. `front` is the axis and direction the doors face.
function Counter({ body, front }: { body: Box; front: { axis: 0 | 2; side: 1 | -1 } }) {
  const top = box([body.min[0], COUNTER_TOP - 0.04, body.min[2]], body.max);
  const cabinets = box(body.min, [body.max[0], COUNTER_TOP - 0.04, body.max[2]]);
  const along = front.axis === 2 ? 0 : 2;
  const faceAt = front.side > 0 ? body.max[front.axis] : body.min[front.axis];
  const doors = Math.max(1, Math.round((body.max[along] - body.min[along]) / 0.6));
  const doorWidth = (body.max[along] - body.min[along]) / doors;

  return (
    <group>
      <Block box={cabinets} color={CABINET} />
      <Block box={top} color={COUNTERTOP} roughness={0.25} />
      {Array.from({ length: doors }, (_, i) => {
        const p: Vec3 = [0, 0.7, 0];
        p[along] = body.min[along] + (i + 0.5) * doorWidth;
        p[front.axis] = faceAt + front.side * 0.012;
        const seam: Vec3 = [0, 0.43, 0];
        seam[along] = body.min[along] + i * doorWidth;
        seam[front.axis] = faceAt + front.side * 0.002;
        const seamSize: Vec3 = [0.006, 0.82, 0.006];
        const handleSize: Vec3 = [0.012, 0.012, 0.012];
        handleSize[along] = 0.14;
        return (
          <group key={i}>
            <mesh position={p}><boxGeometry args={handleSize} />
              <meshStandardMaterial color={HANDLE} metalness={0.6} roughness={0.3} /></mesh>
            {i > 0 && <mesh position={seam}><boxGeometry args={seamSize} />
              <meshStandardMaterial color="#4d665a" /></mesh>}
          </group>
        );
      })}
    </group>
  );
}

function UpperCabinet({ body }: { body: Box }) {
  const [cx, , ] = boxCenter(body);
  return (
    <group>
      <Block box={body} color={CABINET} />
      <mesh position={[cx, body.min[1] + 0.08, body.max[2] + 0.012]}>
        <boxGeometry args={[0.14, 0.012, 0.012]} />
        <meshStandardMaterial color={HANDLE} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Sink() {
  const { x, z, width, depth } = SINK;
  return (
    <group>
      <mesh position={[x, COUNTER_TOP + 0.001, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#6d7378" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* faucet */}
      <mesh position={[x, COUNTER_TOP + 0.14, z - depth / 2 - 0.04]} castShadow>
        <cylinderGeometry args={[0.015, 0.02, 0.28, 16]} />
        <meshStandardMaterial color={STEEL} metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[x, COUNTER_TOP + 0.27, z - depth / 2 + 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.2, 16]} />
        <meshStandardMaterial color={STEEL} metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  );
}

function Stove() {
  const { x, z, width } = STOVE;
  const front = BACK_COUNTER.max[2];
  return (
    <group>
      <mesh position={[x, COUNTER_TOP + 0.004, z + 0.05]} receiveShadow>
        <boxGeometry args={[width, 0.008, 0.55]} />
        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.3} />
      </mesh>
      {[[-0.14, -0.08], [0.14, -0.08], [-0.14, 0.18], [0.14, 0.18]].map(([dx, dz], i) => (
        <mesh key={i} position={[x + dx, COUNTER_TOP + 0.009, z + dz]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.07, 0.006, 8, 32]} />
          <meshStandardMaterial color="#5a5a5a" />
        </mesh>
      ))}
      {/* oven door and handle */}
      <mesh position={[x, 0.45, front + 0.004]}>
        <boxGeometry args={[width - 0.04, 0.55, 0.008]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.15} metalness={0.4} />
      </mesh>
      <mesh position={[x, 0.76, front + 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.01, 0.01, width - 0.12, 12]} />
        <meshStandardMaterial color={STEEL} metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Fridge() {
  const [cx] = boxCenter(FRIDGE);
  const front = FRIDGE.max[2];
  return (
    <group>
      <Block box={FRIDGE} color={STEEL} metalness={0.6} roughness={0.3} />
      <mesh position={[cx, 1.2, front + 0.002]}>
        <boxGeometry args={[0.8, 0.008, 0.004]} />
        <meshStandardMaterial color="#666" />
      </mesh>
      {[[1.5, 0.4], [0.75, 0.6]].map(([y, h], i) => (
        <mesh key={i} position={[FRIDGE.min[0] + 0.08, y, front + 0.03]} castShadow>
          <boxGeometry args={[0.02, h, 0.02]} />
          <meshStandardMaterial color="#ddd" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function Window() {
  const z = ROOM.min[2] + 0.003;
  const [x0, y0] = WINDOW.min;
  const [x1, y1] = WINDOW.max;
  const frame = "#f4f1ea";
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, z]}>
        <planeGeometry args={[x1 - x0, y1 - y0]} />
        <meshBasicMaterial color="#cfe8ff" />
      </mesh>
      {[
        [[(x0 + x1) / 2, y0], [x1 - x0 + 0.08, 0.05]], [[(x0 + x1) / 2, y1], [x1 - x0 + 0.08, 0.05]],
        [[x0, (y0 + y1) / 2], [0.05, y1 - y0]], [[x1, (y0 + y1) / 2], [0.05, y1 - y0]],
        [[(x0 + x1) / 2, (y0 + y1) / 2], [0.03, y1 - y0]],
      ].map(([[x, y], [w, h]], i) => (
        <mesh key={i} position={[x, y, z + 0.02]}>
          <boxGeometry args={[w, h, 0.04]} />
          <meshStandardMaterial color={frame} />
        </mesh>
      ))}
    </group>
  );
}

function Table() {
  return (
    <group>
      <Block box={TABLE_TOP} color={WOOD} roughness={0.5} />
      {TABLE_LEGS.map((leg, i) => <Block key={i} box={leg} color="#7a5230" />)}
      {CHAIRS.map((parts, i) => (
        <group key={i}>{parts.map((part, j) => <Block key={j} box={part} color="#7a5230" />)}</group>
      ))}
    </group>
  );
}

// A closed door on the front wall, seen when you turn the camera around.
function Door() {
  const z = ROOM.max[2] - 0.003;
  const x = -0.9;
  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 1.075, 0.01]}>
        <boxGeometry args={[1.0, 2.15, 0.02]} />
        <meshStandardMaterial color="#f4f1ea" />
      </mesh>
      <mesh position={[0, 1.02, 0.025]}>
        <boxGeometry args={[0.86, 2.04, 0.03]} />
        <meshStandardMaterial color={WOOD} roughness={0.55} />
      </mesh>
      <mesh position={[0.34, 1.0, 0.06]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial color={STEEL} metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function PendantLamp() {
  const [cx, , cz] = boxCenter(TABLE_TOP);
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 2.3, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <coneGeometry args={[0.18, 0.16, 32, 1, true]} />
        <meshStandardMaterial color="#333" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.9, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="#fff3d6" />
      </mesh>
      <pointLight position={[0, 1.85, 0]} intensity={2.5} distance={4} color="#ffe2b0" />
    </group>
  );
}

// The whole kitchen. Clicks and hovers on any surface are reported to the page.
export default function Kitchen({ onClick, onHover }: {
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onHover: (e: ThreeEvent<PointerEvent> | null) => void;
}) {
  const [w, h, d] = boxSize(ROOM);
  return (
    <group onClick={onClick} onPointerMove={onHover} onPointerOut={() => onHover(null)}>
      {/* a closed room: every surface faces inward, and the camera stays inside */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#cbbfae" roughness={0.8} />
      </mesh>
      <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#f7f4ee" />
      </mesh>
      <mesh position={[0, h / 2, ROOM.min[2]]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#f1ead9" />
      </mesh>
      <mesh position={[0, h / 2, ROOM.max[2]]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#f1ead9" />
      </mesh>
      <mesh position={[ROOM.min[0], h / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial color="#e9e1cf" />
      </mesh>
      <mesh position={[ROOM.max[0], h / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial color="#e9e1cf" />
      </mesh>
      <Door />
      {/* tiled backsplash behind the counters */}
      <mesh position={[(BACK_COUNTER.min[0] + BACK_COUNTER.max[0]) / 2, 1.0, ROOM.min[2] + 0.002]}>
        <planeGeometry args={[BACK_COUNTER.max[0] - BACK_COUNTER.min[0], 0.2]} />
        <meshStandardMaterial color="#dfe9ec" roughness={0.2} />
      </mesh>

      <Counter body={BACK_COUNTER} front={{ axis: 2, side: 1 }} />
      <Counter body={SIDE_COUNTER} front={{ axis: 0, side: 1 }} />
      <Sink />
      <Stove />
      <UpperCabinet body={UPPER_LEFT} />
      <UpperCabinet body={UPPER_RIGHT} />
      <Block box={HOOD} color={STEEL} metalness={0.7} roughness={0.3} />
      <Fridge />
      <Window />
      <Table />
      <PendantLamp />
    </group>
  );
}

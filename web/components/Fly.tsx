"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { SimState } from "@/lib/sim";

// A real fly is ~3 mm long, which would be invisible in a 4 m kitchen, so draw it ~10x.
const FLY_SCALE = 0.014;
const TRAIL_POINTS = 400;
const LEG_COLOR = "#1b1410";
const LEGS = [
  // side: +1 left, -1 right; spread: +1 front, 0 middle, -1 hind
  { side: 1, spread: 1, attachX: 0.55 },
  { side: 1, spread: 0, attachX: 0.4 },
  { side: 1, spread: -1, attachX: 0.25 },
  { side: -1, spread: 1, attachX: 0.55 },
  { side: -1, spread: 0, attachX: 0.4 },
  { side: -1, spread: -1, attachX: 0.25 },
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

// A faint line behind the fly so you can follow where it has been.
function Trail({ position }: { position: THREE.Vector3 }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3));
    geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({ color: "#ff5a36", transparent: true, opacity: 0.55 });
    return new THREE.Line(geometry, material);
  }, []);
  const count = useRef(0);
  const last = useRef(new THREE.Vector3(Infinity, 0, 0));

  useFrame(() => {
    if (position.distanceTo(last.current) < 0.02) return;
    last.current.copy(position);
    const attribute = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    if (count.current === TRAIL_POINTS) array.copyWithin(0, 3);
    else count.current++;
    array.set([position.x, position.y, position.z], (count.current - 1) * 3);
    attribute.needsUpdate = true;
    line.geometry.setDrawRange(0, count.current);
    line.geometry.computeBoundingSphere();
  });

  return <primitive object={line} />;
}

export default function Fly({ stateRef, position, paused }: {
  stateRef: MutableRefObject<SimState | null>;
  position: THREE.Vector3;      // smoothed position, shared with the camera
  paused: boolean;
}) {
  const body = useRef<THREE.Group>(null!);
  const wings = useRef<(THREE.Group | null)[]>([]);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const s = stateRef.current;
    if (!s) return;
    target.set(s.x, s.y, s.z);
    // the worker updates 50 times a second; glide between updates
    if (position.distanceTo(target) > 0.5) position.copy(target);
    else position.lerp(target, 0.35);
    body.current.position.copy(position);
    body.current.rotation.set(0, s.yaw, s.mode === "eating" ? 0 : s.pitch, "YZX");

    const flying = s.mode !== "eating";
    const flap = paused ? 0 : Math.sin(clock.elapsedTime * 70);
    wings.current.forEach((wing, i) => {
      if (!wing) return;
      const side = i === 0 ? 1 : -1;
      wing.rotation.set(flying ? side * 0.5 * flap : 0, side * (flying ? 1.2 : 0.28), 0);
    });
  });

  return (
    <>
      <Trail position={position} />
      <group ref={body}>
        <group scale={FLY_SCALE}>
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
          {/* translucent wings: folded back when perched, spread and beating in flight */}
          {[1, -1].map((side, i) => (
            <group key={side} ref={(el) => { wings.current[i] = el; }}
                   position={[0.2, 0.98, 0.18 * side]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.95, 0, 0]} scale={[1.9, 0.6, 1]}>
                <circleGeometry args={[0.5, 32]} />
                <meshStandardMaterial color="#d8e6f0" transparent opacity={0.35}
                                      side={THREE.DoubleSide} roughness={0.1} depthWrite={false} />
              </mesh>
            </group>
          ))}
          {/* six jointed legs */}
          {LEGS.map((leg, i) => (
            <group key={i} position={[leg.attachX, 0.5, 0.25 * leg.side]}>
              <Segment from={[0, 0, 0]} to={[0.3 * leg.spread, 0.3, 0.55 * leg.side]} radius={0.05} />
              <Segment from={[0.3 * leg.spread, 0.3, 0.55 * leg.side]}
                       to={[0.65 * leg.spread, -0.5, 1.0 * leg.side]} radius={0.04} />
            </group>
          ))}
        </group>
      </group>
    </>
  );
}

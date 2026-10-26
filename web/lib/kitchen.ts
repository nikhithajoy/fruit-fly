// The kitchen layout, in meters (x right, y up, z toward the viewer).
// Both the 3D scene and the fly's collision checks read these boxes, so what
// you see is what the fly bumps into.

export type Vec3 = [number, number, number];
export type Box = { min: Vec3; max: Vec3 };

export const ROOM: Box = { min: [-2, 0, -1.5], max: [2, 2.6, 1.5] };

export const COUNTER_TOP = 0.9;
export const BACK_COUNTER: Box = { min: [-2, 0, -1.5], max: [0.85, COUNTER_TOP, -0.9] };
export const SIDE_COUNTER: Box = { min: [-2, 0, -0.9], max: [-1.4, COUNTER_TOP, 0.4] };
export const SINK = { x: -0.8, z: -1.2, width: 0.6, depth: 0.4 };       // cut into the back counter
export const STOVE = { x: 0.4, z: -1.2, width: 0.6 };                   // sits on the back counter
export const UPPER_LEFT: Box = { min: [-2, 1.45, -1.5], max: [-1.25, 2.2, -1.15] };
export const UPPER_RIGHT: Box = { min: [-0.35, 1.45, -1.5], max: [0.05, 2.2, -1.15] };
export const HOOD: Box = { min: [0.1, 1.6, -1.5], max: [0.7, 2.2, -1.05] };
export const WINDOW = { min: [-1.15, 1.05], max: [-0.45, 2.0] };       // x and y range on the back wall
export const FRIDGE: Box = { min: [1.0, 0, -1.5], max: [1.8, 1.85, -0.8] };

export const TABLE_TOP: Box = { min: [-0.1, 0.72, 0.1], max: [1.1, 0.76, 0.9] };
export const TABLE_LEGS: Box[] = [
  [-0.05, 0.15], [1.0, 0.15], [-0.05, 0.8], [1.0, 0.8],
].map(([x, z]) => ({ min: [x, 0, z], max: [x + 0.05, 0.72, z + 0.05] }));

function chair(x: number, z: number, backSide: 1 | -1): Box[] {
  const seat: Box = { min: [x - 0.21, 0.43, z - 0.21], max: [x + 0.21, 0.47, z + 0.21] };
  const backX = x + backSide * 0.19;
  const back: Box = { min: [backX - 0.02, 0.47, z - 0.21], max: [backX + 0.02, 0.95, z + 0.21] };
  const legs: Box[] = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => {
    const lx = x + sx * 0.18;
    const lz = z + sz * 0.18;
    return { min: [lx - 0.02, 0, lz - 0.02], max: [lx + 0.02, 0.43, lz + 0.02] };
  });
  return [seat, back, ...legs];
}
export const CHAIRS: Box[][] = [chair(-0.45, 0.5, -1), chair(1.45, 0.5, 1)];

export const OBSTACLES: Box[] = [
  BACK_COUNTER, SIDE_COUNTER, UPPER_LEFT, UPPER_RIGHT, HOOD, FRIDGE,
  TABLE_TOP, ...TABLE_LEGS, ...CHAIRS.flat(),
];

// Places food can go, by name: for the event log and the game console's
// "drop food <place>". `spot` is where a dropped piece lands.
export const SURFACES: { name: string; tops: Box[]; spot: Vec3 }[] = [
  { name: "table", tops: [TABLE_TOP], spot: [0.5, TABLE_TOP.max[1], 0.5] },
  { name: "counter", tops: [BACK_COUNTER], spot: [-1.5, COUNTER_TOP, -1.2] },
  { name: "side counter", tops: [SIDE_COUNTER], spot: [-1.7, COUNTER_TOP, 0] },
  { name: "fridge", tops: [FRIDGE], spot: [1.4, FRIDGE.max[1], -1.15] },
  { name: "chair", tops: CHAIRS.map((parts) => parts[0]), spot: [-0.45, CHAIRS[0][0].max[1], 0.5] },
  { name: "floor", tops: [], spot: [0.5, 0, -0.4] },
];

// What a point on a flat surface is resting on: "table", "stove", "floor"...
export function surfaceName([x, y, z]: Vec3): string {
  if (Math.abs(x - STOVE.x) < STOVE.width / 2 && z > BACK_COUNTER.min[2] && y > COUNTER_TOP - 0.01
      && y < COUNTER_TOP + 0.02) return "stove";
  if (Math.abs(x - SINK.x) < SINK.width / 2 && Math.abs(z - SINK.z) < SINK.depth / 2
      && Math.abs(y - COUNTER_TOP) < 0.01) return "sink";
  const on = SURFACES.find(({ tops }) => tops.some((b) =>
    Math.abs(y - b.max[1]) < 0.01 && x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2]));
  return on?.name ?? (y < 0.01 ? "floor" : y > 1.4 ? "top of a cabinet" : "furniture");
}

export function boxSize(b: Box): Vec3 {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}

export function boxCenter(b: Box): Vec3 {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

// Is a point at least `margin` away from every wall and piece of furniture?
export function isFree(p: Vec3, margin: number): boolean {
  for (let a = 0; a < 3; a++) {
    if (p[a] < ROOM.min[a] + margin || p[a] > ROOM.max[a] - margin) return false;
  }
  return !OBSTACLES.some((b) =>
    p.every((v, a) => v > b.min[a] - margin && v < b.max[a] + margin));
}

// How far along the line from a to b (0 to 1) the first piece of furniture is; 1 if none.
export function firstHit(a: Vec3, b: Vec3, margin: number): number {
  let nearest = 1;
  for (const box of OBSTACLES) {
    let enter = 0;
    let exit = 1;
    for (let k = 0; k < 3 && enter < exit; k++) {
      const lo = box.min[k] - margin;
      const hi = box.max[k] + margin;
      const d = b[k] - a[k];
      if (Math.abs(d) < 1e-9) {
        if (a[k] <= lo || a[k] >= hi) exit = -1;
        continue;
      }
      const t1 = (lo - a[k]) / d;
      const t2 = (hi - a[k]) / d;
      enter = Math.max(enter, Math.min(t1, t2));
      exit = Math.min(exit, Math.max(t1, t2));
    }
    if (enter < exit) nearest = Math.min(nearest, enter);
  }
  return nearest;
}

// Can the fly travel in a straight line from a to b without hitting furniture?
export function isClearPath(a: Vec3, b: Vec3, margin: number): boolean {
  return firstHit(a, b, margin) === 1;
}

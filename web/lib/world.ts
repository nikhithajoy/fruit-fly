// The 3D version of flybrain/world.py: an odor plume and a flying fly, in meters.
import type { Vec3 } from "./kitchen";

// `length` is how far (m) the smell travels before dropping to about a third.
export type OdorSource = { x: number; y: number; z: number; peak: number; length: number };

// Unlike the Gaussian in world.py, the smell falls off exponentially, so it changes by
// the same fraction per meter everywhere in the room and the ORNs never saturate far
// from the food.
export function concentration(source: OdorSource | null, [x, y, z]: Vec3): number {
  if (!source) return 0;
  const d = Math.hypot(x - source.x, y - source.y, z - source.z);
  return source.peak * Math.exp(-d / source.length);
}

export function ornRate(c: number, maxRate = 150, halfMax = 0.3): number {
  return (maxRate * c) / (c + halfMax);
}

// Unit vector for a yaw (around the vertical, 0 = facing +x) and pitch (up is positive).
export function direction(yaw: number, pitch: number): Vec3 {
  return [Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.sin(yaw)];
}

export class Fly {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch = 0;
  antennaDistance = 0.002;        // 2 mm from body center
  antennaAngle = Math.PI / 6;     // 30 degrees either side of the heading

  constructor([x, y, z]: Vec3, yaw: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.yaw = yaw;
  }

  get position(): Vec3 {
    return [this.x, this.y, this.z];
  }

  antennae(): [Vec3, Vec3] {
    const at = (yaw: number): Vec3 => {
      const [dx, dy, dz] = direction(yaw, this.pitch);
      const d = this.antennaDistance;
      return [this.x + d * dx, this.y + d * dy, this.z + d * dz];
    };
    return [at(this.yaw + this.antennaAngle), at(this.yaw - this.antennaAngle)];
  }

  // Where the fly would be after flying forward for dt seconds.
  ahead(speed: number, dt: number): Vec3 {
    const [dx, dy, dz] = direction(this.yaw, this.pitch);
    return [this.x + speed * dt * dx, this.y + speed * dt * dy, this.z + speed * dt * dz];
  }

  moveTo([x, y, z]: Vec3) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

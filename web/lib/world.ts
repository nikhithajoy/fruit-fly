// A TypeScript port of flybrain/world.py.

export type OdorSource = { x: number; y: number; peak: number; sigma: number };

export function concentration(source: OdorSource | null, x: number, y: number): number {
  if (!source) return 0;
  const d2 = (x - source.x) ** 2 + (y - source.y) ** 2;
  return source.peak * Math.exp(-d2 / (2 * source.sigma ** 2));
}

export function ornRate(c: number, maxRate = 150, halfMax = 0.3): number {
  return (maxRate * c) / (c + halfMax);
}

export class Fly {
  x: number;
  y: number;
  heading: number;
  speed = 10;                     // mm per second
  antennaDistance = 2;            // mm from body center
  antennaAngle = Math.PI / 6;     // 30 degrees

  constructor(x: number, y: number, heading: number) {
    this.x = x;
    this.y = y;
    this.heading = heading;
  }

  antennae(): [[number, number], [number, number]] {
    const l = this.heading + this.antennaAngle;
    const r = this.heading - this.antennaAngle;
    return [
      [this.x + this.antennaDistance * Math.cos(l), this.y + this.antennaDistance * Math.sin(l)],
      [this.x + this.antennaDistance * Math.cos(r), this.y + this.antennaDistance * Math.sin(r)],
    ];
  }

  move(turnRate: number, dt: number, arenaRadius: number) {
    this.heading += turnRate * dt;
    this.x += this.speed * Math.cos(this.heading) * dt;
    this.y += this.speed * Math.sin(this.heading) * dt;
    const r = Math.hypot(this.x, this.y);
    if (r > arenaRadius) {
      this.x *= arenaRadius / r;
      this.y *= arenaRadius / r;
      this.heading = Math.atan2(-this.y, -this.x);
    }
  }
}
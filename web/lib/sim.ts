// The fly, its brain and the kitchen, stepped together. No browser APIs, so it
// runs the same in the web worker and in a Node test script.
import { Brain, makeRandom, type Circuit } from "./brain";
import { isClearPath, isFree, surfaceName, type Vec3 } from "./kitchen";
import { Fly, concentration, ornRate, type OdorSource } from "./world";

export const DT = 0.02;            // seconds per step
const FAST_TAU = 0.2;              // seconds: fast running average of the PN signal
const SLOW_TAU = 1.0;              // seconds: slow running average
const BASE_TUMBLE_RATE = 0.5;      // tumbles per second with no smell information
const TREND_GAIN = 0.25;           // change in tumbles per second, per Hz of trend
const MIN_RATE = 0.1;
const MAX_RATE = 4.0;

const FLIGHT_SPEED = 0.3;          // m/s
const MAX_PITCH = Math.PI / 4.5;   // 40 degrees: tumbles stay roughly level
const FLY_RADIUS = 0.015;          // m: how close the fly gets to walls and furniture
const ODOR_PEAK = 0.5;             // concentration at the food; ORNs are half-maximal at 0.3
const ODOR_LENGTH = 0.8;           // m: the smell reaches across the room
const FOOD_RADIUS = 0.04;          // m
const LANDING_RANGE = 0.35;        // m: close enough to see the food and land on it
const LANDING_SPEED = 0.15;        // m/s
export const START: Vec3 = [0.5, 1.5, 0.6];

// When the trend counts as "rising" or "fading" in the event log. Two thresholds
// each, so a noisy trend near the edge doesn't flood the log.
const TREND_ENTER = 3;
const TREND_LEAVE = 1;
const ORN_REPORT_EVERY = 5;        // seconds between ORN readouts in the log

export type Mode = "flying" | "landing" | "eating";

export type SimEvent = { time: number; source: "world" | "brain" | "fly"; text: string };

export type SimState = {
  x: number; y: number; z: number; yaw: number; pitch: number;
  pn: number; trend: number; mode: Mode; distance: number; time: number;
  searchTime: number | null;       // seconds since the food was placed, frozen once found
  events: SimEvent[];              // what happened since the last state
};

const degrees = (radians: number) => Math.round((radians * 180) / Math.PI);

export class Simulation {
  private brain: Brain;
  private nLeft: number;
  private pns: number[];
  private rates: Float32Array;
  private random: () => number;

  private food: OdorSource | null = null;
  private landingSpot: Vec3 | null = null;
  private fly: Fly;
  private mode: Mode = "flying";
  private fast = 0;
  private slow = 0;
  private time = 0;

  private foodTime = 0;
  private foundAfter: number | null = null;
  private smell: "rising" | "fading" | "steady" = "steady";
  private lastSmellLogged: "rising" | "fading" | null = null;
  private lastOrnReport = 0;
  private lastBump = -Infinity;
  private events: SimEvent[] = [];

  constructor(circuit: Circuit, seed = 1) {
    this.brain = new Brain(circuit, seed);
    const inputs = [...circuit.inputs.left_orns, ...circuit.inputs.right_orns];
    this.brain.setInputs(inputs);
    this.nLeft = circuit.inputs.left_orns.length;
    this.rates = new Float32Array(inputs.length);
    this.pns = circuit.readouts.vinegar_pns;
    this.random = makeRandom(seed + 1000);
    this.fly = new Fly(START, this.random() * 2 * Math.PI);
  }

  // Put food on a surface at the clicked point, or take it away (null).
  setFood(surface: Vec3 | null) {
    if (surface) {
      const [x, y, z] = surface;
      this.food = { x, y: y + FOOD_RADIUS, z, peak: ODOR_PEAK, length: ODOR_LENGTH };
      this.landingSpot = [x, y + 2 * FOOD_RADIUS, z];
      this.foodTime = this.time;
      this.foundAfter = null;
      const d = Math.hypot(this.fly.x - x, this.fly.y - y, this.fly.z - z);
      this.log("world", `Food placed on the ${surfaceName(surface)}, ${d.toFixed(1)} m from the fly`);
    } else {
      if (this.food) this.log("world", "Food removed");
      this.food = null;
      this.landingSpot = null;
    }
    if (this.mode !== "flying") this.takeOff();
  }

  reset() {
    this.fly = new Fly(START, this.random() * 2 * Math.PI);
    this.brain.reset();
    this.mode = "flying";
    this.fast = 0;
    this.slow = 0;
    this.smell = "steady";
    this.lastSmellLogged = null;
    if (this.food) {
      this.foodTime = this.time;
      this.foundAfter = null;
    }
    this.log("world", "Fly reset to the middle of the room");
  }

  step(): SimState {
    const { fly } = this;
    const [left, right] = fly.antennae();
    const ornLeft = ornRate(concentration(this.food, left));
    const ornRight = ornRate(concentration(this.food, right));
    this.rates.fill(ornLeft, 0, this.nLeft);
    this.rates.fill(ornRight, this.nLeft);

    const counts = this.brain.step(DT * 1000, this.rates);
    let spikes = 0;
    for (const p of this.pns) spikes += counts[p];
    const pnRate = spikes / this.pns.length / DT;
    this.fast += ((pnRate - this.fast) * DT) / FAST_TAU;
    this.slow += ((pnRate - this.slow) * DT) / SLOW_TAU;
    const trend = this.fast - this.slow;

    if (this.food && this.time - this.lastOrnReport >= ORN_REPORT_EVERY) {
      this.lastOrnReport = this.time;
      this.log("brain", `ORNs left ${ornLeft.toFixed(0)} Hz, right ${ornRight.toFixed(0)} Hz; ` +
        `vinegar PNs ${this.fast.toFixed(0)} Hz`);
    }
    if (this.mode === "flying") this.noteSmell(trend);

    const spot = this.landingSpot;
    const distance = spot ? Math.hypot(fly.x - spot[0], fly.y - spot[1], fly.z - spot[2]) : Infinity;

    if (this.mode === "flying" && spot && distance < LANDING_RANGE
        && isClearPath(fly.position, spot, FLY_RADIUS)) {
      this.mode = "landing";
      this.log("fly", `Spotted the food ${(distance * 100).toFixed(0)} cm away: landing`);
    }
    if (this.mode === "landing" && spot) this.land(spot, distance);
    if (this.mode === "flying") this.flyOn(trend);

    this.time += DT;
    const searchTime = this.food ? (this.foundAfter ?? this.time - this.foodTime) : null;
    const events = this.events;
    this.events = [];
    return {
      x: fly.x, y: fly.y, z: fly.z, yaw: fly.yaw, pitch: fly.pitch,
      pn: this.fast, trend, mode: this.mode, distance, time: this.time, searchTime, events,
    };
  }

  private log(source: SimEvent["source"], text: string) {
    this.events.push({ time: this.time, source, text });
  }

  // Log when the smell flips between rising and fading (not every dip back to steady).
  private noteSmell(trend: number) {
    if (trend > TREND_ENTER) this.smell = "rising";
    else if (trend < -TREND_ENTER) this.smell = "fading";
    else if (Math.abs(trend) < TREND_LEAVE) this.smell = "steady";
    if (this.smell === "steady" || this.smell === this.lastSmellLogged) return;
    this.lastSmellLogged = this.smell;
    const sign = trend > 0 ? "+" : "";
    this.log("brain", this.smell === "rising"
      ? `Smell rising (trend ${sign}${trend.toFixed(1)}): keep course`
      : `Smell fading (trend ${trend.toFixed(1)}): tumble more`);
  }

  // Run-and-tumble: the brain's trend sets how often the fly picks a new direction.
  private flyOn(trend: number) {
    const { fly, random } = this;
    const tumbleRate = Math.min(MAX_RATE, Math.max(MIN_RATE, BASE_TUMBLE_RATE - TREND_GAIN * trend));
    if (random() < tumbleRate * DT) {
      const size = Math.PI / 4 + random() * ((3 * Math.PI) / 4);
      const side = random() < 0.5 ? -1 : 1;
      fly.yaw += side * size;
      fly.pitch = (2 * random() - 1) * MAX_PITCH;
      this.log("fly", `Tumbled ${degrees(size)}° ${side > 0 ? "left" : "right"}, pitch ${degrees(fly.pitch)}°`);
    }

    // Bumped into something: veer off in a random direction that's open.
    for (let attempt = 0; attempt < 20; attempt++) {
      const next = fly.ahead(FLIGHT_SPEED, DT);
      if (isFree(next, FLY_RADIUS)) {
        fly.moveTo(next);
        return;
      }
      if (attempt === 0 && this.time - this.lastBump > 2) {
        this.lastBump = this.time;
        this.log("fly", "Bumped into something: veering off");
      }
      fly.yaw = random() * 2 * Math.PI;
      fly.pitch = (2 * random() - 1) * MAX_PITCH;
    }
  }

  private land(spot: Vec3, distance: number) {
    const { fly } = this;
    const step = LANDING_SPEED * DT;
    if (distance <= step) {
      fly.moveTo(spot);
      fly.pitch = 0;
      this.mode = "eating";
      this.foundAfter = this.time - this.foodTime;
      this.log("fly", `Landed on the food after ${formatTime(this.foundAfter)}: eating`);
      return;
    }
    const [dx, dy, dz] = [spot[0] - fly.x, spot[1] - fly.y, spot[2] - fly.z];
    fly.yaw = Math.atan2(-dz, dx);
    fly.pitch = Math.asin(dy / distance);
    fly.moveTo([fly.x + (dx / distance) * step, fly.y + (dy / distance) * step,
                fly.z + (dz / distance) * step]);
  }

  private takeOff() {
    this.mode = "flying";
    this.fly.pitch = MAX_PITCH;
    this.log("fly", "Took off");
  }
}

// 83.4 seconds -> "1:23"
export function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

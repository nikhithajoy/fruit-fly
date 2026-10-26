// Runs the brain and the world in a background thread, in real time.
import { Brain, type Circuit } from "./brain";
import { Fly, concentration, ornRate, type OdorSource } from "./world";

const DT = 0.02;
const FAST_TAU = 0.2;
const SLOW_TAU = 1.0;
const BASE_TUMBLE_RATE = 0.5;
const TREND_GAIN = 0.1;
const MIN_RATE = 0.1;
const MAX_RATE = 4.0;
const ARENA_RADIUS = 100;
const EAT_DISTANCE = 6;          // mm: close enough to start eating

let brain: Brain | null = null;
let pns: number[] = [];
let nLeft = 0;
let rates = new Float32Array(0);
let food: OdorSource | null = null;
let fly = new Fly(0, -60, Math.random() * 2 * Math.PI);
let fast = 0;
let slow = 0;
let time = 0;

const post = (message: unknown) =>
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(message);

async function init() {
  const circuit: Circuit = await (await fetch("/brain/vinegar_circuit.json")).json();
  brain = new Brain(circuit, 1);
  const inputs = [...circuit.inputs.left_orns, ...circuit.inputs.right_orns];
  brain.setInputs(inputs);
  nLeft = circuit.inputs.left_orns.length;
  rates = new Float32Array(inputs.length);
  pns = circuit.readouts.vinegar_pns;
  setInterval(tick, DT * 1000);
}

function tick() {
  if (!brain) return;

  const [[lx, ly], [rx, ry]] = fly.antennae();
  const ornLeft = ornRate(concentration(food, lx, ly));
  const ornRight = ornRate(concentration(food, rx, ry));
  rates.fill(ornLeft, 0, nLeft);
  rates.fill(ornRight, nLeft);

  const counts = brain.step(DT * 1000, rates);
  let spikes = 0;
  for (const p of pns) spikes += counts[p];
  const pnRate = spikes / pns.length / DT;
  fast += ((pnRate - fast) * DT) / FAST_TAU;
  slow += ((pnRate - slow) * DT) / SLOW_TAU;
  const trend = fast - slow;

  const distance = food ? Math.hypot(fly.x - food.x, fly.y - food.y) : Infinity;
  const eating = distance < EAT_DISTANCE;

  if (!eating) {
    const tumbleRate = Math.min(MAX_RATE, Math.max(MIN_RATE, BASE_TUMBLE_RATE - TREND_GAIN * trend));
    if (Math.random() < tumbleRate * DT) {
      const size = Math.PI / 4 + Math.random() * ((3 * Math.PI) / 4);
      fly.heading += (Math.random() < 0.5 ? -1 : 1) * size;
    }
    fly.move(0, DT, ARENA_RADIUS);
  }

  time += DT;
  post({ x: fly.x, y: fly.y, heading: fly.heading, pn: fast, trend, eating, distance, time });
}

self.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data;
  if (msg.type === "food") food = { x: msg.x, y: msg.y, peak: 1, sigma: 30 };
  if (msg.type === "remove-food") food = null;
  if (msg.type === "reset") {
    fly = new Fly(0, -60, Math.random() * 2 * Math.PI);
    brain?.reset();
    fast = 0;
    slow = 0;
  }
});

init();
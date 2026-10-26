// Runs the simulation in a background thread, in real time.
import type { Circuit } from "./brain";
import { DT, Simulation } from "./sim";

type Message =
  | { type: "food"; x: number; y: number; z: number }
  | { type: "remove-food" | "reset" | "pause" | "resume" };

let sim: Simulation | null = null;
let paused = false;
const pending: Message[] = [];     // messages that arrive while the circuit is still loading

const post = (message: unknown) =>
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(message);

function handle(sim: Simulation, msg: Message) {
  if (msg.type === "food") sim.setFood([msg.x, msg.y, msg.z]);
  if (msg.type === "remove-food") sim.setFood(null);
  if (msg.type === "reset") sim.reset();
  if (msg.type === "pause") paused = true;
  if (msg.type === "resume") paused = false;
}

async function init() {
  const circuit: Circuit = await (await fetch("/brain/vinegar_circuit.json")).json();
  const ready = new Simulation(circuit, 1);
  pending.splice(0).forEach((msg) => handle(ready, msg));
  sim = ready;
  setInterval(() => { if (!paused) post(ready.step()); }, DT * 1000);
}

self.addEventListener("message", (event: MessageEvent<Message>) => {
  if (sim) handle(sim, event.data);
  else pending.push(event.data);
});

init();

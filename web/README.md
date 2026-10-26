# Ocellus web app

The browser half of [Ocellus: a fruit fly simulator](../README.md). A fly's 625-neuron smell circuit, taken from the MaleCNS connectome, runs live in a Web Worker and steers the fly to food you drop in a 3D kitchen.

Live at **[ocellus-theta.vercel.app](https://ocellus-theta.vercel.app)**. For how the science works, how to use the app and where the circuit comes from, see the [root README](../README.md).

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build; every page is static
npm run lint
```

Two pages:

- **`/`** is the kitchen.
- **`/validate`** runs the TypeScript brain engine and compares its projection-neuron rates with the Python reference values stored in the circuit file. Use it after changing [`lib/brain.ts`](lib/brain.ts).

## How the code fits together

```
app/
  page.tsx            the scene, camera rig, keyboard shortcuts and console commands
  validate/page.tsx   engine check against the Python simulator
  layout.tsx          page title and description (used in link previews)
components/
  Kitchen.tsx         the room, built from the boxes in lib/kitchen.ts
  Fly.tsx             the fly model, wing animation and trail
  hud/SimpleHud.tsx   default view: status pill, toolbar, views menu
  hud/GameHud.tsx     game mode: objective, mini-map, brain readout, console, hotbar
  hud/shared.ts       status text, credits and the Controls type both HUDs use
lib/
  brain.ts            leaky integrate-and-fire engine; a port of flybrain/brain.py
  sim.ts              brain + 3D world + run-and-tumble, stepped together
  sim.worker.ts       runs sim.ts in a background thread, 50 steps per second
  kitchen.ts          room, furniture, named surfaces and camera views, in meters
  world.ts            odor plume, ORN response and the fly's body
public/brain/
  vinegar_circuit.json  the exported circuit (from sims/export_brain.py)
```

A few things worth knowing before changing them:

- **One layout file.** [`lib/kitchen.ts`](lib/kitchen.ts) is the single source of truth for the room. Rendering, collisions, the mini-map, the `drop food <place>` command and the preset views all read it, so moving a piece of furniture means editing one box.
- **No browser APIs in the simulation.** [`lib/sim.ts`](lib/sim.ts) runs in Node as well as the worker, which makes it easy to test flight behavior or tune parameters headlessly. The worker only handles messages and the clock.
- **Messages to the worker:**
  - The page sends `food`, `remove-food`, `reset`, `pause` and `resume`. Messages sent before the circuit has loaded are queued.
  - The worker replies with a `SimState` each step, including any log `events` for the game console.
- **Updating the circuit.** To change the circuit, re-run `sims/export_brain.py` from the repo root and copy `exports/vinegar_circuit.json` into `public/brain/`. Then check `/validate`.
- **Next.js 16.** This app uses Next.js 16, which differs from older versions. See [`AGENTS.md`](AGENTS.md) and the docs in `node_modules/next/dist/docs/`.

## Deploying

The app is fully static, with no server code or environment variables, so any static host works. On Vercel, import the repo and set **Root Directory** to `web`. Every push to `main` redeploys.

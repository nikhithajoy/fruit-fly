# Ocellus web app: notes for coding agents

The Next.js app for Ocellus, a fruit fly simulator: a 625-neuron spiking circuit from the MaleCNS connectome steers a fly to food in a 3D kitchen. [README.md](README.md) has the file map. The science is in the [root README](../README.md).

## Checks

Run both after every change. Neither should print anything:

```bash
npx tsc --noEmit
npx eslint app components lib
```

`npm run build` should also pass; every route is static.

## Rules of the codebase

- **`lib/kitchen.ts` is the single source of truth for the room.** Rendering, collisions, the mini-map, `drop food <place>` and the preset views all read its boxes. Never hard-code furniture positions anywhere else. Units are meters, y is up and +z points toward the default camera.
- **`lib/sim.ts` must stay free of browser APIs** (no `window`, `self`, `fetch` or DOM). It runs in the worker and in Node for headless tests. Only `lib/sim.worker.ts` touches worker globals.
- **`lib/brain.ts` mirrors `../flybrain/brain.py`.** If you change the engine, open `/validate` and confirm the TypeScript rates still match the Python reference values in the circuit file.
- **Behavior constants live in `lib/sim.ts`:** tumble rates, trend gain, odor peak and length, speeds. They were tuned with headless trials. If you change them, re-measure how often and how fast flies find food against a no-smell control, and don't tune by eye.
- **Randomness in the simulation uses `makeRandom` (seeded)**, so trials are reproducible. In React render code, `Math.random` fails the `react-hooks/purity` lint rule, so use `makeRandom` there too.
- **The React lint rules are strict.** Don't assign to a property of a value created by `useMemo`/`useRef` inside `useFrame` (e.g. `v.y += 1`); use three.js methods such as `addScaledVector`. For window listeners that need fresh state, use `useEffectEvent`.

## Conventions

- **Styling:** inline style objects, matching the existing components. Tailwind is installed but unused. Fonts are Geist Sans and Geist Mono through `var(--font-geist-sans)` and `var(--font-geist-mono)`.
- **Comments:** a short header comment per component or module saying what it is, and a comment on any constant whose unit or meaning isn't obvious. Don't comment the obvious.
- **HUD actions:** both HUDs act through the `Controls` object in `components/hud/shared.ts`. Add new actions there, not as ad-hoc props.
- **Keyboard shortcuts:** they live in `app/page.tsx` (actions) and `CameraRig` (movement keys). Check both before claiming a key. Taken: Space, F, R, X, G, `, Enter, 1–7, W/A/S/D, Q/E and the arrow keys.

## Testing the simulation headlessly

`lib/sim.ts` imports without file extensions, as Next expects, so plain `node` needs a resolve hook to add `.ts`:

```js
// hooks.mjs
export async function resolve(spec, ctx, next) {
  if (spec.startsWith(".") && !/\.\w+$/.test(spec)) return next(spec + ".ts", ctx);
  return next(spec, ctx);
}
// register.mjs
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
```

Then `node --import ./register.mjs your-test.ts` can import `lib/sim.ts` and load `public/brain/vinegar_circuit.json` with `fs`. Keep these scripts outside the repo, or in a scratch folder.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

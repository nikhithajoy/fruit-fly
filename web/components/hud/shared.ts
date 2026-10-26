import type { SimEvent, SimState } from "@/lib/sim";

// What both HUDs can do to the simulation and the view.
export type Controls = {
  paused: boolean;
  follow: boolean;
  togglePause: () => void;
  toggleFollow: () => void;
  reset: () => void;
  removeFood: () => void;
  toggleGameMode: () => void;
};

export type LogEntry = {
  time: number | null;                                 // simulation time, if the simulation said it
  source: SimEvent["source"] | "you" | "system";
  text: string;
};

export const CREDITS =
  "The fly smells with a 625-neuron circuit extracted from the MaleCNS connectome " +
  "(CC-BY 4.0), running live in your browser. A run-and-tumble rule turns its signal into " +
  "flight; once it is within about 35 cm it sees the food and lands. The fly is drawn about " +
  "10x life size.";

export const TONE_COLORS = { good: "#9be15d", bad: "#ffb547", neutral: "#b8b8b8" };

export function statusOf(state: SimState | null, hasFood: boolean, paused: boolean):
    { text: string; tone: keyof typeof TONE_COLORS } {
  const trend = state?.trend ?? 0;
  if (paused) return { text: "Paused", tone: "neutral" };
  if (!hasFood) return { text: "No food: exploring the kitchen", tone: "neutral" };
  if (state?.mode === "eating") return { text: "Found it: eating!", tone: "good" };
  if (state?.mode === "landing") return { text: "Spotted it: coming in to land", tone: "good" };
  if (trend > 2) return { text: "Smell getting stronger", tone: "good" };
  if (trend < -2) return { text: "Smell fading: trying another way", tone: "bad" };
  return { text: "Searching", tone: "neutral" };
}

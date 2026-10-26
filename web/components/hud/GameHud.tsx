"use client";

// Game mode: an objective card, a mini-map, a brain readout, an event console you can
// type commands into, and a hotbar of keyboard shortcuts.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  BACK_COUNTER, CHAIRS, FRIDGE, HOOD, ROOM, SIDE_COUNTER, TABLE_TOP, UPPER_LEFT, UPPER_RIGHT,
  boxSize, type Box, type Vec3,
} from "@/lib/kitchen";
import { formatTime, type SimState } from "@/lib/sim";
import type { Controls, LogEntry } from "./shared";

const ACCENT = "#9be15d";
const TEXT = "#f2f5f0";
const MUTED = "#a3aca7";
const MONO = "var(--font-geist-mono), monospace";
const SOURCE_COLORS: Record<LogEntry["source"], string> = {
  world: "#7cc4ff", brain: ACCENT, fly: "#ffb547", you: TEXT, system: MUTED,
};

const panel: CSSProperties = {
  position: "absolute", display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px",
  boxSizing: "border-box", borderRadius: 10, border: "1px solid rgba(155, 225, 93, 0.4)",
  background: "rgba(10, 12, 14, 0.84)", color: TEXT, pointerEvents: "auto",
};
const label: CSSProperties = { font: `500 11px ${MONO}`, letterSpacing: "0.12em", color: ACCENT };

function Objective({ state, hasFood }: { state: SimState | null; hasFood: boolean }) {
  const found = state?.mode === "eating";
  const lit = !hasFood || !state ? 0
    : found ? 10 : Math.max(0, Math.min(10, Math.round(10 * (1 - state.distance / 3.5))));
  return (
    <div style={{ ...panel, left: 16, top: 16, width: 300, maxWidth: "calc(100vw - 32px)" }}>
      <div style={{ ...label, display: "flex", justifyContent: "space-between" }}>
        <span>OBJECTIVE</span>
        {state?.searchTime != null && <span style={{ color: MUTED }}>T+{formatTime(state.searchTime)}</span>}
      </div>
      <span style={{ fontSize: 20, fontWeight: 700 }}>
        {!hasFood ? "Drop some food" : found ? "Food found!" : "Find the food"}
      </span>
      {!hasFood ? (
        <span style={{ fontSize: 13, color: MUTED }}>Click any surface, or type “drop food table”</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", font: `12px ${MONO}`, color: MUTED }}>
            <span>{found ? "FOUND IN" : "PROXIMITY"}</span>
            <span>{found ? formatTime(state?.searchTime ?? 0) : state ? `${(state.distance * 100).toFixed(0)} cm` : "–"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: 3 }}>
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} style={{ height: 8, background: i < lit ? ACCENT : "#2c332f" }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const MAP_ITEMS: { box: Box; fill: string; overhead?: boolean }[] = [
  { box: BACK_COUNTER, fill: "#3c5247" },
  { box: SIDE_COUNTER, fill: "#3c5247" },
  { box: FRIDGE, fill: "#5b6268" },
  { box: TABLE_TOP, fill: "#6b4a2a" },
  ...CHAIRS.flatMap((parts) => parts.slice(0, 2).map((box) => ({ box, fill: "#4d3520" }))),
  ...[UPPER_LEFT, UPPER_RIGHT, HOOD].map((box) => ({ box, fill: "none", overhead: true })),
];

// Top-down view, drawn in meters: x across, z down the page (the back wall at the top).
function MiniMap({ state, food, trail }: { state: SimState | null; food: Vec3 | null; trail: Vec3[] }) {
  const [width, , depth] = boxSize(ROOM);
  return (
    <div style={{ ...panel, right: 16, top: 16, width: 240 }}>
      <span style={label}>MAP</span>
      <svg role="img" aria-label="Top-down map of the kitchen showing the fly and the food"
           width="212" height={(212 * depth) / width}
           viewBox={`${ROOM.min[0]} ${ROOM.min[2]} ${width} ${depth}`}>
        <rect x={ROOM.min[0]} y={ROOM.min[2]} width={width} height={depth} fill="#151a17" />
        {MAP_ITEMS.map(({ box, fill, overhead }, i) => (
          <rect key={i} x={box.min[0]} y={box.min[2]} width={box.max[0] - box.min[0]}
                height={box.max[2] - box.min[2]} fill={fill}
                stroke={overhead ? "#6d7a72" : "none"} strokeWidth={0.015}
                strokeDasharray={overhead ? "0.05 0.04" : undefined} />
        ))}
        {food && <>
          <circle cx={food[0]} cy={food[2]} r={0.35} fill="none" stroke={ACCENT}
                  strokeOpacity={0.5} strokeWidth={0.015} strokeDasharray="0.05 0.05" />
          <circle cx={food[0]} cy={food[2]} r={0.07} fill="#e0443a" />
        </>}
        {trail.length > 1 && (
          <polyline points={trail.map(([x, , z]) => `${x},${z}`).join(" ")} fill="none"
                    stroke="#ff5a36" strokeOpacity={0.8} strokeWidth={0.025} strokeLinejoin="round" />
        )}
        {state && (
          <polygon points="0.13,0 -0.08,0.08 -0.08,-0.08" fill={ACCENT}
                   transform={`translate(${state.x} ${state.z}) rotate(${(-state.yaw * 180) / Math.PI})`} />
        )}
        <rect x={ROOM.min[0]} y={ROOM.min[2]} width={width} height={depth} fill="none"
              stroke="#3d4741" strokeWidth={0.03} />
      </svg>
      {state && <span style={{ font: `11px ${MONO}`, color: MUTED }}>
        Altitude {(state.y * 100).toFixed(0)} cm
      </span>}
    </div>
  );
}

function BrainReadout({ state }: { state: SimState | null }) {
  const pn = state?.pn ?? 0;
  const trend = state?.trend ?? 0;
  const rising = trend >= 0;
  return (
    <div style={{ ...panel, right: 16, top: 270, width: 240 }}>
      <span style={label}>BRAIN</span>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 13, color: MUTED }}>Vinegar PNs</span>
        <span style={{ font: `700 18px ${MONO}` }}>{pn.toFixed(0)} Hz</span>
      </div>
      <div style={{ height: 6, background: "#2c332f" }}>
        <div style={{ width: `${Math.min(100, (pn / 220) * 100)}%`, height: 6, background: ACCENT }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: MUTED }}>Trend</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, font: `700 15px ${MONO}`,
                       color: rising ? ACCENT : "#ffb547" }}>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
            <path d={rising ? "M6 1 L11 10 L1 10 Z" : "M6 11 L11 2 L1 2 Z"} fill="currentColor" />
          </svg>
          {rising ? "+" : ""}{trend.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function Console({ log, open, onToggle, onCommand }: {
  log: LogEntry[]; open: boolean; onToggle: () => void; onCommand: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log, open]);

  return (
    <div style={{ ...panel, left: 16, bottom: 16, width: 560, maxWidth: "calc(100vw - 32px)",
                  padding: 0, gap: 0, fontFamily: MONO, background: "rgba(8, 10, 12, 0.88)" }}>
      <button onClick={onToggle} aria-expanded={open} style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px",
        border: "none", borderBottom: open ? "1px solid #2a312d" : "none", background: "transparent",
        font: `500 11px ${MONO}`, letterSpacing: "0.12em", cursor: "pointer",
      }}>
        <span style={{ color: ACCENT }}>CONSOLE</span>
        <span style={{ color: MUTED }}>` to {open ? "hide" : "show"}</span>
      </button>
      {open && <>
        <div ref={scroller} role="log" aria-live="polite" style={{
          height: 180, overflowY: "auto", padding: "8px 14px", fontSize: 13, lineHeight: 1.45,
        }}>
          {log.length === 0 && <div style={{ color: MUTED }}>Type help to see what you can do.</div>}
          {log.map((entry, i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <span style={{ color: MUTED, flexShrink: 0, width: 36 }}>
                {entry.time != null ? formatTime(entry.time) : ""}
              </span>
              <span style={{ color: SOURCE_COLORS[entry.source], flexShrink: 0, width: 52 }}>
                {entry.source === "system" ? "" : entry.source.toUpperCase()}
              </span>
              <span style={{ color: entry.source === "system" ? MUTED : TEXT }}>{entry.text}</span>
            </div>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onCommand(input); setInput(""); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 12px",
                       borderTop: "1px solid #2a312d" }}>
          <label htmlFor="console-input" style={{ color: ACCENT, fontSize: 14 }}>&gt;</label>
          <input id="console-input" value={input} onChange={(e) => setInput(e.target.value)}
                 aria-label="Console command" autoComplete="off" spellCheck={false}
                 placeholder="pause, follow, reset, drop food table, help"
                 style={{ flex: 1, height: 28, border: "none", outline: "none", background: "transparent",
                          color: TEXT, font: `13px ${MONO}` }} />
        </form>
      </>}
    </div>
  );
}

function HotKey({ keyName, label: text, active, disabled, onClick }: {
  keyName: string; label: string; active?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
      width: 76, height: 64, borderRadius: 8, border: `1px solid ${active ? ACCENT : "#2f3833"}`,
      background: active ? "#1f2a1b" : "#161b18", color: TEXT, opacity: disabled ? 0.45 : 1,
      font: "500 12px var(--font-geist-sans), sans-serif", cursor: disabled ? "default" : "pointer",
    }}>
      <span style={{ padding: "1px 6px", borderRadius: 4, background: "#2c332f",
                     font: `500 11px ${MONO}`, color: ACCENT }}>{keyName}</span>
      {text}
    </button>
  );
}

export default function GameHud({ state, hasFood, food, trail, log, consoleOpen, onToggleConsole,
                                  onCommand, controls }: {
  state: SimState | null; hasFood: boolean; food: Vec3 | null; trail: Vec3[]; log: LogEntry[];
  consoleOpen: boolean; onToggleConsole: () => void; onCommand: (text: string) => void;
  controls: Controls;
}) {
  return (
    <>
      <Objective state={state} hasFood={hasFood} />
      <MiniMap state={state} food={food} trail={trail} />
      <BrainReadout state={state} />
      <Console log={log} open={consoleOpen} onToggle={onToggleConsole} onCommand={onCommand} />
      <div style={{ ...panel, right: 16, bottom: 16, flexDirection: "row", flexWrap: "wrap", gap: 6,
                    padding: 6, borderRadius: 12 }}>
        <HotKey keyName="Space" label={controls.paused ? "Resume" : "Pause"} active={controls.paused}
                onClick={controls.togglePause} />
        <HotKey keyName="F" label="Follow" active={controls.follow} onClick={controls.toggleFollow} />
        <HotKey keyName="R" label="Reset" onClick={controls.reset} />
        <HotKey keyName="X" label="No food" disabled={!hasFood} onClick={controls.removeFood} />
        <HotKey keyName="G" label="Exit game" onClick={controls.toggleGameMode} />
      </div>
    </>
  );
}

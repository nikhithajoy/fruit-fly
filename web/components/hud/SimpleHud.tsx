"use client";

// The default view: a status pill, an about button and a toolbar, leaving the kitchen clear.
import { useState, type CSSProperties, type ReactNode } from "react";
import type { SimState } from "@/lib/sim";
import { CloseIcon, FollowIcon, GamepadIcon, InfoIcon, PauseIcon, PlayIcon, ResetIcon, ViewsIcon } from "./icons";
import { VIEWS } from "@/lib/kitchen";
import { CREDITS, NAVIGATION_HELP, TONE_COLORS, statusOf, type Controls } from "./shared";

const GLASS = "rgba(20, 20, 22, 0.74)";

const pill: CSSProperties = {
  position: "absolute", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px",
  borderRadius: 999, background: GLASS, color: "white", fontSize: 15, pointerEvents: "auto",
  maxWidth: "calc(100vw - 96px)",
};

function ToolButton({ icon, label, active, disabled, title, onClick }: {
  icon: ReactNode; label: string; active?: boolean; disabled?: boolean; title: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 16px", border: "none",
      borderRadius: 11, background: active ? "rgba(255, 255, 255, 0.16)" : "transparent",
      color: "white", font: "500 14px var(--font-geist-sans), sans-serif",
      cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
    }}>
      {icon}{label}
    </button>
  );
}

export default function SimpleHud({ state, hasFood, showHint, controls }: {
  state: SimState | null; hasFood: boolean; showHint: boolean; controls: Controls;
}) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const status = statusOf(state, hasFood, controls.paused);

  return (
    <>
      <div style={{ ...pill, left: 16, top: 16 }} role="status">
        <span style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                       background: TONE_COLORS[status.tone] }} />
        <span style={{ fontWeight: 600 }}>{status.text}</span>
        {hasFood && state && state.mode !== "eating" && <>
          <span style={{ width: 1, height: 16, background: "rgba(255, 255, 255, 0.3)" }} />
          <span style={{ color: "#e4e4e4", whiteSpace: "nowrap" }}>
            {(state.distance * 100).toFixed(0)} cm to food
          </span>
        </>}
      </div>

      <button aria-label="About this simulation" aria-expanded={aboutOpen}
              onClick={() => setAboutOpen((open) => !open)} style={{
        position: "absolute", right: 16, top: 16, width: 44, height: 44, borderRadius: "50%",
        border: "none", background: GLASS, color: "white", display: "flex", alignItems: "center",
        justifyContent: "center", cursor: "pointer", pointerEvents: "auto",
      }}>
        {aboutOpen ? <CloseIcon /> : <InfoIcon />}
      </button>
      {aboutOpen && (
        <div style={{
          position: "absolute", right: 16, top: 68, width: 320, maxWidth: "calc(100vw - 32px)",
          padding: 16, borderRadius: 12, background: GLASS, color: "white", fontSize: 13,
          lineHeight: 1.55, pointerEvents: "auto", boxSizing: "border-box",
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Connectome fly</div>
          {CREDITS}
          <div style={{ marginTop: 8, opacity: 0.75 }}>{NAVIGATION_HELP}</div>
        </div>
      )}

      {showHint && (
        <div style={{
          position: "absolute", left: "50%", top: 76, transform: "translateX(-50%)",
          padding: "10px 18px", borderRadius: 999, background: "rgba(255, 255, 255, 0.9)",
          color: "#1f1f1f", fontSize: 14, fontWeight: 500, textAlign: "center",
          maxWidth: "calc(100vw - 32px)", boxSizing: "border-box",
        }}>
          Click any counter, the table, a chair or the floor to drop food.
          Scroll toward a spot to get closer, or pick a view below.
        </div>
      )}

      <div style={{
        position: "absolute", left: "50%", bottom: 24, transform: "translateX(-50%)",
        display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 4, padding: 6,
        borderRadius: 16, background: "rgba(20, 20, 22, 0.78)", pointerEvents: "auto",
        width: "max-content", maxWidth: "calc(100vw - 32px)", boxSizing: "border-box",
      }}>
        <ToolButton icon={controls.paused ? <PlayIcon /> : <PauseIcon />}
                    label={controls.paused ? "Resume" : "Pause"} active={controls.paused}
                    title="Pause or resume (Space)" onClick={controls.togglePause} />
        <ToolButton icon={<FollowIcon />} label={controls.follow ? "Following" : "Follow"}
                    active={controls.follow} title="Follow the fly (F)" onClick={controls.toggleFollow} />
        <ToolButton icon={<ResetIcon />} label="Reset fly" title="Reset the fly (R)" onClick={controls.reset} />
        <ToolButton icon={<CloseIcon />} label="Remove food" disabled={!hasFood}
                    title="Remove the food (X)" onClick={controls.removeFood} />
        <div style={{ position: "relative" }}>
          <ToolButton icon={<ViewsIcon />} label="Views" active={viewsOpen}
                      title="Jump to a part of the kitchen (1–7)" onClick={() => setViewsOpen((open) => !open)} />
          {viewsOpen && (
            <div role="menu" style={{
              position: "absolute", bottom: 54, left: "50%", transform: "translateX(-50%)",
              display: "flex", flexDirection: "column", padding: 6, borderRadius: 12, minWidth: 180,
              background: "rgba(20, 20, 22, 0.88)",
            }}>
              {VIEWS.map((view, i) => (
                <button key={view.name} role="menuitem"
                        onClick={() => { controls.goToView(i); setViewsOpen(false); }} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", height: 40,
                  padding: "0 12px", border: "none", borderRadius: 8, background: "transparent",
                  color: "white", font: "500 14px var(--font-geist-sans), sans-serif", cursor: "pointer",
                }}>
                  {view.name}
                  <span style={{ opacity: 0.6, font: "12px var(--font-geist-mono), monospace" }}>{i + 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <ToolButton icon={<GamepadIcon />} label="Game mode" title="Switch to game mode (G)"
                    onClick={controls.toggleGameMode} />
      </div>
    </>
  );
}

"""Animate a recorded odor-tracking trial as a GIF."""
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.animation import FuncAnimation, PillowWriter
from matplotlib.patches import Polygon

from flybrain.world import OdorSource

TRIAL = 0          # which brain trial to animate (0 = trial 1)
FRAME_STEP = 5     # draw every 5th simulation step (every 0.1 s)
FPS = 20           # frames per second in the GIF: 2x real speed
DT = 0.02          # seconds per simulation step, as in the tracking script
BODY = 4.0         # drawn fly size in mm (enlarged so it's visible)

data = np.load("results/odor_tracking_pn.npz")
x = data[f"brain{TRIAL}_x"]
y = data[f"brain{TRIAL}_y"]
signal = data[f"brain{TRIAL}_intensity"]
trend = data[f"brain{TRIAL}_trend"]
tumble = data[f"brain{TRIAL}_tumble"].astype(bool)
t = np.arange(len(x)) * DT

heading = np.arctan2(np.diff(y, prepend=y[0]), np.diff(x, prepend=x[0]))
heading[0] = heading[1]
source = OdorSource(x=0, y=0)


def fly_shape(cx, cy, h):
    """Corners of a triangle pointing along heading h, centered on (cx, cy)."""
    points = np.array([[BODY, 0], [-0.6 * BODY, 0.5 * BODY], [-0.6 * BODY, -0.5 * BODY]])
    rotation = np.array([[np.cos(h), -np.sin(h)], [np.sin(h), np.cos(h)]])
    return points @ rotation.T + [cx, cy]


fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

xs = np.linspace(-100, 100, 200)
X, Y = np.meshgrid(xs, xs)
ax1.imshow(source.concentration(X, Y), extent=(-100, 100, -100, 100), origin="lower", cmap="viridis")
trail, = ax1.plot([], [], color="red", linewidth=1.2)
fly = Polygon(fly_shape(x[0], y[0], heading[0]), closed=True, color="white")
ax1.add_patch(fly)
info = ax1.text(-95, 90, "", color="white", fontsize=10)
ax1.set_title("Fly guided by its antennal lobe")
ax1.set_xlabel("x (mm)")
ax1.set_ylabel("y (mm)")

signal_line, = ax2.plot([], [], label="vinegar PN signal (Hz)")
trend_line, = ax2.plot([], [], label="trend (fast − slow)")
tumble_marks, = ax2.plot([], [], "k|", markersize=12, label="tumbles")
cursor = ax2.axvline(0, color="gray", linewidth=0.8)
ax2.axhline(0, color="gray", linewidth=0.5)
ax2.set_xlim(0, t[-1])
ax2.set_ylim(min(trend.min(), 0) * 1.1, signal.max() * 1.1)
ax2.set_xlabel("time (s)")
ax2.legend(loc="upper left")
ax2.set_title("What the brain senses")


def update(frame):
    i = frame * FRAME_STEP
    trail.set_data(x[:i + 1], y[:i + 1])
    fly.set_xy(fly_shape(x[i], y[i], heading[i]))

    just_tumbled = tumble[max(0, i - FRAME_STEP + 1):i + 1].any()
    fly.set_color("orange" if just_tumbled else "white")

    distance = np.hypot(x[i] - source.x, y[i] - source.y)
    info.set_text(f"t = {t[i]:4.1f} s    distance to food = {distance:3.0f} mm")

    signal_line.set_data(t[:i + 1], signal[:i + 1])
    trend_line.set_data(t[:i + 1], trend[:i + 1])
    tumble_times = t[:i + 1][tumble[:i + 1]]
    tumble_marks.set_data(tumble_times, np.zeros_like(tumble_times))
    cursor.set_xdata([t[i], t[i]])
    return trail, fly, info, signal_line, trend_line, tumble_marks, cursor


n_frames = len(x) // FRAME_STEP
anim = FuncAnimation(fig, update, frames=n_frames, interval=1000 / FPS)
plt.tight_layout()

out = f"results/odor_tracking_trial{TRIAL + 1}.gif"
print(f"Rendering {n_frames} frames...")
anim.save(out, writer=PillowWriter(fps=FPS))
print(f"Saved {out}")
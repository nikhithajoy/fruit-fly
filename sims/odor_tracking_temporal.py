"""A fly finds vinegar by run-and-tumble, guided by its simulated brain."""
import time
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from flybrain.brain import Brain
from flybrain.world import Fly, OdorSource, orn_rate

INTENSITY_TYPES = ["DNc02", "DNg56", "DNb05", "DNc01"]

DT = 0.02                 # seconds per world step
FAST_TAU = 0.2            # seconds: fast running average of the brain signal
SLOW_TAU = 1.0            # seconds: slow running average
BASE_TUMBLE_RATE = 0.5    # tumbles per second with no smell information
TREND_GAIN = 0.1          # change in tumbles per second, per Hz of trend
MIN_RATE, MAX_RATE = 0.1, 4.0
ARENA_RADIUS = 100.0
DURATION = 20.0           # seconds per trial
N_BRAIN_TRIALS = 3
N_CONTROL_TRIALS = 20


def setup_brain():
    brain = Brain("data")
    orn_types = ["ORN_DM1", "ORN_VA2"]
    left = np.concatenate([brain.find(t, "L", "rootSide") for t in orn_types])
    right = np.concatenate([brain.find(t, "R", "rootSide") for t in orn_types])
    brain.set_input_neurons(np.concatenate([left, right]))
    readout = [brain.find(t) for t in INTENSITY_TYPES]
    return brain, len(left), readout


def run_trial(brain, n_left, readout, source, start_xy, seed, use_brain):
    rng = np.random.default_rng(seed)
    fly = Fly(x=start_xy[0], y=start_xy[1], heading=rng.uniform(0, 2 * np.pi))
    if use_brain:
        brain.reset()
        brain.rng = np.random.default_rng(seed + 1000)
        n_input = len(brain.input_neurons)

    fast = slow = 0.0
    log = {k: [] for k in ["x", "y", "intensity", "trend", "tumble"]}
    steps = int(DURATION / DT)
    t0 = time.time()

    for i in range(steps):
        trend = 0.0
        if use_brain:
            (lx, ly), (rx, ry) = fly.antenna_positions()
            rates = np.empty(n_input)
            rates[:n_left] = orn_rate(source.concentration(lx, ly))
            rates[n_left:] = orn_rate(source.concentration(rx, ry))
            counts = brain.step(DT * 1000, rates)

            intensity = sum(counts[idx].mean() for idx in readout) / DT
            fast += (intensity - fast) * DT / FAST_TAU
            slow += (intensity - slow) * DT / SLOW_TAU
            trend = fast - slow

        tumble_rate = np.clip(BASE_TUMBLE_RATE - TREND_GAIN * trend, MIN_RATE, MAX_RATE)
        tumble = rng.random() < tumble_rate * DT
        if tumble:
            fly.heading += rng.choice([-1, 1]) * rng.uniform(np.radians(45), np.radians(180))
        fly.move(0.0, DT, ARENA_RADIUS)

        for key, value in [("x", fly.x), ("y", fly.y), ("intensity", fast),
                           ("trend", trend), ("tumble", tumble)]:
            log[key].append(value)

        if use_brain and i % 100 == 0:
            d = np.hypot(fly.x - source.x, fly.y - source.y)
            print(f"    t = {i * DT:4.1f} s   distance {d:5.1f} mm   intensity {fast:5.1f}   "
                  f"trend {trend:+5.1f}   ({time.time() - t0:.0f} s elapsed)", flush=True)

    return {k: np.array(v) for k, v in log.items()}


def score(log, source):
    d = np.hypot(log["x"] - source.x, log["y"] - source.y)
    return {"mean_distance": d.mean(), "final_distance": d[-1], "time_within_25mm": (d < 25).mean()}


if __name__ == "__main__":
    brain, n_left, readout = setup_brain()
    source = OdorSource(x=0, y=0)
    start_xy = (-45.0, 0.0)

    brain_logs, control_logs = [], []
    for seed in range(N_BRAIN_TRIALS):
        print(f"Brain trial {seed + 1}/{N_BRAIN_TRIALS}")
        brain_logs.append(run_trial(brain, n_left, readout, source, start_xy, seed, use_brain=True))
    for seed in range(N_CONTROL_TRIALS):
        control_logs.append(run_trial(brain, n_left, readout, source, start_xy, seed, use_brain=False))

    for label, logs in [("with brain", brain_logs), ("without brain", control_logs)]:
        scores = [score(log, source) for log in logs]
        print(f"{label:14} ({len(logs):2} trials)  "
              f"mean distance {np.mean([s['mean_distance'] for s in scores]):5.1f} mm   "
              f"final {np.mean([s['final_distance'] for s in scores]):5.1f} mm   "
              f"time within 25 mm {100 * np.mean([s['time_within_25mm'] for s in scores]):4.1f}%")

    Path("results").mkdir(exist_ok=True)
    xs = np.linspace(-ARENA_RADIUS, ARENA_RADIUS, 200)
    X, Y = np.meshgrid(xs, xs)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
    ax1.imshow(source.concentration(X, Y), extent=(-100, 100, -100, 100), origin="lower", cmap="viridis")
    ax1.add_patch(plt.Circle((0, 0), 54, fill=False, color="white", linestyle=":", linewidth=0.8))
    for log in control_logs:
        ax1.plot(log["x"], log["y"], color="white", alpha=0.25, linewidth=0.7)
    for log in brain_logs:
        ax1.plot(log["x"], log["y"], color="red", linewidth=1.2)
    ax1.plot(*start_xy, "wo")
    ax1.set_title("Red: with brain   White: without brain   Dotted: DN threshold")

    t = np.arange(len(brain_logs[0]["trend"])) * DT
    ax2.plot(t, brain_logs[0]["intensity"], label="brain intensity signal (fast avg, Hz)")
    ax2.plot(t, brain_logs[0]["trend"], label="trend (fast − slow)")
    tumbles = t[brain_logs[0]["tumble"]]
    ax2.plot(tumbles, np.zeros_like(tumbles), "k|", markersize=10, label="tumbles")
    ax2.axhline(0, color="gray", linewidth=0.5)
    ax2.set_xlabel("time (s)")
    ax2.legend()
    ax2.set_title("Brain trial 1")
    plt.tight_layout()
    plt.savefig("results/odor_tracking_temporal.png", dpi=120)
    plt.show()
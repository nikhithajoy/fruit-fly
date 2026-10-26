"""A fly finds vinegar by run-and-tumble, guided by its antennal lobe."""
import time
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from flybrain.brain import Brain
from flybrain.world import Fly, OdorSource, orn_rate

READOUT_PREFIXES = ("DM1_", "VA2_")   # vinegar projection neurons

DT = 0.02
FAST_TAU = 0.2
SLOW_TAU = 1.0
BASE_TUMBLE_RATE = 0.5
TREND_GAIN = 0.1
MIN_RATE, MAX_RATE = 0.1, 4.0
ARENA_RADIUS = 100.0
DURATION = 20.0
START_XY = (-60.0, 0.0)
N_BRAIN_TRIALS = 5
N_CONTROL_TRIALS = 20


def setup_brain():
    brain = Brain("data")
    orn_types = ["ORN_DM1", "ORN_VA2"]
    left = np.concatenate([brain.find(t, "L", "rootSide") for t in orn_types])
    right = np.concatenate([brain.find(t, "R", "rootSide") for t in orn_types])
    brain.set_input_neurons(np.concatenate([left, right]))
    readout = np.flatnonzero(brain.neurons["type"].str.startswith(READOUT_PREFIXES, na=False).to_numpy())
    print(f"Reading {len(readout)} vinegar projection neurons")
    return brain, len(left), readout


def run_trial(brain, n_left, readout, source, seed, use_brain):
    rng = np.random.default_rng(seed)
    fly = Fly(x=START_XY[0], y=START_XY[1], heading=rng.uniform(0, 2 * np.pi))
    if use_brain:
        brain.reset()
        brain.rng = np.random.default_rng(seed + 1000)
        n_input = len(brain.input_neurons)

    fast = slow = 0.0
    log = {k: [] for k in ["x", "y", "intensity", "trend", "tumble"]}
    t0 = time.time()

    for i in range(int(DURATION / DT)):
        trend = 0.0
        if use_brain:
            (lx, ly), (rx, ry) = fly.antenna_positions()
            rates = np.empty(n_input)
            rates[:n_left] = orn_rate(source.concentration(lx, ly))
            rates[n_left:] = orn_rate(source.concentration(rx, ry))
            counts = brain.step(DT * 1000, rates)

            intensity = counts[readout].mean() / DT
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
            print(f"    t = {i * DT:4.1f} s   distance {d:5.1f} mm   PN signal {fast:6.1f} Hz   "
                  f"trend {trend:+6.1f}   ({time.time() - t0:.0f} s elapsed)", flush=True)

    return {k: np.array(v) for k, v in log.items()}


def score(log, source):
    d = np.hypot(log["x"] - source.x, log["y"] - source.y)
    return {"mean_distance": d.mean(), "final_distance": d[-1], "time_within_25mm": (d < 25).mean()}


if __name__ == "__main__":
    brain, n_left, readout = setup_brain()
    source = OdorSource(x=0, y=0)

    brain_logs = []
    for seed in range(N_BRAIN_TRIALS):
        print(f"Brain trial {seed + 1}/{N_BRAIN_TRIALS}")
        brain_logs.append(run_trial(brain, n_left, readout, source, seed, use_brain=True))
    control_logs = [run_trial(brain, n_left, readout, source, seed, use_brain=False)
                    for seed in range(N_CONTROL_TRIALS)]

    print()
    for label, logs in [("with brain", brain_logs), ("without brain", control_logs)]:
        scores = [score(log, source) for log in logs]
        print(f"{label:14} ({len(logs):2} trials)  "
              f"mean distance {np.mean([s['mean_distance'] for s in scores]):5.1f} mm   "
              f"final {np.mean([s['final_distance'] for s in scores]):5.1f} mm   "
              f"time within 25 mm {100 * np.mean([s['time_within_25mm'] for s in scores]):4.1f}%")

    Path("results").mkdir(exist_ok=True)
    np.savez("results/odor_tracking_pn.npz",
             **{f"brain{i}_{k}": v for i, log in enumerate(brain_logs) for k, v in log.items()})

    xs = np.linspace(-ARENA_RADIUS, ARENA_RADIUS, 200)
    X, Y = np.meshgrid(xs, xs)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
    ax1.imshow(source.concentration(X, Y), extent=(-100, 100, -100, 100), origin="lower", cmap="viridis")
    for log in control_logs:
        ax1.plot(log["x"], log["y"], color="white", alpha=0.25, linewidth=0.7)
    for log in brain_logs:
        ax1.plot(log["x"], log["y"], color="red", linewidth=1.2)
    ax1.plot(*START_XY, "wo")
    ax1.set_title("Red: with brain   White: without brain")

    t = np.arange(len(brain_logs[0]["trend"])) * DT
    ax2.plot(t, brain_logs[0]["intensity"], label="vinegar PN signal (fast avg, Hz)")
    ax2.plot(t, brain_logs[0]["trend"], label="trend (fast − slow)")
    tumbles = t[brain_logs[0]["tumble"]]
    ax2.plot(tumbles, np.zeros_like(tumbles), "k|", markersize=10, label="tumbles")
    ax2.axhline(0, color="gray", linewidth=0.5)
    ax2.set_xlabel("time (s)")
    ax2.legend()
    ax2.set_title("Brain trial 1")
    plt.tight_layout()
    plt.savefig("results/odor_tracking_pn.png", dpi=120)
    plt.show()
"""A fly finds vinegar using its simulated brain."""
import json
import time
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from flybrain.brain import Brain
from flybrain.world import Fly, OdorSource, orn_rate

DT = 0.02            # seconds per world step (20 ms)
SMOOTH_TAU = 0.1     # seconds: how quickly the steering readout follows the neurons
TURN_GAIN = 0.1      # radians per second of turning, per Hz of steering signal
MAX_TURN = 3.0       # radians per second: the fastest the fly can turn
ARENA_RADIUS = 100.0


def setup_brain():
    """Load the brain, connect the antennae, and prepare the steering readout."""
    brain = Brain("data")
    orn_types = ["ORN_DM1", "ORN_VA2"]
    left = np.concatenate([brain.find(t, "L", "rootSide") for t in orn_types])
    right = np.concatenate([brain.find(t, "R", "rootSide") for t in orn_types])
    brain.set_input_neurons(np.concatenate([left, right]))

    with open("data/steering.json") as f:
        steering = json.load(f)

    readout = []
    for t in steering["types"]:
        readout.append({
            "type": t,
            "L": brain.find(t, "L"),
            "R": brain.find(t, "R"),
            "direction": steering["direction"][t],
            "bias": steering["bias_hz"][t],
            "total": steering["total_hz"][t],
        })
    return brain, len(left), readout


def steering_signal(smoothed, readout):
    """Combine the steering neurons into one number: positive means turn right."""
    signal = 0.0
    for item in readout:
        rate_L, rate_R = smoothed[item["type"]]
        activity = (rate_L + rate_R) / 2
        bias_now = item["bias"] * min(activity / item["total"], 1.0)
        signal += item["direction"] * ((rate_L - rate_R) - bias_now)
    return signal


def run_trial(brain, n_left, readout, source, start, duration_s=10.0, use_brain=True):
    """Let one fly walk for duration_s seconds. Returns a log of everything."""
    brain.reset()
    fly = Fly(x=start[0], y=start[1], heading=start[2])
    smoothed = {item["type"]: [0.0, 0.0] for item in readout}
    log = {k: [] for k in ["x", "y", "heading", "orn_left", "orn_right", "signal"]}
    n_input = len(brain.input_neurons)
    steps = int(duration_s / DT)
    t0 = time.time()

    for i in range(steps):
        (lx, ly), (rx, ry) = fly.antenna_positions()
        rate_left = orn_rate(source.concentration(lx, ly))
        rate_right = orn_rate(source.concentration(rx, ry))

        signal = 0.0
        if use_brain:
            rates = np.empty(n_input)
            rates[:n_left] = rate_left
            rates[n_left:] = rate_right
            counts = brain.step(DT * 1000, rates)

            for item in readout:
                now_L = counts[item["L"]].mean() / DT
                now_R = counts[item["R"]].mean() / DT
                s = smoothed[item["type"]]
                s[0] += (now_L - s[0]) * DT / SMOOTH_TAU
                s[1] += (now_R - s[1]) * DT / SMOOTH_TAU
            signal = steering_signal(smoothed, readout)

        turn = np.clip(-TURN_GAIN * signal, -MAX_TURN, MAX_TURN)
        fly.move(turn, DT, ARENA_RADIUS)

        for key, value in [("x", fly.x), ("y", fly.y), ("heading", fly.heading),
                           ("orn_left", rate_left), ("orn_right", rate_right), ("signal", signal)]:
            log[key].append(value)

        if use_brain and i % 50 == 0:
            dist = np.hypot(fly.x - source.x, fly.y - source.y)
            print(f"  t = {i * DT:4.1f} s   distance {dist:5.1f} mm   signal {signal:6.1f}   "
                  f"({time.time() - t0:.0f} s elapsed)", flush=True)

    return {k: np.array(v) for k, v in log.items()}


if __name__ == "__main__":
    brain, n_left, readout = setup_brain()
    source = OdorSource(x=0, y=0)
    start = (-40.0, 0.0, np.radians(90))

    print("Fly with brain:")
    with_brain = run_trial(brain, n_left, readout, source, start, use_brain=True)
    print("Fly without brain:")
    without = run_trial(brain, n_left, readout, source, start, use_brain=False)

    Path("results").mkdir(exist_ok=True)
    np.savez("results/odor_tracking.npz",
             **{f"brain_{k}": v for k, v in with_brain.items()},
             **{f"control_{k}": v for k, v in without.items()})

    for label, log in [("with brain", with_brain), ("without brain", without)]:
        d = np.hypot(log["x"] - source.x, log["y"] - source.y)
        print(f"{label:14} closest approach {d.min():5.1f} mm   final distance {d[-1]:5.1f} mm")

    xs = np.linspace(-ARENA_RADIUS, ARENA_RADIUS, 200)
    X, Y = np.meshgrid(xs, xs)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    ax1.imshow(source.concentration(X, Y), extent=(-100, 100, -100, 100), origin="lower", cmap="viridis")
    ax1.plot(with_brain["x"], with_brain["y"], color="red", label="with brain")
    ax1.plot(without["x"], without["y"], color="white", linestyle="--", label="without brain")
    ax1.plot(start[0], start[1], "wo")
    ax1.legend()
    ax1.set_title("Paths")

    time_axis = np.arange(len(with_brain["signal"])) * DT
    ax2.plot(time_axis, with_brain["signal"], label="steering signal (+ = right)")
    ax2.plot(time_axis, with_brain["orn_right"] - with_brain["orn_left"],
             label="ORN right − left (Hz)")
    ax2.axhline(0, color="gray", linewidth=0.5)
    ax2.set_xlabel("time (s)")
    ax2.legend()
    ax2.set_title("What the brain sensed and decided")

    plt.tight_layout()
    plt.savefig("results/odor_tracking.png", dpi=120)
    plt.show()
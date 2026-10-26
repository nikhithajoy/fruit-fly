"""Does the brain's smell signal turn off when the smell gets weak again?"""
import matplotlib.pyplot as plt
import numpy as np

from flybrain.brain import Brain

INTENSITY_TYPES = ["DNc02", "DNg56", "DNb05", "DNc01"]
BIN_MS = 100

brain = Brain("data")
orn_types = ["ORN_DM1", "ORN_VA2"]
left = np.concatenate([brain.find(t, "L", "rootSide") for t in orn_types])
right = np.concatenate([brain.find(t, "R", "rootSide") for t in orn_types])
brain.set_input_neurons(np.concatenate([left, right]))
readout = [brain.find(t) for t in INTENSITY_TYPES]
vinegar_pns = np.flatnonzero(brain.neurons["type"].str.startswith(("DM1_", "VA2_"), na=False).to_numpy())


def run_schedule(schedule, seed=0):
    """schedule: list of (seconds, ORN rate in Hz). Returns time course of three readouts."""
    brain.reset()
    brain.rng = np.random.default_rng(seed)
    out = {"time": [], "orn": [], "intensity": [], "vinegar_pns": [], "active_neurons": []}
    t = 0.0
    for duration, rate in schedule:
        rates = np.full(len(brain.input_neurons), float(rate))
        for _ in range(int(duration * 1000 / BIN_MS)):
            counts = brain.step(BIN_MS, rates)
            r = counts / (BIN_MS / 1000)
            t += BIN_MS / 1000
            out["time"].append(t)
            out["orn"].append(rate)
            out["intensity"].append(sum(r[idx].mean() for idx in readout))
            out["vinegar_pns"].append(r[vinegar_pns].mean())
            out["active_neurons"].append(int((counts > 0).sum()))
    return {k: np.array(v) for k, v in out.items()}


trip = run_schedule([(0.5, 0), (1.0, 85), (2.0, 5), (1.5, 0)])
from_rest = run_schedule([(0.5, 0), (2.0, 5)])

weak_after = trip["intensity"][(trip["time"] > 2.5) & (trip["time"] <= 3.5)].mean()
none_after = trip["intensity"][trip["time"] > 4.0].mean()
weak_rest = from_rest["intensity"][from_rest["time"] > 1.5].mean()
print(f"Weak smell (5 Hz), starting from rest:     intensity {weak_rest:5.1f} Hz")
print(f"Weak smell (5 Hz), after a strong smell:   intensity {weak_after:5.1f} Hz")
print(f"No smell at all, after the weak smell:     intensity {none_after:5.1f} Hz")

fig, axes = plt.subplots(4, 1, figsize=(10, 8), sharex=True)
for ax, key, label in zip(axes, ["orn", "vinegar_pns", "intensity", "active_neurons"],
                          ["ORN input (Hz)", "vinegar PNs (Hz)", "DN intensity (Hz)", "neurons active per 100 ms"]):
    ax.plot(trip["time"], trip[key], label="strong → weak → none")
    ax.plot(from_rest["time"], from_rest[key], linestyle="--", label="weak only, from rest")
    ax.set_ylabel(label)
axes[0].legend()
axes[-1].set_xlabel("time (s)")
plt.tight_layout()
plt.savefig("results/hysteresis.png", dpi=120)
plt.show()
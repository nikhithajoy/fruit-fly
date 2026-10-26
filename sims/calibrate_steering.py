"""Measure how descending neurons respond to small left-right smell differences."""
import time
from pathlib import Path

import numpy as np
import pandas as pd

from flybrain.brain import Brain

LEVELS = [60, 85, 110]   # average ORN rate across both antennae (Hz)
DELTAS = [-10, 0, 10]    # right antenna minus left antenna (Hz)
SEEDS = [0, 1, 2]

brain = Brain("data")
orn_types = ["ORN_DM1", "ORN_VA2"]
left = np.concatenate([brain.find(t, "L", "rootSide") for t in orn_types])
right = np.concatenate([brain.find(t, "R", "rootSide") for t in orn_types])
brain.set_input_neurons(np.concatenate([left, right]))
n_left = len(left)

nrn = brain.neurons
dn = nrn[(nrn["superclass"] == "descending_neuron") & nrn["somaSide"].isin(["L", "R"])]
types = [t for t, group in dn.groupby("type") if set(group["somaSide"]) == {"L", "R"}]
idx_L = {t: dn.index[(dn["type"] == t) & (dn["somaSide"] == "L")].to_numpy() for t in types}
idx_R = {t: dn.index[(dn["type"] == t) & (dn["somaSide"] == "R")].to_numpy() for t in types}
print(f"Descending neuron types with both sides: {len(types)}")

rows = []
start = time.time()
for level in LEVELS:
    for delta in DELTAS:
        rates = np.empty(len(brain.input_neurons))
        rates[:n_left] = level - delta / 2
        rates[n_left:] = level + delta / 2
        for seed in SEEDS:
            brain.reset()
            brain.rng = np.random.default_rng(seed)
            total = sum(brain.step(20, rates) for _ in range(25))
            r = total / 0.5
            for t in types:
                rate_L = r[idx_L[t]].mean()
                rate_R = r[idx_R[t]].mean()
                rows.append({"type": t, "level": level, "delta": delta, "seed": seed,
                             "diff": rate_L - rate_R, "activity": (rate_L + rate_R) / 2})
        print(f"level {level}, delta {delta:+d} done ({time.time() - start:.0f} s)", flush=True)

df = pd.DataFrame(rows)
Path("results").mkdir(exist_ok=True)
df.to_csv("results/steering_calibration.csv", index=False)

mean_diff = df.groupby(["type", "level", "delta"])["diff"].mean().unstack("delta")
noise = df[df["delta"] == 0].groupby(["type", "level"])["diff"].std()
activity = df.groupby(["type", "level"])["activity"].mean()

summary = pd.DataFrame({
    "bias": mean_diff[0],
    "sensitivity": (mean_diff[DELTAS[-1]] - mean_diff[DELTAS[0]]) / (DELTAS[-1] - DELTAS[0]),
    "noise": noise,
    "activity": activity,
})
summary["snr"] = (summary["sensitivity"] * 10).abs() / summary["noise"].replace(0, np.nan)

pd.set_option("display.width", 120)
print("\nBest steering candidates at level 85 Hz:")
print(summary.xs(85, level="level").sort_values("snr", ascending=False).head(12).round(2))

print("\nOur previous five types:")
old = ["DNpe002", "DNp56", "DNbe007", "DNg56", "DNc02"]
print(summary.loc[old].round(2))
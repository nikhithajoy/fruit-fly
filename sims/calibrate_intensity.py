"""Measure how descending neurons respond to overall smell strength."""
import time
from pathlib import Path

import numpy as np
import pandas as pd

from flybrain.brain import Brain

LEVELS = [0, 10, 20, 40, 60, 85, 110, 150]   # ORN rate on both antennae (Hz)
SEEDS = [0, 1, 2]

brain = Brain("data")
orn_types = ["ORN_DM1", "ORN_VA2"]
left = np.concatenate([brain.find(t, "L", "rootSide") for t in orn_types])
right = np.concatenate([brain.find(t, "R", "rootSide") for t in orn_types])
brain.set_input_neurons(np.concatenate([left, right]))

nrn = brain.neurons
dn_types = sorted(nrn.loc[nrn["superclass"] == "descending_neuron", "type"].dropna().unique())
dn_idx = {t: np.flatnonzero((nrn["type"] == t).to_numpy()) for t in dn_types}
all_dn = np.flatnonzero((nrn["superclass"] == "descending_neuron").to_numpy())
vinegar_pns = np.flatnonzero(nrn["type"].str.startswith(("DM1_", "VA2_"), na=False).to_numpy())

rows = []
start = time.time()
for level in LEVELS:
    rates = np.full(len(brain.input_neurons), float(level))
    for seed in SEEDS:
        brain.reset()
        brain.rng = np.random.default_rng(seed)
        total = sum(brain.step(20, rates) for _ in range(25))
        r = total / 0.5
        for t in dn_types:
            rows.append({"type": t, "level": level, "seed": seed, "activity": r[dn_idx[t]].mean()})
        rows.append({"type": "ALL_DNs", "level": level, "seed": seed, "activity": r[all_dn].mean()})
        rows.append({"type": "vinegar_PNs", "level": level, "seed": seed, "activity": r[vinegar_pns].mean()})
    print(f"level {level} done ({time.time() - start:.0f} s)", flush=True)

df = pd.DataFrame(rows)
Path("results").mkdir(exist_ok=True)
df.to_csv("results/intensity_calibration.csv", index=False)

curve = df.groupby(["type", "level"])["activity"].mean().unstack("level")
noise = df.groupby(["type", "level"])["activity"].std().groupby("type").mean()
steps = curve.diff(axis=1).iloc[:, 1:]

summary = curve.round(1)
summary["rising_steps"] = (steps > 0).sum(axis=1)
summary["score"] = ((curve[LEVELS[-1]] - curve[LEVELS[0]]) / noise.replace(0, np.nan)).round(1)

pd.set_option("display.width", 160)
print("\nReference readouts:")
print(summary.loc[["vinegar_PNs", "ALL_DNs"]])
print("\nDescending neuron types that best track smell strength:")
print(summary.drop(["vinegar_PNs", "ALL_DNs"]).sort_values("score", ascending=False).head(10))
"""Find the circuit that keeps firing after the smell is gone."""
import numpy as np
import pandas as pd
import scipy.sparse as sp

from flybrain.brain import Brain

brain = Brain("data")
orn_types = ["ORN_DM1", "ORN_VA2"]
left = np.concatenate([brain.find(t, "L", "rootSide") for t in orn_types])
right = np.concatenate([brain.find(t, "R", "rootSide") for t in orn_types])
brain.set_input_neurons(np.concatenate([left, right]))
n_input = len(brain.input_neurons)

brain.rng = np.random.default_rng(0)
for _ in range(50):
    brain.step(20, np.full(n_input, 85.0))
for _ in range(25):
    brain.step(20, np.zeros(n_input))
late_counts = sum(brain.step(20, np.zeros(n_input)) for _ in range(75))

late = late_counts > 0
late_idx = np.flatnonzero(late)
nrn = brain.neurons
print(f"Neurons still firing 0.5–2 s after the smell stopped: {len(late_idx):,}\n")
print(nrn.loc[late, "superclass"].value_counts().head(8), "\n")
print(nrn.loc[late, "type"].value_counts().head(15), "\n")

W = sp.load_npz("data/W_calibrated.npz")
sub = W[late][:, late].tocoo()
types = nrn["type"].fillna("?").to_numpy()
pairs = pd.DataFrame({
    "pre": types[late_idx[sub.row]],
    "post": types[late_idx[sub.col]],
    "synapses": sub.data,
})
pairs = pairs[pairs["synapses"] > 0]
strength = pairs.groupby(["pre", "post"])["synapses"].sum()

loops = []
for (a, b), s_ab in strength.items():
    if a > b:
        continue
    s_ba = strength.get((b, a), 0.0)
    if a == b or s_ba > 0:
        loops.append({"type A": a, "type B": b, "A→B": s_ab, "B→A": s_ab if a == b else s_ba,
                      "loop strength": s_ab if a == b else min(s_ab, s_ba)})

loops = pd.DataFrame(loops).sort_values("loop strength", ascending=False)
print("Strongest excitatory loops among the still-firing neurons:")
print(loops.head(20).round(1).to_string(index=False))
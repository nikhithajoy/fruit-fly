"""Check the Brain class reproduces the notebook's vinegar experiment."""
import time

import numpy as np

from flybrain.brain import Brain

brain = Brain("data")
print(f"Loaded brain: {brain.n:,} neurons")

left_orns = np.concatenate([brain.find("ORN_DM1", "L", "rootSide"),
                            brain.find("ORN_VA2", "L", "rootSide")])
brain.set_input_neurons(left_orns)

vinegar_pns = np.flatnonzero(brain.neurons["type"].str.startswith(("DM1_", "VA2_"), na=False).to_numpy())
rates = np.full(len(left_orns), 150.0)

start = time.time()
total = np.zeros(brain.n)
for _ in range(25):
    total += brain.step(20, rates)
elapsed = time.time() - start

r = total / 0.5
print(f"500 ms of brain time took {elapsed:.1f} s")
print(f"Vinegar PNs: {r[vinegar_pns].mean():.1f} Hz   (notebook: about 88 Hz)")
print(f"Neurons > 10 Hz: {(r > 10).sum() - len(left_orns)}   (notebook: about 1,688)")
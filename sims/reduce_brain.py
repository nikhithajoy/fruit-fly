"""Find the neurons vinegar can ever activate, build a reduced brain, and validate it."""
import time

import numpy as np

from flybrain.brain import Brain

STEP_MS = 20
MAX_RATE = 150.0

full = Brain("data")
orn_types = ["ORN_DM1", "ORN_VA2"]
left = np.concatenate([full.find(t, "L", "rootSide") for t in orn_types])
right = np.concatenate([full.find(t, "R", "rootSide") for t in orn_types])
inputs = np.concatenate([left, right])
full.set_input_neurons(inputs)
n_left = len(left)
pns = np.flatnonzero(full.neurons["type"].str.startswith(("DM1_", "VA2_"), na=False).to_numpy())


def constant(rate_left, rate_right, seconds):
    return [(rate_left, rate_right)] * int(seconds * 1000 / STEP_MS)


def wandering(seconds, seed):
    """Smoothly fluctuating smell on each antenna, like a fly walking around."""
    rng = np.random.default_rng(seed)
    r = rng.uniform(0, MAX_RATE, 2)
    schedule = []
    for _ in range(int(seconds * 1000 / STEP_MS)):
        r = np.clip(r + rng.normal(0, 8, 2), 0, MAX_RATE)
        schedule.append((r[0], r[1]))
    return schedule


def run(brain, schedule, seed, pn_idx):
    """Run a schedule. Returns which neurons fired, and the PN signal per step."""
    brain.reset()
    brain.rng = np.random.default_rng(seed)
    fired = np.zeros(brain.n, dtype=bool)
    pn_signal = []
    rates = np.empty(len(brain.input_neurons))
    for rate_left, rate_right in schedule:
        rates[:n_left] = rate_left
        rates[n_left:] = rate_right
        counts = brain.step(STEP_MS, rates)
        fired |= counts > 0
        pn_signal.append(counts[pn_idx].mean() / (STEP_MS / 1000))
    return fired, np.array(pn_signal)


# Part 1: explore
conditions = (
    [constant(r, r, 2) for r in [10, 40, 85, 150]]
    + [constant(a, b, 1) for a, b in [(150, 0), (0, 150), (150, 60), (60, 150)]]
    + [wandering(5, seed) for seed in [1, 2, 3]]
)
ever_fired = np.zeros(full.n, dtype=bool)
start = time.time()
for k, schedule in enumerate(conditions):
    fired, _ = run(full, schedule, seed=k, pn_idx=pns)
    ever_fired |= fired
    print(f"condition {k + 1}/{len(conditions)}: {ever_fired.sum():,} neurons have fired so far "
          f"({time.time() - start:.0f} s)", flush=True)

active = np.flatnonzero(ever_fired)
print(f"\nActive set: {len(active):,} of {full.n:,} neurons")
print(full.neurons.loc[active, "superclass"].value_counts().head(8))

# Part 2: build
small = full.subset(active)
small.set_input_neurons(np.searchsorted(active, inputs))
small_pns = np.searchsorted(active, pns)

# Part 3: validate on a smell the exploration never saw
test = wandering(5, seed=99)
t0 = time.time()
full_fired, full_signal = run(full, test, seed=99, pn_idx=pns)
full_time = time.time() - t0
t0 = time.time()
_, small_signal = run(small, test, seed=99, pn_idx=small_pns)
small_time = time.time() - t0

outside = full_fired & ~ever_fired
smooth = lambda s: s.reshape(-1, 5).mean(axis=1)
correlation = np.corrcoef(smooth(full_signal), smooth(small_signal))[0, 1]
print(f"\nNeurons that fired outside the active set during the test: {outside.sum()}")
print(f"PN signal: full mean {full_signal.mean():.1f} Hz, reduced mean {small_signal.mean():.1f} Hz, "
      f"correlation {correlation:.4f}, identical: {np.array_equal(full_signal, small_signal)}")
print(f"5 s of brain time: full {full_time:.1f} s, reduced {small_time:.1f} s")

np.save("data/active_neurons.npy", active)
print("Saved data/active_neurons.npy")
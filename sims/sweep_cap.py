"""Rebuild the calibrated brain with different excitation caps and test each one."""
import json
import shutil

import numpy as np
import pandas as pd
import scipy.sparse as sp

from flybrain.brain import Brain
from flybrain.calibrate import build_calibrated

SAVE_PERCENTILE = "no"   # after the sweep, set to the chosen value (a number, or None for no cap)
PERCENTILES = [95, 97, 99, None]
INTENSITY_TYPES = ["DNc02", "DNg56", "DNb05", "DNc01"]

brain = Brain("data")
nrn = brain.neurons
W_raw = sp.load_npz("data/W.npz")
scale = brain.w_syn * brain.calibration["weight_scale"]

orn_types = ["ORN_DM1", "ORN_VA2"]
left = np.concatenate([brain.find(t, "L", "rootSide") for t in orn_types])
right = np.concatenate([brain.find(t, "R", "rootSide") for t in orn_types])
brain.set_input_neurons(np.concatenate([left, right]))
n_input = len(brain.input_neurons)
readout = [brain.find(t) for t in INTENSITY_TYPES]
is_pn = (nrn["class"] == "ALPN").to_numpy()
is_vinegar_pn = nrn["type"].str.startswith(("DM1_", "VA2_"), na=False).to_numpy()
is_other_pn = is_pn & ~is_vinegar_pn
is_dn = (nrn["superclass"] == "descending_neuron").to_numpy()


def switch_off_test(rate):
    brain.reset()
    brain.rng = np.random.default_rng(0)
    on = sum(brain.step(20, np.full(n_input, float(rate))) for _ in range(50)) / 1.0
    for _ in range(25):
        brain.step(20, np.zeros(n_input))
    late = sum(brain.step(20, np.zeros(n_input)) for _ in range(75))
    return {
        "ORN rate": rate,
        "vinegar PNs": on[is_vinegar_pn].mean(),
        "other PNs": on[is_other_pn].mean(),
        "DN intensity": sum(on[idx].mean() for idx in readout),
        "any DNs >10 Hz": int((on[is_dn] > 10).sum()),
        "neurons active": int((on > 0).sum()) - n_input,
        "still firing after": int((late > 0).sum()),
    }


rows = []
built = {}
for pct in PERCENTILES:
    W_test, cap = build_calibrated(W_raw, nrn, cap_percentile=pct)
    built[pct] = (W_test, cap)
    brain.W = (W_test * scale).astype(np.float32).tocsr()
    for rate in [85, 150]:
        rows.append({"cap percentile": "none" if pct is None else pct, **switch_off_test(rate)})
    print(f"cap {pct} done", flush=True)

pd.set_option("display.width", 160)
print(pd.DataFrame(rows).round(1).to_string(index=False))

if SAVE_PERCENTILE != "no":
    W_final, cap = built[SAVE_PERCENTILE]
    shutil.copy("data/W_calibrated.npz", "data/W_calibrated_previous.npz")
    sp.save_npz("data/W_calibrated.npz", W_final)
    with open("data/calibration.json") as f:
        calibration = json.load(f)
    calibration["excitation_cap_percentile"] = SAVE_PERCENTILE
    calibration["excitation_cap_synapses"] = None if cap is None else float(cap)
    calibration["built_by"] = "flybrain.calibrate.build_calibrated"
    calibration["changes"] = [
        "histamine treated as inhibitory",
        "dopamine, octopamine, serotonin outputs removed (slow modulators)",
        "Kenyon cell to Kenyon cell connections removed",
        "brain input onto sensory neurons removed",
        "excitatory ALLN to ALLN connections removed",
        "excitatory ALLN to ALPN connections removed (eLN to PN excitation is mainly electrical)",
        "excitatory ALPN to ALPN connections removed (mostly dendro-dendritic)",
    ] + ([] if SAVE_PERCENTILE is None else
         [f"each neuron's total excitatory input capped at the {SAVE_PERCENTILE}th percentile"])
    with open("data/calibration.json", "w") as f:
        json.dump(calibration, f, indent=2)
    print(f"Saved cap {SAVE_PERCENTILE}. Previous matrix kept as data/W_calibrated_previous.npz")
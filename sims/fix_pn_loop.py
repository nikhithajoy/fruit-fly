"""Remove the projection-neuron loop and test whether the brain now switches off."""
import json
import shutil

import numpy as np
import pandas as pd
import scipy.sparse as sp

from flybrain.brain import Brain

SAVE = True
INTENSITY_TYPES = ["DNc02", "DNg56", "DNb05", "DNc01"]

brain = Brain("data")
nrn = brain.neurons
is_alln = (nrn["class"] == "ALLN").to_numpy()
is_pn = (nrn["class"] == "ALPN").to_numpy()
print(f"Antennal lobe local neurons: {is_alln.sum()}, projection neurons: {is_pn.sum()}")

W = sp.load_npz("data/W_calibrated.npz")
coo = W.tocoo()
excitatory = coo.data > 0
drop_ln_pn = excitatory & is_alln[coo.row] & is_pn[coo.col]
drop_pn_pn = excitatory & is_pn[coo.row] & is_pn[coo.col]
drop = drop_ln_pn | drop_pn_pn
print(f"Removing {drop_ln_pn.sum():,} local neuron → PN and {drop_pn_pn.sum():,} PN → PN "
      f"excitatory connections ({coo.data[drop].sum():,.0f} synapses)")
W_new = sp.csr_matrix((coo.data[~drop], (coo.row[~drop], coo.col[~drop])), shape=W.shape)

scale = brain.w_syn * brain.calibration["weight_scale"]
brain.W = (W_new * scale).astype(np.float32).tocsr()

orn_types = ["ORN_DM1", "ORN_VA2"]
left = np.concatenate([brain.find(t, "L", "rootSide") for t in orn_types])
right = np.concatenate([brain.find(t, "R", "rootSide") for t in orn_types])
brain.set_input_neurons(np.concatenate([left, right]))
n_input = len(brain.input_neurons)
readout = [brain.find(t) for t in INTENSITY_TYPES]
is_vinegar_pn = nrn["type"].str.startswith(("DM1_", "VA2_"), na=False).to_numpy()
is_other_pn = is_pn & ~is_vinegar_pn


def switch_off_test(rate):
    """1 s of smell, then 2 s of nothing. Measures the response and what keeps firing."""
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
        "still firing after": int((late > 0).sum()),
    }


results = pd.DataFrame([switch_off_test(rate) for rate in [40, 85, 150]])
print(results.round(1).to_string(index=False))

if SAVE:
    shutil.copy("data/W_calibrated.npz", "data/W_calibrated_before_pn_fix.npz")
    sp.save_npz("data/W_calibrated.npz", W_new)
    with open("data/calibration.json") as f:
        calibration = json.load(f)
    calibration["changes"] += [
        "excitatory ALLN to ALPN connections removed (eLN to PN excitation is mainly electrical)",
        "excitatory ALPN to ALPN connections removed (mostly dendro-dendritic)",
    ]
    with open("data/calibration.json", "w") as f:
        json.dump(calibration, f, indent=2)
    print("Saved. Previous matrix kept as data/W_calibrated_before_pn_fix.npz")
"""Export the reduced vinegar circuit as JSON for the web app."""
import json
from pathlib import Path

import numpy as np

from flybrain.brain import Brain

full = Brain("data")
active = np.load("data/active_neurons.npy")
small = full.subset(active)

orn_types = ["ORN_DM1", "ORN_VA2"]
left_full = np.concatenate([full.find(t, "L", "rootSide") for t in orn_types])
right_full = np.concatenate([full.find(t, "R", "rootSide") for t in orn_types])
pns_full = np.flatnonzero(full.neurons["type"].str.startswith(("DM1_", "VA2_"), na=False).to_numpy())
assert np.isin(np.concatenate([left_full, right_full, pns_full]), active).all()

left = np.searchsorted(active, left_full)
right = np.searchsorted(active, right_full)
pns = np.searchsorted(active, pns_full)
small.set_input_neurons(np.concatenate([left, right]))

print("Most common cell types in the circuit:")
print(small.neurons["type"].value_counts().head(15), "\n")

expected = []
for rate in [10, 40, 85, 150]:
    pn_rates = []
    for seed in range(5):
        small.reset()
        small.rng = np.random.default_rng(seed)
        rates = np.full(len(small.input_neurons), float(rate))
        counts = sum(small.step(20, rates) for _ in range(100))
        pn_rates.append(counts[pns].mean() / 2.0)
    expected.append({"orn_rate": rate,
                     "pn_rate": float(np.mean(pn_rates)),
                     "pn_rate_sd": float(np.std(pn_rates))})
    print(f"ORN {rate:3d} Hz → vinegar PNs {np.mean(pn_rates):6.1f} ± {np.std(pn_rates):.1f} Hz")

W = small.W
circuit = {
    "description": "Vinegar circuit extracted from the calibrated MaleCNS v1.0 connectome",
    "credit": ("MaleCNS v1.0 (Berg et al., Cell 2026; HHMI Janelia, Cambridge, MRC LMB, Google Research), "
               "CC-BY 4.0. LIF model parameters from Shiu et al., Nature 2024."),
    "calibration": small.calibration,
    "params": {
        "dt": small.dt, "v_rest": small.v_rest, "v_reset": small.v_reset, "v_th": small.v_th,
        "tau_m": small.tau_m, "tau_syn": small.tau_syn, "t_ref": small.t_ref,
        "delay": small.delay, "input_kick": small.input_kick,
    },
    "n": int(small.n),
    "csr": {
        "indptr": W.indptr.tolist(),
        "indices": W.indices.tolist(),
        "weights_mv": np.round(W.data.astype(float), 5).tolist(),
    },
    "inputs": {"left_orns": left.tolist(), "right_orns": right.tolist()},
    "readouts": {"vinegar_pns": pns.tolist()},
    "neurons": {
        "body_id": small.neurons["bodyId"].astype(int).tolist(),
        "type": small.neurons["type"].fillna("").tolist(),
        "superclass": small.neurons["superclass"].fillna("").tolist(),
    },
    "validation": expected,
}

out = Path("exports/vinegar_circuit.json")
out.parent.mkdir(exist_ok=True)
with open(out, "w") as f:
    json.dump(circuit, f)
print(f"\nSaved {out}: {W.nnz:,} connections, {out.stat().st_size / 1e6:.2f} MB")
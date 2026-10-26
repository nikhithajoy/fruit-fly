"""Turn the raw MaleCNS connectome into a stable, simulation-ready matrix.

Every rule here addresses a known limitation of point-neuron models
or of the connectome data. See calibration.json for the record.
"""
import numpy as np
import scipy.sparse as sp

MODULATORS = ["dopamine", "octopamine", "serotonin"]


def apply_rules(W, neurons):
    """Remove connections the point-neuron model can't represent faithfully."""
    is_modulator = neurons["consensus_nt"].isin(MODULATORS).to_numpy()
    is_kc = neurons["type"].str.startswith("KC", na=False).to_numpy()
    is_sensory = neurons["superclass"].str.contains("sensory", na=False).to_numpy()
    is_alln = (neurons["class"] == "ALLN").to_numpy()
    is_pn = (neurons["class"] == "ALPN").to_numpy()

    coo = W.tocoo()
    pre, post = coo.row, coo.col
    excitatory = coo.data > 0
    drop = (
        is_modulator[pre]                                  # slow modulators: no fast effect
        | (is_kc[pre] & is_kc[post])                       # Kenyon cell axo-axonal synapses
        | is_sensory[post]                                 # brain input onto sensory terminals
        | (excitatory & is_alln[pre] & is_alln[post])      # local neuron ↔ local neuron excitation
        | (excitatory & is_alln[pre] & is_pn[post])        # eLN → PN is mainly electrical
        | (excitatory & is_pn[pre] & is_pn[post])          # PN ↔ PN, mostly dendro-dendritic
    )
    return sp.csr_matrix((coo.data[~drop], (pre[~drop], post[~drop])), shape=W.shape)


def cap_excitation(W, percentile=95):
    """Scale down each neuron's excitatory input so its total is at most the given percentile."""
    Wc = W.tocsc(copy=True)
    pos = Wc.copy()
    pos.data = np.clip(pos.data, 0, None)
    exc_in = np.asarray(pos.sum(axis=0)).ravel()

    cap = np.percentile(exc_in[exc_in > 0], percentile)
    factor = np.minimum(1.0, cap / np.maximum(exc_in, 1))

    column_of_entry = np.repeat(np.arange(W.shape[1]), np.diff(Wc.indptr))
    Wc.data = np.where(Wc.data > 0, Wc.data * factor[column_of_entry], Wc.data)
    return Wc.tocsr(), cap


def build_calibrated(W, neurons, cap_percentile=None):
    """Apply all rules, then optionally cap excitation."""
    W_rules = apply_rules(W, neurons)
    if cap_percentile is None:
        return W_rules, None
    return cap_excitation(W_rules, cap_percentile)
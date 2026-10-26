"""A steppable simulation of the calibrated MaleCNS fly brain.

Leaky integrate-and-fire model with the parameters of Shiu et al., Nature 2024.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.sparse as sp


class Brain:
    # Model parameters (mV, ms)
    dt = 0.1
    v_rest = -52.0
    v_reset = -52.0
    v_th = -45.0
    tau_m = 20.0
    tau_syn = 5.0
    t_ref = 2.2
    delay = 1.8
    w_syn = 0.275
    input_kick = 250 * 0.275

    def __init__(self, data_dir="data", seed=0):
        data_dir = Path(data_dir)
        self.neurons = pd.read_parquet(data_dir / "neurons.parquet")
        with open(data_dir / "calibration.json") as f:
            self.calibration = json.load(f)

        W = sp.load_npz(data_dir / "W_calibrated.npz")
        scale = self.w_syn * self.calibration["weight_scale"]
        self.W = (W * scale).astype(np.float32).tocsr()
        self.n = self.W.shape[0]

        self.rng = np.random.default_rng(seed)
        self.delay_steps = int(round(self.delay / self.dt))
        self.ref_steps = int(round(self.t_ref / self.dt))
        self.input_neurons = np.array([], dtype=np.int64)
        self.reset()

    def reset(self):
        """Return every neuron to rest, as if the brain had just been switched on."""
        self.v = np.full(self.n, self.v_rest, dtype=np.float32)
        self.g = np.zeros(self.n, dtype=np.float32)
        self.ref = np.zeros(self.n, dtype=np.int32)
        self.buffer = np.zeros((self.delay_steps, self.n), dtype=np.float32)
        self.t = 0
        self.gets_refractory = np.ones(self.n, dtype=bool)
        self.gets_refractory[self.input_neurons] = False

    def set_input_neurons(self, idx):
        """Choose which neurons receive external input (e.g. ORNs)."""
        self.input_neurons = np.asarray(idx, dtype=np.int64)
        self.gets_refractory[:] = True
        self.gets_refractory[self.input_neurons] = False

    def find(self, cell_type, side=None, side_column="somaSide"):
        """Positions of all neurons of a cell type, optionally on one side."""
        mask = self.neurons["type"] == cell_type
        if side is not None:
            mask &= self.neurons[side_column] == side
        return np.flatnonzero(mask.to_numpy())

    def step(self, duration_ms, input_rates=None):
        """Run the brain forward and return each neuron's spike count.

        input_rates: one firing rate (Hz) per input neuron, in the same
        order as set_input_neurons.
        """
        steps = int(round(duration_ms / self.dt))
        counts = np.zeros(self.n, dtype=np.int32)
        if input_rates is None:
            input_rates = np.zeros(len(self.input_neurons))
        p_input = np.asarray(input_rates, dtype=np.float64) * self.dt / 1000

        for _ in range(steps):
            slot = self.t % self.delay_steps
            self.g += self.buffer[slot]
            self.buffer[slot] = 0

            if len(self.input_neurons):
                hits = self.input_neurons[self.rng.random(len(self.input_neurons)) < p_input]
                self.v[hits] += self.input_kick

            awake = self.ref == 0
            self.v[awake] += self.dt * (self.v_rest - self.v[awake] + self.g[awake]) / self.tau_m
            self.g[awake] -= self.dt * self.g[awake] / self.tau_syn
            self.ref[~awake] -= 1

            fired = np.flatnonzero((self.v > self.v_th) & awake)
            self.v[fired] = self.v_reset
            self.g[fired] = 0
            self.ref[fired[self.gets_refractory[fired]]] = self.ref_steps
            counts[fired] += 1

            if len(fired):
                self.buffer[slot] += np.asarray(self.W[fired].sum(axis=0)).ravel()
            self.t += 1

        return counts
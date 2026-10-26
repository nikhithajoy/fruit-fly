// A TypeScript port of flybrain/brain.py, running the exported vinegar circuit.

export type Circuit = {
  n: number;
  params: {
    dt: number; v_rest: number; v_reset: number; v_th: number;
    tau_m: number; tau_syn: number; t_ref: number; delay: number; input_kick: number;
  };
  csr: { indptr: number[]; indices: number[]; weights_mv: number[] };
  inputs: { left_orns: number[]; right_orns: number[] };
  readouts: { vinegar_pns: number[] };
  neurons: { body_id: number[]; type: string[]; superclass: string[] };
  validation: { orn_rate: number; pn_rate: number; pn_rate_sd: number }[];
};

// Small, fast, seedable random number generator (mulberry32).
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Brain {
  readonly n: number;
  private p: Circuit["params"];
  private indptr: Int32Array;
  private indices: Int32Array;
  private weights: Float32Array;
  private delaySteps: number;
  private refSteps: number;

  private v: Float32Array;
  private g: Float32Array;
  private ref: Int32Array;
  private buffer: Float32Array;
  private t = 0;

  private inputs = new Int32Array(0);
  private getsRefractory: Uint8Array;
  private random: () => number;

  constructor(circuit: Circuit, seed = 0) {
    this.n = circuit.n;
    this.p = circuit.params;
    this.indptr = Int32Array.from(circuit.csr.indptr);
    this.indices = Int32Array.from(circuit.csr.indices);
    this.weights = Float32Array.from(circuit.csr.weights_mv);
    this.delaySteps = Math.round(this.p.delay / this.p.dt);
    this.refSteps = Math.round(this.p.t_ref / this.p.dt);

    this.v = new Float32Array(this.n);
    this.g = new Float32Array(this.n);
    this.ref = new Int32Array(this.n);
    this.buffer = new Float32Array(this.delaySteps * this.n);
    this.getsRefractory = new Uint8Array(this.n).fill(1);
    this.random = makeRandom(seed);
    this.reset(seed);
  }

  reset(seed?: number) {
    this.v.fill(this.p.v_rest);
    this.g.fill(0);
    this.ref.fill(0);
    this.buffer.fill(0);
    this.t = 0;
    if (seed !== undefined) this.random = makeRandom(seed);
  }

  setInputs(idx: number[]) {
    this.inputs = Int32Array.from(idx);
    this.getsRefractory.fill(1);
    for (const i of this.inputs) this.getsRefractory[i] = 0;
  }

  // Run for durationMs. inputRates holds one rate (Hz) per input neuron.
  // Returns each neuron's spike count during this window.
  step(durationMs: number, inputRates: ArrayLike<number>): Int32Array {
    const { dt, v_rest, v_reset, v_th, tau_m, tau_syn, input_kick } = this.p;
    const { n, v, g, ref, buffer, indptr, indices, weights, inputs } = this;
    const steps = Math.round(durationMs / dt);
    const counts = new Int32Array(n);

    for (let s = 0; s < steps; s++) {
      const offset = (this.t % this.delaySteps) * n;

      for (let i = 0; i < n; i++) {
        g[i] += buffer[offset + i];
        buffer[offset + i] = 0;
      }

      for (let k = 0; k < inputs.length; k++) {
        if (this.random() < (inputRates[k] * dt) / 1000) v[inputs[k]] += input_kick;
      }

      for (let i = 0; i < n; i++) {
        if (ref[i] > 0) {
          ref[i]--;
          continue;
        }
        v[i] += (dt * (v_rest - v[i] + g[i])) / tau_m;
        g[i] -= (dt * g[i]) / tau_syn;

        if (v[i] > v_th) {
          v[i] = v_reset;
          g[i] = 0;
          if (this.getsRefractory[i]) ref[i] = this.refSteps;
          counts[i]++;
          for (let e = indptr[i]; e < indptr[i + 1]; e++) {
            buffer[offset + indices[e]] += weights[e];
          }
        }
      }
      this.t++;
    }
    return counts;
  }
}
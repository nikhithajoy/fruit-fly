"use client";

import { useState } from "react";
import { Brain, type Circuit } from "@/lib/brain";

type Row = { orn_rate: number; pn_rate: number; pn_rate_sd: number; js: number };

export default function ValidatePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("Not run yet");

  async function run() {
    setStatus("Running...");
    const circuit: Circuit = await (await fetch("/brain/vinegar_circuit.json")).json();
    const brain = new Brain(circuit);
    const inputs = [...circuit.inputs.left_orns, ...circuit.inputs.right_orns];
    brain.setInputs(inputs);
    const pns = circuit.readouts.vinegar_pns;

    const start = performance.now();
    const results: Row[] = [];
    for (const ref of circuit.validation) {
      const rates = new Float32Array(inputs.length).fill(ref.orn_rate);
      let sum = 0;
      for (let seed = 0; seed < 5; seed++) {
        brain.reset(seed);
        let pnSpikes = 0;
        for (let k = 0; k < 100; k++) {
          const counts = brain.step(20, rates);
          for (const p of pns) pnSpikes += counts[p];
        }
        sum += pnSpikes / pns.length / 2.0;
      }
      results.push({ ...ref, js: sum / 5 });
    }
    const seconds = (performance.now() - start) / 1000;
    setRows(results);
    setStatus(`Done: 40 s of brain time in ${seconds.toFixed(2)} s`);
  }

  return (
    <main style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>Brain engine validation</h1>
      <style>{`th, td { padding: 8px 16px; text-align: left; }`}</style>
      <button
        onClick={run}
        style={{ padding: "8px 16px", margin: "16px 0", border: "1px solid #888",
                 borderRadius: 6, cursor: "pointer" }}
      >
        Run
      </button>
      <p>{status}</p>
      <table cellPadding={8}>
        <thead>
          <tr><th>ORN rate</th><th>Python PN rate</th><th>TypeScript PN rate</th><th>Difference</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.orn_rate}>
              <td>{r.orn_rate} Hz</td>
              <td>{r.pn_rate.toFixed(1)} ± {r.pn_rate_sd.toFixed(1)}</td>
              <td>{r.js.toFixed(1)}</td>
              <td>{(r.js - r.pn_rate).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
// Sensitivity of the v5 design to the generator assumptions. Each row changes one assumption.
import { evaluateMany, scenarioFor, TARGET } from './montecarlo.mjs';
import { VERSIONS } from './detect.mjs';
import { rng } from './rng.mjs';
import { writeFileSync } from 'node:fs';

const N = Number(process.env.N || 150);
const DESIGN = process.env.DESIGN || 'v6';
const base = VERSIONS[DESIGN];
const row = (r) => ({
  h1Detect: r.h1DetectionRate, h1LeadMedianD: r.h1LeadDaysMedian, h1Lead7: r.h1LeadAtLeast7d,
  h0Detect: r.h0ClusterDetectionRate, falseAlarmsPerStationYear: r.falseAlarmsPerStationYear,
  h1CorrectMech: r.classification?.h1CorrectlyMechanical ?? null, h0CorrectNonMech: r.classification?.h0CorrectlyNonMechanical ?? null,
});
const out = {};

// S1: size of the chronic cluster (rate multiplier at ZS-202)
out.chronicMultiplier = [];
for (const mult of [1.3, 1.5, 1.8, 2, 3, 4]) {
  const scen = (kind, seed) => (kind === 'H0' ? { feed: { station: TARGET, mult, night: 1.3 } } : scenarioFor(kind, seed));
  const [r] = evaluateMany([base], { N, seedBase: 7000, scen });
  out.chronicMultiplier.push({ mult, ...row(r) });
}
// S2: speed of bearing degradation (growth per day of vibration)
out.degradationSpeed = [];
for (const g of [0.03, 0.045, 0.06, 0.09, 0.12]) {
  const scen = (kind, seed) => (kind === 'H1' ? { mech: { station: TARGET, g, gamma: 1.4, v0: 1.0 } } : scenarioFor(kind, seed));
  const [r] = evaluateMany([base], { N, seedBase: 7000, scen });
  out.degradationSpeed.push({ g, failureDay: Math.log(4.5) / g, ...row(r) });
}
// S3: day-to-day overdispersion of the count process
out.overdispersion = [];
for (const sigmaDay of [0.1, 0.2, 0.3, 0.4]) {
  const [r] = evaluateMany([base], { N, seedBase: 7000, sigmaDay });
  out.overdispersion.push({ sigmaDay, ...row(r) });
}
// S4: spot check noise and a load-driven vibration step in the non-mechanical case
out.classificationStress = [];
for (const noise of [0.1, 0.2, 0.3]) {
  for (const hard of [false, true]) {
    const scen = (kind, seed) => {
      if (kind === 'H0' && hard) {
        const R = rng(seed * 17 + 3);
        return { feed: { station: TARGET, mult: R.uniform(2, 4), night: 1.3, vibStep: R.uniform(1.2, 1.9), vibStepDay: R.uniform(10, 30) } };
      }
      return scenarioFor(kind, seed);
    };
    const cfg = { ...base, classify: { ...base.classify, noise } };
    const [r] = evaluateMany([cfg], { N, seedBase: 7000, scen });
    out.classificationStress.push({ spotCheckNoise: noise, loadStepInH0: hard, ...row(r) });
  }
}
writeFileSync(new URL(`../data/sensitivity-${DESIGN}.json`, import.meta.url), JSON.stringify({ N, seedBase: 7000, design: DESIGN, ...out }, null, 1));
for (const [k, v] of Object.entries(out)) { console.log('\n' + k); console.table(v.map((x) => Object.fromEntries(Object.entries(x).map(([a, b]) => [a, typeof b === 'number' ? +b.toFixed(2) : b])))); }

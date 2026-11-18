// Calibrate the CUSUM threshold h on calibration seeds (1000..), never on the evaluation seeds
// (5000..). Output: grid of h vs false alarm rate and H1 lead time for the v3 design.
import { evaluateMany } from './montecarlo.mjs';
import { VERSIONS } from './detect.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const N = Number(process.env.N || 120);
const hs = [4, 5, 6, 7, 8, 9, 10, 12];
const results = evaluateMany(hs.map((h) => ({ ...VERSIONS.v3, h })), { N, seedBase: 1000 });
const grid = [];
for (let i = 0; i < hs.length; i++) {
  const h = hs[i];
  const r = results[i];
  grid.push({ h, fa: r.falseAlarmsPerStationYear, det: r.h1DetectionRate, leadMedian: r.h1LeadDaysMedian, leadP10: r.h1LeadDaysP10, lead7: r.h1LeadAtLeast7d, h0Det: r.h0ClusterDetectionRate });
}
console.table(grid.map((g) => ({ h: g.h, FA_per_station_year: g.fa.toFixed(2), H1_detect: g.det.toFixed(2), lead_med_d: g.leadMedian?.toFixed(1), lead_p10_d: g.leadP10?.toFixed(1), lead_ge7d: g.lead7.toFixed(2), H0_detect: g.h0Det.toFixed(2) })));
mkdirSync(new URL('../data', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/calibration.json', import.meta.url), JSON.stringify({ N, seedBase: 1000, grid }, null, 1));

// Detectors. Each version is a config so the panel iterations in docs/03-analysis.md can be
// replayed and compared on the same seeds.
import { rng } from './rng.mjs';
import { spotCheck, measuredVibration } from './generate.mjs';
import { STATIONS, VIB_ZONES } from './plant.mjs';

// Chronic level detector: trailing mean rate against the design expectation (lambda0).
// Needed because a CUSUM only sees change, and a chronic cluster is there from day one.
export function levelAlarms(dailyCounts, lambda0, level) {
  const alarms = [];
  let cooldown = -1;
  for (let d = level.windowDays - 1; d < dailyCounts.length; d++) {
    if (d < cooldown) continue;
    let sum = 0;
    for (let k = 0; k < level.windowDays; k++) sum += dailyCounts[d - k];
    const rate = sum / (level.windowDays * 24);
    if (rate / lambda0 >= level.ratio) {
      alarms.push((d + 1) * 24);
      cooldown = d + level.windowDays;
    }
  }
  return alarms;
}

const CLS = { delayH: 48, ratioThr: 1.6, recheckH: 168, trendThr: 1.25 };

export const VERSIONS = {
  // v0: what most plants have. Poisson CUSUM on the manually logged stops only.
  v0: { source: 'logged', minDurS: 0, bucketH: 8, baselineDays: 5, k: 0.5, h: 5, dispersion: 'none', perBucketOfDay: false, classify: null },
  // v1: capture every stop of 2 s or more from the photoeye. Poisson CUSUM, pooled baseline.
  v1: { source: 'auto', minDurS: 2, bucketH: 8, baselineDays: 5, k: 0.5, h: 5, dispersion: 'none', perBucketOfDay: false, classify: null },
  // v2: v1 + per-station dispersion and a separate baseline per shift of day.
  v2: { source: 'auto', minDurS: 2, bucketH: 8, baselineDays: 5, k: 0.5, h: 5, dispersion: 'own', perBucketOfDay: true, classify: null },
  // v3: daily buckets, 7 day baseline, dispersion shared across stations. Threshold h still 5.
  v3: { source: 'auto', minDurS: 2, bucketH: 24, baselineDays: 7, k: 0.5, h: 5, dispersion: 'shared', perBucketOfDay: false, classify: null },
  // v4: v3 with h = 12 calibrated on separate seeds (see calibrate.mjs) + spot check classification.
  v4: { source: 'auto', minDurS: 2, bucketH: 24, baselineDays: 7, k: 0.5, h: 12, dispersion: 'shared', perBucketOfDay: false, classify: CLS },
  // v5 (below): v4 + level detector for chronic clusters that were already present in the baseline.
  v5: { source: 'auto', minDurS: 2, bucketH: 24, baselineDays: 7, k: 0.5, h: 12, dispersion: 'shared', perBucketOfDay: false, classify: CLS, level: { windowDays: 7, ratio: 1.8 } },
  // v6: v5 with a trend-confirmed classification. A load step stays flat after it happens,
  // wear keeps growing, so mechanical needs level AND growth between two spot checks.
  v6: {
    source: 'auto', minDurS: 2, bucketH: 24, baselineDays: 7, k: 0.5, h: 12, dispersion: 'shared', perBucketOfDay: false,
    classify: { mode: 'trend', delayH: 24, recheckH: 120, ratioThr: 1.6, minR1: 1.2, trendMin: 1.15 },
    level: { windowDays: 7, ratio: 1.8 },
  },
};

// Hourly micro-stop counts per station, cached on the sim object.
function hourly(sim, cfg) {
  const key = `${cfg.source}:${cfg.minDurS}`;
  sim._hc = sim._hc || {};
  if (sim._hc[key]) return sim._hc[key];
  const hc = STATIONS.map(() => new Int16Array(sim.H));
  for (const e of sim.events) {
    if (cfg.source === 'logged' && !e.logged) continue;
    if (e.d < cfg.minDurS || e.d >= 300) continue; // micro-stops only; breakdowns are tracked separately
    const h = Math.floor(e.t / 3600);
    if (h < sim.H) hc[e.st][h]++;
  }
  sim._hc[key] = hc;
  return hc;
}

export function bucketCounts(sim, stationIdx, cfg) {
  const hc = hourly(sim, cfg)[stationIdx];
  const n = Math.floor(sim.H / cfg.bucketH);
  const out = new Array(n).fill(0);
  for (let b = 0; b < n; b++) {
    let s = 0;
    for (let k = 0; k < cfg.bucketH; k++) s += hc[b * cfg.bucketH + k];
    out[b] = s;
  }
  return out;
}

function meanVar(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, arr.length - 1);
  return { m, v };
}
const medianOf = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// One-sided upper CUSUM on standardised bucket counts. Returns every alarm (with reset).
function cusumOne(counts, cfg, phiForce) {
  const nBase = Math.round((cfg.baselineDays * 24) / cfg.bucketH);
  const g = cfg.perBucketOfDay ? 24 / cfg.bucketH : 1;
  const base = counts.slice(0, nBase);
  const par = Array.from({ length: g }, (_, j) => {
    const grp = base.filter((_, i) => i % g === j);
    const { m, v } = meanVar(grp);
    const mu = Math.max(0.5, m);
    return { mu, phi: Math.max(1, v / mu) };
  });
  let S = 0;
  const series = [];
  const alarms = [];
  for (let i = nBase; i < counts.length; i++) {
    const { mu, phi: phiOwn } = par[i % g];
    const phi = phiForce ?? (cfg.dispersion === 'own' ? phiOwn : 1);
    const z = (counts[i] - mu) / Math.sqrt(phi * mu);
    S = Math.max(0, S + z - cfg.k);
    series.push({ bucket: i, z, S });
    if (S > cfg.h) {
      alarms.push(i);
      S = 0;
    }
  }
  return { series, alarms, par, nBase };
}

export function analyseLine(sim, cfg, seed = 1) {
  const counts = STATIONS.map((s) => bucketCounts(sim, s.i, cfg));
  let phiShared = null;
  if (cfg.dispersion === 'shared') {
    const nBase = Math.round((cfg.baselineDays * 24) / cfg.bucketH);
    const phis = counts.map((c) => {
      const { m, v } = meanVar(c.slice(0, nBase));
      return Math.max(1, v / Math.max(0.5, m));
    });
    phiShared = medianOf(phis);
  }
  return STATIONS.map((s) => {
    const cu = cusumOne(counts[s.i], cfg, phiShared);
    const cusumHours = cu.alarms.map((b) => (b + 1) * cfg.bucketH);
    const levelHours = cfg.level && cfg.bucketH === 24 ? levelAlarms(counts[s.i], s.lambda0, cfg.level) : [];
    const alarmHours = [...cusumHours, ...levelHours].sort((a, b) => a - b);
    const firstAlarm = alarmHours.length ? alarmHours[0] : null;
    const firstKind = firstAlarm === null ? null : cusumHours[0] === firstAlarm ? 'drift' : 'chronic';
    let cls = null;
    if (cfg.classify && firstAlarm !== null) cls = classify(sim, s.i, firstAlarm, cfg.classify, seed * 13 + s.i);
    return { station: s.i, counts: counts[s.i], cu, firstAlarm, firstKind, alarmHours, cusumHours, levelHours, cls, phiShared };
  });
}

export const analyseStation = (sim, i, cfg, seed) => analyseLine(sim, cfg, seed)[i];

// Fixed-transmitter comparator: alarm when a 6 h rolling median of measured vibration
// passes the zone B/C boundary. Needs a sensor on the asset.
export function vibrationThresholdAlarm(sim, stationIdx, thr = VIB_ZONES.BC) {
  const v = measuredVibration(sim, stationIdx);
  for (let h = 6; h < v.length; h++) {
    const w = Array.from(v.slice(h - 6, h)).sort((a, b) => a - b);
    if ((w[2] + w[3]) / 2 >= thr) return h;
  }
  return null;
}

// Classification by portable spot check after an alarm. Returns { mechanical, decisionHour }.
export function classify(sim, stationIdx, alarmHour, cls, seed) {
  const R = rng(seed);
  const nz = cls.noise ?? 0.1;
  const base = spotCheck(sim, stationIdx, 0, R, nz);
  const h1 = alarmHour + cls.delayH;
  if (cls.mode === 'trend') {
    const h2t = h1 + cls.recheckH;
    if (h2t >= sim.H) return { mechanical: null, decisionHour: null };
    const a1 = spotCheck(sim, stationIdx, h1, R, nz) / base;
    const a2 = spotCheck(sim, stationIdx, h2t, R, nz) / base;
    return { mechanical: a2 >= cls.ratioThr && a1 >= cls.minR1 && a2 / a1 >= cls.trendMin, decisionHour: h2t, r1: a1, r2: a2 };
  }
  if (h1 >= sim.H) return { mechanical: null, decisionHour: null };
  const r1 = spotCheck(sim, stationIdx, h1, R, nz) / base;
  if (r1 >= cls.ratioThr) return { mechanical: true, decisionHour: h1, r1 };
  const h2 = h1 + cls.recheckH;
  if (h2 >= sim.H) return { mechanical: false, decisionHour: h1, r1 };
  const r2 = spotCheck(sim, stationIdx, h2, R, nz) / base;
  const mech = r2 >= cls.ratioThr || r2 / r1 >= cls.trendThr;
  return { mechanical: mech, decisionHour: h2, r1, r2 };
}

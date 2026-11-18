// Monte Carlo evaluation of the detector versions on three scenario families.
// H1: progressive bearing degradation at ZS-202 (mechanical)
// H0: non-mechanical cluster at ZS-202 (feed or guide rail), vibration flat
// N : no fault anywhere (false alarm rate)
// Caution: data comes from this repo's own generator, so results test the algorithm and
// its sensitivity to assumptions. They are not evidence of field performance.
import { rng } from './rng.mjs';
import { simulate } from './generate.mjs';
import { analyseLine, VERSIONS, vibrationThresholdAlarm } from './detect.mjs';

export const TARGET = 1; // ZS-202

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const pct = (a, p) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

export function scenarioFor(kind, seed) {
  const R = rng(seed * 31 + 7);
  if (kind === 'H1') return { mech: { station: TARGET, g: 0.06 * Math.exp(0.3 * R.normal()), gamma: R.uniform(1.0, 1.8), v0: 1.0 } };
  if (kind === 'H0') return { feed: { station: TARGET, mult: R.uniform(2, 4), night: 1.3 } };
  return {};
}

// Stream seeds one at a time (memory stays flat) and score every config on the same sims.
export function evaluateMany(cfgs, { N = 200, seedBase = 5000, days = 60, withVib = false, scen = scenarioFor, sigmaDay = 0.2 } = {}) {
  const acc = cfgs.map((cfg) => ({ cfg, o: { h1Det: 0, lead: [], actionable: [], h1Cls: 0, h1Mech: 0, h0Det: 0, h0Cls: 0, h0Mech: 0, faAlarms: 0, faDays: 0 }, vib: { det: 0, lead: [] } }));
  for (let r = 0; r < N; r++) {
    const seed = seedBase + r;
    const s = {
      seed,
      H1: simulate({ seed, days, sigmaDay, ...scen('H1', seed) }),
      H0: simulate({ seed: seed + 50000, days, sigmaDay, ...scen('H0', seed) }),
      N: simulate({ seed: seed + 90000, days, sigmaDay, ...scen('N', seed) }),
    };
    for (const a of acc) {
      const { cfg, o, vib } = a;
      const a1 = analyseLine(s.H1, cfg, seed);
      const t1 = a1[TARGET];
      if (t1.firstAlarm !== null && (s.H1.failureHour === null || t1.firstAlarm < s.H1.failureHour)) {
        o.h1Det++;
        if (s.H1.failureHour !== null) o.lead.push((s.H1.failureHour - t1.firstAlarm) / 24);
        if (cfg.classify && t1.cls && t1.cls.mechanical !== null) {
          o.h1Cls++;
          if (t1.cls.mechanical) {
            o.h1Mech++;
            if (s.H1.failureHour !== null && t1.cls.decisionHour < s.H1.failureHour) o.actionable.push((s.H1.failureHour - t1.cls.decisionHour) / 24);
          }
        }
      }
      const a0 = analyseLine(s.H0, cfg, seed);
      const t0 = a0[TARGET];
      if (t0.firstAlarm !== null) {
        o.h0Det++;
        if (cfg.classify && t0.cls && t0.cls.mechanical !== null) {
          o.h0Cls++;
          if (t0.cls.mechanical) o.h0Mech++;
        }
      }
      const aN = analyseLine(s.N, cfg, seed);
      for (const an of [a1, a0]) for (const st of an) if (st.station !== TARGET) { o.faAlarms += st.alarmHours.length; o.faDays += days - cfg.baselineDays; }
      for (const st of aN) { o.faAlarms += st.alarmHours.length; o.faDays += days - cfg.baselineDays; }
      if (withVib) {
        const h = vibrationThresholdAlarm(s.H1, TARGET);
        if (h !== null && (s.H1.failureHour === null || h < s.H1.failureHour)) {
          vib.det++;
          if (s.H1.failureHour !== null) vib.lead.push((s.H1.failureHour - h) / 24);
        }
      }
    }
  }
  return acc.map(({ cfg, o, vib }) => {
    const res = {
      config: cfg,
      h1DetectionRate: o.h1Det / N,
      h1LeadDaysMedian: median(o.lead),
      h1LeadDaysP10: pct(o.lead, 10),
      h1LeadAtLeast7d: o.lead.filter((x) => x >= 7).length / N,
      h0ClusterDetectionRate: o.h0Det / N,
      falseAlarmsPerStationYear: (o.faAlarms / o.faDays) * 365,
      classification: cfg.classify
        ? {
            h1CorrectlyMechanical: o.h1Cls ? o.h1Mech / o.h1Cls : null,
            h0CorrectlyNonMechanical: o.h0Cls ? 1 - o.h0Mech / o.h0Cls : null,
            h1ActionableLeadMedian: median(o.actionable),
            h1ActionableAtLeast5d: o.actionable.filter((x) => x >= 5).length / N,
          }
        : null,
    };
    if (withVib) res.vibrationThreshold = { h1DetectionRate: vib.det / N, h1LeadDaysMedian: median(vib.lead) };
    return res;
  });
}

export function evaluate({ versionKeys = Object.keys(VERSIONS), N = 200, seedBase = 5000, days = 60 } = {}) {
  const res = evaluateMany(versionKeys.map((k) => VERSIONS[k]), { N, seedBase, days, withVib: true });
  const summary = {};
  versionKeys.forEach((k, i) => (summary[k] = res[i]));
  return { N, days, seedBase, summary };
}

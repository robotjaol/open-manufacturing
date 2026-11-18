// Synthetic operating history generator. Every number is produced from the assumptions
// written here and in plant.mjs. It is a model, not field data.
import { rng } from './rng.mjs';
import { STATIONS, DUR, BREAKDOWN, logProbability, VIB_ZONES } from './plant.mjs';

/**
 * @param seed       integer seed
 * @param days       horizon in days
 * @param mech       { station, g, gamma, v0 } progressive bearing degradation, or null
 *                   v(t) = v0 * exp(g * t_days); stop rate = lambda0 * (v/v0)^gamma
 * @param feed       { station, mult, night } non-mechanical cluster (feed or guide rail), or null
 */
export function simulate({ seed = 1, days = 21, mech = null, feed = null, sigmaDay = 0.2 } = {}) {
  const R = rng(seed);
  const H = days * 24;
  const events = [];
  const vTrue = STATIONS.map(() => new Float64Array(H));
  let failureHour = null;
  // Day-to-day variation of each station's rate (jams cluster): lognormal, sigma 0.2.
  // This makes counts overdispersed, as real shop-floor counts are.
  const dayMult = STATIONS.map(() => Array.from({ length: days }, () => R.lognormal(1, sigmaDay)));
  const NIGHT_FACTOR = 1.15; // whole line is a little worse at night

  for (let h = 0; h < H; h++) {
    const hourOfDay = h % 24;
    const night = hourOfDay >= 22 || hourOfDay < 6;
    for (const s of STATIONS) {
      const v0 = mech && s.i === mech.station ? mech.v0 ?? 1.0 : 0.8 + 0.07 * s.i;
      let vRatio = 1;
      // Degradation is capped at the zone C/D boundary: the asset is treated as failed there.
      if (mech && s.i === mech.station) vRatio = Math.min(VIB_ZONES.CD / v0, Math.exp(mech.g * (h / 24)));
      let vStep = 1;
      if (feed && s.i === feed.station && feed.vibStep && h / 24 >= feed.vibStepDay) vStep = feed.vibStep; // load change, not wear
      vTrue[s.i][h] = v0 * vRatio * vStep;
      if (mech && s.i === mech.station && failureHour === null && v0 * vRatio >= VIB_ZONES.CD - 1e-9) failureHour = h;

      const lamBase = s.lambda0 * dayMult[s.i][Math.floor(h / 24)] * (night ? NIGHT_FACTOR : 1);
      let lamExtra = 0;
      let extraCause = 'none';
      if (mech && s.i === mech.station) {
        lamExtra = lamBase * (Math.pow(vRatio, mech.gamma) - 1);
        extraCause = 'bearing_degradation';
      }
      if (feed && s.i === feed.station) {
        const boost = night ? feed.night ?? 1.3 : 1;
        lamExtra = lamBase * (feed.mult * boost - 1);
        extraCause = 'feed_variability';
      }
      const median = DUR.median * (1 + 0.15 * (vRatio - 1));
      const place = (cause) => {
        const t = (h + R.next()) * 3600;
        const d = Math.min(DUR.max, Math.max(DUR.min, R.lognormal(cause === 'bearing_degradation' ? median : DUR.median, DUR.sigma)));
        events.push({ st: s.i, t, d, cause, logged: R.next() < logProbability(d) });
      };
      const nBase = R.poisson(lamBase);
      for (let k = 0; k < nBase; k++) place('random_jam');
      const nExtra = R.poisson(lamExtra);
      for (let k = 0; k < nExtra; k++) place(extraCause);
      if (R.next() < BREAKDOWN.perHour) {
        const d = Math.max(300, R.lognormal(BREAKDOWN.median, BREAKDOWN.sigma));
        events.push({ st: s.i, t: (h + R.next()) * 3600, d, cause: 'breakdown', logged: R.next() < 0.95 });
      }
    }
  }
  events.sort((a, b) => a.t - b.t);
  return { seed, days, H, events, vTrue, failureHour, mech, feed };
}

// Measured vibration series (what a fixed transmitter would report): multiplicative noise
// plus rare restart transients.
export function measuredVibration(sim, stationIdx, seedOffset = 1000) {
  const R = rng(sim.seed * 7919 + seedOffset + stationIdx);
  const out = new Float64Array(sim.H);
  for (let h = 0; h < sim.H; h++) {
    let v = sim.vTrue[stationIdx][h] * Math.exp(0.07 * R.normal());
    if (R.next() < 0.01) v *= 1.8;
    out[h] = v;
  }
  return out;
}

// Portable spot check: mean of 8 readings with 10% multiplicative noise at hour h.
export function spotCheck(sim, stationIdx, hour, R, noise = 0.1) {
  const h = Math.min(sim.H - 1, Math.max(0, Math.floor(hour)));
  let sum = 0;
  for (let k = 0; k < 8; k++) sum += sim.vTrue[stationIdx][h] * Math.exp(noise * R.normal());
  return sum / 8;
}

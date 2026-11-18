// KPI maths. OEE = Availability x Performance x Quality, the three-factor form used in
// ISO 22400-2. Here every stop stops the whole line (series line), so loss time is the union
// of all stop intervals.
import { LINE } from './plant.mjs';

export function unionLength(intervals) {
  if (!intervals.length) return 0;
  const iv = intervals.map((e) => [e.t, e.t + e.d]).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [s, e] = iv[0];
  for (let k = 1; k < iv.length; k++) {
    if (iv[k][0] <= e) e = Math.max(e, iv[k][1]);
    else {
      total += e - s;
      [s, e] = iv[k];
    }
  }
  return total + (e - s);
}

export const oee = (a, p, q) => a * p * q;

export function lineKpis(events, days) {
  const ppt = days * LINE.plannedHoursPerDay * 3600; // planned production time, s
  const stopAll = unionLength(events);
  const stopLogged = unionLength(events.filter((e) => e.logged));
  const stopUnlogged = Math.max(0, stopAll - stopLogged); // approximation: overlap is rare
  const running = ppt - stopAll;
  const packs = (running / LINE.idealCycleS) * LINE.speedFactor;
  const good = packs * LINE.quality;
  const trueOee = (good * LINE.idealCycleS) / ppt;

  // What the manual log believes: only logged stops are availability loss.
  const aRep = (ppt - stopLogged) / ppt;
  const pRep = (packs * LINE.idealCycleS) / (ppt - stopLogged);
  const oeeRep = oee(aRep, pRep, LINE.quality);

  const speedLoss = running * (1 - LINE.speedFactor);
  const qualityLoss = running * LINE.speedFactor * (1 - LINE.quality);
  const perfBucketReported = ppt - stopLogged - (packs * LINE.idealCycleS);
  return {
    ppt,
    stopAll,
    stopLogged,
    stopUnlogged,
    packs,
    trueOee,
    reported: { a: aRep, p: pRep, q: LINE.quality, oee: oeeRep },
    // share of the reported performance-loss bucket that is really unlogged stop time
    hiddenInPerformance: perfBucketReported > 0 ? stopUnlogged / perfBucketReported : 0,
    unloggedShareOfStopTime: stopAll > 0 ? stopUnlogged / stopAll : 0,
    lossTree: {
      loggedStops: stopLogged,
      unloggedStops: stopUnlogged,
      speed: speedLoss,
      quality: qualityLoss,
    },
  };
}

export function manualLogShareUnder(events, seconds) {
  const sub = events.filter((e) => e.d < seconds);
  if (!sub.length) return 0;
  return sub.filter((e) => e.logged).length / sub.length;
}

// Lost margin = hours lost x (revenue per hour - variable cost per hour).
// Default line economics from a published worked example: 2,500 USD/h revenue at 35% margin.
export const lostMargin = (hoursLost, marginPerHour = 875) => hoursLost * marginPerHour;

import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../sim/generate.mjs';
import { lineKpis, unionLength, manualLogShareUnder } from '../sim/kpi.mjs';
import { analyseLine, levelAlarms, VERSIONS } from '../sim/detect.mjs';
import { LINE } from '../sim/plant.mjs';

test('same seed gives identical data', () => {
  const a = simulate({ seed: 7, days: 10 });
  const b = simulate({ seed: 7, days: 10 });
  assert.equal(a.events.length, b.events.length);
  assert.equal(a.events[100].t, b.events[100].t);
});

test('degradation is capped, so event count stays bounded', () => {
  const s = simulate({ seed: 3, days: 60, mech: { station: 1, g: 0.2, gamma: 1.8, v0: 1 } });
  assert.ok(s.events.length < 100000, `events ${s.events.length}`);
  assert.ok(s.failureHour !== null);
});

test('union of overlapping intervals is not double counted', () => {
  assert.equal(unionLength([{ t: 0, d: 10 }, { t: 5, d: 10 }, { t: 100, d: 5 }]), 20);
  assert.equal(unionLength([]), 0);
});

test('OEE identity: reported OEE equals true OEE (A x P x Q only moves loss between buckets)', () => {
  const s = simulate({ seed: 11, days: 14 });
  const k = lineKpis(s.events, 14);
  assert.ok(Math.abs(k.reported.oee - k.trueOee) < 1e-9);
  assert.ok(k.reported.a > k.trueOee); // logged-only availability looks better than reality
  assert.ok(k.hiddenInPerformance > 0 && k.hiddenInPerformance <= 1);
});

test('default generator keeps the sub-60 s manual log share below 25%', () => {
  const s = simulate({ seed: 5, days: 21 });
  const share = manualLogShareUnder(s.events, 60);
  assert.ok(share > 0.05 && share < 0.25, `share ${share}`);
});

test('level detector: silent at design rate, fires at 2x', () => {
  const flat = new Array(21).fill(24);          // 1.0 stops per hour
  assert.equal(levelAlarms(flat, 1.0, { windowDays: 7, ratio: 1.8 }).length, 0);
  const double = new Array(21).fill(48);        // 2.0 stops per hour
  assert.equal(levelAlarms(double, 1.0, { windowDays: 7, ratio: 1.8 })[0], 7 * 24);
});

test('CUSUM drift detector flags a progressive fault and stays quiet on a clean line', () => {
  const clean = simulate({ seed: 21, days: 40 });
  const cleanAlarms = analyseLine(clean, VERSIONS.v6, 1).reduce((a, s) => a + s.cusumHours.length, 0);
  assert.ok(cleanAlarms <= 1, `clean alarms ${cleanAlarms}`);
  const faulty = simulate({ seed: 21, days: 40, mech: { station: 1, g: 0.06, gamma: 1.4, v0: 1 } });
  const a = analyseLine(faulty, VERSIONS.v6, 1)[1];
  assert.ok(a.firstAlarm !== null && a.firstAlarm < faulty.failureHour);
});

test('classification: wear is mechanical, a feed cluster is not', () => {
  const wear = simulate({ seed: 31, days: 40, mech: { station: 1, g: 0.06, gamma: 1.4, v0: 1 } });
  const feed = simulate({ seed: 32, days: 40, feed: { station: 1, mult: 3, night: 1.3 } });
  const w = analyseLine(wear, VERSIONS.v6, 5)[1];
  const f = analyseLine(feed, VERSIONS.v6, 5)[1];
  assert.equal(w.cls?.mechanical, true);
  assert.equal(f.cls?.mechanical, false);
});

test('line constants are sane', () => {
  assert.ok(LINE.idealCycleS > 0 && LINE.plannedHoursPerDay < 24);
});

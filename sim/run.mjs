// Build every data product: CSV exports, Monte Carlo summary and the single JSON the website reads.
// Usage: node sim/run.mjs   (about 20 seconds)
import { mkdirSync, writeFileSync } from 'node:fs';
import { simulate, measuredVibration } from './generate.mjs';
import { analyseLine, VERSIONS } from './detect.mjs';
import { lineKpis, manualLogShareUnder, lostMargin } from './kpi.mjs';
import { evaluate } from './montecarlo.mjs';
import { LINE, STATIONS, VIB_ZONES, FAILURE_MODE } from './plant.mjs';
import { readFileSync, existsSync } from 'node:fs';

const OUT = new URL('../data/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const START = Date.UTC(2026, 10, 1); // 1 Nov 2026, label only
const DEMO = {
  seed: 2040,
  days: 21,
  mech: { station: 1, g: 0.065, gamma: 1.4, v0: 1.0 }, // ZS-202: bearing wear
  feed: { station: 2, mult: 2.5, night: 1.3 }, // ZS-301: feed variability, chronic
};
const CFG = VERSIONS.v6;
const sim = simulate(DEMO);
const an = analyseLine(sim, CFG, DEMO.seed);
const kpi = lineKpis(sim.events, DEMO.days);

// ---------- CSV exports ----------
const iso = (s) => new Date(START + s * 1000).toISOString();
const csv = (rows) => rows.map((r) => r.join(',')).join('\n') + '\n';
const stopsCsv = [['event_id', 'station_tag', 'asset_tag', 'start_utc', 'duration_s', 'in_manual_log', 'iso14224_mode', 'synthetic_cause_ground_truth']];
sim.events.forEach((e, k) => {
  const st = STATIONS[e.st];
  stopsCsv.push([`E${String(k + 1).padStart(5, '0')}`, st.tag, st.asset, iso(e.t), e.d.toFixed(1), e.logged ? 1 : 0, e.cause === 'breakdown' ? FAILURE_MODE.breakdown : FAILURE_MODE.micro, e.cause]);
});
writeFileSync(new URL('stops.csv', OUT), csv(stopsCsv));

const vibMeasured = STATIONS.map((s) => measuredVibration(sim, s.i));
const vibCsv = [['hour_utc', ...STATIONS.map((s) => s.motor.replace('MTR', 'VT') + '_rms_mm_s')]];
for (let h = 0; h < sim.H; h++) vibCsv.push([iso(h * 3600), ...vibMeasured.map((v) => v[h].toFixed(3))]);
writeFileSync(new URL('vibration.csv', OUT), csv(vibCsv));

// ---------- daily aggregates ----------
const dayCount = (cfgKey, st) => {
  const out = new Array(DEMO.days).fill(0);
  for (const e of sim.events) {
    if (e.st !== st || e.d >= 300) continue;
    if (cfgKey === 'logged' && !e.logged) continue;
    out[Math.floor(e.t / 86400)]++;
  }
  return out;
};
const dailyAuto = STATIONS.map((s) => dayCount('auto', s.i).map((c) => c / 24));
const dailyLogged = STATIONS.map((s) => dayCount('logged', s.i).map((c) => c / 24));
const hourlyAuto = STATIONS.map(() => new Array(sim.H).fill(0));
for (const e of sim.events) if (e.d < 300) hourlyAuto[e.st][Math.floor(e.t / 3600)]++;

const dailyCsv = [['day', ...STATIONS.map((s) => `${s.tag}_stops_per_h`)]];
for (let d = 0; d < DEMO.days; d++) dailyCsv.push([d + 1, ...dailyAuto.map((r) => r[d].toFixed(3))]);
writeFileSync(new URL('daily_stop_rate.csv', OUT), csv(dailyCsv));

// ---------- duration bands: what the manual log sees ----------
const bands = [
  { label: '< 10 s', lo: 0, hi: 10 },
  { label: '10 to 60 s', lo: 10, hi: 60 },
  { label: '1 to 5 min', lo: 60, hi: 300 },
  { label: '> 5 min', lo: 300, hi: 1e9 },
].map((b) => {
  const ev = sim.events.filter((e) => e.d >= b.lo && e.d < b.hi);
  return { ...b, captured: ev.length, logged: ev.filter((e) => e.logged).length, hoursCaptured: ev.reduce((a, e) => a + e.d, 0) / 3600, hoursLogged: ev.filter((e) => e.logged).reduce((a, e) => a + e.d, 0) / 3600 };
});

// ---------- projection of functional failure from the measured vibration ----------
const dailyMedianVib = (arr, d) => {
  const w = Array.from(arr.slice(d * 24, d * 24 + 24)).sort((a, b) => a - b);
  return (w[11] + w[12]) / 2;
};
const lastDays = 10;
const xs = [];
const ys = [];
for (let d = DEMO.days - lastDays; d < DEMO.days; d++) {
  xs.push(d + 0.5);
  ys.push(Math.log(dailyMedianVib(vibMeasured[1], d)));
}
const n = xs.length;
const mx = xs.reduce((a, b) => a + b, 0) / n;
const my = ys.reduce((a, b) => a + b, 0) / n;
const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
const icpt = my - slope * mx;
const failureDayProjected = (Math.log(VIB_ZONES.CD) - icpt) / slope;

// ---------- economics (parametric, assumptions stated) ----------
const marginPerHour = 875; // 2,500 USD/h revenue at 35% margin (worked example in cited source)
const hoursUnlogged = kpi.stopUnlogged / 3600;
const economics = {
  marginPerHourUSD: marginPerHour,
  microStopHoursInWindow: kpi.stopAll / 3600,
  unloggedHoursInWindow: hoursUnlogged,
  lostMarginMicroStopsWindowUSD: lostMargin(kpi.stopAll / 3600, marginPerHour),
  bearingFailure: { unplannedHours: 36, plannedReplacementHours: 4, source: 'unplanned hours from a published labeller bearing case; planned hours is an assumption' },
  avoidedHours: 32,
  avoidedLostMarginUSD: { at875: lostMargin(32, 875), at14167: lostMargin(32, 14167), at36000: lostMargin(32, 36000) },
  note: 'Lost margin only. Excludes repair parts, labour, scrap and customer penalties. 14,167 USD/h is the 510k USD / 36 h case figure; 36,000 USD/h is the FMCG downtime figure quoted from Siemens 2024.',
};

// ---------- Monte Carlo (final) ----------
const mc = evaluate({ N: 300, seedBase: 5000, days: 60 });
writeFileSync(new URL('montecarlo.json', OUT), JSON.stringify(mc, null, 1));

const readJson = (f) => (existsSync(new URL(f, OUT)) ? JSON.parse(readFileSync(new URL(f, OUT), 'utf8')) : null);

// ---------- website payload ----------
const alarms = STATIONS.map((s) => {
  const a = an[s.i];
  return {
    tag: s.tag,
    firstAlarmHour: a.firstAlarm,
    kind: a.firstKind,
    cusumHours: a.cusumHours,
    levelHours: a.levelHours,
    classification: a.cls,
    cusum: a.cu.series.map((p) => +p.S.toFixed(2)),
  };
});
const web = {
  meta: { seed: DEMO.seed, days: DEMO.days, hours: sim.H, startUTC: iso(0), synthetic: true, detector: 'v6', lineName: LINE.name },
  stations: STATIONS.map((s) => ({ tag: s.tag, asset: s.asset, motor: s.motor, name: s.name, lambda0: s.lambda0 })),
  dailyRate: dailyAuto.map((r) => r.map((x) => +x.toFixed(3))),
  dailyRateLogged: dailyLogged.map((r) => r.map((x) => +x.toFixed(3))),
  hourlyCounts: hourlyAuto,
  vib: { '2040-VT-202': Array.from(vibMeasured[1]).map((v) => +v.toFixed(3)), '2040-VT-201': Array.from(vibMeasured[0]).map((v) => +v.toFixed(3)) },
  vibZones: VIB_ZONES,
  alarms,
  bands,
  kpi: {
    ppt_h: kpi.ppt / 3600,
    stopAll_h: kpi.stopAll / 3600,
    stopLogged_h: kpi.stopLogged / 3600,
    stopUnlogged_h: kpi.stopUnlogged / 3600,
    trueOee: kpi.trueOee,
    reported: kpi.reported,
    hiddenInPerformance: kpi.hiddenInPerformance,
    unloggedShareOfStopTime: kpi.unloggedShareOfStopTime,
    lossTree_h: Object.fromEntries(Object.entries(kpi.lossTree).map(([k, v]) => [k, v / 3600])),
    subMinuteLoggedShare: manualLogShareUnder(sim.events, 60),
    stopCount: sim.events.length,
  },
  projection: { failureDay: failureDayProjected, method: 'log-linear fit of the last 10 daily median vibration values to the zone C/D boundary (4.5 mm/s)' },
  economics,
  montecarlo: mc,
  calibration: readJson('calibration.json'),
  sensitivity: { v5: readJson('sensitivity-v5.json'), v6: readJson('sensitivity-v6.json') },
};
mkdirSync(new URL('../web/', import.meta.url), { recursive: true });
writeFileSync(new URL('results.json', OUT), JSON.stringify(web));
console.log('events', sim.events.length, 'trueOEE', kpi.trueOee.toFixed(3), 'hiddenInPerf', kpi.hiddenInPerformance.toFixed(2), 'unloggedShare', kpi.unloggedShareOfStopTime.toFixed(2), 'subMin logged', web.kpi.subMinuteLoggedShare.toFixed(2));
console.log('failure day projected', failureDayProjected.toFixed(1));
for (const a of alarms) console.log(a.tag, a.firstAlarmHour, a.kind, JSON.stringify(a.classification));
console.table(Object.entries(mc.summary).map(([k, v]) => ({ k, det: v.h1DetectionRate, leadMed: +v.h1LeadDaysMedian?.toFixed(1), lead7: v.h1LeadAtLeast7d, h0: v.h0ClusterDetectionRate, FA: +v.falseAlarmsPerStationYear.toFixed(2), cls: JSON.stringify(v.classification) })));

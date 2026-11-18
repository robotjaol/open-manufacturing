import data from '../../data/results.json';
import { createPlant } from './plant3d.js';
import { lineChart, groupedBars, stackBar } from './charts.js';

const $ = (s) => document.querySelector(s);
const H = data.meta.hours;
const startMs = Date.parse(data.meta.startUTC);
const DAYS = data.meta.days;
const ST = data.stations;
const ASSET_TO_IDX = Object.fromEntries(ST.map((s, i) => [s.asset, i]));
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const SHORT = { '2040-CNV-201': 'Infeed', '2040-CNV-202': 'Transfer', '2040-CPK-301': 'Case packer', '2040-CNV-401': 'Discharge', '2040-PAL-501': 'Palletizer' };

const ASSETS = {
  '2040-CNV-201': { title: 'Infeed conveyor', cls: 'CNV · belt conveyor', note: 'Receives wrapped packs from the primary line. Photoeye 2040-ZS-201 counts every blocked beam of 2 s or more.' },
  '2040-CNV-202': { title: 'Transfer conveyor', cls: 'CNV · belt conveyor with gearmotor drive', note: 'Carries packs to the case packer. Drive end pillow block 2040-BRG-202A is instrumented with vibration sensor 2040-VT-202.' },
  '2040-MTR-202': { title: 'Gearmotor', cls: 'MTR · induction motor with helical gearbox', note: 'Drives the transfer conveyor head shaft. Motor current is not modelled in this simulation.' },
  '2040-BRG-202A': { title: 'Drive end pillow block bearing', cls: 'BRG · spherical roller bearing unit', note: 'Wear is simulated as exponential growth of vibration velocity. Failure is defined at the ISO 10816-1 zone C/D boundary, 4.5 mm/s RMS.' },
  '2040-VT-202': { title: 'Vibration transmitter', cls: 'VT · industrial accelerometer, velocity output', note: 'Reports RMS velocity hourly. Synthetic values carry 7% multiplicative noise and 1% spikes.' },
  '2040-CPK-301': { title: 'Case packer', cls: 'CPK · robotic top-load case packer', note: 'Highest nominal micro-stop rate on the line. Carton feed and tape faults are modelled as a feed cluster with a night-shift boost.' },
  '2040-CNV-401': { title: 'Discharge conveyor', cls: 'CNV · roller conveyor', note: 'Moves taped cases to the palletizer pick position.' },
  '2040-PAL-501': { title: 'Palletizer cell', cls: 'PAL · gantry palletizer with guarded cell', note: 'Builds five layers of six cases, then releases the pallet to the AGV. Light curtain on the outfeed.' },
  '2040-AGV-601': { title: 'Pallet AGV', cls: 'AGV · low-profile transfer vehicle', note: 'Carries full pallets to staging. Not part of the detection model.' },
};

const fmtDate = (h, withHour = true) => {
  const d = new Date(startMs + h * 3600000);
  const mo = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = String(d.getUTCDate()).padStart(2, '0');
  return withHour ? `${mo} ${day} ${String(d.getUTCHours()).padStart(2, '0')}:00` : `${mo} ${day}`;
};
const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');
const pct = (v, d = 0) => (v * 100).toFixed(d) + '%';

// ---------- derived state at an hour ----------
function rateAt(i, h) {
  const a = Math.max(0, h - 23);
  let s = 0;
  for (let k = a; k <= h; k++) s += data.hourlyCounts[i][k];
  return s / (h - a + 1);
}
function vibMedian24(h) {
  const v = data.vib['2040-VT-202'];
  const a = Math.max(0, h - 23);
  const w = v.slice(a, h + 1).sort((x, y) => x - y);
  return w[Math.floor(w.length / 2)];
}
function stationState(i, h) {
  const al = data.alarms[i];
  const base = { status: 0, label: 'Normal', text: 'No alarm. Stop rate is within the expected band for this station.', next: ['Keep the photoeye capture running. No action needed.'] };
  if (al.firstAlarmHour == null || h < al.firstAlarmHour) return base;
  const c = al.classification;
  const kind = al.kind === 'chronic' ? 'sustained high level' : 'upward drift';
  if (!c || h < c.decisionHour) {
    return { status: 1, label: 'Advisory', text: `Micro-stop rate shows a ${kind} since ${fmtDate(al.firstAlarmHour)}. Cause not classified yet: the trend test needs 24 h of data after the alarm.`, next: ['Walk the station and note jams, mis-feeds and sensor dirt.', 'Wait for classification before pulling parts.'] };
  }
  if (c.mechanical) {
    return { status: 2, label: 'Alert', text: `Trend confirmed since ${fmtDate(c.decisionHour)}: the rate keeps climbing (ratio ${c.r1.toFixed(2)} then ${c.r2.toFixed(2)} against design). Pattern fits progressive bearing wear.`, next: ['Spot-check vibration at the drive end bearing with a handheld meter.', 'Order the bearing and book a 4 h planned stop in the next gap.', 'Re-lubricate per the OEM interval and log the reading.'] };
  }
  return { status: 1, label: 'Advisory', text: `Rate stays elevated at ${c.r2.toFixed(2)} times design with no upward trend (ratios ${c.r1.toFixed(2)}, ${c.r2.toFixed(2)}). Pattern fits a feed or process cluster, not wear.`, next: ['Inspect carton blank quality, magazine feed and tape unit.', 'Compare by shift: night rate is boosted in this scenario.', 'Do not pull bearings on this evidence alone.'] };
}

// ---------- 3D ----------
const viewport = $('#viewport');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let cursor = 0;
let selected = null;
let plant;
try {
  plant = createPlant(viewport, {
    onSelect: (id) => select(id),
    onHover: () => {},
    onStop: () => {},
  });
} catch (e) {
  viewport.innerHTML = '<p style="padding:24px;color:#52514e">The 3D view needs WebGL, which this browser could not start. The charts below still work.</p>';
  console.error(e);
}
if (plant && reduce) plant.setPlaying(false);

function applyCursor() {
  const rates = ST.map((_, i) => rateAt(i, cursor));
  const states = ST.map((_, i) => stationState(i, cursor));
  if (plant)
    plant.setCursorState({
      rates,
      status: states.map((s) => s.status),
      vib: vibMedian24(cursor),
      chipText: rates.map((r) => r.toFixed(1) + '/h'),
    });
  renderFindings(rates, states);
  renderDetail(rates, states);
  $('#clock').textContent = `${fmtDate(cursor)} UTC · day ${Math.floor(cursor / 24) + 1} of ${DAYS}`;
  $('#scrub').value = cursor;
  charts.rate && charts.rate.setCursor(cursor / 24);
  charts.vib && charts.vib.setCursor(cursor);
}

function renderKpis() {
  const k = data.kpi;
  $('#kpis').innerHTML = [
    [pct(k.trueOee, 1), 'True OEE, 21 days'],
    [pct(k.unloggedShareOfStopTime), 'Stop time never logged'],
    [pct(k.hiddenInPerformance), 'Hidden in performance loss'],
  ].map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('');
}

function renderFindings(rates, states) {
  const order = [...ST.keys()].sort((a, b) => states[b].status - states[a].status || b - a);
  $('#findings').innerHTML = order.map((i) => {
    const s = ST[i];
    const st = states[i];
    const sel = selected && (selected === s.asset || (selected.startsWith('2040-') && ASSETS[selected] && ASSET_TO_IDX[parentOf(selected)] === i)) ? ' selected' : '';
    return `<li><button type="button" class="finding${sel}" data-asset="${s.asset}">
      <span class="chip c${st.status}">${st.label}</span>
      <span class="nm">${SHORT[s.asset]}<small>${s.asset}</small></span>
      <span class="rt">${rates[i].toFixed(1)}/h</span>
      ${st.status ? `<p>${st.text}</p>` : ''}
    </button></li>`;
  }).join('');
}
const parentOf = (id) => (['2040-MTR-202', '2040-BRG-202A', '2040-VT-202'].includes(id) ? '2040-CNV-202' : id);

function renderDetail(rates, states) {
  const box = $('#detail');
  if (!selected) {
    box.innerHTML = '<p style="color:var(--text-secondary)">Select equipment in the 3D view or from the list to see its findings and next actions.</p>';
    return;
  }
  const a = ASSETS[selected];
  const base = parentOf(selected);
  const idx = ASSET_TO_IDX[base];
  let body = '';
  if (idx != null) {
    const st = states[idx];
    const st0 = ST[idx];
    const ratio = rates[idx] / st0.lambda0;
    const isBrg = selected !== base && idx === 1;
    body = `<dl>
      <dt>Status</dt><dd>${st.label}</dd>
      <dt>Stops per hour, last 24 h</dt><dd>${rates[idx].toFixed(2)} (design ${st0.lambda0.toFixed(1)}, ${ratio.toFixed(2)}x)</dd>
      ${idx === 1 ? `<dt>Vibration, 24 h median</dt><dd>${vibMedian24(cursor).toFixed(2)} mm/s RMS (zone ${zoneOf(vibMedian24(cursor))})</dd>` : ''}
    </dl>
    <p>${isBrg ? 'Vibration is the direct condition signal. The stop-rate alarm above is the early, sensor-free signal.' : st.text}</p>
    <h4>Next</h4><ol>${st.next.map((n) => `<li>${n}</li>`).join('')}</ol>`;
  } else {
    body = '<p>Outside the detection model. Shown for plant context.</p>';
  }
  box.innerHTML = `<h3>${a.title}</h3><div class="tagline">${selected} · ${a.cls}</div><p>${a.note}</p>${body}`;
}
const zoneOf = (v) => (v < data.vibZones.AB ? 'A' : v < data.vibZones.BC ? 'B' : v < data.vibZones.CD ? 'C' : 'D');

function select(id) {
  selected = selected === id ? null : id;
  plant && plant.select(selected);
  applyCursor();
}
$('#findings').addEventListener('click', (e) => {
  const b = e.target.closest('[data-asset]');
  if (b) select(b.dataset.asset);
});

// ---------- toolbar and timeline ----------
$('#btn-whole').addEventListener('click', () => {
  selected = null;
  plant && plant.select(null);
  applyCursor();
});
$('#btn-xray').addEventListener('click', (e) => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', String(on));
  plant && plant.setXray(on);
});
document.querySelectorAll('[data-layer]').forEach((c) => c.addEventListener('change', () => plant && plant.setLayer(c.dataset.layer, c.checked)));
$('#scrub').addEventListener('input', (e) => {
  cursor = +e.target.value;
  applyCursor();
});
let timer = null;
const playBtn = $('#btn-play');
function setPlay(on) {
  playBtn.setAttribute('aria-pressed', String(on));
  playBtn.textContent = on ? 'Pause timeline' : 'Play timeline';
  clearInterval(timer);
  if (on) {
    if (cursor >= H - 1) cursor = 0;
    timer = setInterval(() => {
      cursor = Math.min(H - 1, cursor + 2);
      applyCursor();
      if (cursor >= H - 1) setPlay(false);
    }, 90);
  }
}
playBtn.addEventListener('click', () => setPlay(playBtn.getAttribute('aria-pressed') !== 'true'));

function renderScrubMarks() {
  const m = $('#scrub-marks');
  const parts = [];
  for (let d = 0; d < DAYS; d += 5) parts.push(`<span class="tick${d === 0 ? ' first' : ''}" style="left:${(d * 24 / (H - 1)) * 100}%">${fmtDate(d * 24, false)}</span>`);
  ST.forEach((s, i) => {
    const al = data.alarms[i];
    if (al.firstAlarmHour != null) parts.push(`<span class="al" style="left:${(al.firstAlarmHour / (H - 1)) * 100}%" title="First alarm ${s.tag}">&#9650;</span>`);
  });
  m.innerHTML = parts.join('');
}

// ---------- charts ----------
const charts = {};
function renderCharts() {
  const cw = (id) => $(id);
  // stop rate per day
  const dayLabel = (d) => fmtDate(d * 24, false);
  const rateMarkers = ST.map((s, i) => ({ s, i, al: data.alarms[i] })).filter((x) => x.al.firstAlarmHour != null).map((x) => ({ i: x.al.firstAlarmHour / 24, v: data.dailyRate[x.i][Math.min(DAYS - 1, Math.floor(x.al.firstAlarmHour / 24))], color: SERIES[x.i], label: '' }));
  charts.rate = lineChart({
    host: cw('#ch-rate'),
    series: ST.map((s, i) => ({ name: SHORT[s.asset], color: SERIES[i], values: data.dailyRate[i], labelEnd: true })),
    n: DAYS,
    xTick: dayLabel,
    xEvery: 4,
    yTitle: 'stops per hour',
    yMax: 8,
    yTicks: [0, 2, 4, 6, 8],
    aria: 'Daily micro-stop rate per station',
    tipRows: (i) => ({ title: dayLabel(i) + ` (day ${i + 1})`, rows: ST.map((s, k) => ({ name: SHORT[s.asset], color: SERIES[k], text: data.dailyRate[k][i].toFixed(2) + '/h' })) }),
    onCursor: (i) => { cursor = Math.min(H - 1, i * 24 + 12); applyCursor(); },
    extra: (svg, sx, sy) => {
      ST.forEach((s, k) => {
        const h = data.alarms[k].firstAlarmHour;
        if (h == null) return;
        const x = sx(h / 24);
        const y = sy(data.dailyRate[k][Math.min(DAYS - 1, Math.floor(h / 24))]);
        const tri = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tri.setAttribute('d', `M${x} ${y - 14} l6 11 h-12 Z`);
        tri.setAttribute('fill', SERIES[k]);
        tri.setAttribute('stroke', '#0b0b0b');
        tri.setAttribute('stroke-width', '1.2');
        svg.appendChild(tri);
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', x);
        t.setAttribute('y', y - 20);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('class', 'marker-label');
        t.textContent = 'alarm ' + SHORT[s.asset].toLowerCase();
        svg.appendChild(t);
      });
    },
  });
  $('#tb-rate').innerHTML = tableOf(['Day', ...ST.map((s) => SHORT[s.asset])], Array.from({ length: DAYS }, (_, d) => [dayLabel(d), ...ST.map((_, k) => data.dailyRate[k][d].toFixed(2))]));

  // vibration
  const vib = data.vib['2040-VT-202'];
  const med = vib.map((_, h) => vibMedianAt(vib, h));
  const total = Math.ceil(data.projection.failureDay * 24) + 24;
  const proj = Array(total).fill(null);
  const lastH = H - 1;
  const v0 = med[lastH];
  const fh = data.projection.failureDay * 24;
  const g = Math.log(data.vibZones.CD / v0) / (fh - lastH);
  for (let h = lastH; h < total; h++) proj[h] = Math.min(5.9, v0 * Math.exp(g * (h - lastH)));
  charts.vib = lineChart({
    host: cw('#ch-vib'),
    series: [
      { name: 'raw', color: '#2a78d6', values: [...vib, ...Array(total - H).fill(null)], width: 1, opacity: 0.45 },
      { name: '24 h median', color: '#2a78d6', values: [...med, ...Array(total - H).fill(null)], width: 2.5, labelEnd: false },
      { name: 'projection', color: '#2a78d6', values: proj, width: 2, dash: '6 5' },
    ],
    n: total,
    xTick: (i) => fmtDate(i, false),
    xEvery: 120,
    yTitle: 'mm/s RMS',
    yMax: 7,
    yTicks: [0, 1, 2, 3, 4, 5, 6, 7],
    bands: [
      { y0: 0, y1: data.vibZones.AB, cls: 'bA', label: 'A' },
      { y0: data.vibZones.AB, y1: data.vibZones.BC, cls: 'bB', label: 'B' },
      { y0: data.vibZones.BC, y1: data.vibZones.CD, cls: 'bC', label: 'C' },
      { y0: data.vibZones.CD, y1: 7, cls: 'bD', label: 'D' },
    ],
    rightPad: 40,
    aria: 'Vibration velocity of bearing 2040-BRG-202A against ISO zones',
    tipRows: (i) => ({ title: fmtDate(i), rows: [
      ...(i < H ? [{ name: 'Hourly', color: '#2a78d6', text: vib[i].toFixed(2) + ' mm/s' }, { name: '24 h median', color: '#2a78d6', text: med[i].toFixed(2) + ' mm/s' }] : [{ name: 'Projected', color: '#2a78d6', text: proj[i].toFixed(2) + ' mm/s' }]),
      { name: 'Zone', color: '#8a8e96', text: zoneOf(i < H ? med[i] : proj[i]) },
    ] }),
    onCursor: (i) => { if (i < H) { cursor = i; applyCursor(); } },
    extra: (svg, sx, sy) => {
      const x = sx(fh);
      const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', x - 6);
      tx.setAttribute('y', sy(4.5) - 8);
      tx.setAttribute('text-anchor', 'end');
      tx.setAttribute('class', 'marker-label');
      tx.textContent = `projected zone D crossing: day ${data.projection.failureDay.toFixed(1)}`;
      svg.appendChild(tx);
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', sx(H - 1)); ln.setAttribute('x2', sx(H - 1));
      ln.setAttribute('y1', sy(7)); ln.setAttribute('y2', sy(0));
      ln.setAttribute('stroke', '#8a8e96'); ln.setAttribute('stroke-dasharray', '2 3');
      svg.appendChild(ln);
    },
  });
  const rows = [];
  for (let d = 0; d < DAYS; d++) rows.push([dayLabel(d), vibMedianAt(vib, d * 24 + 23 > H - 1 ? H - 1 : d * 24 + 23).toFixed(2), zoneOf(vibMedianAt(vib, Math.min(H - 1, d * 24 + 23)))]);
  $('#tb-vib').innerHTML = tableOf(['Day', 'Median mm/s', 'Zone'], rows);

  // bands
  const names = ['Captured by photoeye', 'Logged by operators'];
  const colors = ['#2a78d6', '#eb6834'];
  groupedBars({
    host: cw('#ch-bands'),
    cats: data.bands.map((b) => ({ label: b.label, values: [b.hoursCaptured, b.hoursLogged], tip: [`${b.hoursCaptured.toFixed(1)} h in ${b.captured.toLocaleString()} stops`, `${b.hoursLogged.toFixed(1)} h in ${b.logged.toLocaleString()} stops (${pct(b.logged / b.captured)})`] })),
    colors,
    names,
    aria: 'Hours of stop time captured and logged by duration band',
  });
  $('#lg-bands').innerHTML = names.map((n, i) => `<span><span class="sw" style="background:${colors[i]}"></span>${n}</span>`).join('') + '<span>Hours of stop time</span>';
  $('#tb-bands').innerHTML = tableOf(['Duration', 'Stops captured', 'Stops logged', 'Hours captured', 'Hours logged'], data.bands.map((b) => [b.label, b.captured.toLocaleString(), b.logged.toLocaleString(), b.hoursCaptured.toFixed(1), b.hoursLogged.toFixed(1)]));

  // loss tree
  const lt = data.kpi.lossTree_h;
  const items = [
    { short: 'Stops logged', label: 'Stops operators logged', v: lt.loggedStops, color: '#2a78d6' },
    { short: 'Stops never logged', label: 'Stops never logged', v: lt.unloggedStops, color: '#eb6834' },
    { short: 'Speed', label: 'Speed loss', v: lt.speed, color: '#1baf7a' },
    { short: 'Quality', label: 'Quality loss', v: lt.quality, color: '#eda100' },
  ];
  stackBar({ host: cw('#ch-loss'), items, aria: 'Lost production time by cause' });
  $('#lg-loss').innerHTML = items.map((n) => `<span><span class="sw" style="background:${n.color}"></span>${n.label}: ${n.v.toFixed(1)} h</span>`).join('');
  const r = data.kpi.reported;
  $('#oee-note').innerHTML = `Reported OEE ${pct(r.oee, 1)} (availability ${pct(r.a, 1)}, performance ${pct(r.p, 1)}, quality ${pct(r.q, 1)}). ${pct(data.kpi.hiddenInPerformance)} of the unlogged stop time lands in the performance bucket, where it looks like slow running instead of stopping.`;
  applyCursor();
}
function vibMedianAt(v, h) {
  const a = Math.max(0, h - 23);
  const w = v.slice(a, h + 1).sort((x, y) => x - y);
  return w[Math.floor(w.length / 2)];
}
function tableOf(head, rows) {
  return `<div class="table-scroll"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// ---------- detector table ----------
const TARGETS = { fa: 1, lead7: 0.8, h0: 0.8, cls: 0.85, act: 0.75 };
const VNAME = {
  v0: 'v0 Logged counts, CUSUM',
  v1: 'v1 Auto-capture, Poisson CUSUM',
  v2: 'v2 + dispersion, per-shift baseline',
  v3: 'v3 Daily buckets, 7 day baseline',
  v4: 'v4 Calibrated threshold, spot check',
  v5: 'v5 + chronic level detector',
  v6: 'v6 Trend-confirmed classification',
};
function renderDetectTable() {
  const S = data.montecarlo.summary;
  const cell = (v, ok, f) => (v == null ? '<td>n/a</td>' : `<td class="${ok ? 'ok' : 'no'}">${f(v)}</td>`);
  const rows = Object.keys(S).map((k) => {
    const s = S[k];
    const c = s.classification;
    return `<tr class="${k === 'v6' ? 'final' : ''}"><td>${VNAME[k]}</td>
      ${cell(s.falseAlarmsPerStationYear, s.falseAlarmsPerStationYear <= TARGETS.fa, (v) => v.toFixed(2))}
      <td>${s.h1LeadDaysMedian.toFixed(1)}</td>
      ${cell(s.h1LeadAtLeast7d, s.h1LeadAtLeast7d >= TARGETS.lead7, (v) => pct(v))}
      ${cell(s.h0ClusterDetectionRate, s.h0ClusterDetectionRate >= TARGETS.h0, (v) => pct(v))}
      ${c ? cell(Math.min(c.h1CorrectlyMechanical, c.h0CorrectlyNonMechanical), Math.min(c.h1CorrectlyMechanical, c.h0CorrectlyNonMechanical) >= TARGETS.cls, (v) => pct(v)) : '<td>n/a</td>'}
      ${c ? cell(c.h1ActionableAtLeast5d, c.h1ActionableAtLeast5d >= TARGETS.act, (v) => pct(v)) : '<td>n/a</td>'}
    </tr>`;
  });
  $('#tb-detect').innerHTML = `<thead><tr><th>Version</th><th>False alarms per station-year (target ≤ 1)</th><th>Median lead, days</th><th>Lead ≥ 7 d (target ≥ 80%)</th><th>Chronic cluster found (target ≥ 80%)</th><th>Cause classified right (target ≥ 85%)</th><th>Actionable lead ≥ 5 d (target ≥ 75%)</th></tr></thead><tbody>${rows.join('')}</tbody>`;
}

function renderEcon() {
  const e = data.economics;
  $('#econ').innerHTML = `<div>
    <h3>What the hidden stops cost, in lost margin only</h3>
    <div class="big">${usd(e.lostMarginMicroStopsWindowUSD)}</div>
    <p>Margin lost to ${e.microStopHoursInWindow.toFixed(0)} h of stops in 21 days at ${usd(e.marginPerHourUSD)} per line-hour, of which ${e.unloggedHoursInWindow.toFixed(0)} h were never logged. The rate is an illustrative default taken from a published worked example, so replace it with your own contribution margin.</p>
  </div>
  <div class="case">
    <div><span>Bearing failure, unplanned</span><b>${e.bearingFailure.unplannedHours} h</b></div>
    <div><span>Planned replacement (assumed)</span><b>${e.bearingFailure.plannedReplacementHours} h</b></div>
    <div><span>Hours avoided</span><b>${e.avoidedHours} h</b></div>
    <div><span>Avoided at ${usd(e.marginPerHourUSD)}/h</span><b>${usd(e.avoidedLostMarginUSD.at875)}</b></div>
    <div><span>Avoided at $14,167/h</span><b>${usd(e.avoidedLostMarginUSD.at14167)}</b></div>
    <div><span>Avoided at $36,000/h</span><b>${usd(e.avoidedLostMarginUSD.at36000)}</b></div>
    <p style="margin-top:8px;font-size:12px">${e.note}</p>
  </div>`;
}

function renderMethod() {
  const v6 = data.montecarlo.summary.v6;
  $('#method').innerHTML = `
  <div class="card"><h3>How the data is made</h3><p>A seeded simulator generates photoeye stops as a non-homogeneous Poisson process with day-to-day overdispersion and a night factor. Durations are lognormal, clipped to 2 to 600 s. Operators log a stop with a probability that rises with its length. Bearing wear grows vibration exponentially and raises the stop rate on its station.</p></div>
  <div class="card"><h3>How the alarm works</h3><ul><li>Poisson CUSUM on daily counts against a 7 day baseline.</li><li>A level detector for clusters that start before the baseline settles: 7 day mean at least 1.8 times design rate.</li><li>Trend test: mechanical only if both later ratios clear 1.2 and 1.6 and keep rising.</li></ul></div>
  <div class="card"><h3>Result on the benchmark</h3><p>v6 raised ${pct(v6.h1LeadAtLeast7d)} of wear runs 7 or more days ahead, at ${v6.falseAlarmsPerStationYear.toFixed(2)} false alarms per station-year, and classified the cause right ${pct(Math.min(v6.classification.h1CorrectlyMechanical, v6.classification.h0CorrectlyNonMechanical))} of the time. A fixed vibration threshold also detects ${pct(v6.vibrationThreshold.h1DetectionRate)} but needs the sensor.</p></div>
  <div class="card"><h3>Where it misses</h3><ul><li>Actionable lead of 5 days or more was reached in ${pct(v6.classification.h1ActionableAtLeast5d)} of runs against the 75% target.</li><li>Slow wear (g = 0.03) is classified mechanical in only 56% of runs.</li><li>Fast wear (g = 0.12) leaves a median 5.5 days of lead and none reaches 7.</li><li>Chronic clusters at 1.3 times design are found in 67% of runs.</li></ul></div>
  <div class="card"><h3>Why this is not proof</h3><p>The test data comes from the same family of models the detector assumes, so the benchmark measures consistency, not field accuracy. Real plants add load steps, temperature drift, shift handovers and sensor faults. Treat the numbers as the target for a pilot on real photoeye and vibration exports.</p></div>
  <div class="card"><h3>Reproduce it</h3><ul><li><code>node sim/run.mjs</code> rebuilds every data file for seed 2040.</li><li><code>node --test test/sim.test.mjs</code> runs 9 tests.</li><li><code>npm run build</code> bundles this page.</li><li>Docs 01 to 05 hold research, definition, analysis, solution and synthesis.</li></ul></div>`;
}

// ---------- init ----------
renderKpis();
renderScrubMarks();
renderDetectTable();
renderEcon();
renderMethod();
renderCharts();
let rz;
addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(renderCharts, 150);
});
const params = new URLSearchParams(location.search);
if (params.has('t')) cursor = Math.max(0, Math.min(H - 1, +params.get('t')));
if (params.has('sel')) select(params.get('sel'));
applyCursor();
if (!reduce && !params.has('t')) setTimeout(() => setPlay(true), 1200);
window.__app = { select, setCursor: (h) => { cursor = h; applyCursor(); }, plant };

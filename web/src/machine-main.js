import results from '../../data/results.json';
import fmea from '../../data/fmea.json';
import machine from '../../data/machine.json';
import { shaftHz, beltSpeed, bearingFreqs, spectrum } from '../../sim/spectrum.mjs';
import { createMachine } from './machine3d.js';
import { lineChart, groupedBars } from './charts.js';

const $ = (s) => document.querySelector(s);
const H = results.meta.hours;
const startMs = Date.parse(results.meta.startUTC);
const vib = results.vib['2040-VT-202'];
const zones = results.vibZones;
const rows = fmea.rows.map((r) => ({ ...r, rpnNow: r.S * r.O * r.D_now, rpnTwin: r.S * r.O * r.D_twin }));
const COMP_NAME = {
  '2040-BRG-202A': 'Drive end bearing', '2040-BRG-202B': 'Non-drive end bearing', '2040-SHF-202': 'Head shaft and drum', '2040-GBX-202': 'Gearbox',
  '2040-MTR-202': 'Motor', '2040-BLT-202': 'Belt', '2040-FRM-202': 'Frame and torque arm', '2040-VT-202': 'Vibration transmitter', '2040-ZS-202': 'Photoeye', '2040-GRD-202': 'Nip guard',
};
const SHORT = {
  F01: 'Bearing fatigue spalling', F02: 'Lubricant starvation', F03: 'NDE bearing corrosion', F04: 'Block misalignment', F05: 'Gear wear, oil loss', F06: 'Motor overheating',
  F07: 'Belt mistracking', F08: 'Loose fasteners', F09: 'Transmitter drift', F10: 'Photoeye dirty lens', F11: 'Guard open (safety)',
};
const level = (rpn, s) => (s >= 9 || rpn >= 200 ? 2 : rpn >= 100 ? 1 : 0);
const LV = ['Low', 'Medium', 'High'];
const fmtDate = (h) => {
  const d = new Date(startMs + h * 3600000);
  return `${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:00`;
};
const med24 = (h) => {
  const w = vib.slice(Math.max(0, h - 23), h + 1).sort((a, b) => a - b);
  return w[Math.floor(w.length / 2)];
};
const v0 = [...vib.slice(0, 48)].sort((a, b) => a - b)[24];
const zoneLetter = (v) => (v < zones.AB ? 'A' : v < zones.BC ? 'B' : v < zones.CD ? 'C' : 'D');
const zoneIdx = (v) => (v < zones.BC ? 0 : v < zones.CD ? 1 : 2);

let cursor = H - 1;
let basis = 'now';
let selected = null;
let calcBearing = 0;
const calcState = machine.bearings.map((b) => ({ ...b.geometry, rpm: shaftHz(machine.drive, b.shaft) * 60 }));

const compRows = (id) => rows.filter((r) => r.component === id);
const rpnOf = (r) => (basis === 'now' ? r.rpnNow : r.rpnTwin);
const dOf = (r) => (basis === 'now' ? r.D_now : r.D_twin);
function compInfo(id) {
  const rs = compRows(id);
  if (!rs.length) return { level: 0, text: '', max: 0 };
  const top = rs.reduce((a, b) => (rpnOf(b) > rpnOf(a) ? b : a));
  const lv = Math.max(...rs.map((r) => level(rpnOf(r), r.S)));
  return { level: lv, text: `RPN ${rpnOf(top)}${top.S >= 9 ? ' · S10' : ''}`, max: rpnOf(top), top };
}

// ---------- 3D ----------
let m3d = null;
try {
  m3d = createMachine($('#viewport'), {
    onSelect: (id) => select(id),
    geometry: machine.bearings[0].geometry,
    ratios: bearingFreqs(machine.bearings[0].geometry, 1),
  });
} catch (e) {
  $('#viewport').innerHTML = '<p style="padding:24px;color:#52514e">The 3D view needs WebGL, which this browser could not start. The FMEA and charts below still work.</p>';
  console.error(e);
}

function allChipInfo() {
  const o = {};
  Object.keys(COMP_NAME).forEach((id) => (o[id] = compInfo(id)));
  return o;
}

// ---------- panel ----------
function renderKpis() {
  const v = med24(cursor);
  const left = results.projection.failureDay - cursor / 24;
  const top = rows.reduce((a, b) => (rpnOf(b) > rpnOf(a) ? b : a));
  const other = rows.reduce((a, b) => ((basis === 'now' ? b.rpnTwin : b.rpnNow) > (basis === 'now' ? a.rpnTwin : a.rpnNow) ? b : a));
  $('#kpis').innerHTML = [
    [`${v.toFixed(2)} mm/s`, `Vibration, 24 h median (zone ${zoneLetter(v)})`],
    [`${(v / v0).toFixed(1)}x`, 'Wear ratio against the healthy baseline'],
    [left > 0 ? `${left.toFixed(1)} d` : 'passed', 'To projected zone D crossing'],
    [`${rpnOf(top)}`, `Top RPN, ${basis === 'now' ? 'today' : 'with twin'} (${basis === 'now' ? 'twin: ' + other.rpnTwin : 'today: ' + other.rpnNow})`],
  ].map(([a, b]) => `<div class="kpi"><b>${a}</b><span>${b}</span></div>`).join('');
}
function renderComponents() {
  const ids = Object.keys(COMP_NAME).sort((a, b) => compInfo(b).max - compInfo(a).max);
  $('#components').innerHTML = ids.map((id) => {
    const c = compInfo(id);
    const ov = c.top && c.top.S >= 9;
    return `<li><button type="button" class="finding${selected === id ? ' selected' : ''}" data-id="${id}">
      <span class="chip c${c.level}">${LV[c.level]}${ov ? ' · S10' : ''}</span>
      <span class="nm">${COMP_NAME[id]}<small>${id}</small></span>
      <span class="rt">${c.max}<small>RPN</small></span></button></li>`;
  }).join('');
}
function renderDetail() {
  const box = $('#detail');
  if (!selected) {
    box.innerHTML = '<p style="color:var(--text-secondary)">Select a part in the 3D view or from the list to see its failure modes, ratings and recommended actions.</p>';
    return;
  }
  const rs = compRows(selected);
  box.innerHTML = `<h3>${COMP_NAME[selected]}</h3><div class="tagline">${selected}</div>` + rs.map((r) => {
    const lv = level(rpnOf(r), r.S);
    return `<div class="fm"><b>${r.id} · ${r.mode}</b>
      <div class="sod">S ${r.S} · O ${r.O} · D ${dOf(r)} · RPN ${rpnOf(r)} <span class="pri p${lv}">${LV[lv]}</span></div>
      <p><b>Effect:</b> ${r.effect}.</p><p><b>Cause:</b> ${r.cause}.</p>
      <p><b>Signal:</b> ${r.signal}.</p><p><b>Action:</b> ${r.action}.</p>
      <p style="font-size:11.5px">ISO 15243 class: ${r.iso15243}</p></div>`;
  }).join('');
  if (selected === '2040-BRG-202A') {
    const w = med24(cursor) / v0;
    box.innerHTML += `<p style="margin-top:8px">Inspector: spall size follows the wear ratio (${w.toFixed(1)}x now). Each flash is a rolling element passing the defect, at the BPFO rate.</p>`;
  }
}
function apply() {
  const v = med24(cursor);
  m3d && m3d.setState({ wear: v / v0, zone: zoneIdx(v), chipInfo: allChipInfo() });
  renderKpis();
  renderComponents();
  renderDetail();
  $('#clock').textContent = `${fmtDate(cursor)} UTC · day ${Math.floor(cursor / 24) + 1} of ${results.meta.days}`;
  $('#scrub').value = cursor;
  drawSpectrum();
}
function select(id) {
  selected = selected === id ? null : id;
  m3d && m3d.select(selected);
  apply();
}
$('#components').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (b) select(b.dataset.id);
});
$('#btn-whole').addEventListener('click', () => {
  selected = null;
  m3d && m3d.select(null);
  apply();
});
$('#btn-xray').addEventListener('click', (e) => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', String(on));
  m3d && m3d.setXray(on);
});
$('#btn-labels').addEventListener('click', (e) => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', String(on));
  m3d && m3d.setLabels(on);
});
$('#explode').addEventListener('input', (e) => m3d && m3d.setExplode(+e.target.value / 100));
$('#btn-glb').addEventListener('click', async () => {
  if (!m3d) return;
  const buf = await m3d.exportGLB();
  download(new Blob([buf], { type: 'model/gltf-binary' }), '2040-cnv-202-drive-unit.glb');
});
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const setBasis = (b) => {
  basis = b;
  $('#basis-now').setAttribute('aria-pressed', String(b === 'now'));
  $('#basis-twin').setAttribute('aria-pressed', String(b === 'twin'));
  apply();
};
$('#basis-now').addEventListener('click', () => setBasis('now'));
$('#basis-twin').addEventListener('click', () => setBasis('twin'));

// ---------- timeline ----------
$('#scrub').addEventListener('input', (e) => {
  cursor = +e.target.value;
  apply();
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
      cursor = Math.min(H - 1, cursor + 3);
      apply();
      if (cursor >= H - 1) setPlay(false);
    }, 90);
  }
}
playBtn.addEventListener('click', () => setPlay(playBtn.getAttribute('aria-pressed') !== 'true'));
{
  const marks = [];
  for (let d = 0; d < results.meta.days; d += 5) marks.push(`<span class="tick${d === 0 ? ' first' : ''}" style="left:${((d * 24) / (H - 1)) * 100}%">${fmtDate(d * 24).slice(0, 6)}</span>`);
  $('#scrub-marks').innerHTML = marks.join('');
}

// ---------- charts ----------
function renderRpn() {
  const sorted = [...rows].sort((a, b) => b.rpnNow - a.rpnNow);
  groupedBars({
    host: $('#ch-rpn'),
    cats: sorted.map((r) => ({ label: `${r.id} ${SHORT[r.id]}`, values: [r.rpnNow, r.rpnTwin], tip: [`RPN ${r.rpnNow} (S${r.S} O${r.O} D${r.D_now})`, `RPN ${r.rpnTwin} (S${r.S} O${r.O} D${r.D_twin})`] })),
    colors: ['#eb6834', '#2a78d6'],
    names: ['Today', 'With twin monitoring'],
    left: 176,
    rowH: 38,
    aria: 'RPN by failure mode, today versus with twin monitoring',
  });
  $('#lg-rpn').innerHTML = '<span><span class="sw" style="background:#eb6834"></span>Today (rounds and trips)</span><span><span class="sw" style="background:#2a78d6"></span>With twin monitoring</span><span>Higher is worse</span>';
  $('#tb-rpn').innerHTML = table(['Mode', 'S', 'O', 'D today', 'D twin', 'RPN today', 'RPN twin'], sorted.map((r) => [`${r.id} ${SHORT[r.id]}`, r.S, r.O, r.D_now, r.D_twin, r.rpnNow, r.rpnTwin]));
}
function table(head, body) {
  return `<div class="table-scroll"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function drawSpectrum() {
  const b = machine.bearings[calcBearing];
  const cs = calcState[calcBearing];
  const fr = cs.rpm / 60;
  const q = bearingFreqs(cs, fr);
  const wear = b.shaft === 'head' ? med24(cursor) / v0 : 1;
  const fMax = b.shaft === 'head' ? 20 : 200;
  const bins = 400;
  const sp = spectrum({ fr, freqs: q, wear, fMax, bins, seed: 11 });
  const marks = [['1X', fr], ['BPFO', q.bpfo], ['BPFI', q.bpfi], ['BSF', q.bsf], ['FTF', q.ftf]].filter(([, f]) => f < fMax * 0.97);
    lineChart({
    host: $('#ch-spec'),
    series: [{ name: 'velocity', color: '#2a78d6', values: sp.a, width: 1.6 }],
    n: bins + 1,
    xTick: (i) => `${((i / bins) * fMax).toFixed(0)}`,
    xEvery: Math.round(bins / (fMax === 20 ? 4 : 8)),
    yTitle: 'mm/s',
    rightPad: 14,
    height: 250,
    aria: `Illustrative velocity spectrum for ${b.tag}`,
    tipRows: (i) => ({ title: `${((i / bins) * fMax).toFixed(1)} Hz`, rows: [{ name: 'Velocity', color: '#2a78d6', text: sp.a[i].toFixed(3) + ' mm/s' }] }),
    extra: (svg, sx, sy, g) => {
      const NS = 'http://www.w3.org/2000/svg';
      marks.forEach(([n, f], k) => {
        const x = sx((f / fMax) * bins);
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', g.m.t); l.setAttribute('y2', g.m.t + g.ih);
        l.setAttribute('stroke', n === 'BPFO' ? '#d03b3b' : '#8a8e96'); l.setAttribute('stroke-dasharray', '4 3'); l.setAttribute('stroke-width', n === 'BPFO' ? 1.6 : 1);
        svg.appendChild(l);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x + 3); t.setAttribute('y', g.m.t + 11 + k * 12); t.setAttribute('class', 'marker-label');
        t.textContent = `${n} ${f.toFixed(1)}`;
        svg.appendChild(t);
      });
      if (b.shaft === 'head') {
        const x = sx((10 / fMax) * bins);
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', g.m.t + 76); l.setAttribute('y2', g.m.t + g.ih);
        l.setAttribute('stroke', '#0b0b0b'); l.setAttribute('stroke-width', 1.5);
        svg.appendChild(l);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x + 4); t.setAttribute('y', g.m.t + 88); t.setAttribute('class', 'marker-label');
        t.textContent = '10 Hz: lower edge of the usual ISO band';
        svg.appendChild(t);
      }
    },
  });
  $('#sp-sub').textContent = `${b.label}, shaft ${cs.rpm.toFixed(0)} rpm (${fr.toFixed(2)} Hz). Wear ratio ${wear.toFixed(1)}x at ${fmtDate(cursor)}. Synthetic spectrum, for illustration.`;
  $('#tb-freq').innerHTML = table(['Frequency', 'Multiple of 1X', 'Hz'], [['1X shaft', '1.000', fr.toFixed(3)], ['BPFO outer race', (q.bpfo / fr).toFixed(3), q.bpfo.toFixed(2)], ['BPFI inner race', (q.bpfi / fr).toFixed(3), q.bpfi.toFixed(2)], ['BSF ball spin', (q.bsf / fr).toFixed(3), q.bsf.toFixed(2)], ['FTF cage', (q.ftf / fr).toFixed(3), q.ftf.toFixed(2)]]) + `<p class="note">Geometry: ${b.geometrySource}.</p>`;
}
function renderSpecPick() {
  $('#sp-pick').innerHTML = machine.bearings.map((b, i) => `<button type="button" data-b="${i}" aria-pressed="${i === calcBearing}">${b.tag.replace('2040-', '')}</button>`).join('');
  renderCalc();
}
$('#sp-pick').addEventListener('click', (e) => {
  const b = e.target.closest('[data-b]');
  if (!b) return;
  calcBearing = +b.dataset.b;
  renderSpecPick();
  drawSpectrum();
});
function renderCalc() {
  const c = calcState[calcBearing];
  const f = (k, label, step) => `<label>${label}<input type="number" step="${step}" data-k="${k}" value="${c[k]}"></label>`;
  $('#calc').innerHTML = f('N', 'Rolling elements', 1) + f('ballDiameterMm', 'Ball dia, mm', 0.01) + f('pitchDiameterMm', 'Pitch dia, mm', 0.01) + f('contactAngleDeg', 'Contact angle, deg', 1) + f('rpm', 'Shaft rpm', 1);
}
$('#calc').addEventListener('input', (e) => {
  const k = e.target.dataset.k;
  const v = parseFloat(e.target.value);
  if (k && v > 0 || k === 'contactAngleDeg') {
    calcState[calcBearing][k] = v;
    drawSpectrum();
  }
});
$('#calc').addEventListener('submit', (e) => e.preventDefault());

function renderCallout() {
  const head = machine.bearings[0];
  const fr = shaftHz(machine.drive, 'head');
  const q = bearingFreqs(head.geometry, fr);
  const motor = machine.bearings[1];
  const qm = bearingFreqs(motor.geometry, shaftHz(machine.drive, 'motor'));
  $('#callout').innerHTML = `<b>Finding: the monitored bearing turns too slowly for vibration alone.</b> The head shaft runs at ${(fr * 60).toFixed(0)} rpm (motor ${machine.drive.motorRpm} rpm over a ${machine.drive.gearRatio}:1 gearbox, ${machine.drive.drumDiameterM * 1000} mm drum, belt ${beltSpeed(machine.drive).toFixed(2)} m/s). Its outer-race defect frequency is ${q.bpfo.toFixed(1)} Hz, below the roughly 10 Hz where ISO 10816-style velocity bands start, while the motor bearing's is ${qm.bpfo.toFixed(0)} Hz. So the stop-rate signal does real work here, and a pilot should add acceleration with crest factor or envelope measurement on the head shaft, or monitor the gearbox input shaft too. The synthetic data in this repo uses velocity zones on the head bearing as a simplification.`;
}

function renderFmeaTable() {
  $('#fmea-note').textContent = `${fmea.method} ${fmea.ratingsOwner} ${fmea.detectionNote}`;
  $('#tb-fmea').innerHTML = `<thead><tr><th>ID</th><th>Part</th><th>Failure mode (ISO 15243 class)</th><th>Effect</th><th>Cause</th><th class="n">S</th><th class="n">O</th><th class="n">D now</th><th class="n">D twin</th><th class="n">RPN now</th><th class="n">RPN twin</th><th>Priority now</th><th>Action</th></tr></thead><tbody>` +
    [...rows].sort((a, b) => b.rpnNow - a.rpnNow).map((r) => {
      const lv = level(r.rpnNow, r.S);
      return `<tr class="${r.S >= 9 ? 'ov' : ''}"><td>${r.id}</td><td>${r.part}<br><small>${r.component}</small></td><td>${r.mode}<br><small>${r.iso15243}</small></td><td>${r.effect}</td><td>${r.cause}</td><td class="n">${r.S}</td><td class="n">${r.O}</td><td class="n">${r.D_now}</td><td class="n">${r.D_twin}</td><td class="n">${r.rpnNow}</td><td class="n">${r.rpnTwin}</td><td><span class="pri p${lv}">${LV[lv]}${r.S >= 9 ? ' (severity)' : ''}</span></td><td>${r.action}</td></tr>`;
    }).join('') + '</tbody>';
}
$('#btn-csv').addEventListener('click', () => {
  const head = ['id', 'component', 'part', 'mode', 'iso15243', 'effect', 'cause', 'controlsNow', 'signal', 'S', 'O', 'D_now', 'D_twin', 'RPN_now', 'RPN_twin', 'action'];
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [head.join(',')].concat(rows.map((r) => head.map((k) => q(k === 'RPN_now' ? r.rpnNow : k === 'RPN_twin' ? r.rpnTwin : r[k])).join(',')));
  download(new Blob([lines.join('\n')], { type: 'text/csv' }), 'fmea-2040-cnv-202.csv');
});

function renderMethod() {
  const top = [...rows].sort((a, b) => b.rpnNow - a.rpnNow).slice(0, 2);
  const sumNow = rows.reduce((a, r) => a + r.rpnNow, 0);
  const sumTwin = rows.reduce((a, r) => a + r.rpnTwin, 0);
  $('#method').innerHTML = `
  <div class="card"><h3>What the twin contains</h3><p>Frame and torque arm, head shaft and drum, two pillow block bearings, shaft-mounted gearbox, motor, belt, nip guard, vibration transmitter and photoeye, all as separate parts so they explode and export as one GLB. The inspector shows the drive-end bearing half-sectioned with ${machine.bearings[0].geometry.N} balls.</p></div>
  <div class="card"><h3>Reading the FMEA</h3><ul><li>The two highest failure modes today are ${top.map((t) => `${t.id} (${t.rpnNow})`).join(' and ')}, both on the drive end bearing.</li><li>Total RPN falls from ${sumNow} to ${sumTwin} (${(((sumNow - sumTwin) / sumNow) * 100).toFixed(0)}%) only because detection scores improve; severity and occurrence do not change.</li><li>F11 (guard open) has severity 10 and a low RPN of 80, so it is flagged by severity, not by RPN.</li></ul></div>
  <div class="card"><h3>What the twin changes</h3><p>Where a signal exists (stop rate, vibration), the detection score drops, which lowers RPN. Gearbox and motor rows keep their scores, because this model has no current, temperature or oil signal for them. Adding those is the next increment.</p></div>
  <div class="card"><h3>Limits</h3><ul><li>Ratings are a draft by one author. A team must re-rate with plant history.</li><li>RPN is used for ranking, with a severity override. The AIAG-VDA Action Priority table is not reproduced.</li><li>Bearing geometry is assumed or example data.</li><li>The spectrum is synthetic and only shows where lines would sit.</li></ul></div>
  <div class="card"><h3>Standards used</h3><ul><li>ISO 15243: failure-mode categories for rolling bearings.</li><li>AIAG-VDA FMEA 2019: severity-first prioritisation idea.</li><li>Kinematic bearing frequency formulas (BPFO, BPFI, BSF, FTF).</li></ul></div>
  <div class="card"><h3>Reproduce</h3><ul><li><code>node --test test/sim.test.mjs test/spectrum.test.mjs</code></li><li><code>npm run build</code> bundles both pages.</li><li>Edit <code>data/fmea.json</code> or <code>data/machine.json</code> and rebuild.</li></ul></div>`;
}

renderSpecPick();
renderRpn();
renderCallout();
renderFmeaTable();
renderMethod();
const params = new URLSearchParams(location.search);
if (params.has('t')) cursor = Math.max(0, Math.min(H - 1, +params.get('t')));
if (params.get('basis') === 'twin') setBasis('twin');
apply();
if (params.has('sel')) select(params.get('sel'));
if (params.has('explode')) {
  $('#explode').value = params.get('explode');
  m3d && m3d.setExplode(+params.get('explode') / 100);
}
let rz;
addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => {
    renderRpn();
    drawSpectrum();
  }, 150);
});
window.__machine = { select, setCursor: (h) => { cursor = h; apply(); }, m3d };

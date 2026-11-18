import test from 'node:test';
import assert from 'node:assert/strict';
import { bearingFreqs, spectrum, shaftHz, beltSpeed } from '../sim/spectrum.mjs';
import fs from 'node:fs';

const G6205 = { N: 9, ballDiameterMm: 7.94, pitchDiameterMm: 39.04, contactAngleDeg: 0 };

test('6205 example multipliers match the published values', () => {
  const q = bearingFreqs(G6205, 30);
  assert.ok(Math.abs(q.ftf / 30 - 0.398) < 0.002);
  assert.ok(Math.abs(q.bsf / 30 - 2.357) < 0.01);
});

test('identities: BPFO + BPFI = N x fr and BPFO = N x FTF', () => {
  const q = bearingFreqs(G6205, 24.17);
  assert.ok(Math.abs(q.bpfo + q.bpfi - 9 * 24.17) < 1e-9);
  assert.ok(Math.abs(q.bpfo - 9 * q.ftf) < 1e-9);
});

test('drive: head shaft speed and belt speed follow motor, ratio and drum', () => {
  const d = JSON.parse(fs.readFileSync(new URL('../data/machine.json', import.meta.url))).drive;
  assert.ok(Math.abs(shaftHz(d, 'head') * 60 - 69.05) < 0.05);
  assert.ok(Math.abs(beltSpeed(d) - 0.579) < 0.003);
});

test('spectrum: healthy has no BPFO peak, worn has one at BPFO', () => {
  const m = JSON.parse(fs.readFileSync(new URL('../data/machine.json', import.meta.url)));
  const fr = shaftHz(m.drive, 'head');
  const q = bearingFreqs(m.bearings[0].geometry, fr);
  const at = (s, hz) => s.a[Math.round(hz / (s.f[1] - s.f[0]))];
  const healthy = spectrum({ fr, freqs: q, wear: 1.0, fMax: 40, bins: 800, seed: 3 });
  const worn = spectrum({ fr, freqs: q, wear: 3.0, fMax: 40, bins: 800, seed: 3 });
  assert.ok(at(worn, q.bpfo) > 5 * at(healthy, q.bpfo));
});

test('FMEA: ratings in range, twin detection never worse, ids unique', () => {
  const f = JSON.parse(fs.readFileSync(new URL('../data/fmea.json', import.meta.url)));
  const ids = new Set();
  for (const r of f.rows) {
    for (const k of ['S', 'O', 'D_now', 'D_twin']) assert.ok(Number.isInteger(r[k]) && r[k] >= 1 && r[k] <= 10, `${r.id} ${k}`);
    assert.ok(r.D_twin <= r.D_now, r.id);
    assert.ok(!ids.has(r.id));
    ids.add(r.id);
  }
});

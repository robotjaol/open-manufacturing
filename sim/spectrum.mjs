// Bearing defect frequencies and an illustrative velocity spectrum.
// The formulas are the standard kinematic ones. The spectrum is synthetic and for display only.
import { rng } from './rng.mjs';

export function shaftHz(drive, shaft) {
  const motorHz = drive.motorRpm / 60;
  return shaft === 'motor' ? motorHz : motorHz / drive.gearRatio;
}

export function beltSpeed(drive) {
  const headHz = shaftHz(drive, 'head');
  return headHz * Math.PI * drive.drumDiameterM;
}

// g: { N, ballDiameterMm, pitchDiameterMm, contactAngleDeg }, fr: shaft speed in Hz
export function bearingFreqs(g, fr) {
  const r = (g.ballDiameterMm / g.pitchDiameterMm) * Math.cos((g.contactAngleDeg * Math.PI) / 180);
  return {
    fr,
    bpfo: (g.N / 2) * fr * (1 - r),
    bpfi: (g.N / 2) * fr * (1 + r),
    bsf: (g.pitchDiameterMm / (2 * g.ballDiameterMm)) * fr * (1 - r * r),
    ftf: 0.5 * fr * (1 - r),
  };
}

// wear is the vibration ratio v / v0 (1 = healthy). Returns { f: [], a: [] } in mm/s.
export function spectrum({ fr, freqs, wear, fMax, bins = 400, seed = 1 }) {
  const R = rng(seed);
  const df = fMax / bins;
  const f = Array.from({ length: bins + 1 }, (_, i) => i * df);
  const a = f.map((x) => 0.02 + 0.015 * Math.abs(R.normal()) + 0.04 / (1 + x)); // floor
  const peak = (hz, amp, width) => {
    for (let i = 0; i < f.length; i++) {
      const d = (f[i] - hz) / width;
      if (Math.abs(d) < 4) a[i] += amp * Math.exp(-0.5 * d * d);
    }
  };
  const w = Math.max(df * 1.2, fr * 0.02);
  peak(fr, 0.25, w);
  peak(2 * fr, 0.1, w);
  const excess = Math.max(0, wear - 1.2);
  if (excess > 0) {
    for (const h of [1, 2, 3]) peak(h * freqs.bpfo, (0.5 * excess) / h, w);
    peak(freqs.bpfo + fr, 0.18 * excess, w);
    peak(freqs.bpfo - fr, 0.18 * excess, w);
  }
  return { f, a };
}

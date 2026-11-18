// Plant registry for Line 2040 (secondary packaging, end of line).
// Tag syntax is inspired by ISA-5.1 instrument codes (ZS position switch, VT vibration
// transmitter) and common equipment classes (CNV, CPK, PAL, MTR, BRG, AGV).
// It is a naming convention for this repo, not a formally validated tag standard.

export const LINE = {
  id: '2040',
  name: 'Line 2040 secondary packaging',
  idealCycleS: 0.5, // seconds per pack at rated speed (120 packs/min)
  speedFactor: 0.97, // steady reduced-speed loss
  quality: 0.985, // first-pass yield
  plannedHoursPerDay: 23.25, // 24 h minus one 45 min changeover
  packsPerCase: 12,
};

// One photoeye (ZS) per monitored station. lambda0 = baseline micro-stops per hour.
export const STATIONS = [
  { i: 0, tag: '2040-ZS-201', asset: '2040-CNV-201', motor: '2040-MTR-201', name: 'Infeed conveyor', lambda0: 1.5 },
  { i: 1, tag: '2040-ZS-202', asset: '2040-CNV-202', motor: '2040-MTR-202', name: 'Transfer conveyor', lambda0: 1.0 },
  { i: 2, tag: '2040-ZS-301', asset: '2040-CPK-301', motor: '2040-MTR-301', name: 'Case packer infeed', lambda0: 2.0 },
  { i: 3, tag: '2040-ZS-401', asset: '2040-CNV-401', motor: '2040-MTR-401', name: 'Discharge conveyor', lambda0: 0.8 },
  { i: 4, tag: '2040-ZS-501', asset: '2040-PAL-501', motor: '2040-MTR-501', name: 'Palletizer infeed', lambda0: 1.2 },
];

// ISO 10816-1 style zone boundaries for Class I machines (up to about 15 kW), RMS velocity mm/s.
// Verify against ISO 20816-1 and the machine group of your own asset before using as limits.
export const VIB_ZONES = { AB: 0.71, BC: 1.8, CD: 4.5 };

// Micro-stop duration: lognormal, clipped. Breakdown: rare and long.
export const DUR = { median: 25, sigma: 0.8, min: 2, max: 600 };
export const BREAKDOWN = { perHour: 0.004, median: 900, sigma: 0.7 };

// Probability that an operator writes a stop into the manual log, by duration (s).
// Assumption informed by vendor claims that under 20% of sub-60 s stops are logged by hand.
export const logProbability = (d) => (d >= 300 ? 0.95 : d >= 60 ? 0.6 : d >= 10 ? 0.2 : 0.03);

// ISO 14224 style failure mode codes used in the exported CSV.
export const FAILURE_MODE = { micro: 'STP', breakdown: 'FTF', vibration: 'VIB' };

export const HOURS = (days) => days * 24;

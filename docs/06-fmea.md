# 06 FMEA and machine twin: 2040-CNV-202 head drive unit

The plant page found *where* to look. This stage builds the machine that is failing, a 3D twin of the transfer conveyor head drive, and asks a design-FMEA question about it.

## Why this machine

The simulated wear scenario sits on station 2040-ZS-202, the transfer conveyor. Its drive unit is a shaft-mounted gearmotor on a head shaft carried by two pillow block bearings. One bearing, 2040-BRG-202A, is the instrumented one (2040-VT-202).

## Method

- Ten components, eleven failure modes, ratings for severity (S), occurrence (O) and detection (D) on 1 to 10 scales, with 10 the worst.
- RPN = S x O x D is used to rank. Rows with S of 9 or more are flagged regardless of RPN. This follows the severity-first idea of the AIAG-VDA 2019 handbook, which replaced RPN with Action Priority. The Action Priority lookup table is not reproduced here, so this is not an AIAG-VDA FMEA.
- Bearing failure modes use the six ISO 15243 categories: rolling contact fatigue, wear, corrosion, electrical erosion, plastic deformation, fracture and cracking.
- Two detection columns: D_now assumes operator rounds and a trip. D_twin assumes the v6 stop-rate detector and a vibration transmitter are live. Rows the system cannot see (gearbox, motor, guard) keep the same D.

## Results (draft ratings)

| Rank | Failure mode | S | O | D now | D twin | RPN now | RPN twin |
|------|--------------|---|---|-------|--------|---------|----------|
| 1 | F02 Lubricant starvation (BRG-202A) | 7 | 6 | 6 | 4 | 252 | 168 |
| 2 | F01 Rolling contact fatigue (BRG-202A) | 7 | 5 | 7 | 3 | 245 | 105 |
| 3 | F03 Moisture corrosion (BRG-202B) | 6 | 4 | 7 | 5 | 168 | 120 |
| 4 | F04 Block misalignment | 6 | 4 | 6 | 4 | 144 | 96 |
| 4 | F08 Loose fasteners | 6 | 4 | 6 | 4 | 144 | 96 |
| 11 | F11 Guard open | 10 | 2 | 4 | 4 | 80 | 80 |

Total RPN over all 11 rows falls from 1,601 to 1,150 (28%), entirely from better detection. F11 has the lowest RPN but severity 10, so it is flagged by the severity rule, which is exactly the case RPN alone hides.

## Finding: the monitored bearing turns slowly

Assumed drive: motor 1,450 rpm, 21:1 gearbox, 160 mm drum.

| Shaft | Speed | BPFO |
|-------|-------|------|
| Head shaft (BRG-202A, assumed 6207-class geometry) | 69 rpm (1.15 Hz) | 4.1 Hz |
| Motor shaft (6205 example geometry) | 1,450 rpm (24.2 Hz) | 86.6 Hz |

The head bearing's outer-race defect frequency is about 4 Hz. That is below the roughly 10 Hz where ISO 10816-style velocity bands start (verify against ISO 20816-1), and a published low-speed bearing study found crest factor a better indicator than RMS at low speed. Consequences:

1. The stop-rate signal does real work for this bearing, not just as a cheap substitute.
2. A pilot should add acceleration with crest factor or envelope analysis on the head shaft, or monitor the gearbox input shaft as well.
3. The synthetic data in this repo applies velocity zones to the head bearing as a simplification. That is a limit of the model.

## Facts and sources

- Bearing defect frequencies: BPFO = (N/2) fr (1 - (d/D) cos a); BPFI = (N/2) fr (1 + (d/D) cos a); BSF = (D/2d) fr (1 - (d/D)^2 cos^2 a); FTF = (1/2) fr (1 - (d/D) cos a). Checks used in the tests: BPFO + BPFI = N fr, BPFO = N FTF, and the 6205 multipliers (FTF 0.398, BSF 2.357). Source type: condition-monitoring vendor article (Fabrico).
- ISO 15243 categories: SKF Evolution summary and standards catalogue entries.
- AIAG-VDA 2019: replaces RPN with Action Priority, severity first (AIAG release, Sphera and other summaries).
- Low-speed bearing damage detection: UTM engineering journal study (NTN N204 cylindrical roller bearing, artificial damage).

## Limits

- Ratings are the author's draft for a synthetic twin. A cross-functional team must re-rate them.
- The 6207-class geometry is assumed; the 6205 geometry is an example from a vendor article. Use the datasheet.
- The spectrum on the page is synthetic and only shows where lines would sit.
- The twin has no motor current, temperature or oil signal, so gearbox and motor rows do not improve.
- The 3D model is built from primitives and is not a manufacturer CAD model.

## Reproduce

`node --test test/sim.test.mjs test/spectrum.test.mjs`, edit `data/fmea.json` or `data/machine.json`, `npm run build`, open `web/machine.html`. `node scripts/export-glb.mjs` rewrites `models/2040-cnv-202-drive-unit.glb`.

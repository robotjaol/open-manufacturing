# 03 Analysis: specialist panel, three rounds

**Method note.** The "specialists" are six personas written by one language model. They are a structured way to argue against the work, not independent human experts. Each round ended with a measured change to the detector or the claims, and the numbers are from `data/montecarlo.json`, N = 300 runs per version.

Personas: statistician, lean/TPM lead, skeptic (validity), finance, controls engineer, safety.

## Iteration table (evaluation seeds 5000+)

| Version | Change | False alarms /station-yr | Median lead (d) | Lead >= 7 d | Chronic cluster found |
|---------|--------|--------------------------|-----------------|-------------|-----------------------|
| v0 | CUSUM on operator-logged counts | 12.84 | 15.5 | 96% | 71% |
| v1 | Auto-capture (every stop of 2 s or more), Poisson CUSUM | 23.19 | 16.8 | 98% | 93% |
| v2 | Dispersion term, per-shift baseline | 17.10 | 16.2 | 97% | 75% |
| v3 | Daily buckets, 7 day baseline, shared dispersion | 4.36 | 13.9 | 92% | 49% |
| v4 | Threshold h = 12 (calibrated), spot-check classification | 0.89 | 11.8 | 81% | 18% |
| v5 | Level detector: 7 day mean at least 1.8 x design rate | 0.89 | 14.7 | 95% | 100% |
| v6 | Trend-confirmed classification | 0.89 | 14.7 | 95% | 100% |

## Round 1: independent positions on v1

- Statistician: 23 false alarms per station-year is a variance problem. Counts are overdispersed; Poisson limits are too tight.
- Lean/TPM: chronic problems are not drift. A station that is bad from day 1 will never trigger a CUSUM whose baseline includes it.
- Skeptic: the generator and the detector share assumptions, so a good score proves little.
- Finance: show lost margin, but with a stated rate and a range.
- Controls: a 2 s capture threshold needs a debounce, or sensor flicker counts as stops.
- Safety: manual jam clearing must follow lockout rules; the dashboard must never suggest reaching into a running machine.

## Round 2: cross-critique

- Statistician vs Lean: both right. Fix 1 (v2, v3): model overdispersion and use daily buckets. Result: false alarms 23.2 to 4.4. Cost: chronic detection fell to 49%.
- Lean found the cause: the baseline contains the cluster. Fix 2 (v5): add a level detector against the design rate. Chronic detection 18% to 100%.
- Skeptic: calibrate h on separate seeds and add sensitivity runs. Fix 3 (v4): h = 12 from seeds 1000+, false alarms 0.89.
- Controls: debounce stays a field decision; documented as an assumption.
- Finance: rate is an input; three cases shown (875, 14,167, 36,000 USD per hour).

## Round 3: revised positions and residual disagreement

- Skeptic pushed a hard mode: a load step raises stop rate without wear. v5 then called 23 to 29% of those runs mechanical (correct non-mechanical fell to 71 to 77%). Fix 4 (v6): classify mechanical only if the ratio keeps rising (r2 >= 1.6, r1 >= 1.2, r2/r1 >= 1.15), waiting 24 h and rechecking at 120 h. Result: 98 to 100% correct again.
- The price of v6 is later action: actionable lead median 8.7 d versus 12.7 d, and 74% of runs reach 5 days against a 75% target. **This target is missed by 1 point.**
- Vote: 5 of 6 accept v6; the lean persona prefers v5 plus a human spot check. Not resolved.

## Sensitivity (v6, seeds 7000+, N = 150)

- Slow wear g = 0.03: only 56% classified mechanical.
- Fast wear g = 0.12: no run reaches 7 days of lead (median 5.5 d).
- Chronic multiplier 1.3: detected in 67% of runs.
- Day-to-day sigma 0.4 (double): false alarms about 1.8 per station-year, above target.

## Comparator

A fixed vibration threshold (6 h rolling median at 1.8 mm/s) detects 100% of wear runs with a median lead of 15.4 days, but needs a sensor and assumes no vibration change from load or temperature.

## Limitations

1. Synthetic data from the same family of models as the detector: circular validation.
2. Logging probabilities by duration are assumptions.
3. Standards content from secondary sources.
4. Panel personas are one model.

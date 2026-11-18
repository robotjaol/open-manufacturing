# 05 Synthesis

## Answer

Photoeye counts alone can warn of a wearing bearing about 14.7 days ahead (median) at 0.89 false alarms per station-year, and v6 separates wear from a feed cluster 98 to 100% of the time, on synthetic data. Four of the five pre-registered targets are met. Actionable lead of at least 5 days reaches 74% against a 75% target.

## What changed my mind

- Better statistics (overdispersion, daily buckets) cut false alarms 23.2 to 4.4 but broke chronic detection. The detector needed a different tool, not more tuning.
- A hard-mode scenario exposed that v5 mislabels load steps as wear. Fixing it cost 4 days of lead.

## What would change the conclusion

- Real logs showing the stop-rate to wear relationship is weaker than gamma between 1 and 1.8.
- Load or temperature effects on vibration that make the sensor comparator worse than assumed (or better).

## Decision for a team

Run v6 as an advisory only, beside operators, on one real line for 90 days. Compare against vibration spot checks. Keep the 5 day actionable-lead target; do not promise it from this benchmark.

## Open items

- Replace the synthetic logging probabilities with a measured time study.
- Re-check the ISO 20816-1 zone limits.
- Add motor current as a second signal.

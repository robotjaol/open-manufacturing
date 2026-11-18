# 02 Define

## Problem statement

On a secondary packaging line, stops shorter than 5 minutes are logged by operators only a small share of the time. Two consequences:

1. Loss attribution is wrong. Reported OEE equals true OEE (the identity A x P x Q holds either way), but the unlogged stop time lands in the performance bucket as "slow running".
2. A progressively failing bearing raises the micro-stop rate on its station days before vibration or a trip makes it visible.

## Question

Can photoeye stop counts alone, with no extra sensor, raise a trustworthy early warning of a wearing drive bearing, and tell wear apart from a feed or process cluster?

## Scope

In: one line, five photoeye stations, 21 day demo window, 60 day Monte Carlo runs. Out: root-cause of every stop, quality loss, energy, real data.

## Hypotheses

- H1: a wearing bearing raises the micro-stop rate on its station in proportion to (v/v0)^gamma, gamma between 1 and 1.8.
- H0 cluster: a feed or process problem raises the rate by 2 to 4 times without a vibration trend.

## Targets, fixed before any detector was run

| Metric | Target |
|--------|--------|
| False alarms | at most 1 per station-year |
| H1 alarm lead of at least 7 days | in at least 80% of runs |
| H0 chronic cluster detected | at least 80% |
| Cause classified correctly | at least 85% per class |
| Actionable lead of at least 5 days after classification | in at least 75% of H1 runs |

## Seed policy

Calibration seeds 1000+, evaluation seeds 5000+, sensitivity seeds 7000+. Thresholds were tuned on calibration seeds only.

## Standards alignment (not compliance)

ISO 22400-2 for OEE, ISO 14224 for failure-mode terms, ISO 10816-1 zones for vibration, ISA-5.1-style tags (ZS photoeye, VT vibration) with class prefixes CNV, CPK, PAL, MTR, BRG, AGV.

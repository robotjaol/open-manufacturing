# 01 Research: choosing the most specific problem

Goal: pick one manufacturing problem that is narrow enough to measure, costly enough to matter, and testable without private plant data.

## Candidates

| # | Candidate | Why it matters | Data needed | Open data available |
|---|-----------|----------------|-------------|---------------------|
| A | Unlogged micro-stops hiding bearing wear on a packaging line | Short stops are rarely logged, so loss attribution is wrong and early wear signs are lost | Photoeye stop events, optional vibration | No real set found; two public dataset hosts returned 403 |
| B | Compressor or bearing trips from sensor drift | Direct unplanned downtime | Process historians | Mostly vendor-private |
| C | Defect escape and recall | High severity per event | Inspection and lot records | Rare, regulated, private |
| D | False alarms in predictive maintenance | Alert fatigue kills adoption | Alarm logs | Private |

## Scoring (author's judgement, not a measurement)

Each criterion scored 1 to 5. Weights: specificity 30%, measurability 30%, data reproducibility 25%, cost visibility 15%.

| Candidate | Specificity | Measurability | Reproducibility | Cost visibility | Weighted |
|-----------|-------------|---------------|-----------------|-----------------|----------|
| A | 5 | 5 | 4 | 3 | 4.5 |
| B | 3 | 3 | 2 | 4 | 3.0 |
| C | 4 | 2 | 1 | 5 | 3.0 |
| D | 3 | 3 | 2 | 3 | 2.8 |

Weighted = 0.30 x specificity + 0.30 x measurability + 0.25 x reproducibility + 0.15 x cost visibility. Candidate A wins mainly because a seeded simulator can reproduce it end to end.

## Facts used from outside sources

Fact, source type, and caveat. All are secondary or vendor sources. Verify before relying on them.

- OEE = availability x performance x quality (ISO 22400-2 defines the KPI family). Source type: standards summary.
- Failure-mode vocabulary (STP, VIB, FTF) follows ISO 14224 categories. Source type: standards summary.
- Vibration severity zones A/B/C/D at 0.71, 1.8, 4.5 mm/s RMS for Class I machines (ISO 10816-1; check ISO 20816-1, which superseded it).
- Lost margin of 875 USD per line-hour: worked example from a vendor article (Teeptrak). Illustrative default only.
- Unplanned bearing-failure case of 36 h and about 510k USD (so about 14,167 USD/h): published labeller case. Planned replacement of 4 h is the author's assumption.
- 36,000 USD/h FMCG downtime: figure quoted from a 2024 Siemens report via secondary sources.
- Manual downtime logs under-record short stops: widely reported by lean and TPM practitioners. No single field study was verified for the logging probabilities used here; they are assumptions (see 03-analysis).

## Gaps

- No real packaging-line event log was available, so all results are synthetic.
- Vendor statistics were not cross-checked against primary studies.

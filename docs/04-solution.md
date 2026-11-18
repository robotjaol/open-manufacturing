# 04 Create solution

## What the solution is

A three-layer practice, not only an algorithm.

1. **Capture.** Every photoeye blocked-beam event of 2 s or more is timestamped and tagged by station (2040-ZS-201 to 501). No operator input needed.
2. **Detect.** Per station, daily counts feed (a) a Poisson CUSUM against a 7 day baseline, h = 12, and (b) a level test: 7 day mean at least 1.8 x design rate. First alarm from either raises an Advisory.
3. **Classify, then act.** 24 h after the alarm, the trend test separates wear (rate keeps rising) from a feed or process cluster (elevated, flat). Wear raises an Alert and the next actions are: handheld vibration spot check, order the bearing, book a 4 h planned stop. A cluster routes to feed, tape and shift review.

## Decision rules

| State | Rule | Action |
|-------|------|--------|
| Normal | no alarm | none |
| Advisory | alarm, not classified | walk the station, wait for the trend test |
| Alert | r1 >= 1.2, r2 >= 1.6, r2/r1 >= 1.15 | vibration check, order part, plan stop |
| Cluster advisory | elevated, flat | inspect feed and tape; do not pull bearings |

## Acceptance criteria for a pilot on real data

- At most 1 false alarm per station-year over 90 days.
- Every wear-confirmed bearing flagged at least 5 days before replacement or failure.
- Operator log share under 60 s measured, so the 18% assumption can be replaced.

## Economics (lost margin only)

Window cost of stops: 63 h x 875 = 55,139 USD in 21 days (63.0 h of stops). Bearing case: 36 h unplanned versus 4 h planned avoids 32 h, which is 28,000 USD at 875, 453,344 USD at 14,167, and 1,152,000 USD at 36,000 per hour. Excludes parts, labour, scrap, penalties.

## Safety

The dashboard never suggests clearing a jam in a running machine. Any physical action follows the site lockout procedure.

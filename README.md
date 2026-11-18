# Open Manufacturing

An open, synthetic-data digital twin of a packaging line (Line 2040, secondary packaging) that asks one specific question:

> Can photoeye stop counts alone warn of a wearing drive bearing, before vibration or a trip does?

Everything is reproducible: a seeded simulator, a detector with seven documented iterations, a Monte Carlo benchmark, and an interactive 3D plant page.

**All data is synthetic. Nothing here is measured from a real plant.**

## Run it

```bash
npm install
npm run sim     # rebuild data/ for seed 2040 (21 day demo)
npm test        # 9 tests
npm run build   # bundle web/app.js
# open web/index.html (works from file://) or serve the web/ folder
```

`N=300 node sim/calibrate.mjs` redoes threshold calibration. `npm run shot` takes headless screenshots (needs Chrome).

## What the page shows

- Interactive 3D plant built from primitives: infeed and transfer conveyors, gearmotor and bearing block, case packer, discharge conveyor, guarded palletizer cell, AGV. Click equipment to fly to it, X-ray the surroundings, toggle layers.
- A 21 day timeline. Status halos and findings follow the cursor: Normal, Advisory, Alert, each with next actions.
- Charts: stop rate by station, vibration against ISO zones with a projected failure day, captured versus logged stops, loss tree, detector iteration table with pre-registered targets.

## Headline results (synthetic, N = 300 runs of 60 days)

| Metric | v6 | Target |
|--------|----|--------|
| False alarms per station-year | 0.89 | at most 1 |
| Wear alarm at least 7 days ahead | 95% | at least 80% |
| Chronic feed cluster found | 100% | at least 80% |
| Cause classified correctly | 98% wear, 100% non-wear | at least 85% |
| Actionable lead of at least 5 days | 74% | at least 75% (missed by 1 point) |

Demo window (seed 2040): 6,549 stops, true OEE 83.2%, 61% of stop time never logged, 75% of that hidden inside performance loss.

## Method, in five stages

1. [Research](docs/01-research.md): candidate problems and scoring.
2. [Define](docs/02-define.md): problem statement and targets fixed before any run.
3. [Analysis](docs/03-analysis.md): six-persona panel, three rounds, measured iterations.
4. [Solution](docs/04-solution.md): capture, detect, classify, act.
5. [Synthesis](docs/05-synthesis.md): answer, limits, pilot decision.

## Limits you should read

- Circular validation: test data comes from the model family the detector assumes.
- Operator logging probabilities and the 4 h planned replacement are assumptions.
- v6 misses the actionable-lead target by 1 point; slow wear (56% recall) and fast wear (no run at 7 days of lead) are weak spots.
- The panel is one language model playing roles, not independent experts.
- Economics use lost margin only, at an illustrative 875 USD per line-hour from a vendor example. Replace with your own.
- Standards (ISO 22400-2, ISO 14224, ISO 10816-1) are design references from secondary sources, not claimed compliance. Check ISO 20816-1.

## Layout

```
sim/    seeded generator, KPIs, detectors, Monte Carlo, calibration
data/   results.json (web payload), CSV exports, calibration, sensitivity
web/    index.html, style.css, src/ (Three.js scene, charts, UI), app.js (built)
docs/   01 to 05 stage write-ups
test/   node:test suite
```

## Ringkasan (Bahasa Indonesia)

Proyek terbuka berisi digital twin sintetis lini pengemasan dengan satu pertanyaan: apakah hitungan berhenti-singkat dari photoeye saja bisa memberi peringatan dini bearing aus. Hasil benchmark (data sintetis): alarm 7 hari atau lebih lebih awal pada 95% run, 0,89 alarm palsu per stasiun-tahun, klasifikasi penyebab 98 sampai 100%. Satu target meleset 1 poin (lead actionable 5 hari: 74% dari 75%). Semua data sintetis, jadi hasil ini bukan bukti performa lapangan; langkah berikut adalah pilot 90 hari pada data nyata.

## License

MIT.

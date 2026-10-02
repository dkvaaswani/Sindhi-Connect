# Children's Future Education Fund Calculator

A planning tool on the Sindhi Connect website for ordinary parents. For up to four children it shows the total
education fund required, the yearly saving needed, a cost breakdown, a year-by-year plan and a country comparison.
It ships as two deliverables that must share one dataset and one set of rules:

| Deliverable | Where | Status |
|---|---|---|
| Web calculator page | `frontend/education-calculator.html` (live at `/education-calculator.html`) | v2 (simplified) |
| Excel workbook | `frontend/downloads/Children_Education_Fund_Calculator.xlsx` | still v1 — hidden from the page until rebuilt (needs Python + openpyxl) |

## Architecture

The site is plain static HTML/CSS/JS published by Netlify from `frontend/` with no build step. The calculator follows
that: it runs entirely in the browser, needs no backend, database or account, and adds no libraries (charts are SVG drawn
by hand). Nothing a parent types leaves their browser.

```
data/education/education-costs.json   MASTER dataset v2 (fee records, estimates, living costs, visas, travel,
                                      course lengths, fee increases, FX, defaults, gaps) — edit this
tools/edu-calc/build-data.ps1         regenerates (Windows, no extra software):
  → frontend/edu-calc/education-data.js            dataset as window.EDU_DATA for the page
  → docs/education-calculator/SOURCES.md           research-source register
tools/edu-calc/build.py               builds the Excel workbook (v1; to be updated for dataset v2)
  → frontend/downloads/Children_Education_Fund_Calculator.xlsx
frontend/edu-calc/calc-engine.js      calculation engine (pure functions; also runs in Node for tests)
frontend/edu-calc/edu-calc.js         page behaviour (steps, forms, results, exports)
frontend/edu-calc/edu-calc.css        page styles, built on the tokens in frontend/style.css
frontend/education-calculator.html    the page (same header/footer/branding as index.html)
tests/edu-calc/                       engine tests + Excel-vs-web parity check
```

Changes to existing files: `frontend/index.html` gains one "Education Calculator" link in the header menu and one in the
footer; `README.md` gains a pointer to this folder. Nothing else on the existing site was modified.

`data/`, `tools/`, `tests/` and `docs/` sit outside `frontend/`, so Netlify does not publish them.

## Documents in this folder

- [METHODOLOGY.md](METHODOLOGY.md) — formulas, timing conventions, averaging, currency and assumptions
- [SOURCES.md](SOURCES.md) — every researched figure with its source, fee year and status (generated)
- [MAINTENANCE.md](MAINTENANCE.md) — updating fees and assumptions, running, testing and deploying
- [TEST_REPORT.md](TEST_REPORT.md) — scenarios tested and results

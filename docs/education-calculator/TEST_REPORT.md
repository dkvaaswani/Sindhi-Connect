# Test report — Education Fund Calculator

Run on 2 October 2026 against dataset v1.0.0. Re-run with the commands in `MAINTENANCE.md`.

## Summary

| Suite | Result |
|---|---|
| Engine tests (`node --test tests/edu-calc/engine.test.js`) | **23 passed, 0 failed** |
| Excel vs web parity (`python3 tests/edu-calc/excel_parity.py`) | **140 values compared, 0 mismatches**; largest relative difference 3.6 × 10⁻¹⁵ |
| Workbook recalculation (LibreOffice) | 14,211 formulas, **0 errors** |
| Browser test of the page (`tests/edu-calc/ui_test.py`, Chromium) | **31 passed, 0 failed**, no console or page errors |
| Responsive check at 375, 390, 430, 768 and 1366 px | No horizontal page overflow at any width; wide tables scroll inside their frame |

## Required scenarios

| # | Scenario | Where tested | Result |
|---|---|---|---|
| 1 | One child, eight years until college | engine test 1 (hand-checked: zero return ⇒ required = max cumulative cost ÷ contributions = 48,000 ÷ 11) | Pass |
| 2 | Two children with different ages | engine test 2; parity P1 | Pass |
| 3 | Four children | engine test 3; parity P2; browser test | Pass |
| 4 | College-entry age 18 → 21 | engine test 4; parity P4 | Pass |
| 5 | Child already college age | engine test 5 (lump 12,000 + 12,000/yr, hand-checked); parity P3; browser notice | Pass |
| 6 | Zero investment return | engine tests 1, 6 | Pass |
| 7 | Positive return | engine test 7; parity P1, P2 | Pass |
| 8 | Negative return | engine test 8; parity P3 (−2%); browser test (−5%) | Pass |
| 9 | Zero inflation | engine test 9; parity P3 | Pass |
| 10 | Savings already cover all costs | engine test 10 (requirement 0, never negative); parity P4 | Pass |
| 11 | Scholarships reduce costs | engine test 11; parity P2 (25% and fixed) | Pass |
| 12 | Children in different countries | engine test 12; parity P2 (UK, Germany, Australia, USA) | Pass |
| 13 | Reporting currency ≠ fee currency (incl. FX drift) | engine test 13; parity P2 (USD), P3 (PKR for India) | Pass |
| 14 | Missing university fee records | engine test 14; parity P3 (custom qualification with overrides); browser warning | Pass |
| 15 | One-year vs longer programme (and 5.5-year MBBS, zero duration) | engine test 15; parity P3 | Pass |
| 16 | Expenses spread across academic years | engine test 16 | Pass |
| 17 | Combined family schedule | engine test 17 | Pass |
| 18 | Invalid and missing inputs | engine test 18; browser test (negative age message, child left out) | Pass |

Additional engine checks: university averages exclude flagged records and report median/range; monthly timing factor
equals the future value of 12 month-end payments; every core benchmark in the real dataset resolves and projects; the
required plan keeps a real Pakistan MBBS fund non-negative every year.

## Excel vs web parity detail

Differences are floating-point only (≤ 4 × 10⁻¹⁵ relative). Values compared per child: years to college, first-year cost,
total cost and its tuition/living/other split, scholarships, future value of savings and of contributions, lump sum,
required first-year contribution, shortfall, coverage and surplus/gap. The workbook uses only Excel-2007-era functions
plus CSE array formulas (MEDIAN/MIN/MAX(IF())) so it works in older Excel versions; no differences arise from version
limits. Display rounding differs only cosmetically (the page rounds to whole currency units).

```
### P1 Pakistan family, two children, defaults
- Child 1: required first-year annual 433,576.86, lump 0.00, total cost 13,919,331.29 — matched
- Child 2: required first-year annual 1,394,827.29, lump 0.00, total cost 69,783,785.55 — matched

### P2 Four children, mixed countries, USD reporting, named university, scholarship, annual mode, FX drift
- Child 1: required first-year annual 10,912.21, lump 0.00, total cost 493,714.60 — matched
- Child 2: required first-year annual 3,967.21, lump 0.00, total cost 87,212.60 — matched
- Child 3: required first-year annual 57,551.32, lump 0.00, total cost 992,342.61 — matched
- Child 4: required first-year annual 19,761.08, lump 0.00, total cost 923,304.57 — matched

### P3 Edge cases: already college age, negative return, zero inflation, 5.5-year MBBS, custom qualification
- Child 1: required first-year annual 1,505,254.17, lump 1,293,419.32, total cost 5,967,636.36 — matched
- Child 2: required first-year annual 2,799,322.44, lump 0.00, total cost 30,866,147.24 — matched
- Child 3: required first-year annual 144,754.90, lump 0.00, total cost 2,114,326.56 — matched

### P4 Savings already cover costs; UK home student; entry age 21
- Child 1: required first-year annual 0.00, lump 0.00, total cost 97,347.27 — matched

140 values compared, 0 mismatches, largest relative difference 3.60e-15
```

## Browser test detail

```
PASS initial rail figure — PKR 152,367
PASS 4 child forms visible — 4
PASS 1 child form visible — 1
PASS invalid age message — Enter a whole number from 0 to 40.
PASS rail warns invalid child
PASS college-age notice
PASS lump sum shown — Extra saving needed each month

PKR 265,610

on top of what you already save, rising 5% a year

Plus PKR 1,033,350 needed now for costs that start before savings can grow.

Total estimated cost
PKR 10
PASS currency switch — USD 185
PASS custom name field shown
PASS no-data warning for custom
PASS override badge
PASS university options — ['University average (3 universities)', 'NUST Islamabad', 'LUMS Lahore', 'IBA Karachi']
PASS funding table synced to step 1 — 12345
PASS negative return works — USD 892
PASS annual mode label
PASS results kpis
PASS chart rendered
PASS scenarios table
PASS comparison added
PASS per-child schedule
PASS CSV export — 6403
PASS JSON backup
PASS save local
PASS reset to example — PKR 152,367
PASS load backup restores — ('USD 440', 'USD 440')
PASS bad backup rejected
PASS restore saved
PASS print report built
PASS keyboard step nav
PASS home nav has calculator link
PASS no page errors
```

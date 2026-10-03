# Test report — simplified calculator (engine and dataset v2)

Date: 2 October 2026. Environment: Windows 11, local static server, built-in browser (Chromium) at 1280×800, 1024,
768, 430, 390 and 375 px. Node.js, Python and LibreOffice are not installed on this machine, so the engine checks were
run in the browser against the shipped `calc-engine.js` and `education-data.js` (the same checks are in
`tests/edu-calc/engine.test.js` for Node).

## Engine — automated (592 scenarios, 0 failures)

| Check | Scenarios | Result |
|---|---|---|
| Every country × qualification × nationality (Pakistan, UK, Germany, USA): offered courses calculate, not-offered ones are flagged, no missing cost lines | 528 | pass |
| 1, 2, 3, 4 children × ages 0–18 × scholarship 0/20/50/100% × return 0%, 6%, −2%, 15% (savings increase 3%) | 64 | pass |
| Fund never below zero after any year's costs | all | pass |
| Savings and "amount needed now" never negative | all | pass |
| Cost breakdown adds up to the child's total; yearly plan adds up to the family total | all | pass |
| Scholarship 20% reduces eligible costs exactly once (visa and travel unchanged); 100% leaves only visa and travel | 2 | pass |
| Zero return: yearly saving = total ÷ saving years | 1 | pass |
| Child already at college age: first year's cost shown as needed now | 1 | pass |
| Course length follows country and qualification (UK medicine 5 yrs, UK law 3, US medicine 8 incl. pre-med, India MBBS 4.5) | 4 | pass |
| Country comparison total = plan total for the same country | 1 | pass |
| Own cost figures and fee-increase edits change the result | 1 | pass |

Example (2 children, nationality Pakistan, residence Qatar, GBP): Child 1 Computer Science in the UK from 2034/35,
Child 2 Medicine in Pakistan from 2038/39 — total GBP 395,300, required yearly saving GBP 25,627 in 2026–27.

## Yearly fund roll-forward — added 3 October 2026

`tests/edu-calc/engine.test.js` (11 tests; run in the browser against the shipped engine and data with a small
shim, because Node is not installed — all 11 pass). New tests:

| Test | Checks | Result |
|---|---|---|
| Worked example: 1 child, Computer Science in Pakistan, 4 years from 2026/27, all rates 0% | each year's cost recomputed from the cost rules; amount needed now = year-1 cost; yearly saving recomputed from the funding rule; savings in years 1–3 only; opening(1) = amount needed now; nothing left at the end; Σ expenses = total | pass |
| Roll-forward for 1–4 children × PKR, GBP, USD, EUR, AUD, INR × return 0/4/8% × scholarship 0/25/100% × savings increase 0/5% | `opening − expenses + growth + savings = closing` for every child and family year; closing → next opening; never short; reconciliation `needed now + savings + growth − expenses = left at end` | pass (108 scenarios) |
| Positive return | saving keeps the fund from running out, and 0.1% less does not | pass |
| Inflation | year-on-year growth of tuition and living lines equals the configured rates | pass |

A deliberately broken roll-forward (year 2 opening set to 0) makes the worked example and the roll-forward test fail,
so the tests catch the problem they are meant to.

Page (scripted in the browser): the worked example shows PKR 6,155,281 total, PKR 1,493,250 yearly saving and
PKR 1,675,531 needed now on screen, in the printed report and in the CSV; the printed year rows equal the on-screen
rows. A 3-child GBP plan with 6% return, 25% scholarship and 3% savings increase: 24 printed rows, every row adds up
and chains, Σ expenses = total on screen = total in print. After "Start again" the dashboard, printed report and CSV
show no figures until details are entered; entering a detail brings them back. No horizontal page scroll at 375 px.

## Comparison, default currency and opening state — added 3 October 2026

- New engine test: the current country's comparison row equals the plan total even with own cost edits and 0% fee
  and living-cost increases; other countries keep the parent's percentages but not the cost edits. 12/12 tests pass.
- Page: 1 child, Computer Science in Pakistan, 0% increases and an edited tuition figure: "Current plan" row =
  plan total in USD (USD 23,562) and in PKR (PKR 6,529,081). Previously the row ignored the edits and increases.
- On opening: currency USD; dashboard, results and comparison show USD 0 / no figures until a detail is changed.
  "Start again" returns to the same state.

## Page — manual and scripted in the browser

| Check | Result |
|---|---|
| Basic Information: number of children shows 1–4 child sections; residence and nationality dropdowns; no family label or family education country | pass |
| Child sections: age 0–18, school class 0–13, education country (6), qualification (22), entry age default 18; read-only course length with note; "Not offered here" for e.g. CPA in the UK | pass |
| Education costs: researched figures with "Published figure", "Estimated — please review", "Not needed" (visa for local students) or "Your figure"; "Why this figure?" shows note and sources; Undo restores | pass |
| Professional qualifications show "Exam, registration and membership fees" and the pathway note | pass |
| Scholarship slider and number box stay in sync; 0/20/50/100% update all results | pass |
| Adjust Financial Assumptions: return, savings increase, per-child fee and living-cost increases; exchange rates appear only when a conversion is needed | pass |
| Results: two headline boxes, child table (name, starts in, total), breakdown, child-bar + savings-line chart, collapsible yearly plan | pass |
| Compare countries: child selector, inherited qualification, six country tick-boxes, totals with "Estimate"/"incomplete"/"Not available" tags; "Use … for …" updates the plan only when clicked | pass |
| Start again: dialog; Cancel keeps everything; "Yes, Start Again" resets to 1 child, defaults (entry age 18, 0%), step 1; a plan saved in the browser is kept | pass |
| Save in browser / reload, CSV export, backup file, print report | pass |
| Header menu, dropdowns, mobile menu, footer links on the calculator page | pass |
| No horizontal scrolling at 375, 390, 430, 768, 1024 and 1280 px; sticky summary on mobile clear of the chat button | pass |
| Browser console: no errors | pass |

## Not tested / open

- **Excel workbook** — not yet rebuilt for v2 (needs Python + openpyxl), so Excel-vs-web parity was not run. The
  workbook link is removed from the page until it matches.
- Node-based test run (`node --test`) — Node is not installed; the identical checks passed in the browser.
- Research completeness — see "Known gaps" in SOURCES.md for every figure that is still a planning estimate.

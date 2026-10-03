# Calculation methodology (dataset and engine v2)

The web calculator (`frontend/edu-calc/calc-engine.js`) implements the rules below. The Excel workbook must implement the
same rules so both give the same answers for the same inputs (see "Excel status" at the end).

## 1. Inputs a parent gives

| Input | Used for |
|---|---|
| Number of children (1–4) | Only that many children are calculated. |
| Country of residence | First-travel estimate (home region → education country). |
| Nationality | Local or international fees, and whether a student visa is needed. |
| Show results in (currency) | Reporting currency; "Automatic" = Child 1's education country. |
| Per child: age (0–18), school class (0–13), education country, qualification, college-entry age (default 18) | Course, timing and cost lookup. School class is for the parent's reference only. |
| Scholarship / part-time work % (default 0%) | Reduces eligible costs (section 5). |
| Optional — Adjust Financial Assumptions | Investment return, yearly increase in savings, each child's fee and living-cost increases, exchange rates. |
| Optional — any cost line | The parent's own figure replaces the researched one ("Your figure"). |

## 2. Fee status (local or international)

`domestic` when the nationality is in the education country's `domesticNationalities` list (Germany: EU/EEA
nationalities; UK: UK and Ireland; Australia: Australia and New Zealand), otherwise `international`. Residence,
settled status and scholarships can change real fee status; the calculator says so.

## 3. Course length

From `courseDurations` (country × qualification), shown read-only with a note. `variable: true` adds "typical length; the
actual length may vary". `years: null` means **not offered** in that country (e.g. CPA in the UK, CA in Germany and the
USA): the child gets a clear message and the comparison shows "Not available".

**Two-stage courses** (`preStage`): US medicine, dentistry, physiotherapy (DPT) and law, US pharmacy, and the CPA/CA
pathways in the USA and Australia start with a bachelor's degree. Those first years use the pre-stage qualification's
fees (e.g. a science bachelor's), the remaining years the professional programme's fees.

Fractional lengths (e.g. 4.5 years) charge the last year's annual costs pro rata.

## 4. Cost lines (today's prices, education country's currency)

| Line | Timing | Grows with | Reduced by scholarship % |
|---|---|---|---|
| Tuition fees | each study year | fee increase | yes |
| Other university and course fees | each study year | fee increase | yes |
| Admission and registration | once, year 1 | fee increase | yes |
| Accommodation, food, local transport, health insurance, books | each study year | living-cost increase | yes |
| Visa and application | once, year 1 | living-cost increase | no |
| First travel and settling in | once, year 1 | living-cost increase | no |

**Fee benchmark.** Records flagged `includeInAverage` with the same country, qualification, fee status and currency are
averaged after each is grown to the plan start year: `fee × (1 + fee increase)^(planStart − feeYearStart)`. Fees that
differ by year of study (e.g. clinical years) are entered as the course-average year (derivation in the record notes).
If no published record exists, an **estimate** is used and labelled "Estimated — please review": either a fixed figure
from an official fee list (professional bodies, non-resident rates) or a rule that follows published fees (`derive`:
another course's fee × multiplier, or the average of the country's non-medical degrees). If neither exists the line
shows "No figure yet — please enter" and contributes 0 until the parent enters a figure.

**Living costs** come from one benchmark per country (`living`), with separate health-insurance figures for local and
international students where they differ. Personal spending is not included.

**Visa** — none when the child is a local national; otherwise the destination's official student-visa charge
(`visas`), with nationality-specific amounts where the official table gives them (Pakistan). The UK Immigration Health
Surcharge is a yearly health-insurance cost, not a visa cost, so it is not counted twice.

**First travel** — `fare(home region → destination) + settling-in allowance`, or a smaller domestic move when residence
= education country. Day-to-day travel is the separate Local transport line, so travel is never counted twice.

**Currency** — every amount is converted at the dataset's reference rates (units per USD, dated). A parent may override
a rate under Adjust Financial Assumptions; the date is shown whenever a conversion happens.

## 5. Scholarship / part-time work

`net line = gross line × (1 − c)` for every line marked "yes" above, applied once at the point the yearly cost is
calculated. Visa and first-travel costs are not reduced. The breakdown, totals, schedule, chart and comparison all use
these net amounts, so the reduction is never applied twice.

## 6. Timing and the yearly plan

Plan year *p* = 1, 2, … is calendar year `planStartYear + p − 1`. A child starts college in year `n + 1`, where
`n = max(0, entryAge − age)`. Education costs are paid at the **start** of each study year; family savings are paid at
the **end** of each year, from year 1 until the year before the child's last cost. The fund earns the investment
return on what is left after costs.

Line amount in plan year *p*: `amount × (1 + rate)^(year − baseYear) × fraction × FX`, where *rate* is the fee or
living-cost increase for that line and *baseYear* is the year the figure was quoted for.

## 7. Required yearly savings

For each child, with return *r* and yearly increase *g*:

- `a_p` = fund after year-*p* costs if nothing were saved (carried forward with *r*);
- `b_p` = fund after year-*p* costs per 1 unit of yearly saving, where year-*q* saving is `(1 + g)^(q − 1)`;
- **amount needed now** `L = max(−a_p / (1 + r)^(p − 1))` over years with costs that no saving can reach yet
  (e.g. a child already at college age);
- **first-year saving** `x = max(−(a_p + L·(1 + r)^(p − 1)) / b_p)` over years with costs, floored at 0.

So the fund never goes below zero in any study year. With r = 0 and g = 0 this equals total cost ÷ number of saving
years. The family's yearly saving is the sum over children, so it changes as children start and finish; the headline
shows **this year's** amount and the yearly plan shows every year. Negative savings are never shown; when costs start
immediately the "amount needed now" is shown instead, in plain language.

## 8. Results

- **Total Education Fund Required** = sum of all children's net yearly costs over their full courses, at future prices.
- **Required Yearly Savings** = the family's saving for the first plan year (section 7).
- **Each child** — start year and total cost.
- **Cost breakdown** — tuition, accommodation, food, transport, health insurance, books, other university and course fees
  (incl. admission), and visa/application/travel/relocation; the parts add up to the total.
- **Chart** — one bar series per child (that child's costs in each year) and one line for the family's required saving
  that year (not a cumulative balance).
- **Year-by-year plan** — a fund roll-forward per year (same columns on screen, in the printed report and in the CSV):
  opening fund, family savings added, investment growth, education expenses, closing fund, where
  `closing = opening − expenses + growth + savings` and `growth = (opening − expenses) × r` (costs at the start of the
  year, savings at the end). Each year's closing fund is the next year's opening fund. The plan assumes **no existing
  savings**: the first opening fund is the amount needed now `L` (zero when saving can start in time). A child whose
  course has ended carries any amount left, unchanged. Reconciliation shown under the table:
  `L + Σ savings + Σ growth − Σ expenses = fund left at the end`, and `Σ expenses = Total Education Fund Required`.
  Worked example (1 child, Computer Science in Pakistan, 4 years from 2026/27, all rates 0%): the course starts now,
  so year 1's cost (which includes one-time admission and relocation costs) is the amount needed now; the end-of-year
  savings in years 1–3 each pay the following year's (equal) cost, so the yearly saving equals one regular year's cost
  and nothing is left at the end.
- **Compare countries** — the plan's own country row is the plan itself (same total as the results). Other countries:
  the same child and qualification using that country's own fees,
  living costs, course length, visa and travel; the parent's own fee and living-cost increases are used if set (else
  the country defaults), but the parent's own cost edits are not carried over (another currency).

## 9. Defaults

| Assumption | Default | Source |
|---|---|---|
| Results currency | USD (the parent can choose another, or "Automatic" = Child 1's study country) | — |
| On opening / after "Start again" | results, report, CSV and comparison show 0 until the parent changes a detail | — |
| College-entry age | 18 | — |
| Scholarship / part-time work | 0% | — |
| Investment return | by reporting currency (PKR 12%, INR 10%, USD 6%, GBP 5%, EUR 5%, AUD 6%) | planning assumption, `assumptions.returnsByCurrency` |
| Yearly increase in savings | 0% | — |
| Fee increase | country × fee status × subject group where evidence exists, else country default | `tuitionInflation`, see SOURCES.md |
| Living-cost increase | country default | `countries[].livingInflation` |

## 10. Excel status

The Excel workbook (`frontend/downloads/Children_Education_Fund_Calculator.xlsx`) still follows the **previous**
(v1) method and inputs and has been removed from the page until it is rebuilt with this method. Rebuilding it needs
Python 3 + openpyxl (`tools/edu-calc/build.py`, to be updated for dataset v2) and, for the automatic Excel-vs-web check,
LibreOffice and Node.js.

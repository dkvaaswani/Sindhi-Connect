# Methodology and assumptions

The web page (`frontend/edu-calc/calc-engine.js`) and the Excel workbook implement the same rules. The parity check in
`tests/edu-calc/excel_parity.py` confirms they agree (largest relative difference ≈ 4 × 10⁻¹⁵, i.e. floating-point noise).

> This is an educational planning tool, not a guarantee of future costs or investment performance. Fees, living costs,
> inflation, exchange rates and investment returns may differ from the figures used. Always confirm fees with the university.

## 1. Cost basis for a child

1. **Country, qualification, student category.** The category defaults to the country's usual category for the family
   (e.g. "Pakistani national" in Pakistan, "International" in the UK). Domestic and international fees are never mixed.
2. **Benchmark.** Either the *university average* for that country + qualification + category, or one named university.
3. **University average.** Uses only records with *Include in average = Yes* that share the currency of the first such
   record. Shown with count, mean (used), median, lowest and highest. One record is labelled a *single-institution
   benchmark*. Historical figures, published ranges and regulatory caps are kept for reference but excluded.
   Adjacent fee years (e.g. 2025-26 and 2026-27) may be averaged; each record lists its year. The average's fee year is the
   rounded mean of the records' fee-year starts.
4. **Living costs.** From the country's living-cost benchmark (category-specific row if one exists, else "All"), converted
   to the fee currency if needed. A named university record that publishes its own cost of attendance
   (*Living costs from this record = Yes*) uses those figures instead — never both, to avoid double counting.
   Visa "proof of funds" amounts are never treated as living costs.
5. **One-time costs.** Admission/registration and other one-time fees (from records), visa/application (from the living
   table, international only), travel and relocation (parent's estimate). Refundable deposits are excluded.
6. **Overrides.** Any figure a parent types replaces the researched one and is labelled a user override.
7. **Duration.** Parent's figure, else the named record's duration, else the course-duration table, else the country default.
   Fractional durations (e.g. 5.5 years) charge the final year pro rata.

## 2. Timeline and timing conventions

- Plan year *p* = 1, 2, … runs from time *p − 1* to *p* (years from now). Year 1 is the academic year starting in the
  plan-start year (2026).
- Years until college *n* = max(0, college-entry age − current age), whole years. If the entry age is not after the
  current age, *n* = 0 and costs start now.
- Study year *k* (0-based) is paid at the **start** of plan year *n + k + 1*. No costs are forecast before entry.
- Contributions: **monthly** contributions are paid at each month-end; **annual** contributions at year-end. Contributions
  rise each year by the escalation rate *g* and continue up to the year before the last study-year payment
  (*P* = *n* + ⌈duration⌉ − 1 years), so they also help during college.
- Other planned funding (a lump sum) arrives with the first study year.

## 3. Formulas

Future cost of a component paid in plan year *p*:

```
Future cost = Current cost × (1 + inflation)^((p − 1) + (plan start year − fee year))
```

Tuition and other mandatory fees, admission and other one-time fees use **tuition inflation**; accommodation, food,
transport, insurance, books, personal costs, visa and travel use **living-cost inflation**.

```
Gross cost (fee currency)   = tuition + other fees + living + one-time (first study year only), each × fraction of year studied
Contingency                 = Gross × contingency %
Exchange rate in year p     = reference rate (fee → reporting) × (1 + FX drift)^(p − 1)
Scholarship                 = min(tuition, tuition × scholarship %) × rate + fixed scholarship × fraction
Net education expense (Ep)  = max(0, (Gross + Contingency) × rate − Scholarship)
```

Monthly timing factor (year-end value of 12 end-of-month payments, per unit of annual total), with return *r*:

```
f = (r / ((1 + r)^(1/12) − 1)) / 12        (f = 1 when r = 0; for annual contributions f = 1)
```

Fund each year (the auditable cash-flow table in the workbook's *Savings Calculator*):

```
Available after costs  A_p = Opening_p + Other funding_p − E_p
Closing_p              = A_p × (1 + r) + Contributions_p
Contributions_p        = (monthly × 12 × f + annual) × (1 + g)^(p − 1)      for p ≤ P, else 0
```

**Current plan (coverage).** Uses only existing savings and contributions. If *A_p* < 0 the unfunded part is recorded as
a shortfall for that year and the balance is floored at zero. Coverage = 1 − total shortfall ÷ total cost. The surplus is
the balance left after the last study year (or minus the total shortfall).

**Required additional contribution.** Find the smallest first-year amount *x* (rising by *g* each year, paid with the same
timing as the chosen contribution mode) such that *A_p* ≥ 0 in every year with a cost. Because balances are linear in *x*:
*A_p(x) = a_p + b_p·x*, where *a_p* uses existing resources and *b_p* is the value of a unit contribution stream. Then
`x = max over cost years of −a_p / b_p` (never below zero). Where *b_p* = 0 — a cost due before any contribution can
arrive, e.g. a child already at college age — an **up-front lump sum** *L* = max(−a_p ÷ (1 + r)^(p−1)) is required first,
and *x* is solved after adding *L*. The required monthly amount is *x* ÷ 12 (monthly mode).

Family results add the children's yearly figures; children starting in different years are handled naturally because each
has its own timeline on the same calendar.

**Safe handling.** Zero, negative (above −99%) and positive returns are valid. Zero years remaining, zero duration and
fully-funded plans return zero requirements. Invalid inputs (non-whole or out-of-range ages, duration outside 0–10,
negative amounts, out-of-range assumptions) are reported and that child is left out instead of producing errors.

## 4. Currency

Rates are stored as units per 1 USD with a reference date (1 Oct 2026): EUR, GBP, AUD and INR are cross-rates from the
European Central Bank euro reference rates; PKR is the State Bank of Pakistan mark-to-market revaluation rate.
Conversion A → B = amount ÷ rate_A × rate_B. Parents can type their own rates and an annual drift. Rates are never
substituted silently: a missing rate raises an error.

## 5. Default assumptions (editable)

| Assumption | Default | Basis |
|---|---|---|
| Tuition inflation | PK 10%, IN 8%, US 4%, UK 5%, AU 5%, DE 2% | PK: AKU's published MBBS schedule rises ~10%/yr; UK: Manchester reserves up to 7%/yr; DE: BW fee unchanged since 2017/18; others illustrative |
| Living-cost inflation | PK 8%, IN 6%, others 3% | Illustrative |
| Investment return (by reporting currency) | PKR 12%, INR 10%, USD 6%, AUD 6%, GBP 5%, EUR 5% | Illustrative nominal returns — not predictions, recommendations or guaranteed rates |
| Contribution increase | 5% a year | Illustrative |
| Contingency | 5% | Illustrative |
| Exchange-rate drift | 0% | Neutral starting point |
| Scenario spread | ± 3 percentage points of return | Lower/higher return scenarios on the web page, labelled illustrative |

## 6. Known limitations

- Coverage is partial (see `SOURCES.md` → *Known coverage gaps*). Many cells are single-institution benchmarks.
- Some fees are year-1 values where later years differ (e.g. AKU, Manchester Medicine — the latter is course-weighted).
- Programme-specific fees at some US universities and semester contributions at some German universities were not verified.
- Pakistan and India living-cost benchmarks are partial (accommodation only / accommodation and mess).
- Ages are whole years; costs and contributions are annual (contributions use a monthly timing factor).
- Taxes on returns, student loans, part-time work, currency hedging and fee changes mid-course are not modelled.
- Professional qualifications (ACCA, CPA, CA) have no verified records yet; parents enter their own components
  (registration, exam fees, tuition-provider fees, exemptions, any degree studied alongside).

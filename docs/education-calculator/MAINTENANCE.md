# Maintaining, running and deploying the calculator

## Updating fees and assumptions

All data lives in **`data/education/education-costs.json`** (dataset v2). After editing it, rebuild the page data
file and the source register — on Windows with no extra software:

```powershell
powershell -ExecutionPolicy Bypass -File tools/edu-calc/build-data.ps1
```

This writes `frontend/edu-calc/education-data.js` and `docs/education-calculator/SOURCES.md` (and fails loudly if the
JSON is invalid). Commit the JSON together with both generated files; never edit the generated files by hand.

### Add or update a university fee (`records`)

Copy a record and change it. Required fields:

| Field | Notes |
|---|---|
| `id` | Unique, next free `R###`. Never reuse an id. |
| `country`, `qualification` | Must match a name in `countries` / `qualifications`. |
| `university`, `feeStatus` | `feeStatus` is `domestic` or `international` (older records use `studentCategory`, mapped by `feeStatusByCategory`). |
| `feeYear`, `feeYearStart` | Label and the calendar year the academic year starts — fees from different years are made comparable with this. |
| `tuition`, `otherMandatoryAnnual` | Per year, in `currency`. For fees that differ by year of study, enter the course average and explain in `notes`. |
| `oneTimeAdmission`, `otherOneTime` | Charged once in year 1. Exclude refundable deposits. |
| `currency`, `sourceUrl`, `sourcePublication`, `lastVerified` | Direct official page and the date you checked it. |
| `status`, `includeInAverage` | Use `Verified – official source`, `Derived from official source` or `Estimated from official per-credit rate`. Set `includeInAverage: false` for superseded years, duplicates, caps or ranges and say why in `status`. |

When a newer fee for the **same programme** is added, set the older record's `includeInAverage` to `false`
("Superseded …") so a university is not counted twice.

### Planning estimates (`estimates`)

Used only when a course has no published record for that country and fee status. Two kinds:

```json
{ "country": "UK", "qualification": "ACCA", "feeStatus": "all", "currency": "GBP", "year": 2026,
  "tuition": 876, "otherFees": 0, "admission": 89, "sourceUrl": "...", "basis": "Estimated — how it was worked out" }

{ "country": "India", "qualification": "Law", "feeStatus": "international",
  "derive": { "qualification": "Law", "feeStatus": "domestic", "multiplier": 2 }, "basis": "Estimated — ..." }
```

`derive` rules follow published fees automatically (`{ "average": "nonMedicalDegrees" }` averages the country's
published non-medical degrees). Every estimate needs a plain-language `basis`; the page shows it as
"Estimated — please review". Delete an estimate once a published record exists.

### Course lengths (`courseDurations`)

One row per country × qualification: `years` (null = not offered), `variable`, `note`, `status`, and optional
`preStage: { years, qualification, label }` for courses entered after another degree.

### Living costs, visas, travel

- `living[]` — per country, `items.accommodation|food|transport|healthInsurance|books`, each `{ amount, status, source, sourceUrl, note }`
  (health insurance can be split into `domestic` / `international`). Amounts are per year.
- `visas[]` — per destination; `byNationality` for official nationality-specific fees.
- `travel` — fares by home region (`places[].region`) and settling-in allowances, all labelled estimates.

### Fee and living-cost increases

`tuitionInflation[]` — `{ country, feeStatus?, group? | qualification?, rate, basis: published|planning, note, observations[] }`.
The most specific match wins (qualification → subject group → country). Record the evidence (same programme, two or more
years, with sources) in `observations`, and keep `basis: planning` unless a long series or published policy supports it.
Country defaults are in `countries[]` (`tuitionInflation`, `livingInflation`).

### Add a country, nationality or qualification

- Country of study: add to `countries` (currency, `domesticNationalities`, default rates), `currencies`,
  `exchangeRates.rates`, `assumptions.returnsByCurrency`, `living`, `visas`, `travel.toCountry` and a `courseDurations`
  row for each qualification.
- Residence / nationality: add to `places` with a travel region.
- Qualification: add to `qualifications` (`group`, `kind: degree|professional`) and a `courseDurations` row per country.

### Exchange rates

Edit `exchangeRates.rates` (units per 1 USD) and `exchangeRates.date`. Use ECB reference rates (cross-rates for INR, GBP,
AUD) and the State Bank of Pakistan for PKR.

## Running locally

Any static file server in `frontend/` works, for example the PowerShell server used during development
(`.claude/serve.ps1`), or `python -m http.server 8000` if Python is installed. Opening
`frontend/education-calculator.html` directly from disk also works (the data is a `.js` file).

## Testing

- `tests/edu-calc/engine.test.js` — engine rules (Node 18+: `node --test tests/edu-calc/engine.test.js`). The same
  checks were run in the browser for this release (see TEST_REPORT.md).
- `tests/edu-calc/excel_parity.py`, `parity-js.js` — Excel-vs-web parity; to be updated together with the workbook.

## Excel workbook

Still on the v1 method and hidden from the page. To rebuild: install Python 3 and `pip install openpyxl`, update
`tools/edu-calc/build.py` for dataset v2 (inputs and results described in METHODOLOGY.md), run it, then run the parity
check with LibreOffice and Node.js. Keep a copy of the current workbook as a backup before replacing it.

## Deploying

Push to `main`; Netlify publishes `frontend/` with no build step. `data/`, `tools/`, `tests/` and `docs/` are not
published. Before pushing: rebuild the data, open the page once and check the browser console is clean.

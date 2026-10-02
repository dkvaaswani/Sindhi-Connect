/* Engine tests — run with:  node --test tests/edu-calc/
   No dependencies. Uses the real dataset plus small synthetic datasets
   whose answers can be checked by hand. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const E = require('../../frontend/edu-calc/calc-engine.js');

const REAL = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/education/education-costs.json'), 'utf8'));

// Synthetic dataset: one country, flat 10,000 USD tuition, 2,000 living, no one-time costs, fee year = plan year.
function synth(extra) {
  return Object.assign({
    planStartYear: 2026,
    exchangeRates: { rates: { USD: 1, PKR: 280, GBP: 0.75 } },
    countries: [{ name: 'Testland', currency: 'USD', defaultCategory: 'Intl', defaultDuration: 4 },
                { name: 'Rupeeland', currency: 'PKR', defaultCategory: 'Intl', defaultDuration: 4 }],
    courseDurations: [],
    livingBenchmarks: [{ country: 'Testland', studentCategory: 'All', currency: 'USD', accommodation: 2000 },
                       { country: 'Rupeeland', studentCategory: 'All', currency: 'PKR', accommodation: 0 }],
    records: [
      { id: 'T1', country: 'Testland', qualification: 'Q', studentCategory: 'Intl', university: 'U1', tuition: 9000,
        currency: 'USD', feeYearStart: 2026, durationYears: 4, includeInAverage: true },
      { id: 'T2', country: 'Testland', qualification: 'Q', studentCategory: 'Intl', university: 'U2', tuition: 11000,
        currency: 'USD', feeYearStart: 2026, durationYears: 4, includeInAverage: true },
      { id: 'T3', country: 'Testland', qualification: 'Q', studentCategory: 'Intl', university: 'U3 (old)', tuition: 99999,
        currency: 'USD', feeYearStart: 2020, durationYears: 4, includeInAverage: false },
      { id: 'P1', country: 'Rupeeland', qualification: 'Q', studentCategory: 'Intl', university: 'PU', tuition: 2800000,
        currency: 'PKR', feeYearStart: 2026, durationYears: 4, includeInAverage: true }
    ]
  }, extra || {});
}

const A0 = { returnRate: 0, tuitionInflation: 0, livingInflation: 0, contributionEscalation: 0, contingency: 0, fxDrift: 0,
  contributionMode: 'monthly' };
const kid = (o) => Object.assign({ country: 'Testland', qualification: 'Q', benchmark: 'average', age: 10, entryAge: 18,
  duration: 4, savings: 0, monthly: 0, annual: 0, scholarshipPct: 0, scholarshipFixed: 0, otherFunding: 0 }, o);
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= (tol || 1e-6), (msg || '') + ` expected ${b}, got ${a}`);

test('1. one child, eight years until college (zero return: requirement = cost / contribution years)', () => {
  const r = E.projectChild(synth(), kid(), A0, 'USD');
  assert.equal(r.summary.yearsToCollege, 8);
  close(r.summary.totalCost, 4 * 12000);           // average tuition 10,000 + living 2,000
  assert.equal(r.summary.contributionYears, 11);   // years 1..11 (last cost paid at start of year 12)
  // with zero return the binding constraint is the first payment (12,000 needed after 8 years)
  // and cumulative needs: 12k by t=8, 24k by t=9, 36k by t=10, 48k by t=11 -> max(12/8, 24/9, 36/10, 48/11) = 48/11
  close(r.summary.requiredAnnualFirstYear, 48000 / 11, 1e-6);
  r.rows.forEach((row) => assert.ok(row.closingRequired > -1e-6));
});

test('2. two children with different ages run on their own timelines', () => {
  const f = E.projectFamily(synth(), { numChildren: 2, reportingCurrency: 'USD', assumptions: A0,
    children: [kid({ age: 5 }), kid({ age: 12 })] });
  assert.equal(f.children[0].summary.yearsToCollege, 13);
  assert.equal(f.children[1].summary.yearsToCollege, 6);
  close(f.totals.requiredAnnualFirstYear, f.children[0].summary.requiredAnnualFirstYear + f.children[1].summary.requiredAnnualFirstYear);
});

test('3. four children are all projected', () => {
  const f = E.projectFamily(synth(), { numChildren: 4, reportingCurrency: 'USD', assumptions: A0,
    children: [kid({ age: 2 }), kid({ age: 6 }), kid({ age: 9 }), kid({ age: 15 })] });
  assert.equal(f.children.length, 4);
  assert.ok(f.children.every((c) => c.ok));
  close(f.totals.totalCost, 4 * 48000);
});

test('4. changing college-entry age from 18 to 21 delays costs and lowers the monthly need', () => {
  const r18 = E.projectChild(synth(), kid({ entryAge: 18 }), A0, 'USD');
  const r21 = E.projectChild(synth(), kid({ entryAge: 21 }), A0, 'USD');
  assert.equal(r21.summary.yearsToCollege, 11);
  assert.ok(r21.summary.requiredMonthlyFirstYear < r18.summary.requiredMonthlyFirstYear);
});

test('5. child already of college age: immediate funding, no division by zero', () => {
  const r = E.projectChild(synth(), kid({ age: 19, entryAge: 18 }), A0, 'USD');
  assert.equal(r.summary.yearsToCollege, 0);
  assert.equal(r.summary.immediate, true);
  close(r.summary.requiredLumpNow, 12000);         // first year cannot be met by future contributions
  close(r.summary.requiredAnnualFirstYear, 12000); // years 2-4 met by contributions in years 1-3
  assert.ok(Number.isFinite(r.summary.requiredMonthlyFirstYear));
});

test('6. zero investment return: projection is plain addition', () => {
  const r = E.projectChild(synth(), kid({ savings: 1000, annual: 500 }), Object.assign({}, A0, { contributionMode: 'annual' }), 'USD');
  close(r.summary.fvSavingsAtStart, 1000);
  close(r.summary.fvContributionsAtStart, 500 * 8);
});

test('7. positive return reduces the requirement and grows savings', () => {
  const a = Object.assign({}, A0, { returnRate: 0.08 });
  const r = E.projectChild(synth(), kid({ savings: 1000 }), a, 'USD');
  close(r.summary.fvSavingsAtStart, 1000 * Math.pow(1.08, 8), 1e-6);
  const r0 = E.projectChild(synth(), kid({ savings: 1000 }), A0, 'USD');
  assert.ok(r.summary.requiredAnnualFirstYear < r0.summary.requiredAnnualFirstYear);
});

test('8. negative return is handled and increases the requirement', () => {
  const a = Object.assign({}, A0, { returnRate: -0.02 });
  const r = E.projectChild(synth(), kid(), a, 'USD');
  assert.ok(r.ok);
  const r0 = E.projectChild(synth(), kid(), A0, 'USD');
  assert.ok(r.summary.requiredAnnualFirstYear > r0.summary.requiredAnnualFirstYear);
  r.rows.forEach((row) => assert.ok(row.closingRequired > -1e-6));
});

test('9. zero inflation keeps every academic year the same', () => {
  const r = E.projectChild(synth(), kid(), A0, 'USD');
  const exp = r.rows.filter((x) => x.academicYear).map((x) => x.expense);
  exp.forEach((v) => close(v, 12000));
});

test('9b. inflation compounds separately for tuition and living', () => {
  const a = Object.assign({}, A0, { tuitionInflation: 0.1, livingInflation: 0.0 });
  const r = E.projectChild(synth(), kid(), a, 'USD');
  const first = r.rows[8];
  close(first.tuition, 10000 * Math.pow(1.1, 8), 1e-6);
  close(first.living, 2000, 1e-9);
});

test('10. existing savings that cover everything give zero requirement (never negative)', () => {
  const r = E.projectChild(synth(), kid({ savings: 100000 }), A0, 'USD');
  assert.equal(r.summary.requiredAnnualFirstYear, 0);
  assert.equal(r.summary.requiredLumpNow, 0);
  close(r.summary.coverage, 1);
  assert.ok(r.summary.surplusOrGap > 0);
});

test('11. scholarships reduce the cost', () => {
  const r = E.projectChild(synth(), kid({ scholarshipPct: 0.5, scholarshipFixed: 1000 }), A0, 'USD');
  close(r.summary.totalCost, 4 * (12000 - 5000 - 1000));
});

test('12. children attending different countries', () => {
  const f = E.projectFamily(synth(), { numChildren: 2, reportingCurrency: 'USD', assumptions: A0,
    children: [kid(), kid({ country: 'Rupeeland' })] });
  close(f.children[1].summary.totalCost, 4 * 10000);   // 2.8m PKR / 280 = 10,000 USD
});

test('13. reporting currency differs from the fee currency', () => {
  const r = E.projectChild(synth(), kid(), A0, 'PKR');
  close(r.summary.totalCost, 4 * 12000 * 280, 1e-3);
  const drift = E.projectChild(synth(), kid(), Object.assign({}, A0, { fxDrift: 0.05 }), 'PKR');
  close(drift.rows[8].expense, 12000 * 280 * Math.pow(1.05, 8), 1e-3);
});

test('14. missing university fee records: no crash, flagged, user estimate used', () => {
  const r = E.projectChild(synth(), kid({ qualification: 'Nothing here' }), A0, 'USD');
  assert.ok(r.ok);
  assert.equal(r.costs.hasTuitionData, false);
  const r2 = E.projectChild(synth(), kid({ qualification: 'Nothing here', overrides: { tuition: 5000 } }), A0, 'USD');
  assert.equal(r2.costs.hasTuitionData, true);
  assert.deepEqual(r2.costs.overridden, ['tuition']);
  close(r2.summary.totalCost, 4 * 7000);
});

test('15. one-year programme vs longer programme; fractional final year', () => {
  const one = E.projectChild(synth(), kid({ duration: 1 }), A0, 'USD');
  close(one.summary.totalCost, 12000);
  const half = E.projectChild(synth(), kid({ duration: 5.5 }), A0, 'USD');
  close(half.summary.totalCost, 5.5 * 12000);
  const zero = E.projectChild(synth(), kid({ duration: 0 }), A0, 'USD');
  close(zero.summary.totalCost, 0);
  assert.equal(zero.summary.requiredAnnualFirstYear, 0);
});

test('16. expenses fall in each academic year, not all at the start', () => {
  const r = E.projectChild(synth(), kid(), A0, 'USD');
  const years = r.rows.filter((x) => x.expense > 0).map((x) => x.p);
  assert.deepEqual(years, [9, 10, 11, 12]);
});

test('17. combined family schedule adds children year by year', () => {
  const f = E.projectFamily(synth(), { numChildren: 2, reportingCurrency: 'USD', assumptions: A0,
    children: [kid({ age: 10 }), kid({ age: 12 })] });
  const y9 = f.years[8];
  close(y9.expense, 12000 + 12000);  // child 1 year 1 and child 2 year 3
  close(f.years.reduce((s, y) => s + y.expense, 0), f.totals.totalCost);
});

test('18. invalid and missing inputs are rejected with messages', () => {
  const bad = E.projectChild(synth(), kid({ age: -1, entryAge: null, duration: 20 }), A0, 'USD');
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 3);
  const badA = E.projectChild(synth(), kid(), Object.assign({}, A0, { returnRate: -1 }), 'USD');
  assert.equal(badA.ok, false);
});

test('averages exclude flagged records and report median/range', () => {
  const s = E.benchmarkStats(synth(), 'Testland', 'Q', 'Intl');
  assert.equal(s.count, 2);
  close(s.avgTuition, 10000); close(s.medianTuition, 10000);
  assert.equal(s.minTuition, 9000); assert.equal(s.maxTuition, 11000);
  const single = E.benchmarkStats(synth(), 'Rupeeland', 'Q', 'Intl');
  assert.equal(single.single, true);
});

test('monthly timing factor: 12 end-of-month payments at monthly-equivalent rate', () => {
  const r = 0.12, rm = Math.pow(1.12, 1 / 12) - 1;
  let fv = 0; for (let m = 1; m <= 12; m++) fv += Math.pow(1 + rm, 12 - m);
  close(E.monthlyTimingFactor(r) * 12, fv, 1e-9);
});

test('real dataset: every core benchmark resolves and projects', () => {
  REAL.countries.forEach((c) => {
    ['Computer Science', 'Mechanical Engineering', 'Business Administration'].forEach((q) => {
      const cats = E.categoriesFor(REAL, c.name, q);
      cats.forEach((cat) => {
        const r = E.projectChild(REAL, kid({ country: c.name, qualification: q, studentCategory: cat, duration: 4 }),
          Object.assign({}, A0, { returnRate: 0.06, tuitionInflation: 0.05, livingInflation: 0.03 }), 'USD');
        assert.ok(r.ok, c.name + ' ' + q);
        assert.ok(r.summary.totalCost > 0, c.name + ' ' + q + ' ' + cat);
      });
    });
  });
});

test('real dataset: requirement keeps the fund non-negative', () => {
  const a = { returnRate: 0.12, tuitionInflation: 0.1, livingInflation: 0.08, contributionEscalation: 0.05, contingency: 0.05,
    fxDrift: 0, contributionMode: 'monthly' };
  const r = E.projectChild(REAL, kid({ country: 'Pakistan', qualification: 'Medicine — MBBS/MD', studentCategory: 'Pakistani national',
    age: 6, duration: 5, savings: 200000, monthly: 10000 }), a, 'PKR');
  r.rows.forEach((row) => {
    const after = row.openingRequired + row.otherFunding - row.expense;
    assert.ok(after > -1e-3, 'year ' + row.p + ' ' + after);
  });
});

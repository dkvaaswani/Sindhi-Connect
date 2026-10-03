/* Engine tests for the Children's Future Education Fund calculator (dataset/engine v2).
   Run with Node 18+:  node --test tests/edu-calc/engine.test.js
   No dependencies. The same checks were run in the browser for the v2 release (TEST_REPORT.md). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');
const E = require(path.join(root, 'frontend', 'edu-calc', 'calc-engine.js'));
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'frontend', 'edu-calc', 'education-data.js'), 'utf8'), ctx);
const D = ctx.window.EDU_DATA;

const COUNTRIES = D.countries.map((c) => c.name);
const QUALS = D.qualifications.map((q) => q.name);
const A = (o) => Object.assign({ reportingCurrency: 'USD', returnRate: 0.06, savingsIncrease: 0, coverage: 0 }, o || {});
const close = (a, b, tol) => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * (tol || 1e-9));

function invariants(label, fam) {
  fam.children.forEach((k) => {
    if (!k.ok) return;
    const s = k.summary;
    assert.ok(s.firstYearSaving >= -1e-9 && s.lumpNow >= -1e-9, label + ': negative saving');
    let bal = s.lumpNow;
    k.rows.forEach((r) => {
      assert.ok(bal - r.expense >= -1e-6 * Math.max(1, r.expense), label + ': fund below zero in ' + r.year);
      bal = r.closing;
    });
    const parts = Object.values(s.byGroup).reduce((a, b) => a + b, 0);
    assert.ok(close(parts, s.totalCost), label + ': breakdown does not add up');
  });
  const sched = fam.years.reduce((a, y) => a + y.expense, 0);
  assert.ok(close(sched, fam.totals.totalCost), label + ': schedule does not add up');
}

test('every offered course has a published or estimated fee, and unavailable ones are flagged', () => {
  for (const c of COUNTRIES) for (const q of QUALS) for (const nat of ['Pakistan', 'UK', 'Germany', 'USA']) {
    const d = E.courseDuration(D, c, q);
    const fam = E.projectFamily(D, { numChildren: 1, family: { nationality: nat, residence: 'Qatar' }, assumptions: A(),
      children: [{ age: 8, entryAge: 18, country: c, qualification: q, overrides: {} }] });
    const k = fam.children[0];
    assert.equal(k.ok, d.available, c + ' / ' + q);
    if (k.ok) assert.equal(k.summary.hasMissing, false, c + ' / ' + q + ' / ' + nat + ' has missing costs');
    invariants(c + ' / ' + q + ' / ' + nat, fam);
  }
});

test('1–4 children, all ages, coverage, zero and negative returns', () => {
  const ages = [0, 3, 7, 12, 16, 17, 18];
  for (let n = 1; n <= 4; n++) for (const cov of [0, 0.2, 0.5, 1]) for (const r of [0, 0.06, -0.02, 0.15]) {
    const kids = [0, 1, 2, 3].map((i) => ({ age: ages[(i * 2 + n) % ages.length], entryAge: 18,
      country: COUNTRIES[(i + n) % 6], qualification: QUALS[(i * 5 + n) % QUALS.length], overrides: {} }));
    invariants('n' + n + ' c' + cov + ' r' + r, E.projectFamily(D, { numChildren: n, family: { nationality: 'India', residence: 'India' },
      assumptions: A({ reportingCurrency: 'GBP', returnRate: r, savingsIncrease: 0.03, coverage: cov }), children: kids }));
  }
});

test('scholarship / part-time work reduces eligible costs exactly once', () => {
  const base = { numChildren: 1, family: { nationality: 'Pakistan', residence: 'Pakistan' },
    children: [{ age: 10, entryAge: 18, country: 'UK', qualification: 'Law', overrides: {} }] };
  const t0 = E.projectFamily(D, Object.assign({}, base, { assumptions: A({ reportingCurrency: 'GBP', returnRate: 0.05 }) })).totals;
  const t20 = E.projectFamily(D, Object.assign({}, base, { assumptions: A({ reportingCurrency: 'GBP', returnRate: 0.05, coverage: 0.2 }) })).totals;
  assert.ok(close(t20.totalCost, t0.totalCost - 0.2 * (t0.totalCost - t0.byGroup.visaTravel)));
  const t100 = E.projectFamily(D, Object.assign({}, base, { assumptions: A({ reportingCurrency: 'GBP', returnRate: 0.05, coverage: 1 }) })).totals;
  assert.ok(close(t100.totalCost, t0.byGroup.visaTravel));
});

test('zero return: yearly saving = total cost / saving years', () => {
  const k = E.projectChild(D, { age: 10, entryAge: 18, country: 'Pakistan', qualification: 'Computer Science', overrides: {} },
    { nationality: 'Pakistan', residence: 'Pakistan' }, A({ reportingCurrency: 'PKR', returnRate: 0 }));
  assert.ok(close(k.summary.firstYearSaving, k.summary.totalCost / k.summary.savingYears));
});

test('child already at college age needs the first year now, never a negative saving', () => {
  const k = E.projectChild(D, { age: 18, entryAge: 18, country: 'Pakistan', qualification: 'Computer Science', overrides: {} },
    { nationality: 'Pakistan', residence: 'Pakistan' }, A({ reportingCurrency: 'PKR', returnRate: 0.12 }));
  assert.ok(close(k.summary.lumpNow, k.rows[0].expense));
  assert.ok(k.summary.firstYearSaving >= 0);
});

test('fee status, visa and duration follow nationality, country and qualification', () => {
  const uk = E.resolveCosts(D, { country: 'UK', qualification: 'Computer Science', overrides: {} }, { nationality: 'UK', residence: 'UK' });
  assert.equal(uk.feeStatus, 'domestic');
  assert.equal(uk.items.visaApplication.amount, 0);
  const intl = E.resolveCosts(D, { country: 'UK', qualification: 'Computer Science', overrides: {} }, { nationality: 'Pakistan', residence: 'Qatar' });
  assert.equal(intl.feeStatus, 'international');
  assert.ok(intl.items.visaApplication.amount > 0);
  assert.equal(E.courseDuration(D, 'UK', 'Medicine (MBBS/MD)').years, 5);
  assert.equal(E.courseDuration(D, 'USA', 'Medicine (MBBS/MD)').years, 8);
  assert.equal(E.courseDuration(D, 'UK', 'CPA').available, false);
});

test('country comparison matches the plan for the same country', () => {
  const fam = { nationality: 'Pakistan', residence: 'Pakistan' };
  const child = { age: 10, entryAge: 18, country: 'UK', qualification: 'Law', overrides: {} };
  const plan = E.projectChild(D, child, fam, A({ reportingCurrency: 'GBP', returnRate: 0.05 }));
  const cmp = E.compareCountries(D, child, fam, A({ reportingCurrency: 'GBP', returnRate: 0.05 }), ['UK'])[0];
  assert.ok(close(cmp.totalCost, plan.summary.totalCost));
});

/* ---------- yearly fund roll-forward (opening, savings, growth, expenses, closing) ---------- */

// Every child row and every family year must satisfy the roll-forward identity, chain closing -> next opening,
// and reconcile: amount needed now + savings + growth - expenses = what is left at the end.
function rollForward(label, fam) {
  const tol = (v) => 1e-6 * Math.max(1, Math.abs(v));
  fam.children.forEach((k, ci) => {
    if (!k.ok) return;
    let prev = null;
    k.rows.forEach((r) => {
      assert.ok(Math.abs(r.opening - r.expense + r.growthAmount + r.saving - r.closing) <= tol(r.closing), label + ' c' + ci + ': identity ' + r.year);
      assert.ok(Math.abs(r.opening - (prev === null ? k.summary.lumpNow : prev)) <= tol(r.opening), label + ' c' + ci + ': chain ' + r.year);
      assert.ok(r.opening - r.expense >= -tol(r.expense), label + ' c' + ci + ': fund short in ' + r.year);
      prev = r.closing;
    });
  });
  let prev = null;
  fam.years.forEach((y) => {
    assert.ok(Math.abs(y.opening - y.expense + y.growth + y.saving - y.fund) <= tol(y.fund), label + ': family identity ' + y.year);
    if (prev !== null) assert.ok(Math.abs(y.opening - prev) <= tol(prev), label + ': family chain ' + y.year);
    else assert.ok(Math.abs(y.opening - fam.totals.lumpNow) <= tol(y.opening), label + ': first opening = amount needed now');
    prev = y.fund;
  });
  const t = fam.totals;
  assert.ok(close(fam.years.reduce((s, y) => s + y.expense, 0), t.totalCost), label + ': expenses = total cost');
  assert.ok(Math.abs(t.lumpNow + t.totalSaved + t.totalGrowth - t.totalCost - t.finalFund) <= tol(t.totalCost), label + ': reconciliation');
  assert.ok(t.finalFund >= -tol(t.totalCost), label + ': negative final fund');
}

// Expected yearly cost straight from the cost rules (independent of projectChild)
function expectedExpenses(child, family, a, years) {
  const costs = E.resolveCosts(D, child, family);
  const fx = E.convert(family.rates || D.exchangeRates.rates, 1, costs.currency, a.reportingCurrency);
  const rate = { tuition: costs.tuitionInflation, living: costs.livingInflation };
  return Array.from({ length: years }, (_, k) => E.ITEMS.reduce((s, it) => {
    if (!(it.timing === 'annual' || k === 0)) return s;
    const src = costs.items[it.key];
    const year = D.planStartYear + (child.entryAge - child.age) + k;
    const v = src.amount * Math.pow(1 + rate[it.inflation], year - src.baseYear) * fx;
    return s + (it.covered ? v * (1 - a.coverage) : v);
  }, 0));
}

test('worked example: 1 child, Computer Science in Pakistan, 4 years from 2026/27, all rates 0%', () => {
  const family = { nationality: 'Pakistan', residence: 'Pakistan' };
  const a = A({ reportingCurrency: 'PKR', returnRate: 0, savingsIncrease: 0, coverage: 0 });
  const child = { age: 18, entryAge: 18, country: 'Pakistan', qualification: 'Computer Science', overrides: {}, tuitionInflation: 0, livingInflation: 0 };
  const fam = E.projectFamily(D, { numChildren: 1, family, assumptions: a, children: [child] });
  const k = fam.children[0];
  assert.equal(k.ok, true);
  assert.equal(k.duration.used, 4);
  assert.equal(k.summary.startYear, D.planStartYear);
  assert.equal(fam.years.length, 4);

  // 1. each year's cost from the rules; with 0% inflation years 2-4 are equal, year 1 adds the one-time costs
  const exp = expectedExpenses(child, family, a, 4);
  k.rows.forEach((r, i) => assert.ok(close(r.expense, exp[i]), 'expense year ' + (i + 1)));
  assert.ok(close(exp[1], exp[2]) && close(exp[2], exp[3]));
  assert.ok(exp[0] > exp[1]);
  const total = exp.reduce((s, v) => s + v, 0);
  assert.ok(close(fam.totals.totalCost, total));

  // 2. the course starts now, so year 1 must be paid now; savings at the end of years 1-3 pay years 2-4
  assert.ok(close(fam.totals.lumpNow, exp[0]));
  let need = 0;
  for (let p = 1; p <= 3; p++) need = Math.max(need, (exp.slice(0, p + 1).reduce((s, v) => s + v, 0) - exp[0]) / p);
  assert.ok(close(fam.totals.firstYearSaving, need));
  assert.deepEqual(fam.years.map((y) => y.saving > 0), [true, true, true, false]);
  assert.equal(fam.totals.totalGrowth, 0);

  // 3. roll-forward: opening(1) = amount needed now, closing -> next opening, nothing left at the end
  rollForward('worked example', fam);
  assert.ok(close(fam.years[0].opening, exp[0]));
  assert.ok(Math.abs(fam.totals.finalFund) < 1e-6);
  assert.ok(close(fam.totals.lumpNow + fam.totals.totalSaved, total));
});

test('roll-forward holds for 1-4 children, several currencies, returns, scholarships and savings increases', () => {
  const ages = [0, 4, 9, 13, 16, 17, 18];
  let n = 0;
  for (const ccy of ['PKR', 'GBP', 'USD', 'EUR', 'AUD', 'INR']) for (const r of [0, 0.04, 0.08]) for (const cov of [0, 0.25, 1]) for (const g of [0, 0.05]) {
    n = (n % 4) + 1;
    const kids = [0, 1, 2, 3].map((i) => ({ age: ages[(i * 3 + n) % ages.length], entryAge: 18,
      country: COUNTRIES[(i + n) % COUNTRIES.length], qualification: QUALS[(i * 7 + n) % QUALS.length], overrides: {} }));
    const fam = E.projectFamily(D, { numChildren: n, family: { nationality: 'Pakistan', residence: 'Qatar' },
      assumptions: A({ reportingCurrency: ccy, returnRate: r, savingsIncrease: g, coverage: cov }), children: kids });
    const label = [ccy, 'r' + r, 'c' + cov, 'g' + g, 'n' + n].join(' ');
    invariants(label, fam);
    rollForward(label, fam);
  }
});

test('positive return: yearly saving is the smallest amount that keeps the fund from running out', () => {
  const family = { nationality: 'Pakistan', residence: 'Pakistan' };
  const a = A({ reportingCurrency: 'PKR', returnRate: 0.08, savingsIncrease: 0.05 });
  const child = { age: 9, entryAge: 18, country: 'UK', qualification: 'Medicine (MBBS/MD)', overrides: {} };
  const k = E.projectChild(D, child, family, a);
  const fundShort = (x) => {      // replay the year-by-year rules with saving x
    let bal = k.summary.lumpNow;
    return k.rows.some((r, i) => {
      if (bal - r.expense < -1e-6) return true;
      bal = (bal - r.expense) * (1 + a.returnRate) + (i < k.summary.savingYears ? x * Math.pow(1 + a.savingsIncrease, i) : 0);
      return false;
    });
  };
  assert.equal(fundShort(k.summary.firstYearSaving), false);
  assert.equal(fundShort(k.summary.firstYearSaving * 0.999), true);
  assert.ok(k.rows.some((r) => r.growthAmount > 0));
});

test('inflation: each year\'s cost grows by the configured rate', () => {
  const family = { nationality: 'Pakistan', residence: 'Pakistan' };
  const a = A({ reportingCurrency: 'PKR', returnRate: 0 });
  const child = { age: 12, entryAge: 18, country: 'Pakistan', qualification: 'Computer Science', overrides: {}, tuitionInflation: 0.1, livingInflation: 0.07 };
  const k = E.projectChild(D, child, family, a);
  const yearsToStart = k.rows.findIndex((r) => r.academicYear === 1);
  const r2 = k.rows[yearsToStart + 1], r3 = k.rows[yearsToStart + 2];
  assert.ok(close(r3.items.tuition / r2.items.tuition, 1.1));
  assert.ok(close(r3.items.food / r2.items.food, 1.07));
  const exp = expectedExpenses(child, family, a, 4);
  k.rows.slice(yearsToStart).forEach((r, i) => assert.ok(close(r.expense, exp[i]), 'inflated expense year ' + (i + 1)));
});

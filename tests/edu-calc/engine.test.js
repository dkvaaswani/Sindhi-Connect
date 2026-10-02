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

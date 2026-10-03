/* Web side of the Excel-vs-web parity check (method v2).
   1. powershell -ExecutionPolicy Bypass -File tests/edu-calc/excel-parity.ps1   (writes excel-results.json)
   2. node tests/edu-calc/parity-js.js                                            (compares with the web engine)
   compare(E, D, scenarios, results) is also used to run the check in a browser. */
'use strict';

function compare(E, D, scenarios, results) {
  const problems = [];
  const near = (a, b) => Math.abs((a || 0) - (b || 0)) <= Math.max(1, Math.abs(b || 0) * 1e-6);
  const check = (label, xl, web) => { if (!near(xl, web)) problems.push(label + ': Excel ' + xl + ' vs web ' + web); };
  scenarios.forEach((s, si) => {
    const x = results[si];
    const f = s.family;
    const firstCountry = (s.children[0] || {}).country;
    const ccy = f.repCcy === 'Automatic' ? ((D.countries.find((c) => c.name === firstCountry) || {}).currency || 'USD') : f.repCcy;
    const rates = Object.assign({}, D.exchangeRates.rates, s.fx || {});
    const family = { nationality: f.nationality, residence: f.residence, rates };
    const ret = f.ret === null || f.ret === undefined ? E.defaultReturn(D, ccy) : f.ret;
    const a = { reportingCurrency: ccy, returnRate: ret, savingsIncrease: f.savInc, coverage: f.coverage };
    const kids = s.children.map((c) => ({ age: c.age, entryAge: c.entryAge, country: c.country || '', qualification: c.qualification || '',
      overrides: c.overrides || {}, tuitionInflation: c.tInf === undefined ? null : c.tInf, livingInflation: c.lInf === undefined ? null : c.lInf }));
    const fam = E.projectFamily(D, { numChildren: f.numChildren, family, assumptions: a, children: kids });
    const L = s.name;
    if (x.currency !== ccy) problems.push(L + ': currency Excel ' + x.currency + ' vs web ' + ccy);
    check(L + ' total', x.total, fam.totals.totalCost);
    check(L + ' yearly saving', x.saving, fam.totals.firstYearSaving);
    check(L + ' needed now', x.lump, fam.totals.lumpNow);
    if (x.planYears !== fam.years.length) problems.push(L + ': plan years Excel ' + x.planYears + ' vs web ' + fam.years.length);
    fam.children.forEach((k, i) => {
      check(L + ' child ' + (i + 1) + ' total', x.children[i].total, k.ok ? k.summary.totalCost : 0);
      if (!k.ok && !x.children[i].message && s.children[i] && s.children[i].country) problems.push(L + ': child ' + (i + 1) + ' should show a message');
    });
    fam.years.forEach((y, p) => {
      const xy = x.years[p] || {};
      check(L + ' ' + y.year + ' opening', xy.opening, y.opening);
      check(L + ' ' + y.year + ' savings', xy.saving, y.saving);
      check(L + ' ' + y.year + ' growth', xy.growth, y.growth);
      check(L + ' ' + y.year + ' expenses', xy.expense, y.expense);
      check(L + ' ' + y.year + ' closing', xy.closing, y.fund);
    });
    // compare countries for the selected child
    const ci = (s.cmpChild || 1) - 1;
    const k = fam.children[ci];
    if (k && k.ok) {
      const list = E.compareCountries(D, kids[ci], family, a, D.countries.map((c) => c.name));
      list.forEach((r, j) => {
        const xr = x.compare[j];
        if (!r.available) { if (xr.total !== 'Not available') problems.push(L + ' compare ' + r.country + ': Excel ' + xr.total + ' vs web Not available'); return; }
        check(L + ' compare ' + r.country, xr.total, r.totalCost);
      });
    }
  });
  return problems;
}

if (typeof module === 'object' && module.exports && require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const root = path.join(__dirname, '..', '..');
  const E = require(path.join(root, 'frontend', 'edu-calc', 'calc-engine.js'));
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'frontend', 'edu-calc', 'education-data.js'), 'utf8'), ctx);
  const scenarios = JSON.parse(fs.readFileSync(path.join(__dirname, 'parity-scenarios.json'), 'utf8')).scenarios;
  const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'excel-results.json'), 'utf8'));
  const problems = compare(E, ctx.window.EDU_DATA, scenarios, results);
  problems.forEach((p) => console.log('MISMATCH ' + p));
  console.log(problems.length ? problems.length + ' mismatches' : 'Excel matches the web engine in all ' + scenarios.length + ' scenarios.');
  process.exitCode = problems.length ? 1 : 0;
} else if (typeof module === 'object' && module.exports) {
  module.exports = { compare };
} else {
  window.parityCompare = compare;
}

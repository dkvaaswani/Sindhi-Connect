/* Prints JS-engine results for tests/edu-calc/parity-scenarios.json (used by excel_parity.py). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const E = require('../../frontend/edu-calc/calc-engine.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/education/education-costs.json'), 'utf8'));
const scenarios = JSON.parse(fs.readFileSync(path.join(__dirname, 'parity-scenarios.json'), 'utf8'));
const pick = (v, d) => (v === null || v === undefined || v === '' ? d : v);

// Mirrors the "value used" logic of the Parent Inputs sheet.
function toEngine(s) {
  const f = s.family;
  const eduCountry = pick(f.eduCountry, 'Pakistan');
  const d = E.familyDefaults(data, eduCountry, pick(f.repCcy, null));
  const a = {
    returnRate: pick(f.ret, d.returnRate), tuitionInflation: pick(f.tuiInf, d.tuitionInflation),
    livingInflation: pick(f.livInf, d.livingInflation), contributionEscalation: pick(f.esc, d.contributionEscalation),
    contingency: pick(f.cont, d.contingency), fxDrift: pick(f.fxDrift, d.fxDrift),
    contributionMode: pick(f.mode, 'Monthly') === 'Annual' ? 'annual' : 'monthly'
  };
  const children = s.children.map((c) => {
    const country = pick(c.country, eduCountry);
    const info = E.countryInfo(data, country);
    const category = pick(c.category, info ? info.defaultCategory : '');
    const benchmark = !c.university || c.university === 'University average' ? 'average'
      : E.recordIdFor(data, country, c.qualification, category, c.university);
    const child = { country, studentCategory: category, qualification: c.qualification, benchmark,
      age: c.age, entryAge: pick(c.entryAge, pick(f.entryAge, 18)), savings: c.savings || 0, monthly: c.monthly || 0,
      annual: c.annual || 0, scholarshipPct: c.schPct || 0, scholarshipFixed: c.schFixed || 0, otherFunding: c.otherFunding || 0,
      overrides: c.overrides || {} };
    child.duration = pick(c.duration, E.childDuration(data, child));
    return child;
  });
  return { numChildren: f.numChildren, reportingCurrency: d.reportingCurrency, assumptions: a, children };
}

const out = scenarios.map((s) => {
  const fam = E.projectFamily(data, toEngine(s));
  return { name: s.name, children: fam.children.map((k) => (k.ok ? k.summary : { invalid: true })), totals: fam.totals };
});
process.stdout.write(JSON.stringify(out));

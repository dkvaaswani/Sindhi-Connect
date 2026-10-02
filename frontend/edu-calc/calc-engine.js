/* =========================================================
   Children's Future Education Fund — calculation engine.
   Pure functions, no DOM. The Excel workbook implements the
   same rules; see docs/education-calculator/METHODOLOGY.md.

   Timing convention (one row = one plan year p = 1, 2, ...):
   - Plan year p runs from time p-1 to time p (years from today).
   - Education costs for an academic year are paid at the START
     of the plan year in which that academic year begins.
   - Other planned funding arrives with the first academic year.
   - Monthly contributions are paid at the end of each month;
     annual contributions at the end of the year.
   - Investment return is applied to what is left after costs.
   ========================================================= */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EduCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LIVING_FIELDS = ['accommodation', 'food', 'transport', 'healthInsurance', 'books', 'personal', 'combinedLiving'];
  const COST_FIELDS = ['tuition', 'otherMandatoryAnnual'].concat(LIVING_FIELDS,
    ['oneTimeAdmission', 'otherOneTime', 'visaApplication', 'travelRelocation']);

  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const isNum = (v) => typeof v === 'number' && isFinite(v);

  /* ---------- Benchmarks ---------- */

  function recordsFor(data, country, qualification, category) {
    return data.records.filter((r) => r.country === country && r.qualification === qualification &&
      (!category || r.studentCategory === category));
  }

  function median(values) {
    if (!values.length) return null;
    const s = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

  // University-average statistics: only records flagged includeInAverage, same currency.
  function benchmarkStats(data, country, qualification, category) {
    const valid = recordsFor(data, country, qualification, category)
      .filter((r) => r.includeInAverage && isNum(r.tuition));
    if (!valid.length) return null;
    const currency = valid[0].currency;
    const same = valid.filter((r) => r.currency === currency);
    const t = same.map((r) => r.tuition);
    return {
      count: same.length,
      single: same.length === 1,
      currency,
      avgTuition: mean(t),
      medianTuition: median(t),
      minTuition: Math.min.apply(null, t),
      maxTuition: Math.max.apply(null, t),
      avgOtherMandatory: mean(same.map((r) => num(r.otherMandatoryAnnual))),
      avgOneTimeAdmission: mean(same.map((r) => num(r.oneTimeAdmission))),
      avgOtherOneTime: mean(same.map((r) => num(r.otherOneTime))),
      avgDuration: mean(same.map((r) => num(r.durationYears))),
      feeYearStart: Math.round(mean(same.map((r) => num(r.feeYearStart)))),
      feeYears: Array.from(new Set(same.map((r) => r.feeYear))),
      records: same
    };
  }

  function categoriesFor(data, country, qualification) {
    return Array.from(new Set(recordsFor(data, country, qualification).map((r) => r.studentCategory)));
  }

  function livingBenchmark(data, country, category) {
    const list = data.livingBenchmarks.filter((l) => l.country === country);
    return list.find((l) => l.studentCategory === category) ||
      list.find((l) => l.studentCategory === 'All') || list[0] || null;
  }

  function countryInfo(data, country) {
    return data.countries.find((c) => c.name === country) || null;
  }

  function defaultDuration(data, country, qualification) {
    const d = data.courseDurations.find((x) => x.country === country && x.qualification === qualification);
    if (d) return d.years;
    const c = countryInfo(data, country);
    return c ? c.defaultDuration : 4;
  }

  /* Resolve the cost basis for one child.
     child.benchmark: 'average' or a record id. child.overrides: { field: value } in fee currency. */
  function resolveCosts(data, child) {
    const country = child.country;
    const info = countryInfo(data, country);
    const category = child.studentCategory || (info && info.defaultCategory) || '';
    const living = livingBenchmark(data, country, category);
    const base = {};
    COST_FIELDS.forEach((f) => { base[f] = 0; });
    const out = { country, qualification: child.qualification, studentCategory: category, base, sources: [],
      benchmarkLabel: '', stats: null, livingNote: '', currency: info ? info.currency : 'USD',
      feeYearStart: data.planStartYear, hasTuitionData: false, overridden: [] };

    let record = null;
    if (child.benchmark && child.benchmark !== 'average') {
      record = data.records.find((r) => r.id === child.benchmark) || null;
    }
    const stats = benchmarkStats(data, country, child.qualification, category);
    out.stats = stats;

    if (record) {
      out.currency = record.currency;
      base.tuition = num(record.tuition);
      base.otherMandatoryAnnual = num(record.otherMandatoryAnnual);
      base.oneTimeAdmission = num(record.oneTimeAdmission);
      base.otherOneTime = num(record.otherOneTime);
      out.feeYearStart = record.feeYearStart || data.planStartYear;
      out.benchmarkLabel = record.university + (record.includeInAverage ? '' : ' (' + record.status + ')');
      out.sources.push({ label: record.university + ' — ' + record.feeYear, url: record.sourceUrl, status: record.status });
      out.hasTuitionData = isNum(record.tuition);
    } else if (stats) {
      out.currency = stats.currency;
      base.tuition = stats.avgTuition;
      base.otherMandatoryAnnual = stats.avgOtherMandatory;
      base.oneTimeAdmission = stats.avgOneTimeAdmission;
      base.otherOneTime = stats.avgOtherOneTime;
      out.feeYearStart = stats.feeYearStart;
      out.benchmarkLabel = stats.single ? 'Single-institution benchmark' : 'Average of ' + stats.count + ' universities';
      stats.records.forEach((r) => out.sources.push({ label: r.university + ' — ' + r.feeYear, url: r.sourceUrl, status: r.status }));
      out.hasTuitionData = true;
    } else {
      out.benchmarkLabel = 'No verified fee record — enter your own estimate';
    }

    const useRecordLiving = record && record.livingFromRecord;
    const livingSrc = useRecordLiving ? record : living;
    if (livingSrc) {
      LIVING_FIELDS.forEach((f) => { base[f] = num(livingSrc[f]); });
      out.livingNote = useRecordLiving ? 'Living costs from ' + record.university : (living.status || '');
      if (!useRecordLiving) out.sources.push({ label: 'Living costs — ' + living.year, url: living.sourceUrl, status: living.status });
      // a living benchmark in another currency than the fees is converted at the reference rate
      if (!useRecordLiving && living.currency !== out.currency) {
        LIVING_FIELDS.forEach((f) => { base[f] = convert(data, base[f], living.currency, out.currency); });
      }
    }
    if (living) base.visaApplication = convert(data, num(living.visaApplication), living.currency, out.currency);

    // user overrides win and are flagged
    const ov = child.overrides || {};
    Object.keys(ov).forEach((f) => {
      if (COST_FIELDS.indexOf(f) !== -1 && isNum(ov[f])) { base[f] = ov[f]; out.overridden.push(f); }
    });
    if (out.overridden.indexOf('tuition') !== -1) out.hasTuitionData = true;
    return out;
  }

  /* ---------- Currency ---------- */

  function rate(data, ccy) {
    const r = data.exchangeRates.rates[ccy];
    if (!isNum(r) || r <= 0) throw new Error('No exchange rate for ' + ccy);
    return r;
  }

  function convert(data, amount, from, to) {
    if (from === to) return amount;
    return amount / rate(data, from) * rate(data, to);
  }

  /* ---------- Validation ---------- */

  function validateChild(child) {
    const errors = [];
    const age = child.age;
    if (!isNum(age) || age < 0 || age > 40 || Math.round(age) !== age) errors.push('Current age must be a whole number from 0 to 40.');
    if (!isNum(child.entryAge) || child.entryAge < 14 || child.entryAge > 45 || Math.round(child.entryAge) !== child.entryAge) {
      errors.push('College-entry age must be a whole number from 14 to 45.');
    }
    if (!isNum(child.duration) || child.duration < 0 || child.duration > 10) errors.push('Course duration must be between 0 and 10 years.');
    ['savings', 'monthly', 'annual', 'scholarshipFixed', 'otherFunding'].forEach((f) => {
      if (child[f] != null && (!isNum(child[f]) || child[f] < 0)) errors.push(f + ' cannot be negative.');
    });
    if (child.scholarshipPct != null && (!isNum(child.scholarshipPct) || child.scholarshipPct < 0 || child.scholarshipPct > 1)) {
      errors.push('Scholarship percentage must be between 0% and 100%.');
    }
    if (!child.country) errors.push('Choose an education country.');
    if (!child.qualification) errors.push('Choose a qualification.');
    return errors;
  }

  function validateAssumptions(a) {
    const errors = [];
    if (!isNum(a.returnRate) || a.returnRate <= -0.99 || a.returnRate > 0.5) errors.push('Investment return must be between -99% and 50%.');
    ['tuitionInflation', 'livingInflation', 'contributionEscalation', 'fxDrift'].forEach((f) => {
      if (!isNum(a[f]) || a[f] <= -0.5 || a[f] > 0.5) errors.push(f + ' must be between -50% and 50%.');
    });
    if (!isNum(a.contingency) || a.contingency < 0 || a.contingency > 1) errors.push('Contingency must be between 0% and 100%.');
    return errors;
  }

  /* ---------- Projection ---------- */

  // Year-end value of 12 end-of-month payments, per unit of annual total
  function monthlyTimingFactor(r) {
    if (r === 0) return 1;
    const rm = Math.pow(1 + r, 1 / 12) - 1;
    return (r / rm) / 12;
  }

  function projectChild(data, child, a, reportingCurrency) {
    const errors = validateChild(child).concat(validateAssumptions(a));
    if (errors.length) return { ok: false, errors };

    const costs = resolveCosts(data, child);
    const b = costs.base;
    const r = a.returnRate, g = a.contributionEscalation, it = a.tuitionInflation, il = a.livingInflation;
    const n = Math.max(0, child.entryAge - child.age);
    const D = child.duration;
    const eduYears = Math.ceil(D);
    const H = n + eduYears;                    // plan years with a cost
    const P = Math.max(0, H - 1);              // contribution years that can still help
    const offset = data.planStartYear - costs.feeYearStart;
    const fx0 = convert(data, 1, costs.currency, reportingCurrency);
    const fM = monthlyTimingFactor(r);
    const livingBase = LIVING_FIELDS.reduce((s, f) => s + num(b[f]), 0);
    const S0 = num(child.savings), m0 = num(child.monthly), a0 = num(child.annual);

    const rows = [];
    let lin = S0, unit = 0, flo = S0;
    for (let p = 1; p <= Math.max(H, 1); p++) {
      const k = p - 1 - n;
      const inEdu = k >= 0 && k < eduYears;
      const frac = inEdu ? Math.min(1, D - k) : 0;
      const e = (p - 1) + offset;
      const ti = Math.pow(1 + it, e), li = Math.pow(1 + il, e);
      const tuition = b.tuition * ti * frac;
      const other = b.otherMandatoryAnnual * ti * frac;
      const living = livingBase * li * frac;
      const oneTime = inEdu && k === 0
        ? (b.oneTimeAdmission + b.otherOneTime) * ti + (b.visaApplication + b.travelRelocation) * li : 0;
      const gross = tuition + other + living + oneTime;
      const contingency = gross * a.contingency;
      const schPct = Math.min(tuition, tuition * num(child.scholarshipPct));
      const fx = fx0 * Math.pow(1 + num(a.fxDrift), p - 1);
      const scholarship = schPct * fx + (inEdu ? num(child.scholarshipFixed) * frac : 0);
      const costRep = (gross + contingency) * fx;
      const expense = Math.max(0, costRep - scholarship);
      const otherFunding = inEdu && k === 0 ? num(child.otherFunding) : 0;
      const contribYear = p <= P;
      const esc = Math.pow(1 + g, p - 1);
      const existingContrib = contribYear ? (m0 * 12 * fM + a0) * esc : 0;
      const unitContrib = contribYear ? (a.contributionMode === 'annual' ? 1 : fM) * esc : 0;

      // linear model (used to solve the requirement)
      const availLin = lin + otherFunding - expense;
      const availUnit = unit;
      // floored model (current plan only: unfunded costs become a shortfall)
      const availFlo = flo + otherFunding - expense;
      const shortfall = Math.max(0, -availFlo);

      rows.push({ p, age: child.age + p - 1, academicYear: inEdu ? k + 1 : null, fraction: frac,
        tuition: tuition * fx, otherFees: other * fx, living: living * fx, oneTime: oneTime * fx,
        contingency: contingency * fx, scholarship: Math.min(scholarship, costRep), expense, otherFunding,
        existingContrib, unitContrib, a: availLin, b: availUnit, l: Math.pow(1 + r, p - 1),
        openingCurrent: flo, shortfall });

      lin = availLin * (1 + r) + existingContrib;
      unit = availUnit * (1 + r) + unitContrib;
      flo = Math.max(0, availFlo) * (1 + r) + existingContrib;
      rows[rows.length - 1].closingCurrent = flo;
    }

    // Requirement: smallest lump now (only where contributions cannot reach) + level escalating contribution
    let lump = 0;
    rows.forEach((row) => {
      if (row.expense > 0 && row.b <= 1e-12 && row.a < 0) lump = Math.max(lump, -row.a / row.l);
    });
    let x = 0;
    rows.forEach((row) => {
      if (row.expense > 0 && row.b > 1e-12) {
        const need = -(row.a + lump * row.l) / row.b;
        if (need > x) x = need;
      }
    });
    if (x < 1e-9) x = 0;

    // Projection with the required plan
    let bal = S0 + lump;
    rows.forEach((row) => {
      const avail = bal + row.otherFunding - row.expense;
      row.openingRequired = bal;
      row.additionalContrib = row.unitContrib * x;
      row.closingRequired = avail * (1 + r) + row.existingContrib + row.additionalContrib;
      bal = row.closingRequired;
    });

    const totalCost = rows.reduce((s, row) => s + row.expense, 0);
    const totalShortfall = rows.reduce((s, row) => s + row.shortfall, 0);
    const startRow = rows[n] || null;
    let fvContrib = 0;
    for (let p = 1; p <= Math.min(n, P); p++) fvContrib += rows[p - 1].existingContrib * Math.pow(1 + r, n - p);
    const finalCurrent = rows.length ? rows[rows.length - 1].closingCurrent : S0;

    return {
      ok: true, errors: [], costs, rows, reportingCurrency,
      summary: {
        yearsToCollege: n,
        immediate: child.entryAge <= child.age,
        costAtStart: startRow ? startRow.expense : 0,
        totalCost,
        tuitionTotal: rows.reduce((s, row) => s + row.tuition + row.otherFees, 0),
        livingTotal: rows.reduce((s, row) => s + row.living, 0),
        otherTotal: rows.reduce((s, row) => s + row.oneTime + row.contingency, 0),
        scholarshipTotal: rows.reduce((s, row) => s + row.scholarship, 0),
        fvSavingsAtStart: S0 * Math.pow(1 + r, n),
        fvContributionsAtStart: fvContrib,
        requiredLumpNow: lump,
        requiredAnnualFirstYear: x,
        requiredMonthlyFirstYear: a.contributionMode === 'annual' ? null : x / 12,
        contributionYears: P,
        totalShortfall,
        coverage: totalCost > 0 ? Math.max(0, 1 - totalShortfall / totalCost) : 1,
        surplusOrGap: totalShortfall > 0 ? -totalShortfall : finalCurrent,
        fundable: P > 0 || lump === 0
      }
    };
  }

  /* Defaults shared with the Excel workbook ('value used' column on Parent Inputs). */
  function familyDefaults(data, eduCountry, reportingCurrency) {
    const info = countryInfo(data, eduCountry) || data.countries[0];
    const ccy = reportingCurrency || info.currency;
    const A = data.assumptions;
    return { reportingCurrency: ccy, returnRate: A.returnsByCurrency[ccy], tuitionInflation: info.tuitionInflation,
      livingInflation: info.livingInflation, contributionEscalation: A.contributionEscalation, contingency: A.contingency,
      fxDrift: A.fxDrift, collegeEntryAge: A.collegeEntryAge, contributionMode: 'monthly' };
  }

  // Default course duration: chosen record, else duration table, else country default.
  function childDuration(data, child) {
    if (child.benchmark && child.benchmark !== 'average') {
      const rec = data.records.find((r) => r.id === child.benchmark);
      if (rec && isNum(rec.durationYears)) return rec.durationYears;
    }
    return defaultDuration(data, child.country, child.qualification);
  }

  // Record id for a university name within the child's country/qualification/category (Excel matches by name).
  function recordIdFor(data, country, qualification, category, university) {
    const r = data.records.find((x) => x.country === country && x.qualification === qualification &&
      x.studentCategory === category && x.university === university);
    return r ? r.id : 'average';
  }

  function projectFamily(data, scenario) {
    const a = scenario.assumptions;
    const ccy = scenario.reportingCurrency;
    const kids = scenario.children.slice(0, scenario.numChildren).map((c) => projectChild(data, c, a, ccy));
    const ok = kids.filter((k) => k.ok);
    const H = ok.reduce((m, k) => Math.max(m, k.rows.length), 0);
    const years = [];
    for (let i = 0; i < H; i++) {
      const y = { p: i + 1, expense: 0, existingContrib: 0, additionalContrib: 0, closingRequired: 0, closingCurrent: 0, shortfall: 0 };
      ok.forEach((k) => {
        const row = k.rows[i];
        if (!row) {
          const last = k.rows[k.rows.length - 1];
          y.closingRequired += last.closingRequired; y.closingCurrent += last.closingCurrent;
          return;
        }
        ['expense', 'existingContrib', 'additionalContrib', 'closingRequired', 'closingCurrent', 'shortfall']
          .forEach((f) => { y[f] += row[f]; });
      });
      years.push(y);
    }
    const sum = (f) => ok.reduce((s, k) => s + k.summary[f], 0);
    const totalCost = sum('totalCost');
    const totalShortfall = sum('totalShortfall');
    return {
      children: kids, years,
      totals: {
        totalCost, totalShortfall,
        existingSavings: scenario.children.slice(0, scenario.numChildren).reduce((s, c) => s + num(c.savings), 0),
        projectedExisting: sum('fvSavingsAtStart') + sum('fvContributionsAtStart'),
        requiredMonthlyFirstYear: a.contributionMode === 'annual' ? null : sum('requiredMonthlyFirstYear'),
        requiredAnnualFirstYear: sum('requiredAnnualFirstYear'),
        requiredLumpNow: sum('requiredLumpNow'),
        coverage: totalCost > 0 ? Math.max(0, 1 - totalShortfall / totalCost) : 1,
        surplusOrGap: totalShortfall > 0 ? -totalShortfall : sum('surplusOrGap'),
        tuitionTotal: sum('tuitionTotal'), livingTotal: sum('livingTotal'), otherTotal: sum('otherTotal')
      }
    };
  }

  return { familyDefaults, childDuration, recordIdFor, benchmarkStats, categoriesFor, recordsFor, livingBenchmark, countryInfo, defaultDuration, resolveCosts,
    convert, validateChild, validateAssumptions, monthlyTimingFactor, projectChild, projectFamily, COST_FIELDS, LIVING_FIELDS };
});

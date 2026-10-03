/* =========================================================
   Children's Future Education Fund — calculation engine (v2).
   Pure functions, no DOM. The Excel workbook must implement the
   same rules; see docs/education-calculator/METHODOLOGY.md.

   Timing convention (one row = one plan year p = 1, 2, ...):
   - Plan year p runs from time p-1 to time p (years from today)
     and is calendar year planStartYear + p - 1.
   - Education costs for an academic year are paid at the START
     of the plan year in which that academic year begins.
   - One-time costs (admission, visa, first travel) fall in the
     first study year.
   - Family savings are paid at the END of each plan year and can
     keep being paid until the year before a child's last costs.
   - Investment return is applied to what is left after costs.
   ========================================================= */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EduCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Cost lines shown to parents, in display order.
     inflation: which rate grows the amount. timing: every study year, or once in year 1.
     covered: whether the scholarship / part-time-work percentage reduces it. */
  const ITEMS = [
    { key: 'tuition', inflation: 'tuition', timing: 'annual', covered: true },
    { key: 'accommodation', inflation: 'living', timing: 'annual', covered: true },
    { key: 'food', inflation: 'living', timing: 'annual', covered: true },
    { key: 'transport', inflation: 'living', timing: 'annual', covered: true },
    { key: 'healthInsurance', inflation: 'living', timing: 'annual', covered: true },
    { key: 'books', inflation: 'living', timing: 'annual', covered: true },
    { key: 'otherFees', inflation: 'tuition', timing: 'annual', covered: true },
    { key: 'admission', inflation: 'tuition', timing: 'once', covered: true },
    { key: 'visaApplication', inflation: 'living', timing: 'once', covered: false },
    { key: 'travelRelocation', inflation: 'living', timing: 'once', covered: false }
  ];
  const ITEM_KEYS = ITEMS.map((i) => i.key);

  /* Groups for the cost breakdown chart (admission sits with other university fees). */
  const BREAKDOWN = [
    { key: 'tuition', items: ['tuition'] },
    { key: 'accommodation', items: ['accommodation'] },
    { key: 'food', items: ['food'] },
    { key: 'transport', items: ['transport'] },
    { key: 'healthInsurance', items: ['healthInsurance'] },
    { key: 'books', items: ['books'] },
    { key: 'otherFees', items: ['otherFees', 'admission'] },
    { key: 'visaTravel', items: ['visaApplication', 'travelRelocation'] }
  ];

  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

  /* ---------- Lookups ---------- */

  function countryInfo(data, country) {
    return data.countries.find((c) => c.name === country) || null;
  }

  function qualificationInfo(data, qualification) {
    return data.qualifications.find((q) => q.name === qualification) || null;
  }

  // Domestic fees apply when the child's nationality is in the destination's domestic list.
  function feeStatusFor(data, country, nationality) {
    const info = countryInfo(data, country);
    if (!info || !nationality) return 'international';
    return (info.domesticNationalities || []).indexOf(nationality) !== -1 ? 'domestic' : 'international';
  }

  function recordFeeStatus(data, r) {
    return r.feeStatus || (data.feeStatusByCategory || {})[r.studentCategory] || 'international';
  }

  /* ---------- Currency ---------- */

  // rates: units of each currency per 1 USD (the dataset's, or the user's overrides)
  function convert(rates, amount, from, to) {
    if (from === to || !amount) return amount;
    const a = rates[from], b = rates[to];
    if (!isNum(a) || a <= 0 || !isNum(b) || b <= 0) throw new Error('No exchange rate for ' + (isNum(a) ? to : from));
    return amount / a * b;
  }

  /* ---------- Course duration ---------- */

  /* { years, variable, note, status, available, preStage }
     preStage: { years, qualification, label } for courses entered after another degree
     (e.g. US medicine = 4-year bachelor's + 4-year MD). Those first years use the
     pre-stage qualification's fees. */
  function courseDuration(data, country, qualification) {
    const d = data.courseDurations.find((x) => x.country === country && x.qualification === qualification);
    if (d) return { years: d.years, variable: !!d.variable, note: d.note || '', status: d.status || '',
      sourceUrl: d.sourceUrl || '', available: isNum(d.years) && d.years > 0, preStage: d.preStage || null };
    const recs = data.records.filter((r) => r.country === country && r.qualification === qualification && isNum(r.durationYears));
    if (recs.length) return { years: mean(recs.map((r) => r.durationYears)), variable: false, note: '', status: 'From fee records', available: true };
    return { years: null, variable: false, note: 'No typical duration recorded.', status: 'Missing', available: false };
  }

  /* ---------- Inflation defaults ---------- */

  // Most specific evidence first: qualification, then subject group, then the whole country;
  // an entry may apply only to domestic or only to international fees.
  function tuitionInflationFor(data, country, qualification, feeStatus) {
    const q = qualificationInfo(data, qualification);
    const group = q ? q.group : null;
    const list = (data.tuitionInflation || []).filter((t) => t.country === country &&
      (!t.feeStatus || !feeStatus || t.feeStatus === feeStatus));
    const rank = (t) => (t.feeStatus ? 0 : 1);
    const best = (arr) => arr.sort((a, b) => rank(a) - rank(b))[0];
    const hit = best(list.filter((t) => t.qualification === qualification)) ||
      best(list.filter((t) => group && t.group === group)) ||
      best(list.filter((t) => !t.group && !t.qualification));
    if (hit) return { rate: hit.rate, basis: hit.basis, note: hit.note || '' };
    const info = countryInfo(data, country);
    return { rate: info ? info.tuitionInflation : 0.05, basis: 'planning', note: info ? info.inflationNote || '' : '' };
  }

  function livingInflationFor(data, country) {
    const info = countryInfo(data, country);
    return { rate: info ? info.livingInflation : 0.03, note: info ? info.livingInflationNote || '' : '' };
  }

  /* ---------- Fee benchmark ---------- */

  /* Average of comparable verified records: same country, qualification, fee status (domestic /
     international) and currency, each first grown to the plan start year with the tuition
     inflation so fees quoted for different years are comparable. */
  function feeBenchmark(data, country, qualification, feeStatus, tuitionRate) {
    const recs = data.records.filter((r) => r.country === country && r.qualification === qualification &&
      r.includeInAverage && isNum(r.tuition) && recordFeeStatus(data, r) === feeStatus);
    if (recs.length) {
      // use the most common currency so amounts are never mixed
      const counts = {};
      recs.forEach((r) => { counts[r.currency] = (counts[r.currency] || 0) + 1; });
      const currency = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      const same = recs.filter((r) => r.currency === currency);
      const grow = (r) => Math.pow(1 + tuitionRate, data.planStartYear - (r.feeYearStart || data.planStartYear));
      return {
        status: 'verified', currency, count: same.length, baseYear: data.planStartYear,
        tuition: mean(same.map((r) => r.tuition * grow(r))),
        otherFees: mean(same.map((r) => num(r.otherMandatoryAnnual) * grow(r))),
        admission: mean(same.map((r) => (num(r.oneTimeAdmission) + num(r.otherOneTime)) * grow(r))),
        records: same,
        note: same.length === 1 ? 'From one university\'s published fees.' : 'Average of ' + same.length + ' universities\' published fees.'
      };
    }
    const est = (data.estimates || []).find((e) => e.country === country && e.qualification === qualification &&
      (e.feeStatus === feeStatus || e.feeStatus === 'all'));
    if (est && est.derive) {
      const d = deriveEstimate(data, country, feeStatus, est.derive, tuitionRate);
      if (d) {
        return Object.assign(d, { status: 'estimated', count: 0, records: [], note: est.basis || '', sourceUrl: est.sourceUrl || '' });
      }
    } else if (est) {
      return { status: 'estimated', currency: est.currency, count: 0, baseYear: est.year || data.planStartYear,
        tuition: num(est.tuition), otherFees: num(est.otherFees), admission: num(est.admission), records: [],
        note: est.basis || '', sourceUrl: est.sourceUrl || '' };
    }
    return { status: 'missing', currency: (countryInfo(data, country) || {}).currency || 'USD', count: 0,
      baseYear: data.planStartYear, tuition: 0, otherFees: 0, admission: 0, records: [],
      note: 'No published fee found yet for this course in this country. Please enter your own estimate.' };
  }

  /* Planning estimates that follow published fees, so they update when those fees do:
     { qualification, feeStatus?, multiplier? }  -> another course's published fees (x multiplier)
     { average: 'nonMedicalDegrees' }           -> average of the country's published non-medical degrees */
  let deriveDepth = 0;
  function deriveEstimate(data, country, feeStatus, rule, tuitionRate) {
    if (deriveDepth > 2) return null; // a rule can never chain into a loop
    deriveDepth++;
    try { return deriveFrom(data, country, feeStatus, rule, tuitionRate); } finally { deriveDepth--; }
  }
  function deriveFrom(data, country, feeStatus, rule) {
    const verified = (q, fs) => {
      const b = feeBenchmark(data, country, q, fs, tuitionInflationFor(data, country, q, fs).rate);
      return b.status === 'verified' ? b : null;
    };
    if (rule.average === 'nonMedicalDegrees') {
      const info = countryInfo(data, country);
      const ccy = info ? info.currency : 'USD';
      const list = data.qualifications
        .filter((q) => q.kind === 'degree' && q.group !== 'medical' && q.name !== 'Other Qualification')
        .map((q) => verified(q.name, feeStatus)).filter(Boolean);
      if (!list.length) return null;
      const avg = (k) => list.reduce((s, b) => s + convert(data.exchangeRates.rates, b[k], b.currency, ccy), 0) / list.length;
      return { currency: ccy, baseYear: data.planStartYear, tuition: avg('tuition'), otherFees: avg('otherFees'), admission: avg('admission') };
    }
    const src = verified(rule.qualification, rule.feeStatus || feeStatus);
    if (!src) return null;
    const m = isNum(rule.multiplier) ? rule.multiplier : 1;
    return { currency: src.currency, baseYear: src.baseYear, tuition: src.tuition * m, otherFees: src.otherFees * m, admission: src.admission * m };
  }

  /* ---------- Living, visa and travel ---------- */

  function livingFor(data, country) {
    return (data.living || []).find((l) => l.country === country) || null;
  }

  // Health cover can differ for domestic and international students
  function livingItem(living, key, feeStatus) {
    if (!living || !living.items) return null;
    const it = living.items[key];
    if (!it) return null;
    if (it.domestic || it.international) return it[feeStatus] || null;
    return it;
  }

  function placeRegion(data, place) {
    const p = (data.places || []).find((x) => x.name === place);
    return p ? p.region : 'other';
  }

  // Student visa for the destination; none when the child is a domestic national.
  function visaFor(data, country, nationality, feeStatus) {
    const v = (data.visas || []).find((x) => x.country === country);
    if (feeStatus === 'domestic') {
      return { amount: 0, currency: v ? v.currency : 'USD', status: 'notNeeded', baseYear: data.planStartYear,
        note: 'No student visa needed for this nationality.', sourceUrl: '' };
    }
    if (!v) return { amount: 0, currency: 'USD', status: 'missing', baseYear: data.planStartYear, note: 'No visa information yet.', sourceUrl: '' };
    const special = (v.byNationality || []).find((x) => x.nationality === nationality);
    if (special) {
      return { amount: special.amount, currency: special.currency || v.currency, status: special.status || 'verified',
        baseYear: special.year || v.year || data.planStartYear, note: special.note || v.note || '', sourceUrl: special.sourceUrl || v.sourceUrl };
    }
    return { amount: v.amount, currency: v.currency, status: v.status || 'verified', baseYear: v.year || data.planStartYear,
      note: v.note || '', sourceUrl: v.sourceUrl || '' };
  }

  // First trip and setting up; annual local transport is a separate line, so it is never counted twice.
  function travelFor(data, country, residence) {
    const t = (data.travel || {});
    const dest = (t.toCountry || []).find((x) => x.country === country);
    if (!dest) return { amount: 0, currency: 'USD', status: 'missing', baseYear: data.planStartYear, note: 'No travel estimate yet.' };
    const same = residence && residence === country;
    const region = placeRegion(data, residence);
    const fare = same ? dest.domestic : (isNum(dest.byRegion[region]) ? dest.byRegion[region] : dest.byRegion.other);
    const setup = same ? num(t.domesticSetup) : num(t.setup);
    return { amount: fare + setup, currency: t.currency || 'USD', status: 'estimated', baseYear: t.year || data.planStartYear,
      note: (same ? t.domesticNote : t.note) || '' };
  }

  /* ---------- Cost plan for one child ---------- */

  /* Returns today's costs in the education country's currency, one entry per cost line:
     { amount, status: verified | estimated | missing | override, note, sources, baseYear } */
  function resolveCosts(data, child, family) {
    const info = countryInfo(data, child.country);
    const currency = info ? info.currency : 'USD';
    const rates = family.rates || data.exchangeRates.rates;
    const feeStatus = feeStatusFor(data, child.country, family.nationality);
    const tRate = isNum(child.tuitionInflation) ? child.tuitionInflation
      : tuitionInflationFor(data, child.country, child.qualification, feeStatus).rate;
    const dur = courseDuration(data, child.country, child.qualification);
    const living = livingFor(data, child.country);
    const items = {};
    const conv = (amount, from) => convert(rates, num(amount), from, currency);
    const sourcesOf = (bench) => {
      const list = bench.records.map((r) => ({ label: r.university + ' — ' + r.feeYear, url: r.sourceUrl, status: r.status }));
      if (bench.sourceUrl) list.push({ label: 'Planning estimate basis', url: bench.sourceUrl, status: 'Estimated' });
      return list;
    };
    const fromBench = (bench, k) => ({ amount: conv(bench[k], bench.currency), status: bench.status, note: bench.note,
      sources: sourcesOf(bench), baseYear: bench.baseYear });

    const bench = feeBenchmark(data, child.country, child.qualification, feeStatus, tRate);
    ['tuition', 'otherFees', 'admission'].forEach((k) => { items[k] = fromBench(bench, k); });

    // first degree taken before entering this course (e.g. pre-medical bachelor's in the USA)
    let preStage = null;
    if (dur.preStage) {
      const preRate = tuitionInflationFor(data, child.country, dur.preStage.qualification, feeStatus).rate;
      const pre = feeBenchmark(data, child.country, dur.preStage.qualification, feeStatus, preRate);
      preStage = Object.assign({}, dur.preStage);
      items.preTuition = fromBench(pre, 'tuition');
      items.preOtherFees = fromBench(pre, 'otherFees');
      items.admission = fromBench(pre, 'admission');
    }
    ['accommodation', 'food', 'transport', 'healthInsurance', 'books'].forEach((k) => {
      const it = livingItem(living, k, feeStatus);
      items[k] = it
        ? { amount: conv(it.amount, it.currency || living.currency), status: it.status || 'verified', note: it.note || '',
          sources: it.sourceUrl ? [{ label: it.source || 'Source', url: it.sourceUrl, status: it.status }] : [],
          baseYear: it.year || living.year || data.planStartYear }
        : { amount: 0, status: 'missing', note: 'No figure yet — please enter your own estimate.', sources: [], baseYear: data.planStartYear };
    });
    const visa = visaFor(data, child.country, family.nationality, feeStatus);
    items.visaApplication = { amount: conv(visa.amount, visa.currency), status: visa.status, note: visa.note,
      sources: visa.sourceUrl ? [{ label: 'Official visa fees', url: visa.sourceUrl, status: visa.status }] : [], baseYear: visa.baseYear };
    const trav = travelFor(data, child.country, family.residence);
    items.travelRelocation = { amount: conv(trav.amount, trav.currency), status: trav.status, note: trav.note, sources: [], baseYear: trav.baseYear };

    // parent's own figures win (entered in the education country's currency, at today's prices)
    const ov = child.overrides || {};
    Object.keys(ov).forEach((k) => {
      if (items[k] && isNum(ov[k]) && ov[k] >= 0) {
        items[k] = Object.assign({}, items[k], { amount: ov[k], status: 'override', baseYear: data.planStartYear });
      }
    });

    return { country: child.country, qualification: child.qualification, currency, feeStatus, items, preStage,
      benchmark: bench, tuitionInflation: tRate,
      livingInflation: isNum(child.livingInflation) ? child.livingInflation : livingInflationFor(data, child.country).rate };
  }

  /* ---------- Validation ---------- */

  function validateChild(child) {
    const errors = [];
    if (!isNum(child.age) || child.age < 0 || child.age > 18 || Math.round(child.age) !== child.age) errors.push('Choose the child\'s current age (0 to 18).');
    if (!isNum(child.entryAge) || child.entryAge < 14 || child.entryAge > 45 || Math.round(child.entryAge) !== child.entryAge) {
      errors.push('College-entry age must be a whole number from 14 to 45.');
    }
    if (!child.country) errors.push('Choose the education country.');
    if (!child.qualification) errors.push('Choose the qualification.');
    return errors;
  }

  function validateAssumptions(a) {
    const errors = [];
    if (!isNum(a.returnRate) || a.returnRate <= -0.5 || a.returnRate > 0.3) errors.push('Investment return must be between -50% and 30%.');
    if (!isNum(a.savingsIncrease) || a.savingsIncrease < 0 || a.savingsIncrease > 0.2) errors.push('Yearly increase in savings must be between 0% and 20%.');
    if (!isNum(a.coverage) || a.coverage < 0 || a.coverage > 1) errors.push('Scholarship / part-time work must be between 0% and 100%.');
    return errors;
  }

  /* ---------- Projection ---------- */

  function projectChild(data, child, family, a) {
    const errors = validateChild(child).concat(validateAssumptions(a));
    const dur = child.country && child.qualification ? courseDuration(data, child.country, child.qualification) : null;
    const D = isNum(child.duration) && child.duration > 0 ? child.duration : (dur && dur.years);
    if (!errors.length && !(isNum(D) && D > 0)) errors.push('This qualification is not offered (or has no typical duration) in the selected country.');
    if (errors.length) return { ok: false, errors, duration: dur };

    const costs = resolveCosts(data, child, family);
    const rates = family.rates || data.exchangeRates.rates;
    const fx = convert(rates, 1, costs.currency, a.reportingCurrency);
    const r = a.returnRate, g = a.savingsIncrease, c = a.coverage;
    const n = Math.max(0, child.entryAge - child.age);
    const eduYears = Math.ceil(D);
    const H = n + eduYears;                 // plan years with a cost
    const P = Math.max(0, H - 1);           // savings years that can still help
    const rateOf = { tuition: costs.tuitionInflation, living: costs.livingInflation };

    const rows = [];
    for (let p = 1; p <= H; p++) {
      const k = p - 1 - n;
      const inEdu = k >= 0;
      const frac = inEdu ? Math.min(1, D - k) : 0;
      const year = data.planStartYear + p - 1;
      const items = {};
      let expense = 0, gross = 0;
      const inPre = costs.preStage && k >= 0 && k < costs.preStage.years;
      ITEMS.forEach((it) => {
        let src = costs.items[it.key];
        if (inPre && it.key === 'tuition') src = costs.items.preTuition;
        if (inPre && it.key === 'otherFees') src = costs.items.preOtherFees;
        let v = 0;
        if (inEdu && (it.timing === 'annual' || k === 0)) {
          v = src.amount * Math.pow(1 + rateOf[it.inflation], year - src.baseYear) * (it.timing === 'annual' ? frac : 1) * fx;
        }
        gross += v;
        if (it.covered) v *= (1 - c);       // applied once, here only
        items[it.key] = v;
        expense += v;
      });
      rows.push({ p, year, age: child.age + p - 1, academicYear: inEdu ? k + 1 : null, items, gross, covered: gross - expense,
        expense, contribUnit: p <= P ? Math.pow(1 + g, p - 1) : 0, growth: Math.pow(1 + r, p - 1) });
    }

    /* Requirement: the smallest yearly saving (rising by g each year) that never lets the fund
       go below zero, plus an amount needed now for costs that come before any saving is possible.
       a = fund from the lump-free, saving-free path; b = fund per 1 unit of yearly saving. */
    let A = 0, B = 0;
    rows.forEach((row) => {
      row.a = A - row.expense;
      row.b = B;
      A = row.a * (1 + r);
      B = row.b * (1 + r) + row.contribUnit;
    });
    let lump = 0;
    rows.forEach((row) => { if (row.expense > 0 && row.b <= 1e-12 && row.a < 0) lump = Math.max(lump, -row.a / row.growth); });
    let x = 0;
    rows.forEach((row) => {
      if (row.expense > 0 && row.b > 1e-12) x = Math.max(x, -(row.a + lump * row.growth) / row.b);
    });
    if (x < 1e-9) x = 0;

    // Roll-forward: opening - expenses (start of year) + growth on the rest + saving (end of year) = closing.
    // The plan assumes no existing savings; the amount needed now is paid in at the start of year 1.
    let bal = lump;
    rows.forEach((row) => {
      row.paidInNow = row.p === 1 ? lump : 0;
      row.opening = bal;
      row.saving = row.contribUnit * x;
      row.growthAmount = (bal - row.expense) * r;
      row.closing = bal - row.expense + row.growthAmount + row.saving;
      bal = row.closing;
    });

    const byGroup = {};
    BREAKDOWN.forEach((grp) => { byGroup[grp.key] = rows.reduce((s, row) => s + grp.items.reduce((t, k) => t + row.items[k], 0), 0); });
    const totalCost = rows.reduce((s, row) => s + row.expense, 0);

    return {
      ok: true, errors: [], costs, rows, duration: Object.assign({}, dur, { used: D }),
      summary: {
        yearsToCollege: n, startYear: data.planStartYear + n, immediate: child.entryAge <= child.age,
        totalCost, grossCost: rows.reduce((s, row) => s + row.gross, 0), coveredTotal: rows.reduce((s, row) => s + row.covered, 0),
        firstYearSaving: x, savingYears: P, lumpNow: lump, byGroup,
        hasMissing: ['tuition', 'preTuition', 'accommodation'].some((k) => costs.items[k] && costs.items[k].status === 'missing'),
        tuitionStatus: [costs.items.tuition, costs.items.preTuition].filter(Boolean)
          .reduce((s, it) => (s === 'missing' || it.status === 'missing' ? 'missing'
            : s === 'estimated' || it.status === 'estimated' ? 'estimated' : it.status), 'verified')
      }
    };
  }

  function projectFamily(data, scenario) {
    const a = scenario.assumptions;
    const fam = scenario.family;
    const active = scenario.children.slice(0, scenario.numChildren);
    const kids = active.map((c) => projectChild(data, c, fam, a));
    const ok = kids.map((k, i) => ({ k, i })).filter((x) => x.k.ok);
    const H = ok.reduce((m, x) => Math.max(m, x.k.rows.length), 0);
    const years = [];
    for (let i = 0; i < H; i++) {
      const y = { p: i + 1, year: data.planStartYear + i, opening: 0, paidInNow: 0, expense: 0, growth: 0, saving: 0, fund: 0,
        studying: [], byChild: {} };
      ok.forEach(({ k, i: idx }) => {
        const row = k.rows[i];
        if (!row) {               // this child's course has ended: whatever is left is carried, unchanged
          const left = k.rows[k.rows.length - 1].closing;
          y.opening += left; y.fund += left; y.byChild[idx] = 0; return;
        }
        y.opening += row.opening;
        y.paidInNow += row.paidInNow;
        y.expense += row.expense;
        y.growth += row.growthAmount;
        y.saving += row.saving;
        y.fund += row.closing;
        y.byChild[idx] = row.expense;
        if (row.academicYear) y.studying.push(idx);
      });
      years.push(y);
    }
    const sum = (f) => ok.reduce((s, x) => s + x.k.summary[f], 0);
    const byGroup = {};
    BREAKDOWN.forEach((grp) => { byGroup[grp.key] = ok.reduce((s, x) => s + x.k.summary.byGroup[grp.key], 0); });
    return {
      children: kids, years,
      totals: {
        totalCost: sum('totalCost'), grossCost: sum('grossCost'), coveredTotal: sum('coveredTotal'),
        firstYearSaving: years.length ? years[0].saving : 0, lumpNow: sum('lumpNow'), byGroup,
        // reconciliation: lumpNow + totalSaved + totalGrowth - totalCost = finalFund
        totalSaved: years.reduce((s, y) => s + y.saving, 0), totalGrowth: years.reduce((s, y) => s + y.growth, 0),
        finalFund: years.length ? years[years.length - 1].fund : 0,
        allOk: ok.length === kids.length && kids.length > 0
      }
    };
  }

  /* Total cost of one child's course in each country, using that country's own defaults
     (duration, fees, living costs, visa, travel and inflation). The parent's own cost edits
     are in another currency and are not carried over. */
  function compareCountries(data, child, family, a, countries) {
    // The plan's own country is the plan itself, so its total matches the results exactly. Other countries use their
    // own fees and course length; the parent's own cost edits are not carried over (another currency), but fee and
    // living-cost increases the parent set are, because they are percentages.
    return countries.map((country) => {
      const copy = country === child.country ? child
        : Object.assign({}, child, { country, overrides: {}, duration: null });
      const res = projectChild(data, copy, family, a);
      if (!res.ok) return { country, available: false, reason: res.errors[0] };
      return { country, available: true, totalCost: res.summary.totalCost, duration: res.duration.used,
        status: res.summary.tuitionStatus, hasMissing: res.summary.hasMissing };
    });
  }

  /* Defaults shared with the Excel workbook. */
  function defaultReturn(data, currency) {
    const r = data.assumptions.returnsByCurrency[currency];
    return isNum(r) ? r : 0.05;
  }

  return { ITEMS, ITEM_KEYS, BREAKDOWN, countryInfo, qualificationInfo, feeStatusFor, recordFeeStatus, convert,
    courseDuration, tuitionInflationFor, livingInflationFor, feeBenchmark, livingFor, visaFor, travelFor,
    resolveCosts, validateChild, validateAssumptions, projectChild, projectFamily, compareCountries, defaultReturn };
});

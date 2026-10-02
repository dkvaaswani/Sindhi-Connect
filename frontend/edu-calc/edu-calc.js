/* =========================================================
   Children's Future Education Fund Calculator — page logic.
   Data: education-data.js (window.EDU_DATA). Maths: calc-engine.js.
   All state lives in this page; nothing is sent anywhere.
   DOM is built with createElement/textContent (no innerHTML).
   ========================================================= */
(function () {
  'use strict';

  const DATA0 = window.EDU_DATA;
  const E = window.EduCalc;
  if (!DATA0 || !E || !document.getElementById('ec-form')) return;

  const MAX_KIDS = 4;
  const STORE_KEY = 'sc-edu-calc-plan';
  const COST_LABELS = {
    tuition: 'Tuition', otherMandatoryAnnual: 'Other mandatory fees', accommodation: 'Accommodation', food: 'Food',
    transport: 'Transport', healthInsurance: 'Health insurance', books: 'Books and equipment', personal: 'Personal and other living',
    combinedLiving: 'Living costs (combined estimate)', oneTimeAdmission: 'Admission and registration (one-time)',
    visaApplication: 'Visa and application (one-time)', travelRelocation: 'Travel and relocation (one-time)',
    otherOneTime: 'Other one-time costs'
  };
  const ANNUAL_FIELDS = ['tuition', 'otherMandatoryAnnual', 'accommodation', 'food', 'transport', 'healthInsurance', 'books', 'personal', 'combinedLiving'];
  const ONE_TIME_FIELDS = ['oneTimeAdmission', 'visaApplication', 'travelRelocation', 'otherOneTime'];

  /* ---------- small DOM helpers ---------- */
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }
  const appendAll = (root, ...kids) => kids.forEach((k) => { if (k) root.appendChild(k); });
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  let uid = 0;
  const nextId = (p) => p + '-' + (++uid);

  function safeUrl(u) {
    try {
      const url = new URL(u);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch (e) { return null; }
  }

  /* ---------- formatting ---------- */
  function money(v, ccy, opts) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    const digits = Math.abs(v) < 100 && v !== 0 && !(opts && opts.whole) ? 2 : 0;
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency: ccy, currencyDisplay: 'code',
        maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(v).replace(/ /g, ' ');
    } catch (e) { return ccy + ' ' + Math.round(v).toLocaleString('en'); }
  }
  const plain = (v) => (v === null || v === undefined || !isFinite(v) ? '' : Math.round(v).toLocaleString('en'));
  const pct = (v, d) => (isFinite(v) ? (v * 100).toFixed(d === undefined ? 1 : d).replace(/\.0$/, '') + '%' : '—');
  const yearLabel = (p) => { const y = DATA0.planStartYear + p - 1; return y + '/' + String(y + 1).slice(-2); };

  /* ---------- state ---------- */
  function exampleState() {
    return {
      version: 1,
      family: { numChildren: 2, label: '', residence: '', eduCountry: 'Pakistan', repCcy: '', entryAge: 18,
        ret: null, tuiInf: null, livInf: null, esc: null, cont: null, fxDrift: null, mode: 'monthly' },
      fx: {},
      children: [
        kidDefaults({ name: 'Child 1', age: 10, schoolClass: 'Grade 5', qualification: 'Computer Science', savings: 500000, monthly: 10000 }),
        kidDefaults({ name: 'Child 2', age: 6, schoolClass: 'Grade 1', qualification: 'Medicine — MBBS/MD', savings: 100000, monthly: 5000 }),
        kidDefaults({ name: 'Child 3', age: 3, qualification: 'Business Administration' }),
        kidDefaults({ name: 'Child 4', age: 1, qualification: 'Accounting and Finance' })
      ],
      comparisons: []
    };
  }
  function kidDefaults(o) {
    return Object.assign({ name: '', age: null, schoolClass: '', entryAge: null, country: '', category: '', qualification: '',
      custom: '', specialisation: '', duration: null, benchmark: 'average', savings: 0, monthly: 0, annual: 0,
      schPct: 0, schFixed: 0, otherFunding: 0, overrides: {} }, o || {});
  }

  let state = exampleState();
  let step = 1;

  /* Dataset with the user's exchange-rate edits applied */
  function data() {
    const rates = Object.assign({}, DATA0.exchangeRates.rates);
    Object.keys(state.fx || {}).forEach((c) => { if (isFinite(state.fx[c]) && state.fx[c] > 0) rates[c] = state.fx[c]; });
    return Object.assign({}, DATA0, { exchangeRates: Object.assign({}, DATA0.exchangeRates, { rates }) });
  }

  const pick = (v, d) => (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v)) ? d : v);

  function familyDefaults() {
    return E.familyDefaults(DATA0, state.family.eduCountry, state.family.repCcy || null);
  }

  function childCountry(c) { return c.country || state.family.eduCountry; }
  function childCategory(c) {
    const info = E.countryInfo(DATA0, childCountry(c));
    return c.category || (info ? info.defaultCategory : '');
  }

  // Engine child object — mirrors the "value used" logic of the Excel Parent Inputs sheet.
  function engineChild(c, override) {
    const src = Object.assign({}, c, override || {});
    const country = override && override.country ? override.country : childCountry(src);
    const category = override && override.category ? override.category : childCategory(src);
    const child = {
      country, studentCategory: category, qualification: src.qualification, benchmark: src.benchmark || 'average',
      age: src.age, entryAge: pick(src.entryAge, pick(state.family.entryAge, DATA0.assumptions.collegeEntryAge)),
      savings: Number(src.savings) || 0, monthly: Number(src.monthly) || 0, annual: Number(src.annual) || 0,
      scholarshipPct: (Number(src.schPct) || 0) / 100, scholarshipFixed: Number(src.schFixed) || 0,
      otherFunding: Number(src.otherFunding) || 0, overrides: override ? (override.overrides || {}) : (src.overrides || {})
    };
    child.duration = pick(src.duration, E.childDuration(DATA0, child));
    return child;
  }

  function assumptions(retOverride) {
    const d = familyDefaults();
    const f = state.family;
    return {
      returnRate: retOverride !== undefined ? retOverride : pick(f.ret, d.returnRate * 100) / 100,
      tuitionInflation: pick(f.tuiInf, d.tuitionInflation * 100) / 100,
      livingInflation: pick(f.livInf, d.livingInflation * 100) / 100,
      contributionEscalation: pick(f.esc, d.contributionEscalation * 100) / 100,
      contingency: pick(f.cont, d.contingency * 100) / 100,
      fxDrift: pick(f.fxDrift, d.fxDrift * 100) / 100,
      contributionMode: f.mode === 'annual' ? 'annual' : 'monthly'
    };
  }

  function scenario(retOverride) {
    return { numChildren: state.family.numChildren, reportingCurrency: familyDefaults().reportingCurrency,
      assumptions: assumptions(retOverride), children: state.children.map((c) => engineChild(c)) };
  }

  /* ---------- form field builders ---------- */
  function field(opts) {
    // opts: label, path, type ('number'|'text'|'select'|'percent'), options, help, min, max, step, placeholder, suffix
    const id = nextId('ec');
    const helpId = opts.help ? id + '-help' : null;
    const errId = id + '-err';
    let input;
    if (opts.type === 'select') {
      input = h('select', { id, 'data-path': opts.path, 'aria-describedby': [helpId, errId].filter(Boolean).join(' ') },
        opts.options.map((o) => h('option', { value: typeof o === 'object' ? o.value : o }, typeof o === 'object' ? o.label : o)));
    } else {
      input = h('input', { id, 'data-path': opts.path, type: opts.type === 'text' ? 'text' : 'number',
        inputmode: opts.type === 'text' ? null : 'decimal', min: opts.min, max: opts.max, step: opts.step || 'any',
        placeholder: opts.placeholder, 'aria-describedby': [helpId, errId].filter(Boolean).join(' '),
        'data-kind': opts.type === 'percent' ? 'percent' : null });
    }
    const control = opts.suffix ? h('div', { class: 'ec-affix' }, [input, h('span', { class: 'ec-suffix', 'aria-hidden': 'true' }, opts.suffix)]) : input;
    return h('div', { class: 'field ec-field' + (opts.wide ? ' ec-wide' : '') }, [
      h('label', { for: id }, opts.label),
      control,
      opts.help ? h('p', { class: 'ec-help', id: helpId }, opts.help) : null,
      h('p', { class: 'ec-error', id: errId, 'aria-live': 'polite' })
    ]);
  }

  function getPath(path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state);
  }
  function setPath(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const obj = keys.reduce((o, k) => (o[k] === undefined ? (o[k] = {}) : o[k]), state);
    if (value === null || value === undefined) delete obj[last];
    else obj[last] = value;
  }

  function syncInputs(root, except) {
    $$('[data-path]', root).forEach((el) => {
      if (el === except) return;
      const v = getPath(el.dataset.path);
      if (el.tagName === 'SELECT') {
        el.value = v === undefined || v === null ? '' : String(v);
        if (el.selectedIndex === -1 && el.options.length) el.selectedIndex = 0;
      } else if (document.activeElement !== el) {
        el.value = v === undefined || v === null ? '' : String(v);
      }
    });
  }

  /* ---------- Step 1: family + children ---------- */
  const countries = DATA0.countries.map((c) => c.name);

  function renderFamily() {
    const root = clear($('#ec-family'));
    root.append(
      field({ label: 'Number of children', path: 'family.numChildren', type: 'select', options: [1, 2, 3, 4].map(String) }),
      field({ label: 'Family label (optional)', path: 'family.label', type: 'text', placeholder: 'e.g. The Lakhani family' }),
      field({ label: 'Current country of residence', path: 'family.residence', type: 'text', placeholder: 'e.g. Qatar' }),
      field({ label: 'Planned country of education', path: 'family.eduCountry', type: 'select', options: countries,
        help: 'Each child can choose a different country below.' }),
      field({ label: 'Reporting currency', path: 'family.repCcy', type: 'select',
        options: [{ value: '', label: 'Same as education country' }].concat(DATA0.currencies.map((c) => ({ value: c, label: c }))),
        help: 'Savings, contributions and results are shown in this currency.' }),
      field({ label: 'Age at the start of college', path: 'family.entryAge', type: 'number', min: 14, max: 45, step: 1,
        help: 'Default 18. You can change it for each child.' })
    );
  }

  function childOptionsQual() {
    return DATA0.qualifications.map((q) => ({ value: q, label: q }));
  }

  function categoryOptions(c) {
    const country = childCountry(c);
    const info = E.countryInfo(DATA0, country);
    const cats = new Set(E.categoriesFor(DATA0, country, c.qualification));
    if (info) cats.add(info.defaultCategory);
    DATA0.livingBenchmarks.filter((l) => l.country === country && l.studentCategory !== 'All').forEach((l) => cats.add(l.studentCategory));
    return [{ value: '', label: 'Default (' + (info ? info.defaultCategory : '—') + ')' }].concat(Array.from(cats).map((x) => ({ value: x, label: x })));
  }

  function benchmarkOptions(c) {
    const recs = E.recordsFor(DATA0, childCountry(c), c.qualification, childCategory(c));
    const stats = E.benchmarkStats(DATA0, childCountry(c), c.qualification, childCategory(c));
    const avgLabel = stats ? (stats.single ? 'University average (single institution)' : 'University average (' + stats.count + ' universities)')
      : 'University average (no verified records)';
    return [{ value: 'average', label: avgLabel }].concat(recs.map((r) => ({ value: r.id,
      label: r.university + (r.includeInAverage ? '' : ' — reference only') })));
  }

  function renderChildren() {
    const root = clear($('#ec-children'));
    state.children.forEach((c, i) => {
      const p = 'children.' + i + '.';
      const card = h('fieldset', { class: 'ec-child', 'data-child': i, hidden: i >= state.family.numChildren });
      card.append(
        h('legend', null, [h('span', { class: 'ec-child-badge', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'ec-child-title', 'data-name': i }, c.name || 'Child ' + (i + 1))]),
        h('div', { class: 'ec-grid' }, [
          field({ label: "Child's name", path: p + 'name', type: 'text', placeholder: 'Child ' + (i + 1) }),
          field({ label: 'Current age', path: p + 'age', type: 'number', min: 0, max: 40, step: 1 }),
          field({ label: 'Current school class', path: p + 'schoolClass', type: 'text', placeholder: 'e.g. Grade 4' }),
          field({ label: 'College-entry age', path: p + 'entryAge', type: 'number', min: 14, max: 45, step: 1, placeholder: 'Family setting' }),
          field({ label: 'Education country', path: p + 'country', type: 'select',
            options: [{ value: '', label: 'Same as family' }].concat(countries.map((x) => ({ value: x, label: x }))) }),
          field({ label: 'Qualification', path: p + 'qualification', type: 'select', options: childOptionsQual() }),
          field({ label: 'Custom qualification name', path: p + 'custom', type: 'text', placeholder: 'e.g. Veterinary Science' }),
          field({ label: 'Specialisation (optional)', path: p + 'specialisation', type: 'text' }),
          field({ label: 'Student category', path: p + 'category', type: 'select', options: categoryOptions(c),
            help: 'Domestic and international students pay different fees.' }),
          field({ label: 'University benchmark', path: p + 'benchmark', type: 'select', options: benchmarkOptions(c) }),
          field({ label: 'Course duration (years)', path: p + 'duration', type: 'number', min: 0, max: 10, step: 0.5,
            placeholder: String(E.childDuration(DATA0, engineChild(Object.assign({}, c, { duration: null })))),
            help: 'Blank uses the usual length for this course.' }),
          field({ label: 'Current education savings', path: p + 'savings', type: 'number', min: 0, suffix: 'repCcy' }),
          field({ label: 'Existing monthly contribution', path: p + 'monthly', type: 'number', min: 0, suffix: 'repCcy' }),
          field({ label: 'Planned scholarship', path: p + 'schPct', type: 'number', min: 0, max: 100, suffix: '% of tuition' }),
          field({ label: 'Other planned funding at college start', path: p + 'otherFunding', type: 'number', min: 0, suffix: 'repCcy',
            help: 'e.g. a gift or maturing deposit.' })
        ]),
        h('p', { class: 'ec-notice', 'data-notice': i, hidden: true })
      );
      root.appendChild(card);
    });
    refreshCurrencySuffixes();
    updateChildDynamic();
  }

  function refreshCurrencySuffixes() {
    const ccy = familyDefaults().reportingCurrency;
    $$('.ec-suffix').forEach((s) => { if (s.dataset.ccy !== undefined || s.textContent === 'repCcy') { s.dataset.ccy = '1'; s.textContent = ccy; } });
  }

  // Show/hide custom name, refresh dependent dropdowns and placeholders, show age notices
  function updateChildDynamic() {
    state.children.forEach((c, i) => {
      const card = $('[data-child="' + i + '"]');
      if (!card) return;
      card.hidden = i >= state.family.numChildren;
      const custom = $('[data-path="children.' + i + '.custom"]', card).closest('.field');
      custom.hidden = c.qualification !== 'Other / Custom Qualification';
      replaceOptions($('[data-path="children.' + i + '.category"]', card), categoryOptions(c), 'category', c);
      replaceOptions($('[data-path="children.' + i + '.benchmark"]', card), benchmarkOptions(c), 'benchmark', c);
      const dur = $('[data-path="children.' + i + '.duration"]', card);
      dur.placeholder = String(E.childDuration(DATA0, engineChild(Object.assign({}, c, { duration: null }))));
      $('[data-name="' + i + '"]').textContent = c.name || 'Child ' + (i + 1);
      const notice = $('[data-notice="' + i + '"]', card);
      const entry = pick(c.entryAge, pick(state.family.entryAge, 18));
      if (isFinite(c.age) && isFinite(entry) && c.age !== null && entry <= c.age) {
        notice.hidden = false;
        notice.textContent = 'This child is already at college age, so education costs start now. The results show any lump sum needed today as well as monthly saving.';
      } else notice.hidden = true;
    });
  }

  function replaceOptions(select, options, key, c) {
    const current = c[key] || '';
    clear(select);
    options.forEach((o) => select.appendChild(h('option', { value: o.value }, o.label)));
    if (!options.some((o) => o.value === current)) c[key] = key === 'benchmark' ? 'average' : '';
    select.value = c[key] || (key === 'benchmark' ? 'average' : '');
  }

  /* ---------- validation messages ---------- */
  function validate() {
    let ok = true;
    $$('.ec-error').forEach((e) => { e.textContent = ''; });
    $$('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
    const err = (path, msg) => {
      const el = $('[data-path="' + path + '"]');
      if (!el) return;
      const box = el.closest('.field');
      if (box && box.closest('[hidden]')) return;
      el.setAttribute('aria-invalid', 'true');
      $('.ec-error', box).textContent = msg;
      ok = false;
    };
    const f = state.family;
    if (f.entryAge !== null && f.entryAge !== '' && (!Number.isInteger(f.entryAge) || f.entryAge < 14 || f.entryAge > 45)) err('family.entryAge', 'Enter a whole number from 14 to 45.');
    state.children.slice(0, f.numChildren).forEach((c, i) => {
      const p = 'children.' + i + '.';
      if (c.age === null || c.age === '' || !isFinite(c.age)) err(p + 'age', 'Enter the child\'s age.');
      else if (!Number.isInteger(c.age) || c.age < 0 || c.age > 40) err(p + 'age', 'Enter a whole number from 0 to 40.');
      if (c.entryAge !== null && (!Number.isInteger(c.entryAge) || c.entryAge < 14 || c.entryAge > 45)) err(p + 'entryAge', 'Enter a whole number from 14 to 45, or leave blank.');
      if (c.duration !== null && (c.duration < 0 || c.duration > 10)) err(p + 'duration', 'Enter 0 to 10 years, or leave blank.');
      ['savings', 'monthly', 'annual', 'schFixed', 'otherFunding'].forEach((k) => {
        if (Number(c[k]) < 0) err(p + k, 'Amounts cannot be negative.');
      });
      if (c.schPct < 0 || c.schPct > 100) err(p + 'schPct', 'Enter 0% to 100%.');
      if (!c.qualification) err(p + 'qualification', 'Choose a qualification.');
    });
    const a = assumptions();
    E.validateAssumptions(a).forEach((m) => {
      const map = { returnRate: 'family.ret', tuitionInflation: 'family.tuiInf', livingInflation: 'family.livInf',
        contributionEscalation: 'family.esc', fxDrift: 'family.fxDrift' };
      const key = Object.keys(map).find((k) => m.indexOf(k) === 0) || (m.indexOf('Investment') === 0 ? 'returnRate' : null);
      if (m.indexOf('Contingency') === 0) err('family.cont', m);
      else if (key) err(map[key], m.replace(/^[a-zA-Z]+ must/, 'Must'));
    });
    return ok;
  }

  /* ---------- Step 2: education plan ---------- */
  function renderPlans() {
    const root = clear($('#ec-plans'));
    const d = data();
    state.children.slice(0, state.family.numChildren).forEach((c, i) => {
      const ec = engineChild(c);
      const costs = E.resolveCosts(d, ec);
      const ccy = costs.currency;
      const stats = costs.stats;
      const card = h('article', { class: 'ec-plan', 'aria-labelledby': 'ec-plan-' + i });
      const qualName = c.qualification === 'Other / Custom Qualification' && c.custom ? c.custom : c.qualification;
      card.append(h('header', { class: 'ec-plan-head' }, [
        h('h3', { id: 'ec-plan-' + i }, (c.name || 'Child ' + (i + 1)) + ': ' + (qualName || 'no qualification chosen') + (c.specialisation ? ' (' + c.specialisation + ')' : '')),
        h('dl', { class: 'ec-facts' }, [
          fact('Country', ec.country), fact('Student category', ec.studentCategory), fact('Fee currency', ccy),
          fact('Duration', ec.duration + (ec.duration === 1 ? ' year' : ' years')), fact('Benchmark', costs.benchmarkLabel)
        ])
      ]));
      if (stats && ec.benchmark === 'average') {
        card.appendChild(h('p', { class: 'ec-stats' },
          (stats.single ? 'Single-institution benchmark. ' : 'Average of ' + stats.count + ' universities. ') +
          'Median tuition ' + money(stats.medianTuition, ccy) + '; range ' + money(stats.minTuition, ccy) + ' to ' +
          money(stats.maxTuition, ccy) + '. Fee years: ' + stats.feeYears.join(', ') + '.'));
      }
      if (!costs.hasTuitionData) {
        card.appendChild(h('p', { class: 'ec-warn' }, 'There is no verified fee record for this course yet. Enter your own tuition estimate below; it will be marked as your override.'));
      }
      if (['ACCA', 'CPA', 'Chartered Accountancy (CA)'].indexOf(c.qualification) !== -1) {
        card.appendChild(h('p', { class: 'ec-warn' }, DATA0.professionalQualificationNote));
      }
      if (costs.livingNote && /Partial|not verified/i.test(costs.livingNote)) {
        card.appendChild(h('p', { class: 'ec-warn' }, 'Living costs are incomplete for this country: ' + costs.livingNote + '. Add your own figures for any blank line.'));
      }
      const tbody = h('tbody');
      const addRow = (f) => {
        const isOv = Object.prototype.hasOwnProperty.call(c.overrides || {}, f);
        const base = E.resolveCosts(d, Object.assign({}, ec, { overrides: {} })).base[f];
        const id = nextId('ec-ov');
        const inp = h('input', { id, type: 'number', min: 0, step: 'any', inputmode: 'decimal', 'data-override': i, 'data-field': f,
          placeholder: plain(base) || '0', value: isOv ? String(c.overrides[f]) : null, 'aria-label': COST_LABELS[f] + ' — your figure in ' + ccy });
        tbody.appendChild(h('tr', { class: isOv ? 'is-override' : null }, [
          h('th', { scope: 'row' }, COST_LABELS[f]),
          h('td', { class: 'ec-num' }, base ? money(base, ccy, { whole: true }) : '—'),
          h('td', null, h('div', { class: 'ec-ov-cell' }, [inp, isOv ? h('span', { class: 'ec-badge' }, 'Your override') : null]))
        ]));
      };
      tbody.appendChild(h('tr', { class: 'ec-group' }, h('th', { colspan: 3, scope: 'colgroup' }, 'Every study year')));
      ANNUAL_FIELDS.forEach(addRow);
      tbody.appendChild(h('tr', { class: 'ec-group' }, h('th', { colspan: 3, scope: 'colgroup' }, 'Once, in the first study year')));
      ONE_TIME_FIELDS.forEach(addRow);
      card.appendChild(h('div', { class: 'ec-table-wrap' }, h('table', { class: 'ec-table ec-costs' }, [
        h('caption', { class: 'sr-only' }, 'Cost assumptions for ' + (c.name || 'Child ' + (i + 1))),
        h('thead', null, h('tr', null, [h('th', { scope: 'col' }, 'Cost (today, ' + ccy + ')'), h('th', { scope: 'col', class: 'ec-num' }, 'Researched'), h('th', { scope: 'col' }, 'Your figure')])),
        tbody
      ])));
      if (Object.keys(c.overrides || {}).length) {
        card.appendChild(h('button', { type: 'button', class: 'btn btn-sm ec-btn-outline', 'data-clear-overrides': i }, 'Use researched figures again'));
      }
      const srcList = h('ul', { class: 'ec-sources' });
      costs.sources.forEach((s) => {
        const url = safeUrl(s.url);
        srcList.appendChild(h('li', null, [url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, s.label) : s.label,
          h('span', { class: 'ec-src-status' }, ' — ' + s.status)]));
      });
      card.appendChild(h('details', { class: 'ec-details' }, [h('summary', null, 'Sources and notes (' + costs.sources.length + ')'), srcList,
        notesFor(costs, ec)]));
      root.appendChild(card);
    });
  }

  function notesFor(costs, ec) {
    const recs = ec.benchmark !== 'average' ? DATA0.records.filter((r) => r.id === ec.benchmark)
      : (costs.stats ? costs.stats.records : []);
    if (!recs.length) return null;
    return h('ul', { class: 'ec-notes' }, recs.map((r) => h('li', null, r.university + ': ' + r.notes)));
  }

  function fact(label, value) {
    return h('div', null, [h('dt', null, label), h('dd', null, value || '—')]);
  }

  /* ---------- Step 3: assumptions ---------- */
  function renderAssumptions() {
    const d = familyDefaults();
    const root = clear($('#ec-assumptions'));
    const pctField = (label, path, def, help) => field({ label, path, type: 'number', step: 0.1, suffix: '%',
      placeholder: (def * 100).toFixed(1).replace(/\.0$/, ''), help });
    root.append(
      pctField('Expected annual investment return', 'family.ret', d.returnRate,
        'What you expect your savings to earn each year before inflation. An assumption, not a guarantee; zero or negative is allowed.'),
      pctField('Tuition inflation', 'family.tuiInf', d.tuitionInflation, 'How fast university fees rise each year.'),
      pctField('Living-cost inflation', 'family.livInf', d.livingInflation, 'How fast rent, food and travel rise each year.'),
      pctField('Yearly increase in your contributions', 'family.esc', d.contributionEscalation, 'e.g. 5% means saving a little more each year as income grows.'),
      pctField('Contingency allowance', 'family.cont', d.contingency, 'Extra on top of all costs for surprises.'),
      pctField('Yearly exchange-rate change', 'family.fxDrift', d.fxDrift,
        'Use a positive number if you expect your currency to weaken against the fee currency.'),
      field({ label: 'Contribution timing', path: 'family.mode', type: 'select',
        options: [{ value: 'monthly', label: 'Monthly (paid at month-end)' }, { value: 'annual', label: 'Once a year (paid at year-end)' }] })
    );
    renderFunding();
    renderFx();
  }

  function renderFunding() {
    const t = clear($('#ec-funding'));
    const ccy = familyDefaults().reportingCurrency;
    const n = state.family.numChildren;
    const cols = [['savings', 'Current savings'], ['monthly', 'Monthly contribution'], ['annual', 'Annual contribution'],
      ['schPct', 'Scholarship (% of tuition)'], ['schFixed', 'Scholarship per study year'], ['otherFunding', 'Other funding at college start']];
    t.append(h('caption', { class: 'ec-caption' }, 'Amounts in ' + ccy + '. These are the same fields as on the Family step.'),
      h('thead', null, h('tr', null, [h('th', { scope: 'col' }, 'Child')].concat(cols.map((c) => h('th', { scope: 'col' }, c[1]))))),
      h('tbody', null, state.children.slice(0, n).map((c, i) => h('tr', null, [h('th', { scope: 'row' }, c.name || 'Child ' + (i + 1))]
        .concat(cols.map((col) => h('td', null, h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal',
          'data-path': 'children.' + i + '.' + col[0], 'aria-label': col[1] + ' for ' + (c.name || 'Child ' + (i + 1)) }))))))));
    syncInputs(t);
  }

  function renderFx() {
    const t = clear($('#ec-fx'));
    const fx = DATA0.exchangeRates;
    $('#ec-fx-note').textContent = 'Reference rates from ' + fx.date + ' (European Central Bank cross-rates; Pakistani rupee from the State Bank of Pakistan), shown as units per 1 US dollar. Edit a rate to use your own.';
    t.append(h('thead', null, h('tr', null, [h('th', { scope: 'col' }, 'Currency'), h('th', { scope: 'col', class: 'ec-num' }, 'Reference rate'), h('th', { scope: 'col' }, 'Your rate (per 1 USD)')])),
      h('tbody', null, DATA0.currencies.filter((c) => c !== 'USD').map((c) => h('tr', null, [h('th', { scope: 'row' }, c),
        h('td', { class: 'ec-num' }, fx.rates[c].toLocaleString('en', { maximumFractionDigits: 4 })),
        h('td', null, h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', 'data-path': 'fx.' + c,
          placeholder: String(fx.rates[c]), 'aria-label': 'Your rate for ' + c }))]))));
    syncInputs(t);
  }

  /* ---------- results ---------- */
  let lastFamily = null;

  function compute() {
    const fam = E.projectFamily(data(), scenario());
    lastFamily = fam;
    return fam;
  }

  function renderRail(fam) {
    const root = clear($('#ec-rail'));
    const ccy = familyDefaults().reportingCurrency;
    const t = fam.totals;
    const annual = state.family.mode === 'annual';
    const invalid = fam.children.slice(0, state.family.numChildren).filter((k) => !k.ok).length;
    appendAll(root,
      h('p', { class: 'ec-rail-label' }, annual ? 'Extra saving needed this year' : 'Extra saving needed each month'),
      h('p', { class: 'ec-rail-figure' }, money(annual ? t.requiredAnnualFirstYear : t.requiredMonthlyFirstYear, ccy, { whole: true })),
      h('p', { class: 'ec-rail-sub' }, 'on top of what you already save, rising ' + pct(assumptions().contributionEscalation) + ' a year'),
      t.requiredLumpNow > 0.5 ? h('p', { class: 'ec-rail-lump' }, 'Plus ' + money(t.requiredLumpNow, ccy) + ' needed now for costs that start before savings can grow.') : null,
      h('dl', { class: 'ec-rail-list' }, [
        railItem('Total estimated cost', money(t.totalCost, ccy)),
        railItem('Covered by your current plan', pct(t.coverage, 0)),
        railItem(t.surplusOrGap < 0 ? 'Funding gap' : 'Projected surplus', money(Math.abs(t.surplusOrGap), ccy), t.surplusOrGap < 0 ? 'is-gap' : 'is-ok')
      ]),
      invalid ? h('p', { class: 'ec-rail-warn' }, invalid + (invalid === 1 ? ' child has' : ' children have') + ' missing or invalid details and are left out.') : null,
      h('button', { type: 'button', class: 'btn btn-primary btn-sm btn-block', 'data-goto': '4' }, 'See full results')
    );
  }
  const railItem = (k, v, cls) => h('div', { class: cls || null }, [h('dt', null, k), h('dd', null, v)]);

  function renderResults(fam) {
    const root = clear($('#ec-results'));
    const ccy = familyDefaults().reportingCurrency;
    const t = fam.totals;
    const annual = state.family.mode === 'annual';
    const names = state.children.map((c, i) => c.name || 'Child ' + (i + 1));

    root.appendChild(h('p', { class: 'ec-intro' }, 'All amounts are in ' + ccy + ' and include future inflation. Estimates only, based on the assumptions on the previous steps.'));
    const kpis = h('dl', { class: 'ec-kpis' }, [
      kpi('Total estimated future education cost', money(t.totalCost, ccy)),
      kpi(annual ? 'Extra saving needed this year' : 'Extra saving needed each month (year 1)', money(annual ? t.requiredAnnualFirstYear : t.requiredMonthlyFirstYear, ccy), 'is-key'),
      kpi('Extra saving needed per year (year 1)', money(t.requiredAnnualFirstYear, ccy)),
      kpi('Current projected funding at college start', money(t.projectedExisting, ccy)),
      kpi(t.surplusOrGap < 0 ? 'Funding gap with your current plan' : 'Surplus with your current plan', money(Math.abs(t.surplusOrGap), ccy), t.surplusOrGap < 0 ? 'is-gap' : 'is-ok'),
      kpi('Share of costs your current plan covers', pct(t.coverage, 0))
    ]);
    root.appendChild(kpis);
    if (t.requiredLumpNow > 0.5) {
      root.appendChild(h('p', { class: 'ec-warn' }, 'An up-front amount of ' + money(t.requiredLumpNow, ccy) + ' is needed now, because some costs start before monthly saving can build up.'));
    }

    // per-child table
    const rows = fam.children.map((k, i) => {
      if (i >= state.family.numChildren) return null;
      if (!k.ok) return h('tr', null, [h('th', { scope: 'row' }, names[i]), h('td', { colspan: 6, class: 'ec-err-cell' }, 'Left out: ' + k.errors.join(' '))]);
      const s = k.summary;
      return h('tr', null, [h('th', { scope: 'row' }, names[i]),
        h('td', { class: 'ec-num' }, s.yearsToCollege === 0 ? 'Now' : s.yearsToCollege + ' yrs'),
        h('td', { class: 'ec-num' }, money(s.costAtStart, ccy)),
        h('td', { class: 'ec-num' }, money(s.totalCost, ccy)),
        h('td', { class: 'ec-num' }, money(s.fvSavingsAtStart + s.fvContributionsAtStart, ccy)),
        h('td', { class: 'ec-num ec-strong' }, annual ? money(s.requiredAnnualFirstYear, ccy) : money(s.requiredMonthlyFirstYear, ccy)),
        h('td', { class: 'ec-num' }, pct(s.coverage, 0))]);
    }).filter(Boolean);
    root.appendChild(h('h3', { class: 'ec-sub' }, 'Each child'));
    root.appendChild(h('div', { class: 'ec-table-wrap' }, h('table', { class: 'ec-table' }, [
      h('thead', null, h('tr', null, ['Child', 'Starts in', 'First-year cost', 'Total cost', 'Your savings at start',
        annual ? 'Extra per year' : 'Extra per month', 'Covered now'].map((x, j) => h('th', { scope: 'col', class: j ? 'ec-num' : null }, x)))),
      h('tbody', null, rows)])));

    // breakdown
    root.appendChild(h('h3', { class: 'ec-sub' }, 'Cost breakdown'));
    root.appendChild(breakdown(t, ccy));

    // chart
    root.appendChild(h('h3', { class: 'ec-sub' }, 'Fund balance and education costs by year'));
    root.appendChild(h('p', { class: 'ec-help-block' }, 'Gold bars are the family\'s education costs each year. The line is the combined fund if you add the extra saving shown above; the dashed line is your current plan.'));
    root.appendChild(chart(fam, ccy));

    // schedule
    root.appendChild(h('h3', { class: 'ec-sub' }, 'Year-by-year funding schedule'));
    root.appendChild(schedule(fam, ccy, names));

    // scenarios
    root.appendChild(h('h3', { class: 'ec-sub' }, 'Lower and higher return scenarios'));
    root.appendChild(h('p', { class: 'ec-help-block' }, 'Illustrative only — these are not predictions or recommendations. They show how sensitive the plan is to the return you assume.'));
    root.appendChild(scenarios(ccy));

    // comparison
    root.appendChild(h('h3', { class: 'ec-sub' }, 'Compare another country or course'));
    root.appendChild(h('p', { class: 'ec-help-block' }, 'Try an alternative for one child. Your original plan stays as it is.'));
    root.appendChild(comparison(ccy, names));
  }

  const kpi = (k, v, cls) => h('div', { class: 'ec-kpi ' + (cls || '') }, [h('dt', null, k), h('dd', null, v)]);

  function breakdown(t, ccy) {
    const parts = [['Tuition and fees', t.tuitionTotal, 'tuition'], ['Living costs', t.livingTotal, 'living'], ['One-time costs and contingency', t.otherTotal, 'other']];
    const total = parts.reduce((s, p) => s + p[1], 0) || 1;
    const scholarships = (lastFamily ? lastFamily.children : []).filter((k) => k.ok).reduce((s, k) => s + k.summary.scholarshipTotal, 0);
    return h('div', { class: 'ec-breakdown' }, [
      h('div', { class: 'ec-bar', role: 'img', 'aria-label': parts.map((p) => p[0] + ' ' + pct(p[1] / total, 0)).join(', ') },
        parts.map((p) => h('span', { class: 'ec-bar-' + p[2], style: 'flex-basis:' + (p[1] / total * 100).toFixed(2) + '%' }))),
      h('dl', { class: 'ec-legend' }, parts.map((p) => h('div', null, [h('dt', null, [h('span', { class: 'ec-swatch ec-bar-' + p[2], 'aria-hidden': 'true' }), p[0]]),
        h('dd', null, money(p[1], ccy) + ' (' + pct(p[1] / total, 0) + ')')])).concat(
        scholarships > 0 ? [h('div', null, [h('dt', null, 'Less scholarships and grants'), h('dd', null, '−' + money(scholarships, ccy))])] : []))
    ]);
  }

  /* SVG chart: bars = expenses, solid line = required plan balance, dashed = current plan */
  function chart(fam, ccy) {
    const NS = 'http://www.w3.org/2000/svg';
    const s = (tag, attrs) => { const el = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k])); return el; };
    const years = fam.years;
    const narrow = window.innerWidth < 600;
    const W = narrow ? 400 : 720, H = narrow ? 260 : 300, L = narrow ? 44 : 64, R = 12, T = 12, B = 34;
    const svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'ec-chart', role: 'img',
      'aria-label': 'Chart of yearly education costs and projected fund balance. Exact values are in the schedule below.' });
    if (!years.length) return h('p', { class: 'ec-help-block' }, 'Add a child to see the chart.');
    const maxV = Math.max(1, ...years.map((y) => Math.max(y.expense, y.closingRequired, y.closingCurrent)));
    const nice = niceMax(maxV);
    const x = (i) => L + (i + 0.5) * ((W - L - R) / years.length);
    const y = (v) => T + (H - T - B) * (1 - Math.max(0, v) / nice);
    const bw = Math.max(2, (W - L - R) / years.length * 0.6);
    for (let g = 0; g <= 4; g++) {
      const v = nice * g / 4;
      svg.appendChild(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'ec-grid-line' }));
      const lab = s('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'ec-axis' });
      lab.textContent = compact(v);
      svg.appendChild(lab);
    }
    years.forEach((yr, i) => {
      if (yr.expense > 0) svg.appendChild(s('rect', { x: x(i) - bw / 2, y: y(yr.expense), width: bw, height: Math.max(0, H - B - y(yr.expense)), class: 'ec-bar-exp' }));
      if (years.length <= 12 || i % Math.ceil(years.length / 10) === 0) {
        const lab = s('text', { x: x(i), y: H - 12, 'text-anchor': 'middle', class: 'ec-axis' });
        lab.textContent = String(DATA0.planStartYear + i);
        svg.appendChild(lab);
      }
    });
    const path = (key) => years.map((yr, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(yr[key]).toFixed(1)).join(' ');
    svg.appendChild(s('path', { d: path('closingCurrent'), class: 'ec-line-current' }));
    svg.appendChild(s('path', { d: path('closingRequired'), class: 'ec-line-required' }));
    const legend = h('ul', { class: 'ec-chart-legend' }, [
      h('li', null, [h('span', { class: 'ec-key ec-key-bar', 'aria-hidden': 'true' }), 'Education costs']),
      h('li', null, [h('span', { class: 'ec-key ec-key-line', 'aria-hidden': 'true' }), 'Fund with extra saving']),
      h('li', null, [h('span', { class: 'ec-key ec-key-dash', 'aria-hidden': 'true' }), 'Fund with current plan'])]);
    return h('figure', { class: 'ec-figure' }, [svg, legend, h('figcaption', { class: 'sr-only' }, 'Values in ' + ccy)]);
  }
  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  function compact(v) {
    if (v === 0) return '0';
    const units = [[1e9, 'bn'], [1e6, 'm'], [1e3, 'k']];
    for (const [d, u] of units) if (v >= d) return (v / d).toFixed(v / d < 10 || !Number.isInteger(v / d) ? 1 : 0).replace(/\.0$/, '') + u;
    return String(Math.round(v));
  }

  let scheduleView = 'family';
  function schedule(fam, ccy, names) {
    const wrap = h('div', { class: 'ec-schedule' });
    const id = nextId('ec-view');
    const sel = h('select', { id, 'data-schedule': '1' }, [h('option', { value: 'family' }, 'Whole family')].concat(
      fam.children.map((k, i) => (i < state.family.numChildren && k.ok ? h('option', { value: String(i) }, names[i]) : null)).filter(Boolean)));
    sel.value = scheduleView;
    if (sel.selectedIndex === -1) { scheduleView = 'family'; sel.value = 'family'; }
    wrap.appendChild(h('div', { class: 'field ec-inline' }, [h('label', { for: id }, 'Show'), sel]));
    let head, rows;
    if (scheduleView === 'family') {
      head = ['Year', 'Education costs', 'Current contributions', 'Extra contributions', 'Fund at year end (with extra)', 'Fund at year end (current plan)', 'Unfunded costs (current plan)'];
      rows = fam.years.map((y) => [yearLabel(y.p), y.expense, y.existingContrib, y.additionalContrib, y.closingRequired, y.closingCurrent, y.shortfall]);
    } else {
      const k = fam.children[Number(scheduleView)];
      head = ['Year', 'Age', 'Study year', 'Tuition & fees', 'Living', 'One-time & contingency', 'Scholarships', 'Net cost', 'Your contributions', 'Extra contributions', 'Fund at year end (with extra)', 'Unfunded (current plan)'];
      rows = k.rows.map((r) => [yearLabel(r.p), r.age, r.academicYear ? String(r.academicYear) : '—', r.tuition + r.otherFees, r.living,
        r.oneTime + r.contingency, r.scholarship, r.expense, r.existingContrib, r.additionalContrib, r.closingRequired, r.shortfall]);
    }
    wrap.appendChild(h('div', { class: 'ec-table-wrap ec-scroll' }, h('table', { class: 'ec-table ec-sched' }, [
      h('caption', { class: 'ec-caption' }, 'Amounts in ' + ccy + '. Costs are paid at the start of each academic year.'),
      h('thead', null, h('tr', null, head.map((x, j) => h('th', { scope: 'col', class: j ? 'ec-num' : null }, x)))),
      h('tbody', null, rows.map((r) => h('tr', { class: r[1] > 0 || (scheduleView !== 'family' && r[7] > 0) ? 'is-study' : null },
        r.map((v, j) => (j === 0 ? h('th', { scope: 'row' }, v) : h('td', { class: 'ec-num' + (head[j].indexOf('Unfunded') === 0 && v > 0.5 ? ' is-gap' : '') },
          typeof v === 'number' && head[j] !== 'Age' ? plain(v) : String(v)))))))])));
    return wrap;
  }

  function scenarios(ccy) {
    const base = assumptions().returnRate;
    const spread = DATA0.assumptions.scenarioSpread;
    const annual = state.family.mode === 'annual';
    const list = [['Lower return', base - spread], ['Base (your assumption)', base], ['Higher return', base + spread]];
    return h('div', { class: 'ec-table-wrap' }, h('table', { class: 'ec-table' }, [
      h('thead', null, h('tr', null, ['Scenario', 'Return', annual ? 'Extra per year' : 'Extra per month', 'Up-front amount', 'Covered by current plan']
        .map((x, j) => h('th', { scope: 'col', class: j ? 'ec-num' : null }, x)))),
      h('tbody', null, list.map(([lab, r]) => {
        const f = r <= -0.99 ? null : E.projectFamily(data(), scenario(r));
        return h('tr', null, [h('th', { scope: 'row' }, lab), h('td', { class: 'ec-num' }, pct(r)),
          h('td', { class: 'ec-num' }, f ? money(annual ? f.totals.requiredAnnualFirstYear : f.totals.requiredMonthlyFirstYear, ccy) : '—'),
          h('td', { class: 'ec-num' }, f ? money(f.totals.requiredLumpNow, ccy) : '—'),
          h('td', { class: 'ec-num' }, f ? pct(f.totals.coverage, 0) : '—')]);
      }))]));
  }

  function comparison(ccy, names) {
    const box = h('div', { class: 'ec-compare' });
    const n = state.family.numChildren;
    const childSel = h('select', { id: 'ec-cmp-child' }, state.children.slice(0, n).map((c, i) => h('option', { value: String(i) }, names[i])));
    const ctySel = h('select', { id: 'ec-cmp-country' }, countries.map((c) => h('option', { value: c }, c)));
    const qSel = h('select', { id: 'ec-cmp-qual' }, DATA0.qualifications.map((q) => h('option', { value: q }, q)));
    const first = state.children[0];
    ctySel.value = childCountry(first) === 'UK' ? 'Germany' : 'UK';
    qSel.value = first.qualification || 'Computer Science';
    box.appendChild(h('div', { class: 'ec-compare-form' }, [
      h('div', { class: 'field' }, [h('label', { for: 'ec-cmp-child' }, 'Child'), childSel]),
      h('div', { class: 'field' }, [h('label', { for: 'ec-cmp-country' }, 'Country'), ctySel]),
      h('div', { class: 'field' }, [h('label', { for: 'ec-cmp-qual' }, 'Qualification'), qSel]),
      h('button', { type: 'button', class: 'btn btn-secondary', 'data-action': 'add-compare' }, 'Add comparison')]));
    const a = assumptions();
    const annual = a.contributionMode === 'annual';
    const rows = [];
    state.children.slice(0, n).forEach((c, i) => {
      const k = lastFamily.children[i];
      if (k && k.ok) rows.push(cmpRow(names[i] + ' — your plan', childCountry(c), c.qualification, k, ccy, annual, null));
    });
    state.comparisons.forEach((cmp, j) => {
      const c = state.children[cmp.child];
      if (!c || cmp.child >= n) return;
      const info = E.countryInfo(DATA0, cmp.country);
      const alt = engineChild(c, { country: cmp.country, qualification: cmp.qualification, category: info.defaultCategory,
        benchmark: 'average', duration: null, overrides: {} });
      const k = E.projectChild(data(), alt, a, familyDefaults().reportingCurrency);
      rows.push(cmpRow(names[cmp.child] + ' — alternative', cmp.country, cmp.qualification, k, ccy, annual, j));
    });
    box.appendChild(h('div', { class: 'ec-table-wrap' }, h('table', { class: 'ec-table' }, [
      h('thead', null, h('tr', null, ['Option', 'Country', 'Qualification', 'Total cost', annual ? 'Extra per year' : 'Extra per month', 'Benchmark', ''].map((x, j) =>
        h('th', { scope: 'col', class: j >= 3 && j <= 4 ? 'ec-num' : null }, x)))),
      h('tbody', null, rows)])));
    return box;
  }
  function cmpRow(label, country, qual, k, ccy, annual, idx) {
    if (!k.ok) return h('tr', null, [h('th', { scope: 'row' }, label), h('td', { colspan: 6 }, k.errors.join(' '))]);
    return h('tr', { class: idx === null ? 'is-base' : null }, [h('th', { scope: 'row' }, label), h('td', null, country), h('td', null, qual),
      h('td', { class: 'ec-num' }, money(k.summary.totalCost, ccy)),
      h('td', { class: 'ec-num' }, money(annual ? k.summary.requiredAnnualFirstYear : k.summary.requiredMonthlyFirstYear, ccy)),
      h('td', null, k.costs.hasTuitionData ? k.costs.benchmarkLabel : 'No fee data'),
      h('td', null, idx === null ? '' : h('button', { type: 'button', class: 'ec-link-btn', 'data-remove-compare': idx, 'aria-label': 'Remove comparison' }, 'Remove'))]);
  }

  /* ---------- update cycle ---------- */
  function update(opts) {
    validate();
    const fam = compute();
    renderRail(fam);
    if (opts && opts.plans) renderPlans();
    if (step === 4) renderResults(fam);
  }

  function goTo(n, focus) {
    step = Math.min(5, Math.max(1, n));
    $$('[data-step-panel]').forEach((p) => { p.hidden = Number(p.dataset.stepPanel) !== step; });
    $$('.ec-steps button').forEach((b) => { if (Number(b.dataset.step) === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    $('[data-nav="prev"]').hidden = step === 1;
    const next = $('[data-nav="next"]');
    next.hidden = step === 5;
    next.textContent = step === 3 ? 'See results' : 'Next';
    if (step === 2) renderPlans();
    if (step === 3) renderAssumptions();
    update();
    if (focus) {
      const heading = $('[data-step-panel="' + step + '"] h2');
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      $('#ec-app').scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }

  function readInput(el) {
    const path = el.dataset.path;
    let v;
    if (el.tagName === 'SELECT') {
      v = el.value;
      if (path === 'family.numChildren') v = Number(v);
    } else if (el.type === 'number') {
      v = el.value === '' ? null : Number(el.value);
      if (v !== null && !isFinite(v)) v = null;
      const zeroIfBlank = /\.(savings|monthly|annual|schPct|schFixed|otherFunding)$/.test(path);
      if (v === null && zeroIfBlank) v = 0;
    } else v = el.value;
    if (path.indexOf('fx.') === 0 && (v === null || v <= 0)) v = null;
    setPath(path, v);
    return path;
  }

  function onInput(e) {
    const el = e.target;
    if (el.dataset.path) {
      const path = readInput(el);
      syncInputs(document, el);
      const structural = /^family\.(numChildren|eduCountry|repCcy)$|\.(country|qualification|category|benchmark)$/.test(path);
      if (structural && e.type === 'change') {
        if (path === 'family.repCcy' || path === 'family.eduCountry') refreshCurrencySuffixes();
        updateChildDynamic();
        if (step === 3) renderAssumptions();
      }
      if (/\.(name|age|entryAge)$/.test(path)) updateChildDynamic();
      update();
      return;
    }
    if (el.dataset.override !== undefined) {
      const i = Number(el.dataset.override), f = el.dataset.field;
      const c = state.children[i];
      c.overrides = c.overrides || {};
      if (el.value === '' || !isFinite(Number(el.value)) || Number(el.value) < 0) delete c.overrides[f];
      else c.overrides[f] = Number(el.value);
      if (e.type === 'change') { renderPlans(); const again = $('[data-override="' + i + '"][data-field="' + f + '"]'); if (again) again.focus(); }
      update();
      return;
    }
    if (el.dataset.schedule) { scheduleView = el.value; renderResults(lastFamily); const s = $('[data-schedule]'); if (s) s.focus(); }
  }

  function status(msg, ok) {
    const s = $('#ec-status');
    s.textContent = msg;
    s.className = 'form-status ' + (ok ? 'is-success' : 'is-error');
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function csv() {
    const fam = lastFamily;
    const ccy = familyDefaults().reportingCurrency;
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [['Children\'s Future Education Fund Calculator — Sindhi Connect'], ['Reporting currency', ccy],
      ['Exchange rates as of', DATA0.exchangeRates.date], ['Estimates only. Returns are assumptions, not guarantees.'], [],
      ['Child', 'Country', 'Qualification', 'Years to college', 'First-year cost', 'Total cost', 'Savings at college start',
        'Extra per month (year 1)', 'Extra per year (year 1)', 'Up-front amount now', 'Coverage with current plan', 'Surplus or gap']];
    fam.children.forEach((k, i) => {
      if (i >= state.family.numChildren) return;
      const c = state.children[i];
      if (!k.ok) { lines.push([c.name || 'Child ' + (i + 1), 'Invalid: ' + k.errors.join(' ')]); return; }
      const s = k.summary;
      lines.push([c.name || 'Child ' + (i + 1), k.costs.country, c.qualification, s.yearsToCollege, s.costAtStart.toFixed(2), s.totalCost.toFixed(2),
        (s.fvSavingsAtStart + s.fvContributionsAtStart).toFixed(2), s.requiredMonthlyFirstYear === null ? 'n/a' : s.requiredMonthlyFirstYear.toFixed(2),
        s.requiredAnnualFirstYear.toFixed(2), s.requiredLumpNow.toFixed(2), (s.coverage * 100).toFixed(1) + '%', s.surplusOrGap.toFixed(2)]);
    });
    lines.push([], ['Year', 'Child', 'Age', 'Study year', 'Tuition & fees', 'Living', 'One-time & contingency', 'Scholarships', 'Net cost',
      'Existing contributions', 'Extra contributions', 'Fund at year end (with extra)', 'Fund at year end (current plan)', 'Unfunded (current plan)']);
    fam.children.forEach((k, i) => {
      if (i >= state.family.numChildren || !k.ok) return;
      k.rows.forEach((r) => lines.push([yearLabel(r.p), state.children[i].name || 'Child ' + (i + 1), r.age, r.academicYear || '',
        (r.tuition + r.otherFees).toFixed(2), r.living.toFixed(2), (r.oneTime + r.contingency).toFixed(2), r.scholarship.toFixed(2),
        r.expense.toFixed(2), r.existingContrib.toFixed(2), r.additionalContrib.toFixed(2), r.closingRequired.toFixed(2),
        r.closingCurrent.toFixed(2), r.shortfall.toFixed(2)]));
    });
    download('education-fund-plan.csv', '﻿' + lines.map((l) => l.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
    status('CSV exported.', true);
  }

  function backup() {
    const payload = { app: 'sindhi-connect-education-calculator', dataset: DATA0.version, savedAt: new Date().toISOString(), state };
    download('education-fund-backup.json', JSON.stringify(payload, null, 2), 'application/json');
    status('Backup downloaded.', true);
  }

  // Accept only known fields with the right types, so a tampered file cannot inject anything odd.
  function sanitize(raw) {
    const s = exampleState();
    if (!raw || typeof raw !== 'object') throw new Error('bad');
    const f = raw.family || {};
    const numOrNull = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
    const str = (v, max) => (typeof v === 'string' ? v.slice(0, max || 80) : '');
    s.family.numChildren = [1, 2, 3, 4].indexOf(f.numChildren) !== -1 ? f.numChildren : 1;
    s.family.label = str(f.label); s.family.residence = str(f.residence);
    s.family.eduCountry = countries.indexOf(f.eduCountry) !== -1 ? f.eduCountry : 'Pakistan';
    s.family.repCcy = DATA0.currencies.indexOf(f.repCcy) !== -1 ? f.repCcy : '';
    ['entryAge', 'ret', 'tuiInf', 'livInf', 'esc', 'cont', 'fxDrift'].forEach((k) => { s.family[k] = numOrNull(f[k]); });
    s.family.mode = f.mode === 'annual' ? 'annual' : 'monthly';
    s.fx = {};
    Object.keys(raw.fx || {}).forEach((c) => { if (DATA0.currencies.indexOf(c) !== -1 && numOrNull(raw.fx[c]) > 0) s.fx[c] = raw.fx[c]; });
    s.children = [0, 1, 2, 3].map((i) => {
      const c = (raw.children || [])[i] || {};
      const k = kidDefaults();
      k.name = str(c.name, 40); k.schoolClass = str(c.schoolClass, 40); k.custom = str(c.custom); k.specialisation = str(c.specialisation);
      k.age = numOrNull(c.age); k.entryAge = numOrNull(c.entryAge); k.duration = numOrNull(c.duration);
      k.country = countries.indexOf(c.country) !== -1 ? c.country : '';
      k.qualification = DATA0.qualifications.indexOf(c.qualification) !== -1 ? c.qualification : 'Computer Science';
      k.category = typeof c.category === 'string' ? c.category.slice(0, 60) : '';
      k.benchmark = c.benchmark === 'average' || DATA0.records.some((r) => r.id === c.benchmark) ? c.benchmark : 'average';
      ['savings', 'monthly', 'annual', 'schPct', 'schFixed', 'otherFunding'].forEach((x) => { k[x] = numOrNull(c[x]) || 0; });
      k.overrides = {};
      Object.keys(c.overrides || {}).forEach((x) => { if (E.COST_FIELDS.indexOf(x) !== -1 && numOrNull(c.overrides[x]) !== null) k.overrides[x] = c.overrides[x]; });
      return k;
    });
    s.comparisons = (Array.isArray(raw.comparisons) ? raw.comparisons : []).slice(0, 6).filter((c) =>
      c && [0, 1, 2, 3].indexOf(c.child) !== -1 && countries.indexOf(c.country) !== -1 && DATA0.qualifications.indexOf(c.qualification) !== -1);
    return s;
  }

  function loadState(s) {
    state = s;
    renderFamily(); renderChildren(); syncInputs(document);
    goTo(1);
  }

  function onClick(e) {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.step) { goTo(Number(t.dataset.step), true); return; }
    if (t.dataset.goto) { goTo(Number(t.dataset.goto), true); return; }
    if (t.dataset.nav) { goTo(step + (t.dataset.nav === 'next' ? 1 : -1), true); return; }
    if (t.dataset.clearOverrides !== undefined) { state.children[Number(t.dataset.clearOverrides)].overrides = {}; renderPlans(); update(); return; }
    if (t.dataset.removeCompare !== undefined) { state.comparisons.splice(Number(t.dataset.removeCompare), 1); renderResults(lastFamily); return; }
    const act = t.dataset.action;
    if (!act) return;
    if (act === 'add-compare') {
      state.comparisons.push({ child: Number($('#ec-cmp-child').value), country: $('#ec-cmp-country').value, qualification: $('#ec-cmp-qual').value });
      renderResults(lastFamily);
      const b = $('[data-action="add-compare"]'); if (b) b.focus();
    } else if (act === 'print') { buildPrint(); window.print(); }
    else if (act === 'csv') csv();
    else if (act === 'json') backup();
    else if (act === 'save') {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); status('Plan saved in this browser.', true); }
      catch (err) { status('This browser blocked saving. Use "Download backup" instead.', false); }
    } else if (act === 'restore') {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) { status('No saved plan found in this browser.', false); return; }
        loadState(sanitize(JSON.parse(raw))); goTo(5); status('Saved plan reloaded.', true);
      } catch (err) { status('The saved plan could not be read. Start again or load a backup file.', false); }
    } else if (act === 'reset') {
      if (!window.confirm('Clear all inputs and return to the example plan?')) return;
      try { localStorage.removeItem(STORE_KEY); } catch (err) { /* storage unavailable */ }
      loadState(exampleState()); goTo(1, true);
    }
  }

  function onLoadFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 200000) { status('That file is too large to be a calculator backup.', false); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        if (raw.app !== 'sindhi-connect-education-calculator') throw new Error('not ours');
        loadState(sanitize(raw.state)); goTo(5); status('Backup loaded.', true);
      } catch (err) { status('This file is not a calculator backup. Choose a file saved with "Download backup".', false); }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  /* ---------- print report ---------- */
  function buildPrint() {
    const root = clear($('#ec-print'));
    const fam = lastFamily;
    const ccy = familyDefaults().reportingCurrency;
    const a = assumptions();
    const names = state.children.map((c, i) => c.name || 'Child ' + (i + 1));
    root.append(
      h('h1', null, "Children's Future Education Fund — plan report"),
      h('p', null, (state.family.label ? state.family.label + '. ' : '') + 'Prepared ' + new Date().toLocaleDateString('en-GB') +
        ' with the Sindhi Connect calculator. Amounts in ' + ccy + '.'),
      h('p', { class: 'ec-print-note' }, DATA0.disclaimer),
      h('h2', null, 'Summary'),
      h('table', null, h('tbody', null, [
        ['Total estimated future education cost', money(fam.totals.totalCost, ccy)],
        ['Extra saving needed ' + (a.contributionMode === 'annual' ? 'per year' : 'per month') + ' (year 1)',
          money(a.contributionMode === 'annual' ? fam.totals.requiredAnnualFirstYear : fam.totals.requiredMonthlyFirstYear, ccy)],
        ['Up-front amount needed now', money(fam.totals.requiredLumpNow, ccy)],
        ['Projected value of current savings and contributions at college start', money(fam.totals.projectedExisting, ccy)],
        ['Coverage with current plan', pct(fam.totals.coverage, 0)],
        [fam.totals.surplusOrGap < 0 ? 'Funding gap' : 'Projected surplus', money(Math.abs(fam.totals.surplusOrGap), ccy)]
      ].map((r) => h('tr', null, [h('th', null, r[0]), h('td', null, r[1])])))),
      h('h2', null, 'Assumptions'),
      h('p', null, 'Return ' + pct(a.returnRate) + ', tuition inflation ' + pct(a.tuitionInflation) + ', living-cost inflation ' + pct(a.livingInflation) +
        ', contribution increase ' + pct(a.contributionEscalation) + ' a year, contingency ' + pct(a.contingency) + ', exchange-rate change ' +
        pct(a.fxDrift) + ' a year, ' + a.contributionMode + ' contributions. Exchange rates as of ' + DATA0.exchangeRates.date + '.')
    );
    fam.children.forEach((k, i) => {
      if (i >= state.family.numChildren) return;
      root.appendChild(h('h2', null, names[i]));
      if (!k.ok) { root.appendChild(h('p', null, 'Not calculated: ' + k.errors.join(' '))); return; }
      const s = k.summary;
      root.appendChild(h('p', null, k.costs.country + ', ' + state.children[i].qualification + ' (' + k.costs.studentCategory + '). Benchmark: ' +
        k.costs.benchmarkLabel + (k.costs.overridden.length ? '. User overrides: ' + k.costs.overridden.map((f) => COST_LABELS[f]).join(', ') : '') +
        '. Total cost ' + money(s.totalCost, ccy) + '; extra saving ' + money(s.requiredAnnualFirstYear, ccy) + ' in year 1' +
        (s.requiredLumpNow > 0.5 ? ' plus ' + money(s.requiredLumpNow, ccy) + ' now' : '') + '.'));
      root.appendChild(h('table', null, [h('thead', null, h('tr', null, ['Year', 'Age', 'Net cost', 'Your contributions', 'Extra contributions', 'Fund at year end'].map((x) => h('th', null, x)))),
        h('tbody', null, k.rows.map((r) => h('tr', null, [yearLabel(r.p), r.age, plain(r.expense), plain(r.existingContrib), plain(r.additionalContrib), plain(r.closingRequired)].map((v) => h('td', null, String(v))))))]));
      root.appendChild(h('p', { class: 'ec-print-note' }, 'Sources: ' + k.costs.sources.map((x) => x.label + ' (' + x.url + ')').join('; ')));
    });
  }

  /* ---------- init ---------- */
  function init() {
    const dd = new Date(DATA0.datasetDate + 'T00:00:00');
    $$('[data-ec="dataset-date"]').forEach((el) => { el.textContent = dd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); });
    $('#ec-disclaimer').textContent = DATA0.disclaimer;
    renderFamily();
    renderChildren();
    syncInputs(document);
    const form = $('#ec-form');
    form.addEventListener('input', onInput);
    form.addEventListener('change', onInput);
    document.addEventListener('click', onClick);
    $('#ec-load').addEventListener('change', onLoadFile);
    window.addEventListener('beforeprint', buildPrint);
    goTo(1);
  }

  init();
})();

/* =========================================================
   Children's Future Education Fund Calculator — page logic (v2).
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
  const STORE_KEY = 'sc-edu-calc-plan-v2';
  const COUNTRIES = DATA0.countries.map((c) => c.name);
  const PLACES = DATA0.places.map((p) => p.name);
  const QUALS = DATA0.qualifications.map((q) => q.name);

  const COST_LABELS = {
    tuition: 'Tuition fees', preTuition: 'Tuition fees', accommodation: 'Accommodation', food: 'Food',
    transport: 'Local transport', healthInsurance: 'Health insurance', books: 'Books and study materials',
    otherFees: 'Other university and course fees', preOtherFees: 'Other university and course fees',
    admission: 'Admission and registration', visaApplication: 'Visa and application',
    travelRelocation: 'First travel and settling in'
  };
  const COST_HELP = {
    otherFees: 'Compulsory university charges not already in tuition, such as registration, exam, laboratory, student-service, technology and course-specific fees.',
    preOtherFees: 'Compulsory university charges not already in tuition, such as registration, exam, laboratory, student-service, technology and course-specific fees.',
    healthInsurance: 'Health cover the student must have — for example the UK health surcharge, Australia\'s OSHC or German student health insurance.',
    visaApplication: 'Student visa and related government charges. Not needed when the child studies in their own country.',
    travelRelocation: 'One trip to start the course and settling in. Day-to-day travel is under Local transport, so it is not counted twice.',
    admission: 'One-time admission, application or registration charges (refundable deposits are not included).'
  };
  const GROUP_LABELS = {
    tuition: 'Tuition fees', accommodation: 'Accommodation', food: 'Food', transport: 'Transport',
    healthInsurance: 'Health insurance', books: 'Books and study materials', otherFees: 'Other university and course fees',
    visaTravel: 'Visa, application, travel and relocation'
  };
  const GROUP_COLORS = {
    tuition: '#0e1016', accommodation: '#e9a825', food: '#c98a12', transport: '#8a5d00',
    healthInsurance: '#a61e2a', books: '#5b6b8c', otherFees: '#8b8578', visaTravel: '#2f6f4f'
  };
  const CHILD_COLORS = ['#0e1016', '#e9a825', '#a61e2a', '#5b6b8c'];
  const STATUS_TEXT = {
    verified: 'Published figure', estimated: 'Estimated — please review', missing: 'No figure yet — please enter',
    override: 'Your figure', notNeeded: 'Not needed'
  };

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
  const svg = (tag, attrs, children) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
    (children || []).forEach((c) => el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return el;
  };
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
  function money(v, ccy) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency: ccy, currencyDisplay: 'code',
        maximumFractionDigits: 0 }).format(Math.round(v)).replace(/ /g, ' ');
    } catch (e) { return ccy + ' ' + Math.round(v).toLocaleString('en'); }
  }
  const plain = (v) => (v === null || v === undefined || !isFinite(v) ? '' : Math.round(v).toLocaleString('en'));
  const pct = (v, d) => (isFinite(v) ? (v * 100).toFixed(d === undefined ? 1 : d).replace(/\.0$/, '') + '%' : '—');
  const yearsText = (n) => (n === 1 ? '1 year' : (Number.isInteger(n) ? n : n.toFixed(1)) + ' years');
  const academic = (y) => y + '/' + String(y + 1).slice(-2);

  /* ---------- state ---------- */
  function kidDefaults(i) {
    const ages = [10, 6, 3, 1];
    const classes = [5, 1, 0, 0];
    return { name: 'Child ' + (i + 1), age: ages[i], schoolClass: classes[i], country: 'Pakistan',
      qualification: 'Computer Science', entryAge: DATA0.assumptions.collegeEntryAge, overrides: {}, tInf: null, lInf: null };
  }
  function freshState() {
    return {
      version: 2,
      family: { numChildren: 1, residence: 'Pakistan', nationality: 'Pakistan', repCcy: '',
        coverage: DATA0.assumptions.coverageDefault * 100, ret: null, savInc: DATA0.assumptions.savingsIncreaseDefault * 100 },
      fx: {},
      children: [0, 1, 2, 3].map(kidDefaults),
      compare: { child: 0, countries: COUNTRIES.slice() }
    };
  }

  let state = freshState();
  let step = 1;
  let lastFamily = null;

  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const activeKids = () => state.children.slice(0, state.family.numChildren);
  const countryCcy = (country) => (E.countryInfo(DATA0, country) || { currency: 'USD' }).currency;
  const reportingCurrency = () => state.family.repCcy || countryCcy(state.children[0].country);

  function rates() {
    const r = Object.assign({}, DATA0.exchangeRates.rates);
    Object.keys(state.fx || {}).forEach((c) => { if (isNum(state.fx[c]) && state.fx[c] > 0) r[c] = state.fx[c]; });
    return r;
  }

  function familyInput() {
    return { nationality: state.family.nationality, residence: state.family.residence, rates: rates() };
  }

  function assumptions() {
    const ccy = reportingCurrency();
    const f = state.family;
    return {
      reportingCurrency: ccy,
      returnRate: (isNum(f.ret) ? f.ret : E.defaultReturn(DATA0, ccy) * 100) / 100,
      savingsIncrease: (isNum(f.savInc) ? f.savInc : 0) / 100,
      coverage: Math.min(100, Math.max(0, isNum(f.coverage) ? f.coverage : 0)) / 100
    };
  }

  function engineChild(c) {
    return { age: c.age, entryAge: c.entryAge, country: c.country, qualification: c.qualification,
      overrides: c.overrides || {}, tuitionInflation: isNum(c.tInf) ? c.tInf / 100 : null,
      livingInflation: isNum(c.lInf) ? c.lInf / 100 : null };
  }

  function scenario() {
    return { numChildren: state.family.numChildren, family: familyInput(), assumptions: assumptions(),
      children: state.children.map(engineChild) };
  }

  const childName = (c, i) => (c.name && c.name.trim()) || 'Child ' + (i + 1);

  /* ---------- form field builder ---------- */
  function field(opts) {
    // opts: label, path, type ('number'|'text'|'select'), options, help, min, max, step, suffix, structural, wide
    const id = nextId('ec');
    const helpId = opts.help ? id + '-help' : null;
    const errId = id + '-err';
    const described = [helpId, errId].filter(Boolean).join(' ');
    let input;
    if (opts.type === 'select') {
      input = h('select', { id, 'data-path': opts.path, 'aria-describedby': described, 'data-structural': opts.structural ? '1' : null },
        opts.options.map((o) => h('option', { value: typeof o === 'object' ? o.value : o }, typeof o === 'object' ? o.label : o)));
    } else {
      input = h('input', { id, 'data-path': opts.path, type: opts.type === 'text' ? 'text' : 'number',
        inputmode: opts.type === 'text' ? null : 'decimal', min: opts.min, max: opts.max, step: opts.step || 'any',
        maxlength: opts.type === 'text' ? 40 : null, 'aria-describedby': described,
        'data-structural': opts.structural ? '1' : null });
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

  function syncInputs(root) {
    $$('[data-path]', root).forEach((el) => {
      const v = getPath(el.dataset.path);
      if (el.tagName === 'SELECT') {
        el.value = v === undefined || v === null ? '' : String(v);
        if (el.selectedIndex === -1 && el.options.length) el.selectedIndex = 0;
      } else if (el.type === 'range') {
        el.value = v === undefined || v === null ? 0 : v;
      } else if (document.activeElement !== el) {
        el.value = v === undefined || v === null ? '' : String(v);
      }
    });
  }

  /* ---------- Step 1: basic information + children ---------- */
  function renderBasic() {
    const root = clear($('#ec-basic'));
    root.append(
      field({ label: 'Number of children', path: 'family.numChildren', type: 'select', structural: true,
        options: [1, 2, 3, 4].map((n) => ({ value: n, label: String(n) })) }),
      field({ label: 'Country of residence', path: 'family.residence', type: 'select', structural: true, options: PLACES,
        help: 'Where your family lives now. Used for first-travel estimates.' }),
      field({ label: 'Nationality', path: 'family.nationality', type: 'select', structural: true, options: PLACES,
        help: 'The children\'s nationality. Decides local or international fees and visa costs.' }),
      field({ label: 'Show results in', path: 'family.repCcy', type: 'select', structural: true,
        options: [{ value: '', label: 'Automatic (Child 1\'s study country)' }].concat(DATA0.currencies.map((c) => ({ value: c, label: c }))),
        help: 'All amounts in the results use this currency.' })
    );
    syncInputs(root);
  }

  function renderChildren() {
    const root = clear($('#ec-children'));
    for (let i = 0; i < MAX_KIDS; i++) {
      const p = 'children.' + i + '.';
      const grid = h('div', { class: 'ec-grid' }, [
        field({ label: 'Child\'s name', path: p + 'name', type: 'text' }),
        field({ label: 'Current age', path: p + 'age', type: 'select', structural: true,
          options: Array.from({ length: 19 }, (_, a) => ({ value: a, label: a + (a === 1 ? ' year' : ' years') })) }),
        field({ label: 'Current school class', path: p + 'schoolClass', type: 'select',
          options: Array.from({ length: 14 }, (_, k) => ({ value: k, label: k === 0 ? '0 (pre-school / not yet at school)' : 'Class ' + k })) }),
        field({ label: 'Plan education country', path: p + 'country', type: 'select', structural: true, options: COUNTRIES }),
        field({ label: 'Intended qualification', path: p + 'qualification', type: 'select', structural: true, options: QUALS }),
        field({ label: 'Expected college-entry age', path: p + 'entryAge', type: 'number', min: 14, max: 45, step: 1, structural: true,
          help: 'Usually 18. Change it if your child will start earlier or later.' })
      ]);
      root.appendChild(h('fieldset', { class: 'ec-child', 'data-child': i, hidden: i >= state.family.numChildren }, [
        h('legend', null, [h('span', { class: 'ec-child-badge', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'ec-child-title' }, 'Child ' + (i + 1))]),
        grid,
        h('div', { class: 'ec-duration', 'data-duration': i, 'aria-live': 'polite' })
      ]));
    }
    syncInputs(root);
    updateChildDynamic();
  }

  // Name in the legend and the read-only course length under each child
  function updateChildDynamic() {
    $$('.ec-child').forEach((fs) => {
      const i = Number(fs.dataset.child);
      const c = state.children[i];
      fs.hidden = i >= state.family.numChildren;
      $('.ec-child-title', fs).textContent = childName(c, i);
      const box = clear($('[data-duration]', fs));
      const d = E.courseDuration(DATA0, c.country, c.qualification);
      if (!d.available) {
        box.appendChild(h('p', { class: 'ec-warn' }, [h('strong', null, 'Not offered here. '), d.note || 'Choose another country or qualification.']));
        return;
      }
      const lines = [h('strong', null, 'Course length: ' + yearsText(d.years)),
        ' — ' + (d.variable ? 'typical length; the actual length may vary. ' : '') + (d.note || '')];
      box.appendChild(h('p', { class: 'ec-duration-text' }, lines));
      const start = DATA0.planStartYear + Math.max(0, c.entryAge - c.age);
      const startText = c.entryAge <= c.age ? 'Starts college this year (' + academic(DATA0.planStartYear) + ').'
        : 'Starts college in ' + yearsText(c.entryAge - c.age) + ' (' + academic(start) + ').';
      box.appendChild(h('p', { class: 'ec-help' }, startText));
    });
  }

  /* ---------- Step 2: education costs ---------- */
  function planRows(costs, dur) {
    const pre = costs.preStage;
    const q = E.qualificationInfo(DATA0, costs.qualification);
    // ACCA, CPA and CA are exam pathways, not taught degrees
    const mainFee = q && q.kind === 'professional' ? 'Exam, registration and membership fees' : COST_LABELS.tuition;
    const rows = [];
    if (pre) {
      rows.push({ key: 'preTuition', label: COST_LABELS.tuition + ' — years 1–' + pre.years + ' (' + pre.label + ')', timing: 'per year' });
      rows.push({ key: 'preOtherFees', label: COST_LABELS.otherFees + ' — years 1–' + pre.years, timing: 'per year' });
      rows.push({ key: 'tuition', label: mainFee + ' — years ' + (pre.years + 1) + '–' + Math.ceil(dur), timing: 'per year' });
      rows.push({ key: 'otherFees', label: COST_LABELS.otherFees + ' — years ' + (pre.years + 1) + '–' + Math.ceil(dur), timing: 'per year' });
    } else {
      rows.push({ key: 'tuition', label: mainFee, timing: 'per year' });
      rows.push({ key: 'otherFees', label: COST_LABELS.otherFees, timing: 'per year' });
    }
    ['accommodation', 'food', 'transport', 'healthInsurance', 'books'].forEach((k) => rows.push({ key: k, label: COST_LABELS[k], timing: 'per year' }));
    ['admission', 'visaApplication', 'travelRelocation'].forEach((k) => rows.push({ key: k, label: COST_LABELS[k], timing: 'once' }));
    return rows;
  }

  function renderPlans() {
    const root = clear($('#ec-plans'));
    const fam = familyInput();
    activeKids().forEach((c, i) => {
      const d = E.courseDuration(DATA0, c.country, c.qualification);
      const sec = h('section', { class: 'ec-plan', 'aria-labelledby': 'ec-plan-h-' + i });
      sec.appendChild(h('h3', { id: 'ec-plan-h-' + i }, childName(c, i) + ' — ' + c.qualification + ' in ' + c.country));
      if (!d.available) {
        sec.appendChild(h('p', { class: 'ec-warn' }, (d.note || 'This qualification is not offered in this country.') + ' Go back to Basic information to choose another country or qualification.'));
        root.appendChild(sec);
        return;
      }
      const costs = E.resolveCosts(DATA0, engineChild(c), fam);
      const ccy = costs.currency;
      sec.appendChild(h('p', { class: 'ec-plan-meta' }, [
        (costs.feeStatus === 'domestic' ? 'Local student fees' : 'International student fees') + ' (nationality: ' + state.family.nationality + '). ',
        'Course length ' + yearsText(d.years) + '. Amounts are today\'s prices in ' + ccy + '.'
      ]));

      const tbody = h('tbody');
      planRows(costs, d.years).forEach((row) => {
        const it = costs.items[row.key];
        if (!it) return;
        const path = 'children.' + i + '.overrides.' + row.key;
        const inputId = nextId('ec-cost');
        const helpId = COST_HELP[row.key] ? inputId + '-h' : null;
        const statusKey = it.status;
        const input = h('input', { id: inputId, type: 'number', min: 0, step: 'any', inputmode: 'decimal',
          'data-cost': row.key, 'data-child': i, 'aria-describedby': helpId });
        input.value = Math.round(it.amount);
        const notes = [it.note].filter(Boolean);
        const srcList = (it.sources || []).filter((s) => safeUrl(s.url));
        tbody.appendChild(h('tr', { class: statusKey === 'override' ? 'is-override' : statusKey === 'missing' ? 'is-missing' : null, 'data-row': row.key }, [
          h('th', { scope: 'row' }, [
            h('label', { for: inputId }, row.label),
            h('span', { class: 'ec-timing' }, row.timing === 'once' ? ' (one-time, first year)' : ' (per year)'),
            helpId ? h('span', { class: 'ec-help ec-help-row', id: helpId }, COST_HELP[row.key]) : null
          ]),
          h('td', null, h('div', { class: 'ec-affix' }, [input, h('span', { class: 'ec-suffix', 'aria-hidden': 'true' }, ccy)])),
          h('td', null, [
            h('span', { class: 'ec-status ec-status-' + statusKey }, STATUS_TEXT[statusKey] || statusKey),
            statusKey === 'override' ? h('button', { type: 'button', class: 'ec-link-btn', 'data-action': 'undo', 'data-path': path, 'aria-label': 'Use the researched figure for ' + row.label }, 'Undo') : null,
            notes.length || srcList.length ? h('details', { class: 'ec-why' }, [
              h('summary', null, 'Why this figure?'),
              notes.length ? h('p', null, notes.join(' ')) : null,
              srcList.length ? h('ul', { class: 'ec-sources' }, srcList.slice(0, 6).map((s) =>
                h('li', null, [h('a', { href: safeUrl(s.url), target: '_blank', rel: 'noopener' }, s.label), s.status ? ' — ' + s.status : '']))) : null
            ]) : null
          ])
        ]));
      });
      sec.appendChild(h('div', { class: 'ec-table-wrap' }, h('table', { class: 'ec-table ec-costs' }, [
        h('caption', { class: 'sr-only' }, 'Education costs for ' + childName(c, i)),
        h('thead', null, h('tr', null, [h('th', { scope: 'col' }, 'Cost'), h('th', { scope: 'col' }, 'Amount (' + ccy + ')'), h('th', { scope: 'col' }, 'Where it comes from')])),
        tbody
      ])));
      const qi = E.qualificationInfo(DATA0, c.qualification);
      if (qi && qi.kind === 'professional') {
        sec.appendChild(h('p', { class: 'ec-help-block' }, DATA0.professionalQualificationNote +
          ' Living costs assume the student lives away from home — set them to 0 if your child will live at home while studying.'));
      }
      const missing = Object.keys(costs.items).filter((k) => costs.items[k].status === 'missing');
      if (missing.some((k) => k === 'tuition' || k === 'preTuition')) {
        sec.appendChild(h('p', { class: 'ec-warn' }, 'We have not found a published fee for this course yet. Please enter an estimate for tuition, for example from a university you are considering. Until then the plan leaves tuition out.'));
      }
      root.appendChild(sec);
    });
  }

  function renderCoverage() {
    const root = clear($('#ec-coverage'));
    const id = nextId('ec-cov');
    const helpId = id + '-help';
    const range = h('input', { type: 'range', id, min: 0, max: 100, step: 5, 'data-path': 'family.coverage', 'aria-describedby': helpId });
    const box = h('input', { type: 'number', min: 0, max: 100, step: 1, 'data-path': 'family.coverage', 'aria-label': 'Percentage covered', inputmode: 'decimal' });
    root.appendChild(h('div', { class: 'ec-coverage' }, [
      h('label', { for: id, class: 'ec-coverage-label' }, 'Expected education costs covered by scholarship or part-time work'),
      h('div', { class: 'ec-coverage-controls' }, [range, h('div', { class: 'ec-affix ec-coverage-num' }, [box, h('span', { class: 'ec-suffix', 'aria-hidden': 'true' }, '%')])]),
      h('p', { class: 'ec-help', id: helpId }, 'This percentage represents the portion of eligible education costs that you expect scholarships, bursaries or permitted part-time work to cover. This is an assumption, not a guarantee. It reduces tuition, university fees and living costs — not visa or first-travel costs — and is applied only once.')
    ]));
    syncInputs(root);
  }

  function renderAssumptions() {
    const root = clear($('#ec-assumptions'));
    const ccy = reportingCurrency();
    root.appendChild(h('p', { class: 'ec-help-block' }, 'Education fees may rise over time. We use historical information where available to estimate future costs. Actual increases may differ. Leave a box empty to use our figure.'));
    root.appendChild(h('div', { class: 'ec-grid' }, [
      field({ label: 'Expected yearly investment return', path: 'family.ret', type: 'number', min: -50, max: 30, step: 0.1, suffix: '%',
        help: 'Our figure for ' + ccy + ': ' + pct(E.defaultReturn(DATA0, ccy)) + '. ' + DATA0.assumptions.returnNote }),
      field({ label: 'Increase your savings each year by', path: 'family.savInc', type: 'number', min: 0, max: 20, step: 0.5, suffix: '%',
        help: '0% means the same amount every year. A higher figure starts lower and rises.' })
    ]));

    const fam = familyInput();
    const body = h('tbody');
    activeKids().forEach((c, i) => {
      const fs = E.feeStatusFor(DATA0, c.country, fam.nationality);
      const t = E.tuitionInflationFor(DATA0, c.country, c.qualification, fs);
      const l = E.livingInflationFor(DATA0, c.country);
      const tId = nextId('ec-ti'), lId = nextId('ec-li');
      body.appendChild(h('tr', null, [
        h('th', { scope: 'row' }, childName(c, i) + ' — ' + c.country),
        h('td', null, [h('label', { for: tId, class: 'sr-only' }, 'Fee increase per year for ' + childName(c, i)),
          h('div', { class: 'ec-affix' }, [h('input', { id: tId, type: 'number', step: 0.1, min: -10, max: 30, 'data-path': 'children.' + i + '.tInf', placeholder: (t.rate * 100).toFixed(1), 'data-structural': '1' }), h('span', { class: 'ec-suffix', 'aria-hidden': 'true' }, '%')]),
          h('span', { class: 'ec-help' }, 'Our figure ' + pct(t.rate) + ' — ' + (t.basis === 'planning' ? 'planning assumption. ' : 'based on published fees. ') + (t.note || ''))]),
        h('td', null, [h('label', { for: lId, class: 'sr-only' }, 'Living-cost increase per year for ' + childName(c, i)),
          h('div', { class: 'ec-affix' }, [h('input', { id: lId, type: 'number', step: 0.1, min: -10, max: 30, 'data-path': 'children.' + i + '.lInf', placeholder: (l.rate * 100).toFixed(1), 'data-structural': '1' }), h('span', { class: 'ec-suffix', 'aria-hidden': 'true' }, '%')]),
          h('span', { class: 'ec-help' }, 'Our figure ' + pct(l.rate) + ' — planning assumption.')])
      ]));
    });
    root.appendChild(h('h3', { class: 'ec-sub' }, 'Yearly price rises'));
    root.appendChild(h('div', { class: 'ec-table-wrap' }, h('table', { class: 'ec-table' }, [
      h('thead', null, h('tr', null, [h('th', { scope: 'col' }, 'Child'), h('th', { scope: 'col' }, 'University fees rise by'), h('th', { scope: 'col' }, 'Living costs rise by')])),
      body
    ])));

    // exchange rates, only when some amount has to be converted
    const used = Array.from(new Set(activeKids().map((c) => countryCcy(c.country)).concat([ccy])));
    if (used.length > 1) {
      root.appendChild(h('h3', { class: 'ec-sub' }, 'Exchange rates'));
      root.appendChild(h('p', { class: 'ec-help-block' }, 'Amounts are converted into ' + ccy + ' at reference rates from ' +
        DATA0.exchangeRates.date + ' (European Central Bank; State Bank of Pakistan for PKR). Change a rate if you expect a different one.'));
      const grid = h('div', { class: 'ec-grid' });
      used.filter((c) => c !== 'USD').forEach((c) => {
        grid.appendChild(field({ label: c + ' per 1 USD', path: 'fx.' + c, type: 'number', min: 0, step: 'any', structural: true,
          help: 'Reference rate: ' + DATA0.exchangeRates.rates[c] }));
      });
      root.appendChild(grid);
    }
    syncInputs(root);
  }

  /* ---------- results ---------- */
  function compute() {
    lastFamily = E.projectFamily(DATA0, scenario());
    return lastFamily;
  }

  function problems(fam) {
    const list = [];
    fam.children.forEach((k, i) => {
      const name = childName(state.children[i], i);
      if (!k.ok) k.errors.forEach((e) => list.push(name + ': ' + e));
      else if (k.summary.hasMissing) list.push(name + ': some costs have no figure yet (see Education costs).');
    });
    return list;
  }

  function lumpText(fam) {
    const ccy = reportingCurrency();
    if (fam.totals.lumpNow <= 0.5) return null;
    const who = fam.children.map((k, i) => (k.ok && k.summary.lumpNow > 0.5 ? childName(state.children[i], i) : null)).filter(Boolean);
    return 'Plus about ' + money(fam.totals.lumpNow, ccy) + ' needed now, because ' + who.join(' and ') +
      (who.length > 1 ? ' start' : ' starts') + ' college before any yearly saving can be made.';
  }

  function renderRail(fam) {
    const root = clear($('#ec-rail'));
    const ccy = reportingCurrency();
    const ok = fam.children.some((k) => k.ok);
    root.append(
      h('p', { class: 'ec-rail-label' }, 'Total education fund required'),
      h('p', { class: 'ec-rail-figure' }, ok ? money(fam.totals.totalCost, ccy) : '—'),
      h('p', { class: 'ec-rail-label ec-rail-gap' }, 'Required yearly savings (this year)'),
      h('p', { class: 'ec-rail-figure ec-rail-figure-2' }, ok ? money(fam.totals.firstYearSaving, ccy) : '—')
    );
    const lt = lumpText(fam);
    if (lt) root.appendChild(h('p', { class: 'ec-rail-lump' }, lt));
    if (problems(fam).length) root.appendChild(h('p', { class: 'ec-rail-warn' }, 'Some information is missing — see Results.'));
    if (step !== 3) root.appendChild(h('button', { type: 'button', class: 'btn btn-primary btn-sm btn-block', 'data-goto': '3' }, 'See full results'));
  }

  function renderResults(fam) {
    const root = clear($('#ec-results'));
    const ccy = reportingCurrency();
    const a = assumptions();
    const probs = problems(fam);
    if (probs.length) {
      root.appendChild(h('div', { class: 'ec-warn', role: 'note' }, [h('strong', null, 'Please check: '), h('ul', null, probs.map((p) => h('li', null, p)))]));
    }
    const okKids = fam.children.map((k, i) => ({ k, i })).filter((x) => x.k.ok);
    if (!okKids.length) return;

    // 1. the two headline figures
    const n = state.family.numChildren;
    const lt = lumpText(fam);
    const savingNote = fam.totals.firstYearSaving > 0.5
      ? 'This is the family\'s saving for ' + academic(DATA0.planStartYear).replace('/', '–') + '. ' +
        (a.savingsIncrease > 0 ? 'It rises by ' + pct(a.savingsIncrease) + ' each year. ' : '') +
        'The amount changes in later years as children start and finish — see the yearly plan below.'
      : (lt ? 'No yearly saving can help, because the costs start right away.' : 'No saving is needed under these assumptions.');
    root.appendChild(h('div', { class: 'ec-headline' }, [
      h('div', { class: 'ec-big' }, [
        h('p', { class: 'ec-big-label' }, 'Total education fund required'),
        h('p', { class: 'ec-big-figure' }, money(fam.totals.totalCost, ccy)),
        h('p', { class: 'ec-big-note' }, 'For ' + (n === 1 ? 'your child\'s full course' : 'all ' + n + ' children\'s full courses') +
          ', at future prices' + (a.coverage > 0 ? ', after ' + pct(a.coverage, 0) + ' covered by scholarship or part-time work' : '') + '.')
      ]),
      h('div', { class: 'ec-big ec-big-dark' }, [
        h('p', { class: 'ec-big-label' }, 'Required yearly savings'),
        h('p', { class: 'ec-big-figure' }, money(fam.totals.firstYearSaving, ccy)),
        h('p', { class: 'ec-big-note' }, savingNote),
        lt ? h('p', { class: 'ec-big-lump' }, lt) : null
      ])
    ]));

    // 2. child summary
    root.appendChild(h('h3', { class: 'ec-sub' }, 'Each child'));
    root.appendChild(h('div', { class: 'ec-table-wrap' }, h('table', { class: 'ec-table' }, [
      h('thead', null, h('tr', null, [h('th', { scope: 'col' }, 'Child'), h('th', { scope: 'col' }, 'Education starts in'),
        h('th', { scope: 'col', class: 'ec-num' }, 'Total estimated education cost')])),
      h('tbody', null, fam.children.map((k, i) => {
        const c = state.children[i];
        if (!k.ok) return h('tr', null, [h('th', { scope: 'row' }, childName(c, i)), h('td', { colspan: 2, class: 'ec-err-cell' }, k.errors[0])]);
        const s = k.summary;
        return h('tr', null, [
          h('th', { scope: 'row' }, childName(c, i)),
          h('td', null, s.yearsToCollege === 0 ? 'This year (' + academic(s.startYear) + ')' : yearsText(s.yearsToCollege) + ' (' + academic(s.startYear) + ')'),
          h('td', { class: 'ec-num ec-strong' }, money(s.totalCost, ccy))
        ]);
      }).concat(n > 1 ? [h('tr', { class: 'ec-total-row' }, [h('th', { scope: 'row' }, 'All children'), h('td'), h('td', { class: 'ec-num ec-strong' }, money(fam.totals.totalCost, ccy))])] : []))
    ])));

    // 3. cost breakdown
    root.appendChild(h('h3', { class: 'ec-sub' }, 'Where the money goes'));
    root.appendChild(breakdown(fam, ccy, a));

    // 4. chart
    root.appendChild(h('h3', { class: 'ec-sub' }, 'Education costs and family savings by year'));
    root.appendChild(chart(fam, ccy));

    // 5. schedule
    root.appendChild(schedule(fam, ccy));
  }

  function breakdown(fam, ccy, a) {
    const t = fam.totals;
    const total = t.totalCost;
    const groups = E.BREAKDOWN.map((g) => ({ key: g.key, value: t.byGroup[g.key] })).filter((g) => g.value > 0.5);
    const bar = h('div', { class: 'ec-bar', role: 'img', 'aria-label': 'Share of total cost by type' },
      groups.map((g) => h('span', { style: 'width:' + (total > 0 ? (g.value / total * 100).toFixed(2) : 0) + '%;background:' + GROUP_COLORS[g.key] })));
    const list = h('ul', { class: 'ec-breakdown-list' }, groups.map((g) => h('li', null, [
      h('span', { class: 'ec-swatch', style: 'background:' + GROUP_COLORS[g.key], 'aria-hidden': 'true' }),
      h('span', { class: 'ec-bd-label' }, GROUP_LABELS[g.key]),
      h('span', { class: 'ec-bd-value' }, money(g.value, ccy)),
      h('span', { class: 'ec-bd-share' }, total > 0 ? pct(g.value / total, 0) : '')
    ])));
    return h('div', { class: 'ec-breakdown' }, [
      bar, list,
      h('p', { class: 'ec-bd-total' }, [h('span', null, 'Total'), h('strong', null, money(total, ccy))]),
      a.coverage > 0 ? h('p', { class: 'ec-help' }, 'Amounts are after ' + pct(a.coverage, 0) + ' of tuition, university fees and living costs (' +
        money(t.coveredTotal, ccy) + ' in total) is covered by scholarship or part-time work. Visa and travel costs are not reduced.') : null
    ]);
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  function compact(v) {
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(Math.round(v));
  }

  // Stacked bars = each child's costs in that year; line = the family's saving that year
  function chart(fam, ccy) {
    const years = fam.years;
    const kids = fam.children.map((k, i) => ({ k, i })).filter((x) => x.k.ok);
    const W = 760, H = 320, L = 64, R = 16, T = 16, B = 40;
    const max = niceMax(Math.max(1, ...years.map((y) => Math.max(y.expense, y.saving))));
    const x0 = (j) => L + j * (W - L - R) / years.length;
    const bw = Math.max(4, (W - L - R) / years.length * 0.7);
    const yv = (v) => T + (H - T - B) * (1 - v / max);
    const g = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'ec-chart', role: 'img',
      'aria-label': 'Bar chart of education costs per year for each child, with a line for the family\'s yearly savings, in ' + ccy + '.' });
    for (let t = 0; t <= 4; t++) {
      const v = max * t / 4;
      g.appendChild(svg('line', { x1: L, x2: W - R, y1: yv(v), y2: yv(v), class: 'ec-grid-line' }));
      g.appendChild(svg('text', { x: L - 8, y: yv(v) + 4, 'text-anchor': 'end', class: 'ec-axis' }, [compact(v)]));
    }
    const every = Math.ceil(years.length / 12);
    years.forEach((y, j) => {
      const cx = x0(j) + ((W - L - R) / years.length - bw) / 2;
      let base = 0;
      kids.forEach(({ i }) => {
        const v = y.byChild[i] || 0;
        if (v <= 0) return;
        const rect = svg('rect', { x: cx, width: bw, y: yv(base + v), height: Math.max(0, yv(base) - yv(base + v)), fill: CHILD_COLORS[i % 4] });
        rect.appendChild(svg('title', {}, [childName(state.children[i], i) + ', ' + academic(y.year) + ': ' + money(v, ccy)]));
        g.appendChild(rect);
        base += v;
      });
      if (j % every === 0) g.appendChild(svg('text', { x: cx + bw / 2, y: H - B + 16, 'text-anchor': 'middle', class: 'ec-axis' }, [String(y.year)]));
    });
    const pts = years.map((y, j) => (x0(j) + (W - L - R) / years.length / 2).toFixed(1) + ',' + yv(y.saving).toFixed(1)).join(' ');
    g.appendChild(svg('polyline', { points: pts, class: 'ec-line-saving-halo' }));
    g.appendChild(svg('polyline', { points: pts, class: 'ec-line-saving' }));
    years.forEach((y, j) => {
      const dot = svg('circle', { cx: x0(j) + (W - L - R) / years.length / 2, cy: yv(y.saving), r: 3, class: 'ec-dot-saving' });
      dot.appendChild(svg('title', {}, ['Family savings ' + academic(y.year) + ': ' + money(y.saving, ccy)]));
      g.appendChild(dot);
    });
    g.appendChild(svg('text', { x: L, y: H - 6, class: 'ec-axis' }, ['Year (amounts in ' + ccy + ')']));
    const legend = h('ul', { class: 'ec-chart-legend' }, kids.map(({ i }) => h('li', null, [
      h('span', { class: 'ec-key ec-key-bar', style: 'background:' + CHILD_COLORS[i % 4], 'aria-hidden': 'true' }),
      childName(state.children[i], i) + ' — education costs'
    ])).concat([h('li', null, [h('span', { class: 'ec-key ec-key-line', 'aria-hidden': 'true' }), 'Required family savings that year'])]));
    return h('figure', { class: 'ec-figure' }, [g, legend]);
  }

  function schedule(fam, ccy) {
    const rows = fam.years.map((y) => h('tr', { class: y.studying.length ? 'is-study' : null }, [
      h('th', { scope: 'row' }, academic(y.year)),
      h('td', null, y.studying.length ? y.studying.map((i) => childName(state.children[i], i)).join(', ') : '—'),
      h('td', { class: 'ec-num' }, y.expense > 0.5 ? money(y.expense, ccy) : '—'),
      h('td', { class: 'ec-num' }, y.saving > 0.5 ? money(y.saving, ccy) : '—'),
      h('td', { class: 'ec-num' }, money(Math.max(0, y.fund), ccy))
    ]));
    return h('details', { class: 'ec-schedule', open: fam.years.length <= 12 }, [
      h('summary', null, 'Year-by-year plan (' + fam.years.length + ' years)'),
      h('p', { class: 'ec-help-block' }, 'This table shows when education expenses may occur and how much the family may need to save in each year.'),
      h('div', { class: 'ec-table-wrap ec-scroll' }, h('table', { class: 'ec-table' }, [
        h('thead', null, h('tr', null, ['Year', 'Child or children studying', 'Estimated education expenses', 'Suggested family savings', 'Remaining education fund']
          .map((t, k) => h('th', { scope: 'col', class: k > 1 ? 'ec-num' : null }, t)))),
        h('tbody', null, rows)
      ])),
      h('p', { class: 'ec-help' }, 'Expenses are paid at the start of each year and savings are added at the end, so the remaining fund is the balance after that year\'s saving.')
    ]);
  }

  /* ---------- Step 4: compare countries ---------- */
  function renderCompare() {
    const root = clear($('#ec-compare'));
    const kids = activeKids();
    if (state.compare.child >= kids.length) state.compare.child = 0;
    const idx = state.compare.child;
    const c = state.children[idx];
    const ccy = reportingCurrency();
    const selId = nextId('ec-cmp');
    root.appendChild(h('div', { class: 'ec-compare-form' }, [
      h('div', { class: 'field ec-field' }, [
        h('label', { for: selId }, 'Child'),
        h('select', { id: selId, 'data-compare': 'child' }, kids.map((k, i) => h('option', { value: i, selected: i === idx }, childName(k, i))))
      ]),
      h('div', { class: 'field ec-field' }, [h('span', { class: 'ec-field-label' }, 'Qualification'), h('p', { class: 'ec-readonly' }, c.qualification)]),
      h('fieldset', { class: 'ec-check-group' }, [
        h('legend', null, 'Countries to compare'),
        h('div', { class: 'ec-checks' }, COUNTRIES.map((name) => {
          const id = nextId('ec-cc');
          return h('label', { for: id, class: 'ec-check' }, [
            h('input', { type: 'checkbox', id, value: name, 'data-compare': 'country', checked: state.compare.countries.indexOf(name) !== -1 }), name
          ]);
        }))
      ])
    ]));
    const list = E.compareCountries(DATA0, engineChild(c), familyInput(), assumptions(), COUNTRIES.filter((n) => state.compare.countries.indexOf(n) !== -1));
    const body = h('tbody', null, list.map((r) => {
      const current = r.country === c.country;
      let value, tag = null;
      if (!r.available) { value = 'Not available'; tag = r.reason; }
      else {
        value = money(r.totalCost, ccy);
        if (r.hasMissing) tag = 'Some costs have no figure yet — total is incomplete';
        else if (r.status === 'estimated') tag = 'Estimate — no published fee for this course';
      }
      return h('tr', { class: current ? 'is-base' : null }, [
        h('th', { scope: 'row' }, [r.country, current ? h('span', { class: 'ec-tag' }, 'Current plan') : null]),
        h('td', { class: 'ec-num' }, [h('span', { class: 'ec-strong' }, value), tag ? h('span', { class: 'ec-help ec-cmp-note' }, tag) : null]),
        h('td', null, !current && r.available ? h('button', { type: 'button', class: 'btn btn-sm ec-btn-outline', 'data-action': 'use-country',
          'data-country': r.country, 'data-child': idx }, 'Use ' + r.country + ' for ' + childName(c, idx)) : null)
      ]);
    }));
    root.appendChild(h('div', { class: 'ec-table-wrap' }, h('table', { class: 'ec-table ec-compare' }, [
      h('thead', null, h('tr', null, [h('th', { scope: 'col' }, 'Country'), h('th', { scope: 'col', class: 'ec-num' }, 'Total estimated education cost (' + ccy + ')'), h('th', { scope: 'col' }, h('span', { class: 'sr-only' }, 'Action'))])),
      body
    ])));
    root.appendChild(h('p', { class: 'ec-help-block' }, 'Each total covers the full course in that country (its usual length), at future prices, after your scholarship / part-time-work percentage. Your own cost edits are not carried over, because they are in another country\'s currency.'));
  }

  /* ---------- update cycle ---------- */
  function validateInline() {
    $$('.ec-child').forEach((fs) => {
      const i = Number(fs.dataset.child);
      const c = state.children[i];
      const entry = $('[data-path="children.' + i + '.entryAge"]', fs);
      const err = entry && document.getElementById(entry.getAttribute('aria-describedby').split(' ').pop());
      const bad = !(isNum(c.entryAge) && c.entryAge >= 14 && c.entryAge <= 45 && Math.round(c.entryAge) === c.entryAge);
      if (entry) entry.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (err) err.textContent = bad ? 'Enter a whole number from 14 to 45.' : '';
    });
  }

  function refresh(structural) {
    if (structural) {
      updateChildDynamic();
      renderPlans();
      renderAssumptions();
    }
    validateInline();
    const fam = compute();
    renderRail(fam);
    if (step === 3) renderResults(fam);
    if (step === 4) renderCompare();
  }

  function goTo(n, focus) {
    step = Math.max(1, Math.min(5, n));
    $$('[data-step-panel]').forEach((p) => { p.hidden = Number(p.dataset.stepPanel) !== step; });
    $$('.ec-steps button').forEach((b) => {
      if (Number(b.dataset.step) === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    $('[data-nav="prev"]').hidden = step === 1;
    $('[data-nav="next"]').hidden = step === 5;
    if (step === 2) { renderPlans(); renderCoverage(); renderAssumptions(); }
    const fam = compute();
    renderRail(fam);
    if (step === 3) renderResults(fam);
    if (step === 4) renderCompare();
    if (focus) {
      const head = $('#ec-h' + step);
      $('#ec-app').scrollIntoView({ block: 'start' });
      head.focus({ preventScroll: true });
    }
  }

  function readValue(el) {
    if (el.tagName === 'SELECT') {
      const v = el.value;
      return /^-?\d+(\.\d+)?$/.test(v) && !/^(family\.(residence|nationality|repCcy)|children\.\d+\.(country|qualification))$/.test(el.dataset.path) ? Number(v) : v;
    }
    if (el.type === 'text') return el.value.slice(0, 40);
    if (el.value === '') return null;
    const n = Number(el.value);
    return isFinite(n) ? n : null;
  }

  function onInput(e) {
    const el = e.target;
    if (el.dataset.cost) {
      const i = Number(el.dataset.child);
      const v = el.value === '' ? null : Number(el.value);
      const ov = state.children[i].overrides;
      if (v === null || !isFinite(v) || v < 0) delete ov[el.dataset.cost];
      else ov[el.dataset.cost] = v;
      const row = el.closest('tr');
      if (row && e.type === 'change') renderPlans();
      else if (row) row.classList.add('is-override');
      refresh(false);
      return;
    }
    if (el.dataset.compare) {
      if (el.dataset.compare === 'child') state.compare.child = Number(el.value);
      else state.compare.countries = $$('[data-compare="country"]').filter((x) => x.checked).map((x) => x.value);
      renderCompare();
      return;
    }
    if (!el.dataset.path) return;
    const path = el.dataset.path;
    let v = readValue(el);
    if (path === 'family.coverage' && v !== null) v = Math.max(0, Math.min(100, v));
    // a different country or qualification means the old cost edits no longer apply
    if (/^children\.\d+\.(country|qualification)$/.test(path) && getPath(path) !== v) {
      const i = Number(path.split('.')[1]);
      state.children[i].overrides = {};
    }
    setPath(path, v);
    if (path === 'family.coverage') syncInputs($('#ec-coverage'));
    if (/\.name$/.test(path)) updateChildDynamic();
    refresh(el.dataset.structural === '1' && e.type === 'change' || el.tagName === 'SELECT');
  }

  /* ---------- Start again ---------- */
  const dialog = $('#ec-reset-dialog');
  let dialogReturn = null;
  function openReset() {
    dialogReturn = document.activeElement;
    if (dialog.showModal) dialog.showModal();
    else if (window.confirm(dialog.querySelector('#ec-reset-text').textContent)) doReset();
    const cancel = $('[data-dialog="cancel"]', dialog);
    if (cancel) cancel.focus();
  }
  function closeReset() {
    if (dialog.open) dialog.close();
    if (dialogReturn) dialogReturn.focus();
  }
  function doReset() {
    // resets the form only; a plan saved in this browser is kept
    state = freshState();
    renderBasic();
    renderChildren();
    renderCoverage();
    goTo(1);
    status('Everything has been cleared. A plan you saved in this browser is still there.', true);
  }

  /* ---------- save, load, export ---------- */
  function status(msg, ok) {
    const el = $('#ec-status');
    el.className = 'form-status ' + (ok ? 'is-success' : 'is-error');
    el.textContent = msg;
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function csvCell(v) {
    const s = String(v === null || v === undefined ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csv() {
    const fam = lastFamily || compute();
    const ccy = reportingCurrency();
    const lines = [['Children\'s Future Education Fund — plan (' + ccy + ')'], [],
      ['Total education fund required', Math.round(fam.totals.totalCost)],
      ['Required yearly savings (this year)', Math.round(fam.totals.firstYearSaving)],
      ['Amount needed now', Math.round(fam.totals.lumpNow)], [],
      ['Child', 'Country', 'Qualification', 'Education starts in (years)', 'Total estimated education cost']];
    fam.children.forEach((k, i) => {
      const c = state.children[i];
      lines.push([childName(c, i), c.country, c.qualification, k.ok ? k.summary.yearsToCollege : '', k.ok ? Math.round(k.summary.totalCost) : 'not calculated']);
    });
    lines.push([], ['Year', 'Children studying', 'Estimated education expenses', 'Suggested family savings', 'Remaining education fund']);
    fam.years.forEach((y) => lines.push([academic(y.year), y.studying.map((i) => childName(state.children[i], i)).join('; '),
      Math.round(y.expense), Math.round(y.saving), Math.round(Math.max(0, y.fund))]));
    download('education-fund-plan.csv', lines.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv');
  }

  function backup() {
    download('education-fund-plan.json', JSON.stringify({ app: 'sindhi-connect-education-calculator', version: 2, state }, null, 1), 'application/json');
  }

  // Accept only known fields with sensible values from a loaded file
  function sanitize(raw) {
    const s = freshState();
    if (!raw || typeof raw !== 'object') return s;
    const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : null);
    const f = raw.family || {};
    s.family.numChildren = num(f.numChildren, 1, 4) || 1;
    if (PLACES.indexOf(f.residence) !== -1) s.family.residence = f.residence;
    if (PLACES.indexOf(f.nationality) !== -1) s.family.nationality = f.nationality;
    if (DATA0.currencies.indexOf(f.repCcy) !== -1) s.family.repCcy = f.repCcy;
    s.family.coverage = num(f.coverage, 0, 100) || 0;
    s.family.ret = num(f.ret, -50, 30);
    s.family.savInc = num(f.savInc, 0, 20) || 0;
    Object.keys(raw.fx || {}).forEach((c) => { if (DATA0.currencies.indexOf(c) !== -1 && num(raw.fx[c], 1e-9, 1e9)) s.fx[c] = raw.fx[c]; });
    (raw.children || []).slice(0, 4).forEach((c, i) => {
      if (!c || typeof c !== 'object') return;
      const k = s.children[i];
      if (typeof c.name === 'string') k.name = c.name.slice(0, 40);
      const age = num(c.age, 0, 18); if (age !== null) k.age = Math.round(age);
      const sc = num(c.schoolClass, 0, 13); if (sc !== null) k.schoolClass = Math.round(sc);
      if (COUNTRIES.indexOf(c.country) !== -1) k.country = c.country;
      if (QUALS.indexOf(c.qualification) !== -1) k.qualification = c.qualification;
      const ea = num(c.entryAge, 14, 45); if (ea !== null) k.entryAge = Math.round(ea);
      k.tInf = num(c.tInf, -10, 30);
      k.lInf = num(c.lInf, -10, 30);
      Object.keys(c.overrides || {}).forEach((key) => {
        if ((E.ITEM_KEYS.indexOf(key) !== -1 || key === 'preTuition' || key === 'preOtherFees') && num(c.overrides[key], 0, 1e12) !== null) k.overrides[key] = c.overrides[key];
      });
    });
    return s;
  }

  function loadState(s) {
    state = s;
    renderBasic();
    renderChildren();
    renderCoverage();
    refresh(true);
  }

  function onLoadFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 200000) { status('That file is too large to be a calculator backup.', false); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        if (raw.app !== 'sindhi-connect-education-calculator' || raw.version !== 2) throw new Error('not ours');
        loadState(sanitize(raw.state)); goTo(5); status('Backup loaded.', true);
      } catch (err) { status('This file is not a backup from this version of the calculator.', false); }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  function onClick(e) {
    const t = e.target.closest('button, [data-goto]');
    if (!t) return;
    if (t.dataset.step) { goTo(Number(t.dataset.step), true); return; }
    if (t.dataset.goto) { goTo(Number(t.dataset.goto), true); return; }
    if (t.dataset.nav) { goTo(step + (t.dataset.nav === 'next' ? 1 : -1), true); return; }
    if (t.dataset.dialog === 'cancel') { closeReset(); return; }
    if (t.dataset.dialog === 'confirm') { closeReset(); doReset(); return; }
    const act = t.dataset.action;
    if (!act) return;
    if (act === 'reset') openReset();
    else if (act === 'undo') {
      setPath(t.dataset.path, null);
      renderPlans();
      refresh(false);
    } else if (act === 'use-country') {
      const i = Number(t.dataset.child);
      state.children[i].country = t.dataset.country;
      state.children[i].overrides = {};
      updateChildDynamic();
      syncInputs($('#ec-children'));
      refresh(true);
      renderCompare();
    } else if (act === 'print') window.print();
    else if (act === 'csv') csv();
    else if (act === 'json') backup();
    else if (act === 'save') {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); status('Plan saved in this browser.', true); }
      catch (err) { status('This browser did not allow saving. Use "Download backup" instead.', false); }
    } else if (act === 'restore') {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) { status('No saved plan found in this browser.', false); return; }
        loadState(sanitize(JSON.parse(raw))); goTo(5); status('Saved plan loaded.', true);
      } catch (err) { status('The saved plan could not be read.', false); }
    }
  }

  /* ---------- print report ---------- */
  function buildPrint() {
    const root = clear($('#ec-print'));
    const fam = lastFamily || compute();
    const ccy = reportingCurrency();
    const a = assumptions();
    root.append(
      h('h1', null, 'Children\'s Future Education Fund — plan'),
      h('p', null, 'Prepared ' + new Date().toLocaleDateString('en-GB') + ' with the Sindhi Connect calculator. Amounts in ' + ccy + '.'),
      h('p', { class: 'ec-print-note' }, DATA0.disclaimer),
      h('table', null, h('tbody', null, [
        ['Total education fund required', money(fam.totals.totalCost, ccy)],
        ['Required yearly savings (this year)', money(fam.totals.firstYearSaving, ccy)],
        ['Amount needed now', money(fam.totals.lumpNow, ccy)],
        ['Covered by scholarship / part-time work', pct(a.coverage, 0)],
        ['Investment return; yearly increase in savings', pct(a.returnRate) + '; ' + pct(a.savingsIncrease)],
        ['Nationality; country of residence', state.family.nationality + '; ' + state.family.residence]
      ].map((r) => h('tr', null, [h('th', null, r[0]), h('td', null, r[1])])))),
      h('h2', null, 'Each child')
    );
    fam.children.forEach((k, i) => {
      const c = state.children[i];
      if (!k.ok) { root.appendChild(h('p', null, childName(c, i) + ': not calculated — ' + k.errors.join(' '))); return; }
      root.appendChild(h('p', null, childName(c, i) + ' — ' + c.qualification + ' in ' + c.country + ', ' + yearsText(k.duration.used) +
        ', starting ' + academic(k.summary.startYear) + ': total ' + money(k.summary.totalCost, ccy) + '. Fee increase ' + pct(k.costs.tuitionInflation) +
        ' a year, living costs ' + pct(k.costs.livingInflation) + ' a year.'));
    });
    root.appendChild(h('h2', null, 'Year-by-year plan'));
    root.appendChild(h('table', null, [h('thead', null, h('tr', null, ['Year', 'Studying', 'Education expenses', 'Family savings', 'Remaining fund'].map((x) => h('th', null, x)))),
      h('tbody', null, fam.years.map((y) => h('tr', null, [academic(y.year), y.studying.map((i) => childName(state.children[i], i)).join(', '),
        plain(y.expense), plain(y.saving), plain(Math.max(0, y.fund))].map((v) => h('td', null, String(v))))))]));
  }

  /* ---------- init ---------- */
  function init() {
    const dd = new Date(DATA0.datasetDate + 'T00:00:00');
    $$('[data-ec="dataset-date"]').forEach((el) => { el.textContent = dd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); });
    $('#ec-disclaimer').textContent = DATA0.disclaimer;
    renderBasic();
    renderChildren();
    renderCoverage();
    const form = $('#ec-form');
    form.addEventListener('input', onInput);
    form.addEventListener('change', onInput);
    document.addEventListener('click', onClick);
    dialog.addEventListener('cancel', () => { dialogReturn = $('[data-action="reset"]'); });
    $('#ec-load').addEventListener('change', onLoadFile);
    window.addEventListener('beforeprint', buildPrint);
    goTo(1);
  }

  init();
})();

/* =========================================================
   Scroll reveal — fades in [data-reveal] elements as they
   enter the viewport. Content stays visible without JS.
   ========================================================= */
(function () {
  'use strict';

  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length || !('IntersectionObserver' in window)) return;

  document.documentElement.classList.add('js-reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  items.forEach((item) => observer.observe(item));
})();

/* =========================================================
   Knowledge Hub — builds category cards, filters and
   resource cards from window.SC_KNOWLEDGE (resources.js).
   Add content in resources.js; nothing here needs to change.
   ========================================================= */
(function () {
  'use strict';

  const data = window.SC_KNOWLEDGE;
  const hub = document.getElementById('knowledge-hub');
  if (!data || !hub) return;

  const ICONS = {
    book: '<svg viewBox="0 0 24 24"><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5Z"/><path d="M12 6.5v13"/></svg>',
    landmark: '<svg viewBox="0 0 24 24"><path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M9.7 10v8M14.3 10v8M19 10v8"/><path d="M3 20.5h18"/></svg>',
    person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    feather: '<svg viewBox="0 0 24 24"><path d="M20.2 3.8a6 6 0 0 0-8.5 0L5 10.5V19h8.5l6.7-6.7a6 6 0 0 0 0-8.5Z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/></svg>',
    growth: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z"/></svg>'
  };

  const categories = data.categories || [];
  // `order` keeps the position in resources.js: later entries count as newer
  const resources = (data.resources || []).map((r, i) => Object.assign({ order: i }, r));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const catName = (r) => (catById.get(r.category) || { name: r.category || '' }).name;

  const el = {
    cats: hub.querySelector('.kh-cats'),
    chips: hub.querySelector('.kh-chips'),
    search: hub.querySelector('#kh-search'),
    sort: hub.querySelector('#kh-sort'),
    count: hub.querySelector('.kh-count'),
    grid: hub.querySelector('.kh-grid'),
    empty: hub.querySelector('.kh-empty'),
    library: hub.querySelector('.kh-library')
  };

  const state = { category: 'all', query: '', sort: 'featured' };

  const SORTS = {
    featured: (a, b) => Number(!!b.featured) - Number(!!a.featured) || a.order - b.order,
    newest: (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || b.order - a.order,
    category: (a, b) => catName(a).localeCompare(catName(b)) || String(a.title).localeCompare(String(b.title))
  };

  /* ---------- helpers ---------- */
  // All text goes in via textContent, so content is never treated as HTML.
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function icon(name, className) {
    const span = make('span', className);
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = ICONS[name] || ICONS.globe; // built-in SVGs only
    return span;
  }

  // Allow web links and files on this site only (blocks javascript: etc.)
  function safeUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value, document.baseURI);
      const ok = ['http:', 'https:', location.protocol].includes(url.protocol);
      return ok ? url.href : '';
    } catch (e) {
      return '';
    }
  }

  const isOwnFile = (href) => new URL(href).origin === location.origin;
  const plural = (n) => n + (n === 1 ? ' resource' : ' resources');

  /* ---------- categories + filter chips ---------- */
  function renderCategories() {
    categories.forEach((cat) => {
      const count = resources.filter((r) => r.category === cat.id).length;
      const button = make('button', 'kh-cat');
      button.type = 'button';
      button.dataset.cat = cat.id;
      button.setAttribute('aria-pressed', 'false');
      button.append(
        icon(cat.icon, 'feature-icon'),
        make('span', 'kh-cat-name', cat.name),
        make('span', 'kh-cat-desc', cat.description),
        make('span', 'kh-cat-count', count ? plural(count) + ' →' : 'Coming soon')
      );
      button.addEventListener('click', () => {
        setCategory(cat.id);
        el.library.scrollIntoView({ block: 'start' });
      });
      const item = make('li');
      item.append(button);
      el.cats.append(item);
    });

    [{ id: 'all', name: 'All' }].concat(categories).forEach((cat) => {
      const chip = make('button', 'kh-chip', cat.name);
      chip.type = 'button';
      chip.dataset.cat = cat.id;
      chip.setAttribute('aria-pressed', String(cat.id === state.category));
      chip.addEventListener('click', () => setCategory(cat.id));
      el.chips.append(chip);
    });
  }

  function setCategory(id) {
    state.category = id;
    hub.querySelectorAll('.kh-cat, .kh-chip').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.cat === id));
    });
    // On mobile the chip row scrolls sideways: bring the active chip into view
    const active = el.chips.querySelector('[aria-pressed="true"]');
    el.chips.scrollLeft += active.getBoundingClientRect().left - el.chips.getBoundingClientRect().left - 16;
    render();
  }

  /* ---------- resource cards ---------- */
  function resourceCard(r) {
    const cat = catById.get(r.category);

    const cover = make('div', 'kh-cover');
    cover.dataset.cat = r.category;
    cover.setAttribute('aria-hidden', 'true');
    cover.append(icon(cat ? cat.icon : 'globe', 'kh-emblem'));
    const thumb = safeUrl(r.thumbnail);
    if (thumb) {
      const img = make('img');
      img.src = thumb;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => img.remove()); // fall back to the designed cover
      cover.append(img);
    }
    if (r.featured) cover.append(make('span', 'kh-featured', 'Featured'));

    const body = make('div', 'kh-card-body');
    body.append(
      make('p', 'kh-card-cat', catName(r)),
      make('h4', 'kh-card-title', r.title),
      make('p', 'kh-card-desc', r.description)
    );

    const meta = make('p', 'kh-meta');
    meta.append(make('span', 'kh-type', r.type || 'Resource'));
    const source = [r.author, r.year].filter(Boolean).join(' · ');
    if (source) meta.append(make('span', null, source));
    body.append(meta);

    const href = safeUrl(r.file);
    if (href) {
      const actions = make('div', 'kh-actions');
      const verb = /video|audio|image|gallery/i.test(r.type || '') ? 'View' : 'Read now';
      const open = make('a', 'btn btn-secondary btn-sm', verb);
      open.href = href;
      open.target = '_blank';
      open.rel = 'noopener';
      open.setAttribute('aria-label', verb + ': ' + r.title + ' (opens in a new tab)');
      actions.append(open);
      // Download only works for files hosted on this site
      if (r.download !== false && isOwnFile(href)) {
        const save = make('a', 'btn btn-sm kh-btn-outline', 'Download');
        save.href = href;
        save.setAttribute('download', '');
        save.setAttribute('aria-label', 'Download: ' + r.title);
        actions.append(save);
      }
      body.append(actions);
    }

    const card = make('article', 'kh-card');
    card.append(cover, body);
    const item = make('li');
    item.append(card);
    return item;
  }

  /* ---------- empty state ---------- */
  function renderEmpty() {
    const box = el.empty;
    box.replaceChildren(icon(state.query ? 'book' : (catById.get(state.category) || {}).icon, 'kh-emblem'));

    if (state.query) {
      const reset = make('button', 'btn btn-secondary btn-sm', 'Clear search');
      reset.type = 'button';
      reset.addEventListener('click', () => {
        el.search.value = '';
        state.query = '';
        render();
        el.search.focus();
      });
      box.append(
        make('h4', null, 'No resources match your search.'),
        make('p', null, 'Try a different word, or browse all categories.'),
        reset
      );
      return;
    }

    const contact = make('a', 'text-link', 'Suggest a resource →');
    contact.href = '#contact';
    box.append(
      make('h4', null, 'More knowledge is coming soon.'),
      make('p', null, 'We are preparing new resources for this category. Have a book or article worth sharing? Let us know.'),
      contact
    );
  }

  /* ---------- search + render ---------- */
  function matches(r) {
    if (state.category !== 'all' && r.category !== state.category) return false;
    if (!state.query) return true;
    const text = [r.title, r.description, r.author, catName(r)].join(' ').toLowerCase();
    return state.query.split(/\s+/).every((word) => text.includes(word));
  }

  function render() {
    const list = resources.filter(matches).sort(SORTS[state.sort] || SORTS.featured);
    el.grid.replaceChildren(...list.map(resourceCard));
    el.grid.hidden = list.length === 0;
    el.empty.hidden = list.length !== 0;
    if (!list.length) renderEmpty();

    const where = state.category === 'all' ? '' : ' in ' + catName({ category: state.category });
    el.count.textContent = 'Showing ' + plural(list.length) + where;
  }

  el.search.addEventListener('input', () => {
    state.query = el.search.value.trim().toLowerCase();
    render();
  });

  el.sort.addEventListener('change', () => {
    state.sort = el.sort.value;
    render();
  });

  renderCategories();
  render();
})();

/* =========================================================
   Sindhi Connect Chat — floating chat widget
   Four parts, kept separate so a real backend can replace
   part 1 later without touching the rest:
     1. Response logic   (local predefined replies for now)
     2. Quick replies    (suggestion chips)
     3. Chat UI          (DOM, rendering, open/close)
     4. Message handling (send flow, input events)
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 1. Response logic ---------- */
  // To connect a real AI backend later, replace getReply() with a
  // fetch() call that resolves to the reply text. Nothing else changes.
  const FALLBACK_REPLY =
    'Thank you for your message. Sindhi Connect will be happy to help. ' +
    'Please explore our website or contact us for more information.';

  const RESPONSES = [
    {
      match: /who are you|about (sindhi connect|you|us)\b|what is sindhi connect/i,
      reply: 'We are Sindhi Connect — a platform created to connect, inform and promote Sindhi language, culture and knowledge.'
    },
    {
      match: /contact|reach|email|get in touch/i,
      reply: 'You can reach us through the Contact form on this page. Send us your message and we will get back to you.'
    },
    {
      match: /video|content|watch/i,
      reply: 'You can explore our latest Sindhi videos and educational content on the website.'
    },
    {
      match: /language|learn|alphabet|speak/i,
      reply: 'We share content that helps people learn, understand and stay connected with the Sindhi language.'
    }
  ];

  const ChatResponder = {
    getReply(text) {
      const found = RESPONSES.find((r) => r.match.test(text));
      const reply = found ? found.reply : FALLBACK_REPLY;
      const delay = 700 + Math.random() * 600; // feels like someone typing
      return new Promise((resolve) => setTimeout(() => resolve(reply), delay));
    }
  };

  /* ---------- 2. Quick replies ---------- */
  const GREETING =
    'Assalam-o-Alaikum! 👋\nWelcome to Sindhi Connect.\n\nHow can we help you today?';

  const QUICK_REPLIES = [
    'Sindhi Language',
    'Videos & Content',
    'About Sindhi Connect',
    'Contact Us'
  ];

  /* ---------- 3. Chat UI ---------- */
  const ICONS = {
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7Z"/></svg>'
  };

  const root = document.createElement('div');
  root.className = 'sc-chat';
  root.innerHTML = `
    <section class="sc-chat-window" id="sc-chat-window" role="dialog"
             aria-label="Sindhi Connect Chat" tabindex="-1" aria-hidden="true">
      <header class="sc-chat-header">
        <span class="sc-chat-avatar sc-chat-avatar-lg" aria-hidden="true"></span>
        <div class="sc-chat-title">
          <p class="sc-chat-name">Sindhi Connect</p>
          <p class="sc-chat-status"><span class="sc-chat-dot" aria-hidden="true"></span>Online · How can we help you?</p>
        </div>
        <button type="button" class="sc-chat-close" aria-label="Close chat">${ICONS.close}</button>
      </header>
      <div class="sc-chat-log" role="log" aria-live="polite" aria-label="Conversation" tabindex="0"></div>
      <p class="sc-chat-typing" aria-live="polite" hidden>
        <span class="sc-chat-typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        Sindhi Connect is typing...
      </p>
      <form class="sc-chat-form">
        <label class="sr-only" for="sc-chat-input">Your message</label>
        <textarea id="sc-chat-input" class="sc-chat-input" rows="1"
                  placeholder="Type your message..." autocomplete="off"></textarea>
        <button type="submit" class="sc-chat-send" aria-label="Send message" disabled>${ICONS.send}</button>
      </form>
    </section>
    <button type="button" class="sc-chat-launcher" aria-label="Chat with Sindhi Connect"
            aria-expanded="false" aria-controls="sc-chat-window"
            data-tooltip="Chat with Sindhi Connect">
      <span class="sc-chat-launcher-open">${ICONS.chat}</span>
      <span class="sc-chat-launcher-close">${ICONS.close}</span>
    </button>`;
  document.body.appendChild(root);

  const el = {
    window: root.querySelector('.sc-chat-window'),
    launcher: root.querySelector('.sc-chat-launcher'),
    close: root.querySelector('.sc-chat-close'),
    log: root.querySelector('.sc-chat-log'),
    typing: root.querySelector('.sc-chat-typing'),
    form: root.querySelector('.sc-chat-form'),
    input: root.querySelector('.sc-chat-input'),
    send: root.querySelector('.sc-chat-send')
  };

  const ChatUI = {
    started: false,

    isOpen() {
      return root.classList.contains('is-open');
    },

    open() {
      root.classList.add('is-open');
      el.window.setAttribute('aria-hidden', 'false');
      el.launcher.setAttribute('aria-expanded', 'true');
      el.launcher.setAttribute('aria-label', 'Close chat');
      if (!this.started) {
        this.started = true;
        this.addMessage('bot', GREETING);
        this.addQuickReplies(QUICK_REPLIES);
      }
      // Don't pop the on-screen keyboard on touch devices.
      const target = window.matchMedia('(hover: hover)').matches ? el.input : el.window;
      target.focus({ preventScroll: true });
    },

    close() {
      root.classList.remove('is-open');
      el.window.setAttribute('aria-hidden', 'true');
      el.launcher.setAttribute('aria-expanded', 'false');
      el.launcher.setAttribute('aria-label', 'Chat with Sindhi Connect');
      el.launcher.focus({ preventScroll: true });
    },

    addMessage(sender, text) {
      const row = document.createElement('div');
      row.className = 'sc-chat-row sc-chat-row-' + sender;
      if (sender === 'bot') {
        const avatar = document.createElement('span');
        avatar.className = 'sc-chat-avatar';
        avatar.setAttribute('aria-hidden', 'true');
        row.appendChild(avatar);
      }
      const bubble = document.createElement('p');
      bubble.className = 'sc-chat-bubble';
      bubble.textContent = text; // textContent: visitor text is never treated as HTML
      const who = document.createElement('span');
      who.className = 'sr-only';
      who.textContent = sender === 'bot' ? 'Sindhi Connect: ' : 'You: ';
      bubble.prepend(who);
      row.appendChild(bubble);
      el.log.appendChild(row);
      this.scrollToEnd();
    },

    addQuickReplies(labels) {
      const group = document.createElement('div');
      group.className = 'sc-chat-chips';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Suggested questions');
      labels.forEach((label) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sc-chat-chip';
        chip.textContent = label;
        chip.addEventListener('click', () => ChatMessages.send(label));
        group.appendChild(chip);
      });
      el.log.appendChild(group);
      this.scrollToEnd();
    },

    setTyping(on) {
      el.typing.hidden = !on;
      this.scrollToEnd();
    },

    scrollToEnd() {
      el.log.scrollTop = el.log.scrollHeight;
    },

    resetInput() {
      el.input.value = '';
      el.input.style.height = 'auto';
      el.send.disabled = true;
    }
  };

  /* ---------- 4. Message handling ---------- */
  const ChatMessages = {
    pending: 0,
    queue: Promise.resolve(), // replies are answered one at a time, in order

    send(rawText) {
      const text = rawText.trim();
      if (!text) return;

      ChatUI.addMessage('user', text);
      this.pending += 1;
      ChatUI.setTyping(true);

      this.queue = this.queue
        .then(() => ChatResponder.getReply(text))
        .catch(() => FALLBACK_REPLY)
        .then((reply) => {
          this.pending -= 1;
          if (this.pending === 0) ChatUI.setTyping(false);
          ChatUI.addMessage('bot', reply);
        });
    }
  };

  el.launcher.addEventListener('click', () => {
    if (ChatUI.isOpen()) ChatUI.close();
    else ChatUI.open();
  });

  el.close.addEventListener('click', () => ChatUI.close());

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ChatUI.isOpen()) ChatUI.close();
  });

  el.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = el.input.value;
    ChatUI.resetInput();
    ChatMessages.send(text);
  });

  el.input.addEventListener('input', () => {
    el.send.disabled = el.input.value.trim() === '';
    // Grow with the text, up to the max-height set in CSS.
    el.input.style.height = 'auto';
    el.input.style.height = el.input.scrollHeight + 'px';
  });

  // Enter sends, Shift+Enter adds a new line.
  el.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      el.form.requestSubmit();
    }
  });
})();

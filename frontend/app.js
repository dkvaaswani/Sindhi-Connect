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

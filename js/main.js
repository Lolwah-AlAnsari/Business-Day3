/* ===========================================================================
   Plié Pilates — main.js
   ---------------------------------------------------------------------------
   Shared UI for every page:
     • mobile navigation drawer (accessible hamburger)
     • sticky-header shadow, active-page highlighting
     • toast notifications
     • accordion
     • a thin localStorage wrapper used by auth.js and booking.js
     • formatting + small render helpers driven by data.js

   Load order on every page:  data.js → main.js → auth.js → booking.js
   =========================================================================== */

(function () {
  'use strict';

  /* =========================================================================
     Tiny DOM helpers
     ========================================================================= */
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** Build an element from a tag, attributes object and children. */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (Array.isArray(children) ? children : children ? [children] : []).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /** Escape a string for safe interpolation into innerHTML. */
  function esc(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* =========================================================================
     Storage — namespaced localStorage with graceful failure
     (private browsing / disabled storage must not break the page)
     ========================================================================= */
  const PREFIX = 'plie:';

  const Store = {
    available() {
      try {
        const k = PREFIX + '__t';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
      } catch (e) {
        return false;
      }
    },
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.warn('[Plié] Could not write to localStorage:', e);
        return false;
      }
    },
    remove(key) {
      try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
    }
  };

  /* =========================================================================
     Formatting
     ========================================================================= */
  const DAY_NAMES  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                      'August', 'September', 'October', 'November', 'December'];

  const Fmt = {
    /** 12 → "12.000 KWD" */
    money(amount) {
      const cur = (window.STUDIO && window.STUDIO.studio.currency) || 'KWD';
      return Number(amount).toFixed(3).replace(/\.?0+$/, (m) => (m.indexOf('.') === 0 ? '' : m)) + ' ' + cur;
    },
    /** 12 → "12 KWD" (whole-number friendly) */
    price(amount) {
      const cur = (window.STUDIO && window.STUDIO.studio.currency) || 'KWD';
      const n = Number(amount);
      return (Number.isInteger(n) ? n : n.toFixed(2)) + ' ' + cur;
    },
    /** "07:00" → "7:00 AM" */
    time12(hhmm) {
      const parts = String(hhmm).split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1] || '00';
      const suffix = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return h + ':' + m + ' ' + suffix;
    },
    /** "07:00" + 50 → "7:50 AM" */
    endTime(hhmm, minutes) {
      const parts = String(hhmm).split(':');
      const total = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + Number(minutes);
      const h = Math.floor(total / 60) % 24;
      const m = total % 60;
      return Fmt.time12(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
    },
    /** Date → "Mon 14 Oct" */
    dateShort(date) {
      const d = toDate(date);
      return DAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()];
    },
    /** Date → "Monday, 14 October 2026" */
    dateLong(date) {
      const d = toDate(date);
      return DAY_NAMES[d.getDay()] + ', ' + d.getDate() + ' ' + MONTH_LONG[d.getMonth()] + ' ' + d.getFullYear();
    },
    dayName: (i) => DAY_NAMES[i],
    dayShort: (i) => DAY_SHORT[i],
    monthShort: (i) => MONTH_SHORT[i]
  };

  /* =========================================================================
     Date helpers — all dates are handled as local "YYYY-MM-DD" keys so that
     timezone conversion can never shift a class onto the wrong day.
     ========================================================================= */
  function toDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const p = value.split('-');
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }
    return new Date(value);
  }

  function dateKey(date) {
    const d = toDate(date);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, n) {
    const d = toDate(date);
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    out.setDate(out.getDate() + n);
    return out;
  }

  /** Combine a "YYYY-MM-DD" key and "HH:MM" into a real Date. */
  function slotDateTime(key, hhmm) {
    const d = toDate(key);
    const p = String(hhmm).split(':');
    d.setHours(parseInt(p[0], 10), parseInt(p[1], 10), 0, 0);
    return d;
  }

  const DateUtil = { toDate, dateKey, today, addDays, slotDateTime };

  /* =========================================================================
     Toasts
     ========================================================================= */
  const ICONS = {
    success: '<path d="M20 6L9 17l-5-5"/>',
    error:   '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    info:    '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
  };

  function toastRegion() {
    let region = $('#toast-region');
    if (!region) {
      region = el('div', {
        id: 'toast-region',
        class: 'toast-region',
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': 'false'
      });
      document.body.appendChild(region);
    }
    return region;
  }

  /**
   * Show a toast.
   * @param {string} title  bold first line
   * @param {string} [text] optional second line
   * @param {'success'|'error'|'info'} [type]
   * @param {number} [duration] ms; 0 keeps it until dismissed
   */
  function toast(title, text, type, duration) {
    type = type || 'info';
    const ms = duration === undefined ? 4800 : duration;
    const region = toastRegion();

    const node = el('div', { class: 'toast toast-' + type });
    node.innerHTML =
      '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ICONS[type] + '</svg>' +
      '<div class="toast-body">' +
      '<span class="toast-title">' + esc(title) + '</span>' +
      (text ? '<span class="toast-text">' + esc(text) + '</span>' : '') +
      '</div>' +
      '<button class="toast-close" type="button" aria-label="Dismiss notification">&times;</button>';

    const dismiss = () => {
      if (!node.isConnected) return;
      node.classList.add('is-leaving');
      setTimeout(() => node.remove(), 260);
    };

    $('.toast-close', node).addEventListener('click', dismiss);
    region.appendChild(node);
    if (ms > 0) setTimeout(dismiss, ms);
    return node;
  }

  /* =========================================================================
     Navigation
     ========================================================================= */
  function currentPage() {
    const file = window.location.pathname.split('/').pop();
    return !file || file === '' ? 'index.html' : file;
  }

  function initNav() {
    const header  = $('.site-header');
    const toggle  = $('.nav-toggle');
    const menu    = $('.nav-menu');
    const backdrop = $('.nav-backdrop');

    /* --- active page --- */
    const page = currentPage();
    $$('.nav-links a').forEach((link) => {
      const href = (link.getAttribute('href') || '').split('#')[0].split('?')[0];
      if (href === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    /* --- sticky shadow --- */
    if (header) {
      const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 8);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    if (!toggle || !menu) return;

    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.classList.toggle('is-open', open);
      if (backdrop) backdrop.classList.toggle('is-open', open);
      document.body.classList.toggle('no-scroll', open);
    };

    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

    toggle.addEventListener('click', () => setOpen(!isOpen()));
    if (backdrop) backdrop.addEventListener('click', () => setOpen(false));

    // Close on Escape and return focus to the toggle
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Close after following a link inside the drawer
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a') && isOpen()) setOpen(false);
    });

    // Reset when resizing back up to desktop
    let wasNarrow = window.matchMedia('(max-width: 900px)').matches;
    window.addEventListener('resize', () => {
      const narrow = window.matchMedia('(max-width: 900px)').matches;
      if (wasNarrow && !narrow && isOpen()) setOpen(false);
      wasNarrow = narrow;
    });
  }

  /* =========================================================================
     Accordion
     Markup:
       <div class="accordion" data-accordion>
         <div class="accordion-item">
           <h3><button class="accordion-trigger" aria-expanded="false" aria-controls="p1">…</button></h3>
           <div class="accordion-panel" id="p1" role="region"><div><p>…</p></div></div>
         </div>
       </div>
     ========================================================================= */
  function initAccordions(root) {
    $$('[data-accordion]', root || document).forEach((acc) => {
      const single = acc.dataset.accordion === 'single';
      const triggers = $$('.accordion-trigger', acc);

      triggers.forEach((trigger) => {
        // Bind per trigger, not per container: pages that render their items
        // from data.js call initAccordions() again once the markup exists.
        if (trigger.dataset.accordionBound === 'true') return;
        trigger.dataset.accordionBound = 'true';

        const panel = document.getElementById(trigger.getAttribute('aria-controls'));
        if (!panel) return;

        trigger.addEventListener('click', () => {
          const open = trigger.getAttribute('aria-expanded') === 'true';

          if (single && !open) {
            triggers.forEach((other) => {
              if (other === trigger) return;
              const otherPanel = document.getElementById(other.getAttribute('aria-controls'));
              other.setAttribute('aria-expanded', 'false');
              if (otherPanel) otherPanel.classList.remove('is-open');
            });
          }

          trigger.setAttribute('aria-expanded', String(!open));
          panel.classList.toggle('is-open', !open);
        });
      });
    });
  }

  /* =========================================================================
     Form validation helpers — inline messages, never alert()
     ========================================================================= */
  const Validate = {
    /** Mark a field invalid and show its error message. */
    fail(input, message) {
      if (!input) return false;
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      const msg = document.getElementById(input.id + '-error');
      if (msg) {
        msg.textContent = message;
        msg.classList.add('is-visible');
        input.setAttribute('aria-describedby', msg.id);
      }
      return false;
    },
    /** Clear the invalid state on a field. */
    clear(input) {
      if (!input) return true;
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
      const msg = document.getElementById(input.id + '-error');
      if (msg) {
        msg.textContent = '';
        msg.classList.remove('is-visible');
      }
      return true;
    },
    /** Clear every field in a form. */
    clearAll(form) {
      $$('.input, .select, .textarea', form).forEach((i) => Validate.clear(i));
    },
    /** Re-validate a field as soon as the user starts fixing it. */
    liveClear(form) {
      $$('.input, .select, .textarea', form).forEach((input) => {
        input.addEventListener('input', () => {
          if (input.classList.contains('is-invalid')) Validate.clear(input);
        });
      });
    },
    /** Move focus to the first invalid field so keyboard users land on it. */
    focusFirstError(form) {
      const first = $('.is-invalid', form);
      if (first) first.focus();
    },
    isEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(value).trim());
    }
  };

  /* =========================================================================
     Small render helpers used across pages
     ========================================================================= */
  const Render = {
    /** Photo placeholder block. EDIT the markup here to swap in real <img>. */
    media(gradient, label, extraClass) {
      const g = gradient || ['#F7DEE2', '#EFE4D8'];
      return '<div class="media ' + (extraClass || '') + '" style="--ph-a:' + esc(g[0]) +
        ';--ph-b:' + esc(g[1]) + '" role="img" aria-label="' + esc(label || 'Studio photograph') + '">' +
        (label ? '<span class="media-label" aria-hidden="true">' + esc(label) + '</span>' : '') +
        '</div>';
    },
    /** Circular initials avatar. */
    avatar(gradient, initials, extraClass) {
      const g = gradient || ['#F7DEE2', '#C4818C'];
      return '<div class="avatar ' + (extraClass || '') + '" style="--ph-a:' + esc(g[0]) +
        ';--ph-b:' + esc(g[1]) + '" aria-hidden="true">' + esc(initials) + '</div>';
    },
    /** Class-type badge. */
    typeBadge(typeId) {
      const t = window.STUDIO.classType(typeId);
      if (!t) return '';
      return '<span class="badge badge-' + esc(typeId) + '">' + esc(t.short) + '</span>';
    },
    /** Instructor preview card. */
    instructorCard(ins) {
      return '<article class="card card-hover instructor-card">' +
        Render.avatar(ins.gradient, ins.initials, 'avatar-lg') +
        '<h3>' + esc(ins.name) + '</h3>' +
        '<p class="role">' + esc(ins.role) + '</p>' +
        '<p class="specialty">' + esc(ins.specialty) + '</p>' +
        '</article>';
    },
    /** Testimonial figure. */
    testimonial(t) {
      return '<figure class="testimonial">' +
        '<span class="quote-mark" aria-hidden="true">&ldquo;</span>' +
        '<blockquote>' + esc(t.quote) + '</blockquote>' +
        '<figcaption>' +
        Render.avatar(['#F7DEE2', '#C4818C'], t.initials) +
        '<div><div class="name">' + esc(t.name) + '</div>' +
        '<div class="detail">' + esc(t.detail) + '</div></div>' +
        '</figcaption></figure>';
    },
    /** Fill a container from data, or show an empty state. */
    into(selector, html) {
      const target = $(selector);
      if (target) target.innerHTML = html;
      return target;
    }
  };

  /* =========================================================================
     Footer year + shared boot
     ========================================================================= */
  function initFooterYear() {
    $$('[data-year]').forEach((n) => { n.textContent = new Date().getFullYear(); });
  }

  /** Footer address / hours / social links, all driven by studio{} in data.js. */
  function initFooterContent() {
    if (!window.STUDIO) return;
    const s = window.STUDIO.studio;

    $$('[data-footer-contact]').forEach((node) => {
      node.innerHTML =
        '<li>' + esc(s.address.line1) + '</li>' +
        '<li>' + esc(s.address.line2) + '</li>' +
        '<li>' + esc(s.address.country) + '</li>' +
        '<li style="margin-top:0.9rem"><a href="tel:' + esc(s.phoneHref) + '">' + esc(s.phone) + '</a></li>' +
        '<li><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></li>' +
        s.hours.map((h) =>
          '<li style="margin-top:0.6rem"><span style="opacity:.75">' + esc(h.days) + '</span><br>' + esc(h.time) + '</li>'
        ).join('');
    });

    $$('[data-footer-social]').forEach((node) => {
      node.innerHTML = s.social.map((l) =>
        '<li><a href="' + esc(l.href) + '">' + esc(l.label) + '</a></li>'
      ).join('');
    });
  }

  function warnIfNoStorage() {
    if (Store.available()) return;
    const banner = $('[data-storage-warning]');
    if (banner) banner.classList.remove('hidden');
  }

  /* =========================================================================
     Public API
     ========================================================================= */
  window.UI = {
    $: $, $$: $$, el, esc,
    Store, Fmt, DateUtil, Validate, Render,
    toast,
    initAccordions,
    currentPage
  };

  /* =========================================================================
     Boot
     ========================================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initAccordions();
    initFooterYear();
    initFooterContent();
    warnIfNoStorage();
  });
})();

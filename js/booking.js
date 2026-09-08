/* ===========================================================================
   Plié Pilates — booking.js
   ---------------------------------------------------------------------------
   DEMO ONLY. Bookings live in localStorage on this device — see auth.js.

   Contains
     1. The booking engine   — resolves the weekly template in data.js into real
                               dated slots, tracks capacity, books and cancels
     2. Schedule controller  — schedule.html (filters + live spot counts)
     3. Wizard controller    — booking.html (4-step flow)
     4. Account controller   — account.html (bookings, credits, profile)
     5. Pricing controller   — pricing.html (demo credit "purchase")
   =========================================================================== */

(function () {
  'use strict';

  const { Store, Fmt, DateUtil, Validate, Render, toast, $, $$, esc } = window.UI;

  const KEY_BOOKINGS = 'bookings';
  const KEY_DRAFT    = 'draftBooking';

  /** How many days ahead the schedule and booking calendar run. */
  const HORIZON_DAYS = 21;

  /** Free-cancellation window, in hours. Matches the FAQ on contact.html. */
  const FREE_CANCEL_HOURS = 12;

  /* =========================================================================
     1. BOOKING ENGINE
     ========================================================================= */

  /* --- stored bookings ---------------------------------------------------- */
  function allBookings() {
    const list = Store.get(KEY_BOOKINGS, []);
    return Array.isArray(list) ? list : [];
  }

  function saveBookings(list) {
    return Store.set(KEY_BOOKINGS, list);
  }

  function bookingId() {
    return 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* --- slot identity ------------------------------------------------------ */
  function makeSlotId(dateKey, time, typeId) {
    return dateKey + '|' + time + '|' + typeId;
  }

  function parseSlotId(slotId) {
    const parts = String(slotId).split('|');
    if (parts.length !== 3) return null;
    return { dateKey: parts[0], time: parts[1], typeId: parts[2] };
  }

  /* --- simulated existing demand ------------------------------------------
     Without this every class would show "8 of 8 spots left", which makes the
     capacity rules impossible to see. A stable hash of the slot id gives each
     class a consistent baseline occupancy that never changes between reloads.
     EDIT: return 0 from this function to start every class completely empty.
     ------------------------------------------------------------------------ */
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  function baselineTaken(slotId, capacity) {
    const h = hashString(slotId) % 100;
    if (h < 7) return capacity;                              // ~7% sold out
    if (h < 20) return capacity - 1;                         // ~13% one spot left
    return Math.floor(((h - 20) / 80) * (capacity - 1));     // the rest, spread out
  }

  /* --- building slots ----------------------------------------------------- */

  /** Confirmed bookings for one slot, across all users. */
  function bookingsForSlot(slotId) {
    return allBookings().filter((b) => b.slotId === slotId && b.status === 'confirmed');
  }

  /** Build one fully-resolved slot object. */
  function buildSlot(dateKey, template) {
    const type = window.STUDIO.classType(template.type);
    const instructor = window.STUDIO.instructor(template.instructor);
    const id = makeSlotId(dateKey, template.time, template.type);
    const start = DateUtil.slotDateTime(dateKey, template.time);

    const capacity = type.capacity;
    const taken = Math.min(capacity, baselineTaken(id, capacity) + bookingsForSlot(id).length);
    const user = window.Auth.currentUser();

    return {
      id: id,
      dateKey: dateKey,
      date: DateUtil.toDate(dateKey),
      start: start,
      time: template.time,
      endLabel: Fmt.endTime(template.time, type.duration),
      typeId: type.id,
      type: type,
      instructorId: instructor.id,
      instructor: instructor,
      capacity: capacity,
      taken: taken,
      spotsLeft: Math.max(0, capacity - taken),
      isFull: taken >= capacity,
      isPast: start.getTime() <= Date.now(),
      bookedByMe: user
        ? bookingsForSlot(id).some((b) => b.userId === user.id)
        : false
    };
  }

  /** Every slot on one date, sorted by time. */
  function slotsForDate(dateKey) {
    const day = DateUtil.toDate(dateKey).getDay();
    return window.STUDIO.weeklySchedule
      .filter((t) => t.day === day)
      .map((t) => buildSlot(dateKey, t))
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  /** The next N days, starting today. */
  function upcomingDates(days) {
    const out = [];
    const start = DateUtil.today();
    for (let i = 0; i < (days || HORIZON_DAYS); i++) out.push(DateUtil.dateKey(DateUtil.addDays(start, i)));
    return out;
  }

  /** Look one slot up by id, or null if it isn't a real class. */
  function getSlot(slotId) {
    const parsed = parseSlotId(slotId);
    if (!parsed) return null;
    const day = DateUtil.toDate(parsed.dateKey).getDay();
    const template = window.STUDIO.weeklySchedule.find(
      (t) => t.day === day && t.time === parsed.time && t.type === parsed.typeId
    );
    return template ? buildSlot(parsed.dateKey, template) : null;
  }

  /* --- booking & cancelling ----------------------------------------------- */

  /**
   * Book a slot for the signed-in user.
   * @returns {{ok:true,booking:object}|{ok:false,reason:string,message:string}}
   */
  function book(slotId) {
    const user = window.Auth.currentUser();
    if (!user) return err('auth', 'Please log in to book a class.');

    const slot = getSlot(slotId);
    if (!slot) return err('missing', 'That class is no longer on the timetable.');
    if (slot.isPast) return err('past', 'That class has already started.');
    if (slot.bookedByMe) return err('duplicate', 'You are already booked into this class.');
    if (slot.isFull) return err('full', 'This class is fully booked. Try another time.');
    if (window.Auth.creditBalance() < 1) {
      return err('credits', 'You have no class credits left. Buy a pack to keep booking.');
    }

    const booking = {
      id: bookingId(),
      userId: user.id,
      slotId: slot.id,
      dateKey: slot.dateKey,
      time: slot.time,
      typeId: slot.typeId,
      instructorId: slot.instructorId,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    const list = allBookings();
    list.push(booking);
    if (!saveBookings(list)) return err('storage', 'Your browser blocked local storage, so the booking was not saved.');

    window.Auth.spendCredit();
    window.dispatchEvent(new CustomEvent('plie:bookings'));
    return { ok: true, booking: booking, slot: slot };
  }

  /**
   * Cancel a booking. The spot is always released. The credit comes back only
   * inside the free-cancellation window, matching the published policy.
   */
  function cancel(id) {
    const user = window.Auth.currentUser();
    if (!user) return err('auth', 'Please log in first.');

    const list = allBookings();
    const index = list.findIndex((b) => b.id === id && b.userId === user.id);
    if (index === -1) return err('missing', 'We could not find that booking.');
    if (list[index].status === 'cancelled') return err('already', 'That booking is already cancelled.');

    const start = DateUtil.slotDateTime(list[index].dateKey, list[index].time);
    const hoursUntil = (start.getTime() - Date.now()) / 36e5;
    const refunded = hoursUntil >= FREE_CANCEL_HOURS;

    list[index].status = 'cancelled';
    list[index].cancelledAt = new Date().toISOString();
    list[index].refunded = refunded;
    saveBookings(list);

    if (refunded) window.Auth.addCredits(1);
    window.dispatchEvent(new CustomEvent('plie:bookings'));

    return { ok: true, refunded: refunded, hoursUntil: hoursUntil };
  }

  /** A user's bookings, split into upcoming and past, each newest-first. */
  function userBookings(userId) {
    const id = userId || (window.Auth.currentUser() || {}).id;
    if (!id) return { upcoming: [], past: [], cancelled: [] };

    const now = Date.now();
    const decorated = allBookings()
      .filter((b) => b.userId === id)
      .map((b) => {
        const type = window.STUDIO.classType(b.typeId);
        const instructor = window.STUDIO.instructor(b.instructorId);
        const start = DateUtil.slotDateTime(b.dateKey, b.time);
        return Object.assign({}, b, {
          type: type,
          instructor: instructor,
          start: start,
          endLabel: Fmt.endTime(b.time, type ? type.duration : 50),
          isPast: start.getTime() < now
        });
      });

    return {
      upcoming: decorated
        .filter((b) => b.status === 'confirmed' && !b.isPast)
        .sort((a, b) => a.start - b.start),
      past: decorated
        .filter((b) => b.status === 'confirmed' && b.isPast)
        .sort((a, b) => b.start - a.start),
      cancelled: decorated
        .filter((b) => b.status === 'cancelled')
        .sort((a, b) => b.start - a.start)
    };
  }

  function err(reason, message) {
    return { ok: false, reason: reason, message: message };
  }

  /* --- draft (survives the login round-trip) ------------------------------- */
  const Draft = {
    get() { return Store.get(KEY_DRAFT, null); },
    set(d) { Store.set(KEY_DRAFT, d); },
    clear() { Store.remove(KEY_DRAFT); }
  };

  window.Booking = {
    slotsForDate, upcomingDates, getSlot, makeSlotId, parseSlotId,
    book, cancel, userBookings, allBookings,
    Draft,
    HORIZON_DAYS, FREE_CANCEL_HOURS
  };

  /* =========================================================================
     Shared slot markup
     ========================================================================= */
  function slotRow(slot, options) {
    const opts = options || {};
    const spotClass = slot.isFull ? 'none' : (slot.spotsLeft <= 2 ? 'low' : '');
    const meterClass = slot.isFull ? 'full' : (slot.spotsLeft <= 2 ? 'low' : '');
    const pct = Math.round((slot.taken / slot.capacity) * 100);

    let action;
    if (slot.bookedByMe) {
      action = '<a class="btn btn-secondary btn-sm" href="account.html">Booked &check;</a>';
    } else if (slot.isPast) {
      action = '<button class="btn btn-sm" type="button" disabled>Started</button>';
    } else if (slot.isFull) {
      action = '<button class="btn btn-sm" type="button" disabled>Class full</button>';
    } else {
      action = '<a class="btn btn-sm" href="booking.html?slot=' + encodeURIComponent(slot.id) + '">Book</a>';
    }

    return '<article class="slot' + (slot.isFull ? ' is-full' : '') +
      (slot.bookedByMe ? ' is-booked' : '') + '">' +
      '<div class="slot-time">' + esc(Fmt.time12(slot.time)) +
        '<small>' + esc(slot.type.duration) + ' min</small></div>' +
      '<div class="slot-main">' +
        '<div class="slot-name">' + esc(slot.type.name) + ' ' + Render.typeBadge(slot.typeId) + '</div>' +
        '<div class="slot-meta">with ' + esc(slot.instructor.name) +
          ' &middot; until ' + esc(slot.endLabel) +
          (opts.showDate ? ' &middot; ' + esc(Fmt.dateShort(slot.dateKey)) : '') + '</div>' +
      '</div>' +
      '<div class="slot-spots">' +
        (slot.isFull
          ? '<span class="n none">Full</span>'
          : '<span class="n ' + spotClass + '">' + slot.spotsLeft + '</span> of ' + slot.capacity + ' left') +
        '<div class="meter ' + meterClass + '" role="img" aria-label="' +
          esc(slot.taken + ' of ' + slot.capacity + ' places taken') + '">' +
          '<span style="width:' + pct + '%"></span></div>' +
      '</div>' +
      '<div class="slot-action">' + action + '</div>' +
      '</article>';
  }

  /* =========================================================================
     2. SCHEDULE PAGE
     ========================================================================= */
  function initSchedulePage() {
    const root = $('#schedule-root');
    if (!root) return;

    const fType = $('#filter-type');
    const fInstructor = $('#filter-instructor');
    const fDay = $('#filter-day');
    const reset = $('#filter-reset');
    const count = $('#filter-count');

    // Populate the filter dropdowns from data.js
    fType.innerHTML = '<option value="">All class types</option>' +
      window.STUDIO.classTypes.map((t) => '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>').join('');

    fInstructor.innerHTML = '<option value="">All instructors</option>' +
      window.STUDIO.instructors.map((i) => '<option value="' + esc(i.id) + '">' + esc(i.name) + '</option>').join('');

    const dates = upcomingDates(HORIZON_DAYS);
    fDay.innerHTML = '<option value="">Next ' + HORIZON_DAYS + ' days</option>' +
      dates.slice(0, HORIZON_DAYS).map((k, i) =>
        '<option value="' + esc(k) + '">' +
        (i === 0 ? 'Today — ' : i === 1 ? 'Tomorrow — ' : '') + esc(Fmt.dateShort(k)) +
        '</option>').join('');

    function render() {
      const type = fType.value;
      const instructor = fInstructor.value;
      const day = fDay.value;

      const keys = day ? [day] : dates;
      let total = 0;
      let html = '';

      keys.forEach((key) => {
        let slots = slotsForDate(key).filter((s) => !s.isPast);
        if (type) slots = slots.filter((s) => s.typeId === type);
        if (instructor) slots = slots.filter((s) => s.instructorId === instructor);
        if (!slots.length) return;

        total += slots.length;
        const d = DateUtil.toDate(key);
        const isToday = key === DateUtil.dateKey(DateUtil.today());

        html += '<section class="day-group">' +
          '<div class="day-heading">' +
            '<h3>' + esc(Fmt.dayName(d.getDay())) + '</h3>' +
            '<span class="date">' + esc(d.getDate() + ' ' + Fmt.monthShort(d.getMonth())) + '</span>' +
            (isToday ? '<span class="today-pill">Today</span>' : '') +
          '</div>' +
          '<div class="slot-list">' + slots.map((s) => slotRow(s)).join('') + '</div>' +
          '</section>';
      });

      if (!total) {
        html = '<div class="empty-state">' +
          '<span class="empty-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></span>' +
          '<h3>No classes match those filters</h3>' +
          '<p>Try widening your search — clear a filter or pick a different day.</p>' +
          '<button class="btn btn-secondary btn-sm" type="button" id="empty-reset">Clear filters</button>' +
          '</div>';
      }

      root.innerHTML = html;
      count.textContent = total
        ? total + (total === 1 ? ' class' : ' classes') + ' found'
        : '';

      const emptyReset = $('#empty-reset');
      if (emptyReset) emptyReset.addEventListener('click', clearFilters);
    }

    function clearFilters() {
      fType.value = '';
      fInstructor.value = '';
      fDay.value = '';
      render();
    }

    [fType, fInstructor, fDay].forEach((f) => f.addEventListener('change', render));
    reset.addEventListener('click', clearFilters);

    // Deep link: schedule.html?type=reformer
    const params = new URLSearchParams(window.location.search);
    if (params.get('type')) fType.value = params.get('type');
    if (params.get('instructor')) fInstructor.value = params.get('instructor');

    render();
    window.addEventListener('plie:auth', render);
    window.addEventListener('plie:bookings', render);
  }

  /* =========================================================================
     3. BOOKING WIZARD
     ========================================================================= */
  function initBookingWizard() {
    const wizard = $('#booking-wizard');
    if (!wizard) return;

    const TOTAL_STEPS = 4;
    const state = { step: 1, typeId: null, dateKey: null, slotId: null };

    const panels = {
      1: $('#step-1'), 2: $('#step-2'), 3: $('#step-3'), 4: $('#step-4')
    };
    const confirmPanel = $('#step-done');
    const stepper = $('#stepper');
    const btnBack = $('#wizard-back');
    const btnNext = $('#wizard-next');
    const actions = $('#wizard-actions');

    /* --- restore anything in progress ------------------------------------- */
    const draft = Draft.get();
    if (draft) {
      state.typeId = draft.typeId || null;
      state.dateKey = draft.dateKey || null;
      state.slotId = draft.slotId || null;
      state.step = Math.min(draft.step || 1, TOTAL_STEPS);
    }

    /* --- deep links from schedule.html / classes.html ---------------------- */
    const params = new URLSearchParams(window.location.search);
    if (params.get('slot')) {
      const slot = getSlot(params.get('slot'));
      if (slot && !slot.isPast) {
        state.typeId = slot.typeId;
        state.dateKey = slot.dateKey;
        state.slotId = slot.id;
        state.step = 4;
      }
    } else if (params.get('type')) {
      const t = window.STUDIO.classType(params.get('type'));
      if (t) { state.typeId = t.id; state.step = 2; }
    }

    // A slot chosen before logging in may have filled up in the meantime
    if (state.slotId) {
      const slot = getSlot(state.slotId);
      if (!slot || slot.isPast || (slot.isFull && !slot.bookedByMe)) {
        state.slotId = null;
        if (state.step > 3) state.step = 3;
      }
    }
    if (!state.typeId && state.step > 1) state.step = 1;
    if (!state.dateKey && state.step > 2) state.step = 2;

    function persist() {
      Draft.set({ step: state.step, typeId: state.typeId, dateKey: state.dateKey, slotId: state.slotId });
    }

    /* --- step 1: class type ------------------------------------------------ */
    function renderTypes() {
      panels[1].querySelector('[data-choices]').innerHTML = window.STUDIO.classTypes.map((t) =>
        '<button class="choice' + (state.typeId === t.id ? ' is-selected' : '') + '" type="button" ' +
          'data-type="' + esc(t.id) + '" aria-pressed="' + (state.typeId === t.id) + '">' +
          '<h3>' + esc(t.name) + '</h3>' +
          '<p class="muted">' + esc(t.tagline) + '</p>' +
          '<div class="cluster mt-4">' +
            '<span class="badge">' + esc(t.duration) + ' min</span>' +
            '<span class="badge">Max ' + t.capacity + ' people</span>' +
            '<span class="badge">1 credit</span>' +
          '</div>' +
        '</button>'
      ).join('');
    }

    /* --- step 2: date ------------------------------------------------------ */
    function renderDates() {
      const dates = upcomingDates(HORIZON_DAYS);
      panels[2].querySelector('[data-dates]').innerHTML = dates.map((key, i) => {
        const d = DateUtil.toDate(key);
        // Only offer days that still have a class of the chosen type left today
        const available = slotsForDate(key)
          .filter((s) => s.typeId === state.typeId && !s.isPast).length;
        return '<button class="date-chip' + (state.dateKey === key ? ' is-selected' : '') + '" ' +
          'type="button" data-date="' + esc(key) + '"' + (available ? '' : ' disabled') +
          ' aria-pressed="' + (state.dateKey === key) + '"' +
          ' aria-label="' + esc(Fmt.dateLong(key) + (available ? ', ' + available + ' classes' : ', no classes')) + '">' +
          '<span class="dow">' + esc(i === 0 ? 'Today' : Fmt.dayShort(d.getDay())) + '</span>' +
          '<span class="dnum">' + d.getDate() + '</span>' +
          '<span class="mon">' + esc(Fmt.monthShort(d.getMonth())) + '</span>' +
          '</button>';
      }).join('');

      const label = panels[2].querySelector('[data-chosen-type]');
      const type = window.STUDIO.classType(state.typeId);
      if (label && type) label.textContent = type.name;
    }

    /* --- step 3: time slot ------------------------------------------------- */
    function renderSlots() {
      const host = panels[3].querySelector('[data-slots]');
      if (!state.dateKey || !state.typeId) { host.innerHTML = ''; return; }

      const slots = slotsForDate(state.dateKey)
        .filter((s) => s.typeId === state.typeId && !s.isPast);

      const heading = panels[3].querySelector('[data-chosen-date]');
      if (heading) heading.textContent = Fmt.dateLong(state.dateKey);

      if (!slots.length) {
        host.innerHTML = '<div class="empty-state">' +
          '<span class="empty-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>' +
          '<h3>No classes left on this date</h3>' +
          '<p>Every ' + esc((window.STUDIO.classType(state.typeId) || {}).short || '') +
          ' class today has already started. Go back and pick another day.</p></div>';
        return;
      }

      host.innerHTML = slots.map((s) => {
        const disabled = s.isFull || s.bookedByMe;
        const note = s.bookedByMe ? 'Already booked' : (s.isFull ? 'Class full' : s.spotsLeft + ' of ' + s.capacity + ' spots left');
        return '<button class="choice' + (state.slotId === s.id ? ' is-selected' : '') + '" type="button" ' +
          'data-slot="' + esc(s.id) + '"' + (disabled ? ' disabled' : '') +
          ' aria-pressed="' + (state.slotId === s.id) + '">' +
          '<div class="cluster" style="justify-content:space-between;align-items:flex-start">' +
            '<div>' +
              '<h3 style="margin-bottom:.25rem">' + esc(Fmt.time12(s.time)) + '</h3>' +
              '<p class="muted" style="margin:0">with ' + esc(s.instructor.name) +
              ' &middot; until ' + esc(s.endLabel) + '</p>' +
            '</div>' +
            '<span class="badge' + (s.isFull ? ' badge-danger' : (s.spotsLeft <= 2 ? ' badge-warning' : '')) + '">' +
              esc(note) + '</span>' +
          '</div>' +
        '</button>';
      }).join('');
    }

    /* --- step 4: review ---------------------------------------------------- */
    function renderReview() {
      const slot = state.slotId ? getSlot(state.slotId) : null;
      const host = panels[4].querySelector('[data-review]');
      const gate = panels[4].querySelector('[data-login-gate]');
      const user = window.Auth.currentUser();

      if (!slot) { host.innerHTML = ''; return; }

      host.innerHTML =
        '<dl class="summary">' +
          row('Class', slot.type.name) +
          row('Instructor', slot.instructor.name) +
          row('Date', Fmt.dateLong(slot.dateKey)) +
          row('Time', Fmt.time12(slot.time) + ' – ' + slot.endLabel + ' (' + slot.type.duration + ' min)') +
          row('Spots left', slot.spotsLeft + ' of ' + slot.capacity) +
          row('Studio', window.STUDIO.studio.address.line1) +
          '<div class="summary-row total"><dt>Cost</dt><dd>1 class credit</dd></div>' +
        '</dl>';

      // Login gate + credit warning
      if (!user) {
        gate.classList.remove('hidden');
        gate.innerHTML =
          '<div class="alert alert-info">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>' +
          '<div><strong>Almost there — you need an account.</strong><br>' +
          'Log in or sign up and we’ll bring you straight back to this booking.</div></div>' +
          '<a class="btn btn-block" href="#" data-goto-login>Log in to confirm</a>' +
          '<p class="hint text-center mt-4">No account yet? ' +
          '<a href="login.html#signup" data-goto-signup>Create one in a few seconds</a> — ' +
          'new members get ' + window.Auth.WELCOME_CREDITS + ' free class credits.</p>';
      } else if (window.Auth.creditBalance() < 1) {
        gate.classList.remove('hidden');
        gate.innerHTML =
          '<div class="alert alert-warning">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>' +
          '<div><strong>You have no class credits left.</strong><br>' +
          'Pick up a drop-in or a class pack and this booking will be one tap away.</div></div>' +
          '<a class="btn btn-block" href="pricing.html">View pricing</a>';
      } else {
        gate.classList.add('hidden');
        gate.innerHTML = '';
      }
    }

    function row(k, v) {
      return '<div class="summary-row"><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>';
    }

    /* --- chrome ------------------------------------------------------------ */
    function renderStepper() {
      $$('.step', stepper).forEach((node, i) => {
        const n = i + 1;
        node.classList.toggle('is-active', n === state.step);
        node.classList.toggle('is-done', n < state.step);
        node.setAttribute('aria-current', n === state.step ? 'step' : 'false');
      });
    }

    function canAdvance() {
      if (state.step === 1) return !!state.typeId;
      if (state.step === 2) return !!state.dateKey;
      if (state.step === 3) return !!state.slotId;
      return true;
    }

    function render() {
      Object.keys(panels).forEach((n) => {
        panels[n].classList.toggle('is-active', Number(n) === state.step);
      });
      confirmPanel.classList.remove('is-active');
      actions.classList.remove('hidden');

      if (state.step === 1) renderTypes();
      if (state.step === 2) renderDates();
      if (state.step === 3) renderSlots();
      if (state.step === 4) renderReview();

      renderStepper();

      btnBack.disabled = state.step === 1;
      btnBack.classList.toggle('hidden', state.step === 1);

      const user = window.Auth.currentUser();
      if (state.step === TOTAL_STEPS) {
        const blocked = !user || window.Auth.creditBalance() < 1;
        btnNext.textContent = 'Confirm booking';
        btnNext.classList.toggle('hidden', blocked);
        btnNext.disabled = blocked;
      } else {
        btnNext.textContent = 'Continue';
        btnNext.classList.remove('hidden');
        btnNext.disabled = !canAdvance();
      }

      persist();
    }

    function goTo(step) {
      state.step = Math.max(1, Math.min(TOTAL_STEPS, step));
      render();
      wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* --- interactions ------------------------------------------------------ */
    panels[1].addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (!btn) return;
      if (state.typeId !== btn.dataset.type) {
        state.typeId = btn.dataset.type;
        state.slotId = null;          // a slot from the other class type is invalid now
      }
      renderTypes();
      render();
      goTo(2);
    });

    panels[2].addEventListener('click', (e) => {
      const btn = e.target.closest('[data-date]');
      if (!btn || btn.disabled) return;
      if (state.dateKey !== btn.dataset.date) {
        state.dateKey = btn.dataset.date;
        state.slotId = null;
      }
      renderDates();
      goTo(3);
    });

    panels[3].addEventListener('click', (e) => {
      const btn = e.target.closest('[data-slot]');
      if (!btn || btn.disabled) return;
      state.slotId = btn.dataset.slot;
      renderSlots();
      goTo(4);
    });

    panels[4].addEventListener('click', (e) => {
      const login = e.target.closest('[data-goto-login]');
      const signup = e.target.closest('[data-goto-signup]');
      if (!login && !signup) return;
      e.preventDefault();
      persist();
      window.Auth.setReturnTo('booking.html');
      window.location.href = signup ? 'login.html#signup' : 'login.html';
    });

    btnBack.addEventListener('click', () => goTo(state.step - 1));

    btnNext.addEventListener('click', () => {
      if (state.step < TOTAL_STEPS) {
        if (!canAdvance()) return;
        goTo(state.step + 1);
        return;
      }
      confirmBooking();
    });

    /* --- confirm ----------------------------------------------------------- */
    function confirmBooking() {
      if (!window.Auth.isLoggedIn()) {
        persist();
        window.Auth.setReturnTo('booking.html');
        window.location.href = 'login.html';
        return;
      }

      btnNext.disabled = true;
      const result = book(state.slotId);

      if (!result.ok) {
        btnNext.disabled = false;
        toast('Booking failed', result.message, 'error', 7000);
        if (result.reason === 'full' || result.reason === 'past' || result.reason === 'duplicate') {
          state.slotId = null;
          goTo(3);
        }
        return;
      }

      Draft.clear();
      showConfirmation(result.slot);
      toast('You’re booked in', result.slot.type.name + ' on ' + Fmt.dateShort(result.slot.dateKey) +
        ' at ' + Fmt.time12(result.slot.time), 'success', 6000);
    }

    function showConfirmation(slot) {
      Object.keys(panels).forEach((n) => panels[n].classList.remove('is-active'));
      actions.classList.add('hidden');
      $$('.step', stepper).forEach((node) => {
        node.classList.remove('is-active');
        node.classList.add('is-done');
      });

      $('#confirm-summary').innerHTML =
        '<dl class="summary">' +
          row('Class', slot.type.name) +
          row('Instructor', slot.instructor.name) +
          row('Date', Fmt.dateLong(slot.dateKey)) +
          row('Time', Fmt.time12(slot.time) + ' – ' + slot.endLabel) +
          row('Where', window.STUDIO.studio.address.line1 + ', ' + window.STUDIO.studio.address.line2) +
          '<div class="summary-row total"><dt>Credits remaining</dt><dd>' +
            window.Auth.creditBalance() + '</dd></div>' +
        '</dl>';

      confirmPanel.classList.add('is-active');
      confirmPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const focusTarget = $('#confirm-heading');
      if (focusTarget) focusTarget.focus();
    }

    const bookAnother = $('#book-another');
    if (bookAnother) {
      bookAnother.addEventListener('click', () => {
        state.step = 1;
        state.typeId = null;
        state.dateKey = null;
        state.slotId = null;
        Draft.clear();
        confirmPanel.classList.remove('is-active');
        render();
        wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    window.addEventListener('plie:auth', () => { if (state.step === TOTAL_STEPS) render(); });

    render();

    // Coming back from login with a booking mid-flight
    if (draft && window.Auth.isLoggedIn() && state.step === TOTAL_STEPS && state.slotId) {
      toast('Welcome back', 'Your booking is ready to confirm.', 'info');
    }
  }

  /* =========================================================================
     4. ACCOUNT PAGE
     ========================================================================= */
  function initAccountPage() {
    const root = $('#account-root');
    if (!root) return;

    const user = window.Auth.requireAuth();
    if (!user) return;                      // requireAuth is redirecting

    root.classList.remove('hidden');

    const upcomingHost = $('#bookings-upcoming');
    const pastHost = $('#bookings-past');
    const cancelledHost = $('#bookings-cancelled');

    function bookingItem(b, kind) {
      const d = b.start;
      const canCancel = kind === 'upcoming';
      const hoursUntil = (d.getTime() - Date.now()) / 36e5;
      const freeCancel = hoursUntil >= FREE_CANCEL_HOURS;

      let right = '';
      if (canCancel) {
        right = '<div class="booking-actions">' +
          '<button class="btn btn-danger btn-sm" type="button" data-cancel="' + esc(b.id) + '">Cancel</button>' +
          '</div>';
      } else if (kind === 'cancelled') {
        right = '<div class="booking-actions"><span class="badge badge-danger">Cancelled</span></div>';
      } else {
        right = '<div class="booking-actions"><span class="badge badge-success">Attended</span></div>';
      }

      return '<article class="booking-item' + (kind !== 'upcoming' ? ' is-past' : '') + '">' +
        '<div class="booking-date"><span class="d">' + d.getDate() + '</span>' +
          '<span class="m">' + esc(Fmt.monthShort(d.getMonth())) + '</span></div>' +
        '<div class="booking-info">' +
          '<div class="t">' + esc(b.type ? b.type.name : 'Class') + ' ' + Render.typeBadge(b.typeId) + '</div>' +
          '<div class="s">' + esc(Fmt.dayName(d.getDay())) + ' &middot; ' +
            esc(Fmt.time12(b.time)) + '–' + esc(b.endLabel) +
            ' &middot; with ' + esc(b.instructor ? b.instructor.name : 'our team') + '</div>' +
          (canCancel && !freeCancel
            ? '<div class="s" style="color:var(--warning);margin-top:4px">Inside the ' +
              FREE_CANCEL_HOURS + '-hour window — cancelling will not refund your credit.</div>'
            : '') +
        '</div>' + right +
        '</article>';
    }

    function emptyState(icon, title, text, cta) {
      return '<div class="empty-state">' +
        '<span class="empty-mark">' + icon + '</span>' +
        '<h3>' + esc(title) + '</h3>' +
        '<p>' + esc(text) + '</p>' +
        (cta || '') + '</div>';
    }

    const ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
    const ICON_HIST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

    function render() {
      const me = window.Auth.currentUser();
      if (!me) return;
      const data = userBookings(me.id);

      upcomingHost.innerHTML = data.upcoming.length
        ? data.upcoming.map((b) => bookingItem(b, 'upcoming')).join('')
        : emptyState(ICON_CAL, 'No bookings yet',
            'You have nothing on the calendar. Browse the timetable and find a class that fits.',
            '<a class="btn btn-sm" href="schedule.html">Browse classes</a>');

      pastHost.innerHTML = data.past.length
        ? data.past.map((b) => bookingItem(b, 'past')).join('')
        : emptyState(ICON_HIST, 'Nothing here yet',
            'Once you have been to a class it will show up here.');

      cancelledHost.innerHTML = data.cancelled.length
        ? data.cancelled.map((b) => bookingItem(b, 'cancelled')).join('')
        : emptyState(ICON_HIST, 'No cancellations',
            'Any class you cancel will be listed here.');

      $$('[data-stat-upcoming]').forEach((n) => { n.textContent = data.upcoming.length; });
      $$('[data-stat-attended]').forEach((n) => { n.textContent = data.past.length; });
      $$('[data-credit-count]').forEach((n) => { n.textContent = me.credits || 0; });

      // Tab counts
      const cu = $('[data-count-upcoming]');
      const cp = $('[data-count-past]');
      const cc = $('[data-count-cancelled]');
      if (cu) cu.textContent = data.upcoming.length ? ' (' + data.upcoming.length + ')' : '';
      if (cp) cp.textContent = data.past.length ? ' (' + data.past.length + ')' : '';
      if (cc) cc.textContent = data.cancelled.length ? ' (' + data.cancelled.length + ')' : '';
    }

    /* --- cancel ------------------------------------------------------------ */
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cancel]');
      if (!btn) return;

      const id = btn.dataset.cancel;
      const booking = allBookings().find((b) => b.id === id);
      if (!booking) return;

      const start = DateUtil.slotDateTime(booking.dateKey, booking.time);
      const free = (start.getTime() - Date.now()) / 36e5 >= FREE_CANCEL_HOURS;

      const message = free
        ? 'Cancel this class? Your credit will be returned straight away.'
        : 'This class starts in under ' + FREE_CANCEL_HOURS + ' hours, so the credit will not ' +
          'be refunded. Cancel anyway?';

      // eslint-disable-next-line no-alert -- a destructive action deserves a confirm step
      if (!window.confirm(message)) return;

      const result = cancel(id);
      if (!result.ok) { toast('Could not cancel', result.message, 'error'); return; }

      render();
      toast(
        'Booking cancelled',
        result.refunded ? 'Your class credit has been returned.'
                        : 'Inside the ' + FREE_CANCEL_HOURS + '-hour window, so the credit was not refunded.',
        result.refunded ? 'success' : 'info',
        6000
      );
    });

    /* --- panel tabs -------------------------------------------------------- */
    const tabs = $$('.panel-tab', root);
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => {
          const selected = t === tab;
          t.setAttribute('aria-selected', String(selected));
          const panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.classList.toggle('hidden', !selected);
        });
      });
    });

    /* --- profile form ------------------------------------------------------ */
    const profileForm = $('#profile-form');
    if (profileForm) {
      const nameInput = $('#profile-name');
      const emailInput = $('#profile-email');
      const phoneInput = $('#profile-phone');

      function fillProfile() {
        const me = window.Auth.currentUser();
        if (!me) return;
        nameInput.value = me.name;
        emailInput.value = me.email;
        phoneInput.value = me.phone || '';
      }
      fillProfile();
      Validate.liveClear(profileForm);

      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        Validate.clearAll(profileForm);

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        let valid = true;
        if (name.length < 2) valid = Validate.fail(nameInput, 'Please enter your full name.');
        if (!Validate.isEmail(email)) valid = Validate.fail(emailInput, 'Please enter a valid email address.');
        if (!valid) { Validate.focusFirstError(profileForm); return; }

        const result = window.Auth.updateUser({ name: name, email: email, phone: phoneInput.value.trim() });
        if (!result.ok) {
          const field = result.field === 'email' ? emailInput : nameInput;
          Validate.fail(field, result.message);
          Validate.focusFirstError(profileForm);
          return;
        }

        toast('Profile updated', 'Your details have been saved.', 'success');
        render();
      });

      const resetBtn = $('#profile-reset');
      if (resetBtn) resetBtn.addEventListener('click', () => {
        Validate.clearAll(profileForm);
        fillProfile();
      });
    }

    render();
    window.addEventListener('plie:bookings', render);
    window.addEventListener('plie:auth', render);
  }

  /* =========================================================================
     5. PRICING PAGE — demo "purchase" adds credits
     ========================================================================= */
  function initPricingPage() {
    const root = $('#pricing-root');
    if (!root) return;

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-buy]');
      if (!btn) return;

      const plan = window.STUDIO.plan(btn.dataset.buy);
      if (!plan) return;

      if (!window.Auth.isLoggedIn()) {
        window.Auth.setReturnTo('pricing.html');
        toast('Log in first', 'Create an account or log in to add credits.', 'info');
        setTimeout(() => { window.location.href = 'login.html'; }, 900);
        return;
      }

      // DEMO ONLY: no payment is taken. A real site would hand off to a
      // payment provider here and only credit the account on a webhook.
      window.Auth.addCredits(plan.credits);
      toast(
        plan.name + ' added',
        plan.credits + ' class credits are now on your account. (Demo — no payment was taken.)',
        'success',
        6500
      );
    });
  }

  /* =========================================================================
     Boot
     ========================================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    initSchedulePage();
    initBookingWizard();
    initAccountPage();
    initPricingPage();
  });
})();

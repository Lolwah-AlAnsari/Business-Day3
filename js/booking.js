/* ===========================================================================
   Plié Pilates — booking.js
   ---------------------------------------------------------------------------
   Backed by Supabase. Capacity, double-booking and credit rules are enforced
   in the database by book_class() and cancel_booking(), not here — this file
   cannot be trusted and does not need to be.

   Shape of the thing: the whole booking window (about 110 classes) is fetched
   once at boot into a cache, so every render stays synchronous, exactly as it
   was before. Network round trips happen at startup and after a booking or
   cancellation, never while drawing a list.
   =========================================================================== */

(function () {
  'use strict';

  const { Fmt, DateUtil, Validate, Render, toast, $, $$, esc } = window.UI;

  const KEY_DRAFT = 'plie:draftBooking';

  let availability = [];   // every upcoming class in the booking window
  let myBookingIds = {};   // class_instance_id -> true, for the current member
  let horizonDays = 21;
  let freeCancelHours = 12;

  function sb() { return window.PLIE.client; }

  /* =========================================================================
     Loading
     ========================================================================= */
  async function refresh() {
    const settings = window.STUDIO.studio;
    horizonDays = settings.bookingHorizonDays || 21;
    freeCancelHours = settings.freeCancelHours || 12;

    const from = DateUtil.dateKey(DateUtil.today());
    const to = DateUtil.dateKey(DateUtil.addDays(DateUtil.today(), horizonDays));

    const { data, error } = await sb()
      .from('class_availability')
      .select('*')
      .eq('status', 'scheduled')
      .gte('class_date', from)
      .lte('class_date', to)
      .order('class_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('[Plié] Could not load the timetable:', error.message);
      availability = [];
    } else {
      availability = data || [];
    }

    await refreshMyBookings();
    window.dispatchEvent(new CustomEvent('plie:bookings'));
  }

  async function refreshMyBookings() {
    myBookingIds = {};
    const user = window.Auth.currentUser();
    if (!user) return;

    const { data, error } = await sb()
      .from('bookings')
      .select('class_instance_id')
      .eq('user_id', user.id)
      .in('status', ['confirmed', 'attended']);

    if (error) { console.warn('[Plié] Could not load your bookings:', error.message); return; }
    (data || []).forEach((b) => { myBookingIds[b.class_instance_id] = true; });
  }

  /* =========================================================================
     Slots — decorated from the cache, synchronously
     ========================================================================= */
  function decorate(row) {
    const type = window.STUDIO.classType(row.class_type_id);
    const instructor = window.STUDIO.instructor(row.instructor_id);
    const time = String(row.start_time).slice(0, 5);
    const start = new Date(row.starts_at);

    return {
      id: row.class_instance_id,
      dateKey: row.class_date,
      date: DateUtil.toDate(row.class_date),
      start: start,
      time: time,
      endLabel: Fmt.endTime(time, row.duration_min),
      typeId: row.class_type_id,
      type: type || { id: row.class_type_id, name: row.class_name, short: row.class_short_name,
                      duration: row.duration_min, capacity: row.capacity },
      instructorId: row.instructor_id,
      instructor: instructor || { id: row.instructor_id, name: row.instructor_name },
      capacity: row.capacity,
      taken: row.booked_count,
      spotsLeft: row.spots_left,
      isFull: row.is_full,
      isPast: start.getTime() <= Date.now(),
      bookedByMe: !!myBookingIds[row.class_instance_id]
    };
  }

  function slotsForDate(dateKey) {
    return availability.filter((r) => r.class_date === dateKey).map(decorate);
  }

  function getSlot(id) {
    const row = availability.find((r) => r.class_instance_id === id);
    return row ? decorate(row) : null;
  }

  function upcomingDates(days) {
    const out = [];
    const start = DateUtil.today();
    for (let i = 0; i < (days || horizonDays); i++) {
      out.push(DateUtil.dateKey(DateUtil.addDays(start, i)));
    }
    return out;
  }

  /* =========================================================================
     Booking and cancelling — thin wrappers over the database functions
     ========================================================================= */
  async function book(classInstanceId) {
    if (!window.Auth.isLoggedIn()) return err('auth', 'Please log in to book a class.');

    const { data, error } = await sb().rpc('book_class', { p_class_instance_id: classInstanceId });

    if (error) return err(reasonFor(error), cleanMessage(error));

    await Promise.all([refresh(), window.Auth.refreshCredits()]);
    return { ok: true, booking: data, slot: getSlot(classInstanceId) };
  }

  async function cancel(bookingId) {
    if (!window.Auth.isLoggedIn()) return err('auth', 'Please log in first.');

    const { data, error } = await sb().rpc('cancel_booking', { p_booking_id: bookingId });

    if (error) return err(reasonFor(error), cleanMessage(error));

    await Promise.all([refresh(), window.Auth.refreshCredits()]);
    return { ok: true, refunded: !!(data && data.refunded), hoursUntil: data && data.hours_before };
  }

  async function purchase(planId) {
    if (!window.Auth.isLoggedIn()) return err('auth', 'Please log in first.');
    const { data, error } = await sb().rpc('purchase_plan', { p_plan_id: planId });
    if (error) return err('purchase', cleanMessage(error));
    await window.Auth.refreshCredits();
    return { ok: true, order: data };
  }

  /** Everything the account page needs, in one query. */
  async function userBookings() {
    const user = window.Auth.currentUser();
    if (!user) return { upcoming: [], past: [], cancelled: [] };

    const { data, error } = await sb()
      .from('bookings')
      .select('id, status, booked_at, cancelled_at, credit_refunded, class_instance_id, ' +
              'class_instances(class_date, start_time, starts_at, class_type_id, instructor_id)')
      .eq('user_id', user.id);

    if (error) {
      console.error('[Plié] Could not load your bookings:', error.message);
      return { upcoming: [], past: [], cancelled: [] };
    }

    const now = Date.now();
    const rows = (data || []).filter((b) => b.class_instances).map((b) => {
      const ci = b.class_instances;
      const type = window.STUDIO.classType(ci.class_type_id);
      const time = String(ci.start_time).slice(0, 5);
      const start = new Date(ci.starts_at);
      return {
        id: b.id,
        status: b.status,
        dateKey: ci.class_date,
        time: time,
        typeId: ci.class_type_id,
        type: type,
        instructor: window.STUDIO.instructor(ci.instructor_id),
        start: start,
        endLabel: Fmt.endTime(time, type ? type.duration : 50),
        isPast: start.getTime() < now,
        refunded: b.credit_refunded
      };
    });

    return {
      upcoming: rows.filter((b) => b.status === 'confirmed' && !b.isPast).sort((a, b) => a.start - b.start),
      past: rows.filter((b) => (b.status === 'confirmed' || b.status === 'attended') && b.isPast)
                .sort((a, b) => b.start - a.start),
      cancelled: rows.filter((b) => b.status === 'cancelled').sort((a, b) => b.start - a.start)
    };
  }

  function err(reason, message) { return { ok: false, reason: reason, message: message }; }

  /** Map a Postgres error back to the reasons the wizard branches on. */
  function reasonFor(error) {
    const m = (error.message || '').toLowerCase();
    if (m.indexOf('fully booked') !== -1) return 'full';
    if (m.indexOf('already booked') !== -1) return 'duplicate';
    if (m.indexOf('already started') !== -1) return 'past';
    if (m.indexOf('no class credits') !== -1) return 'credits';
    if (m.indexOf('signed in') !== -1) return 'auth';
    if (m.indexOf('no longer on the timetable') !== -1) return 'missing';
    return 'error';
  }

  function cleanMessage(error) {
    const raw = error.message || 'Something went wrong.';
    // Postgres prefixes RAISE messages when they surface through PostgREST
    return raw.replace(/^.*?:\s*/, '').trim() || raw;
  }

  /* --- draft, so a login round-trip doesn't lose the in-progress booking --- */
  const Draft = {
    get() {
      try { return JSON.parse(sessionStorage.getItem(KEY_DRAFT) || 'null'); } catch (e) { return null; }
    },
    set(d) {
      try { sessionStorage.setItem(KEY_DRAFT, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    clear() {
      try { sessionStorage.removeItem(KEY_DRAFT); } catch (e) { /* ignore */ }
    }
  };

  window.Booking = {
    refresh, slotsForDate, upcomingDates, getSlot,
    book, cancel, purchase, userBookings, Draft,
    get HORIZON_DAYS() { return horizonDays; },
    get FREE_CANCEL_HOURS() { return freeCancelHours; }
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
     SCHEDULE PAGE
     ========================================================================= */
  function initSchedulePage() {
    const root = $('#schedule-root');
    if (!root) return;

    const fType = $('#filter-type');
    const fInstructor = $('#filter-instructor');
    const fDay = $('#filter-day');
    const reset = $('#filter-reset');
    const count = $('#filter-count');

    fType.innerHTML = '<option value="">All class types</option>' +
      window.STUDIO.classTypes.map((t) => '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>').join('');
    fInstructor.innerHTML = '<option value="">All instructors</option>' +
      window.STUDIO.instructors.map((i) => '<option value="' + esc(i.id) + '">' + esc(i.name) + '</option>').join('');

    const dates = upcomingDates();
    fDay.innerHTML = '<option value="">Next ' + horizonDays + ' days</option>' +
      dates.map((k, i) =>
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
            '<h2>' + esc(Fmt.dayName(d.getDay())) + '</h2>' +
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
      count.textContent = total ? total + (total === 1 ? ' class' : ' classes') + ' found' : '';

      const emptyReset = $('#empty-reset');
      if (emptyReset) emptyReset.addEventListener('click', clearFilters);
    }

    function clearFilters() {
      fType.value = ''; fInstructor.value = ''; fDay.value = '';
      render();
    }

    [fType, fInstructor, fDay].forEach((f) => f.addEventListener('change', render));
    reset.addEventListener('click', clearFilters);

    const params = new URLSearchParams(window.location.search);
    if (params.get('type')) fType.value = params.get('type');
    if (params.get('instructor')) fInstructor.value = params.get('instructor');

    render();
    window.addEventListener('plie:auth', render);
    window.addEventListener('plie:bookings', render);
  }

  /* =========================================================================
     BOOKING WIZARD
     ========================================================================= */
  function initBookingWizard() {
    const wizard = $('#booking-wizard');
    if (!wizard) return;

    const TOTAL_STEPS = 4;
    const state = { step: 1, typeId: null, dateKey: null, slotId: null };

    const panels = { 1: $('#step-1'), 2: $('#step-2'), 3: $('#step-3'), 4: $('#step-4') };
    const confirmPanel = $('#step-done');
    const stepper = $('#stepper');
    const btnBack = $('#wizard-back');
    const btnNext = $('#wizard-next');
    const actions = $('#wizard-actions');

    const draft = Draft.get();
    if (draft) {
      state.typeId = draft.typeId || null;
      state.dateKey = draft.dateKey || null;
      state.slotId = draft.slotId || null;
      state.step = Math.min(draft.step || 1, TOTAL_STEPS);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('slot')) {
      const slot = getSlot(params.get('slot'));
      if (slot && !slot.isPast) {
        state.typeId = slot.typeId; state.dateKey = slot.dateKey; state.slotId = slot.id; state.step = 4;
      }
    } else if (params.get('type')) {
      const t = window.STUDIO.classType(params.get('type'));
      if (t) { state.typeId = t.id; state.step = 2; }
    }

    // A slot chosen before logging in may have filled up meanwhile
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
          '</div></button>'
      ).join('');
    }

    function renderDates() {
      const dates = upcomingDates();
      panels[2].querySelector('[data-dates]').innerHTML = dates.map((key, i) => {
        const d = DateUtil.toDate(key);
        const available = slotsForDate(key).filter((s) => s.typeId === state.typeId && !s.isPast).length;
        return '<button class="date-chip' + (state.dateKey === key ? ' is-selected' : '') + '" ' +
          'type="button" data-date="' + esc(key) + '"' + (available ? '' : ' disabled') +
          ' aria-pressed="' + (state.dateKey === key) + '"' +
          ' aria-label="' + esc(Fmt.dateLong(key) + (available ? ', ' + available + ' classes' : ', no classes')) + '">' +
          '<span class="dow">' + esc(i === 0 ? 'Today' : Fmt.dayShort(d.getDay())) + '</span>' +
          '<span class="dnum">' + d.getDate() + '</span>' +
          '<span class="mon">' + esc(Fmt.monthShort(d.getMonth())) + '</span></button>';
      }).join('');

      const label = panels[2].querySelector('[data-chosen-type]');
      const type = window.STUDIO.classType(state.typeId);
      if (label && type) label.textContent = type.name;
    }

    function renderSlots() {
      const host = panels[3].querySelector('[data-slots]');
      if (!state.dateKey || !state.typeId) { host.innerHTML = ''; return; }

      const slots = slotsForDate(state.dateKey).filter((s) => s.typeId === state.typeId && !s.isPast);
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
        const note = s.bookedByMe ? 'Already booked'
          : (s.isFull ? 'Class full' : s.spotsLeft + ' of ' + s.capacity + ' spots left');
        return '<button class="choice' + (state.slotId === s.id ? ' is-selected' : '') + '" type="button" ' +
          'data-slot="' + esc(s.id) + '"' + (disabled ? ' disabled' : '') +
          ' aria-pressed="' + (state.slotId === s.id) + '">' +
          '<div class="cluster" style="justify-content:space-between;align-items:flex-start">' +
            '<div><h3 style="margin-bottom:.25rem">' + esc(Fmt.time12(s.time)) + '</h3>' +
            '<p class="muted" style="margin:0">with ' + esc(s.instructor.name) +
            ' &middot; until ' + esc(s.endLabel) + '</p></div>' +
            '<span class="badge' + (s.isFull ? ' badge-danger' : (s.spotsLeft <= 2 ? ' badge-warning' : '')) + '">' +
              esc(note) + '</span>' +
          '</div></button>';
      }).join('');
    }

    function row(k, v) {
      return '<div class="summary-row"><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>';
    }

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
          'new members get 2 free class credits.</p>';
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
      Object.keys(panels).forEach((n) => panels[n].classList.toggle('is-active', Number(n) === state.step));
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

    panels[1].addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (!btn) return;
      if (state.typeId !== btn.dataset.type) { state.typeId = btn.dataset.type; state.slotId = null; }
      renderTypes(); render(); goTo(2);
    });

    panels[2].addEventListener('click', (e) => {
      const btn = e.target.closest('[data-date]');
      if (!btn || btn.disabled) return;
      if (state.dateKey !== btn.dataset.date) { state.dateKey = btn.dataset.date; state.slotId = null; }
      renderDates(); goTo(3);
    });

    panels[3].addEventListener('click', (e) => {
      const btn = e.target.closest('[data-slot]');
      if (!btn || btn.disabled) return;
      state.slotId = btn.dataset.slot;
      renderSlots(); goTo(4);
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

    btnNext.addEventListener('click', async () => {
      if (state.step < TOTAL_STEPS) { if (canAdvance()) goTo(state.step + 1); return; }
      await confirmBooking();
    });

    async function confirmBooking() {
      if (!window.Auth.isLoggedIn()) {
        persist();
        window.Auth.setReturnTo('booking.html');
        window.location.href = 'login.html';
        return;
      }

      const label = btnNext.textContent;
      btnNext.disabled = true;
      btnNext.textContent = 'Booking…';

      const result = await book(state.slotId);

      btnNext.textContent = label;
      if (!result.ok) {
        btnNext.disabled = false;
        toast('Booking failed', result.message, 'error', 7000);
        if (['full', 'past', 'duplicate', 'missing'].indexOf(result.reason) !== -1) {
          state.slotId = null;
          goTo(3);
        }
        return;
      }

      Draft.clear();
      showConfirmation(result.slot);
      toast('You’re booked in',
        result.slot.type.name + ' on ' + Fmt.dateShort(result.slot.dateKey) +
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
        state.step = 1; state.typeId = null; state.dateKey = null; state.slotId = null;
        Draft.clear();
        confirmPanel.classList.remove('is-active');
        render();
        wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    window.addEventListener('plie:auth', () => { if (state.step === TOTAL_STEPS) render(); });
    render();

    if (draft && window.Auth.isLoggedIn() && state.step === TOTAL_STEPS && state.slotId) {
      toast('Welcome back', 'Your booking is ready to confirm.', 'info');
    }
  }

  /* =========================================================================
     ACCOUNT PAGE
     ========================================================================= */
  function initAccountPage() {
    const root = $('#account-root');
    if (!root) return;

    const user = window.Auth.requireAuth();
    if (!user) return;

    root.classList.remove('hidden');

    const upcomingHost = $('#bookings-upcoming');
    const pastHost = $('#bookings-past');
    const cancelledHost = $('#bookings-cancelled');

    const ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
    const ICON_HIST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

    function bookingItem(b, kind) {
      const d = b.start;
      const canCancel = kind === 'upcoming';
      const hoursUntil = (d.getTime() - Date.now()) / 36e5;
      const freeCancel = hoursUntil >= freeCancelHours;

      let right;
      if (canCancel) {
        right = '<div class="booking-actions">' +
          '<button class="btn btn-danger btn-sm" type="button" data-cancel="' + esc(b.id) + '">Cancel</button></div>';
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
              freeCancelHours + '-hour window — cancelling will not refund your credit.</div>'
            : '') +
        '</div>' + right + '</article>';
    }

    function emptyState(icon, title, text, cta) {
      return '<div class="empty-state"><span class="empty-mark">' + icon + '</span>' +
        '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (cta || '') + '</div>';
    }

    async function render() {
      const me = window.Auth.currentUser();
      if (!me) return;
      const data = await userBookings();

      upcomingHost.innerHTML = data.upcoming.length
        ? data.upcoming.map((b) => bookingItem(b, 'upcoming')).join('')
        : emptyState(ICON_CAL, 'No bookings yet',
            'You have nothing on the calendar. Browse the timetable and find a class that fits.',
            '<a class="btn btn-sm" href="schedule.html">Browse classes</a>');

      pastHost.innerHTML = data.past.length
        ? data.past.map((b) => bookingItem(b, 'past')).join('')
        : emptyState(ICON_HIST, 'Nothing here yet', 'Once you have been to a class it will show up here.');

      cancelledHost.innerHTML = data.cancelled.length
        ? data.cancelled.map((b) => bookingItem(b, 'cancelled')).join('')
        : emptyState(ICON_HIST, 'No cancellations', 'Any class you cancel will be listed here.');

      $$('[data-stat-upcoming]').forEach((n) => { n.textContent = data.upcoming.length; });
      $$('[data-stat-attended]').forEach((n) => { n.textContent = data.past.length; });
      $$('[data-credit-count]').forEach((n) => { n.textContent = me.credits || 0; });

      const cu = $('[data-count-upcoming]'), cp = $('[data-count-past]'), cc = $('[data-count-cancelled]');
      if (cu) cu.textContent = data.upcoming.length ? ' (' + data.upcoming.length + ')' : '';
      if (cp) cp.textContent = data.past.length ? ' (' + data.past.length + ')' : '';
      if (cc) cc.textContent = data.cancelled.length ? ' (' + data.cancelled.length + ')' : '';
    }

    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-cancel]');
      if (!btn) return;

      const data = await userBookings();
      const booking = data.upcoming.find((b) => b.id === btn.dataset.cancel);
      if (!booking) return;

      const free = (booking.start.getTime() - Date.now()) / 36e5 >= freeCancelHours;
      const message = free
        ? 'Cancel this class? Your credit will be returned straight away.'
        : 'This class starts in under ' + freeCancelHours + ' hours, so the credit will not ' +
          'be refunded. Cancel anyway?';

      // eslint-disable-next-line no-alert -- a destructive action deserves a confirm step
      if (!window.confirm(message)) return;

      btn.disabled = true;
      btn.textContent = 'Cancelling…';
      const result = await cancel(btn.dataset.cancel);

      if (!result.ok) {
        btn.disabled = false;
        btn.textContent = 'Cancel';
        toast('Could not cancel', result.message, 'error');
        return;
      }

      await render();
      toast('Booking cancelled',
        result.refunded ? 'Your class credit has been returned.'
                        : 'Inside the ' + freeCancelHours + '-hour window, so the credit was not refunded.',
        result.refunded ? 'success' : 'info', 6000);
    });

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

      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        Validate.clearAll(profileForm);

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        let valid = true;
        if (name.length < 2) valid = Validate.fail(nameInput, 'Please enter your full name.');
        if (!Validate.isEmail(email)) valid = Validate.fail(emailInput, 'Please enter a valid email address.');
        if (!valid) { Validate.focusFirstError(profileForm); return; }

        const btn = profileForm.querySelector('button[type=submit]');
        btn.disabled = true;

        const result = await window.Auth.updateUser({
          name: name, email: email, phone: phoneInput.value.trim()
        });
        btn.disabled = false;

        if (!result.ok) {
          Validate.fail(result.field === 'email' ? emailInput : nameInput, result.message);
          Validate.focusFirstError(profileForm);
          return;
        }
        toast('Profile updated', 'Your details have been saved.', 'success');
        await render();
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
     PRICING PAGE
     ========================================================================= */
  function initPricingPage() {
    const root = $('#pricing-root');
    if (!root) return;

    root.addEventListener('click', async (e) => {
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

      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Adding…';

      const result = await purchase(plan.id);

      btn.disabled = false;
      btn.textContent = label;

      if (!result.ok) { toast('Could not add credits', result.message, 'error'); return; }

      toast(plan.name + ' added',
        plan.credits + ' class credits are now on your account. (Demo — no payment was taken.)',
        'success', 6500);
    });
  }

  window.Booking.initPages = function () {
    initSchedulePage();
    initBookingWizard();
    initAccountPage();
    initPricingPage();
  };
})();

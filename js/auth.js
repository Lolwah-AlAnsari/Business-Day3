/* ===========================================================================
   Plié Pilates — auth.js
   ---------------------------------------------------------------------------
   Real authentication, backed by Supabase Auth.

   Passwords are hashed and stored by Supabase; this file never sees, keeps or
   transmits one beyond the sign-in call. The session lives in an httpOnly-ish
   token managed by the SDK and refreshes itself.

   The profile and credit balance are cached in memory once at boot so the
   render code can stay synchronous — the network round trips happen during
   startup, not while drawing the nav bar.
   =========================================================================== */

(function () {
  'use strict';

  const { Validate, toast, $, $$, esc, Render } = window.UI;

  const MIN_PASSWORD = 8;

  /* Cached so currentUser() / creditBalance() can be called synchronously. */
  let cachedUser = null;     // { id, name, email, phone, credits, role }
  let authReady = false;

  function sb() { return window.PLIE.client; }

  /* =========================================================================
     Loading the signed-in member
     ========================================================================= */
  async function loadUser() {
    const client = sb();
    if (!client) { cachedUser = null; return null; }

    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) { cachedUser = null; return null; }

    const uid = session.user.id;

    const [profileRes, balanceRes] = await Promise.all([
      client.from('profiles').select('id, full_name, email, phone, role').eq('id', uid).maybeSingle(),
      client.from('credit_balances').select('balance').eq('user_id', uid).maybeSingle()
    ]);

    if (profileRes.error) {
      console.warn('[Plié] Could not load profile:', profileRes.error.message);
    }

    const p = profileRes.data;
    cachedUser = {
      id: uid,
      name: (p && p.full_name) || session.user.user_metadata.full_name || '',
      email: (p && p.email) || session.user.email || '',
      phone: (p && p.phone) || '',
      role: (p && p.role) || 'member',
      credits: (balanceRes.data && balanceRes.data.balance) || 0
    };
    return cachedUser;
  }

  /** Re-read just the credit balance (after a booking, cancellation or purchase). */
  async function refreshCredits() {
    if (!cachedUser) return 0;
    const { data } = await sb()
      .from('credit_balances').select('balance').eq('user_id', cachedUser.id).maybeSingle();
    cachedUser.credits = (data && data.balance) || 0;
    renderNav();
    return cachedUser.credits;
  }

  /* =========================================================================
     Public state
     ========================================================================= */
  function currentUser() { return cachedUser; }
  function isLoggedIn() { return cachedUser !== null; }
  function creditBalance() { return cachedUser ? Number(cachedUser.credits || 0) : 0; }

  function announce() {
    renderNav();
    window.dispatchEvent(new CustomEvent('plie:auth', { detail: { user: cachedUser } }));
  }

  /* =========================================================================
     Sign up / log in / log out
     ========================================================================= */

  /** @returns {{ok:true,user:object,needsConfirmation:boolean}|{ok:false,field:string,message:string}} */
  async function signUp(name, email, password) {
    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) return fail('name', 'Please tell us your name.');
    if (!Validate.isEmail(cleanEmail)) return fail('email', 'That doesn’t look like a valid email address.');
    if (!password) return fail('password', 'Please choose a password.');
    if (password.length < MIN_PASSWORD) {
      return fail('password', 'Passwords need to be at least ' + MIN_PASSWORD + ' characters.');
    }

    const { data, error } = await sb().auth.signUp({
      email: cleanEmail,
      password: password,
      options: { data: { full_name: cleanName } }
    });

    if (error) return fail(fieldForAuthError(error), friendlyAuthError(error));

    /* Email already registered.
       Supabase deliberately does NOT return an error here — that would let
       anyone probe which addresses have accounts. Instead it replies with an
       "obfuscated user response with no verification email sent", which looks
       exactly like a successful sign-up except that `identities` comes back
       empty. Without this check the visitor is told to check an inbox that
       will never receive anything, believing they made a second account. */
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        ok: false,
        field: 'email',
        existing: true,
        email: cleanEmail,
        message: 'An account with this email already exists. Log in instead, or reset your password.'
      };
    }

    // With "Confirm email" switched on, a genuinely new sign-up returns a
    // user (with one identity) but no session until they click the link.
    if (!data.session) {
      return { ok: true, user: null, needsConfirmation: true, email: cleanEmail };
    }

    await loadUser();
    announce();
    return { ok: true, user: cachedUser, needsConfirmation: false };
  }

  /** @returns {{ok:true,user:object}|{ok:false,field:string,message:string}} */
  async function logIn(email, password) {
    const cleanEmail = String(email).trim().toLowerCase();

    if (!cleanEmail) return fail('email', 'Please enter your email address.');
    if (!Validate.isEmail(cleanEmail)) return fail('email', 'That doesn’t look like a valid email address.');
    if (!password) return fail('password', 'Please enter your password.');

    const { error } = await sb().auth.signInWithPassword({ email: cleanEmail, password: password });

    if (error) {
      // Attached to the password field and deliberately vague, so the form
      // never confirms which email addresses have accounts.
      return fail('password', friendlyAuthError(error));
    }

    await loadUser();
    announce();
    return { ok: true, user: cachedUser };
  }

  async function logOut() {
    await sb().auth.signOut();
    cachedUser = null;
    announce();
  }

  /** Update the signed-in member's own profile row. */
  async function updateUser(changes) {
    if (!cachedUser) return { ok: false, message: 'You are not signed in.' };

    const patch = {};
    if (changes.name !== undefined) {
      const n = String(changes.name).trim();
      if (n.length < 2) return fail('name', 'Please enter your full name.');
      patch.full_name = n;
    }
    if (changes.email !== undefined) {
      const e = String(changes.email).trim().toLowerCase();
      if (!Validate.isEmail(e)) return fail('email', 'That doesn’t look like a valid email address.');
      patch.email = e;
    }
    if (changes.phone !== undefined) patch.phone = String(changes.phone).trim();

    const { error } = await sb().from('profiles').update(patch).eq('id', cachedUser.id);

    if (error) {
      // The unique index on lower(email) is what actually prevents duplicates
      if (error.code === '23505') return fail('email', 'Another account already uses that email.');
      return fail('email', error.message);
    }

    // Changing the login email needs Auth updating too, which sends a
    // confirmation to the new address before it takes effect.
    if (patch.email && patch.email !== cachedUser.email) {
      const { error: authErr } = await sb().auth.updateUser({ email: patch.email });
      if (authErr) return fail('email', friendlyAuthError(authErr));
    }

    await loadUser();
    announce();
    return { ok: true, user: cachedUser };
  }

  function fail(field, message) { return { ok: false, field: field, message: message }; }

  function fieldForAuthError(error) {
    const m = (error.message || '').toLowerCase();
    if (m.indexOf('email') !== -1 || m.indexOf('registered') !== -1) return 'email';
    return 'password';
  }

  function friendlyAuthError(error) {
    const m = (error.message || '').toLowerCase();
    if (m.indexOf('already registered') !== -1 || m.indexOf('already been registered') !== -1) {
      return 'An account with this email already exists. Try logging in instead.';
    }
    if (m.indexOf('invalid login') !== -1 || m.indexOf('invalid credentials') !== -1) {
      return 'Email or password is incorrect. Please try again.';
    }
    if (m.indexOf('email not confirmed') !== -1) {
      return 'Please confirm your email address first — check your inbox for the link.';
    }
    if (m.indexOf('rate limit') !== -1 || m.indexOf('too many') !== -1) {
      return 'Too many attempts just now. Please wait a moment and try again.';
    }
    if (m.indexOf('password') !== -1 && m.indexOf('short') !== -1) {
      return 'Passwords need to be at least ' + MIN_PASSWORD + ' characters.';
    }
    return error.message || 'Something went wrong. Please try again.';
  }

  /* =========================================================================
     Return-to redirects — "log in to finish booking" must come back here
     ========================================================================= */
  const KEY_RETURN = 'plie:returnTo';

  function setReturnTo(url) {
    try {
      sessionStorage.setItem(KEY_RETURN,
        url || (window.location.pathname.split('/').pop() + window.location.search));
    } catch (e) { /* private browsing */ }
  }
  function takeReturnTo() {
    try {
      const v = sessionStorage.getItem(KEY_RETURN);
      sessionStorage.removeItem(KEY_RETURN);
      return v;
    } catch (e) { return null; }
  }
  function peekReturnTo() {
    try { return sessionStorage.getItem(KEY_RETURN); } catch (e) { return null; }
  }

  function requireAuth() {
    if (cachedUser) return cachedUser;
    setReturnTo(window.location.pathname.split('/').pop() + window.location.search);
    window.location.replace('login.html?next=account');
    return null;
  }

  /* =========================================================================
     Navigation rendering
     ========================================================================= */
  function initialsFor(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function renderNav() {
    const user = cachedUser;

    $$('[data-auth-nav]').forEach((slot) => {
      if (user) {
        const first = (user.name || user.email).split(' ')[0];
        slot.innerHTML =
          '<a class="nav-user" href="account.html">' +
          Render.avatar(['#F7DEE2', '#C4818C'], initialsFor(user.name || user.email)) +
          '<span>' + esc(first) + '</span></a>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-logout>Log out</button>';
      } else {
        slot.innerHTML = '<a class="btn btn-secondary btn-sm" href="login.html">Log in</a>';
      }
    });

    $$('[data-auth-only]').forEach((n) => n.classList.toggle('hidden', !user));
    $$('[data-guest-only]').forEach((n) => n.classList.toggle('hidden', !!user));

    $$('[data-credit-count]').forEach((n) => { n.textContent = user ? String(user.credits || 0) : '0'; });
    $$('[data-user-name]').forEach((n) => { n.textContent = user ? user.name : ''; });
    $$('[data-user-first-name]').forEach((n) => {
      n.textContent = user ? (user.name || user.email).split(' ')[0] : '';
    });
    $$('[data-user-email]').forEach((n) => { n.textContent = user ? user.email : ''; });
  }

  function bindLogout() {
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-logout]');
      if (!btn) return;
      e.preventDefault();
      const name = (cachedUser && cachedUser.name) || '';
      await logOut();
      toast('Signed out', name ? 'See you soon, ' + name.split(' ')[0] + '.' : '', 'info');
      if (window.UI.currentPage() === 'account.html') window.location.href = 'index.html';
    });
  }

  /* =========================================================================
     Login / sign-up page
     ========================================================================= */
  function initLoginPage() {
    const root = $('#auth-root');
    if (!root) return;

    const tabLogin = $('#tab-login');
    const tabSignup = $('#tab-signup');
    const panelLogin = $('#panel-login');
    const panelSignup = $('#panel-signup');
    const loginForm = $('#login-form');
    const signupForm = $('#signup-form');

    if (cachedUser) {
      window.location.replace(takeReturnTo() || 'account.html');
      return;
    }

    function selectTab(which) {
      const login = which === 'login';
      tabLogin.setAttribute('aria-selected', String(login));
      tabSignup.setAttribute('aria-selected', String(!login));
      panelLogin.classList.toggle('hidden', !login);
      panelSignup.classList.toggle('hidden', login);
    }
    tabLogin.addEventListener('click', () => selectTab('login'));
    tabSignup.addEventListener('click', () => selectTab('signup'));
    selectTab(window.location.hash === '#signup' ? 'signup' : 'login');

    const pending = peekReturnTo();
    const banner = $('#auth-context');
    if (pending && banner) {
      const isBooking = String(pending).indexOf('booking.html') === 0;
      banner.classList.remove('hidden');
      banner.innerHTML =
        '<div class="alert alert-info">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
        '<path d="M5 12h14M13 6l6 6-6 6"/></svg><div>' +
        (isBooking
          ? '<strong>Your class is being held.</strong><br>Sign in and we’ll take you straight back to confirm it.'
          : '<strong>Sign in to continue.</strong><br>We’ll return you to where you left off.') +
        '</div></div>';
    }

    $$('.pw-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.for);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'Hide' : 'Show';
        btn.setAttribute('aria-label', (show ? 'Hide' : 'Show') + ' password');
        input.focus();
      });
    });

    function busy(form, on, label) {
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = on;
      btn.textContent = on ? label : btn.dataset.label;
    }

    function goNext(message, user) {
      const next = takeReturnTo() || 'account.html';
      toast(message, 'Signed in as ' + (user.name || user.email) + '.', 'success');
      setTimeout(() => { window.location.href = next; }, 650);
    }

    /* --- log in --- */
    const loginEmail = $('#login-email');
    const loginPassword = $('#login-password');
    const loginBtn = loginForm.querySelector('button[type=submit]');
    loginBtn.dataset.label = loginBtn.textContent;
    Validate.liveClear(loginForm);

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validate.clearAll(loginForm);
      busy(loginForm, true, 'Signing in…');

      const result = await logIn(loginEmail.value, loginPassword.value);
      busy(loginForm, false);

      if (!result.ok) {
        Validate.fail(result.field === 'email' ? loginEmail : loginPassword, result.message);
        Validate.focusFirstError(loginForm);
        return;
      }
      goNext('Welcome back', result.user);
    });

    /* --- "you already have an account" panel --- */
    const existingPanel = $('#signup-existing');

    function hideExistingAccount() {
      if (!existingPanel) return;
      existingPanel.classList.add('hidden');
      existingPanel.innerHTML = '';
    }

    function showExistingAccount(email) {
      if (!existingPanel) return;
      existingPanel.classList.remove('hidden');
      existingPanel.innerHTML =
        '<div class="alert alert-info">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/>' +
        '<path d="M12 11v5M12 8h.01"/></svg>' +
        '<div><strong>You already have an account.</strong><br>' +
        esc(email) + ' is already registered with us.</div></div>' +
        '<button class="btn btn-block" type="button" data-switch-login>Log in instead</button>';

      existingPanel.querySelector('[data-switch-login]').addEventListener('click', () => {
        selectTab('login');
        loginEmail.value = email;          // carry the address across
        hideExistingAccount();
        Validate.clearAll(signupForm);
        loginPassword.focus();
      });

      existingPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /* --- sign up --- */
    const suName = $('#signup-name');
    const suEmail = $('#signup-email');
    const suPassword = $('#signup-password');
    const suConfirm = $('#signup-confirm');
    const suTerms = $('#signup-terms');
    const suBtn = signupForm.querySelector('button[type=submit]');
    suBtn.dataset.label = suBtn.textContent;
    Validate.liveClear(signupForm);
    suEmail.addEventListener('input', hideExistingAccount);

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validate.clearAll(signupForm);

      // Checked here because Supabase only ever sees one password
      let valid = true;
      if (!suPassword.value) {
        valid = Validate.fail(suPassword, 'Please choose a password.');
      } else if (suPassword.value.length < MIN_PASSWORD) {
        valid = Validate.fail(suPassword, 'Passwords need to be at least ' + MIN_PASSWORD + ' characters.');
      }
      if (!suConfirm.value) {
        valid = Validate.fail(suConfirm, 'Please re-enter your password.');
      } else if (suConfirm.value !== suPassword.value) {
        valid = Validate.fail(suConfirm, 'The two passwords don’t match.');
      }
      if (suName.value.trim().length < 2) valid = Validate.fail(suName, 'Please tell us your name.');
      if (!Validate.isEmail(suEmail.value)) valid = Validate.fail(suEmail, 'Please enter a valid email address.');
      if (suTerms && !suTerms.checked) {
        const msg = document.getElementById('signup-terms-error');
        if (msg) { msg.textContent = 'Please accept the studio policies to continue.'; msg.classList.add('is-visible'); }
        valid = false;
      }
      if (!valid) { Validate.focusFirstError(signupForm); return; }

      busy(signupForm, true, 'Creating your account…');
      const result = await signUp(suName.value, suEmail.value, suPassword.value);
      busy(signupForm, false);

      if (!result.ok) {
        const map = { name: suName, email: suEmail, password: suPassword };
        Validate.fail(map[result.field] || suEmail, result.message);

        // Already has an account: don't just block them, hand them the way in
        if (result.existing) showExistingAccount(result.email);

        Validate.focusFirstError(signupForm);
        return;
      }
      hideExistingAccount();

      if (result.needsConfirmation) {
        signupForm.classList.add('hidden');
        const done = $('#signup-done');
        if (done) {
          done.classList.remove('hidden');
          done.innerHTML =
            '<div class="alert alert-success">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
            '<path d="M20 6L9 17l-5-5"/></svg><div><strong>Check your email.</strong><br>' +
            'We have sent a confirmation link to ' + esc(result.email) +
            '. Click it and you can sign in.</div></div>';
        }
        toast('Almost there', 'Confirm your email address to finish signing up.', 'info', 8000);
        return;
      }

      goNext('Welcome to Plié', result.user);
    });
  }

  /* =========================================================================
     Boot — called by store.js before the page renders
     ========================================================================= */
  async function init() {
    if (authReady) return cachedUser;
    authReady = true;

    await loadUser();

    // Keep the nav honest if the session is refreshed or dropped in another tab
    sb().auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') { cachedUser = null; announce(); return; }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await loadUser();
        announce();
      }
    });

    return cachedUser;
  }

  window.Auth = {
    init, signUp, logIn, logOut, updateUser,
    currentUser, isLoggedIn, creditBalance, refreshCredits, loadUser,
    requireAuth, setReturnTo, takeReturnTo, peekReturnTo,
    initialsFor, renderNav, initLoginPage, bindLogout,
    MIN_PASSWORD: MIN_PASSWORD
  };
})();

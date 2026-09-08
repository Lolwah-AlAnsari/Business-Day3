/* ===========================================================================
   Plié Pilates — auth.js
   ---------------------------------------------------------------------------
   ⚠️  DEMO ONLY — THIS IS NOT SECURE AND MUST NOT BE USED IN PRODUCTION.
   ---------------------------------------------------------------------------
   There is no server here. Accounts, passwords and sessions are written to
   the visitor's own localStorage in PLAIN TEXT, and any script or browser
   console on this origin can read or forge them. Nothing is verified, no
   email is confirmed, and "logging in" only compares two strings.

   It exists so the booking flow can be demonstrated end to end. Before this
   site goes live, every function below must be replaced by real calls to a
   backend that hashes passwords (bcrypt/argon2), issues httpOnly session
   cookies, and validates everything again on the server.
   =========================================================================== */

(function () {
  'use strict';

  const { Store, Validate, toast, $, $$, esc, Render } = window.UI;

  const KEY_USERS   = 'users';
  const KEY_SESSION = 'session';
  const KEY_RETURN  = 'returnTo';

  /* Credits given to a brand-new account so people can try the booking flow.
     EDIT: set to 0 if you'd rather new sign-ups start empty. */
  const WELCOME_CREDITS = 2;

  const MIN_PASSWORD = 8;

  /* =========================================================================
     Storage layer
     ========================================================================= */
  function allUsers() {
    const users = Store.get(KEY_USERS, []);
    return Array.isArray(users) ? users : [];
  }

  function saveUsers(users) {
    return Store.set(KEY_USERS, users);
  }

  function normaliseEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function findByEmail(email) {
    const target = normaliseEmail(email);
    return allUsers().find((u) => normaliseEmail(u.email) === target) || null;
  }

  function findById(id) {
    return allUsers().find((u) => u.id === id) || null;
  }

  function makeId() {
    return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function initialsFor(name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* =========================================================================
     Demo seed account
     Lets you (and anyone reviewing the site) log in without signing up first.
     EDIT: delete this whole block, and the hint on login.html, before launch.
     ========================================================================= */
  const DEMO = {
    email: 'demo@pliepilates.com',
    password: 'pilates123',
    name: 'Amal Demo'
  };

  function seedDemoAccount() {
    if (findByEmail(DEMO.email)) return;
    const users = allUsers();
    users.push({
      id: 'u_demo',
      name: DEMO.name,
      email: DEMO.email,
      password: DEMO.password,     // plain text — see the warning at the top
      credits: 6,
      phone: '',
      joined: new Date().toISOString(),
      isDemo: true
    });
    saveUsers(users);
  }

  /* =========================================================================
     Session
     ========================================================================= */
  function currentUser() {
    const session = Store.get(KEY_SESSION, null);
    if (!session || !session.userId) return null;
    return findById(session.userId);
  }

  function isLoggedIn() {
    return currentUser() !== null;
  }

  function startSession(user) {
    Store.set(KEY_SESSION, { userId: user.id, since: new Date().toISOString() });
    announce();
  }

  function endSession() {
    Store.remove(KEY_SESSION);
    announce();
  }

  /** Let any page react to a login / logout / credit change. */
  function announce() {
    renderNav();
    window.dispatchEvent(new CustomEvent('plie:auth', { detail: { user: currentUser() } }));
  }

  /* =========================================================================
     Account actions
     ========================================================================= */

  /** @returns {{ok:true,user:object}|{ok:false,field:string,message:string}} */
  function signUp(name, email, password) {
    const clean = {
      name: String(name).trim(),
      email: normaliseEmail(email)
    };

    if (!clean.name) return fail('name', 'Please tell us your name.');
    if (clean.name.length < 2) return fail('name', 'That name looks a little short.');
    if (!clean.email) return fail('email', 'Please enter your email address.');
    if (!Validate.isEmail(clean.email)) return fail('email', 'That doesn’t look like a valid email address.');
    if (findByEmail(clean.email)) return fail('email', 'An account with this email already exists. Try logging in instead.');
    if (!password) return fail('password', 'Please choose a password.');
    if (password.length < MIN_PASSWORD) return fail('password', 'Passwords need to be at least ' + MIN_PASSWORD + ' characters.');

    const user = {
      id: makeId(),
      name: clean.name,
      email: clean.email,
      password: password,          // plain text — see the warning at the top
      credits: WELCOME_CREDITS,
      phone: '',
      joined: new Date().toISOString()
    };

    const users = allUsers();
    users.push(user);
    if (!saveUsers(users)) {
      return fail('email', 'Your browser blocked local storage, so the account could not be saved.');
    }

    startSession(user);
    return { ok: true, user: user };
  }

  /** @returns {{ok:true,user:object}|{ok:false,field:string,message:string}} */
  function logIn(email, password) {
    const clean = normaliseEmail(email);

    if (!clean) return fail('email', 'Please enter your email address.');
    if (!Validate.isEmail(clean)) return fail('email', 'That doesn’t look like a valid email address.');
    if (!password) return fail('password', 'Please enter your password.');

    const user = findByEmail(clean);
    // Deliberately vague, and attached to the password field, so we don't
    // confirm which emails have accounts.
    if (!user || user.password !== password) {
      return fail('password', 'Email or password is incorrect. Please try again.');
    }

    startSession(user);
    return { ok: true, user: user };
  }

  function logOut() {
    endSession();
  }

  /** Patch fields on the signed-in user. */
  function updateUser(changes) {
    const user = currentUser();
    if (!user) return { ok: false, message: 'You are not signed in.' };

    if (changes.email !== undefined) {
      const email = normaliseEmail(changes.email);
      if (!Validate.isEmail(email)) return fail('email', 'That doesn’t look like a valid email address.');
      const clash = findByEmail(email);
      if (clash && clash.id !== user.id) return fail('email', 'Another account already uses that email.');
      changes.email = email;
    }
    if (changes.name !== undefined) {
      changes.name = String(changes.name).trim();
      if (changes.name.length < 2) return fail('name', 'Please enter your full name.');
    }
    if (changes.password !== undefined) {
      if (changes.password.length < MIN_PASSWORD) {
        return fail('password', 'Passwords need to be at least ' + MIN_PASSWORD + ' characters.');
      }
    }

    const users = allUsers();
    const index = users.findIndex((u) => u.id === user.id);
    if (index === -1) return { ok: false, message: 'Account not found.' };

    users[index] = Object.assign({}, users[index], changes);
    saveUsers(users);
    announce();
    return { ok: true, user: users[index] };
  }

  /* --- Credits -------------------------------------------------------------
     booking.js spends 1 credit per booking and refunds it on cancellation.
     pricing.html "purchases" call addCredits().
     ------------------------------------------------------------------------- */
  function addCredits(amount) {
    const user = currentUser();
    if (!user) return { ok: false, message: 'You are not signed in.' };
    const users = allUsers();
    const index = users.findIndex((u) => u.id === user.id);
    users[index].credits = Math.max(0, (users[index].credits || 0) + Number(amount));
    saveUsers(users);
    announce();
    return { ok: true, credits: users[index].credits };
  }

  function spendCredit() {
    return addCredits(-1);
  }

  function creditBalance() {
    const user = currentUser();
    return user ? Number(user.credits || 0) : 0;
  }

  function fail(field, message) {
    return { ok: false, field: field, message: message };
  }

  /* =========================================================================
     Return-to redirects
     "Log in to finish booking" must bring you back to where you were.
     ========================================================================= */
  function setReturnTo(url) {
    Store.set(KEY_RETURN, url || (window.location.pathname.split('/').pop() + window.location.search));
  }

  function takeReturnTo() {
    const url = Store.get(KEY_RETURN, null);
    Store.remove(KEY_RETURN);
    return url;
  }

  function peekReturnTo() {
    return Store.get(KEY_RETURN, null);
  }

  /** Send the visitor to the login page, remembering where they were. */
  function redirectToLogin(returnUrl) {
    setReturnTo(returnUrl);
    window.location.href = 'login.html';
  }

  /** Guard a page that requires an account. Returns the user, or null after
      kicking off a redirect. */
  function requireAuth() {
    const user = currentUser();
    if (user) return user;
    setReturnTo(window.location.pathname.split('/').pop() + window.location.search);
    window.location.replace('login.html?next=account');
    return null;
  }

  /* =========================================================================
     Navigation rendering
     ========================================================================= */
  function renderNav() {
    const user = currentUser();

    $$('[data-auth-nav]').forEach((slot) => {
      if (user) {
        slot.innerHTML =
          '<a class="nav-user" href="account.html">' +
          Render.avatar(['#F7DEE2', '#C4818C'], initialsFor(user.name)) +
          '<span>' + esc(user.name.split(' ')[0]) + '</span>' +
          '</a>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-logout>Log out</button>';
      } else {
        slot.innerHTML = '<a class="btn btn-secondary btn-sm" href="login.html">Log in</a>';
      }
    });

    // Anything tagged data-auth-only / data-guest-only shows conditionally
    $$('[data-auth-only]').forEach((n) => n.classList.toggle('hidden', !user));
    $$('[data-guest-only]').forEach((n) => n.classList.toggle('hidden', !!user));

    // Live credit counters anywhere on the page
    $$('[data-credit-count]').forEach((n) => { n.textContent = user ? String(user.credits || 0) : '0'; });
    $$('[data-user-name]').forEach((n) => { n.textContent = user ? user.name : ''; });
    $$('[data-user-first-name]').forEach((n) => { n.textContent = user ? user.name.split(' ')[0] : ''; });
    $$('[data-user-email]').forEach((n) => { n.textContent = user ? user.email : ''; });
  }

  /** One delegated handler covers the log-out button in the header and footer. */
  function bindLogout() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-logout]');
      if (!btn) return;
      e.preventDefault();
      const name = (currentUser() || {}).name || '';
      logOut();
      toast('Signed out', name ? 'See you soon, ' + name.split(' ')[0] + '.' : '', 'info');
      // Leave any account-only page
      const page = window.UI.currentPage();
      if (page === 'account.html') window.location.href = 'index.html';
    });
  }

  /* =========================================================================
     Login / sign-up page controller
     ========================================================================= */
  function initLoginPage() {
    const root = $('#auth-root');
    if (!root) return;

    const tabLogin  = $('#tab-login');
    const tabSignup = $('#tab-signup');
    const panelLogin  = $('#panel-login');
    const panelSignup = $('#panel-signup');
    const loginForm  = $('#login-form');
    const signupForm = $('#signup-form');

    /* --- already signed in? --------------------------------------------- */
    if (currentUser()) {
      const next = takeReturnTo() || 'account.html';
      window.location.replace(next);
      return;
    }

    /* --- tabs ------------------------------------------------------------ */
    function selectTab(which) {
      const login = which === 'login';
      tabLogin.setAttribute('aria-selected', String(login));
      tabSignup.setAttribute('aria-selected', String(!login));
      panelLogin.classList.toggle('hidden', !login);
      panelSignup.classList.toggle('hidden', login);
      if (window.location.hash !== (login ? '' : '#signup')) {
        history.replaceState(null, '', login ? window.location.pathname + window.location.search
                                             : window.location.pathname + window.location.search + '#signup');
      }
    }

    tabLogin.addEventListener('click', () => selectTab('login'));
    tabSignup.addEventListener('click', () => selectTab('signup'));
    selectTab(window.location.hash === '#signup' ? 'signup' : 'login');

    /* --- context banner --------------------------------------------------- */
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

    /* --- show / hide password -------------------------------------------- */
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

    /* --- where to go after success --------------------------------------- */
    function finish(user, message) {
      const next = takeReturnTo() || 'account.html';
      toast(message, 'Signed in as ' + user.name + '.', 'success');
      setTimeout(() => { window.location.href = next; }, 650);
    }

    /* --- log in ----------------------------------------------------------- */
    const loginEmail = $('#login-email');
    const loginPassword = $('#login-password');
    Validate.liveClear(loginForm);

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      Validate.clearAll(loginForm);

      const result = logIn(loginEmail.value, loginPassword.value);
      if (!result.ok) {
        const field = result.field === 'email' ? loginEmail : loginPassword;
        Validate.fail(field, result.message);
        Validate.focusFirstError(loginForm);
        return;
      }
      finish(result.user, 'Welcome back');
    });

    /* --- sign up ----------------------------------------------------------- */
    const suName = $('#signup-name');
    const suEmail = $('#signup-email');
    const suPassword = $('#signup-password');
    const suConfirm = $('#signup-confirm');
    const suTerms = $('#signup-terms');
    Validate.liveClear(signupForm);

    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      Validate.clearAll(signupForm);

      // Confirm-password is checked here because auth.signUp only sees one password
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
      if (suTerms && !suTerms.checked) {
        const msg = document.getElementById('signup-terms-error');
        if (msg) { msg.textContent = 'Please accept the studio policies to continue.'; msg.classList.add('is-visible'); }
        valid = false;
      }

      const result = signUp(suName.value, suEmail.value, suPassword.value);

      if (!result.ok) {
        const map = { name: suName, email: suEmail, password: suPassword };
        Validate.fail(map[result.field] || suEmail, result.message);
        valid = false;
      }

      if (!valid) {
        // signUp may have already created the account before a later check failed;
        // it never does — signUp validates first — but be explicit for readers:
        // if it succeeded and the local checks failed, roll the session back.
        if (result.ok) { logOut(); removeUser(result.user.id); }
        Validate.focusFirstError(signupForm);
        return;
      }

      finish(result.user, 'Welcome to Plié');
    });

    /* --- demo account shortcut -------------------------------------------
       EDIT: delete this block (and #demo-hint in login.html) before launch. */
    const demoFill = $('#demo-fill');
    if (demoFill) {
      demoFill.addEventListener('click', () => {
        selectTab('login');
        loginEmail.value = DEMO.email;
        loginPassword.value = DEMO.password;
        Validate.clearAll(loginForm);
        loginEmail.focus();
        toast('Demo details filled in', 'Press “Log in” to continue.', 'info', 3500);
      });
    }
  }

  /** Used only to undo a sign-up that a later client-side check rejected. */
  function removeUser(id) {
    saveUsers(allUsers().filter((u) => u.id !== id));
  }

  /* =========================================================================
     Public API
     ========================================================================= */
  window.Auth = {
    signUp, logIn, logOut,
    currentUser, isLoggedIn, updateUser,
    addCredits, spendCredit, creditBalance,
    requireAuth, redirectToLogin, setReturnTo, takeReturnTo, peekReturnTo,
    initialsFor, renderNav,
    DEMO: DEMO,
    MIN_PASSWORD: MIN_PASSWORD,
    WELCOME_CREDITS: WELCOME_CREDITS
  };

  /* =========================================================================
     Boot
     ========================================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    seedDemoAccount();
    renderNav();
    bindLogout();
    initLoginPage();
  });
})();

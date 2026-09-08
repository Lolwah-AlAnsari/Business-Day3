# Plié Pilates — Studio Website

A complete front-end website for a boutique Pilates studio: marketing pages, a live
class timetable, accounts, and a four-step booking flow.

**Vanilla HTML, CSS and JavaScript. No frameworks, no build step, no `npm install`.**

---

## Running it

Double-click **`index.html`**. That's it.

There is nothing to compile and no server required — every page is plain HTML and
every script is a plain `<script>` tag.

> If you want a local server anyway (handy while editing), run
> `python3 -m http.server 8000` in this folder and open <http://localhost:8000>.

### Try the demo account

Accounts are stored in your browser, so a fresh visit starts empty. A demo account is
seeded automatically:

| | |
|---|---|
| **Email** | `demo@pliepilates.com` |
| **Password** | `pilates123` |

There's a **"Fill in the demo login"** button at the bottom of `login.html`.
Or just sign up — new accounts get **2 free class credits**.

**To reset everything** (accounts, bookings, credits), open your browser console and run:

```js
Object.keys(localStorage).filter(k => k.startsWith('plie:')).forEach(k => localStorage.removeItem(k));
```

---

## ⚠️ Read this before going live

**The login and booking system is a front-end demo. It is not secure.**

Accounts, passwords and bookings are written to the visitor's own `localStorage` in
**plain text**. Anyone can read or forge them from the browser console. Nothing is
verified, no email is confirmed, and "logging in" only compares two strings.

Before real customers use this, every function in `js/auth.js` must be replaced with
calls to a real backend that hashes passwords, issues session cookies, and re-validates
everything server-side. The same applies to bookings in `js/booking.js` — capacity has
to be enforced on a server, or two people will book the last bed at once.

The warning is repeated at the top of `js/auth.js`.

---

## File structure

```
├── index.html          Home — hero, class types, benefits, instructors, testimonials
├── about.html          Studio story, philosophy, the space, values
├── classes.html        Reformer vs Mat in detail + side-by-side comparison
├── instructors.html    Full profiles for all four instructors
├── schedule.html       Weekly timetable, filterable by type / instructor / day
├── booking.html        The four-step booking flow
├── pricing.html        Drop-in, packs, membership + comparison table
├── login.html          Log in and sign up (tabbed)
├── account.html        Dashboard — bookings, credits, profile
├── contact.html        Contact form, studio details, map, FAQ accordion
│
├── css/
│   └── styles.css      The entire design system
│
└── js/
    ├── data.js         ← ALL studio content lives here
    ├── main.js         Nav, toasts, accordion, formatting, storage helpers
    ├── auth.js         Accounts and sessions (demo only)
    └── booking.js      Slots, capacity, bookings + page controllers
```

Load order on every page is `data.js → main.js → auth.js → booking.js`.

---

## Where to edit things

### Content — `js/data.js`

**Almost everything you'll want to change is in this one file.** Nothing in it requires
touching page markup. Every spot that needs your real details is flagged with an
`EDIT:` comment — search the project for `EDIT:` to find all of them at once.

| What | Where in `data.js` |
|---|---|
| Address, phone, email, opening hours, socials | `studio` |
| Class descriptions, durations, **class capacity** | `classTypes` |
| Instructor names, bios, certifications, specialties | `instructors` |
| **The weekly timetable** | `weeklySchedule` |
| Prices, credits, plan features, "most popular" flag | `pricing` |
| Member quotes | `testimonials` |
| Home-page benefit cards | `benefits` |
| FAQ questions and answers | `faqs` |
| About-page values | `values` |

**Changing the timetable** — each row in `weeklySchedule` is one class:

```js
{ day: 1, time: '18:30', type: 'mat', instructor: 'layla' },
//   ↑            ↑            ↑              ↑
//   0=Sun…6=Sat  24-hour      classTypes id  instructors id
```

Add, remove or move rows freely. The schedule page, the booking calendar and the
"classes per week" counts all update themselves.

**Changing class size** — set `capacity` on the class type. The booking engine enforces
it everywhere (currently Reformer 8, Mat 14).

### Colours and fonts — `css/styles.css`

The palette is defined once as custom properties at the top of the file, in `:root`.
Change those six or seven values and the whole site retheme — nothing below hard-codes
a colour.

```css
--cream:      #FDF9F5;   /* page background      */
--sand:       #EFE4D8;   /* alternating sections */
--blush:      #F7DEE2;   /* soft pink fills      */
--rose:       #C4818C;   /* dusty rose accents   */
--rose-deep:  #9B5A66;   /* buttons and links    */
--taupe:      #453B38;   /* body text            */
```

Contrast is checked: taupe on cream is 10.3:1, rose-deep on cream 4.9:1, and white on
rose-deep 5.2:1 — all comfortably past WCAG AA. If you swap these, keep text dark.

Fonts are Cormorant Garamond (headings) and Karla (body), loaded from Google Fonts
without blocking the page — if the CDN is slow or you're offline, the site renders
immediately on the fallback stack.

### Photos

There are **no image files** in this project, so nothing can 404. Every photo slot is a
CSS gradient placeholder marked with an `EDIT:` comment.

To use a real photo, replace the placeholder element with an `<img>`:

```html
<!-- from this -->
<div class="media" style="--ph-a:#F7DEE2;--ph-b:#E4C3B4">…</div>

<!-- to this -->
<img class="media" src="images/studio-floor.jpg" alt="The main studio floor at Plié">
```

The `.media` class keeps the aspect ratio and rounded corners either way. Instructor
photos come from `R.avatar(...)` calls — swap those for `<img class="avatar-xl">`.

### The map

`contact.html` has a CSS-drawn map placeholder. There's a commented-out `<iframe>`
right above it showing the Google Maps embed to paste in.

---

## How the booking system works

**Credits.** One credit books any class, reformer or mat. New sign-ups get 2. The
pricing page simulates a purchase and adds credits (no payment is taken). Booking spends
one; cancelling in time returns it.

**Capacity.** Each class type has a hard cap. Full classes can't be selected in the
wizard and show as "Class full" on the timetable.

> So the timetable doesn't look artificially empty, each class starts with a
> **simulated** baseline occupancy derived from a stable hash of its date and time —
> that's why some classes are already full. It never changes between reloads.
> To start every class completely empty, make `baselineTaken()` in `js/booking.js`
> return `0`.

**Double-booking** the same class is blocked.

**Cancelling** always frees the spot. The credit is refunded only if you cancel more
than 12 hours before the class, matching the policy stated on the site. Change
`FREE_CANCEL_HOURS` at the top of `js/booking.js` to adjust it.

**Booking while logged out** — you can browse and choose a class, date and time without
an account. At the confirm step you're asked to log in, and your in-progress booking is
brought back with you afterwards.

**Dates** run 21 days ahead and never include the past. Change `HORIZON_DAYS` in
`js/booking.js`.

---

## What's been checked

Verified in Chromium at desktop (1280px) and mobile (390px) widths:

- All 10 pages load with no JavaScript errors, no broken links, no missing files
- Sign-up validation: email format, password length, confirm match, duplicate emails
- Login rejects wrong credentials with a clear inline message
- Session persists across pages and reloads; nav swaps to "My Account"
- `account.html` redirects to login when signed out
- Full journey: sign up → book → view in account → cancel → spot freed
- Capacity enforced, double-booking blocked, past dates unbookable
- Back button through the wizard preserves every selection
- Login round-trip mid-booking returns you to the right step
- Timetable filters by type, instructor and day
- Mobile hamburger opens, closes on Escape, closes after navigating
- No horizontal scroll at 390px on any page

## Accessibility

Semantic HTML, labelled inputs, skip link, visible keyboard focus rings, `aria-expanded`
on the nav toggle and accordion, `aria-current` on the active nav link, `aria-live` on
the timetable and toasts, alt text and `role="img"` labels on every graphic, and
`prefers-reduced-motion` respected throughout. Form errors are inline and announced —
there is no `alert()` anywhere in the site.

## Browser support

Any current version of Chrome, Edge, Firefox or Safari. Uses `color-mix()`, `clamp()`,
CSS grid and `aspect-ratio`.

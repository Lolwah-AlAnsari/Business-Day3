# Plié Pilates — Studio Website

A boutique Pilates studio site with a real backend: live class timetable,
member accounts, credit-based booking, and 3D equipment illustrations.

**Front end:** vanilla HTML, CSS and JavaScript. No framework, no build step.
**Back end:** Supabase (Postgres + Auth).

---

## Running it

The site needs an internet connection — it loads the class timetable from the
database and the Supabase SDK from a CDN.

- **Live:** <https://lolwah-alansari.github.io/Business-Day3/>
- **Locally:** run a small web server in this folder and open it in a browser:

  ```bash
  python3 -m http.server 8000
  # then open http://localhost:8000
  ```

  Opening `index.html` straight off the disk mostly works too, but a server is
  closer to how it actually runs.

### Sign in

| | |
|---|---|
| **Email** | `demo@pliepilates.com` |
| **Password** | `pilates123` |

Or create your own account — new members get **2 free class credits**.

---

## How it fits together

```
Browser                          Supabase
───────                          ────────
config.js   connection details
data.js     page copy with no DB table behind it
main.js     nav, toasts, accordion, UI.ready()
auth.js  ──────────────────────▶ Auth  (sign up, sign in, sessions)
booking.js ────────────────────▶ book_class() / cancel_booking()
store.js    boots everything ──▶ loads all studio content, then fires
                                 `plie:ready`, which every page waits on
models-3d.js  the 3D scenes (no backend)
```

`store.js` loads last on purpose: it creates the client, pulls the content,
restores the session, fetches the booking window, and only then lets the pages
render. Everything after that is synchronous, so drawing a timetable never
waits on the network.

### Files

```
index.html  about.html  classes.html  instructors.html  schedule.html
booking.html  pricing.html  login.html  account.html  contact.html

css/styles.css      the whole design system
js/config.js        Supabase URL + publishable key      ← EDIT to move projects
js/data.js          benefits and values copy            ← EDIT freely
js/store.js         boot + database → page mapping
js/main.js          shared UI
js/auth.js          accounts and sessions
js/booking.js       timetable, booking, account, pricing
js/models-3d.js     the CSS 3D reformer, mat and studio scenes
```

---

## Where to edit things

### Studio content → the database

Classes, instructors, the timetable, prices, testimonials, FAQs, the address
and the opening hours all live in Supabase. Edit them in the **Table editor**
and the site picks the change up on the next page load — no deploy needed.

| What | Table |
|---|---|
| Class descriptions, duration, **capacity** | `class_types` |
| Instructor names, bios, certifications | `instructors` |
| **The weekly timetable** | `schedule_template` |
| Prices, credits, plan features | `pricing_plans` |
| Member quotes | `testimonials` |
| FAQ | `faqs` |
| Address, phone, hours, cancellation window | `studio_settings` |

**Changing the timetable.** Each row in `schedule_template` is one class:
`weekday` (0 = Sunday), `start_time`, `class_type_id`, `instructor_id`. Add or
remove rows, then generate the real classes:

```sql
select generate_class_instances();
```

That expands the template into dated classes for the booking window. It is
idempotent, so run it on a nightly schedule to keep the calendar rolling
forward.

**Changing class size.** Set `capacity` on the class type. It is copied onto
each class when generated, so editing it never rewrites classes already booked.

### Page copy → `js/data.js`

Only the home-page benefit cards and the about-page values. Marked `EDIT:`.

### Colours and fonts → `css/styles.css`

The palette is seven custom properties at the top of the file, in `:root`.
Change those and the whole site rethemes.

```css
--cream: #FDF9F5;  --sand: #EFE4D8;  --blush: #F7DEE2;
--rose:  #C4818C;  --rose-deep: #9B5A66;  --taupe: #453B38;
```

Contrast is checked: taupe on cream is 10.3:1, rose-deep on cream 4.9:1, white
on rose-deep 5.2:1 — all past WCAG AA.

### Photos

There are none, and nothing 404s. Every photo slot is either a CSS gradient or
a 3D model, each marked with an `EDIT:` comment showing where an `<img>` goes.

---

## The booking rules, and where they are enforced

**In the database, not the browser.** Two people tapping Book on the last
reformer bed at the same moment both see "1 left" — only the server can settle
that. `book_class()` locks the class row so the second caller waits, then
correctly fails.

The `bookings` table has no client INSERT policy at all. Writes go only through
`book_class()` and `cancel_booking()`, so the capacity and credit checks cannot
be bypassed from the browser.

- **Credits.** One per class. New members get 2. Booking spends one; cancelling
  in time returns it.
- **Capacity.** Reformer 8, mat 14. Full classes cannot be selected.
- **Double-booking** is blocked by a unique index, not just a UI check.
- **Cancelling** always frees the seat. The credit comes back only more than
  12 hours before the class — change `free_cancel_hours` in `studio_settings`.
- **Booking window** is 21 days — `booking_horizon_days` in `studio_settings`.

Credits are an append-only ledger, not a counter, so every balance can be
explained and nothing is lost when two writes race.

---

## Before you take real bookings

1. **Payments are not connected.** `purchase_plan()` marks an order paid
   without taking money. Replace it with a payment provider webhook that grants
   credits only after payment clears. `orders.provider_ref` has a unique index
   so a replayed webhook cannot double-credit an account.
2. **Turn email confirmation on or off deliberately.** In Supabase →
   Authentication → Providers → Email. With it on, new sign-ups must click a
   link before they can sign in; the site handles both cases.
3. **Delete the demo account** — remove `demo@pliepilates.com` from
   Authentication → Users, and the hint block from `login.html`.
4. **Schedule the two maintenance functions** (Supabase → Database → Cron):
   `generate_class_instances()` and `expire_credits()`, nightly.
5. **Replace the placeholder content** — search the project for `EDIT:` and
   check every row in `studio_settings`.

## Security

Row Level Security is on for all 14 tables. Members read only their own
bookings, orders and credits; the catalogue is public; the contact inbox is
staff-only. The key in `js/config.js` is a publishable key and is meant to be
public — RLS is what protects the data. **Never put a `service_role` key in
front-end code.**

## What's been tested

Verified in Chromium against a stub that mirrors the schema, and the booking
rules verified directly against the real database:

- Content loads from the database and maps onto every page
- Sign up → welcome credits → book → appears in account → cancel → seat freed
- Double-booking, full classes, past classes and zero credits all rejected
- Cancellation refunds follow the 12-hour policy
- Log out, and the account page redirecting when signed out
- Logging in mid-booking returns you to the right step
- Contact form writes to the database
- Backend unreachable → an honest error banner, not a blank page
- 3D scenes: drag, momentum, fit and centring at 6 breakpoints

## Accessibility

Semantic HTML, labelled inputs, skip link, visible focus rings, `aria-expanded`
on the nav and accordion, `aria-live` on the timetable and toasts, and
`prefers-reduced-motion` respected. Form errors are inline — no `alert()`.

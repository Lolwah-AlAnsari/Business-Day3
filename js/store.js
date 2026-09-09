/* ===========================================================================
   Plié Pilates — store.js
   ---------------------------------------------------------------------------
   Boots the app:
     1. creates the Supabase client
     2. loads all studio content from the database into window.STUDIO
     3. restores the signed-in session
     4. loads the booking window
     5. fires `plie:ready`, which is what every page waits on

   Rows are mapped into the shapes the pages already expected, so the render
   code did not have to change when the content moved out of a JS file and
   into Postgres.

   This file must load LAST — it calls into Auth and Booking.
   =========================================================================== */

(function () {
  'use strict';

  window.PLIE = {
    client: null,
    ready: false,
    online: false,
    error: null
  };

  /* -------------------------------------------------------------------------
     Client
     ------------------------------------------------------------------------- */
  function createClient() {
    const cfg = window.PLIE_CONFIG || {};
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('The Supabase library did not load. Check your connection.');
    }
    if (!cfg.supabaseUrl || !cfg.supabaseKey) {
      throw new Error('Missing Supabase credentials in js/config.js.');
    }
    return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  /* -------------------------------------------------------------------------
     Mapping database rows onto the shapes the pages use
     ------------------------------------------------------------------------- */
  const hhmm = (t) => String(t || '').slice(0, 5);

  function mapClassType(r) {
    return {
      id: r.id, name: r.name, short: r.short_name,
      capacity: r.capacity, duration: r.duration_min,
      level: r.level, tagline: r.tagline, description: r.description,
      suits: r.suits || [], bring: r.bring || [],
      gradient: [r.gradient_from, r.gradient_to]
    };
  }

  function mapInstructor(r) {
    return {
      id: r.id, name: r.name, initials: r.initials, role: r.role,
      specialty: r.specialty, certifications: r.certifications || [], bio: r.bio,
      gradient: [r.gradient_from, r.gradient_to]
    };
  }

  function mapPlan(r) {
    return {
      id: r.id, name: r.name, price: Number(r.price), credits: r.credits,
      unit: r.unit, perClass: r.per_class === null ? null : Number(r.per_class),
      blurb: r.blurb, popular: r.is_popular,
      features: r.features || [], notIncluded: r.not_included || []
    };
  }

  function mapStudio(r) {
    return {
      name: r.name,
      tagline: r.tagline,
      address: { line1: r.address_line1, line2: r.address_line2, country: r.country },
      phone: r.phone,
      // tel: links need the punctuation stripped, but the leading + kept
      phoneHref: String(r.phone || '').replace(/[^\d+]/g, ''),
      email: r.email,
      currency: r.currency,
      hours: r.hours || [],
      social: r.social || [],
      freeCancelHours: r.free_cancel_hours,
      bookingHorizonDays: r.booking_horizon_days
    };
  }

  /* -------------------------------------------------------------------------
     Content
     ------------------------------------------------------------------------- */
  async function hydrate(client) {
    const S = window.STUDIO;

    const [types, instructors, template, plans, testimonials, faqs, settings] = await Promise.all([
      client.from('class_types').select('*').eq('is_active', true).order('sort_order'),
      client.from('instructors').select('*').eq('is_active', true).order('sort_order'),
      client.from('schedule_template').select('weekday, start_time, class_type_id, instructor_id')
            .eq('is_active', true).order('weekday').order('start_time'),
      client.from('pricing_plans').select('*').eq('is_active', true).order('sort_order'),
      client.from('testimonials').select('*').eq('is_published', true).order('sort_order'),
      client.from('faqs').select('*').eq('is_published', true).order('sort_order'),
      client.from('studio_settings').select('*').maybeSingle()
    ]);

    const firstError = [types, instructors, template, plans, testimonials, faqs, settings]
      .map((r) => r.error).filter(Boolean)[0];
    if (firstError) throw new Error(firstError.message);

    S.classTypes    = (types.data || []).map(mapClassType);
    S.instructors   = (instructors.data || []).map(mapInstructor);
    S.weeklySchedule = (template.data || []).map((r) => ({
      day: r.weekday, time: hhmm(r.start_time), type: r.class_type_id, instructor: r.instructor_id
    }));
    S.pricing       = (plans.data || []).map(mapPlan);
    S.testimonials  = (testimonials.data || []).map((r) => ({
      quote: r.quote, name: r.author_name, detail: r.detail, initials: r.initials
    }));
    S.faqs          = (faqs.data || []).map((r) => ({ q: r.question, a: r.answer }));
    if (settings.data) S.studio = mapStudio(settings.data);
  }

  /* -------------------------------------------------------------------------
     If the backend cannot be reached there is nothing honest to show, so say
     so plainly rather than rendering an empty timetable.
     ------------------------------------------------------------------------- */
  function showOfflineBanner(message) {
    const mount = () => {
      if (document.getElementById('plie-offline')) return;
      const bar = document.createElement('div');
      bar.id = 'plie-offline';
      bar.setAttribute('role', 'alert');
      bar.style.cssText =
        'position:relative;z-index:150;padding:0.85rem 1.25rem;text-align:center;' +
        'background:#F8E7E5;color:#A24A45;font-size:0.875rem;line-height:1.5;' +
        'border-bottom:1px solid rgba(162,74,69,.25)';
      bar.innerHTML =
        '<strong>We can’t reach the booking system right now.</strong> ' +
        'Class times and booking are unavailable — please try again shortly, or call the studio. ' +
        '<span style="opacity:.75">(' + String(message || '').replace(/[<>&]/g, '') + ')</span>';
      document.body.insertBefore(bar, document.body.firstChild);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount);
    } else {
      mount();
    }
  }

  /* -------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------- */
  (async function boot() {
    try {
      window.PLIE.client = createClient();
      await hydrate(window.PLIE.client);
      await window.Auth.init();
      await window.Booking.refresh();
      window.PLIE.online = true;
    } catch (e) {
      window.PLIE.error = e;
      console.error('[Plié] Startup failed:', e);
      showOfflineBanner(e.message);
    } finally {
      window.PLIE.ready = true;
      window.dispatchEvent(new CustomEvent('plie:ready', { detail: { online: window.PLIE.online } }));
    }
  })();
})();

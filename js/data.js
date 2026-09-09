/* ===========================================================================
   Plié Pilates — data.js
   ---------------------------------------------------------------------------
   WHERE CONTENT LIVES NOW

   Classes, instructors, the timetable, prices, testimonials, FAQs and the
   studio's contact details are stored in Supabase and loaded at runtime by
   js/store.js. Edit those in the database (or the Supabase table editor),
   not here.

   What remains in this file is the page copy that has no database table
   behind it — the home page benefit cards and the about page values — plus
   the empty shape that store.js fills in and the lookup helpers the pages use.

   EDIT: the two arrays below are yours to rewrite freely.
   =========================================================================== */

(function () {
  'use strict';

  /* -------------------------------------------------------------------------
     WHY-CHOOSE-US / BENEFITS  (home page)
     EDIT: adjust to whatever is actually true of your studio.
     ------------------------------------------------------------------------- */
  const benefits = [
    {
      icon: 'M12 3v18M5 8l7-5 7 5',
      title: 'Eight beds, never nine',
      text:
        'Reformer classes cap at eight and mat at fourteen. Small enough that your instructor ' +
        'knows your name, your knee and your bad habits.'
    },
    {
      icon: 'M4 12h16M4 6h16M4 18h10',
      title: 'Certified, career instructors',
      text:
        'Every teacher holds a comprehensive certification and keeps training. Two of the four ' +
        'come from a clinical background.'
    },
    {
      icon: 'M12 21s-7-4.5-7-10a7 7 0 0114 0c0 5.5-7 10-7 10z',
      title: 'A room that lowers your shoulders',
      text:
        'Warm light, quiet floors, no mirrors down the long wall. We built the space so you ' +
        'look inward instead of sideways.'
    },
    {
      icon: 'M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      title: 'Classes every single day',
      text:
        'From 6:30 AM to 8:00 PM, seven days a week. Thirty-five classes across the week so ' +
        'there is always one that fits.'
    },
    {
      icon: 'M20 6L9 17l-5-5',
      title: 'Book in about twenty seconds',
      text:
        'Pick a class, pick a time, done. Cancel free up to twelve hours before and your ' +
        'credit comes straight back.'
    },
    {
      icon: 'M12 2l2.4 7.4H22l-6 4.4 2.3 7.2-6.3-4.6L5.7 21 8 13.8 2 9.4h7.6z',
      title: 'Beginners genuinely welcome',
      text:
        'Nearly half of the people in any class started this year. Tell us it is your first ' +
        'time and we will build the class around that.'
    }
  ];

  /* -------------------------------------------------------------------------
     ABOUT PAGE VALUES
     EDIT: this is your studio's voice. Rewrite it.
     ------------------------------------------------------------------------- */
  const values = [
    {
      title: 'Precision over intensity',
      text:
        'We are not interested in how hard a class looked. We are interested in whether the ' +
        'right muscle did the work. Fewer repetitions, better ones.'
    },
    {
      title: 'Small rooms, real attention',
      text:
        'Caps are a cost, not a marketing line. Eight beds means we turn people away on a busy ' +
        'Tuesday, and we would rather do that than teach to a crowd.'
    },
    {
      title: 'Bodies are not projects',
      text:
        'Nobody at Plié will talk to you about shrinking. We talk about what you can carry, ' +
        'how you sleep, and whether your back still hurts on the drive home.'
    },
    {
      title: 'Consistency beats everything',
      text:
        'Twice a week for a year will change more than a punishing month. We build schedules ' +
        'and pricing around showing up, not burning out.'
    }
  ];

  /* -------------------------------------------------------------------------
     The shape store.js fills from Supabase. Empty until then — every page
     waits for UI.ready() before rendering, so nothing reads these too early.
     ------------------------------------------------------------------------- */
  window.STUDIO = {
    benefits: benefits,
    values: values,

    studio: {
      name: 'Plié Pilates',
      tagline: '',
      address: { line1: '', line2: '', country: '' },
      phone: '', phoneHref: '', email: '',
      currency: 'KWD',
      hours: [],
      social: [],
      freeCancelHours: 12,
      bookingHorizonDays: 21
    },
    classTypes: [],
    instructors: [],
    weeklySchedule: [],
    pricing: [],
    testimonials: [],
    faqs: [],

    // --- lookup helpers -----------------------------------------------------
    classType(id) { return this.classTypes.find((c) => c.id === id) || null; },
    instructor(id) { return this.instructors.find((i) => i.id === id) || null; },
    plan(id) { return this.pricing.find((p) => p.id === id) || null; }
  };
})();

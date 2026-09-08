/* ===========================================================================
   Plié Pilates — data.js
   ---------------------------------------------------------------------------
   SINGLE SOURCE OF TRUTH for all studio content.
   Change classes, instructors, timetable, prices, testimonials, FAQs and
   contact details HERE — you should never need to edit page markup.

   Everything is attached to window.STUDIO so plain <script> tags can read it.
   =========================================================================== */

(function () {
  'use strict';

  /* -------------------------------------------------------------------------
     STUDIO DETAILS
     EDIT: replace every value in this block with your real studio details.
     ------------------------------------------------------------------------- */
  const studio = {
    name: 'Plié Pilates',
    tagline: 'Strength, softly.',
    // EDIT: replace with your real address
    address: {
      line1: 'Villa 12, Block 4, Salem Al Mubarak Street',
      line2: 'Salmiya, Hawalli Governorate',
      country: 'Kuwait'
    },
    // EDIT: replace with your real phone number
    phone: '+965 2222 1988',
    phoneHref: '+96522221988',
    // EDIT: replace with your real email address
    email: 'hello@pliepilates.com',
    // EDIT: replace with your real opening hours
    hours: [
      { days: 'Sunday – Thursday', time: '6:30 AM – 9:00 PM' },
      { days: 'Friday', time: '8:00 AM – 6:00 PM' },
      { days: 'Saturday', time: '8:00 AM – 8:00 PM' }
    ],
    // EDIT: replace with your real social handles (used in the footer)
    social: [
      { label: 'Instagram', href: '#' },
      { label: 'WhatsApp', href: '#' },
      { label: 'TikTok', href: '#' }
    ],
    currency: 'KWD'
  };

  /* -------------------------------------------------------------------------
     CLASS TYPES
     `capacity` is enforced by the booking engine — lower it and slots fill
     sooner. `id` is used everywhere else, so don't rename an id casually.
     ------------------------------------------------------------------------- */
  const classTypes = [
    {
      id: 'reformer',
      name: 'Reformer Pilates',
      short: 'Reformer',
      capacity: 8,
      duration: 50,
      level: 'All levels — beginner to advanced',
      tagline: 'Spring-loaded resistance on the classical reformer bed.',
      description:
        'The reformer is a sliding carriage strung with adjustable springs. That resistance ' +
        'lets us load a movement precisely — heavy enough to build real strength, light enough ' +
        'to unpick a habit. Classes are capped at eight beds so your instructor can actually ' +
        'see you and adjust you.',
      suits: [
        'Anyone who wants visible strength and posture change',
        'Returning to movement after a break or an injury',
        'People who find mat work hard on the wrists or knees',
        'Runners, lifters and desk-bound backs'
      ],
      bring: [
        'Grip socks (required — we sell them at reception)',
        'A water bottle',
        'Fitted clothing so we can see your alignment'
      ],
      // Gradient used for the CSS photo placeholder. EDIT: swap for a real image.
      gradient: ['#F7DEE2', '#E4C3B4']
    },
    {
      id: 'mat',
      name: 'Mat Pilates',
      short: 'Mat',
      capacity: 14,
      duration: 45,
      level: 'All levels — beginner to advanced',
      tagline: 'Classical mat work with small props and a lot of breath.',
      description:
        'Just you, a mat and gravity — plus rings, bands and soft balls when we want to make ' +
        'a shape harder. Mat is where the classical repertoire lives, and it is the fastest ' +
        'way to build the deep core control that makes everything else feel easier.',
      suits: [
        'First-timers who want an affordable way in',
        'Anyone building core control and mobility',
        'Reformer regulars who want to reinforce the basics',
        'People who like a flowing, rhythmic class'
      ],
      bring: [
        'A mat if you have a favourite (we provide them too)',
        'A water bottle',
        'Comfortable clothing you can roll around in'
      ],
      gradient: ['#EFE4D8', '#DCC8BE']
    }
  ];

  /* -------------------------------------------------------------------------
     INSTRUCTORS
     EDIT: replace names, bios, specialties and certifications with your team.
     `initials` + `gradient` render the photo placeholder card.
     ------------------------------------------------------------------------- */
  const instructors = [
    {
      id: 'noura',
      name: 'Noura Al-Rashid',
      initials: 'NA',
      role: 'Founder & Lead Instructor',
      specialty: 'Reformer • Postural correction',
      certifications: [
        'BASI Pilates Comprehensive Certification',
        'Polestar Pilates Mat & Apparatus',
        'NASM Corrective Exercise Specialist'
      ],
      bio:
        'Noura opened Plié after twelve years of teaching in London and Dubai, mostly to people ' +
        'who had been told to "just rest" and were tired of hearing it. She teaches slowly, ' +
        'talks about ribs a lot, and will find the one millimetre of movement you are avoiding.',
      gradient: ['#F7DEE2', '#C4818C']
    },
    {
      id: 'dana',
      name: 'Dana Khalifa',
      initials: 'DK',
      role: 'Senior Instructor',
      specialty: 'Mat • Pre & postnatal',
      certifications: [
        'STOTT PILATES Certified Instructor',
        'Pre & Postnatal Pilates (Centre for Women’s Fitness)',
        'Diastasis Recti & Core Rehabilitation'
      ],
      bio:
        'Dana came to Pilates through dance and never quite left the musicality behind — her mat ' +
        'classes flow. She works with a lot of new mothers and is unhurried and unbothered about ' +
        'where you are starting from.',
      gradient: ['#EFE4D8', '#C99A86']
    },
    {
      id: 'yasmine',
      name: 'Yasmine Haddad',
      initials: 'YH',
      role: 'Instructor',
      specialty: 'Reformer • Injury rehabilitation',
      certifications: [
        'BASI Pilates Comprehensive Certification',
        'BSc Physiotherapy',
        'Clinical Pilates for Lower Back Pain'
      ],
      bio:
        'A physiotherapist first and a Pilates teacher second, Yasmine takes the class most ' +
        'people book when something hurts. Expect precise cueing, sensible progressions and ' +
        'zero interest in pushing you into pain.',
      gradient: ['#E8DCEB', '#B294A8']
    },
    {
      id: 'layla',
      name: 'Layla Marzouq',
      initials: 'LM',
      role: 'Instructor',
      specialty: 'Mat • Breathwork & mobility',
      certifications: [
        'Balanced Body Mat Certification',
        'Breathwork Facilitator (Level II)',
        'Yoga Alliance RYT-200'
      ],
      bio:
        'Layla teaches the last class of the evening, and it shows — her mat sessions wind down ' +
        'rather than wind up. She is the reason half the studio now knows what a lateral rib ' +
        'breath feels like.',
      gradient: ['#DCE7E3', '#8FA89E']
    }
  ];

  /* -------------------------------------------------------------------------
     WEEKLY TIMETABLE
     A repeating template — the same grid runs every week, resolved against
     real calendar dates by the booking engine.
       day:        0 = Sunday ... 6 = Saturday
       time:       24-hour "HH:MM"
       type:       a classTypes id
       instructor: an instructors id

     EDIT: this is your real timetable. Add, remove or move rows freely.
     ------------------------------------------------------------------------- */
  const weeklySchedule = [
    // ---- Sunday ----
    { day: 0, time: '07:00', type: 'reformer', instructor: 'noura' },
    { day: 0, time: '09:00', type: 'mat', instructor: 'dana' },
    { day: 0, time: '12:00', type: 'reformer', instructor: 'yasmine' },
    { day: 0, time: '17:30', type: 'mat', instructor: 'layla' },
    { day: 0, time: '19:00', type: 'reformer', instructor: 'noura' },

    // ---- Monday ----
    { day: 1, time: '06:30', type: 'reformer', instructor: 'yasmine' },
    { day: 1, time: '08:00', type: 'mat', instructor: 'layla' },
    { day: 1, time: '10:00', type: 'reformer', instructor: 'noura' },
    { day: 1, time: '17:00', type: 'reformer', instructor: 'dana' },
    { day: 1, time: '18:30', type: 'mat', instructor: 'layla' },
    { day: 1, time: '20:00', type: 'reformer', instructor: 'yasmine' },

    // ---- Tuesday ----
    { day: 2, time: '07:00', type: 'mat', instructor: 'dana' },
    { day: 2, time: '09:30', type: 'reformer', instructor: 'noura' },
    { day: 2, time: '11:00', type: 'mat', instructor: 'layla' },
    { day: 2, time: '17:30', type: 'reformer', instructor: 'yasmine' },
    { day: 2, time: '19:00', type: 'mat', instructor: 'dana' },

    // ---- Wednesday ----
    { day: 3, time: '06:30', type: 'reformer', instructor: 'noura' },
    { day: 3, time: '08:00', type: 'mat', instructor: 'dana' },
    { day: 3, time: '12:00', type: 'reformer', instructor: 'yasmine' },
    { day: 3, time: '17:00', type: 'mat', instructor: 'layla' },
    { day: 3, time: '18:30', type: 'reformer', instructor: 'noura' },
    { day: 3, time: '20:00', type: 'mat', instructor: 'layla' },

    // ---- Thursday ----
    { day: 4, time: '07:00', type: 'reformer', instructor: 'dana' },
    { day: 4, time: '09:00', type: 'mat', instructor: 'layla' },
    { day: 4, time: '11:00', type: 'reformer', instructor: 'yasmine' },
    { day: 4, time: '17:30', type: 'reformer', instructor: 'noura' },
    { day: 4, time: '19:00', type: 'mat', instructor: 'dana' },

    // ---- Friday (shorter day) ----
    { day: 5, time: '09:00', type: 'mat', instructor: 'layla' },
    { day: 5, time: '10:30', type: 'reformer', instructor: 'noura' },
    { day: 5, time: '16:30', type: 'reformer', instructor: 'yasmine' },

    // ---- Saturday ----
    { day: 6, time: '08:30', type: 'reformer', instructor: 'yasmine' },
    { day: 6, time: '10:00', type: 'mat', instructor: 'dana' },
    { day: 6, time: '11:30', type: 'reformer', instructor: 'noura' },
    { day: 6, time: '16:00', type: 'mat', instructor: 'layla' },
    { day: 6, time: '17:30', type: 'reformer', instructor: 'dana' }
  ];

  /* -------------------------------------------------------------------------
     PRICING
     `credits` is how many classes the plan buys. Exactly one plan should carry
     popular: true — it gets the highlighted "Most popular" treatment.
     EDIT: replace with your real prices and inclusions.
     ------------------------------------------------------------------------- */
  const pricing = [
    {
      id: 'drop-in',
      name: 'Drop-in',
      price: 12,
      credits: 1,
      unit: 'per class',
      perClass: 12,
      blurb: 'One class, no commitment. Perfect for a first visit.',
      popular: false,
      features: [
        '1 class credit',
        'Reformer or Mat',
        'Valid for 30 days',
        'Book up to 7 days ahead'
      ],
      notIncluded: ['Priority waitlist', 'Guest passes']
    },
    {
      id: 'pack-5',
      name: '5-Class Pack',
      price: 55,
      credits: 5,
      unit: 'pack',
      perClass: 11,
      blurb: 'Enough to build a habit and feel the difference.',
      popular: false,
      features: [
        '5 class credits',
        'Reformer or Mat',
        'Valid for 2 months',
        'Book up to 14 days ahead'
      ],
      notIncluded: ['Guest passes']
    },
    {
      id: 'pack-10',
      name: '10-Class Pack',
      price: 100,
      credits: 10,
      unit: 'pack',
      perClass: 10,
      blurb: 'Our most-bought pack. Twice a week for over a month.',
      popular: true,
      features: [
        '10 class credits',
        'Reformer or Mat',
        'Valid for 3 months',
        'Book up to 21 days ahead',
        'Priority waitlist',
        '1 guest pass'
      ],
      notIncluded: []
    },
    {
      id: 'membership',
      name: 'Monthly Unlimited',
      price: 145,
      credits: 30,
      unit: 'per month',
      perClass: null,
      blurb: 'For the four-times-a-week people. Best value by a distance.',
      popular: false,
      features: [
        '30 class credits each month',
        'Reformer or Mat',
        'Book up to 30 days ahead',
        'Priority waitlist',
        '2 guest passes monthly',
        '10% off retail'
      ],
      notIncluded: []
    }
  ];

  /* -------------------------------------------------------------------------
     TESTIMONIALS
     EDIT: replace with real quotes (with permission!).
     ------------------------------------------------------------------------- */
  const testimonials = [
    {
      quote:
        'I came in after two years of on-and-off back pain and a physio who had run out of ideas. ' +
        'Six weeks of reformer with Yasmine and I stopped thinking about my back entirely.',
      name: 'Hessa A.',
      detail: 'Member since 2023',
      initials: 'HA'
    },
    {
      quote:
        'Eight beds means eight people. Nobody hides at the back, and nobody gets ignored. ' +
        'It is the first studio where I have actually felt taught rather than supervised.',
      name: 'Mariam K.',
      detail: '10-Class Pack',
      initials: 'MK'
    },
    {
      quote:
        'Dana got me through the last trimester and back again afterwards. Calm, careful, ' +
        'and never once made me feel fragile.',
      name: 'Sara J.',
      detail: 'Monthly Unlimited',
      initials: 'SJ'
    }
  ];

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
     FAQ  (contact page accordion)
     EDIT: replace with the questions you actually get asked.
     ------------------------------------------------------------------------- */
  const faqs = [
    {
      q: 'I have never done Pilates. Which class should I book?',
      a:
        'Either, honestly — both are taught to all levels. Mat is the gentler introduction and ' +
        'the cheaper one, so most first-timers start there. If you are curious about the ' +
        'reformer, book it and say it is your first class when you arrive; we will set your ' +
        'springs and stay close.'
    },
    {
      q: 'What should I wear and bring?',
      a:
        'Fitted clothing so your instructor can see your alignment, and a water bottle. Grip ' +
        'socks are required for reformer — bring a pair or buy them at reception for 4 KWD. ' +
        'Mats, rings, bands and balls are all provided.'
    },
    {
      q: 'How early should I arrive?',
      a:
        'Ten minutes before your first class so we can show you around and talk through any ' +
        'injuries. Five minutes after that. We close the door on the hour out of respect for ' +
        'the people already on their backs.'
    },
    {
      q: 'What is your cancellation policy?',
      a:
        'Cancel any time up to twelve hours before the class and your credit returns ' +
        'immediately. Inside twelve hours the credit is spent — the bed was held for you and ' +
        'someone on the waitlist missed out.'
    },
    {
      q: 'Do my class credits expire?',
      a:
        'Drop-ins last 30 days, the 5-pack two months, the 10-pack three months. Monthly ' +
        'Unlimited credits reset each billing month. If you are travelling or unwell, email us ' +
        'and we will usually freeze your pack.'
    },
    {
      q: 'Can I come while pregnant, or just after giving birth?',
      a:
        'Yes to both, with a doctor’s clearance. Dana holds a pre- and postnatal certification ' +
        'and adapts the class for you in the room. Please tell us your trimester when you book.'
    },
    {
      q: 'Is there parking?',
      a:
        'There is street parking along the block and a paid garage two buildings down. ' +
        'Evenings after 6 PM get busy — leave yourself an extra five minutes.' // EDIT: check this is true for your location
    },
    {
      q: 'Do you offer private sessions?',
      a:
        'We do — one-to-one and duet, on the reformer or the mat. They are booked by email ' +
        'rather than through the site so we can match you to the right instructor. Get in ' +
        'touch and tell us what you are working on.'
    }
  ];

  /* -------------------------------------------------------------------------
     ABOUT PAGE — story, philosophy, values
     EDIT: this is your studio's story. Rewrite it in your own voice.
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
     Expose. Nothing below this line should need editing.
     ------------------------------------------------------------------------- */
  window.STUDIO = {
    studio,
    classTypes,
    instructors,
    weeklySchedule,
    pricing,
    testimonials,
    benefits,
    faqs,
    values,

    // --- lookup helpers -----------------------------------------------------
    classType(id) {
      return classTypes.find((c) => c.id === id) || null;
    },
    instructor(id) {
      return instructors.find((i) => i.id === id) || null;
    },
    plan(id) {
      return pricing.find((p) => p.id === id) || null;
    }
  };
})();

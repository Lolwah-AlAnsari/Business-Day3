/* ===========================================================================
   Plié Pilates — config.js
   ---------------------------------------------------------------------------
   Connection details for the Supabase backend.

   EDIT: if you ever move to a different Supabase project, change these two
   values and nothing else.

   The publishable key below is MEANT to be public — it identifies the project,
   it does not grant access. What actually protects your data is Row Level
   Security, which is enabled on every table. A visitor holding this key can
   read the public catalogue (classes, instructors, prices) and their own
   bookings, and nothing else.

   NEVER put a service_role key in here. That one bypasses RLS entirely and
   would hand every visitor your whole database.
   =========================================================================== */

window.PLIE_CONFIG = {
  supabaseUrl: 'https://ygdrvbqddfcdgyrgzkay.supabase.co',
  supabaseKey: 'sb_publishable_t518Z6gdiTY7xYJGPrSNxw_pmC30tIP'
};

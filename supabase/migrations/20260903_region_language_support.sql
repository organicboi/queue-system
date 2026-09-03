-- Region language support — Phase 1
--
-- The deployment's country (and therefore its language set) is chosen by the
-- NEXT_PUBLIC_APP_COUNTRY env var, NOT by any DB value — the two Supabase
-- projects stay schema-identical. The only DB change Phase 1 needs is widening
-- the screens.announcement_lang CHECK so an India deployment can set a
-- Marathi / Hindi spoken language on a screen.
--
-- Safe to run on the live Gulf instance: it only widens an existing constraint,
-- touches no data, and every current value ('en' / 'ar' / 'both') still passes.

ALTER TABLE public.screens
  DROP CONSTRAINT IF EXISTS screens_announcement_lang_check;

ALTER TABLE public.screens
  ADD CONSTRAINT screens_announcement_lang_check
    CHECK (announcement_lang IN ('en', 'ar', 'mr', 'hi', 'both'));

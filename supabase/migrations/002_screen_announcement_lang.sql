-- Add announcement language setting to screens
ALTER TABLE public.screens
  ADD COLUMN IF NOT EXISTS announcement_lang text NOT NULL DEFAULT 'en'
    CHECK (announcement_lang IN ('en', 'ar', 'both'));

-- Update resolve_screen_settings to include announcement_lang in the JSON blob
CREATE OR REPLACE FUNCTION public.resolve_screen_settings(p_screen_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_screen record;
  v_result json;
BEGIN
  SELECT
    coalesce(s.layout, 'split-standard')       AS layout,
    coalesce(s.theme, 'standard')              AS theme,
    coalesce(s.show_ads, true)                AS show_ads,
    coalesce(s.show_ticker, true)             AS show_ticker,
    s.show_clock,
    s.show_estimated_wait,
    s.numbers_to_show,
    s.orientation,
    coalesce(s.announcement_lang, 'en')        AS announcement_lang
  INTO v_screen
  FROM public.screens s
  WHERE s.id = p_screen_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT row_to_json(v_screen) INTO v_result;
  RETURN v_result;
END;
$$;

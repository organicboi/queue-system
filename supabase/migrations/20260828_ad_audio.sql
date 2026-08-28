-- Per-ad audio opt-in for display screens.
--
-- Video ads on the school TV board (and the business board) have always been
-- forced `muted` in the player, because a wall of auto-playing video with
-- overlapping soundtracks is unusable. The school display now shows one ad at a
-- time, so a single ad's audio is safe — but only when the manager asked for
-- it. This flag is that opt-in; the player unmutes a video only when the ad has
-- `audio_enabled` AND the board's audio has been unlocked.
--
-- Images ignore the flag. Existing ads default to silent, matching today's
-- behaviour.

ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS audio_enabled boolean NOT NULL DEFAULT false;

-- get_school_board / get_screen_data both json_agg() the whole ads row, so the
-- new column reaches the client with no RPC change.

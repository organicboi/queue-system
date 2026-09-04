-- Ad placement: side rail vs. fullscreen-on-call.
--
-- Every display so far has only ever had one ad slot (a rail on the side of
-- the board). The hospital board's "now calling" moment is dead real-estate
-- for advertisers — a token is called, the flash card shows for 8s, then the
-- board just goes back to idle. This adds a second inventory: an ad marked
-- `fullscreen` is held out of the side rail and instead shown edge-to-edge
-- for 60s right after a call, then the board returns to normal automatically
-- (components/hospital/HospitalBoard.tsx). `side` (the default) keeps
-- today's behaviour for every existing ad.
--
-- get_hospital_board / get_school_board / get_screen_data all json_agg() the
-- whole ads row, so the new column reaches every client with no RPC change.

ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'side'
    CHECK (placement IN ('side', 'fullscreen'));

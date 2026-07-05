-- Counter online/offline presence indicators are being disabled by default —
-- they need more real-world testing before staff rely on them. Gate the
-- whole feature (heartbeat + presence display) behind a per-branch setting
-- that admins can opt into from Branch Settings.

ALTER TABLE branches ADD COLUMN IF NOT EXISTS counter_presence_enabled boolean NOT NULL DEFAULT false;

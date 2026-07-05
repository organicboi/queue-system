-- Lets kitchen staff mark themselves "not accepting orders" for a shift
-- without losing access to their own console — unlike is_active, which also
-- gates the counter token's page access (see getCounterByToken). Only
-- meaningful for kitchen-type counters: the bypass check
-- (hasActiveKitchenCounter) now requires is_active AND accepting_orders.

ALTER TABLE counters ADD COLUMN IF NOT EXISTS accepting_orders boolean NOT NULL DEFAULT true;

-- Adds the 'order' counter type: a token-gated device for taking walk-in
-- orders and issuing queue numbers, unifying order-taking into the same
-- counter model as billing/kitchen/delivery.

ALTER TABLE counters DROP CONSTRAINT IF EXISTS counters_type_check;
ALTER TABLE counters ADD CONSTRAINT counters_type_check
  CHECK (type IN ('order', 'billing', 'kitchen', 'delivery'));

-- Adds the 'call' counter type: a keypad-driven paging station. Staff type
-- any bill number (not necessarily already in the queue) and call it directly
-- to the display. Like the delivery counter, calling registers the bill as an
-- immediately-ready entry (skipping the kitchen stage) so it can be recalled
-- or completed.

ALTER TABLE counters DROP CONSTRAINT IF EXISTS counters_type_check;
ALTER TABLE counters ADD CONSTRAINT counters_type_check
  CHECK (type IN ('order', 'billing', 'kitchen', 'delivery', 'call'));

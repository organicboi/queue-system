-- Add kitchen_status to queue_entries so kitchen counter has its own lifecycle
-- independent of the main queue status field.
--
-- Flow: order desk creates entry (kitchen_status='pending')
--       kitchen marks 'preparing' (optional) then 'ready'
--       billing/delivery counter then calls/delivers the kitchen-ready entry

ALTER TABLE queue_entries
  ADD COLUMN IF NOT EXISTS kitchen_status text NOT NULL DEFAULT 'pending'
  CONSTRAINT queue_entries_kitchen_status_check
    CHECK (kitchen_status IN ('pending', 'preparing', 'ready'));

CREATE INDEX IF NOT EXISTS queue_entries_kitchen_status_idx
  ON queue_entries(branch_id, kitchen_status)
  WHERE status = 'waiting';

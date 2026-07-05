-- Kitchen going offline mid-service (last active kitchen counter deactivated,
-- deleted, or retyped) silently flips stranded pending/preparing orders to
-- 'ready' so they aren't stuck forever. That's a routing change a manager
-- should be able to see happened, distinct from a normal counter toggle —
-- so it gets its own activity log type instead of reusing an existing one.

ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_type_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_type_check
  CHECK (type IN ('joined','called','recalled','completed','cancelled','no-show','reset','paused','resumed','kitchen-bypassed'));

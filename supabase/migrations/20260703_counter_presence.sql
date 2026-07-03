-- Live presence for counters.
-- Mirrors the last_seen_at heartbeat pattern already used for screens, so
-- staff/admin can tell whether a counter page is actually open right now
-- versus just left active-but-unattended.

ALTER TABLE counters ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS counters_branch_last_seen_idx
  ON counters(branch_id, last_seen_at);

-- The original counters policy ("service role full access") was declared
-- with `using (true)` and no `TO` clause, so — despite its name — it
-- actually grants every role, including anon, full read/write access to
-- counter_token (the secret that authenticates counter call/recall/deliver
-- actions). Every legitimate read/write already goes through the
-- service-role client in server actions and the DAL, so lock this down.
DROP POLICY IF EXISTS "service role full access" ON counters;

CREATE POLICY "counters_service_role_only"
  ON counters FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Token-free presence lookup: lets a counter page show its sibling
-- counters' online/offline status without ever exposing counter_token or
-- customer_id to the browser. SECURITY DEFINER so it can read past RLS
-- while only ever returning the columns listed below.
CREATE OR REPLACE FUNCTION public.get_branch_counter_presence(p_branch_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(json_agg(row_to_json(c) ORDER BY c.created_at), '[]'::json)
  FROM (
    SELECT id, name, type, is_active, last_seen_at, created_at
    FROM counters
    WHERE branch_id = p_branch_id
  ) c;
$$;

REVOKE ALL ON FUNCTION public.get_branch_counter_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_branch_counter_presence(uuid) TO anon, authenticated;

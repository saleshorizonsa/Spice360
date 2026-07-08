-- Enforce append-only on period_control_log (audit trail must be immutable).
-- Drop the permissive policy and replace with SELECT + INSERT only.

DROP POLICY IF EXISTS authenticated_read_write ON public.period_control_log;

CREATE POLICY period_control_log_read ON public.period_control_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY period_control_log_insert ON public.period_control_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- No UPDATE or DELETE policy → those operations are rejected by RLS for all authenticated users.
-- Service-role (used by server-side migrations only) bypasses RLS and can still correct data.

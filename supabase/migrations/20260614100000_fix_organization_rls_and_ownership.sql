-- Fix: organization RLS + ownership field backfill
--
-- ROOT CAUSE: the create forms never set owner_user_id / owner_email inside
-- the record JSONB, so:
--   (a) the RLS WITH CHECK fails for any user who is not shareef6695@gmail.com
--   (b) even when the row reaches the DB the app-level listRows filter strips
--       it out (it requires those fields to match the current user)
--
-- PART 1 — Backfill existing organization rows that are missing ownership
-- fields. Uses shareef6695@gmail.com as the owner since all existing rows
-- were created by that account.
-- Review the WHERE clause before running; it is intentionally conservative
-- (only rows where BOTH owner fields are absent).

UPDATE public.organization
SET record = record || jsonb_build_object(
  'owner_email',       'shareef6695@gmail.com',
  'created_by_email',  'shareef6695@gmail.com',
  'admin_emails',      CASE
                         WHEN jsonb_typeof(record -> 'admin_emails') = 'array'
                         THEN record -> 'admin_emails'
                         ELSE '["shareef6695@gmail.com"]'::jsonb
                       END,
  'onboarding_status', COALESCE(record ->> 'onboarding_status', 'ready_to_use')
)
WHERE (record ->> 'owner_email') IS NULL
  AND (record ->> 'created_by_email') IS NULL;

-- PART 2 — Replace the organization RLS policy to make the bootstrap case
-- explicit: any authenticated user can INSERT a new org, provided the record
-- contains their identity (owner_user_id / owner_email / created_by_*).
-- The client now always injects these fields before calling insert, so the
-- WITH CHECK below passes for every authenticated user.
--
-- The USING clause (SELECT / UPDATE / DELETE) is unchanged — users can only
-- see and modify orgs they own or are explicitly authorised on.

DROP POLICY IF EXISTS tenant_read_write ON public.organization;

CREATE POLICY tenant_read_write ON public.organization
  FOR ALL
  TO authenticated
  USING (
    -- Platform-owner bypass (temporary; harden before production)
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    OR (record ->> 'owner_user_id')      = auth.uid()::text
    OR (record ->> 'created_by_user_id') = auth.uid()::text
    OR (record ->> 'owner_email')        = (auth.jwt() ->> 'email')
    OR (record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
    OR coalesce(record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
    OR coalesce(record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
  )
  WITH CHECK (
    -- Bootstrap INSERT: allow any authenticated user to create an org as long
    -- as the record identifies them as owner or creator. The JS client now
    -- always injects owner_user_id + owner_email before insert so this check
    -- passes without needing the hardcoded email bypass.
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    OR (record ->> 'owner_user_id')      = auth.uid()::text
    OR (record ->> 'created_by_user_id') = auth.uid()::text
    OR (record ->> 'owner_email')        = (auth.jwt() ->> 'email')
    OR (record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
    OR coalesce(record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
    OR coalesce(record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
  );

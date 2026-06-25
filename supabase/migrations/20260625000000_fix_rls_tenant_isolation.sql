-- =============================================================================
-- Migration: 20260625000000_fix_rls_tenant_isolation.sql
-- Phase 2 of the multi-tenant RLS audit (2026-06-25).
--
-- DO NOT AUTO-APPLY. Paste into the Supabase SQL Editor and review before
-- executing. The migration is idempotent: all DROP POLICY statements use
-- IF EXISTS, and ALTER TABLE uses IF NOT EXISTS.
--
-- Items addressed:
--   1. service_contract / service_contract_line / recurring_billing_run
--      — restore the org-membership check that migration 20260508143000 replaced
--        with a non-isolation `IS NOT NULL` check.
--   2. account / gl_account_mapping / journal_line / accounting_period
--      — add tenant_id, backfill, add proper tenant_read_write policy.
--   3. sl_epf_contribution / sl_apit_return / sl_wht_return / sl_sscl_return
--        / sl_vat_return
--      — replace open authenticated_read_write (true) with tenant_read_write.
--   4. sl_tax_configuration — TWO-POLICY SPLIT:
--      * global_seed_read (SELECT only): rows where organization_id IS NULL
--        remain visible to all authenticated users (the seeded country rates).
--      * tenant_read_write (ALL): rows where organization_id IS NOT NULL are
--        scoped to the owning tenant. Tenants cannot write rows with a null
--        organization_id (that is reserved for the platform owner).
--   5. cinnamon_grade — same TWO-POLICY SPLIT as #4 (seed grades are global;
--      tenant-created custom grades are isolated).
--   6. cinnamon_batch / cinnamon_process_step / cinnamon_grading_output
--        / cinnamon_packaging
--      — replace open authenticated_read_write (true) with tenant_read_write.
--
-- ── SECURITY ITEM #7 (NOT fixed here — intentionally deferred) ───────────────
-- Every policy created by this migration retains the hardcoded email bypass:
--   (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
-- This backdoor exists in all policies written by prior migrations (beginning
-- with 20260507143000). Removing it here without a tested replacement would
-- break the platform-owner's ability to operate the system. It MUST be replaced
-- by a proper role-based check — e.g. a dedicated `platform_admin` Postgres role
-- granted via Supabase's custom-claims JWT, or a separate `platform_admin`
-- lookup table — in a dedicated migration before multi-tenant production launch.
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- ITEM 1 — Restore tenant isolation for service billing tables.
--
-- Root cause: 20260508143000 replaced a correct org-join policy with:
--   USING (coalesce(tenant_id, organization_id) IS NOT NULL)
-- That check is NOT an ownership check. It lets any authenticated user read
-- every service contract in the database. The fix reinstates the EXISTS
-- sub-select against public.organization that all other tables use.
-- =============================================================================

-- service_contract
DROP POLICY IF EXISTS tenant_read_write ON public.service_contract;
CREATE POLICY tenant_read_write ON public.service_contract
  FOR ALL TO authenticated
  USING (
    -- SECURITY ITEM #7: hardcoded backdoor — replace with role check (see header)
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(service_contract.tenant_id, service_contract.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(service_contract.tenant_id, service_contract.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(service_contract.tenant_id, service_contract.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(service_contract.tenant_id, service_contract.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  );

-- service_contract_line
DROP POLICY IF EXISTS tenant_read_write ON public.service_contract_line;
CREATE POLICY tenant_read_write ON public.service_contract_line
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'  -- SECURITY ITEM #7
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(service_contract_line.tenant_id, service_contract_line.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(service_contract_line.tenant_id, service_contract_line.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(service_contract_line.tenant_id, service_contract_line.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(service_contract_line.tenant_id, service_contract_line.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  );

-- recurring_billing_run
DROP POLICY IF EXISTS tenant_read_write ON public.recurring_billing_run;
CREATE POLICY tenant_read_write ON public.recurring_billing_run
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'  -- SECURITY ITEM #7
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(recurring_billing_run.tenant_id, recurring_billing_run.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(recurring_billing_run.tenant_id, recurring_billing_run.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(recurring_billing_run.tenant_id, recurring_billing_run.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(recurring_billing_run.tenant_id, recurring_billing_run.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  );

-- =============================================================================
-- ITEM 2 — Finance tables: add tenant_id, backfill, add tenant isolation.
--
-- These four tables were created in 20260615120000 using the original migration-1
-- pattern (no tenant_id column, open authenticated_read_write policy). They hold
-- the most sensitive financial data in the system — journal lines (double-entry
-- bookkeeping), GL mappings, and accounting periods.
-- =============================================================================

-- Step 2a: Add tenant_id column (safe to run again — IF NOT EXISTS)
-- NOTE: chart_of_accounts is part of the original 108 entity tables and was
-- already hardened by migration 20260508110000 — no action needed there.
-- The table 'account' does not exist in this database (confirmed by diagnostic).
-- 'journal_entry' was discovered here and added to the list.
ALTER TABLE public.gl_account_mapping ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.journal_entry      ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.journal_line       ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.accounting_period  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Step 2b: Backfill tenant_id from organization_id for all existing rows
UPDATE public.gl_account_mapping
  SET tenant_id = organization_id
  WHERE tenant_id IS NULL AND organization_id IS NOT NULL;

UPDATE public.journal_entry
  SET tenant_id = organization_id
  WHERE tenant_id IS NULL AND organization_id IS NOT NULL;

UPDATE public.journal_line
  SET tenant_id = organization_id
  WHERE tenant_id IS NULL AND organization_id IS NOT NULL;

UPDATE public.accounting_period
  SET tenant_id = organization_id
  WHERE tenant_id IS NULL AND organization_id IS NOT NULL;

-- Step 2c: Add tenant_id indexes
CREATE INDEX IF NOT EXISTS gl_account_mapping_tenant_id_idx
  ON public.gl_account_mapping (tenant_id);
CREATE INDEX IF NOT EXISTS journal_entry_tenant_id_idx
  ON public.journal_entry (tenant_id);
CREATE INDEX IF NOT EXISTS journal_line_tenant_id_idx
  ON public.journal_line (tenant_id);
CREATE INDEX IF NOT EXISTS accounting_period_tenant_id_idx
  ON public.accounting_period (tenant_id);

-- Step 2d: Replace open policies with tenant isolation

-- gl_account_mapping
DROP POLICY IF EXISTS authenticated_read_write ON public.gl_account_mapping;
DROP POLICY IF EXISTS tenant_read_write         ON public.gl_account_mapping;
CREATE POLICY tenant_read_write ON public.gl_account_mapping
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'  -- SECURITY ITEM #7
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(gl_account_mapping.tenant_id, gl_account_mapping.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(gl_account_mapping.tenant_id, gl_account_mapping.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(gl_account_mapping.tenant_id, gl_account_mapping.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(gl_account_mapping.tenant_id, gl_account_mapping.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  );

-- journal_entry (CRITICAL: double-entry header records)
DROP POLICY IF EXISTS authenticated_read_write ON public.journal_entry;
DROP POLICY IF EXISTS tenant_read_write         ON public.journal_entry;
CREATE POLICY tenant_read_write ON public.journal_entry
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'  -- SECURITY ITEM #7
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(journal_entry.tenant_id, journal_entry.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(journal_entry.tenant_id, journal_entry.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(journal_entry.tenant_id, journal_entry.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(journal_entry.tenant_id, journal_entry.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  );

-- journal_line — CRITICAL: contains all double-entry line items
DROP POLICY IF EXISTS authenticated_read_write ON public.journal_line;
DROP POLICY IF EXISTS tenant_read_write         ON public.journal_line;
CREATE POLICY tenant_read_write ON public.journal_line
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'  -- SECURITY ITEM #7
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(journal_line.tenant_id, journal_line.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(journal_line.tenant_id, journal_line.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(journal_line.tenant_id, journal_line.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(journal_line.tenant_id, journal_line.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  );

-- accounting_period
DROP POLICY IF EXISTS authenticated_read_write ON public.accounting_period;
DROP POLICY IF EXISTS tenant_read_write         ON public.accounting_period;
CREATE POLICY tenant_read_write ON public.accounting_period
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'  -- SECURITY ITEM #7
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(accounting_period.tenant_id, accounting_period.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(accounting_period.tenant_id, accounting_period.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(accounting_period.tenant_id, accounting_period.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(accounting_period.tenant_id, accounting_period.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  );

-- =============================================================================
-- ITEM 3 — SL tax return tables: replace open policy with tenant isolation.
--
-- These five tables contain per-tenant statutory filings (payroll contributions,
-- income tax, withholding tax, SSCL, VAT returns). A DO loop is used because
-- all five tables get identical policy logic.
--
-- NOTE: sl_tax_configuration gets the two-policy split in Item 4 below.
-- =============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sl_epf_contribution',
    'sl_apit_return',
    'sl_wht_return',
    'sl_sscl_return',
    'sl_vat_return'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_read_write ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_read_write ON public.%I', t);
    -- %1$I = positional parameter 1, formatted as a quoted identifier.
    -- Using positional specifier so the single argument `t` satisfies all
    -- occurrences without repeating it.
    EXECUTE format(
      'CREATE POLICY tenant_read_write ON public.%1$I
         FOR ALL TO authenticated
         USING (
           (auth.jwt() ->> ''email'') = ''shareef6695@gmail.com''
           OR (
             public.matrixsales_auth_email_verified()
             AND coalesce(%1$I.tenant_id, %1$I.organization_id) IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM public.organization org
               WHERE org.id = coalesce(%1$I.tenant_id, %1$I.organization_id)
                 AND (
                   (org.record ->> ''owner_user_id'')       = auth.uid()::text
                   OR (org.record ->> ''created_by_user_id'') = auth.uid()::text
                   OR (org.record ->> ''owner_email'')        = (auth.jwt() ->> ''email'')
                   OR (org.record ->> ''created_by_email'')   = (auth.jwt() ->> ''email'')
                   OR coalesce(org.record -> ''authorized_user_ids'', ''[]''::jsonb) ? auth.uid()::text
                   OR coalesce(org.record -> ''admin_emails'',        ''[]''::jsonb) ? (auth.jwt() ->> ''email'')
                 )
             )
           )
         )
         WITH CHECK (
           (auth.jwt() ->> ''email'') = ''shareef6695@gmail.com''
           OR (
             public.matrixsales_auth_email_verified()
             AND coalesce(%1$I.tenant_id, %1$I.organization_id) IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM public.organization org
               WHERE org.id = coalesce(%1$I.tenant_id, %1$I.organization_id)
                 AND (
                   (org.record ->> ''owner_user_id'')       = auth.uid()::text
                   OR (org.record ->> ''created_by_user_id'') = auth.uid()::text
                   OR (org.record ->> ''owner_email'')        = (auth.jwt() ->> ''email'')
                   OR (org.record ->> ''created_by_email'')   = (auth.jwt() ->> ''email'')
                   OR coalesce(org.record -> ''authorized_user_ids'', ''[]''::jsonb) ? auth.uid()::text
                   OR coalesce(org.record -> ''admin_emails'',        ''[]''::jsonb) ? (auth.jwt() ->> ''email'')
                 )
             )
           )
         )',
      t
    );
  END LOOP;
END;
$$;

-- =============================================================================
-- ITEM 4 — sl_tax_configuration: TWO-POLICY SPLIT.
--
-- GLOBAL vs TENANT row distinction:
--   organization_id IS NULL  → global seed row (country-level defaults).
--                              Readable by all authenticated users.
--                              Only the platform owner can write these.
--   organization_id IS NOT NULL → tenant-created row (custom overrides).
--                              Readable and writable only by the owning tenant.
--
-- Why this matters for useTaxConfig():
--   The hook calls SLTaxConfiguration.list() with no org filter. With this
--   policy in place, a tenant sees: (a) the global seed row (org IS NULL) via
--   global_seed_read, and (b) their own custom config row (if any) via
--   tenant_read_write. They never see another tenant's custom config row.
--   The hook's FALLBACK (vat_standard_rate: 18) is still the ultimate safety
--   net if no row is visible.
-- =============================================================================

-- Drop all existing policies on sl_tax_configuration
DROP POLICY IF EXISTS authenticated_read_write ON public.sl_tax_configuration;
DROP POLICY IF EXISTS global_seed_read         ON public.sl_tax_configuration;
DROP POLICY IF EXISTS tenant_read_write        ON public.sl_tax_configuration;

-- Policy 1: global seed rows are readable by all authenticated users (SELECT only).
-- These are rows inserted without an organization_id (platform seed data).
CREATE POLICY global_seed_read ON public.sl_tax_configuration
  FOR SELECT TO authenticated
  USING (organization_id IS NULL);

-- Policy 2: tenant-owned rows (organization_id IS NOT NULL) are scoped to the
-- owning tenant for all operations. The WITH CHECK also enforces that new
-- tenant-created rows must carry a non-null organization_id — a tenant cannot
-- create a new "global" (null org) row.
CREATE POLICY tenant_read_write ON public.sl_tax_configuration
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'  -- SECURITY ITEM #7
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(sl_tax_configuration.tenant_id, sl_tax_configuration.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(sl_tax_configuration.tenant_id, sl_tax_configuration.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  )
  WITH CHECK (
    -- Platform owner can write global seed rows (null org) or tenant rows.
    -- Regular tenants can only write rows that carry their own org id.
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(sl_tax_configuration.tenant_id, sl_tax_configuration.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(sl_tax_configuration.tenant_id, sl_tax_configuration.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  );

-- =============================================================================
-- ITEM 5 — cinnamon_grade: TWO-POLICY SPLIT.
--
-- GLOBAL vs TENANT row distinction (identical logic to sl_tax_configuration):
--   organization_id IS NULL  → platform seed grades (ALBA, C5, C4 etc.).
--                              Readable by all authenticated users (SELECT only).
--                              Only the platform owner can INSERT/UPDATE/DELETE.
--   organization_id IS NOT NULL → tenant-created custom grades.
--                              Readable and writable only by the owning tenant.
--
-- The 15 seed rows inserted in migration 20260610000000 all have
-- organization_id = NULL, so they remain globally visible after this change.
-- =============================================================================

-- Drop all existing policies on cinnamon_grade
DROP POLICY IF EXISTS authenticated_read_write ON public.cinnamon_grade;
DROP POLICY IF EXISTS global_seed_read         ON public.cinnamon_grade;
DROP POLICY IF EXISTS tenant_read_write        ON public.cinnamon_grade;

-- Policy 1: global seed grades — readable by all authenticated users (SELECT only)
CREATE POLICY global_seed_read ON public.cinnamon_grade
  FOR SELECT TO authenticated
  USING (organization_id IS NULL);

-- Policy 2: tenant-created custom grades are fully isolated
CREATE POLICY tenant_read_write ON public.cinnamon_grade
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'  -- SECURITY ITEM #7
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(cinnamon_grade.tenant_id, cinnamon_grade.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(cinnamon_grade.tenant_id, cinnamon_grade.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    OR (
      public.matrixsales_auth_email_verified()
      AND coalesce(cinnamon_grade.tenant_id, cinnamon_grade.organization_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization org
        WHERE org.id = coalesce(cinnamon_grade.tenant_id, cinnamon_grade.organization_id)
          AND (
            (org.record ->> 'owner_user_id')       = auth.uid()::text
            OR (org.record ->> 'created_by_user_id') = auth.uid()::text
            OR (org.record ->> 'owner_email')        = (auth.jwt() ->> 'email')
            OR (org.record ->> 'created_by_email')   = (auth.jwt() ->> 'email')
            OR coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
            OR coalesce(org.record -> 'admin_emails',        '[]'::jsonb) ? (auth.jwt() ->> 'email')
          )
      )
    )
  );

-- =============================================================================
-- ITEM 6 — Cinnamon processing tables: replace open policy with tenant isolation.
--
-- These four tables hold per-batch processing records specific to each tenant's
-- cinnamon operations. They should never be visible across tenant boundaries.
-- A DO loop is used because all four tables get identical policy logic.
-- =============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cinnamon_batch',
    'cinnamon_process_step',
    'cinnamon_grading_output',
    'cinnamon_packaging'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_read_write ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_read_write ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_read_write ON public.%1$I
         FOR ALL TO authenticated
         USING (
           (auth.jwt() ->> ''email'') = ''shareef6695@gmail.com''
           OR (
             public.matrixsales_auth_email_verified()
             AND coalesce(%1$I.tenant_id, %1$I.organization_id) IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM public.organization org
               WHERE org.id = coalesce(%1$I.tenant_id, %1$I.organization_id)
                 AND (
                   (org.record ->> ''owner_user_id'')       = auth.uid()::text
                   OR (org.record ->> ''created_by_user_id'') = auth.uid()::text
                   OR (org.record ->> ''owner_email'')        = (auth.jwt() ->> ''email'')
                   OR (org.record ->> ''created_by_email'')   = (auth.jwt() ->> ''email'')
                   OR coalesce(org.record -> ''authorized_user_ids'', ''[]''::jsonb) ? auth.uid()::text
                   OR coalesce(org.record -> ''admin_emails'',        ''[]''::jsonb) ? (auth.jwt() ->> ''email'')
                 )
             )
           )
         )
         WITH CHECK (
           (auth.jwt() ->> ''email'') = ''shareef6695@gmail.com''
           OR (
             public.matrixsales_auth_email_verified()
             AND coalesce(%1$I.tenant_id, %1$I.organization_id) IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM public.organization org
               WHERE org.id = coalesce(%1$I.tenant_id, %1$I.organization_id)
                 AND (
                   (org.record ->> ''owner_user_id'')       = auth.uid()::text
                   OR (org.record ->> ''created_by_user_id'') = auth.uid()::text
                   OR (org.record ->> ''owner_email'')        = (auth.jwt() ->> ''email'')
                   OR (org.record ->> ''created_by_email'')   = (auth.jwt() ->> ''email'')
                   OR coalesce(org.record -> ''authorized_user_ids'', ''[]''::jsonb) ? auth.uid()::text
                   OR coalesce(org.record -> ''admin_emails'',        ''[]''::jsonb) ? (auth.jwt() ->> ''email'')
                 )
             )
           )
         )',
      t
    );
  END LOOP;
END;
$$;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

-- =============================================================================
-- ROLLBACK (commented out — uncomment and run if you need to revert)
--
-- WARNING: rolling back restores the open policies. Do not run in production
-- once real tenant data exists, as it will re-expose all data cross-tenant.
-- =============================================================================
/*
-- Item 1 rollback
DROP POLICY IF EXISTS tenant_read_write ON public.service_contract;
CREATE POLICY tenant_read_write ON public.service_contract FOR ALL TO authenticated
  USING (coalesce(tenant_id, organization_id) IS NOT NULL)
  WITH CHECK (coalesce(tenant_id, organization_id) IS NOT NULL);

DROP POLICY IF EXISTS tenant_read_write ON public.service_contract_line;
CREATE POLICY tenant_read_write ON public.service_contract_line FOR ALL TO authenticated
  USING (coalesce(tenant_id, organization_id) IS NOT NULL)
  WITH CHECK (coalesce(tenant_id, organization_id) IS NOT NULL);

DROP POLICY IF EXISTS tenant_read_write ON public.recurring_billing_run;
CREATE POLICY tenant_read_write ON public.recurring_billing_run FOR ALL TO authenticated
  USING (coalesce(tenant_id, organization_id) IS NOT NULL)
  WITH CHECK (coalesce(tenant_id, organization_id) IS NOT NULL);

-- Items 2, 3, 4, 5, 6 rollback
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'account', 'gl_account_mapping', 'journal_line', 'accounting_period',
    'sl_epf_contribution', 'sl_apit_return', 'sl_wht_return', 'sl_sscl_return',
    'sl_vat_return', 'sl_tax_configuration', 'cinnamon_grade',
    'cinnamon_batch', 'cinnamon_process_step', 'cinnamon_grading_output',
    'cinnamon_packaging'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_read_write ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS global_seed_read  ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY authenticated_read_write ON public.%1$I
         FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END;
$$;
*/

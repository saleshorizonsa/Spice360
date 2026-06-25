-- SAP OB52-style period control: per-area (GL/AR/AP/Inventory/Assets) open intervals
-- April-March fiscal year: period 1=April … 12=March, special 13-16 for year-end
--
-- REVIEW BEFORE APPLYING. Do not auto-apply.
-- Replace hardcoded email 'shareef6695@gmail.com' with a platform-admin role check before production.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. period_control: one row per (organization_id, fiscal_year, area)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.period_control (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    tenant_id       uuid,
    fiscal_year     text NOT NULL,        -- e.g. '2025-26'
    area            text NOT NULL,        -- 'gl' | 'ar' | 'ap' | 'inventory' | 'assets'
    -- Interval 1: currently active range (new transactions)
    current_from    integer,              -- fiscal period 1-16; NULL = nothing open
    current_to      integer,
    -- Interval 2: prior-period adjustment range (NULL = prior posting not allowed)
    prior_from      integer,
    prior_to        integer,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      text,

    CONSTRAINT period_control_unique      UNIQUE (organization_id, fiscal_year, area),
    CONSTRAINT period_control_area_check  CHECK (area IN ('gl','ar','ap','inventory','assets')),
    CONSTRAINT period_control_current_ok  CHECK (
        current_from IS NULL OR
        (current_from >= 1 AND current_to IS NOT NULL AND current_to >= current_from AND current_to <= 16)
    ),
    CONSTRAINT period_control_prior_ok    CHECK (
        prior_from IS NULL OR
        (prior_from >= 1 AND prior_to IS NOT NULL AND prior_to >= prior_from AND prior_to <= 16)
    )
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. period_control_log: immutable audit trail for every open/close action
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.period_control_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    tenant_id       uuid,
    fiscal_year     text NOT NULL,
    area            text NOT NULL,
    interval_slot   text NOT NULL,        -- 'current' | 'prior'
    action          text NOT NULL,        -- 'open' | 'close' | 'shift'
    prev_from       integer,              -- value before the change (NULL = was not set)
    prev_to         integer,
    new_from        integer,              -- value after the change (NULL = closed/cleared)
    new_to          integer,
    reason          text NOT NULL,
    performed_by    text NOT NULL,
    performed_at    timestamptz NOT NULL DEFAULT now()
);

-- Prevent any UPDATE/DELETE on the log (append-only)
CREATE OR REPLACE RULE period_control_log_no_update AS
    ON UPDATE TO public.period_control_log DO INSTEAD NOTHING;

CREATE OR REPLACE RULE period_control_log_no_delete AS
    ON DELETE TO public.period_control_log DO INSTEAD NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. auto-update updated_at on period_control
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_period_control_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_period_control_updated_at ON public.period_control;
CREATE TRIGGER trg_period_control_updated_at
    BEFORE UPDATE ON public.period_control
    FOR EACH ROW EXECUTE FUNCTION public.set_period_control_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Row-Level Security
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.period_control     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_control_log ENABLE ROW LEVEL SECURITY;

-- period_control: org members can read; writes are enforced at app level
-- (replace 'shareef6695@gmail.com' backdoor with platform-admin role before prod)
CREATE POLICY "period_control_tenant_read" ON public.period_control
    FOR SELECT USING (
        auth.email() = 'shareef6695@gmail.com'
        OR organization_id IN (
            SELECT id FROM public.organizations
            WHERE tenant_id = (
                SELECT tenant_id FROM public.organizations
                WHERE id = period_control.organization_id
                LIMIT 1
            )
        )
    );

CREATE POLICY "period_control_tenant_write" ON public.period_control
    FOR ALL USING (
        auth.email() = 'shareef6695@gmail.com'
        OR organization_id IN (
            SELECT id FROM public.organizations
            WHERE tenant_id = (
                SELECT tenant_id FROM public.organizations
                WHERE id = period_control.organization_id
                LIMIT 1
            )
        )
    );

CREATE POLICY "period_control_log_tenant_read" ON public.period_control_log
    FOR SELECT USING (
        auth.email() = 'shareef6695@gmail.com'
        OR organization_id IN (
            SELECT id FROM public.organizations
            WHERE tenant_id = (
                SELECT tenant_id FROM public.organizations
                WHERE id = period_control_log.organization_id
                LIMIT 1
            )
        )
    );

CREATE POLICY "period_control_log_tenant_insert" ON public.period_control_log
    FOR INSERT WITH CHECK (
        auth.email() = 'shareef6695@gmail.com'
        OR organization_id IN (
            SELECT id FROM public.organizations
            WHERE tenant_id = (
                SELECT tenant_id FROM public.organizations
                WHERE id = period_control_log.organization_id
                LIMIT 1
            )
        )
    );

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Indexes
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_period_control_org_fy
    ON public.period_control (organization_id, fiscal_year);

CREATE INDEX IF NOT EXISTS idx_period_control_log_org_fy
    ON public.period_control_log (organization_id, fiscal_year, performed_at DESC);

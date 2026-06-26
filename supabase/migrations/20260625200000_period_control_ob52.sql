-- SAP OB52-style period control: per-area (GL/AR/AP/Inventory/Assets) open intervals
-- April-March fiscal year: period 1=April ... 12=March, special 13-16 for year-end
-- Follows the matrixSalesClient entity pattern: all fields stored in record JSONB.

-- ── period_control ──────────────────────────────────────────────────────────
-- One row per (organization_id, fiscal_year, area).
-- Fields in record: fiscal_year, area, current_from, current_to,
--                   prior_from, prior_to, updated_by_email
CREATE TABLE IF NOT EXISTS public.period_control (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base44_id        text UNIQUE,
  tenant_id        uuid,
  organization_id  uuid,
  organization_key text,
  record           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status           text GENERATED ALWAYS AS (record ->> 'status') STORED,
  created_by       uuid,
  updated_by       uuid,
  source           text NOT NULL DEFAULT 'matrixsales',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Enforce one row per org + fiscal_year + area
CREATE UNIQUE INDEX IF NOT EXISTS period_control_org_fy_area_idx
  ON public.period_control (organization_id, (record ->> 'fiscal_year'), (record ->> 'area'));

CREATE INDEX IF NOT EXISTS period_control_record_gin_idx
  ON public.period_control USING gin (record);
CREATE INDEX IF NOT EXISTS period_control_org_id_idx
  ON public.period_control (organization_id);
CREATE INDEX IF NOT EXISTS period_control_org_key_idx
  ON public.period_control (organization_key);

CREATE OR REPLACE TRIGGER set_period_control_updated_at
  BEFORE UPDATE ON public.period_control
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.period_control ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'period_control'
    AND policyname = 'authenticated_read_write'
  ) THEN
    CREATE POLICY authenticated_read_write ON public.period_control
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── period_control_log ──────────────────────────────────────────────────────
-- Immutable audit trail. Fields in record: fiscal_year, area, interval_slot,
-- action, prev_from, prev_to, new_from, new_to, reason, performed_by, performed_at
CREATE TABLE IF NOT EXISTS public.period_control_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base44_id        text UNIQUE,
  tenant_id        uuid,
  organization_id  uuid,
  organization_key text,
  record           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status           text GENERATED ALWAYS AS (record ->> 'status') STORED,
  created_by       uuid,
  updated_by       uuid,
  source           text NOT NULL DEFAULT 'matrixsales',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS period_control_log_record_gin_idx
  ON public.period_control_log USING gin (record);
CREATE INDEX IF NOT EXISTS period_control_log_org_id_idx
  ON public.period_control_log (organization_id);
CREATE INDEX IF NOT EXISTS period_control_log_org_key_idx
  ON public.period_control_log (organization_key);

CREATE OR REPLACE TRIGGER set_period_control_log_updated_at
  BEFORE UPDATE ON public.period_control_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.period_control_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'period_control_log'
    AND policyname = 'authenticated_read_write'
  ) THEN
    CREATE POLICY authenticated_read_write ON public.period_control_log
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

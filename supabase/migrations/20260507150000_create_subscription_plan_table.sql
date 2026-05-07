-- Owner-managed subscription plans used by the public landing page,
-- signup flow, tenant onboarding, and subscription guards.

create extension if not exists pgcrypto;

create table if not exists public.subscription_plan (
  id uuid primary key default gen_random_uuid(),
  base44_id text unique,
  tenant_id uuid,
  organization_id uuid,
  organization_key text,
  record jsonb not null default '{}'::jsonb,
  status text generated always as (record ->> 'status') stored,
  created_by uuid,
  updated_by uuid,
  source text not null default 'matrixsales',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_plan_record_gin_idx on public.subscription_plan using gin (record);
create index if not exists subscription_plan_status_idx on public.subscription_plan (status);
create index if not exists subscription_plan_display_order_idx on public.subscription_plan (((record ->> 'display_order')::int));
create index if not exists subscription_plan_plan_id_idx on public.subscription_plan ((record ->> 'plan_id'));

alter table public.subscription_plan enable row level security;

drop policy if exists public_read_active_subscription_plans on public.subscription_plan;
create policy public_read_active_subscription_plans
  on public.subscription_plan
  for select
  to anon, authenticated
  using (coalesce(record ->> 'status', 'active') = 'active');

drop policy if exists owner_manage_subscription_plans on public.subscription_plan;
create policy owner_manage_subscription_plans
  on public.subscription_plan
  for all
  to authenticated
  using (lower(auth.jwt() ->> 'email') = 'shareef6695@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'shareef6695@gmail.com');

drop trigger if exists set_subscription_plan_updated_at on public.subscription_plan;
create trigger set_subscription_plan_updated_at
  before update on public.subscription_plan
  for each row execute function public.set_updated_at();

insert into public.matrix_entity_table_map (entity_name, table_name)
values ('SubscriptionPlan', 'subscription_plan')
on conflict (entity_name) do update
  set table_name = excluded.table_name;

insert into public.subscription_plan (base44_id, record)
values
  (
    'starter',
    '{
      "plan_id": "starter",
      "plan_name": "Starter",
      "monthly_price": 299,
      "currency": "SAR",
      "billing_cycle": "monthly",
      "trial_days": 14,
      "user_limit": 5,
      "invoice_limit": 500,
      "support_level": "Email support",
      "modules": ["Sales", "Inventory", "Finance", "ZATCA"],
      "limits": { "users": 5, "invoices_per_month": 500, "tenants": 1 },
      "display_order": 1,
      "status": "active"
    }'::jsonb
  ),
  (
    'professional',
    '{
      "plan_id": "professional",
      "plan_name": "Professional",
      "monthly_price": 799,
      "currency": "SAR",
      "billing_cycle": "monthly",
      "trial_days": 14,
      "user_limit": 25,
      "invoice_limit": 5000,
      "support_level": "Priority support",
      "modules": ["Sales", "Inventory", "Finance", "Purchasing", "HR", "Projects", "ZATCA", "Reports"],
      "limits": { "users": 25, "invoices_per_month": 5000, "tenants": 1 },
      "display_order": 2,
      "status": "active"
    }'::jsonb
  ),
  (
    'enterprise',
    '{
      "plan_id": "enterprise",
      "plan_name": "Enterprise",
      "monthly_price": null,
      "currency": "SAR",
      "billing_cycle": "custom",
      "trial_days": 30,
      "user_limit": "Unlimited",
      "invoice_limit": "Custom",
      "support_level": "Dedicated success manager",
      "modules": ["All modules", "Advanced reports", "Owner controls", "Integrations"],
      "limits": { "users": 999999, "invoices_per_month": 999999, "tenants": 1 },
      "display_order": 3,
      "status": "active"
    }'::jsonb
  )
on conflict (base44_id) do update
  set record = excluded.record,
      updated_at = now();

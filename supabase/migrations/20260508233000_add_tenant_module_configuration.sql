alter table public.organization
  add column if not exists business_type text default 'it_services',
  add column if not exists tenant_modules jsonb default '{}'::jsonb,
  add column if not exists module_config jsonb default '{}'::jsonb,
  add column if not exists product_positioning text default 'zatca_recurring_billing_for_saudi_it_services';

create table if not exists public.tenant_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  organization_id uuid,
  business_type text not null default 'it_services',
  modules jsonb not null default '{}'::jsonb,
  source text not null default 'tenant_admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_tenant_modules_tenant
  on public.tenant_modules(tenant_id);

create index if not exists idx_tenant_modules_business_type
  on public.tenant_modules(business_type);

create or replace function public.touch_tenant_modules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tenant_modules_updated_at on public.tenant_modules;
create trigger trg_tenant_modules_updated_at
before update on public.tenant_modules
for each row
execute function public.touch_tenant_modules_updated_at();

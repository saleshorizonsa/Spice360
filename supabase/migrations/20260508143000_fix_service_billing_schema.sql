-- Fix service billing tables for MatrixSales/Base44-compatible entity writes.

alter table if exists public.service_contract
  add column if not exists base44_id text;

alter table if exists public.service_contract_line
  add column if not exists base44_id text;

alter table if exists public.recurring_billing_run
  add column if not exists base44_id text;

create unique index if not exists service_contract_base44_id_uidx
  on public.service_contract (base44_id)
  where base44_id is not null;

create unique index if not exists service_contract_line_base44_id_uidx
  on public.service_contract_line (base44_id)
  where base44_id is not null;

create unique index if not exists recurring_billing_run_base44_id_uidx
  on public.recurring_billing_run (base44_id)
  where base44_id is not null;

alter table public.service_contract enable row level security;
alter table public.service_contract_line enable row level security;
alter table public.recurring_billing_run enable row level security;

drop policy if exists tenant_read_write on public.service_contract;
drop policy if exists tenant_read_write on public.service_contract_line;
drop policy if exists tenant_read_write on public.recurring_billing_run;

create policy tenant_read_write on public.service_contract
for all
to authenticated
using (coalesce(tenant_id, organization_id) is not null)
with check (coalesce(tenant_id, organization_id) is not null);

create policy tenant_read_write on public.service_contract_line
for all
to authenticated
using (coalesce(tenant_id, organization_id) is not null)
with check (coalesce(tenant_id, organization_id) is not null);

create policy tenant_read_write on public.recurring_billing_run
for all
to authenticated
using (coalesce(tenant_id, organization_id) is not null)
with check (coalesce(tenant_id, organization_id) is not null);

insert into public.matrix_entity_table_map (entity_name, table_name)
values
  ('ServiceContract', 'service_contract'),
  ('ServiceContractLine', 'service_contract_line'),
  ('RecurringBillingRun', 'recurring_billing_run')
on conflict (entity_name) do update
  set table_name = excluded.table_name;

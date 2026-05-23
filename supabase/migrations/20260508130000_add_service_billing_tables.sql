-- Service-company recurring billing support.

create extension if not exists pgcrypto;

create table if not exists public.service_contract (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
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

create table if not exists public.service_contract_line (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
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

create table if not exists public.recurring_billing_run (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
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

create index if not exists service_contract_tenant_id_idx on public.service_contract (tenant_id);
create index if not exists service_contract_org_id_idx on public.service_contract (organization_id);
create index if not exists service_contract_record_gin_idx on public.service_contract using gin (record);
create index if not exists service_contract_next_billing_idx on public.service_contract ((record ->> 'next_billing_date'));
create index if not exists service_contract_contract_number_idx on public.service_contract ((record ->> 'contract_number'));

create index if not exists service_contract_line_tenant_id_idx on public.service_contract_line (tenant_id);
create index if not exists service_contract_line_org_id_idx on public.service_contract_line (organization_id);
create index if not exists recurring_billing_run_tenant_id_idx on public.recurring_billing_run (tenant_id);
create index if not exists recurring_billing_run_org_id_idx on public.recurring_billing_run (organization_id);

alter table public.service_contract enable row level security;
alter table public.service_contract_line enable row level security;
alter table public.recurring_billing_run enable row level security;

insert into public.matrix_entity_table_map (entity_name, table_name)
values
  ('ServiceContract', 'service_contract'),
  ('ServiceContractLine', 'service_contract_line'),
  ('RecurringBillingRun', 'recurring_billing_run')
on conflict (entity_name) do update
  set table_name = excluded.table_name;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['service_contract', 'service_contract_line', 'recurring_billing_run'] loop
    execute format('drop policy if exists tenant_read_write on public.%I', target_table);
    execute format(
      'create policy tenant_read_write on public.%I
        for all
        to authenticated
        using (
          public.matrixsales_auth_email_verified()
          and coalesce(tenant_id, organization_id) is not null
          and exists (
            select 1
            from public.organization org
            where org.id = coalesce(%I.tenant_id, %I.organization_id)
              and (
                (org.record ->> ''owner_user_id'') = auth.uid()::text
                or (org.record ->> ''created_by_user_id'') = auth.uid()::text
                or (org.record ->> ''owner_email'') = (auth.jwt() ->> ''email'')
                or (org.record ->> ''created_by_email'') = (auth.jwt() ->> ''email'')
                or coalesce(org.record -> ''authorized_user_ids'', ''[]''::jsonb) ? auth.uid()::text
                or coalesce(org.record -> ''admin_emails'', ''[]''::jsonb) ? (auth.jwt() ->> ''email'')
              )
          )
        )
        with check (
          public.matrixsales_auth_email_verified()
          and coalesce(tenant_id, organization_id) is not null
          and exists (
            select 1
            from public.organization org
            where org.id = coalesce(%I.tenant_id, %I.organization_id)
              and (
                (org.record ->> ''owner_user_id'') = auth.uid()::text
                or (org.record ->> ''created_by_user_id'') = auth.uid()::text
                or (org.record ->> ''owner_email'') = (auth.jwt() ->> ''email'')
                or (org.record ->> ''created_by_email'') = (auth.jwt() ->> ''email'')
                or coalesce(org.record -> ''authorized_user_ids'', ''[]''::jsonb) ? auth.uid()::text
                or coalesce(org.record -> ''admin_emails'', ''[]''::jsonb) ? (auth.jwt() ->> ''email'')
              )
          )
        )',
      target_table,
      target_table,
      target_table,
      target_table,
      target_table
    );

    execute format('drop trigger if exists %I on public.%I', 'set_' || target_table || '_updated_at', target_table);
    execute format(
      'create trigger %I
        before update on public.%I
        for each row execute function public.set_updated_at()',
      'set_' || target_table || '_updated_at',
      target_table
    );
  end loop;
end;
$$;

-- Sri Lanka Country-Specific Taxation Tables
-- Covers: EPF, ETF, APIT, WHT, SSCL, VAT (SL)

create extension if not exists pgcrypto;

do $$
declare
  sl_tables text[][] := array[
    array['SLEPFContribution',   'sl_epf_contribution'],
    array['SLAPITReturn',        'sl_apit_return'],
    array['SLWHTReturn',         'sl_wht_return'],
    array['SLSSCLReturn',        'sl_sscl_return'],
    array['SLVATReturn',         'sl_vat_return'],
    array['SLTaxConfiguration',  'sl_tax_configuration']
  ];
  item text[];
  policy_exists boolean;
begin
  foreach item slice 1 in array sl_tables loop
    execute format('create table if not exists public.%I (
      id uuid primary key default gen_random_uuid(),
      external_id text unique,
      tenant_id uuid,
      organization_id uuid,
      organization_key text,
      record jsonb not null default ''{}''::jsonb,
      status text generated always as (record->>''status'') stored,
      created_by uuid,
      updated_by uuid,
      source text not null default ''matrixsales'',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )', item[2]);

    execute format('create index if not exists %I on public.%I using gin (record)', item[2]||'_record_gin_idx', item[2]);
    execute format('create index if not exists %I on public.%I (organization_id)', item[2]||'_organization_id_idx', item[2]);
    execute format('create index if not exists %I on public.%I (tenant_id)', item[2]||'_tenant_id_idx', item[2]);
    execute format('create index if not exists %I on public.%I (status)', item[2]||'_status_idx', item[2]);
    execute format('create index if not exists %I on public.%I (created_at desc)', item[2]||'_created_at_idx', item[2]);
    execute format('alter table public.%I enable row level security', item[2]);

    select exists(
      select 1 from pg_policies
      where schemaname='public' and tablename=item[2] and policyname='authenticated_read_write'
    ) into policy_exists;

    if not policy_exists then
      execute format('create policy authenticated_read_write on public.%I
        for all to authenticated using (true) with check (true)', item[2]);
    end if;

    execute format('drop trigger if exists %I on public.%I',
      'set_'||item[2]||'_updated_at', item[2]);
    execute format('create trigger %I before update on public.%I
      for each row execute function public.set_updated_at()',
      'set_'||item[2]||'_updated_at', item[2]);

    insert into public.matrix_entity_table_map (entity_name, table_name)
    values (item[1], item[2])
    on conflict (entity_name) do update set table_name=excluded.table_name;
  end loop;
end;
$$;

-- Seed default Sri Lanka tax configuration
insert into public.sl_tax_configuration (record) values (
  '{
    "config_name": "Sri Lanka Standard Tax Configuration",
    "effective_date": "2024-01-01",
    "country": "LK",
    "currency": "LKR",
    "vat_standard_rate": 18,
    "vat_zero_rate": 0,
    "vat_registration_threshold_annual": 80000000,
    "vat_registration_threshold_quarterly": 20000000,
    "sscl_rate": 2.5,
    "sscl_threshold_quarterly": 120000000,
    "epf_employee_rate": 8,
    "epf_employer_rate": 12,
    "etf_employer_rate": 3,
    "wht_dividends": 14,
    "wht_interest": 14,
    "wht_rent": 14,
    "wht_service_fees": 14,
    "wht_service_fee_threshold_monthly": 50000,
    "wht_commissions": 5,
    "wht_construction": 2.5,
    "apit_brackets": [
      {"from": 0,       "to": 1200000,  "rate": 0,  "tax_on_lower": 0},
      {"from": 1200000, "to": 1800000,  "rate": 6,  "tax_on_lower": 0},
      {"from": 1800000, "to": 3000000,  "rate": 12, "tax_on_lower": 36000},
      {"from": 3000000, "to": 4200000,  "rate": 18, "tax_on_lower": 180000},
      {"from": 4200000, "to": 6000000,  "rate": 24, "tax_on_lower": 396000},
      {"from": 6000000, "to": 999999999,"rate": 36, "tax_on_lower": 828000}
    ],
    "corporate_tax_standard": 30,
    "corporate_tax_sme": 14,
    "corporate_tax_sme_threshold": 500000000,
    "status": "active"
  }'::jsonb
) on conflict do nothing;

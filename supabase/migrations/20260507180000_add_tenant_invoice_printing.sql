-- Tenant-scoped invoice printing, PDF, and share metadata.
-- Records follow the MatrixSales entity-table pattern: tenant_id/organization_id
-- columns plus flexible JSONB record payloads protected by tenant RLS.

create extension if not exists pgcrypto;

do $$
declare
  entity_tables text[][] := array[
    array['TenantPrintingPreferences', 'tenant_printing_preferences'],
    array['TenantInvoiceTemplates', 'tenant_invoice_templates'],
    array['TenantLogoAssets', 'tenant_logo_assets'],
    array['GeneratedInvoicePdfs', 'generated_invoice_pdfs'],
    array['InvoiceShareLinks', 'invoice_share_links'],
    array['InvoiceShareLogs', 'invoice_share_logs']
  ];
  item text[];
begin
  foreach item slice 1 in array entity_tables loop
    execute format(
      'create table if not exists public.%I (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null,
        organization_id uuid not null,
        organization_key text,
        record jsonb not null default ''{}''::jsonb,
        status text generated always as (record ->> ''status'') stored,
        created_by uuid,
        updated_by uuid,
        source text not null default ''matrixsales'',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )',
      item[2]
    );

    execute format('create index if not exists %I on public.%I (tenant_id)', item[2] || '_tenant_id_idx', item[2]);
    execute format('create index if not exists %I on public.%I (organization_id)', item[2] || '_organization_id_idx', item[2]);
    execute format('create index if not exists %I on public.%I using gin (record)', item[2] || '_record_gin_idx', item[2]);

    execute format('alter table public.%I enable row level security', item[2]);
    execute format('drop policy if exists tenant_read_write on public.%I', item[2]);
    execute format(
      'create policy tenant_read_write on public.%I
        for all
        to authenticated
        using (
          (auth.jwt() ->> ''email'') = ''shareef6695@gmail.com''
          or
          exists (
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
          (auth.jwt() ->> ''email'') = ''shareef6695@gmail.com''
          or
          exists (
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
      item[2],
      item[2],
      item[2],
      item[2],
      item[2]
    );

    insert into public.matrix_entity_table_map (entity_name, table_name)
    values (item[1], item[2])
    on conflict (entity_name) do update set table_name = excluded.table_name;
  end loop;
end;
$$;

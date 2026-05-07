-- Multi-tenant hardening and onboarding metadata for HORIZON.
-- Organization is the tenant/company model. tenant_id mirrors organization_id
-- for compatibility with tenant-aware services and reports.

create extension if not exists pgcrypto;

create table if not exists public.matrix_entity_table_map (
  entity_name text primary key,
  table_name text not null unique,
  created_at timestamptz not null default now()
);

do $$
declare
  mapped_table record;
begin
  for mapped_table in
    select table_name
    from public.matrix_entity_table_map
    where table_name is not null
  loop
    execute format('alter table public.%I add column if not exists tenant_id uuid', mapped_table.table_name);

    execute format(
      'update public.%I
       set tenant_id = coalesce(tenant_id, organization_id)
       where tenant_id is null and organization_id is not null',
      mapped_table.table_name
    );

    execute format(
      'create index if not exists %I on public.%I (tenant_id)',
      mapped_table.table_name || '_tenant_id_idx',
      mapped_table.table_name
    );

    execute format('alter table public.%I enable row level security', mapped_table.table_name);
    execute format('drop policy if exists authenticated_read_write on public.%I', mapped_table.table_name);
    execute format('drop policy if exists tenant_read_write on public.%I', mapped_table.table_name);
  end loop;
end;
$$;

-- Preserve access to legacy company records that were created before tenant ownership existed.
update public.organization
set record = record
  || jsonb_build_object(
    'owner_email',
    coalesce(record ->> 'owner_email', record ->> 'created_by_email', 'shareef6695@gmail.com'),
    'created_by_email',
    coalesce(record ->> 'created_by_email', record ->> 'owner_email', 'shareef6695@gmail.com'),
    'admin_emails',
    case
      when jsonb_typeof(record -> 'admin_emails') = 'array' then record -> 'admin_emails'
      else '["shareef6695@gmail.com"]'::jsonb
    end,
    'onboarding_status',
    coalesce(record ->> 'onboarding_status', 'ready_to_use')
  )
where (record ->> 'owner_email') is null
   or (record ->> 'created_by_email') is null
   or (record ->> 'onboarding_status') is null;

-- Organization tenant records: users can access tenants they own or are explicitly authorized for.
create policy tenant_read_write on public.organization
  for all
  to authenticated
  using (
    (record ->> 'owner_user_id') = auth.uid()::text
    or (record ->> 'created_by_user_id') = auth.uid()::text
    or (record ->> 'owner_email') = (auth.jwt() ->> 'email')
    or (record ->> 'created_by_email') = (auth.jwt() ->> 'email')
    or coalesce(record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
    or coalesce(record -> 'admin_emails', '[]'::jsonb) ? (auth.jwt() ->> 'email')
  )
  with check (
    (record ->> 'owner_user_id') = auth.uid()::text
    or (record ->> 'created_by_user_id') = auth.uid()::text
    or (record ->> 'owner_email') = (auth.jwt() ->> 'email')
    or (record ->> 'created_by_email') = (auth.jwt() ->> 'email')
    or coalesce(record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
    or coalesce(record -> 'admin_emails', '[]'::jsonb) ? (auth.jwt() ->> 'email')
  );

-- User records are visible to the represented user or to users authorized on the same tenant.
create policy tenant_read_write on public."user"
  for all
  to authenticated
  using (
    (record ->> 'auth_user_id') = auth.uid()::text
    or (record ->> 'email') = (auth.jwt() ->> 'email')
    or exists (
      select 1
      from public.organization org
      where org.id = coalesce(public."user".tenant_id, public."user".organization_id)
        and (
          (org.record ->> 'owner_user_id') = auth.uid()::text
          or coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
          or coalesce(org.record -> 'admin_emails', '[]'::jsonb) ? (auth.jwt() ->> 'email')
        )
    )
  )
  with check (
    (record ->> 'auth_user_id') = auth.uid()::text
    or (record ->> 'email') = (auth.jwt() ->> 'email')
    or exists (
      select 1
      from public.organization org
      where org.id = coalesce(public."user".tenant_id, public."user".organization_id)
        and (
          (org.record ->> 'owner_user_id') = auth.uid()::text
          or coalesce(org.record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
          or coalesce(org.record -> 'admin_emails', '[]'::jsonb) ? (auth.jwt() ->> 'email')
        )
    )
  );

do $$
declare
  mapped_table record;
begin
  for mapped_table in
    select table_name
    from public.matrix_entity_table_map
    where table_name not in ('organization', 'user')
  loop
    execute format(
      'create policy tenant_read_write on public.%I
        for all
        to authenticated
        using (
          coalesce(tenant_id, organization_id) is not null
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
          coalesce(tenant_id, organization_id) is not null
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
      mapped_table.table_name,
      mapped_table.table_name,
      mapped_table.table_name,
      mapped_table.table_name,
      mapped_table.table_name
    );
  end loop;
end;
$$;

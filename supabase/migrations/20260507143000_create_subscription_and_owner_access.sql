-- Subscription model and platform-owner access.

create extension if not exists pgcrypto;

create table if not exists public.matrix_entity_table_map (
  entity_name text primary key,
  table_name text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.subscription (
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

create index if not exists subscription_tenant_id_idx on public.subscription (tenant_id);
create index if not exists subscription_organization_id_idx on public.subscription (organization_id);
create index if not exists subscription_status_idx on public.subscription (status);
create index if not exists subscription_plan_idx on public.subscription ((record ->> 'plan'));
create index if not exists subscription_record_gin_idx on public.subscription using gin (record);

alter table public.subscription enable row level security;

drop trigger if exists set_subscription_updated_at on public.subscription;
create trigger set_subscription_updated_at
  before update on public.subscription
  for each row execute function public.set_updated_at();

insert into public.matrix_entity_table_map (entity_name, table_name)
values ('Subscription', 'subscription')
on conflict (entity_name) do update
  set table_name = excluded.table_name;

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
    execute format('create index if not exists %I on public.%I (tenant_id)', mapped_table.table_name || '_tenant_id_idx', mapped_table.table_name);
    execute format('alter table public.%I enable row level security', mapped_table.table_name);
    execute format('drop policy if exists authenticated_read_write on public.%I', mapped_table.table_name);
    execute format('drop policy if exists tenant_read_write on public.%I', mapped_table.table_name);
  end loop;
end;
$$;

create policy tenant_read_write on public.organization
  for all
  to authenticated
  using (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    or (record ->> 'owner_user_id') = auth.uid()::text
    or (record ->> 'created_by_user_id') = auth.uid()::text
    or (record ->> 'owner_email') = (auth.jwt() ->> 'email')
    or (record ->> 'created_by_email') = (auth.jwt() ->> 'email')
    or coalesce(record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
    or coalesce(record -> 'admin_emails', '[]'::jsonb) ? (auth.jwt() ->> 'email')
  )
  with check (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    or (record ->> 'owner_user_id') = auth.uid()::text
    or (record ->> 'created_by_user_id') = auth.uid()::text
    or (record ->> 'owner_email') = (auth.jwt() ->> 'email')
    or (record ->> 'created_by_email') = (auth.jwt() ->> 'email')
    or coalesce(record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
    or coalesce(record -> 'admin_emails', '[]'::jsonb) ? (auth.jwt() ->> 'email')
  );

create policy tenant_read_write on public."user"
  for all
  to authenticated
  using (
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    or (record ->> 'auth_user_id') = auth.uid()::text
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
    (auth.jwt() ->> 'email') = 'shareef6695@gmail.com'
    or (record ->> 'auth_user_id') = auth.uid()::text
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
          (auth.jwt() ->> ''email'') = ''shareef6695@gmail.com''
          or (
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
        )
        with check (
          (auth.jwt() ->> ''email'') = ''shareef6695@gmail.com''
          or (
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

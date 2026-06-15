-- Add missing finance tables: account, gl_account_mapping, journal_line, accounting_period
-- These entities are used by ChartOfAccounts, JournalEntry, AccountLedger, journalService
-- but were absent from the initial entity-table migration.

do $$
declare
  new_tables text[][] := array[
    array['Account',          'account'],
    array['GLAccountMapping', 'gl_account_mapping'],
    array['JournalLine',      'journal_line'],
    array['AccountingPeriod', 'accounting_period']
  ];
  item text[];
  policy_exists boolean;
begin
  foreach item slice 1 in array new_tables loop
    execute format(
      'create table if not exists public.%I (
        id uuid primary key default gen_random_uuid(),
        external_id text unique,
        organization_id uuid,
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

    execute format(
      'create index if not exists %I on public.%I using gin (record)',
      item[2] || '_record_gin_idx', item[2]
    );
    execute format(
      'create index if not exists %I on public.%I (organization_id)',
      item[2] || '_organization_id_idx', item[2]
    );
    execute format(
      'create index if not exists %I on public.%I (organization_key)',
      item[2] || '_organization_key_idx', item[2]
    );
    execute format(
      'create index if not exists %I on public.%I (status)',
      item[2] || '_status_idx', item[2]
    );
    execute format(
      'create index if not exists %I on public.%I (created_at desc)',
      item[2] || '_created_at_idx', item[2]
    );

    execute format('alter table public.%I enable row level security', item[2]);

    select exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = item[2]
        and policyname = 'authenticated_read_write'
    ) into policy_exists;

    if not policy_exists then
      execute format(
        'create policy authenticated_read_write on public.%I
          for all
          to authenticated
          using (true)
          with check (true)',
        item[2]
      );
    end if;

    execute format(
      'drop trigger if exists %I on public.%I',
      'set_' || item[2] || '_updated_at', item[2]
    );
    execute format(
      'create trigger %I
        before update on public.%I
        for each row execute function public.set_updated_at()',
      'set_' || item[2] || '_updated_at',
      item[2]
    );

    insert into public.matrix_entity_table_map (entity_name, table_name)
    values (item[1], item[2])
    on conflict (entity_name) do update set table_name = excluded.table_name;
  end loop;
end;
$$;

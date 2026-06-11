-- Cinnamon Processing module: 5 new entities + 15 grade seed rows.
-- Follows the same pattern as 20260508130000_add_service_billing_tables.sql.

do $$
declare
  cinnamon_tables text[][] := array[
    array['CinnamonGrade',         'cinnamon_grade'],
    array['CinnamonBatch',         'cinnamon_batch'],
    array['CinnamonProcessStep',   'cinnamon_process_step'],
    array['CinnamonGradingOutput', 'cinnamon_grading_output'],
    array['CinnamonPackaging',     'cinnamon_packaging']
  ];
  item text[];
  policy_exists boolean;
begin
  foreach item slice 1 in array cinnamon_tables loop
    execute format(
      'create table if not exists public.%I (
        id               uuid        primary key default gen_random_uuid(),
        external_id      text        unique,
        tenant_id        uuid,
        organization_id  uuid,
        organization_key text,
        record           jsonb       not null default ''{}''::jsonb,
        status           text        generated always as (record ->> ''status'') stored,
        created_by       uuid,
        updated_by       uuid,
        source           text        not null default ''matrixsales'',
        created_at       timestamptz not null default now(),
        updated_at       timestamptz not null default now()
      )',
      item[2]
    );

    execute format('create index if not exists %I on public.%I using gin (record)',          item[2] || '_record_gin_idx',        item[2]);
    execute format('create index if not exists %I on public.%I (organization_id)',           item[2] || '_organization_id_idx',   item[2]);
    execute format('create index if not exists %I on public.%I (tenant_id)',                 item[2] || '_tenant_id_idx',         item[2]);
    execute format('create index if not exists %I on public.%I (organization_key)',          item[2] || '_organization_key_idx',  item[2]);
    execute format('create index if not exists %I on public.%I (status)',                    item[2] || '_status_idx',            item[2]);
    execute format('create index if not exists %I on public.%I (created_at desc)',           item[2] || '_created_at_idx',        item[2]);

    execute format('alter table public.%I enable row level security', item[2]);

    select exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename   = item[2]
        and policyname  = 'authenticated_read_write'
    ) into policy_exists;

    if not policy_exists then
      execute format(
        'create policy authenticated_read_write on public.%I
           for all to authenticated
           using (true)
           with check (true)',
        item[2]
      );
    end if;

    execute format('drop trigger if exists %I on public.%I',
      'set_' || item[2] || '_updated_at', item[2]);
    execute format(
      'create trigger %I
         before update on public.%I
         for each row execute function public.set_updated_at()',
      'set_' || item[2] || '_updated_at',
      item[2]
    );

    insert into public.matrix_entity_table_map (entity_name, table_name)
    values (item[1], item[2])
    on conflict (entity_name) do update
      set table_name = excluded.table_name;

  end loop;
end;
$$;

-- ─── Seed CinnamonGrade master data (system-level; no org scope) ─────────────
-- Grades are industry-standard and shared across all tenants.
-- They are inserted without organization_id so they're visible to all.

insert into public.cinnamon_grade (record) values
  ('{"grade_code":"ALBA",  "grade_name":"Alba",            "category":"Quill",   "standard_length_inches":42, "status":"active"}'),
  ('{"grade_code":"C5ES",  "grade_name":"C5 Extra Special","category":"Quill",   "standard_length_inches":42, "status":"active"}'),
  ('{"grade_code":"C5S",   "grade_name":"C5 Special",      "category":"Quill",   "standard_length_inches":42, "status":"active"}'),
  ('{"grade_code":"C5",    "grade_name":"C5",               "category":"Quill",   "standard_length_inches":42, "status":"active"}'),
  ('{"grade_code":"C4",    "grade_name":"C4",               "category":"Quill",   "standard_length_inches":42, "status":"active"}'),
  ('{"grade_code":"C3",    "grade_name":"C3",               "category":"Quill",   "standard_length_inches":42, "status":"active"}'),
  ('{"grade_code":"M5S",   "grade_name":"M5 Special",       "category":"Quill",   "standard_length_inches":21, "status":"active"}'),
  ('{"grade_code":"M5",    "grade_name":"M5",               "category":"Quill",   "standard_length_inches":21, "status":"active"}'),
  ('{"grade_code":"M4",    "grade_name":"M4",               "category":"Quill",   "standard_length_inches":21, "status":"active"}'),
  ('{"grade_code":"H1",    "grade_name":"H1",               "category":"Quill",   "standard_length_inches":42, "status":"active"}'),
  ('{"grade_code":"H2S",   "grade_name":"H2 Special",       "category":"Quill",   "standard_length_inches":42, "status":"active"}'),
  ('{"grade_code":"H2",    "grade_name":"H2",               "category":"Quill",   "standard_length_inches":42, "status":"active"}'),
  ('{"grade_code":"H3",    "grade_name":"H3",               "category":"Quill",   "standard_length_inches":42, "status":"active"}'),
  ('{"grade_code":"PWD",   "grade_name":"Powder",           "category":"Powder",  "standard_length_inches":null,"status":"active"}'),
  ('{"grade_code":"OFFCUT","grade_name":"Off-Cut",          "category":"OffCut",  "standard_length_inches":null,"status":"active"}')
on conflict do nothing;

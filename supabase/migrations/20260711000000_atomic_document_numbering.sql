-- Atomic document-number allocation.
--
-- Problem: both the client-side generator (src/components/utils/documentNumberGenerator.jsx)
-- and the SDK wrapper (src/api/matrixSalesClient.js -> getNextSupabaseDocumentNumber)
-- allocate numbers with a read-modify-write: SELECT current_number, then UPDATE
-- current_number + 1. Two concurrent saves can read the same value and produce
-- duplicate document numbers.
--
-- Fix: a SECURITY DEFINER function that increments the counter under a row lock
-- (SELECT ... FOR UPDATE) inside a single transaction, so concurrent callers
-- serialize on the series row. The series row lives in document_number_series
-- as a jsonb `record`, keyed by (document_type, branch_code, fiscal_year) among
-- rows whose status is 'active'.
--
-- Safe to apply independently of the client: until the client is updated to call
-- this RPC it simply goes unused; the clients also fall back to their legacy path
-- if the RPC is absent. Apply to STAGING and verify before production.

-- ── Uniqueness: one active series per (type, branch, fiscal year) ──────────────
-- Prevents two concurrent "create the series" inserts from producing duplicate
-- series rows. Partial unique index over the jsonb fields.
create unique index if not exists document_number_series_active_key_idx
  on public.document_number_series (
    (record ->> 'document_type'),
    (coalesce(record ->> 'branch_code', 'ALL')),
    (record ->> 'fiscal_year')
  )
  where coalesce(record ->> 'status', 'active') = 'active';

-- ── Atomic allocator ──────────────────────────────────────────────────────────
create or replace function public.next_document_number(
  p_document_type text,
  p_branch_code   text default 'ALL',
  p_fiscal_year   text default null,
  p_prefix        text default 'DOC',
  p_number_width  integer default 6
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch text := coalesce(nullif(p_branch_code, ''), 'ALL');
  v_fy     text := coalesce(nullif(p_fiscal_year, ''), to_char(now(), 'YY'));
  v_width  integer := coalesce(p_number_width, 6);
  v_id     uuid;
  v_next   integer;
  v_prefix text;
  v_result text;
begin
  -- Lock the active series row for this key, if it exists.
  select id into v_id
  from public.document_number_series
  where record ->> 'document_type' = p_document_type
    and coalesce(record ->> 'branch_code', 'ALL') = v_branch
    and record ->> 'fiscal_year' = v_fy
    and coalesce(record ->> 'status', 'active') = 'active'
  order by created_at
  limit 1
  for update;

  -- Create it if missing. The unique index makes a concurrent create fail with
  -- unique_violation; in that case fall through and re-select the winner's row.
  if v_id is null then
    begin
      insert into public.document_number_series (record)
      values (jsonb_build_object(
        'series_id',      concat_ws('-', coalesce(p_prefix, 'DOC'), v_branch, v_fy),
        'document_type',  p_document_type,
        'prefix',         coalesce(p_prefix, 'DOC'),
        'branch_code',    v_branch,
        'fiscal_year',    v_fy,
        'current_number', 0,
        'starting_number', 1,
        'number_width',   v_width,
        'format_pattern', '{PREFIX}-{BR}-{FY}-{NNNNNN}',
        'status',         'active',
        'auto_generate',  true
      ))
      returning id into v_id;
    exception when unique_violation then
      select id into v_id
      from public.document_number_series
      where record ->> 'document_type' = p_document_type
        and coalesce(record ->> 'branch_code', 'ALL') = v_branch
        and record ->> 'fiscal_year' = v_fy
        and coalesce(record ->> 'status', 'active') = 'active'
      order by created_at
      limit 1
      for update;
    end;
  end if;

  -- Atomically increment and read back the new value + formatting inputs.
  update public.document_number_series
  set record = jsonb_set(
                 jsonb_set(
                   record,
                   '{current_number}',
                   to_jsonb(coalesce((record ->> 'current_number')::integer, 0) + 1)
                 ),
                 '{last_generated_date}',
                 to_jsonb(now()::text)
               )
  where id = v_id
  returning
    (record ->> 'current_number')::integer,
    coalesce(record ->> 'prefix', p_prefix, 'DOC')
  into v_next, v_prefix;

  v_result := concat_ws(
    '-',
    v_prefix,
    v_branch,
    v_fy,
    lpad(v_next::text, v_width, '0')
  );

  update public.document_number_series
  set record = jsonb_set(record, '{last_generated_number}', to_jsonb(v_result))
  where id = v_id;

  return v_result;
end;
$$;

-- Callable by the app's authenticated (and anon, matching current RLS-open reads) roles.
grant execute on function public.next_document_number(text, text, text, text, integer) to anon, authenticated, service_role;

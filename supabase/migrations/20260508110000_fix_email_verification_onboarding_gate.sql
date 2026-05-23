-- Enforce signup email verification as the first onboarding gate.
-- Supabase Auth sends the signup confirmation email when Confirm email is enabled.
-- This trigger creates tenant/user placeholders without marking them verified,
-- then advances the tenant only after auth.users.email_confirmed_at is set.

create extension if not exists pgcrypto;

create or replace function public.matrixsales_pending_tenant_name(user_email text)
returns text
language sql
stable
as $$
  select 'Pending tenant - ' || coalesce(nullif(user_email, ''), 'new user')
$$;

create or replace function public.matrixsales_create_pending_onboarding_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  selected_plan text;
  display_name text;
begin
  selected_plan := coalesce(new.raw_user_meta_data ->> 'selected_plan', 'starter');
  display_name := coalesce(new.raw_user_meta_data ->> 'full_name', new.email);

  insert into public.organization (record)
  values (
    jsonb_build_object(
      'tenant_name', public.matrixsales_pending_tenant_name(new.email),
      'organization_name', public.matrixsales_pending_tenant_name(new.email),
      'owner_user_id', new.id::text,
      'created_by_user_id', new.id::text,
      'owner_email', new.email,
      'created_by_email', new.email,
      'admin_emails', jsonb_build_array(new.email),
      'authorized_user_ids', jsonb_build_array(new.id::text),
      'selected_plan', selected_plan,
      'email_verified', false,
      'status', 'email_verification_pending',
      'onboarding_status', 'email_verification_pending'
    )
  )
  returning id into v_tenant_id;

  update public.organization
  set tenant_id = v_tenant_id,
      organization_id = v_tenant_id,
      record = record || jsonb_build_object(
        'tenant_id', v_tenant_id::text,
        'organization_id', v_tenant_id::text
      )
  where id = v_tenant_id;

  insert into public."user" (tenant_id, organization_id, record)
  values (
    v_tenant_id,
    v_tenant_id,
    jsonb_build_object(
      'auth_user_id', new.id::text,
      'email', new.email,
      'full_name', display_name,
      'role', 'admin',
      'assigned_roles', jsonb_build_array('TENANT_ADMIN'),
      'status', 'email_verification_pending',
      'email_verified', false,
      'tenant_id', v_tenant_id::text,
      'organization_id', v_tenant_id::text,
      'organization_name', public.matrixsales_pending_tenant_name(new.email)
    )
  );

  return new;
end;
$$;

create or replace function public.matrixsales_mark_onboarding_email_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_row record;
  verified_at timestamptz;
begin
  if old.email_confirmed_at is not null or new.email_confirmed_at is null then
    return new;
  end if;

  verified_at := new.email_confirmed_at;

  for tenant_row in
    select *
    from public.organization
    where record ->> 'owner_user_id' = new.id::text
  loop
    update public.organization
    set tenant_id = coalesce(tenant_row.tenant_id, tenant_row.id),
        organization_id = coalesce(tenant_row.organization_id, tenant_row.id),
        record = tenant_row.record
          || jsonb_build_object(
            'tenant_id', coalesce(tenant_row.tenant_id, tenant_row.id)::text,
            'organization_id', coalesce(tenant_row.organization_id, tenant_row.id)::text,
            'email_verified', true,
            'email_verified_at', verified_at,
            'status', case
              when tenant_row.record ->> 'status' = 'email_verification_pending' then 'pending_company_profile'
              else coalesce(tenant_row.record ->> 'status', 'pending_company_profile')
            end,
            'onboarding_status', case
              when coalesce(tenant_row.record ->> 'onboarding_status', 'email_verification_pending') = 'email_verification_pending'
                then 'company_profile_pending'
              else tenant_row.record ->> 'onboarding_status'
            end
          )
    where id = tenant_row.id;

    update public."user"
    set tenant_id = coalesce(public."user".tenant_id, tenant_row.id),
        organization_id = coalesce(public."user".organization_id, tenant_row.id),
        record = record
          || jsonb_build_object(
            'email_verified', true,
            'email_verified_at', verified_at,
            'status', case
              when record ->> 'status' = 'email_verification_pending' then 'active'
              else coalesce(record ->> 'status', 'active')
            end,
            'tenant_id', coalesce(public."user".tenant_id, tenant_row.id)::text,
            'organization_id', coalesce(public."user".organization_id, tenant_row.id)::text
          )
    where record ->> 'auth_user_id' = new.id::text
       or record ->> 'email' = new.email;
  end loop;

  return new;
end;
$$;

drop trigger if exists matrixsales_create_pending_onboarding_records on auth.users;
create trigger matrixsales_create_pending_onboarding_records
  after insert on auth.users
  for each row execute function public.matrixsales_create_pending_onboarding_records();

drop trigger if exists matrixsales_mark_onboarding_email_verified on auth.users;
create trigger matrixsales_mark_onboarding_email_verified
  after update of email_confirmed_at on auth.users
  for each row execute function public.matrixsales_mark_onboarding_email_verified();

create or replace function public.matrixsales_auth_email_verified()
returns boolean
language sql
security definer
set search_path = auth, public
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and email_confirmed_at is not null
  )
$$;

grant execute on function public.matrixsales_auth_email_verified() to authenticated;

drop policy if exists tenant_read_write on public.organization;
create policy tenant_read_write on public.organization
  for all
  to authenticated
  using (
    public.matrixsales_auth_email_verified()
    and (
      (record ->> 'owner_user_id') = auth.uid()::text
      or (record ->> 'created_by_user_id') = auth.uid()::text
      or (record ->> 'owner_email') = (auth.jwt() ->> 'email')
      or (record ->> 'created_by_email') = (auth.jwt() ->> 'email')
      or coalesce(record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
      or coalesce(record -> 'admin_emails', '[]'::jsonb) ? (auth.jwt() ->> 'email')
    )
  )
  with check (
    public.matrixsales_auth_email_verified()
    and (
      (record ->> 'owner_user_id') = auth.uid()::text
      or (record ->> 'created_by_user_id') = auth.uid()::text
      or (record ->> 'owner_email') = (auth.jwt() ->> 'email')
      or (record ->> 'created_by_email') = (auth.jwt() ->> 'email')
      or coalesce(record -> 'authorized_user_ids', '[]'::jsonb) ? auth.uid()::text
      or coalesce(record -> 'admin_emails', '[]'::jsonb) ? (auth.jwt() ->> 'email')
    )
  );

drop policy if exists tenant_read_write on public."user";
create policy tenant_read_write on public."user"
  for all
  to authenticated
  using (
    public.matrixsales_auth_email_verified()
    and (
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
  )
  with check (
    public.matrixsales_auth_email_verified()
    and (
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
  );

do $$
declare
  mapped_table record;
begin
  for mapped_table in
    select table_name
    from public.matrix_entity_table_map
    where table_name not in ('organization', 'user', 'subscription_plan')
  loop
    execute format('drop policy if exists tenant_read_write on public.%I', mapped_table.table_name);
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
      mapped_table.table_name,
      mapped_table.table_name,
      mapped_table.table_name,
      mapped_table.table_name,
      mapped_table.table_name
    );
  end loop;
end;
$$;

-- Revoke existing employee sessions after an owner resets the password.
-- This is additive and leaves owner sessions and payment functions untouched.

create table if not exists public.employee_session_revocations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revoked_before timestamptz not null default now()
);
alter table public.employee_session_revocations enable row level security;
revoke all on table public.employee_session_revocations from anon, authenticated;
grant select, insert, update, delete on table public.employee_session_revocations to service_role;

create or replace function private.employee_session_is_valid()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session_id uuid;
  v_revoked_before timestamptz;
  v_session_created_at timestamptz;
begin
  if v_user_id is null then return false; end if;

  -- Non-employee accounts (including owners) are not affected by this mechanism.
  if not exists (select 1 from public.employees e where e.user_id = v_user_id) then
    return true;
  end if;

  select r.revoked_before into v_revoked_before
  from public.employee_session_revocations r
  where r.user_id = v_user_id;

  if v_revoked_before is null then return true; end if;

  begin
    v_session_id := nullif((select auth.jwt())->>'session_id', '')::uuid;
  exception when others then
    return false;
  end;
  if v_session_id is null then return false; end if;

  select s.created_at into v_session_created_at
  from auth.sessions s
  where s.id = v_session_id and s.user_id = v_user_id;

  return v_session_created_at is not null and v_session_created_at > v_revoked_before;
end;
$$;
revoke all on function private.employee_session_is_valid() from public, anon;
grant execute on function private.employee_session_is_valid() to authenticated, service_role;

create or replace function public.employee_session_is_valid()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.employee_session_is_valid();
$$;
revoke all on function public.employee_session_is_valid() from public, anon;
grant execute on function public.employee_session_is_valid() to authenticated;

create or replace function private.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.employee_session_is_valid()
    and (private.is_super_admin() or exists (
      select 1 from public.store_memberships sm
      where sm.store_id = p_store_id and sm.user_id = (select auth.uid())
    ));
$$;
revoke all on function private.is_store_member(uuid) from public, anon;
grant execute on function private.is_store_member(uuid) to authenticated, service_role;

create or replace function private.has_store_role(p_store_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.employee_session_is_valid()
    and (private.is_super_admin() or exists (
      select 1 from public.store_memberships sm
      where sm.store_id = p_store_id
        and sm.user_id = (select auth.uid())
        and (
          sm.role = any(p_roles)
          or exists (
            select 1 from public.store_membership_roles smr
            where smr.store_id = sm.store_id
              and smr.user_id = sm.user_id
              and smr.role = any(p_roles)
          )
        )
    ));
$$;
revoke all on function private.has_store_role(uuid, text[]) from public, anon;
grant execute on function private.has_store_role(uuid, text[]) to authenticated, service_role;

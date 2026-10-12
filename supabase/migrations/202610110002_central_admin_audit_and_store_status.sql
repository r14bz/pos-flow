-- Central administrator audit trail and store suspension enforcement.
-- Store suspension is enforced through the shared membership/role helpers used by RLS and RPCs.
alter table public.stores
  add column if not exists status text not null default 'active'
  check (status in ('active', 'suspended'));

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 1 and 80),
  target_type text not null check (target_type in ('store', 'account')),
  target_id text not null check (length(target_id) between 1 and 120),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs(created_at desc);
alter table public.admin_audit_logs enable row level security;
revoke all on public.admin_audit_logs from anon, authenticated;
grant select on public.admin_audit_logs to authenticated;
drop policy if exists admin_audit_logs_select_super_admin on public.admin_audit_logs;
create policy admin_audit_logs_select_super_admin
  on public.admin_audit_logs for select to authenticated
  using ((select private.is_super_admin()));

-- A suspended store is inaccessible to its members; platform administrators retain visibility.
create or replace function private.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1 from public.store_memberships sm
    join public.stores s on s.id = sm.store_id
    where sm.store_id = p_store_id
      and sm.user_id = (select auth.uid())
      and s.status = 'active'
  );
$$;

create or replace function private.has_store_role(p_store_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1 from public.store_memberships sm
    join public.stores s on s.id = sm.store_id
    where sm.store_id = p_store_id
      and sm.user_id = (select auth.uid())
      and s.status = 'active'
      and (
        sm.role = any(p_roles)
        or exists (
          select 1 from public.store_membership_roles smr
          where smr.store_id = sm.store_id
            and smr.user_id = sm.user_id
            and smr.role = any(p_roles)
        )
      )
  );
$$;
revoke all on function private.is_store_member(uuid) from public, anon;
revoke all on function private.has_store_role(uuid, text[]) from public, anon;
grant execute on function private.is_store_member(uuid) to authenticated, service_role;
grant execute on function private.has_store_role(uuid, text[]) to authenticated, service_role;

-- Status changes and audit record are one transaction; only a verified super admin can call this.
create or replace function public.admin_set_store_status(p_store_id uuid, p_status text)
returns public.stores
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store public.stores%rowtype;
  v_old_status text;
begin
  if (select auth.uid()) is null or not private.is_super_admin() then
    raise exception 'Akses administrator pusat diperlukan.' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Status toko tidak valid.' using errcode = '22023';
  end if;

  select * into v_store from public.stores where id = p_store_id for update;
  if not found then raise exception 'Toko tidak ditemukan.' using errcode = 'P0002'; end if;
  v_old_status := v_store.status;
  update public.stores set status = p_status where id = p_store_id returning * into v_store;

  insert into public.admin_audit_logs(actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'store_status_changed', 'store', p_store_id::text,
    jsonb_build_object('from', v_old_status, 'to', p_status, 'store_name', v_store.name));
  return v_store;
end;
$$;
revoke all on function public.admin_set_store_status(uuid, text) from public, anon;
grant execute on function public.admin_set_store_status(uuid, text) to authenticated;

comment on table public.admin_audit_logs is 'Read-only audit history for central administrator actions.';
comment on function public.admin_set_store_status(uuid, text) is 'Super-admin-only store suspension; changes and audit log commit atomically.';

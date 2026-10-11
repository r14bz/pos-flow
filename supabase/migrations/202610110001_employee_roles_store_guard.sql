-- POS-Flow employee access hardening.
-- Existing single-role memberships continue to work unchanged.
-- Extra roles are stored separately so one employee can hold several roles in one store.

-- Employee usernames are scoped to a store; existing invited employees remain compatible.
alter table public.employees add column if not exists username text;
create unique index if not exists employees_store_username_unique
  on public.employees (store_id, lower(username)) where username is not null;

create table if not exists public.store_membership_roles (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('manager','cashier','inventory','viewer')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id, role)
);

create index if not exists store_membership_roles_user_store_idx
  on public.store_membership_roles(user_id, store_id);

alter table public.store_membership_roles enable row level security;

drop policy if exists store_membership_roles_select_member on public.store_membership_roles;
create policy store_membership_roles_select_member
  on public.store_membership_roles for select to authenticated
  using (private.is_store_member(store_id));

drop policy if exists store_membership_roles_manage_owner on public.store_membership_roles;
create policy store_membership_roles_manage_owner
  on public.store_membership_roles for all to authenticated
  using (private.is_store_owner(store_id))
  with check (private.is_store_owner(store_id));

-- Preserve legacy role checks and include any additional assigned roles.
create or replace function private.has_store_role(p_store_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
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
  );
$$;
revoke all on function private.has_store_role(uuid, text[]) from public, anon;
grant execute on function private.has_store_role(uuid, text[]) to authenticated, service_role;

-- A user who only has employee membership cannot create stores.
-- Existing owners may continue to create additional stores.
create or replace function public.create_store(
  p_name text,
  p_city text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store public.stores%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_city text := trim(coalesce(p_city, ''));
begin
  if (select auth.uid()) is null then
    raise exception 'Autentikasi diperlukan untuk membuat toko.' using errcode = '42501';
  end if;

  if not private.is_super_admin()
     and exists (
       select 1 from public.store_memberships sm
       where sm.user_id = (select auth.uid())
     )
     and not exists (
       select 1 from public.store_memberships sm
       join public.stores s on s.id = sm.store_id
       where sm.user_id = (select auth.uid())
         and sm.role = 'owner'
         and s.owner_id = (select auth.uid())
     ) then
    raise exception 'Akun karyawan tidak memiliki izin membuat toko. Hubungi pemilik toko.' using errcode = '42501';
  end if;

  if length(v_name) < 1 or length(v_name) > 120 then
    raise exception 'Nama toko wajib diisi (maksimal 120 karakter).' using errcode = '22023';
  end if;
  if length(v_city) > 120 then
    raise exception 'Nama kota terlalu panjang.' using errcode = '22023';
  end if;

  insert into public.stores (owner_id, name, city)
  values ((select auth.uid()), v_name, v_city)
  returning * into v_store;

  insert into public.store_memberships (store_id, user_id, role)
  values (v_store.id, (select auth.uid()), 'owner');

  return to_jsonb(v_store);
end;
$$;
revoke all on function public.create_store(text, text) from public, anon;
grant execute on function public.create_store(text, text) to authenticated;

-- Direct table inserts must also be owner-authorized; the RPC is not the only gate.
drop policy if exists stores_insert_owner on public.stores;
create policy stores_insert_owner on public.stores for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (
    private.is_super_admin()
    or exists (
      select 1 from public.store_memberships sm
      join public.stores existing_store on existing_store.id = sm.store_id
      where sm.user_id = (select auth.uid())
        and sm.role = 'owner'
        and existing_store.owner_id = (select auth.uid())
    )
    or not exists (
      select 1 from public.store_memberships sm
      where sm.user_id = (select auth.uid())
    )
  )
);

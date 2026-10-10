-- TokoFlow POS — initial schema
-- Apply with: supabase db push  OR paste into Supabase SQL Editor.
-- Every tenant-owned row is scoped by store_id and protected by Postgres RLS.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  city text not null default '',
  currency text not null default 'IDR' check (currency = 'IDR'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','cashier','inventory','viewer')),
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);
create index if not exists store_memberships_user_idx on public.store_memberships(user_id);
create index if not exists store_memberships_store_idx on public.store_memberships(store_id);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 180),
  sku text not null default '',
  barcode text,
  category text not null default 'Lainnya',
  unit text not null default 'pcs',
  price numeric(14,2) not null check (price >= 0),
  cost numeric(14,2) not null default 0 check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 5 check (min_stock >= 0),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_store_name_idx on public.products(store_id, name);
create index if not exists products_store_category_idx on public.products(store_id, category);
create unique index if not exists products_store_sku_unique on public.products(store_id, sku) where sku <> '';
create unique index if not exists products_store_barcode_unique on public.products(store_id, barcode) where barcode is not null and barcode <> '';

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  role text not null check (role in ('owner','manager','cashier','inventory','viewer')),
  status text not null default 'invited' check (status in ('invited','active','inactive')),
  last_active timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, email)
);
create index if not exists employees_store_idx on public.employees(store_id);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  receipt_no text not null,
  cashier_id uuid references auth.users(id) on delete set null,
  cashier_name text not null default '',
  subtotal numeric(14,2) not null check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  total numeric(14,2) not null check (total >= 0),
  payment_method text not null check (payment_method in ('cash','qris','transfer')),
  status text not null default 'paid' check (status in ('pending','paid','cancelled')),
  provider_transaction_id text,
  provider_status text,
  provider_payload jsonb not null default '{}'::jsonb,
  provider_qr_url text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, receipt_no)
);
create index if not exists sales_store_created_idx on public.sales(store_id, created_at desc);
create index if not exists sales_store_status_idx on public.sales(store_id, status);
create index if not exists sales_provider_transaction_idx on public.sales(provider_transaction_id) where provider_transaction_id is not null;

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  sku text not null default '',
  qty integer not null check (qty > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  subtotal numeric(14,2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);
create index if not exists sale_items_sale_idx on public.sale_items(sale_id);
create index if not exists sale_items_product_idx on public.sale_items(product_id);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('initial','adjustment','restock','sale','qris_release','return')),
  qty_change integer not null,
  note text not null default '',
  reference_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_store_created_idx on public.stock_movements(store_id, created_at desc);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id, created_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_store_idx on public.push_subscriptions(store_id);

-- Keep updated_at accurate.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function private.handle_new_auth_user();

-- Security helpers use a pinned search_path and are owned by the migration role.
create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_super_admin = true
  );
$$;

create or replace function private.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1 from public.store_memberships sm
    where sm.store_id = p_store_id and sm.user_id = (select auth.uid())
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
    where sm.store_id = p_store_id
      and sm.user_id = (select auth.uid())
      and sm.role = any(p_roles)
  );
$$;

create or replace function private.is_store_owner(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stores s
    where s.id = p_store_id and s.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.is_super_admin() from public, anon;
revoke all on function private.is_store_member(uuid) from public, anon;
revoke all on function private.has_store_role(uuid, text[]) from public, anon;
revoke all on function private.is_store_owner(uuid) from public, anon;
grant execute on function private.is_super_admin() to authenticated, service_role;
grant execute on function private.is_store_member(uuid) to authenticated, service_role;
grant execute on function private.has_store_role(uuid, text[]) to authenticated, service_role;
grant execute on function private.is_store_owner(uuid) to authenticated, service_role;

-- Initial stock is logged in the movement ledger automatically.
create or replace function private.log_product_initial_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stock > 0 then
    insert into public.stock_movements (store_id, product_id, actor_id, type, qty_change, note)
    values (new.store_id, new.id, (select auth.uid()), 'initial', new.stock, 'Stok awal barang');
  end if;
  return new;
end;
$$;
revoke all on function private.log_product_initial_stock() from public, anon, authenticated;

-- Triggers for updated timestamps.
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
drop trigger if exists stores_updated_at on public.stores;
create trigger stores_updated_at before update on public.stores for each row execute function private.set_updated_at();
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function private.set_updated_at();
drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at before update on public.employees for each row execute function private.set_updated_at();
drop trigger if exists sales_updated_at on public.sales;
create trigger sales_updated_at before update on public.sales for each row execute function private.set_updated_at();
drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at before update on public.push_subscriptions for each row execute function private.set_updated_at();
drop trigger if exists products_initial_stock_movement on public.products;
create trigger products_initial_stock_movement after insert on public.products for each row execute function private.log_product_initial_stock();

-- Lock down tables first, then selectively grant access.
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_memberships enable row level security;
alter table public.products enable row level security;
alter table public.employees enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all on public.profiles, public.stores, public.store_memberships, public.products, public.employees,
  public.sales, public.sale_items, public.stock_movements, public.push_subscriptions from anon;
grant select, insert on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant select, insert on public.stores to authenticated;
grant update (name, city, currency) on public.stores to authenticated;
grant select, insert on public.store_memberships to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select on public.sales to authenticated;
grant select on public.sale_items to authenticated;
grant select on public.stock_movements to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.profiles, public.stores, public.store_memberships, public.products, public.employees,
  public.sales, public.sale_items, public.stock_movements, public.push_subscriptions to service_role;

-- Profiles: a user can read their own profile. Admin status is never client-updatable.
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_super_admin()));
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated
with check (id = (select auth.uid()) and is_super_admin = false);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- A store is visible only to members or verified platform administrators.
drop policy if exists stores_select_members on public.stores;
create policy stores_select_members on public.stores for select to authenticated
using (private.is_store_member(id));
drop policy if exists stores_insert_owner on public.stores;
create policy stores_insert_owner on public.stores for insert to authenticated
with check (owner_id = (select auth.uid()));
drop policy if exists stores_update_managers on public.stores;
create policy stores_update_managers on public.stores for update to authenticated
using (private.has_store_role(id, array['owner','manager']))
with check (private.has_store_role(id, array['owner','manager']));

-- Membership: a user may create the initial owner row for their own store.
-- All other invitations/role changes go through the invite-employee Edge Function.
drop policy if exists memberships_select_related on public.store_memberships;
create policy memberships_select_related on public.store_memberships for select to authenticated
using (user_id = (select auth.uid()) or private.has_store_role(store_id, array['owner','manager']) or (select private.is_super_admin()));
drop policy if exists memberships_insert_initial_owner on public.store_memberships;
create policy memberships_insert_initial_owner on public.store_memberships for insert to authenticated
with check (user_id = (select auth.uid()) and role = 'owner' and private.is_store_owner(store_id));

-- Product operations are scoped to a store and role.
drop policy if exists products_select_member on public.products;
create policy products_select_member on public.products for select to authenticated
using (private.is_store_member(store_id));
drop policy if exists products_insert_operator on public.products;
create policy products_insert_operator on public.products for insert to authenticated
with check (private.has_store_role(store_id, array['owner','manager','inventory']));
drop policy if exists products_update_operator on public.products;
create policy products_update_operator on public.products for update to authenticated
using (private.has_store_role(store_id, array['owner','manager','inventory']))
with check (private.has_store_role(store_id, array['owner','manager','inventory']));
drop policy if exists products_delete_manager on public.products;
create policy products_delete_manager on public.products for delete to authenticated
using (private.has_store_role(store_id, array['owner','manager']));

-- Employee information and invitations are visible only inside their store.
drop policy if exists employees_select_member on public.employees;
create policy employees_select_member on public.employees for select to authenticated
using (private.is_store_member(store_id));
drop policy if exists employees_insert_manager on public.employees;
create policy employees_insert_manager on public.employees for insert to authenticated
with check (private.has_store_role(store_id, array['owner','manager']));
drop policy if exists employees_update_manager on public.employees;
create policy employees_update_manager on public.employees for update to authenticated
using (private.has_store_role(store_id, array['owner','manager']))
with check (private.has_store_role(store_id, array['owner','manager']));
drop policy if exists employees_delete_owner on public.employees;
create policy employees_delete_owner on public.employees for delete to authenticated
using (private.has_store_role(store_id, array['owner']));

-- Sales are written only by trusted RPCs; clients may read the member store's records.
drop policy if exists sales_select_member on public.sales;
create policy sales_select_member on public.sales for select to authenticated
using (private.is_store_member(store_id));
drop policy if exists sale_items_select_member on public.sale_items;
create policy sale_items_select_member on public.sale_items for select to authenticated
using (exists (select 1 from public.sales s where s.id = sale_items.sale_id and private.is_store_member(s.store_id)));

-- Stock ledger is append-only for app users; writes happen inside trusted RPCs/triggers.
drop policy if exists stock_movements_select_member on public.stock_movements;
create policy stock_movements_select_member on public.stock_movements for select to authenticated
using (private.is_store_member(store_id));

-- Push subscriptions are user-owned, and may be attached only to a store they belong to.
drop policy if exists push_subscriptions_select_self on public.push_subscriptions;
create policy push_subscriptions_select_self on public.push_subscriptions for select to authenticated
using (user_id = (select auth.uid()));
drop policy if exists push_subscriptions_insert_self on public.push_subscriptions;
create policy push_subscriptions_insert_self on public.push_subscriptions for insert to authenticated
with check (user_id = (select auth.uid()) and (store_id is null or private.is_store_member(store_id)));
drop policy if exists push_subscriptions_update_self on public.push_subscriptions;
create policy push_subscriptions_update_self on public.push_subscriptions for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (store_id is null or private.is_store_member(store_id)));
drop policy if exists push_subscriptions_delete_self on public.push_subscriptions;
create policy push_subscriptions_delete_self on public.push_subscriptions for delete to authenticated
using (user_id = (select auth.uid()));

-- Create a store and its owner membership as one atomic operation.
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

-- Atomic stock adjustment. A user's role is checked inside the function.
create or replace function public.adjust_stock(
  p_store_id uuid,
  p_product_id uuid,
  p_qty_delta integer,
  p_note text default ''
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_new_stock integer;
  v_type text;
begin
  if (select auth.uid()) is null or not private.has_store_role(p_store_id, array['owner','manager','inventory']) then
    raise exception 'Akses penyesuaian stok ditolak.' using errcode = '42501';
  end if;
  if p_qty_delta is null or p_qty_delta = 0 then
    raise exception 'Perubahan stok tidak boleh nol.' using errcode = '22023';
  end if;
  select * into v_product from public.products
    where id = p_product_id and store_id = p_store_id for update;
  if not found then raise exception 'Barang tidak ditemukan pada toko ini.' using errcode = 'P0002'; end if;
  v_new_stock := v_product.stock + p_qty_delta;
  if v_new_stock < 0 then raise exception 'Stok tidak mencukupi.' using errcode = '22023'; end if;
  update public.products set stock = v_new_stock where id = p_product_id and store_id = p_store_id;
  v_type := case when p_qty_delta > 0 then 'restock' else 'adjustment' end;
  insert into public.stock_movements (store_id, product_id, actor_id, type, qty_change, note)
  values (p_store_id, p_product_id, (select auth.uid()), v_type, p_qty_delta, coalesce(p_note, ''));
  return v_new_stock;
end;
$$;

-- Cash/transfer checkout validates prices and stock in the database, then decrements stock atomically.
create or replace function public.checkout_sale(
  p_store_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_discount numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid := gen_random_uuid();
  v_receipt_no text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2) := coalesce(p_discount, 0);
  v_total numeric(14,2);
  v_item_subtotal numeric(14,2);
  v_cashier_name text := '';
begin
  if (select auth.uid()) is null or not private.has_store_role(p_store_id, array['owner','manager','cashier']) then
    raise exception 'Akses kasir ditolak.' using errcode = '42501';
  end if;
  if p_payment_method not in ('cash','transfer') then
    raise exception 'Metode pembayaran tidak valid untuk checkout langsung.' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang tidak boleh kosong.' using errcode = '22023';
  end if;
  if v_discount < 0 then raise exception 'Diskon tidak boleh negatif.' using errcode = '22023'; end if;
  select coalesce(p.full_name, '') into v_cashier_name from public.profiles p where p.id = (select auth.uid());
  v_receipt_no := 'TF-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-' || upper(substr(replace(v_sale_id::text, '-', ''), 1, 6));

  -- Create the parent sale row before details so the foreign key remains valid.
  insert into public.sales (id, store_id, receipt_no, cashier_id, cashier_name, subtotal, discount, total, payment_method, status)
  values (v_sale_id, p_store_id, v_receipt_no, (select auth.uid()), coalesce(v_cashier_name, ''), 0, 0, 0, p_payment_method, 'paid');

  -- Lock each item row and insert snapshot rows, reusing database prices.
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'qty')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'Jumlah barang harus lebih dari nol.' using errcode = '22023'; end if;
    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and store_id = p_store_id for update;
    if not found then raise exception 'Barang tidak ditemukan pada toko aktif.' using errcode = 'P0002'; end if;
    if v_product.stock < v_qty then raise exception 'Stok tidak cukup untuk barang: %', v_product.name using errcode = '22023'; end if;
    v_item_subtotal := v_product.price * v_qty;
    v_subtotal := v_subtotal + v_item_subtotal;
    insert into public.sale_items (sale_id, product_id, product_name, sku, qty, unit_price, subtotal)
    values (v_sale_id, v_product.id, v_product.name, v_product.sku, v_qty, v_product.price, v_item_subtotal);
    update public.products set stock = stock - v_qty where id = v_product.id and store_id = p_store_id;
    insert into public.stock_movements (store_id, product_id, actor_id, type, qty_change, note, reference_id)
    values (p_store_id, v_product.id, (select auth.uid()), 'sale', -v_qty, 'Penjualan ' || v_receipt_no, v_sale_id);
  end loop;
  if v_discount > v_subtotal then raise exception 'Diskon melebihi subtotal.' using errcode = '22023'; end if;
  v_total := v_subtotal - v_discount;
  update public.sales set subtotal = v_subtotal, discount = v_discount, total = v_total where id = v_sale_id;
  return v_sale_id;
end;
$$;

-- QRIS creates a pending sale and reserves stock. The payment webhook either confirms it or restores stock.
create or replace function public.create_pending_sale(
  p_store_id uuid,
  p_items jsonb,
  p_discount numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid := gen_random_uuid();
  v_receipt_no text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2) := coalesce(p_discount, 0);
  v_total numeric(14,2);
  v_item_subtotal numeric(14,2);
  v_cashier_name text := '';
  v_expires_at timestamptz := now() + interval '15 minutes';
begin
  if (select auth.uid()) is null or not private.has_store_role(p_store_id, array['owner','manager','cashier']) then
    raise exception 'Akses kasir ditolak.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang tidak boleh kosong.' using errcode = '22023';
  end if;
  if v_discount < 0 then raise exception 'Diskon tidak boleh negatif.' using errcode = '22023'; end if;
  select coalesce(p.full_name, '') into v_cashier_name from public.profiles p where p.id = (select auth.uid());
  v_receipt_no := 'TF-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-' || upper(substr(replace(v_sale_id::text, '-', ''), 1, 6));

  -- Create pending parent row before sale_items; any later exception rolls back the whole reservation.
  insert into public.sales (id, store_id, receipt_no, cashier_id, cashier_name, subtotal, discount, total, payment_method, status, expires_at)
  values (v_sale_id, p_store_id, v_receipt_no, (select auth.uid()), coalesce(v_cashier_name, ''), 0, 0, 0, 'qris', 'pending', v_expires_at);

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'qty')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'Jumlah barang harus lebih dari nol.' using errcode = '22023'; end if;
    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and store_id = p_store_id for update;
    if not found then raise exception 'Barang tidak ditemukan pada toko aktif.' using errcode = 'P0002'; end if;
    if v_product.stock < v_qty then raise exception 'Stok tidak cukup untuk barang: %', v_product.name using errcode = '22023'; end if;
    v_item_subtotal := v_product.price * v_qty;
    v_subtotal := v_subtotal + v_item_subtotal;
    insert into public.sale_items (sale_id, product_id, product_name, sku, qty, unit_price, subtotal)
    values (v_sale_id, v_product.id, v_product.name, v_product.sku, v_qty, v_product.price, v_item_subtotal);
    update public.products set stock = stock - v_qty where id = v_product.id and store_id = p_store_id;
    insert into public.stock_movements (store_id, product_id, actor_id, type, qty_change, note, reference_id)
    values (p_store_id, v_product.id, (select auth.uid()), 'sale', -v_qty, 'Reservasi QRIS ' || v_receipt_no, v_sale_id);
  end loop;
  if v_discount > v_subtotal then raise exception 'Diskon melebihi subtotal.' using errcode = '22023'; end if;
  v_total := v_subtotal - v_discount;
  update public.sales set subtotal = v_subtotal, discount = v_discount, total = v_total where id = v_sale_id;
  return jsonb_build_object('sale_id', v_sale_id, 'receipt_no', v_receipt_no, 'subtotal', v_subtotal, 'discount', v_discount, 'total', v_total, 'expires_at', v_expires_at);
end;
$$;

-- Only service_role (via the verified payment webhook) may finalize provider payment events.
create or replace function public.finalize_qris_payment(
  p_sale_id uuid,
  p_provider_transaction_id text,
  p_provider_status text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_item record;
  v_status text := lower(coalesce(p_provider_status, ''));
begin
  select * into v_sale from public.sales where id = p_sale_id and payment_method = 'qris' for update;
  if not found then raise exception 'Transaksi QRIS tidak ditemukan.' using errcode = 'P0002'; end if;
  update public.sales set provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
    provider_status = p_provider_status, provider_payload = coalesce(p_payload, '{}'::jsonb)
    where id = p_sale_id;
  if v_sale.status <> 'pending' then return; end if;

  if v_status in ('settlement','capture','paid','success') then
    update public.sales set status = 'paid' where id = p_sale_id and status = 'pending';
  elsif v_status in ('deny','denied','cancel','cancelled','expire','expired','failure','failed') then
    update public.sales set status = 'cancelled' where id = p_sale_id and status = 'pending';
    for v_item in select product_id, qty from public.sale_items where sale_id = p_sale_id and product_id is not null loop
      update public.products set stock = stock + v_item.qty where id = v_item.product_id and store_id = v_sale.store_id;
      insert into public.stock_movements (store_id, product_id, actor_id, type, qty_change, note, reference_id)
      values (v_sale.store_id, v_item.product_id, null, 'qris_release', v_item.qty, 'Stok dilepas karena pembayaran QRIS tidak berhasil', p_sale_id);
    end loop;
  end if;
end;
$$;

revoke all on function public.adjust_stock(uuid, uuid, integer, text) from public, anon;
revoke all on function public.checkout_sale(uuid, jsonb, text, numeric) from public, anon;
revoke all on function public.create_pending_sale(uuid, jsonb, numeric) from public, anon;
revoke all on function public.finalize_qris_payment(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.adjust_stock(uuid, uuid, integer, text) to authenticated;
grant execute on function public.checkout_sale(uuid, jsonb, text, numeric) to authenticated;
grant execute on function public.create_pending_sale(uuid, jsonb, numeric) to authenticated;
grant execute on function public.finalize_qris_payment(uuid, text, text, jsonb) to service_role;

-- Readable daily report view. security_invoker ensures underlying table RLS remains in effect.
create or replace view public.daily_sales
with (security_invoker = true)
as
select
  s.store_id,
  (s.created_at at time zone 'Asia/Jakarta')::date as report_date,
  count(*) filter (where s.status = 'paid') as transaction_count,
  coalesce(sum(s.total) filter (where s.status = 'paid'), 0)::numeric(14,2) as net_sales,
  coalesce(sum(s.subtotal) filter (where s.status = 'paid'), 0)::numeric(14,2) as subtotal,
  coalesce(sum(s.discount) filter (where s.status = 'paid'), 0)::numeric(14,2) as total_discount,
  count(*) filter (where s.status = 'pending') as pending_count,
  coalesce(sum(s.total) filter (where s.status = 'paid' and s.payment_method = 'cash'), 0)::numeric(14,2) as cash_sales,
  coalesce(sum(s.total) filter (where s.status = 'paid' and s.payment_method = 'qris'), 0)::numeric(14,2) as qris_sales,
  coalesce(sum(s.total) filter (where s.status = 'paid' and s.payment_method = 'transfer'), 0)::numeric(14,2) as transfer_sales
from public.sales s
group by s.store_id, (s.created_at at time zone 'Asia/Jakarta')::date;
grant select on public.daily_sales to authenticated;

-- Enable Realtime for inventory and sales updates (safe to rerun).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
  ) then alter publication supabase_realtime add table public.products; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sales'
  ) then alter publication supabase_realtime add table public.sales; end if;
end;
$$;

comment on table public.store_memberships is 'Tenant access map: each user only gets permissions in explicitly joined stores.';
comment on table public.stock_movements is 'Immutable stock ledger. Application clients read only; write through trusted RPC functions.';
comment on function public.checkout_sale(uuid, jsonb, text, numeric) is 'Atomic checkout; server-side pricing and stock validation, scoped to user store membership.';
comment on function public.create_pending_sale(uuid, jsonb, numeric) is 'Creates a pending QRIS payment and reserves stock until provider webhook confirms or releases it.';

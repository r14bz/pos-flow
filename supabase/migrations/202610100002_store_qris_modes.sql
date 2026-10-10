-- Per-store QRIS configuration. Merchant credentials are encrypted by Edge Functions
-- and stored in a separate table that is not readable by app users.

alter table public.sales
  add column if not exists qris_mode text check (qris_mode in ('static','dynamic')),
  add column if not exists provider_order_id text;

create unique index if not exists sales_provider_order_id_unique
  on public.sales(provider_order_id)
  where provider_order_id is not null;

create table if not exists public.store_qris_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  mode text not null default 'static' check (mode in ('static','dynamic','both')),
  static_qr_storage_path text,
  merchant_display_name text not null default '',
  provider text not null default 'midtrans' check (provider in ('midtrans')),
  provider_merchant_id text not null default '',
  provider_is_production boolean not null default false,
  dynamic_status text not null default 'not_connected' check (dynamic_status in ('not_connected','connected','needs_review')),
  last_verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mode not in ('static','both') or static_qr_storage_path is not null)
);

create table if not exists public.store_qris_credentials (
  store_id uuid primary key references public.stores(id) on delete cascade,
  provider_server_key_ciphertext text not null,
  provider_server_key_iv text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_qris_settings enable row level security;
alter table public.store_qris_credentials enable row level security;

revoke all on public.store_qris_credentials from public, anon, authenticated;
grant all on public.store_qris_credentials to service_role;
grant select, insert, update on public.store_qris_settings to authenticated;
grant all on public.store_qris_settings to service_role;

-- Safe, non-secret settings may be read by store members. Only owner/manager can change them.
drop policy if exists store_qris_settings_select_member on public.store_qris_settings;
create policy store_qris_settings_select_member
  on public.store_qris_settings for select to authenticated
  using (private.is_store_member(store_id));

drop policy if exists store_qris_settings_insert_owner on public.store_qris_settings;
create policy store_qris_settings_insert_owner
  on public.store_qris_settings for insert to authenticated
  with check (private.has_store_role(store_id, array['owner']));

drop policy if exists store_qris_settings_update_owner on public.store_qris_settings;
create policy store_qris_settings_update_owner
  on public.store_qris_settings for update to authenticated
  using (private.has_store_role(store_id, array['owner']))
  with check (private.has_store_role(store_id, array['owner']));

-- Private bucket for each store's static QRIS image. Object path must start with the store UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-qris', 'store-qris', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

drop policy if exists store_qris_images_select_member on storage.objects;
create policy store_qris_images_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'store-qris'
    and exists (
      select 1 from public.store_memberships sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = (select auth.uid())
    )
  );

drop policy if exists store_qris_images_insert_manager on storage.objects;
create policy store_qris_images_insert_manager on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-qris'
    and exists (
      select 1 from public.store_memberships sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = (select auth.uid())
        and sm.role in ('owner','manager')
    )
  );

drop policy if exists store_qris_images_update_manager on storage.objects;
create policy store_qris_images_update_manager on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store-qris'
    and exists (
      select 1 from public.store_memberships sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = (select auth.uid())
        and sm.role in ('owner','manager')
    )
  )
  with check (
    bucket_id = 'store-qris'
    and exists (
      select 1 from public.store_memberships sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = (select auth.uid())
        and sm.role in ('owner','manager')
    )
  );

drop policy if exists store_qris_images_delete_manager on storage.objects;
create policy store_qris_images_delete_manager on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'store-qris'
    and exists (
      select 1 from public.store_memberships sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = (select auth.uid())
        and sm.role in ('owner','manager')
    )
  );

-- Manual confirmation is only for static QRIS. Dynamic QRIS must be confirmed by a verified provider webhook.
create or replace function private.set_qris_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists store_qris_settings_updated_at on public.store_qris_settings;
create trigger store_qris_settings_updated_at before update on public.store_qris_settings
for each row execute function private.set_qris_updated_at();

revoke all on function private.set_qris_updated_at() from public, anon, authenticated;

drop trigger if exists store_qris_credentials_updated_at on public.store_qris_credentials;
create trigger store_qris_credentials_updated_at before update on public.store_qris_credentials
for each row execute function private.set_qris_updated_at();

comment on table public.store_qris_settings is 'Non-secret QRIS configuration scoped to one store; readable by that store members only.';
comment on table public.store_qris_credentials is 'Encrypted merchant credentials. No app-user policies; only trusted server functions should access this table.';
comment on column public.sales.qris_mode is 'QRIS static is manually confirmed; dynamic must be confirmed by provider webhook.';
comment on column public.sales.provider_order_id is 'Globally unique order ID sent to the payment provider, used to route webhooks to the correct store.';

-- Human-friendly, globally unique store codes while preserving immutable UUID primary keys.
alter table public.stores add column if not exists store_code text;

-- Backfill existing stores with readable name-based codes plus a short UUID suffix.
update public.stores
set store_code = upper(left(trim(both '-' from regexp_replace(
  regexp_replace(coalesce(name, 'TOKO'), '[^a-zA-Z0-9]+', '-', 'g'),
  '(^-+|-+$)', '', 'g'
)), 12)) || '-' || upper(substr(replace(id::text, '-', ''), 1, 4))
where store_code is null or btrim(store_code) = '';

alter table public.stores alter column store_code set not null;
create unique index if not exists stores_store_code_unique on public.stores (upper(store_code));

alter table public.stores drop constraint if exists stores_store_code_format_check;
alter table public.stores add constraint stores_store_code_format_check
  check (store_code = upper(store_code) and store_code ~ '^[A-Z0-9][A-Z0-9-]{2,19}$');

create or replace function public.assign_store_code()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_base text;
begin
  if new.store_code is null or btrim(new.store_code) = '' then
    v_base := upper(left(trim(both '-' from regexp_replace(
      regexp_replace(coalesce(new.name, 'TOKO'), '[^a-zA-Z0-9]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'
    )), 12));
    new.store_code := v_base || '-' || upper(substr(replace(new.id::text, '-', ''), 1, 4));
  else
    new.store_code := upper(btrim(new.store_code));
  end if;
  return new;
end;
$$;

drop trigger if exists stores_assign_store_code on public.stores;
create trigger stores_assign_store_code
before insert or update of store_code on public.stores
for each row execute function public.assign_store_code();

-- Only a store owner can change that store's human-friendly code.
create or replace function public.owner_update_store_code(p_store_id uuid, p_store_code text)
returns public.stores
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_store_code, '')));
  v_store public.stores%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Autentikasi diperlukan.' using errcode = '42501';
  end if;

  if v_code !~ '^[A-Z0-9][A-Z0-9-]{2,19}$' then
    raise exception 'ID toko harus 3–20 karakter: huruf, angka, dan tanda hubung.' using errcode = '22023';
  end if;

  select s.* into v_store
  from public.stores s
  where s.id = p_store_id
    and s.owner_id = (select auth.uid())
    and exists (
      select 1 from public.store_memberships sm
      where sm.store_id = s.id and sm.user_id = (select auth.uid()) and sm.role = 'owner'
    )
  for update;

  if not found then
    raise exception 'Hanya pemilik toko yang dapat mengubah ID toko ini.' using errcode = '42501';
  end if;

  if exists (select 1 from public.stores s where upper(s.store_code) = v_code and s.id <> p_store_id) then
    raise exception 'ID toko sudah digunakan. Pilih ID lain.' using errcode = '23505';
  end if;

  update public.stores set store_code = v_code where id = p_store_id returning * into v_store;

  insert into public.admin_audit_logs(actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'store_code_changed', 'store', p_store_id::text,
    jsonb_build_object('store_name', v_store.name, 'new_store_code', v_store.store_code));

  return v_store;
end;
$$;
revoke all on function public.owner_update_store_code(uuid, text) from public, anon;
grant execute on function public.owner_update_store_code(uuid, text) to authenticated;

comment on column public.stores.store_code is 'Human-friendly globally unique store code; stores.id remains the immutable internal UUID.';

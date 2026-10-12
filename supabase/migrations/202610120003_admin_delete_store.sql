-- Super-admin-only permanent store deletion.
-- sales.store_id and stock_movements.product_id are ON DELETE RESTRICT (financial ledger protection),
-- so a plain "delete from stores" fails once a store has transactions. This function removes the
-- dependent rows in a safe order inside ONE transaction and writes the audit record atomically.
-- The caller must type the exact store name as confirmation.

create or replace function public.admin_delete_store(p_store_id uuid, p_confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store public.stores%rowtype;
  v_staff uuid[];
  v_sales integer;
begin
  if (select auth.uid()) is null or not private.is_super_admin() then
    raise exception 'Akses administrator pusat diperlukan.' using errcode = '42501';
  end if;

  select * into v_store from public.stores where id = p_store_id for update;
  if not found then raise exception 'Toko tidak ditemukan.' using errcode = 'P0002'; end if;

  if btrim(coalesce(p_confirm, '')) <> btrim(v_store.name) then
    raise exception 'Konfirmasi nama toko tidak cocok.' using errcode = '22023';
  end if;

  -- Everyone attached to the store except its owner; the edge function decides which Auth users to remove.
  select coalesce(array_agg(distinct x.user_id), '{}') into v_staff from (
    select e.user_id from public.employees e where e.store_id = p_store_id and e.user_id is not null
    union
    select m.user_id from public.store_memberships m where m.store_id = p_store_id and m.user_id <> v_store.owner_id
  ) x;

  select count(*) into v_sales from public.sales where store_id = p_store_id;

  delete from public.sales where store_id = p_store_id;            -- sale_items cascade
  delete from public.stock_movements where store_id = p_store_id;
  delete from public.products where store_id = p_store_id;
  delete from public.stores where id = p_store_id;                  -- memberships, employees, qris settings cascade

  insert into public.admin_audit_logs(actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'store_deleted', 'store', p_store_id::text,
    jsonb_build_object('store_name', v_store.name, 'owner_id', v_store.owner_id, 'sales_deleted', v_sales));

  return jsonb_build_object('staff_user_ids', to_jsonb(v_staff), 'sales_deleted', v_sales);
end;
$$;
revoke all on function public.admin_delete_store(uuid, text) from public, anon;
grant execute on function public.admin_delete_store(uuid, text) to authenticated;

comment on function public.admin_delete_store(uuid, text) is 'Super-admin-only permanent store deletion (requires exact store name); atomic with audit log.';

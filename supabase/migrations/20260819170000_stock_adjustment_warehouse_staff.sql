-- Migration: perluasan akses Penyesuaian Stok/Saldo Awal ke warehouse_staff
-- (keputusan pemilik produk, temuan #4 audit jalan kaki 19 Agu 2026 — opname
-- harian di lapangan memang dilakukan staf gudang biasa, bukan manager).
--
-- STOCK_ADJUSTMENT_ROLES di src/lib/roles.ts sudah diperluas (app layer + UI).
-- Migration ini menambahkan gerbang YANG SAMA di level database, mengikuti pola
-- yang sama dipakai audit keamanan sebelumnya (migration 20260819150000):
-- kalau ADA klaim jwt_app_role() (transaksi dari sesi user sungguhan yang
-- login), WAJIB salah satu role gudang/leadership; kalau TIDAK ADA klaim
-- (dipanggil lewat service-role key aplikasi -- jalur SAH satu-satunya karena
-- grant fungsi ini sudah dibatasi ke service_role), pemeriksaan dilewati (bukan
-- longgar sengaja -- service-role key memang tidak pernah membawa klaim role).
create or replace function public.record_manual_stock_adjustment(
  p_lot_id integer, p_qty_delta numeric, p_reason_code text, p_notes text, p_created_by integer
)
returns table (out_lot_id integer, out_quantity_on_hand numeric, out_stock_movement_id integer)
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_company_id integer;
  v_current_qty numeric;
  v_new_qty numeric;
  v_movement_id integer;
begin
  if public.jwt_app_role() is not null and not (public.jwt_is_company_leadership() or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff')) then
    raise exception 'Role Anda tidak punya izin melakukan penyesuaian stok.';
  end if;

  if p_qty_delta = 0 then
    raise exception 'Jumlah penyesuaian tidak boleh 0.';
  end if;
  if p_reason_code not in ('stock_opname_variance', 'damaged', 'other') then
    raise exception 'Kode alasan tidak valid.';
  end if;

  select company_id, quantity_on_hand into v_company_id, v_current_qty
  from lots where lot_id = p_lot_id for update;

  if v_company_id is null then
    raise exception 'Lot % tidak ditemukan.', p_lot_id;
  end if;

  v_new_qty := v_current_qty + p_qty_delta;
  if v_new_qty < 0 then
    raise exception 'Penyesuaian ini membuat stok jadi negatif (stok sekarang %, penyesuaian %).', v_current_qty, p_qty_delta;
  end if;

  update lots set quantity_on_hand = v_new_qty where lot_id = p_lot_id;

  insert into stock_movements (company_id, lot_id, movement_type, qty, reference_doc, reason_code, notes, created_by)
  values (v_company_id, p_lot_id, 'adjustment', p_qty_delta, 'Penyesuaian stok manual', p_reason_code, p_notes, p_created_by)
  returning stock_movement_id into v_movement_id;

  return query select p_lot_id, v_new_qty, v_movement_id;
end;
$function$;

revoke execute on function public.record_manual_stock_adjustment(integer, numeric, text, text, integer) from public, anon, authenticated;
grant execute on function public.record_manual_stock_adjustment(integer, numeric, text, text, integer) to service_role;

create or replace function public.create_opening_balance_lot(
  p_company_id integer, p_item_id integer, p_production_plant_id integer, p_qty numeric, p_lot_number text,
  p_expiry_date date, p_notes text, p_created_by integer, p_unit_cost numeric default null
)
returns table (out_lot_id integer, out_lot_number text, out_stock_movement_id integer)
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_lot_id integer;
  v_movement_id integer;
begin
  if public.jwt_app_role() is not null and not (public.jwt_is_company_leadership() or public.jwt_app_role() in ('warehouse_manager', 'warehouse_staff')) then
    raise exception 'Role Anda tidak punya izin membuat saldo awal stok.';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Jumlah saldo awal harus lebih besar dari 0.';
  end if;
  if p_lot_number is null or length(trim(p_lot_number)) = 0 then
    raise exception 'Nomor lot wajib diisi.';
  end if;

  insert into lots (company_id, production_plant_id, item_id, lot_number, expiry_date, source_type, status, quantity_on_hand, unit_cost)
  values (p_company_id, p_production_plant_id, p_item_id, p_lot_number, p_expiry_date, 'opening_balance', 'available', p_qty, p_unit_cost)
  returning lot_id, lot_number into v_lot_id, p_lot_number;

  insert into stock_movements (company_id, lot_id, movement_type, qty, reference_doc, reason_code, notes, created_by)
  values (p_company_id, v_lot_id, 'adjustment', p_qty, 'Saldo awal stok opname', 'stock_opname_variance', p_notes, p_created_by)
  returning stock_movement_id into v_movement_id;

  return query select v_lot_id, p_lot_number, v_movement_id;
end;
$function$;

revoke execute on function public.create_opening_balance_lot(integer, integer, integer, numeric, text, date, text, integer, numeric) from public, anon, authenticated;
grant execute on function public.create_opening_balance_lot(integer, integer, integer, numeric, text, date, text, integer, numeric) to service_role;

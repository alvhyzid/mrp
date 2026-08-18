-- Migration: create_opening_balance_lot() diperluas menerima p_unit_cost OPSIONAL
-- (default NULL, perilaku lama utuh) — GELOMBANG 0B awalnya cuma untuk kasus "belum
-- tahu harganya", tapi data stok opname riil (docs/saldo-awal-gudang-karanglo-180826.md)
-- PUNYA harga per-unit presisi penuh per lot, jadi field ini harus bisa diisi saat
-- entri saldo awal, bukan cuma diedit belakangan lewat mekanisme lain.
--
-- "create or replace" TIDAK cukup di sini — signature parameter berubah (9 argumen,
-- bukan 8), jadi Postgres akan menganggapnya fungsi BARU (overload), bukan mengganti
-- yang lama. Drop dulu versi lama secara eksplisit supaya cuma ada 1 versi kanonik.
drop function if exists public.create_opening_balance_lot(integer, integer, integer, numeric, text, date, text, integer);

create or replace function public.create_opening_balance_lot(
  p_company_id integer,
  p_item_id integer,
  p_production_plant_id integer,
  p_qty numeric,
  p_lot_number text,
  p_expiry_date date,
  p_notes text,
  p_created_by integer,
  p_unit_cost numeric default null
) returns table (out_lot_id integer, out_lot_number text, out_stock_movement_id integer)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_lot_id integer;
  v_movement_id integer;
begin
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
$$;

grant execute on function public.create_opening_balance_lot(integer, integer, integer, numeric, text, date, text, integer, numeric) to authenticated, service_role;

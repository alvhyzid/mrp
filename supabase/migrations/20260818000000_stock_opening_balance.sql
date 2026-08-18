-- Migration: Saldo Awal Stok (GELOMBANG 0B, rencana-ams-mvp.md) — audit 18 Agu 2026
-- menemukan TIDAK ADA cara UI membuat LOT BARU tanpa lewat goods receipt (PO
-- supplier). Pemilik produk perlu menginput data stok pabrik dari PDF stok opname
-- SEBELUM ada PO/GR terkait — mis. bahan baku yang sudah ada di gudang sejak lama.
--
-- 'opening_balance' ditambahkan sebagai source_type BARU (bukan reuse 'purchased')
-- supaya lot hasil entri saldo awal tetap bisa dibedakan dari goods receipt asli —
-- traceability tetap jujur (lot ini TIDAK punya jejak PO/supplier sungguhan).
alter table if exists lots drop constraint if exists lots_source_type_check;
alter table if exists lots
  add constraint lots_source_type_check check (source_type in ('purchased', 'produced', 'customer_supplied', 'opening_balance'));

-- Fungsi atomik: insert lots BARU + insert stock_movements (movement_type='adjustment')
-- dalam 1 transaksi — pola SAMA PERSIS seperti record_manual_stock_adjustment()
-- (migration 20260817120000), bedanya di sini lot-nya belum ada sama sekali (dibuat
-- di sini), bukan menyesuaikan lot yang sudah ada.
create or replace function public.create_opening_balance_lot(
  p_company_id integer,
  p_item_id integer,
  p_production_plant_id integer,
  p_qty numeric,
  p_lot_number text,
  p_expiry_date date,
  p_notes text,
  p_created_by integer
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

  insert into lots (company_id, production_plant_id, item_id, lot_number, expiry_date, source_type, status, quantity_on_hand)
  values (p_company_id, p_production_plant_id, p_item_id, p_lot_number, p_expiry_date, 'opening_balance', 'available', p_qty)
  returning lot_id, lot_number into v_lot_id, p_lot_number;

  insert into stock_movements (company_id, lot_id, movement_type, qty, reference_doc, reason_code, notes, created_by)
  values (p_company_id, v_lot_id, 'adjustment', p_qty, 'Saldo awal stok opname', 'stock_opname_variance', p_notes, p_created_by)
  returning stock_movement_id into v_movement_id;

  return query select v_lot_id, p_lot_number, v_movement_id;
end;
$$;

grant execute on function public.create_opening_balance_lot(integer, integer, integer, numeric, text, date, text, integer) to authenticated, service_role;

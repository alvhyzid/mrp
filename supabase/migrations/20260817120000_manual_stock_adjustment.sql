-- Migration: Penyesuaian Stok Manual (Warehouse) — audit 16 Agu 2026 menemukan
-- `adjustment` sudah terdaftar sebagai movement_type valid sejak awal skema, tapi
-- TIDAK ADA satu pun kode/fitur yang pernah membuatnya — tidak ada cara resmi
-- menyesuaikan stok manual (mis. koreksi stok opname, barang rusak) di sistem ini.

-- reason_code/notes: kolom baru khusus movement_type='adjustment' (nullable untuk
-- movement_type lain yang tidak butuh alasan, mis. production_issue/receipt).
alter table if exists stock_movements
  add column if not exists reason_code text,
  add column if not exists notes text;

alter table if exists stock_movements
  add constraint stock_movements_reason_code_check
  check (reason_code is null or reason_code in ('stock_opname_variance', 'damaged', 'other'));

-- Fungsi atomik: update lots.quantity_on_hand DAN insert stock_movements dalam SATU
-- transaksi (pola yang sama seperti trigger_recompute_stock_projection() untuk
-- production_issue) — dipanggil lewat .rpc() dari server, bukan 2 query terpisah,
-- supaya benar-benar atomik (2 panggilan REST terpisah TIDAK dijamin 1 transaksi).
create or replace function public.record_manual_stock_adjustment(
  p_lot_id integer,
  p_qty_delta numeric,
  p_reason_code text,
  p_notes text,
  p_created_by integer
) returns table (out_lot_id integer, out_quantity_on_hand numeric, out_stock_movement_id integer)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id integer;
  v_current_qty numeric;
  v_new_qty numeric;
  v_movement_id integer;
begin
  if p_qty_delta = 0 then
    raise exception 'Jumlah penyesuaian tidak boleh 0.';
  end if;
  if p_reason_code not in ('stock_opname_variance', 'damaged', 'other') then
    raise exception 'Kode alasan tidak valid.';
  end if;

  -- "for update" mengunci baris lot ini sampai transaksi selesai — kalau ada 2
  -- penyesuaian nyaris bersamaan ke lot yang sama, yang kedua menunggu giliran
  -- (dibaca ulang qty TERBARU setelah yang pertama commit), bukan balapan baca
  -- qty basi lalu sama-sama menghitung dari angka yang sama.
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
$$;

grant execute on function public.record_manual_stock_adjustment(integer, numeric, text, text, integer) to authenticated, service_role;

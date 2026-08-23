-- MST-19 — Min Stock Level berbasis PERSEN DARI JUMLAH YANG PERNAH MASUK.
--
-- KEPUTUSAN PEMILIK PRODUK (24 Agu 2026): ambang stok minimum diisi sebagai PERSEN,
-- dan persennya dihitung terhadap JUMLAH YANG PERNAH MASUK untuk item itu — BUKAN
-- terhadap stok saat ini.
--
-- ALASAN "BUKAN DARI STOK SAAT INI", dan ini inti keputusannya: ambang yang dihitung
-- dari stok saat ini ikut TURUN setiap kali stok turun. Artinya ambangnya menghilang
-- justru pada saat stok menipis — persis saat ia paling dibutuhkan. Ambang harus berdiri
-- di atas sesuatu yang TIDAK ikut bergerak bersama yang diukurnya.

alter table items add column if not exists min_stock_percent numeric;

comment on column items.min_stock_percent is
  'Ambang stok minimum sebagai PERSEN dari jumlah yang pernah masuk untuk item ini (MST-19). '
  'NULL = item ini memakai ambang angka mutlak lama di min_stock_level. Bila terisi, kolom ini MENANG.';

alter table items drop constraint if exists items_min_stock_percent_check;
alter table items add constraint items_min_stock_percent_check
  check (min_stock_percent is null or (min_stock_percent > 0 and min_stock_percent <= 100));

-- ============================================================================
-- Jumlah yang PERNAH MASUK per item.
--
-- Yang dihitung sebagai "masuk": penerimaan barang (receipt), hasil produksi
-- (production_output), dan penyesuaian POSITIF (adjustment dengan qty > 0, mis. hasil
-- stok opname yang menemukan lebih).
--
-- Yang TIDAK dihitung: pemakaian produksi, pengiriman, dan penyesuaian negatif — itu
-- barang KELUAR. Kalau keluar ikut dihitung, "yang pernah masuk" akan menyusut setiap
-- kali barang dipakai, dan ambangnya kembali ikut bergerak bersama stok — persis yang
-- ingin dihindari.
create or replace function total_qty_pernah_masuk(p_company_id integer, p_item_id integer)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(sm.qty), 0)
  from stock_movements sm
  join lots l on l.lot_id = sm.lot_id
  where sm.company_id = p_company_id
    and l.item_id = p_item_id
    and (
      sm.movement_type in ('receipt', 'production_output')
      or (sm.movement_type = 'adjustment' and sm.qty > 0)
    );
$$;

comment on function total_qty_pernah_masuk(integer, integer) is
  'Jumlah yang PERNAH MASUK untuk sebuah item (MST-19): receipt + production_output + adjustment positif. '
  'Barang keluar TIDAK dikurangkan — bila dikurangkan, angka ini ikut menyusut saat barang dipakai dan '
  'ambang stok minimum jadi bergerak bersama stok yang diukurnya.';

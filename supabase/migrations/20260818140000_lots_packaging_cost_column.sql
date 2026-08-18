-- Migration: lots.packaging_cost — koreksi arsitektur setelah verifikasi ulang terhadap
-- spesifikasi-aturan-biaya-v1.md §5 Contoh 1: "Biaya produksi per botol" (bahan+SDM,
-- Rp22.891,33) dan "Kemasan per botol" (Rp8.829,63) DITAMPILKAN & DIHITUNG TERPISAH
-- (baru dijumlah di langkah Margin: rumus §3 "Biaya produksi order = Σ biaya batch +
-- biaya kemasan" — 2 SUKU TERPISAH, bukan 1 angka gabungan). Packaging TETAP dikonsumsi
-- lewat work_order_consumption yang SAMA PERSIS seperti bahan baku (K6, GELOMBANG 0A
-- tetap benar di level MEKANISME) — yang berubah cuma bagaimana lots.unit_cost dihitung:
-- unit_cost SEKARANG hanya mencakup bahan raw_material/wip + SDM (BUKAN packaging),
-- packaging_cost dipisah ke kolom baru ini, dihitung dengan pembagi yang SAMA (qty
-- output utama batch itu) supaya "per unit" tetap konsisten antara keduanya.
alter table if exists lots add column if not exists packaging_cost numeric(14,4);

-- lots_secure (migration 20260812152500) perlu memasukkan kolom baru ini dengan
-- masking SAMA seperti unit_cost (sama-sama data finansial sensitif). Kolom baru
-- HARUS ditambahkan di AKHIR select list — Postgres "create or replace view"
-- menolak mengubah posisi ordinal kolom yang sudah ada (mis. menyisipkan kolom baru
-- SEBELUM created_at akan menggeser created_at, yang ditolak).
create or replace view lots_secure
with (security_invoker = false)
as
select
  lot_id,
  company_id,
  production_plant_id,
  item_id,
  lot_number,
  expiry_date,
  produced_or_received_date,
  quantity_on_hand,
  source_type,
  status,
  case when public.jwt_can_view_financial_data() then unit_cost else null end as unit_cost,
  created_at,
  case when public.jwt_can_view_financial_data() then packaging_cost else null end as packaging_cost
from lots
where company_id = public.jwt_company_id();

grant select on lots_secure to authenticated;

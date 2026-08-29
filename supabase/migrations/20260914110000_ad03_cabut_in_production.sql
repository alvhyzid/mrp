-- AD-03 — MENCABUT `in_production` SEBAGAI STATUS SALES ORDER.
--
-- KEPUTUSAN ARSITEKTUR (30 Agu 2026): status yang bukan milik Sales dan tidak pernah ditulis
-- oleh implementasi siklus hidup yang sah HARUS dicabut -- bukan diberi pemicu, bukan diganti
-- status pengganti.
--
-- BUKTI YANG MENDASARINYA, seluruhnya terukur sebelum migrasi ini ditulis:
--   * Nol kode di seluruh repositori menulis 'in_production' ke sales_orders.
--     Satu-satunya penulis status Sales Order: putuskan_pembatalan() -> 'cancelled',
--     selesaikan_sales_order() -> 'completed'.
--   * Kemajuan produksi SUDAH diturunkan saat dibaca (turunkanEksekusiSo), sesuai AD-01/DEC-S11.
--     Kebenaran produksi milik Manufacturing; menyimpan salinannya di Sales melahirkan sumber
--     kebenaran kedua.
--   * Nol baris berstatus 'in_production' di ketiga project (nyata, uji, CI).
--
-- JENDELA INI TERBUKA HARI INI DAN AKAN TERTUTUP: begitu ada Sales Order sungguhan yang
-- pernah memakainya, pencabutan memerlukan migrasi data historis.

do $$
declare
  v_sisa integer;
begin
  select count(*) into v_sisa from sales_orders where status = 'in_production';
  -- GAGAL KERAS, bukan diam-diam melewati: mencabut status yang masih dipakai baris nyata
  -- akan membuat baris itu melanggar kekangannya sendiri dan tidak bisa disimpan lagi.
  if v_sisa > 0 then
    raise exception 'Ada % Sales Order berstatus in_production. Pencabutan dibatalkan -- butuh migrasi data historis lebih dulu.', v_sisa;
  end if;
end;
$$;

-- Aturan transisi yang menyebutnya ikut dicabut: aturan menuju status yang tidak ada lagi
-- adalah aturan yang tidak akan pernah bisa dipakai.
delete from status_transition_rules
where table_name = 'sales_orders'
  and (from_status = 'in_production' or to_status = 'in_production');

alter table sales_orders drop constraint if exists sales_orders_status_check;
alter table sales_orders add constraint sales_orders_status_check
  check (status in ('confirmed', 'completed', 'cancelled'));

comment on column sales_orders.status is
  'Status KOMERSIAL Sales Order: confirmed -> completed | cancelled. Status produksi dan pengiriman TIDAK disimpan di sini -- keduanya milik Manufacturing dan Logistik, dan diturunkan saat dibaca (AD-01, DEC-S11, AD-03).';

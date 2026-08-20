-- Penggantian studi kasus produk uji: Gummy Zala + Drinkme -> MLVT (Minuman Serbuk
-- Susu Kambing Etawa), 26 Agu 2026. Lampu hijau eksplisit pemilik produk setelah audit
-- Tahap 1 (lihat HANDOFF.md) -- SAS001 & SAS005 DIHAPUS PERMANEN (bukan diarsipkan,
-- keputusan eksplisit), item/formulasi produk lama DIARSIPKAN (bukan dihapus, prinsip
-- "jangan hapus master yang direferensikan"). SELURUH bahan baku, lot, karyawan,
-- payroll, plant, harga master, FOH, konfigurasi, routing serbuk 10 tahap, 5 premix
-- serbuk, standar K8, kemasan Etawa Fit, plastic wrap box TIDAK DISENTUH sama sekali.
--
-- SATU TRANSAKSI (pelajaran dari insiden cleanup test 182 baris companies yatim, lihat
-- migrasi 20260826100000): migrasi ini SATU FILE, dijalankan Postgres sebagai satu
-- transaksi oleh `supabase db push` -- kalau ADA SATU statement gagal, SEMUA batal,
-- tidak ada kondisi "berhenti di tengah jalan" yang menyisakan baris yatim.
--
-- IDEMPOTEN: setiap DELETE/UPDATE pakai WHERE yang cocok hanya sekali (po_number/
-- item_code persis) -- dijalankan ulang (mis. lewat re-apply manual di staging)
-- menghasilkan 0 baris berubah pada percobaan kedua, TIDAK error.
--
-- PORTABEL staging<->dev: dicocokkan lewat po_number/item_code/nama perusahaan, BUKAN
-- primary key literal (ID berbeda antar project) -- migrasi yang SAMA PERSIS bisa
-- diuji di staging dulu, baru dijalankan ke dev, tanpa diedit.
--
-- DIHAPUS PERMANEN (14 baris di dev, sesuai audit Tahap 1 -- 0 turunan produksi
-- pernah ada: nol work_orders/production_batches/work_order_consumption/
-- work_order_outputs/lots/lot_genealogy/shipments/delivery_confirmations/
-- document_signatures/labor log/system_alerts untuk kedua order ini, diverifikasi
-- ULANG 26 Agu 2026 termasuk system_alerts.related_po_id secara khusus):
--   sales_order_line_margin_snapshots (baseline Margin Watch, 0 baris saat ini --
--   dihapus defensif kalau sempat dibuat lagi sebelum migrasi ini dijalankan) ->
--   sales_order_line_feasibility_snapshots -> sales_order_lines -> sales_orders ->
--   customer_po_approvals -> customer_purchase_orders (PO "SAS001"/"SAS005", company "PT ITM")
--   + system_alerts (related_work_order_id/related_item_id/related_po_id, 0 baris
--   saat ini, dihapus defensif dengan alasan sama).
--
-- DIARSIPKAN (is_active=false utk items, status='archived' utk boms -- TIDAK dihapus):
--   FG-GUMMY-ZALA-N200, PMBX001ITM (Box Minuman Serbuk), PMSC001ITM (WIP Sachet),
--   WIP-PREMIX-GELATIN-ZALA (WIP Premix Gelatin -- analog WIP Sachet, ikut diarsipkan
--   walau tidak eksplisit disebutkan pemilik produk, sama alasannya: formulasi khusus
--   Gummy Zala, bukan bahan baku generik), PKG-BOTOL-PET-N200, PKG-LABEL-STIKER-N200,
--   PKG-INNER-SLEEVE, PKG-OUTER-BOX, PKG-SEAL-STICKER, PKG-KARTON-GUMMY-27,
--   PMPKB001ITM (Box isi 14), PKG-KARTON-SERBUK-42, + 4 BOM terkait (Gummy Zala,
--   Premix Gelatin, Drinkme Sachet, Drinkme Box).
--
-- SENGAJA TIDAK disentuh (raw material generik, bisa dipakai ulang produk apa pun,
-- lihat prinsip "bangun untuk kebutuhan nyata" -- termasuk PTS-01/SOD-01/
-- FLA-DELIFRU-STRAWFRU-01 yang baru ditambahkan 25 Agu 2026 utk formula resmi Gummy
-- Zala V2 -- preservative & flavor generik, tidak diarsipkan sekalipun formulanya
-- diarsipkan): PMPKF001ITM (Sachet Drinkme, 260.000 pcs) dan PKG-PLASTIC-WRAP-BOX
-- (6.000 pcs) -- KEPUTUSAN FINAL pemilik produk 26 Agu 2026 ("penegasan lingkup"):
-- KEDUANYA TETAP AKTIF, TIDAK diarsipkan, TERLEPAS dari tercetak merek atau polos
-- (pertanyaan 1d TIDAK PERLU dijawab lagi) -- alasannya bukan status cetak, tapi
-- keduanya punya STOK BERNILAI SUNGGUHAN yang bisa dipakai ulang studi kasus lain.

-- BUKTI WAJIB pasca-eksekusi (instruksi eksplisit): total nilai persediaan available
-- (SUM quantity_on_hand x unit_cost, company "PT ITM") HARUS SAMA PERSIS sebelum &
-- sesudah migrasi ini -- migrasi ini TIDAK PERNAH menyentuh tabel `lots` sama sekali
-- (tidak ada DELETE/UPDATE terhadap lots di bawah), jadi identik by construction;
-- baseline dev tercatat 26 Agu 2026: Rp270.766.422,02 / 37 lot available.

do $$
declare
  v_company_id integer;
  v_deleted_margin integer;
  v_deleted_alerts integer;
  v_deleted_feasibility integer;
  v_deleted_sol integer;
  v_deleted_so integer;
  v_deleted_approvals integer;
  v_deleted_cpo integer;
  v_archived_items integer;
  v_archived_boms integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Tidak ada company bernama PT ITM di project ini -- tidak ada yang dihapus/diarsipkan (aman, migrasi ini portable staging/dev).';
    return;
  end if;

  with target_cpo as (
    select customer_purchase_order_id from customer_purchase_orders
    where company_id = v_company_id and po_number in ('SAS001', 'SAS005')
  ),
  target_so as (
    select sales_order_id from sales_orders
    where customer_purchase_order_id in (select customer_purchase_order_id from target_cpo)
  ),
  target_sol as (
    select sales_order_line_id from sales_order_lines
    where sales_order_id in (select sales_order_id from target_so)
  ),
  del_margin as (
    delete from sales_order_line_margin_snapshots
    where sales_order_line_id in (select sales_order_line_id from target_sol)
    returning 1
  )
  select count(*) into v_deleted_margin from del_margin;

  with target_cpo as (
    select customer_purchase_order_id from customer_purchase_orders
    where company_id = v_company_id and po_number in ('SAS001', 'SAS005')
  ),
  target_so as (
    select sales_order_id from sales_orders
    where customer_purchase_order_id in (select customer_purchase_order_id from target_cpo)
  ),
  target_wo as (
    -- Defensif -- audit Tahap 1 (26 Agu 2026) memastikan 0 work_orders pernah ada
    -- untuk SAS001/SAS005 (nol produksi pernah berjalan), jadi ini SELALU kosong,
    -- tapi tetap ditulis benar (bukan perbandingan ID yang salah ruang) untuk jaga-jaga.
    select work_order_id from work_orders
    where sales_order_line_id in (
      select sales_order_line_id from sales_order_lines where sales_order_id in (select sales_order_id from target_so)
    )
  ),
  del_alerts as (
    delete from system_alerts
    where company_id = v_company_id
      and (
        related_work_order_id in (select work_order_id from target_wo)
        or related_po_id in (select customer_purchase_order_id from target_cpo)
      )
    returning 1
  )
  select count(*) into v_deleted_alerts from del_alerts;

  with target_cpo as (
    select customer_purchase_order_id from customer_purchase_orders
    where company_id = v_company_id and po_number in ('SAS001', 'SAS005')
  ),
  target_so as (
    select sales_order_id from sales_orders
    where customer_purchase_order_id in (select customer_purchase_order_id from target_cpo)
  ),
  target_sol as (
    select sales_order_line_id from sales_order_lines
    where sales_order_id in (select sales_order_id from target_so)
  ),
  del_feas as (
    delete from sales_order_line_feasibility_snapshots
    where sales_order_line_id in (select sales_order_line_id from target_sol)
    returning 1
  )
  select count(*) into v_deleted_feasibility from del_feas;

  with target_cpo as (
    select customer_purchase_order_id from customer_purchase_orders
    where company_id = v_company_id and po_number in ('SAS001', 'SAS005')
  ),
  target_so as (
    select sales_order_id from sales_orders
    where customer_purchase_order_id in (select customer_purchase_order_id from target_cpo)
  ),
  del_sol as (
    delete from sales_order_lines
    where sales_order_id in (select sales_order_id from target_so)
    returning 1
  )
  select count(*) into v_deleted_sol from del_sol;

  with target_cpo as (
    select customer_purchase_order_id from customer_purchase_orders
    where company_id = v_company_id and po_number in ('SAS001', 'SAS005')
  ),
  del_so as (
    delete from sales_orders
    where customer_purchase_order_id in (select customer_purchase_order_id from target_cpo)
    returning 1
  )
  select count(*) into v_deleted_so from del_so;

  with target_cpo as (
    select customer_purchase_order_id from customer_purchase_orders
    where company_id = v_company_id and po_number in ('SAS001', 'SAS005')
  ),
  del_approvals as (
    delete from customer_po_approvals
    where customer_purchase_order_id in (select customer_purchase_order_id from target_cpo)
    returning 1
  )
  select count(*) into v_deleted_approvals from del_approvals;

  with del_cpo as (
    delete from customer_purchase_orders
    where company_id = v_company_id and po_number in ('SAS001', 'SAS005')
    returning 1
  )
  select count(*) into v_deleted_cpo from del_cpo;

  with archived as (
    update items set is_active = false
    where company_id = v_company_id
      and item_code in (
        'FG-GUMMY-ZALA-N200', 'PMBX001ITM', 'PMSC001ITM', 'WIP-PREMIX-GELATIN-ZALA',
        'PKG-BOTOL-PET-N200', 'PKG-LABEL-STIKER-N200', 'PKG-INNER-SLEEVE', 'PKG-OUTER-BOX',
        'PKG-SEAL-STICKER', 'PKG-KARTON-GUMMY-27', 'PMPKB001ITM', 'PKG-KARTON-SERBUK-42'
      )
      and is_active = true
    returning 1
  )
  select count(*) into v_archived_items from archived;

  with archived_boms as (
    update boms set status = 'archived'
    where company_id = v_company_id
      and parent_item_id in (
        select item_id from items where company_id = v_company_id
        and item_code in ('FG-GUMMY-ZALA-N200', 'WIP-PREMIX-GELATIN-ZALA', 'PMSC001ITM', 'PMBX001ITM')
      )
      and status = 'active'
    returning 1
  )
  select count(*) into v_archived_boms from archived_boms;

  raise notice 'Dihapus: % margin_snapshots, % system_alerts, % feasibility_snapshots, % sales_order_lines, % sales_orders, % customer_po_approvals, % customer_purchase_orders. Diarsipkan: % items, % boms.',
    v_deleted_margin, v_deleted_alerts, v_deleted_feasibility, v_deleted_sol, v_deleted_so, v_deleted_approvals, v_deleted_cpo, v_archived_items, v_archived_boms;
end $$;

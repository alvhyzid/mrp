-- BAGIAN 3 (25 Agu 2026) — PEMBERSIHAN DATA STUDI KASUS MLVT untuk PT ITM.
--
-- ================= KENAPA INI BOLEH DIHAPUS =================
--
-- Karena SUDAH DIBUKTIKAN bisa dibangun ulang, bukan karena diasumsikan. Migrasi
-- 20260827120000_mlvt_case_study_skeleton.sql dijalankan DUA KALI di project uji pada
-- 24 Agu 2026 dan menghasilkan angka yang identik: 8 item, 6 BOM, 7 baris BOM, 2 routing,
-- 10 langkah, 1 pelanggan, 1 SO, 1 PO klien. Idempoten, dan berjalan di atas skema hari ini.
--
-- SYARAT YANG MENOPANG ITU, dan yang membuat pabrik TIDAK BOLEH ikut dihapus: migrasi MLVT
-- MENOLAK JALAN bila pabrik "KL Bizhub (Karanglo)" tidak ada, dan TIDAK ADA satu migrasi pun
-- yang membuat pabrik itu (migrasi konsolidasi hanya menggabung & menghapus yang sudah ada).
-- Menghapus atau mengganti nama pabrik itu memutus kemampuan membangun ulang, diam-diam.
--
-- ================= YANG SENGAJA TIDAK DISENTUH =================
--
--   companies (PT ITM & Company B), users, employees beserta seluruh kolom payroll,
--   production_plants (3), work_centers, shifts, build_tasks, kpi_registry,
--   kamus_terms, document_types, dan seluruh master lain yang bukan data MLVT.
--
-- Company B khususnya: ia tenant uji resmi yang dipakai SELURUH verifikasi visual.
-- Menghapusnya memutus cara kerja yang sedang berjalan. Baris miliknya dilindungi dengan
-- menyaring `company_id = v_company_id` pada SETIAP penghapusan bertenant.
--
-- ================= KENAPA TIDAK MEMAKAI session_replication_role =================
--
-- Karena cara itu SUDAH terbukti meninggalkan puing. Migrasi pembersihan lama memakainya
-- lalu menyapu HANYA tabel yang punya kolom company_id -- dan tabel anak tanpa kolom itu
-- tidak pernah tersentuh sementara induknya terhapus tanpa perlawanan. Sisanya masih ada
-- sampai hari ini: 561 baris customer_po_approvals dan 1 work_order_outputs yang menunjuk
-- induk yang tidak ada (AUD-31).
--
-- Di sini penegakan kunci asing DIBIARKAN HIDUP, dan setiap tabel anak dihapus EKSPLISIT
-- lewat join ke induknya. Bila ada satu tabel anak yang terlewat, migrasi ini GAGAL KERAS
-- menyebut namanya -- jauh lebih baik daripada berhasil diam-diam sambil meninggalkan puing.
--
-- IDEMPOTEN: seluruhnya DELETE bersyarat. Jalankan berkali-kali, jalankan kedua menghapus
-- 0 baris karena tidak ada lagi yang cocok.

do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- pembersihan dilewati (no-op).';
    return;
  end if;

  -- ═══ 1. Lapis terdalam: anak dari langkah routing & item ═══
  delete from production_standard_samples where company_id = v_company_id;
  delete from production_standard_proposals where company_id = v_company_id;
  delete from production_standard_exclusions where company_id = v_company_id;
  delete from production_standards where company_id = v_company_id;
  delete from routing_step_standard_crew
    where routing_step_id in (
      select rs.routing_step_id from routing_steps rs
      join routings r on r.routing_id = rs.routing_id
      where r.company_id = v_company_id
    );

  -- ═══ 2. Produksi ═══
  delete from work_order_step_progress
    where work_order_id in (select work_order_id from work_orders where company_id = v_company_id);
  delete from work_order_assignments
    where work_order_id in (select work_order_id from work_orders where company_id = v_company_id);
  delete from work_order_consumption
    where work_order_id in (select work_order_id from work_orders where company_id = v_company_id);
  delete from work_order_outputs
    where work_order_id in (select work_order_id from work_orders where company_id = v_company_id);
  delete from production_batch_bom_line_snapshots where company_id = v_company_id;
  delete from production_disruptions where company_id = v_company_id;
  delete from production_batches where company_id = v_company_id;
  delete from work_orders where company_id = v_company_id;

  -- ═══ 3. Pengiriman ═══
  delete from delivery_confirmations
    where shipment_id in (select shipment_id from shipments where company_id = v_company_id);
  delete from shipment_lines
    where shipment_id in (select shipment_id from shipments where company_id = v_company_id);
  delete from shipments where company_id = v_company_id;

  -- ═══ 4. Penjualan ═══
  delete from sales_order_line_margin_snapshots where company_id = v_company_id;
  delete from sales_order_line_feasibility_snapshots where company_id = v_company_id;
  delete from sales_order_lines
    where sales_order_id in (select sales_order_id from sales_orders where company_id = v_company_id);
  delete from sales_orders where company_id = v_company_id;

  delete from customer_po_approvals
    where customer_purchase_order_id in (
      select customer_purchase_order_id from customer_purchase_orders where company_id = v_company_id
    );
  delete from customer_purchase_order_lines
    where customer_purchase_order_id in (
      select customer_purchase_order_id from customer_purchase_orders where company_id = v_company_id
    );
  delete from customer_purchase_orders where company_id = v_company_id;
  delete from customer_delivery_addresses
    where customer_id in (select customer_id from customers where company_id = v_company_id);
  delete from customers where company_id = v_company_id;

  -- ═══ 5. Pembelian & penerimaan ═══
  delete from goods_receipt_overage_log where company_id = v_company_id;
  delete from goods_receipt_lines
    where goods_receipt_id in (select goods_receipt_id from goods_receipts where company_id = v_company_id);
  delete from goods_receipts where company_id = v_company_id;
  delete from purchase_order_lines
    where purchase_order_id in (select purchase_order_id from purchase_orders where company_id = v_company_id);
  delete from purchase_orders where company_id = v_company_id;
  delete from supplier_item_prices where company_id = v_company_id;
  delete from suppliers where company_id = v_company_id;

  -- ═══ 6. Stok & lot ═══
  -- lot_genealogy TIDAK punya kolom company_id -- ia dijangkau lewat lot induknya.
  -- Kolomnya `output_lot_id` / `component_lot_id`, bukan `child_lot_id`.
  delete from lot_genealogy
    where output_lot_id in (select lot_id from lots where company_id = v_company_id)
       or component_lot_id in (select lot_id from lots where company_id = v_company_id);
  delete from stock_movements where company_id = v_company_id;
  delete from lots where company_id = v_company_id;

  -- ═══ 7. Resep & rute ═══
  delete from bom_lines where bom_id in (select bom_id from boms where company_id = v_company_id);
  delete from boms where company_id = v_company_id;
  delete from routing_steps where routing_id in (select routing_id from routings where company_id = v_company_id);
  delete from routings where company_id = v_company_id;

  -- ═══ 8. Item, jejak, dan peringatan ═══
  delete from system_alerts where company_id = v_company_id;
  delete from status_transition_log where company_id = v_company_id;
  delete from kpi_snapshots where company_id = v_company_id;
  delete from document_links
    where document_id in (select document_id from documents where company_id = v_company_id);
  delete from documents where company_id = v_company_id;
  delete from items where company_id = v_company_id;

  raise notice 'Pembersihan MLVT selesai untuk company_id=%', v_company_id;
end $$;

-- ============================================================================
-- B.3 — SAPUAN BARIS YATIM, berlaku SELURUH TENANT.
--
-- Ini membereskan puing yang ditinggalkan pembersihan-pembersihan LAMA yang memakai
-- session_replication_role (AUD-31). Barisnya menunjuk induk yang sudah tidak ada, jadi
-- tidak ada yang bisa merujuknya dan tidak ada yang bisa rusak karenanya.
--
-- Disengaja TIDAK dibatasi company_id: baris yatim justru tidak lagi punya induk yang
-- menyatakan ia milik siapa. Menyaring per tenant di sini akan melewatkan tepat yang dicari.
-- ============================================================================
delete from customer_po_approvals a
  where not exists (select 1 from customer_purchase_orders p where p.customer_purchase_order_id = a.customer_purchase_order_id);

delete from customer_purchase_order_lines l
  where not exists (select 1 from customer_purchase_orders p where p.customer_purchase_order_id = l.customer_purchase_order_id);

delete from work_order_outputs o
  where not exists (select 1 from work_orders w where w.work_order_id = o.work_order_id);

delete from work_order_consumption c
  where not exists (select 1 from work_orders w where w.work_order_id = c.work_order_id);

delete from work_order_assignments a
  where not exists (select 1 from work_orders w where w.work_order_id = a.work_order_id);

delete from work_order_step_progress p
  where not exists (select 1 from work_orders w where w.work_order_id = p.work_order_id);

delete from routing_step_standard_crew c
  where not exists (select 1 from routing_steps rs where rs.routing_step_id = c.routing_step_id);

delete from routing_steps rs
  where not exists (select 1 from routings r where r.routing_id = rs.routing_id);

delete from bom_lines bl
  where not exists (select 1 from boms b where b.bom_id = bl.bom_id);

delete from sales_order_lines sl
  where not exists (select 1 from sales_orders s where s.sales_order_id = sl.sales_order_id);

delete from shipment_lines sl
  where not exists (select 1 from shipments s where s.shipment_id = sl.shipment_id);

delete from delivery_confirmations dc
  where not exists (select 1 from shipments s where s.shipment_id = dc.shipment_id);

delete from goods_receipt_lines gl
  where not exists (select 1 from goods_receipts g where g.goods_receipt_id = gl.goods_receipt_id);

delete from purchase_order_lines pl
  where not exists (select 1 from purchase_orders p where p.purchase_order_id = pl.purchase_order_id);

delete from lot_genealogy lg
  where not exists (select 1 from lots l where l.lot_id = lg.output_lot_id)
     or not exists (select 1 from lots l where l.lot_id = lg.component_lot_id);

-- system_alerts yang menunjuk entitas yang sudah tidak ada (B.3.c).
delete from system_alerts sa
  where (sa.related_item_id is not null and not exists (select 1 from items i where i.item_id = sa.related_item_id))
     or (sa.related_work_order_id is not null and not exists (select 1 from work_orders w where w.work_order_id = sa.related_work_order_id));

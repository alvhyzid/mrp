-- Bagian B (26 Agu 2026) — RESET TOTAL studi kasus Gummy Zala/Drinkme, gantikan MLVT.
-- Keputusan final pemilik produk: hapus SEMUA data transaksi/master khusus studi
-- kasus (item, lot, BOM, PO, SO, WO, produksi, pengiriman, supplier) -- BUKAN cuma
-- SAS001/SAS005 (migrasi sempit sebelumnya, 20260826130000, DIHAPUS/digantikan --
-- lihat commit terkait -- karena juga punya bug: lupa customer_purchase_order_lines).
--
-- FONDASI SISTEM (bukan studi kasus) TIDAK DISENTUH: company & user, karyawan/
-- payroll/BPJS/kalender kerja, plant & work center, Kamus, KPI registry (definisi,
-- BUKAN snapshot), Master Dokumen, Absensi, Dashboard AI, Kesiapan AI, konfigurasi
-- tenant/biaya/status transition RULES (bukan LOG).
--
-- KONFLIK TEKNIS & RESOLUSI (didokumentasikan, bukan diimprovisasi sebagai fakta
-- bisnis): routings.item_id NOT NULL -> tidak bisa "hapus semua item" DAN "routing
-- serbuk 10 tahap tetap ada" sekaligus untuk BARIS YANG SAMA. Resolusi: routing
-- LAMA (dimiliki PMSC001ITM/PMBX001ITM) ikut dihapus (konsekuensi wajar "tanpa
-- sisa"), isinya sudah direkam PERSIS di docs/routing-serbuk-10-tahap-referensi.md
-- SEBELUM migrasi ini ditulis -- Bagian D membangun ulang routing yang SAMA PERSIS
-- untuk item MLVT baru, mencapai "reuse" dalam ISI walau bukan baris DB yang sama.
--
-- TEKNIK: session_replication_role=replica (SATU TRANSAKSI, scope migrasi ini
-- saja) -- bukan demi malas mengurutkan FK, tapi supaya SATU migrasi historically
-- terbukti benar bisa menangani puluhan tabel tanpa human error urutan (pelajaran
-- LANGSUNG dari migrasi 20260826130000 yang gagal karena lupa 1 tabel anak). Semua
-- baris tetap benar-benar terhapus (bukan cuma FK-nya dilewati lalu baris yatim
-- dibiarkan) -- setiap tabel anak tanpa company_id langsung DIHAPUS EKSPLISIT lewat
-- join ke induknya SEBELUM loop generik, supaya tidak ada yang terlewat.
--
-- PORTABEL staging<->dev: dicocokkan lewat nama company "PT ITM", bukan ID literal.
-- IDEMPOTEN: WHERE company_id=v_company_id pada tabel yang SUDAH kosong = 0 baris,
-- tidak error, aman dijalankan ulang (dites 2x di staging sebelum dev).
--
-- TABEL YANG DIHAPUS (company_id = PT ITM): items, lots, stock_movements, boms,
-- bom_lines, customer_purchase_orders, customer_purchase_order_lines,
-- customer_po_approvals, customers, sales_orders, sales_order_lines,
-- purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines,
-- suppliers, work_orders, work_order_outputs, work_order_consumption,
-- work_order_assignments, work_order_step_progress, production_batches,
-- production_disruptions, lot_genealogy, shipments, shipment_lines,
-- delivery_confirmations, document_signatures, sales_order_line_margin_snapshots,
-- sales_order_line_feasibility_snapshots, system_alerts, kpi_snapshots (SNAPSHOT
-- transaksi, BUKAN kpi_registry/kpi_responsibilities), status_transition_log,
-- routings, routing_steps, routing_step_standard_crew, production_standards,
-- production_standard_samples, production_standard_proposals,
-- production_standard_exclusions.
--
-- TABEL YANG TETAP (company_id = PT ITM, TIDAK disentuh): companies, users,
-- employees, employee_attendance, shifts, company_settings, production_plants,
-- work_centers, kamus_terms, kamus_term_history, kamus_routing_rules, kpi_registry,
-- kpi_responsibilities, kpi_registry_history, kpi_actions, document_types,
-- documents, document_links, document_access_log, attendance_events,
-- attendance_devices, attendance_corrections, leave_requests, ai_answer_feedback,
-- ai_capability_overrides, ai_capability_status, ai_project_phases,
-- ai_project_progress_snapshots, ai_project_tasks, formula_templates, invitations,
-- invoices, status_transition_rules (aturan, beda dari log).

do $$
declare
  v_company_id integer;
  v_before_lots numeric;
  v_before_lot_count integer;
  v_before_item_count integer;
  v_deleted_items integer;
  v_deleted_lots integer;
  v_deleted_boms integer;
  v_deleted_sos integer;
  v_deleted_cpos integer;
  v_deleted_wos integer;
  v_deleted_employees_check integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Tidak ada company bernama PT ITM di project ini -- tidak ada yang dihapus (aman, migrasi ini portable staging/dev).';
    return;
  end if;

  select count(*), coalesce(sum(quantity_on_hand * coalesce(unit_cost,0)), 0) into v_before_lot_count, v_before_lots
  from lots where company_id = v_company_id and status = 'available';
  select count(*) into v_before_item_count from items where company_id = v_company_id;

  set local session_replication_role = replica;

  -- ===== Tabel anak TANPA company_id langsung -- dihapus eksplisit lewat join,
  -- SEBELUM loop generik di bawah (supaya tidak ada yang terlewat). =====
  delete from bom_lines where bom_id in (select bom_id from boms where company_id = v_company_id);
  delete from customer_purchase_order_lines where customer_purchase_order_id in (select customer_purchase_order_id from customer_purchase_orders where company_id = v_company_id);
  -- customer_po_approvals TIDAK punya company_id sama sekali (hanya
  -- customer_purchase_order_id) -- ditemukan lewat uji staging (fixture
  -- representatif, sama seperti delivery_confirmations di bawah).
  delete from customer_po_approvals where customer_purchase_order_id in (select customer_purchase_order_id from customer_purchase_orders where company_id = v_company_id);
  delete from purchase_order_lines where purchase_order_id in (select purchase_order_id from purchase_orders where company_id = v_company_id);
  delete from goods_receipt_lines where goods_receipt_id in (select goods_receipt_id from goods_receipts where company_id = v_company_id);
  delete from sales_order_lines where sales_order_id in (select sales_order_id from sales_orders where company_id = v_company_id);
  delete from shipment_lines where shipment_id in (select shipment_id from shipments where company_id = v_company_id);
  delete from work_order_outputs where work_order_id in (select work_order_id from work_orders where company_id = v_company_id);
  delete from work_order_consumption where work_order_id in (select work_order_id from work_orders where company_id = v_company_id);
  delete from work_order_assignments where work_order_id in (select work_order_id from work_orders where company_id = v_company_id);
  delete from work_order_step_progress where work_order_id in (select work_order_id from work_orders where company_id = v_company_id);
  delete from lot_genealogy where output_lot_id in (select lot_id from lots where company_id = v_company_id) or component_lot_id in (select lot_id from lots where company_id = v_company_id);
  delete from routing_steps where routing_id in (select routing_id from routings where company_id = v_company_id);
  -- delivery_confirmations TIDAK punya company_id sama sekali (hanya shipment_id) --
  -- ditemukan lewat uji staging (fixture representatif), bukan dari audit skema saja.
  delete from delivery_confirmations where shipment_id in (select shipment_id from shipments where company_id = v_company_id);

  -- ===== Loop generik: SEMUA tabel dengan company_id, KECUALI daftar TETAP. =====
  declare
    tbl record;
    keep_tables text[] := array[
      'companies', 'users', 'employees', 'employee_attendance', 'shifts', 'company_settings',
      'production_plants', 'work_centers',
      'kamus_terms', 'kamus_routing_rules',
      'kpi_registry', 'kpi_responsibilities', 'kpi_actions',
      'document_types', 'documents', 'document_links', 'document_access_log',
      'attendance_events', 'attendance_devices', 'attendance_corrections', 'leave_requests',
      'ai_answer_feedback', 'ai_capability_overrides', 'ai_capability_status',
      'ai_project_phases', 'ai_project_progress_snapshots', 'ai_project_tasks',
      'formula_templates', 'invitations', 'invoices'
    ];
  begin
    for tbl in
      select c.table_name
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.column_name = 'company_id'
        and c.table_name <> all(keep_tables)
    loop
      execute format('delete from %I where company_id = $1', tbl.table_name) using v_company_id;
    end loop;
  end;

  set local session_replication_role = default;

  select count(*) into v_deleted_items from items where company_id = v_company_id;
  select count(*) into v_deleted_lots from lots where company_id = v_company_id;
  select count(*) into v_deleted_boms from boms where company_id = v_company_id;
  select count(*) into v_deleted_sos from sales_orders where company_id = v_company_id;
  select count(*) into v_deleted_cpos from customer_purchase_orders where company_id = v_company_id;
  select count(*) into v_deleted_wos from work_orders where company_id = v_company_id;
  select count(*) into v_deleted_employees_check from employees where company_id = v_company_id;

  raise notice 'SEBELUM: % item, % lot (nilai Rp%). SESUDAH: % item, % lot, % bom, % sales_orders, % customer_purchase_orders, % work_orders tersisa (harus 0 semua). employees TIDAK berubah: % baris (harus SAMA dengan sebelum migrasi).',
    v_before_item_count, v_before_lot_count, v_before_lots,
    v_deleted_items, v_deleted_lots, v_deleted_boms, v_deleted_sos, v_deleted_cpos, v_deleted_wos, v_deleted_employees_check;
end $$;

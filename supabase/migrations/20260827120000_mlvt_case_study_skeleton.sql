-- Kerangka studi kasus MLVT ETAWAFIT (Bagian D, 27 Agu 2026) — PT ITM (company_id
-- dicari dari nama, portable lintas project seperti migrasi sebelumnya).
--
-- Sesuai instruksi eksplisit pemilik produk: item BAHAN BAKU (raw_material) TIDAK
-- dibuat di sini — pemilik produk akan input manual lewat UI. Yang dibuat: customer,
-- PO/SO klien, item produk jadi + WIP + kemasan (BUKAN bahan baku), kerangka BOM
-- (baris yang komponennya sudah ada diisi, baris yang komponennya bahan baku
-- ditinggalkan kosong -- lihat docs/formula-mlvt-etawa-v1.md untuk resep lengkap
-- yang jadi acuan saat bahan baku itu nanti dibuat), dan routing serbuk 10 tahap
-- dibangun ulang dari docs/routing-serbuk-10-tahap-referensi.md.
--
-- Idempoten: seluruh insert pakai "on conflict ... do update" pada unique key asli
-- tabelnya (item_code, po_number, parent_item_id+version, dst) supaya migrasi ini
-- aman dijalankan ulang tanpa duplikat.

-- Kolom kecil baru (bukan tabel baru) untuk mencatat konteks non-finansial PO client
-- yang tidak tertampung kolom lain (siapa yang mengajukan dari sisi internal, catatan
-- penyesuaian tanggal) -- kebutuhan nyata, bukan abstraksi spekulatif.
alter table if exists customer_purchase_orders
  add column if not exists notes text;

do $$
declare
  v_company_id integer;
  v_plant_id integer; -- "KL Bizhub (Karanglo)" setelah konsolidasi Bagian sebelumnya
  v_wc_filling_sachet_id integer;
  v_user_finance integer;
  v_user_ppic integer;
  v_user_manager integer;

  v_customer_id integer;

  v_item_pmbase integer;
  v_item_pmspc integer;
  v_item_pmhot integer;
  v_item_pmsw integer;
  v_item_sachet integer;
  v_item_box integer;
  v_item_sachet_roll integer;
  v_item_box_pkg integer;

  v_bom_box integer;
  v_bom_sachet integer;
  v_bom_pmbase integer;
  v_bom_pmspc integer;
  v_bom_pmhot integer;
  v_bom_pmsw integer;

  v_cpo_id integer;
  v_so_id integer;

  v_routing_sachet_id integer;
  v_routing_box_id integer;
  v_step_sachet_1 integer;
  v_step_sachet_2 integer;
  v_step_sachet_3 integer;
  v_step_sachet_4 integer;
  v_step_sachet_5 integer;
  v_step_box_1 integer;
  v_step_box_2 integer;
  v_step_box_3 integer;
  v_step_box_4 integer;
  v_step_box_5 integer;

  v_yield_note text := 'Resep lengkap & status kelengkapan baris BOM: lihat docs/formula-mlvt-etawa-v1.md. Buffer 1% SUDAH termasuk di angka "Amount to Add" -- buffer_percentage sengaja NULL supaya tidak dihitung dua kali.';
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan di project ini -- migrasi skeleton MLVT dilewati (no-op).';
    return;
  end if;

  select production_plant_id into v_plant_id from production_plants where company_id = v_company_id and name = 'KL Bizhub (Karanglo)';
  if v_plant_id is null then
    raise exception 'Plant "KL Bizhub (Karanglo)" tidak ditemukan -- jalankan migrasi konsolidasi plant (20260827090000) dulu.';
  end if;

  select work_center_id into v_wc_filling_sachet_id from work_centers where company_id = v_company_id and code = 'WC-FILLING-SACHET';

  select user_id into v_user_finance from users where company_id = v_company_id and role = 'finance_manager' order by user_id limit 1;
  select user_id into v_user_ppic from users where company_id = v_company_id and role = 'ppic_manager' order by user_id limit 1;
  select user_id into v_user_manager from users where company_id = v_company_id and role = 'company_admin' order by user_id limit 1;

  -- ═══ 1. Customer ═══
  -- customers TIDAK punya unique constraint di (company_id, name) -- "on conflict"
  -- tanpa target tidak akan menangkap apa pun di tabel ini, jadi idempotensi dicek
  -- manual (select dulu) supaya re-run migrasi ini tidak membuat baris duplikat.
  select customer_id into v_customer_id from customers where company_id = v_company_id and name = 'PT. Sastro Utama Media Grup';
  if v_customer_id is null then
    insert into customers (company_id, name, customer_type, contact_info)
    values (v_company_id, 'PT. Sastro Utama Media Grup', 'company', 'PIC: Ni Wayan Chyntia Pramesti Cahyani, +6282266422042')
    returning customer_id into v_customer_id;
  end if;

  -- ═══ 2. Item -- WIP premix, WIP sachet, FG box, kemasan (BUKAN bahan baku) ═══
  insert into items (company_id, item_code, name, type, base_uom, purchase_uom, uom_conversion_factor, standard_cost)
  values (v_company_id, 'PMBASE-MLVT/001ITM', 'Premix Base MLVT', 'wip', 'g', 'g', 1, null)
  on conflict (company_id, item_code) do update set name = excluded.name
  returning item_id into v_item_pmbase;

  insert into items (company_id, item_code, name, type, base_uom, purchase_uom, uom_conversion_factor, standard_cost)
  values (v_company_id, 'PMSPC-MLVT/001ITM', 'Premix Spice MLVT', 'wip', 'g', 'g', 1, null)
  on conflict (company_id, item_code) do update set name = excluded.name
  returning item_id into v_item_pmspc;

  insert into items (company_id, item_code, name, type, base_uom, purchase_uom, uom_conversion_factor, standard_cost)
  values (v_company_id, 'PMHOT-MLVT/001ITM', 'Premix Hot/Rempah MLVT', 'wip', 'g', 'g', 1, null)
  on conflict (company_id, item_code) do update set name = excluded.name
  returning item_id into v_item_pmhot;

  insert into items (company_id, item_code, name, type, base_uom, purchase_uom, uom_conversion_factor, standard_cost)
  values (v_company_id, 'PMSW-MLVT/001ITM', 'Premix Sweetener MLVT', 'wip', 'g', 'g', 1, null)
  on conflict (company_id, item_code) do update set name = excluded.name
  returning item_id into v_item_pmsw;

  insert into items (company_id, item_code, name, type, base_uom, purchase_uom, uom_conversion_factor, standard_cost)
  values (v_company_id, 'MLVT-SACHET/001ITM', 'WIP Sachet MLVT ETAWAFIT', 'wip', 'sachet', 'sachet', 1, null)
  on conflict (company_id, item_code) do update set name = excluded.name
  returning item_id into v_item_sachet;

  insert into items (company_id, item_code, name, type, base_uom, purchase_uom, uom_conversion_factor, standard_cost, bpom_registration_number)
  values (v_company_id, 'MLVT-BOX/001ITM', 'MLVT ETAWAFIT', 'finished_good', 'box', 'box', 1, null, 'BPOM RI MD 043735000801561')
  on conflict (company_id, item_code) do update set name = excluded.name, bpom_registration_number = excluded.bpom_registration_number
  returning item_id into v_item_box;

  insert into items (company_id, item_code, name, type, base_uom, purchase_uom, uom_conversion_factor, standard_cost)
  values (v_company_id, 'SACHET-ROLL-ETAWAFIT/001ITM', 'Sachet Roll Etawa Fit', 'packaging', 'sachet', 'roll', 3333.333333, 469.85)
  on conflict (company_id, item_code) do update set name = excluded.name, standard_cost = excluded.standard_cost
  returning item_id into v_item_sachet_roll;

  insert into items (company_id, item_code, name, type, base_uom, purchase_uom, uom_conversion_factor, standard_cost)
  values (v_company_id, 'BOX-ETAWAFIT/001ITM', 'Box Etawa Fit', 'packaging', 'box', 'box', 1, 2500)
  on conflict (company_id, item_code) do update set name = excluded.name, standard_cost = excluded.standard_cost
  returning item_id into v_item_box_pkg;

  -- ═══ 3. BOM -- Box (LENGKAP, 2 baris) ═══
  insert into boms (company_id, parent_item_id, version, standard_yield_qty, standard_yield_uom, status, standard_yield_basis_note, standard_yield_source)
  values (v_company_id, v_item_box, 1, 1, 'box', 'active', v_yield_note, 'ESTIMASI_MANUAL')
  on conflict (parent_item_id, version) do update set status = excluded.status
  returning bom_id into v_bom_box;

  delete from bom_lines where bom_id = v_bom_box;
  insert into bom_lines (bom_id, component_item_id, qty_per_unit_output, uom) values
    (v_bom_box, v_item_sachet, 10, 'sachet'),
    (v_bom_box, v_item_box_pkg, 1, 'box');

  -- ═══ 4. BOM -- Sachet / formula utama (4 dari 6 baris -- Castor Sugar & Zeofree
  -- BELUM ada item bahan baku, lihat docs/formula-mlvt-etawa-v1.md).
  -- STATUS SENGAJA 'active' walau belum lengkap: computeStandardCostPerUnit /
  -- computeStandardLaborCostPerUnit / explodeBomRequirements / getMarginWatch
  -- HANYA menelusuri BOM berstatus 'active' (di keempat fungsi itu) -- kalau
  -- 'draft', item Sachet berhenti dianggap "leaf tanpa biaya" dan SELURUH baris
  -- di baliknya (4 premix + kemasan sachet roll) tidak pernah tereksplorasi sama
  -- sekali, termasuk kontribusi kemasan Rp4.698,50/box yang jadi target verifikasi
  -- Margin Watch. Ketidaklengkapan (Castor Sugar/Zeofree) TETAP jujur ditampilkan
  -- lewat missingCostItemCodes (mekanisme yang sudah ada), bukan lewat status BOM.
  insert into boms (company_id, parent_item_id, version, standard_yield_qty, standard_yield_uom, status, standard_yield_basis_note, standard_yield_source)
  values (v_company_id, v_item_sachet, 1, 1, 'sachet', 'active', v_yield_note || ' Baris BELUM lengkap: Castor Sugar (5,00 g) & Zeofree (0,08 g) menunggu item bahan baku.', 'ESTIMASI_MANUAL')
  on conflict (parent_item_id, version) do update set status = excluded.status, standard_yield_basis_note = excluded.standard_yield_basis_note
  returning bom_id into v_bom_sachet;

  delete from bom_lines where bom_id = v_bom_sachet;
  insert into bom_lines (bom_id, component_item_id, qty_per_unit_output, uom) values
    (v_bom_sachet, v_item_pmbase, 13.00, 'g'),
    (v_bom_sachet, v_item_pmspc, 1.50, 'g'),
    (v_bom_sachet, v_item_pmhot, 0.40, 'g'),
    (v_bom_sachet, v_item_pmsw, 0.25, 'g'),
    (v_bom_sachet, v_item_sachet_roll, 1, 'sachet');

  -- ═══ 5. BOM -- 4 premix (KERANGKA/draf, 0 baris -- seluruh komponen bahan baku,
  -- menunggu pemilik produk input manual. Resep lengkap ada di docs/formula-mlvt-etawa-v1.md) ═══
  insert into boms (company_id, parent_item_id, version, standard_yield_qty, standard_yield_uom, status, standard_yield_basis_note, standard_yield_source)
  values (v_company_id, v_item_pmbase, 1, 116.75, 'g', 'draft', v_yield_note || ' 0 baris -- seluruh 6 komponen (Creamer AVI, Xantan Gum, Garam, Cloudifier, Etawa Powder, Maltodextrin) bahan baku, belum ada item.', 'ESTIMASI_MANUAL')
  on conflict (parent_item_id, version) do update set status = excluded.status, standard_yield_basis_note = excluded.standard_yield_basis_note
  returning bom_id into v_bom_pmbase;

  insert into boms (company_id, parent_item_id, version, standard_yield_qty, standard_yield_uom, status, standard_yield_basis_note, standard_yield_source)
  values (v_company_id, v_item_pmspc, 1, 100, 'g', 'draft', v_yield_note || ' 0 baris -- seluruh 5 komponen (Maltodextrin, Blackpepper, Cinnamon, Kunyit Bubuk, Color Derasi Curcumin 0310) bahan baku, belum ada item.', 'ESTIMASI_MANUAL')
  on conflict (parent_item_id, version) do update set status = excluded.status, standard_yield_basis_note = excluded.standard_yield_basis_note
  returning bom_id into v_bom_pmspc;

  insert into boms (company_id, parent_item_id, version, standard_yield_qty, standard_yield_uom, status, standard_yield_basis_note, standard_yield_source)
  values (v_company_id, v_item_pmhot, 1, 100, 'g', 'draft', v_yield_note || ' 0 baris -- seluruh 4 komponen (Maltodextrin, Capsicum, Ginger Oil, Zeofree) bahan baku, belum ada item.', 'ESTIMASI_MANUAL')
  on conflict (parent_item_id, version) do update set status = excluded.status, standard_yield_basis_note = excluded.standard_yield_basis_note
  returning bom_id into v_bom_pmhot;

  insert into boms (company_id, parent_item_id, version, standard_yield_qty, standard_yield_uom, status, standard_yield_basis_note, standard_yield_source)
  values (v_company_id, v_item_pmsw, 1, 100, 'g', 'draft', v_yield_note || ' 0 baris -- seluruh 3 komponen (Maltodextrin, Stevia Powder, Sucralose) bahan baku, belum ada item.', 'ESTIMASI_MANUAL')
  on conflict (parent_item_id, version) do update set status = excluded.status, standard_yield_basis_note = excluded.standard_yield_basis_note
  returning bom_id into v_bom_pmsw;

  -- ═══ 6. PO client -> SO (sudah committed/processed -- bukan draf approval) ═══
  insert into customer_purchase_orders (company_id, customer_id, po_number, po_date, requested_ship_date, status, pic_name, pic_phone, payment_terms, payment_status, processed_by, processed_at, notes)
  values (
    v_company_id, v_customer_id, '182/RND/SUMG/VI/2026', current_date, current_date + interval '30 days', 'processed',
    'Ni Wayan Chyntia Pramesti Cahyani', '+6282266422042', 'tempo', 'partial', v_user_ppic, now(),
    'Diajukan oleh Bayu Oktavian Wibowo (GM Ruko Dieng). Termin pembayaran 50% di muka / 50% pelunasan. Tanggal dokumen asli 15 Juni & 21 Juli 2026 disesuaikan menjadi tanggal seed karena keterlambatan pembayaran klien.'
  )
  on conflict (company_id, po_number) do update set status = excluded.status
  returning customer_purchase_order_id into v_cpo_id;

  delete from customer_purchase_order_lines where customer_purchase_order_id = v_cpo_id;
  insert into customer_purchase_order_lines (customer_purchase_order_id, item_id, qty_ordered, unit_price)
  values (v_cpo_id, v_item_box, 2500, 23000);

  insert into customer_po_approvals (customer_purchase_order_id, department, status, approved_by, approved_at)
  values
    (v_cpo_id, 'finance', 'approved', v_user_finance, now()),
    (v_cpo_id, 'ppic', 'approved', v_user_ppic, now()),
    (v_cpo_id, 'manager', 'approved', v_user_manager, now())
  on conflict (customer_purchase_order_id, department) do update set status = excluded.status, approved_by = excluded.approved_by, approved_at = excluded.approved_at;

  insert into sales_orders (company_id, customer_purchase_order_id, customer_id, production_plant_id, status, so_number)
  values (v_company_id, v_cpo_id, v_customer_id, v_plant_id, 'confirmed', '043/6-ITM/2026')
  on conflict (customer_purchase_order_id) do update set so_number = excluded.so_number
  returning sales_order_id into v_so_id;

  delete from sales_order_lines where sales_order_id = v_so_id;
  insert into sales_order_lines (sales_order_id, item_id, qty_ordered, unit_price)
  values (v_so_id, v_item_box, 2500, 23000);

  -- ═══ 7. Routing serbuk 10 tahap dibangun ulang dari
  -- docs/routing-serbuk-10-tahap-referensi.md, untuk item Sachet & Box MLVT ═══
  -- CATATAN: docs/rancangan-skema-database-mrp.md mendokumentasikan routings.status
  -- (draft/active/archived), tapi kolom itu TIDAK PERNAH benar-benar ada di skema
  -- terpasang (dicek 27 Agu 2026, tidak ada di migrasi manapun) -- drift dokumentasi
  -- lama, di luar cakupan Bagian D untuk diperbaiki, dicatat di HANDOFF.
  insert into routings (company_id, item_id, version)
  values (v_company_id, v_item_sachet, 1)
  on conflict do nothing;
  select routing_id into v_routing_sachet_id from routings where company_id = v_company_id and item_id = v_item_sachet and version = 1;

  insert into routings (company_id, item_id, version)
  values (v_company_id, v_item_box, 1)
  on conflict do nothing;
  select routing_id into v_routing_box_id from routings where company_id = v_company_id and item_id = v_item_box and version = 1;

  -- production_standards (level-tahap) FK-references routing_steps -- harus dihapus
  -- LEBIH DULU supaya re-run migrasi ini (idempoten) tidak gagal FK saat routing_steps
  -- lama dihapus untuk diganti baris baru.
  delete from production_standards where company_id = v_company_id and item_id in (v_item_sachet, v_item_box);
  delete from routing_steps where routing_id in (v_routing_sachet_id, v_routing_box_id);

  insert into routing_steps (routing_id, sequence_no, step_name, active_duration_minutes, wait_duration_minutes, work_center_id, duration_per_unit_minutes)
  values
    (v_routing_sachet_id, 1, 'Persiapan & penimbangan bahan', 60, 0, null, null),
    (v_routing_sachet_id, 2, 'Premix Mixing', 30, 0, null, null),
    (v_routing_sachet_id, 3, 'Batch Mixing', 45, 0, null, null),
    (v_routing_sachet_id, 4, 'Filling Sachet', 0, 0, v_wc_filling_sachet_id, 0.028571),
    (v_routing_sachet_id, 5, 'QC Sachet', 30, 0, null, null);

  select routing_step_id into v_step_sachet_1 from routing_steps where routing_id = v_routing_sachet_id and sequence_no = 1;
  select routing_step_id into v_step_sachet_2 from routing_steps where routing_id = v_routing_sachet_id and sequence_no = 2;
  select routing_step_id into v_step_sachet_3 from routing_steps where routing_id = v_routing_sachet_id and sequence_no = 3;
  select routing_step_id into v_step_sachet_4 from routing_steps where routing_id = v_routing_sachet_id and sequence_no = 4;
  select routing_step_id into v_step_sachet_5 from routing_steps where routing_id = v_routing_sachet_id and sequence_no = 5;

  insert into routing_steps (routing_id, sequence_no, step_name, active_duration_minutes, wait_duration_minutes, work_center_id, duration_per_unit_minutes)
  values
    (v_routing_box_id, 1, 'Persiapan kemasan sekunder', 30, 0, null, null),
    (v_routing_box_id, 2, 'Filling Box', 30, 0, null, null),
    (v_routing_box_id, 3, 'Lem Box', 20, 0, null, null),
    (v_routing_box_id, 4, 'Wrap & Shrink', 30, 0, null, null),
    (v_routing_box_id, 5, 'QC final + pengemasan karton', 30, 0, null, null);

  select routing_step_id into v_step_box_1 from routing_steps where routing_id = v_routing_box_id and sequence_no = 1;
  select routing_step_id into v_step_box_2 from routing_steps where routing_id = v_routing_box_id and sequence_no = 2;
  select routing_step_id into v_step_box_3 from routing_steps where routing_id = v_routing_box_id and sequence_no = 3;
  select routing_step_id into v_step_box_4 from routing_steps where routing_id = v_routing_box_id and sequence_no = 4;
  select routing_step_id into v_step_box_5 from routing_steps where routing_id = v_routing_box_id and sequence_no = 5;

  -- Standar K8 level-item & level-tahap -- nilai SAMA PERSIS dengan routing serbuk
  -- lama (keputusan eksplisit pemilik produk: "MLVT juga minuman serbuk, tahapannya
  -- sama" -- titik awal, boleh dikoreksi PPIC kalau kapasitas riil MLVT berbeda).
  -- (baris lama sudah dihapus lebih awal, sebelum routing_steps diganti, lihat di atas)
  insert into production_standards (company_id, item_id, routing_step_id, metric_key, value, source, sample_count) values
    (v_company_id, v_item_sachet, null, 'unit_per_batch', 3166.66, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_sachet, null, 'batches_per_day', 3, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_sachet, v_step_sachet_1, 'active_duration_minutes', 60, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_sachet, v_step_sachet_2, 'active_duration_minutes', 30, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_sachet, v_step_sachet_3, 'active_duration_minutes', 45, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_sachet, v_step_sachet_5, 'active_duration_minutes', 30, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_box, null, 'yield_percentage', 95, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_box, null, 'unit_per_batch', 226.19, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_box, null, 'batches_per_day', 3, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_box, v_step_box_1, 'active_duration_minutes', 30, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_box, v_step_box_2, 'active_duration_minutes', 30, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_box, v_step_box_3, 'active_duration_minutes', 20, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_box, v_step_box_4, 'active_duration_minutes', 30, 'ESTIMASI_MANUAL', 0),
    (v_company_id, v_item_box, v_step_box_5, 'active_duration_minutes', 30, 'ESTIMASI_MANUAL', 0);

  raise notice 'Skeleton MLVT selesai -- customer_id=%, item box=%, item sachet=%, 4 premix=[%,%,%,%], SO=% (so_number=043/6-ITM/2026), routing sachet=%, routing box=%',
    v_customer_id, v_item_box, v_item_sachet, v_item_pmbase, v_item_pmspc, v_item_pmhot, v_item_pmsw, v_so_id, v_routing_sachet_id, v_routing_box_id;
end $$;

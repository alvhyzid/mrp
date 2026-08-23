// Pembersihan data demo lama (instruksi A3, 19 Agu 2026) — SATU KALI PAKAI, bukan
// utilitas generik berulang. Dijalankan lebih dulu di STAGING (mrp-rebuild-test-2A)
// dengan set env var yang menunjuk ke sana, diverifikasi, BARU dijalankan ke dev
// (env var default .env.local). WAJIB backup terverifikasi dulu (A2) sebelum dev.
//
// Strategi: ALLOWLIST eksplisit utk data nyata yang harus tetap ada (bukan denylist
// menebak semua yang harus dihapus) — lebih aman untuk operasi destruktif begini.
// Segala transaksi (WO/batch/lot/shipment/SO/CPO) yang TIDAK masuk allowlist dianggap
// demo/uji dan dihapus, karena real case (SAS001/SAS005) belum ada produksi/pengiriman
// sungguhan sampai sesi ini — jadi TIDAK ADA WO/batch/lot produksi/shipment asli yang
// berisiko ketimpa aturan ini hari ini.
// Kredensial TIDAK BOLEH ditempel di baris perintah (tersimpan di riwayat shell) --
// selalu baca dari file .env.*.local (pola sama dgn skrip lain di repo ini), dipilih
// lewat --target eksplisit supaya tidak mungkin salah sasar dev karena env var
// tertinggal di shell dari sesi sebelumnya.
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const readline = require('node:readline/promises');

const targetArg = process.argv.find((a) => a.startsWith('--target='));
const target = targetArg ? targetArg.split('=')[1] : null;
if (target !== 'staging' && target !== 'dev') {
  console.error('Wajib pilih target eksplisit: node scripts/cleanup-demo-data.js --target=staging  ATAU  --target=dev');
  process.exit(1);
}

const ENV_FILE_BY_TARGET = { staging: '.env.staging.local', dev: '.env.local' };
dotenv.config({ path: ENV_FILE_BY_TARGET[target] });


// INF-14 (23 Agu 2026) -- pengawas tingkat project: skrip ini MENULIS data,
// jadi WAJIB gagal keras bila diarahkan ke project berisi data nyata.
require('./guard-real-project').assertNotRealProject('scripts/cleanup-demo-data.js');

async function confirmDevOrExit() {
  if (target !== 'dev') return;
  console.log('\n!!! PERINGATAN: target = DEV (database produksi/riil, BUKAN staging) !!!');
  console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log('Skrip ini MENGHAPUS data secara permanen. Pastikan backup pg_dump sudah diverifikasi berisi data.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Ketik ulang persis "HAPUS DATA DEMO DEV" untuk lanjut: ');
  rl.close();
  if (answer !== 'HAPUS DATA DEMO DEV') {
    console.error('Konfirmasi tidak cocok. Dibatalkan, tidak ada yang dihapus.');
    process.exit(1);
  }
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const MAIN_COMPANY_NAME = 'PT ITM';

// Item yang TETAP ADA — seluruh item real-case (GELOMBANG 1) + saldo awal Karanglo (B).
const KEEP_ITEM_CODES = new Set([
  // Raw materials real-case (28) + hasil koreksi Derasi Strawberry (reuse item lama)
  'RM-MALTITOL', 'RM-POLYSORB', 'RM-SORBITOL-LIQUID', 'RM-GELATIN-NB250', 'RM-PERFECTA-GEL-928', 'RM-PERFECTA-GEL-MB', 'RM-GELLAN-GUM',
  'RM-GLISERIN', 'RM-POLYDEXTROSE', 'RM-MALICACID', 'RM-CITRICACID', 'RM-COLLAGEN', 'RM-GLUTATHIONE', 'RM-AIR', 'RM-MALTODEXTRIN',
  'RM-SORBITOL-POWDER', 'RM-INULIN', 'RM-PSYLIUM-HUSK', 'RM-PAPAIN', 'RM-BROMALIN', 'RM-ZOEFREE', 'RM-GARAM', 'RM-GARCINIA-CAMBOGIA',
  'RM-STEVIA-POWDER', 'RM-SUCRALOSE', 'RM-DERASI-ORANGE', 'RM-ASCORBIC-ACID', 'RM-SEREH-POWDER', 'RM-DERASI-STRAWBERRY',
  // Kemasan real-case
  'PKG-BOTOL-PET-N200', 'PKG-LABEL-STIKER-N200', 'PKG-INNER-SLEEVE', 'PKG-OUTER-BOX', 'PKG-SEAL-STICKER', 'PKG-KARTON-GUMMY-27',
  'PMPKF001ITM', 'PMPKB001ITM', 'PKG-PLASTIC-WRAP-BOX', 'PKG-KARTON-SERBUK-42',
  // WIP premix + Gummy Zala + Drinkme (v2)
  'WIP-PREMIX-GELATIN-ZALA', 'PMSW001ITM', 'PMAC001ITM', 'PMFLV001ITM', 'PM-VITC-001ITM', 'PM-SRH-001ITM',
  'FG-GUMMY-ZALA-N200', 'PMBX001ITM',
  // BARU-BAHAN/WIP/KEMASAN saldo awal Karanglo (B)
  'RM-ALCO-MERAH', 'RM-DEXTROSE', 'RM-GRAPE-SEED-EXTRACT', 'RM-GULA-CASTOR', 'RM-HYALURONIC-ACID', 'RM-MAGNESIUM-SULFATE', 'RM-SODIUM-ASCORBATE',
  'WIP-RAW-FIXLIM-1', 'WIP-RAW-QS-COLLAGEN-1',
  'PKG-BOX-ETAWA-FIT', 'PKG-BOX-FIXNUTRI-FIXLIM', 'PKG-BOX-QUEENSI-COLLAGEN', 'PKG-BOX-QUEENSI-LEMON-SAMPLE-BG', 'PKG-KARDUS-ITM-CUSTOM',
  'PKG-SACHET-ROLL-ETAWA-FIT', 'PKG-SACHET-ROLL-FIXNUTRI', 'PKG-SILICA-GEL-2G', 'PKG-STIKER-SAMPLE-01'
]);

// PMSC001ITM ("Sachet Minuman Serbuk", WIP 2-level lama) SENGAJA DIBIARKAN APA ADANYA
// (bukan dihapus, bukan di-keep-list produksi) — item ini ORPHAN sejak Drinkme dapat
// BOM langsung dari raw material (A1), tapi menghapusnya berisiko tanpa manfaat nyata.
// PMPW0001ITM ("Sorbitol Powder" duplikat lama) IKUT DIBIARKAN dengan alasan sama --
// ditemukan lewat percobaan sungguhan di DEV (FK error nyata): BOM v1 PMSC001ITM masih
// mereferensikan item ini sebagai component, dan karena PMSC001ITM sendiri sengaja tidak
// disentuh, bom_line itu juga tidak terhapus -- jadi PMPW0001ITM tidak boleh ikut dihapus.
const ORPHAN_ITEM_CODES_TO_SKIP = new Set(['PMSC001ITM', 'PMPW0001ITM']);

const KEEP_PLANT_NAMES = new Set(['Pabrik Utama PT ITM', 'Karanglo', 'Ruko Dieng']);
const KEEP_CUSTOMER_NAMES = new Set(['PT Sastro Media']);
const KEEP_CPO_NUMBERS = new Set(['SAS001', 'SAS005']);
const KEEP_SUPPLIER_NAMES = new Set(['Vendor China (Botol PET)']);
// 12 posisi PERSIS dari docs/data-produksi-itm-ekstrak.md §1 — pembeda tegas dari
// posisi demo lama ("Operator Produksi", "QC Produksi", dst), termasuk menghindari
// ambiguitas nama (mis. "Budi" PHL asli vs "Budi Santoso" operator demo).
const KEEP_EMPLOYEE_POSITIONS = new Set([
  'Direktur', 'General Manager', 'Manager PPIC', 'Staff PPIC', 'Staff Purchasing', 'SPV Finance', 'SPV HRD',
  'SPV Produksi Gummy', 'SPV Produksi Powder', 'Pegawai Kontrak Gummy', 'Pegawai PHL Gummy', 'Pegawai PHL Powder'
]);
const KEEP_LOT_NUMBER_PREFIX = 'SALDO-AWAL-KARANGLO-';

// Perusahaan test-fixture ORPHAN (nama otomatis dari test/skrip debug sesi ini yang
// gagal bersih sendiri) — dihapus TOTAL (company + seluruh anak), berbeda dari
// perusahaan test PERMANEN yang dibuat/dibersihkan SENDIRI oleh tiap file tests/*.test.ts
// di beforeAll/afterAll masing-masing (RoleTestCorp dkk, TIDAK disentuh di sini).
const ORPHAN_TEST_COMPANY_NAMES = ['MarginTestCorp', 'DebugPremixCorp', 'LaborPoolTestCorp'];

async function main() {
  await confirmDevOrExit();
  console.log(`Target: ${target} (${process.env.NEXT_PUBLIC_SUPABASE_URL})\n`);
  const { data: company, error: companyError } = await admin.from('companies').select('company_id').eq('name', MAIN_COMPANY_NAME).maybeSingle();
  if (companyError) throw new Error(companyError.message);
  if (!company) throw new Error(`Company "${MAIN_COMPANY_NAME}" tidak ditemukan.`);
  const companyId = company.company_id;
  console.log(`Company utama: ${MAIN_COMPANY_NAME} (id=${companyId})\n`);

  // ============================================================
  // BAGIAN 0: hapus TOTAL perusahaan test-fixture orphan (company terpisah)
  // ============================================================
  console.log('=== BAGIAN 0: Perusahaan test-fixture orphan ===');
  const { data: orphanCompanies } = await admin.from('companies').select('company_id, name').in('name', ORPHAN_TEST_COMPANY_NAMES);
  for (const oc of orphanCompanies ?? []) {
    console.log(`Menghapus company orphan "${oc.name}" (id=${oc.company_id}) beserta seluruh isinya...`);
    await purgeEntireCompany(oc.company_id);
  }
  console.log(`Selesai: ${(orphanCompanies ?? []).length} perusahaan orphan dibersihkan total.\n`);

  // ============================================================
  // BAGIAN 1: dalam company utama — hapus SEMUA transaksi (WO/batch/lot/shipment/
  // system_alerts) KECUALI yang match allowlist eksplisit.
  // ============================================================
  console.log('=== BAGIAN 1: Transaksi non-allowlist di company utama ===');

  const { data: items } = await admin.from('items').select('item_id, item_code').eq('company_id', companyId);
  const keepItemIds = new Set(items.filter((i) => KEEP_ITEM_CODES.has(i.item_code)).map((i) => i.item_id));
  const dropItemIds = items.filter((i) => !KEEP_ITEM_CODES.has(i.item_code) && !ORPHAN_ITEM_CODES_TO_SKIP.has(i.item_code)).map((i) => i.item_id);

  const { data: plants } = await admin.from('production_plants').select('production_plant_id, name').eq('company_id', companyId);
  const dropPlantIds = plants.filter((p) => !KEEP_PLANT_NAMES.has(p.name)).map((p) => p.production_plant_id);

  const { data: customers } = await admin.from('customers').select('customer_id, name').eq('company_id', companyId);
  const keepCustomerIds = new Set(customers.filter((c) => KEEP_CUSTOMER_NAMES.has(c.name)).map((c) => c.customer_id));
  const dropCustomerIds = customers.filter((c) => !KEEP_CUSTOMER_NAMES.has(c.name)).map((c) => c.customer_id);

  const { data: cpos } = await admin.from('customer_purchase_orders').select('customer_purchase_order_id, po_number').eq('company_id', companyId);
  const keepCpoIds = new Set(cpos.filter((c) => KEEP_CPO_NUMBERS.has(c.po_number)).map((c) => c.customer_purchase_order_id));
  const dropCpoIds = cpos.filter((c) => !KEEP_CPO_NUMBERS.has(c.po_number)).map((c) => c.customer_purchase_order_id);

  const { data: sos } = await admin.from('sales_orders').select('sales_order_id, customer_purchase_order_id').eq('company_id', companyId);
  const keepSoIds = new Set(sos.filter((s) => keepCpoIds.has(s.customer_purchase_order_id)).map((s) => s.sales_order_id));
  const dropSoIds = sos.filter((s) => !keepCpoIds.has(s.customer_purchase_order_id)).map((s) => s.sales_order_id);

  const { data: suppliers } = await admin.from('suppliers').select('supplier_id, name').eq('company_id', companyId);
  const keepSupplierIds = new Set(suppliers.filter((s) => KEEP_SUPPLIER_NAMES.has(s.name)).map((s) => s.supplier_id));
  const dropSupplierIds = suppliers.filter((s) => !KEEP_SUPPLIER_NAMES.has(s.name)).map((s) => s.supplier_id);

  const { data: purchaseOrders } = await admin.from('purchase_orders').select('purchase_order_id, supplier_id').eq('company_id', companyId);
  const keepPoIds = new Set(purchaseOrders.filter((p) => keepSupplierIds.has(p.supplier_id)).map((p) => p.purchase_order_id));
  const dropPoIds = purchaseOrders.filter((p) => !keepSupplierIds.has(p.supplier_id)).map((p) => p.purchase_order_id);

  const { data: allWorkOrders } = await admin.from('work_orders').select('work_order_id').eq('company_id', companyId);
  const allWoIds = allWorkOrders.map((w) => w.work_order_id); // semua WO dihapus (belum ada produksi real case sungguhan)

  const { data: allBatches } = await admin.from('production_batches').select('production_batch_id').in('work_order_id', allWoIds.length ? allWoIds : [-1]);
  const allBatchIds = allBatches.map((b) => b.production_batch_id);

  const { data: allShipments } = await admin.from('shipments').select('shipment_id').eq('company_id', companyId);
  const allShipmentIds = allShipments.map((s) => s.shipment_id);

  const { data: lots } = await admin.from('lots').select('lot_id, lot_number').eq('company_id', companyId);
  const dropLotIds = lots.filter((l) => !l.lot_number.startsWith(KEEP_LOT_NUMBER_PREFIX)).map((l) => l.lot_id);

  // --- Urutan hapus (anak dulu, induk belakangan, sesuai FK) ---
  await run(admin.from('system_alerts').delete().eq('company_id', companyId), 'system_alerts (semua, company)');
  await run(admin.from('work_order_assignments').delete().in('work_order_id', allWoIds.length ? allWoIds : [-1]), 'work_order_assignments');
  await run(admin.from('work_order_consumption').delete().in('work_order_id', allWoIds.length ? allWoIds : [-1]), 'work_order_consumption');
  await run(admin.from('work_order_step_progress').delete().in('work_order_id', allWoIds.length ? allWoIds : [-1]), 'work_order_step_progress');
  await run(admin.from('lot_genealogy').delete().in('output_lot_id', dropLotIds.length ? dropLotIds : [-1]), 'lot_genealogy (output non-keep)');
  await run(admin.from('work_order_outputs').delete().in('work_order_id', allWoIds.length ? allWoIds : [-1]), 'work_order_outputs');
  await run(admin.from('production_batches').delete().in('work_order_id', allWoIds.length ? allWoIds : [-1]), 'production_batches');
  // PASS KEDUA system_alerts: trigger readiness (worker_absence dkk, migration
  // 20260813160000/20260816100000) MEMBUAT ALERT BARU begitu work_order_assignments
  // dihapus (WO jadi "tanpa pekerja" dari sudut pandang trigger) -- ditemukan lewat
  // percobaan sungguhan di staging (FK error nyata), bukan tebakan. Pass pertama di
  // atas cuma menangkap alert yang SUDAH ada SEBELUM WO/batch disentuh.
  await run(admin.from('system_alerts').delete().eq('company_id', companyId), 'system_alerts (pass 2, tangkap alert baru dari trigger readiness)');
  await run(admin.from('work_orders').delete().in('work_order_id', allWoIds.length ? allWoIds : [-1]), 'work_orders');

  await run(admin.from('shipment_lines').delete().in('shipment_id', allShipmentIds.length ? allShipmentIds : [-1]), 'shipment_lines');
  await run(admin.from('delivery_confirmations').delete().in('shipment_id', allShipmentIds.length ? allShipmentIds : [-1]), 'delivery_confirmations');
  await run(admin.from('shipments').delete().eq('company_id', companyId), 'shipments (semua)');

  await run(admin.from('sales_order_lines').delete().in('sales_order_id', dropSoIds.length ? dropSoIds : [-1]), 'sales_order_lines (non-keep)');
  await run(admin.from('sales_orders').delete().in('sales_order_id', dropSoIds.length ? dropSoIds : [-1]), 'sales_orders (non-keep)');

  await run(admin.from('customer_po_approvals').delete().in('customer_purchase_order_id', dropCpoIds.length ? dropCpoIds : [-1]), 'customer_po_approvals (non-keep)');
  await run(admin.from('customer_purchase_order_lines').delete().in('customer_purchase_order_id', dropCpoIds.length ? dropCpoIds : [-1]), 'customer_purchase_order_lines (non-keep)');
  await run(admin.from('customer_purchase_orders').delete().in('customer_purchase_order_id', dropCpoIds.length ? dropCpoIds : [-1]), 'customer_purchase_orders (non-keep)');
  await run(admin.from('customers').delete().in('customer_id', dropCustomerIds.length ? dropCustomerIds : [-1]), 'customers (non-keep)');

  await run(admin.from('goods_receipt_lines').delete().in('goods_receipt_id',
    (await admin.from('goods_receipts').select('goods_receipt_id').in('purchase_order_id', dropPoIds.length ? dropPoIds : [-1])).data?.map((g) => g.goods_receipt_id) ?? [-1]
  ), 'goods_receipt_lines (non-keep PO)');
  await run(admin.from('goods_receipts').delete().in('purchase_order_id', dropPoIds.length ? dropPoIds : [-1]), 'goods_receipts (non-keep PO)');
  await run(admin.from('purchase_order_lines').delete().in('purchase_order_id', dropPoIds.length ? dropPoIds : [-1]), 'purchase_order_lines (non-keep)');
  await run(admin.from('purchase_orders').delete().in('purchase_order_id', dropPoIds.length ? dropPoIds : [-1]), 'purchase_orders (non-keep)');
  await run(admin.from('suppliers').delete().in('supplier_id', dropSupplierIds.length ? dropSupplierIds : [-1]), 'suppliers (non-keep)');

  await run(admin.from('stock_movements').delete().in('lot_id', dropLotIds.length ? dropLotIds : [-1]), 'stock_movements (non-keep lot)');
  await run(admin.from('lots').delete().in('lot_id', dropLotIds.length ? dropLotIds : [-1]), 'lots (non-keep)');

  console.log('\n=== BAGIAN 2: Master data non-allowlist (item/BOM/routing/employee/plant) ===');

  const { data: dropItemBoms } = await admin.from('boms').select('bom_id').in('parent_item_id', dropItemIds.length ? dropItemIds : [-1]);
  const { data: keepItemAllBoms } = await admin.from('boms').select('bom_id, status').in('parent_item_id', [...keepItemIds]);
  const archivedKeepItemBomIds = (keepItemAllBoms ?? []).filter((b) => b.status === 'archived').map((b) => b.bom_id);
  const bomIdsToDelete = [...(dropItemBoms ?? []).map((b) => b.bom_id), ...archivedKeepItemBomIds];

  await run(admin.from('bom_lines').delete().in('bom_id', bomIdsToDelete.length ? bomIdsToDelete : [-1]), 'bom_lines (non-keep item + BOM lama archived)');
  await run(admin.from('boms').delete().in('bom_id', bomIdsToDelete.length ? bomIdsToDelete : [-1]), 'boms (non-keep item + archived versi lama)');

  const { data: dropItemRoutings } = await admin.from('routings').select('routing_id').in('item_id', dropItemIds.length ? dropItemIds : [-1]);
  const dropRoutingIds = (dropItemRoutings ?? []).map((r) => r.routing_id);
  await run(admin.from('routing_steps').delete().in('routing_id', dropRoutingIds.length ? dropRoutingIds : [-1]), 'routing_steps (non-keep item)');
  await run(admin.from('routings').delete().in('routing_id', dropRoutingIds.length ? dropRoutingIds : [-1]), 'routings (non-keep item)');

  await run(admin.from('production_standards').delete().in('item_id', dropItemIds.length ? dropItemIds : [-1]), 'production_standards (non-keep item)');

  const { data: employees } = await admin.from('employees').select('employee_id, position').eq('company_id', companyId);
  const dropEmployeeIds = employees.filter((e) => !KEEP_EMPLOYEE_POSITIONS.has(e.position)).map((e) => e.employee_id);
  // Ditemukan lewat percobaan sungguhan di DEV (FK error nyata, tidak muncul di staging
  // karena data uji representatif staging tidak menyertakan employee_attendance) --
  // absensi karyawan demo harus dihapus dulu sebelum karyawannya sendiri.
  await run(admin.from('employee_attendance').delete().in('employee_id', dropEmployeeIds.length ? dropEmployeeIds : [-1]), 'employee_attendance (non-keep employee)');
  await run(admin.from('employees').delete().in('employee_id', dropEmployeeIds.length ? dropEmployeeIds : [-1]), 'employees (non-keep position)');

  await run(admin.from('items').delete().in('item_id', dropItemIds.length ? dropItemIds : [-1]), 'items (non-keep item_code)');
  await run(admin.from('production_plants').delete().in('production_plant_id', dropPlantIds.length ? dropPlantIds : [-1]), 'production_plants (non-keep name)');

  console.log('\n=== SELESAI ===');
}

async function run(query, label) {
  // CATATAN: `count: 'exact'` pada delete().select() TERBUKTI selalu melaporkan 0
  // walau baris sungguhan terhapus (dibuktikan langsung: cek tabel sebelum/sesudah
  // di staging, baris memang hilang tapi count di sini tetap 0) -- jadi pakai
  // panjang array `data` yang benar-benar dikembalikan, bukan `count`.
  const { data, error } = await query.select('*');
  if (error) {
    throw new Error(`GAGAL hapus ${label}: ${error.message}`);
  }
  console.log(`  [${label}] terhapus: ${data?.length ?? 0} baris`);
}

async function purgeEntireCompany(companyId) {
  const tablesInOrder = [
    ['system_alerts', 'company_id'],
    ['work_order_assignments', null],
    ['work_order_consumption', null],
    ['work_order_step_progress', null],
    ['lot_genealogy', null],
    ['work_order_outputs', null],
    ['production_batches', null],
    ['work_orders', 'company_id'],
    ['shipment_lines', null],
    ['delivery_confirmations', null],
    ['shipments', 'company_id'],
    ['sales_order_lines', null],
    ['sales_orders', 'company_id'],
    ['customer_po_approvals', null],
    ['customer_purchase_order_lines', null],
    ['customer_purchase_orders', 'company_id'],
    ['customers', 'company_id'],
    ['goods_receipt_lines', null],
    ['goods_receipts', null],
    ['purchase_order_lines', null],
    ['purchase_orders', 'company_id'],
    ['suppliers', 'company_id'],
    ['stock_movements', 'company_id'],
    ['lots', 'company_id'],
    ['bom_lines', null],
    ['boms', 'company_id'],
    ['routing_steps', null],
    ['routings', 'company_id'],
    ['production_standards', 'company_id'],
    ['employees', 'company_id'],
    ['items', 'company_id'],
    ['production_plants', 'company_id'],
    ['users', 'company_id']
  ];
  // Untuk kolom yang bukan company_id langsung (anak dari WO/batch/dst), scoping
  // ketat butuh subquery per company -- tapi karena company ini SELURUHNYA orphan
  // (dibuat sesi ini, tidak ada company lain berbagi WO/batch/dst dengannya), aman
  // hapus berdasar FK ke parent yang SUDAH pasti scoped ke company ini via WO/batch id.
  const { data: wos } = await admin.from('work_orders').select('work_order_id').eq('company_id', companyId);
  const woIds = (wos ?? []).map((w) => w.work_order_id);
  const { data: batches } = await admin.from('production_batches').select('production_batch_id').in('work_order_id', woIds.length ? woIds : [-1]);
  const batchIds = (batches ?? []).map((b) => b.production_batch_id);
  const { data: shipmentsRows } = await admin.from('shipments').select('shipment_id').eq('company_id', companyId);
  const shipmentIds = (shipmentsRows ?? []).map((s) => s.shipment_id);
  const { data: cposRows } = await admin.from('customer_purchase_orders').select('customer_purchase_order_id').eq('company_id', companyId);
  const cpoIds = (cposRows ?? []).map((c) => c.customer_purchase_order_id);
  const { data: sosRows } = await admin.from('sales_orders').select('sales_order_id').eq('company_id', companyId);
  const soIds = (sosRows ?? []).map((s) => s.sales_order_id);
  const { data: posRows } = await admin.from('purchase_orders').select('purchase_order_id').eq('company_id', companyId);
  const poIds = (posRows ?? []).map((p) => p.purchase_order_id);
  const { data: grRows } = await admin.from('goods_receipts').select('goods_receipt_id').in('purchase_order_id', poIds.length ? poIds : [-1]);
  const grIds = (grRows ?? []).map((g) => g.goods_receipt_id);
  const { data: itemsRows } = await admin.from('items').select('item_id').eq('company_id', companyId);
  const itemIds = (itemsRows ?? []).map((i) => i.item_id);
  const { data: bomsRows } = await admin.from('boms').select('bom_id').in('parent_item_id', itemIds.length ? itemIds : [-1]);
  const bomIds = (bomsRows ?? []).map((b) => b.bom_id);
  const { data: routingsRows } = await admin.from('routings').select('routing_id').in('item_id', itemIds.length ? itemIds : [-1]);
  const routingIds = (routingsRows ?? []).map((r) => r.routing_id);

  await admin.from('system_alerts').delete().eq('company_id', companyId);
  await admin.from('work_order_assignments').delete().in('work_order_id', woIds.length ? woIds : [-1]);
  await admin.from('work_order_consumption').delete().in('work_order_id', woIds.length ? woIds : [-1]);
  await admin.from('work_order_step_progress').delete().in('work_order_id', woIds.length ? woIds : [-1]);
  await admin.from('lot_genealogy').delete().in('output_lot_id', (await admin.from('lots').select('lot_id').eq('company_id', companyId)).data?.map((l) => l.lot_id) ?? [-1]);
  await admin.from('work_order_outputs').delete().in('work_order_id', woIds.length ? woIds : [-1]);
  await admin.from('production_batches').delete().in('work_order_id', woIds.length ? woIds : [-1]);
  // Pass kedua (lihat catatan sama di main()): trigger readiness bikin alert baru
  // begitu work_order_assignments dihapus.
  await admin.from('system_alerts').delete().eq('company_id', companyId);
  await admin.from('work_orders').delete().eq('company_id', companyId);
  await admin.from('shipment_lines').delete().in('shipment_id', shipmentIds.length ? shipmentIds : [-1]);
  await admin.from('delivery_confirmations').delete().in('shipment_id', shipmentIds.length ? shipmentIds : [-1]);
  await admin.from('shipments').delete().eq('company_id', companyId);
  await admin.from('sales_order_lines').delete().in('sales_order_id', soIds.length ? soIds : [-1]);
  await admin.from('sales_orders').delete().eq('company_id', companyId);
  await admin.from('customer_po_approvals').delete().in('customer_purchase_order_id', cpoIds.length ? cpoIds : [-1]);
  await admin.from('customer_purchase_order_lines').delete().in('customer_purchase_order_id', cpoIds.length ? cpoIds : [-1]);
  await admin.from('customer_purchase_orders').delete().eq('company_id', companyId);
  await admin.from('customers').delete().eq('company_id', companyId);
  await admin.from('goods_receipt_lines').delete().in('goods_receipt_id', grIds.length ? grIds : [-1]);
  await admin.from('goods_receipts').delete().in('purchase_order_id', poIds.length ? poIds : [-1]);
  await admin.from('purchase_order_lines').delete().in('purchase_order_id', poIds.length ? poIds : [-1]);
  await admin.from('purchase_orders').delete().eq('company_id', companyId);
  await admin.from('suppliers').delete().eq('company_id', companyId);
  await admin.from('stock_movements').delete().eq('company_id', companyId);
  await admin.from('lots').delete().eq('company_id', companyId);
  await admin.from('bom_lines').delete().in('bom_id', bomIds.length ? bomIds : [-1]);
  await admin.from('boms').delete().eq('company_id', companyId);
  await admin.from('routing_steps').delete().in('routing_id', routingIds.length ? routingIds : [-1]);
  await admin.from('routings').delete().eq('company_id', companyId);
  await admin.from('production_standards').delete().eq('company_id', companyId);
  await admin.from('employee_attendance').delete().eq('company_id', companyId);
  await admin.from('employees').delete().eq('company_id', companyId);
  await admin.from('items').delete().eq('company_id', companyId);
  await admin.from('production_plants').delete().eq('company_id', companyId);
  await admin.from('users').delete().eq('company_id', companyId);
  await admin.from('companies').delete().eq('company_id', companyId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

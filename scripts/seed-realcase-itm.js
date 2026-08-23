// Seed data REAL CASE PT ITM (GELOMBANG 1, docs/spesifikasi-aturan-biaya-v1.md rev. 3
// + docs/data-produksi-itm-ekstrak.md). IDEMPOTENT — aman dijalankan berulang (upsert
// item/BOM/routing/employee by kode unik, CPO dicek dulu apa sudah ada sebelum create
// lewat API).
//
// CATATAN PENTING: 2 hal SENGAJA TIDAK dikerjakan di sini (dicatat di HANDOFF.md):
// 1. BOM Drinkme Lemon (item PMBX001ITM) & Sachet-nya (PMSC001ITM) — resep TOP-LEVEL
//    (rasio 5 premix + bahan curah per unit output) tidak ada di spec maupun ekstrak
//    manapun, cuma agregat biaya per-batch yang diberikan. BOM lama (fiktif, dari
//    scripts/seed-debug-powder-drink.js) DIBIARKAN APA ADANYA — bukan ditimpa dengan
//    angka karangan.
// 2. Pembersihan data demo lama (GELOMBANG 1 poin 8) — BELUM dijalankan, environment
//    kerja ini tidak punya Docker (prasyarat WAJIB pg_dump/`supabase db dump` bahkan
//    versi --linked --data-only tetap butuh Docker) jadi syarat backup WAJIB dari
//    instruksi asli belum bisa dipenuhi jujur. Data lama TETAP ADA berdampingan
//    dengan data real-case baru sampai ini bisa dijalankan dari environment yang
//    punya Docker.
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });


// INF-14 (23 Agu 2026) -- pengawas tingkat project: skrip ini MENULIS data,
// jadi WAJIB gagal keras bila diarahkan ke project berisi data nyata.
require('./guard-real-project').assertNotRealProject('scripts/seed-realcase-itm.js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const BASE_URL = process.env.SEED_BASE_URL || 'http://localhost:3000';

// ============================================================================
// 1. ITEMS — 28 bahan baku (docs/data-produksi-itm-ekstrak.md §4, harga/kg -> /1000
//    utk per-gram/per-ml sesuai base_uom) + kemasan (§5) + WIP premix + FG.
// ============================================================================
const rawMaterials = [
  { item_code: 'RM-MALTITOL', name: 'Maltitol Powder', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 315000 },
  { item_code: 'RM-POLYSORB', name: 'Polysorb', base_uom: 'ml', purchase_uom: 'liter', factor: 1000, pricePerKg: 268000 },
  { item_code: 'RM-SORBITOL-LIQUID', name: 'Sorbitol Liquid', base_uom: 'ml', purchase_uom: 'liter', factor: 1000, pricePerKg: 18000 },
  { item_code: 'RM-GELATIN-NB250', name: 'Gelatin Nitta Bloom250', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 210000 },
  { item_code: 'RM-PERFECTA-GEL-928', name: 'Perfecta Gel 928', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 95000 },
  { item_code: 'RM-PERFECTA-GEL-MB', name: 'Perfecta Gel MB', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 60000 },
  { item_code: 'RM-GELLAN-GUM', name: 'Gellan Gum', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 400000 },
  { item_code: 'RM-GLISERIN', name: 'Gliserin', base_uom: 'ml', purchase_uom: 'liter', factor: 1000, pricePerKg: 30000 },
  { item_code: 'RM-POLYDEXTROSE', name: 'Polydextrose', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 60000 },
  { item_code: 'RM-MALICACID', name: 'Malic Acid', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 44000 },
  { item_code: 'RM-CITRICACID', name: 'Citric Acid', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 25000 },
  { item_code: 'RM-COLLAGEN', name: 'Kolagen', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 210000 },
  { item_code: 'RM-GLUTATHIONE', name: 'Glutathione', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 2500000 },
  { item_code: 'RM-AIR', name: 'Air', base_uom: 'ml', purchase_uom: 'liter', factor: 1000, pricePerKg: 500 },
  { item_code: 'RM-MALTODEXTRIN', name: 'Maltodextrin', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 20000 },
  { item_code: 'RM-SORBITOL-POWDER', name: 'Sorbitol Powder', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 58000 },
  { item_code: 'RM-INULIN', name: 'Inulin', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 60000 },
  { item_code: 'RM-PSYLIUM-HUSK', name: 'Psylium Husk', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 280000 },
  { item_code: 'RM-PAPAIN', name: 'Papain', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 500000 },
  { item_code: 'RM-BROMALIN', name: 'Bromalin', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 400000 },
  { item_code: 'RM-ZOEFREE', name: 'Zoefree', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 28000 },
  { item_code: 'RM-GARAM', name: 'Garam', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 12000 },
  { item_code: 'RM-GARCINIA-CAMBOGIA', name: 'Garcinia Cambogia', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 400000 },
  { item_code: 'RM-STEVIA-POWDER', name: 'Stevia Powder', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 900000 },
  { item_code: 'RM-SUCRALOSE', name: 'Sucralose', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 40000 },
  { item_code: 'RM-DERASI-ORANGE', name: 'Derasi Orange', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 1400000 },
  { item_code: 'RM-ASCORBIC-ACID', name: 'Ascorbic Acid', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 70000 },
  { item_code: 'RM-SEREH-POWDER', name: 'Sereh Powder', base_uom: 'g', purchase_uom: 'kg', factor: 1000, pricePerKg: 300000 }
];

// Kemasan (§5) — item lama (dari demo) DIKOREKSI harganya; item baru dibuat.
const packagingItems = [
  { item_code: 'PKG-BOTOL-PET-N200', name: 'Botol PET N200', price: 5500 },
  { item_code: 'PKG-LABEL-STIKER-N200', name: 'Label Stiker Botol N200', price: 1100 },
  { item_code: 'PKG-INNER-SLEEVE', name: 'Inner Box', price: 800 },
  { item_code: 'PKG-OUTER-BOX', name: 'Outer Box', price: 1100 },
  { item_code: 'PKG-SEAL-STICKER', name: 'Stiker Segel', price: 200 },
  { item_code: 'PKG-KARTON-GUMMY-27', name: 'Karton Gummy (isi 27 botol)', price: 3500 },
  { item_code: 'PMPKF001ITM', name: 'Sachet', price: 138 },
  { item_code: 'PMPKB001ITM', name: 'Box isi 14 Sachet', price: 1500 },
  { item_code: 'PKG-PLASTIC-WRAP-BOX', name: 'Plastic Wrap Box', price: 200 },
  { item_code: 'PKG-KARTON-SERBUK-42', name: 'Karton Serbuk (isi 42 box)', price: 15000 }
];

// WIP: Premix Gelatin (Zala, item baru) + 5 premix serbuk (3 dikoreksi dari demo lama
// PMSW001ITM/PMAC001ITM/PMFLV001ITM, 2 baru PMVITC/PMSRH).
const wipItems = [
  { item_code: 'WIP-PREMIX-GELATIN-ZALA', name: 'Premix Gelatin (Zala)', base_uom: 'g' },
  { item_code: 'PMSW001ITM', name: 'Premix Pemanis (PMSW)', base_uom: 'g' },
  { item_code: 'PMAC001ITM', name: 'Premix Acid (PMAC)', base_uom: 'g' },
  { item_code: 'PMFLV001ITM', name: 'Premix Flavor (PMFL)', base_uom: 'g' },
  { item_code: 'PM-VITC-001ITM', name: 'Premix Vitamin C (PMVITC)', base_uom: 'g' },
  { item_code: 'PM-SRH-001ITM', name: 'Premix Sereh (PMSRH)', base_uom: 'g' }
];

const finishedGoods = [
  { item_code: 'FG-GUMMY-ZALA-N200', name: 'Gummy Zala - Isi 60 (N200)', base_uom: 'pcs' }
];

// ============================================================================
// 2. BOM — Premix Gelatin (per gram output) + Gummy Zala (per 1 botol) + 5 premix
//    serbuk (per gram output, ratio dari spec + ekstrak, TERVERIFIKASI cocok persis
//    dengan angka agregat spec §5 Contoh 2 -- lihat catatan verifikasi di HANDOFF).
//    Drinkme/Sachet SENGAJA tidak disentuh (lihat catatan atas).
// ============================================================================

// Premix Gelatin: 768.33g gelatin + 12.81g citric + 1280.55ml air -> 2061.69g output.
const PREMIX_GELATIN_OUTPUT_G = 2061.69;
const premixGelatinLines = [
  { component_item_code: 'RM-GELATIN-NB250', qtyPerBatch: 768.33, uom: 'g' },
  { component_item_code: 'RM-CITRICACID', qtyPerBatch: 12.81, uom: 'g' },
  { component_item_code: 'RM-AIR', qtyPerBatch: 1280.55, uom: 'ml' }
];

// Gummy Zala per 1 botol = (batch @ skala 27.440419) / 51 botol. CATATAN rev.4: spec
// dikoreksi batch gummy 9kg->10kg (skala jadi 30.489354, 56,6667 botol/batch) — rasio
// PER BOTOL di bawah ini TIDAK PERLU diubah (resep sama, cuma di-scale-up linear;
// diverifikasi: Maltitol lama 1097,62/51=21,5227g/botol, baru 1219,57/56,6667=
// 21,5229g/botol — identik selain floating-point). production_standards.unit_per_batch
// yang perlu dikoreksi (lihat bagian 3b di bawah), bukan bom_lines ini.
const GUMMY_ZALA_YIELD_BOTOL = 51;
const gummyZalaLines = [
  { component_item_code: 'RM-MALTITOL', qtyPerBatch: 1097.62, uom: 'g' },
  { component_item_code: 'RM-POLYSORB', qtyPerBatch: 1372.02, uom: 'ml' },
  { component_item_code: 'RM-SORBITOL-LIQUID', qtyPerBatch: 686.01, uom: 'ml' },
  { component_item_code: 'RM-PERFECTA-GEL-928', qtyPerBatch: 329.29, uom: 'g' },
  { component_item_code: 'RM-PERFECTA-GEL-MB', qtyPerBatch: 109.76, uom: 'g' },
  { component_item_code: 'RM-GELLAN-GUM', qtyPerBatch: 6.86, uom: 'g' },
  { component_item_code: 'RM-GLISERIN', qtyPerBatch: 27.44, uom: 'ml' },
  { component_item_code: 'RM-POLYDEXTROSE', qtyPerBatch: 411.61, uom: 'g' },
  { component_item_code: 'RM-MALICACID', qtyPerBatch: 32.93, uom: 'g' },
  { component_item_code: 'RM-CITRICACID', qtyPerBatch: 5.49, uom: 'g' },
  { component_item_code: 'RM-COLLAGEN', qtyPerBatch: 109.76, uom: 'g' },
  { component_item_code: 'RM-GLUTATHIONE', qtyPerBatch: 5.49, uom: 'g' },
  { component_item_code: 'RM-AIR', qtyPerBatch: 2744.04, uom: 'ml' },
  { component_item_code: 'WIP-PREMIX-GELATIN-ZALA', qtyPerBatch: 2061.69, uom: 'g' },
  // Kemasan per botol (K6: dikonsumsi di tahap Filling/Pengemasan lewat mekanisme
  // yang sama seperti bahan baku — jadi masuk BOM apa adanya, bukan dihitung terpisah).
  { component_item_code: 'PKG-BOTOL-PET-N200', qtyPerBatch: 1, uom: 'pcs' },
  { component_item_code: 'PKG-LABEL-STIKER-N200', qtyPerBatch: 1, uom: 'pcs' },
  { component_item_code: 'PKG-INNER-SLEEVE', qtyPerBatch: 1, uom: 'pcs' },
  { component_item_code: 'PKG-OUTER-BOX', qtyPerBatch: 1, uom: 'pcs' },
  { component_item_code: 'PKG-SEAL-STICKER', qtyPerBatch: 1, uom: 'pcs' },
  { component_item_code: 'PKG-KARTON-GUMMY-27', qtyPerBatch: 1 / 27, uom: 'pcs' }
];

// 5 premix serbuk, per 100g -> per gram output (ratio TERVERIFIKASI cocok persis
// dengan Bahan/g agregat spec §5 Contoh 2: PMSW 202.0, PMAC 23.6, PMFL 185.876,
// PMVITC 25.0, PMSRH 76.0 Rp/g -- lihat perhitungan verifikasi di HANDOFF.md).
const premixSerbukBoms = [
  { parent: 'PMSW001ITM', lines: [{ c: 'RM-MALTODEXTRIN', qty: 50 }, { c: 'RM-STEVIA-POWDER', qty: 20 }, { c: 'RM-SUCRALOSE', qty: 30 }] },
  { parent: 'PMAC001ITM', lines: [{ c: 'RM-MALTODEXTRIN', qty: 85 }, { c: 'RM-MALICACID', qty: 15 }] },
  { parent: 'PMFLV001ITM', lines: [{ c: 'RM-MALTODEXTRIN', qty: 87.98 }, { c: 'RM-DERASI-ORANGE', qty: 12.02 }] },
  { parent: 'PM-VITC-001ITM', lines: [{ c: 'RM-MALTODEXTRIN', qty: 90 }, { c: 'RM-ASCORBIC-ACID', qty: 10 }] },
  { parent: 'PM-SRH-001ITM', lines: [{ c: 'RM-MALTODEXTRIN', qty: 80 }, { c: 'RM-SEREH-POWDER', qty: 20 }] }
];

// Drinkme Lemon (A1) — resep top-level LENGKAP, diberikan pemilik produk 18 Agu (basis
// 19,655g, sesuai basis yang sudah dipakai spec §5 Contoh 2 utk batch 60kg/3052,6558x).
// Semua komponen SUDAH ADA di item master (raw material dari GELOMBANG 1 + 5 premix
// serbuk) — tidak perlu item baru. TERVERIFIKASI: total biaya basis 19,655g × skala
// 3052,6558 = Rp4.965.906,1x, cocok persis spec (pakai biaya LOT premix, bahan+SDM,
// BUKAN cuma "Bahan/g" — lihat catatan verifikasi di HANDOFF.md).
const DRINKME_BASIS_G = 19.655;
const DRINKME_BATCH_G = 60000;
const DRINKME_BOX_YIELD_PER_BATCH = 226.19; // production_standards PMBX001ITM.unit_per_batch
const drinkmeLines = [
  { c: 'RM-MALTODEXTRIN', qty: 5 },
  { c: 'RM-SORBITOL-POWDER', qty: 7 },
  { c: 'RM-POLYDEXTROSE', qty: 1 },
  { c: 'RM-INULIN', qty: 2 },
  { c: 'RM-PSYLIUM-HUSK', qty: 1 },
  { c: 'RM-PAPAIN', qty: 0.2 },
  { c: 'RM-BROMALIN', qty: 0.1 },
  { c: 'RM-ZOEFREE', qty: 0.075 },
  { c: 'RM-GARAM', qty: 0.01 },
  { c: 'RM-GARCINIA-CAMBOGIA', qty: 0.1 },
  { c: 'PMSW001ITM', qty: 0.04 },
  { c: 'PMAC001ITM', qty: 0.08 },
  { c: 'PMFLV001ITM', qty: 2.4 },
  { c: 'PM-VITC-001ITM', qty: 0.6 },
  { c: 'PM-SRH-001ITM', qty: 0.05 }
];
// Kemasan per box (K6 — dikonsumsi lewat mekanisme sama seperti bahan baku, sama pola
// dengan Gummy Zala) — sesuai formula kemasan yang SUDAH diberikan spec §5 Contoh 2:
// "14×138 + 1.500 + 200 + 15.000/42 = Rp3.989,14/box". Qty di sini FIXED per 1 box
// (bukan hasil skala basis 19,655g seperti bahan baku di atas).
const drinkmePackagingLinesPerBox = [
  { c: 'PMPKF001ITM', qtyPerBox: 14, uom: 'pcs' }, // Sachet
  { c: 'PMPKB001ITM', qtyPerBox: 1, uom: 'pcs' }, // Box isi 14 Sachet
  { c: 'PKG-PLASTIC-WRAP-BOX', qtyPerBox: 1, uom: 'pcs' },
  { c: 'PKG-KARTON-SERBUK-42', qtyPerBox: 1 / 42, uom: 'pcs' }
];

// ============================================================================
// 3. ROUTING — docs/data-produksi-itm-ekstrak.md §2 (Gummy, 10 proses -> 9 di routing
//    Gummy Zala + 1 di routing Premix Gelatin) & §3 (Serbuk, 12 proses -> belum
//    dipasang ke item manapun krn Drinkme/Sachet BOM masih blocked, dicatat di
//    HANDOFF). active_duration_minutes SEMUA berlabel ESTIMASI_MANUAL (K8) --
//    "estimasi kasar BERLABEL" sesuai instruksi eksplisit, BUKAN dari PDF (PDF tidak
//    memberi angka durasi aktif sama sekali).
const premixGelatinRoutingSteps = [{ step_name: 'Dry Mix & Masak Air', active: 30, wait: 720 }]; // wait 12 jam
const gummyZalaRoutingSteps = [
  { step_name: 'Proses Cooking', active: 90, wait: 0 },
  { step_name: 'Molding', active: 20, wait: 0 },
  { step_name: 'Setting', active: 5, wait: 960 }, // wait ~16 jam (rev.4: realitas lapangan semalaman, bukan 1 jam SOP PDF)
  { step_name: 'Demolding', active: 30, wait: 0 },
  { step_name: 'Coating', active: 15, wait: 0 },
  { step_name: 'Curing', active: 5, wait: 4320 }, // wait 3 hari
  { step_name: 'Filling', active: 45, wait: 0 },
  { step_name: 'Pengemasan', active: 60, wait: 0 },
  { step_name: 'Pengepakan', active: 20, wait: 0 }
];
const premixSerbukRoutingStep = { step_name: 'Mixing Premix', active: 15, wait: 0 };

// ============================================================================
// 4. KARYAWAN (33 orang, docs/data-produksi-itm-ekstrak.md §1)
// ============================================================================
const employees = [
  { name: 'Alvan', position: 'Direktur', department: 'management', wage_type: 'monthly', wage_rate: 20000000 },
  { name: 'Bayu', position: 'General Manager', department: 'management', wage_type: 'monthly', wage_rate: 15000000 },
  { name: 'Dimas', position: 'Manager PPIC', department: 'ppic', wage_type: 'monthly', wage_rate: 8000000 },
  { name: 'Dika', position: 'Staff PPIC', department: 'ppic', wage_type: 'monthly', wage_rate: 4000000 },
  { name: 'Mega', position: 'Staff Purchasing', department: 'purchasing', wage_type: 'monthly', wage_rate: 3500000 },
  { name: 'Asni', position: 'SPV Finance', department: 'finance', wage_type: 'monthly', wage_rate: 5000000 },
  { name: 'Ayu', position: 'SPV HRD', department: 'hr', wage_type: 'monthly', wage_rate: 5000000 },
  { name: 'Dina', position: 'SPV Produksi Gummy', department: 'production', wage_type: 'monthly', wage_rate: 3500000 },
  { name: 'Angga', position: 'SPV Produksi Powder', department: 'production', wage_type: 'monthly', wage_rate: 3500000 },
  ...['Miasih', 'Sutik', 'Mini', 'Momo', 'Joni', 'Alif'].map((name) => ({ name, position: 'Pegawai Kontrak Gummy', department: 'production', wage_type: 'monthly', wage_rate: 2000000 })),
  ...['Iwan', 'Nawi', 'Budi', 'Joko', 'Retno', 'Mimi'].map((name) => ({ name, position: 'Pegawai PHL Gummy', department: 'production', wage_type: 'daily', wage_rate: 50000 })),
  ...['Ali', 'Uli', 'Ardi', 'Yupi', 'Bobo', 'Baki', 'Moli', 'Suci', 'Tono', 'Tunik', 'Centik', 'Boko'].map((name) => ({
    name,
    position: 'Pegawai PHL Powder',
    department: 'production',
    wage_type: 'daily',
    wage_rate: 50000
  }))
];

// ============================================================================
// 5. KONFIGURASI BIAYA per tenant (spec §2) — company_settings, BUKAN konstanta kode.
// ============================================================================
const costConfigSettings = {
  labor_costing_method: 'labor_log',
  scrap_valuation: 'zero',
  overhead_allocation: 'off',
  monthly_overhead_baseline: '60500000',
  work_calendar_weekday_hours: '7',
  work_calendar_saturday_hours: '5',
  standard_hours_per_month: '173.3333'
};

// ============================================================================
// Helpers
// ============================================================================
async function upsertItem(companyId, item) {
  const { error } = await admin.from('items').upsert([{ ...item, company_id: companyId, is_active: true }], { onConflict: 'company_id,item_code' });
  if (error) throw new Error(`Failed to upsert item ${item.item_code}: ${error.message}`);
}

async function upsertBom(companyId, itemIdByCode, parentItemCode, yieldQty, yieldUom, lines) {
  const parentItemId = itemIdByCode.get(parentItemCode);
  if (!parentItemId) throw new Error(`${parentItemCode} not found after upsert.`);

  const { data: existingBom } = await admin.from('boms').select('bom_id').eq('company_id', companyId).eq('parent_item_id', parentItemId).eq('version', 1).maybeSingle();
  let bomId = existingBom?.bom_id;

  if (bomId) {
    const { error } = await admin.from('boms').update({ standard_yield_qty: yieldQty, standard_yield_uom: yieldUom, status: 'active' }).eq('bom_id', bomId);
    if (error) throw new Error(`Failed to update BOM ${parentItemCode}: ${error.message}`);
    await admin.from('bom_lines').delete().eq('bom_id', bomId);
  } else {
    const { data: inserted, error } = await admin
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: parentItemId, version: 1, standard_yield_qty: yieldQty, standard_yield_uom: yieldUom, status: 'active' }])
      .select('bom_id')
      .single();
    if (error) throw new Error(`Failed to insert BOM ${parentItemCode}: ${error.message}`);
    bomId = inserted.bom_id;
  }

  const lineRows = lines.map((line) => {
    const componentItemId = itemIdByCode.get(line.component_item_code);
    if (!componentItemId) throw new Error(`Component ${line.component_item_code} not found for BOM ${parentItemCode}.`);
    return { bom_id: bomId, component_item_id: componentItemId, qty_per_unit_output: line.qtyPerBatch / yieldQty, uom: line.uom };
  });
  const { error: linesError } = await admin.from('bom_lines').insert(lineRows);
  if (linesError) throw new Error(`Failed to insert bom_lines for ${parentItemCode}: ${linesError.message}`);
  console.log(`Ensured BOM ${parentItemCode} (${lineRows.length} komponen).`);
  return bomId;
}

// Versioning SUNGGUHAN (arsipkan, jangan timpa) — dipakai KHUSUS Drinkme Lemon karena
// BOM lama (dari scripts/seed-debug-powder-drink.js) FIKTIF ("data uji, bukan resep
// asli") dan riwayatnya perlu tetap tersimpan (bukan dihapus), beda dari upsertBom()
// di atas yang update-in-place cocok untuk item yang memang belum pernah punya BOM asli.
async function archiveAndCreateBomVersion(companyId, itemIdByCode, parentItemCode, yieldQty, yieldUom, lines) {
  const parentItemId = itemIdByCode.get(parentItemCode);
  if (!parentItemId) throw new Error(`${parentItemCode} not found after upsert.`);

  const { data: existingVersions } = await admin.from('boms').select('bom_id, version, status').eq('company_id', companyId).eq('parent_item_id', parentItemId).order('version', { ascending: false });

  const activeOld = (existingVersions ?? []).filter((b) => b.status === 'active');
  // Idempotency: kalau versi aktif SEKARANG sudah punya komponen persis sama (set kode
  // item) dengan yang mau ditulis, anggap sudah tersinkron — jangan bikin versi baru
  // tiap kali script diulang (baru arsipkan+versi baru kalau BENAR-BENAR beda, mis.
  // transisi 1x dari BOM fiktif lama ke resep asli).
  if (activeOld.length === 1) {
    const { data: currentLines } = await admin.from('bom_lines').select('component_item_id').eq('bom_id', activeOld[0].bom_id);
    const currentItemIds = new Set((currentLines ?? []).map((l) => l.component_item_id));
    const expectedItemIds = new Set(lines.map((l) => itemIdByCode.get(l.component_item_code)));
    const sameSet = currentItemIds.size === expectedItemIds.size && [...currentItemIds].every((id) => expectedItemIds.has(id));
    if (sameSet) {
      console.log(`BOM ${parentItemCode} v${activeOld[0].version} sudah sinkron dengan resep asli, skip (idempotent).`);
      return activeOld[0].bom_id;
    }
  }
  for (const old of activeOld) {
    await admin.from('boms').update({ status: 'archived' }).eq('bom_id', old.bom_id);
    console.log(`Arsipkan BOM lama ${parentItemCode} v${old.version} (fiktif, "data uji" — riwayat tetap tersimpan, cuma diubah status).`);
  }

  const nextVersion = ((existingVersions ?? [])[0]?.version ?? 0) + 1;
  const { data: inserted, error } = await admin
    .from('boms')
    .insert([{ company_id: companyId, parent_item_id: parentItemId, version: nextVersion, standard_yield_qty: yieldQty, standard_yield_uom: yieldUom, status: 'active' }])
    .select('bom_id')
    .single();
  if (error) throw new Error(`Failed to insert BOM version for ${parentItemCode}: ${error.message}`);

  const lineRows = lines.map((line) => {
    const componentItemId = itemIdByCode.get(line.component_item_code);
    if (!componentItemId) throw new Error(`Component ${line.component_item_code} not found for BOM ${parentItemCode}.`);
    return { bom_id: inserted.bom_id, component_item_id: componentItemId, qty_per_unit_output: line.qtyPerBatch / yieldQty, uom: line.uom };
  });
  const { error: linesError } = await admin.from('bom_lines').insert(lineRows);
  if (linesError) throw new Error(`Failed to insert bom_lines for ${parentItemCode} v${nextVersion}: ${linesError.message}`);
  console.log(`Ensured BOM ${parentItemCode} v${nextVersion} ACTIVE (${lineRows.length} komponen, resep asli).`);
  return inserted.bom_id;
}

async function upsertRouting(companyId, itemIdByCode, itemCode, steps) {
  const itemId = itemIdByCode.get(itemCode);
  if (!itemId) throw new Error(`${itemCode} not found for routing.`);

  const { data: existing } = await admin.from('routings').select('routing_id').eq('company_id', companyId).eq('item_id', itemId).eq('version', 1).maybeSingle();
  let routingId = existing?.routing_id;
  if (routingId) {
    await admin.from('routing_steps').delete().eq('routing_id', routingId);
  } else {
    const { data: inserted, error } = await admin.from('routings').insert([{ company_id: companyId, item_id: itemId, version: 1 }]).select('routing_id').single();
    if (error) throw new Error(`Failed to insert routing for ${itemCode}: ${error.message}`);
    routingId = inserted.routing_id;
  }

  const stepRows = steps.map((step, index) => ({
    routing_id: routingId,
    sequence_no: index + 1,
    step_name: step.step_name,
    active_duration_minutes: step.active,
    wait_duration_minutes: step.wait
  }));
  const { error: stepsError } = await admin.from('routing_steps').insert(stepRows);
  if (stepsError) throw new Error(`Failed to insert routing_steps for ${itemCode}: ${stepsError.message}`);
  console.log(`Ensured routing ${itemCode} (${stepRows.length} langkah, semua active_duration ESTIMASI_MANUAL/K8).`);
  return routingId;
}

async function login(email, password) {
  // Pakai REST auth langsung (bukan admin client) supaya dapat access_token user asli.
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login gagal untuk ${email}: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function apiCall(token, path, method, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: json };
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  const { data: debugUser, error: debugUserError } = await admin.from('users').select('company_id').eq('email', 'company.a@debug.mrp').maybeSingle();
  if (debugUserError) throw new Error(debugUserError.message);
  if (!debugUser) throw new Error('company.a@debug.mrp not found.');
  const companyId = debugUser.company_id;

  const { data: plant, error: plantError } = await admin.from('production_plants').select('production_plant_id').eq('company_id', companyId).eq('name', 'Pabrik Utama PT ITM').maybeSingle();
  if (plantError || !plant) throw new Error('Pabrik Utama PT ITM tidak ditemukan.');
  const plantId = plant.production_plant_id;

  console.log('=== 1. Items ===');
  for (const rm of rawMaterials) {
    await upsertItem(companyId, {
      item_code: rm.item_code,
      name: rm.name,
      type: 'raw_material',
      base_uom: rm.base_uom,
      purchase_uom: rm.purchase_uom,
      uom_conversion_factor: rm.factor,
      standard_cost: rm.pricePerKg / 1000
    });
  }
  for (const pkg of packagingItems) {
    await upsertItem(companyId, { item_code: pkg.item_code, name: pkg.name, type: 'packaging', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1, standard_cost: pkg.price });
  }
  for (const wip of wipItems) {
    await upsertItem(companyId, { item_code: wip.item_code, name: wip.name, type: 'wip', base_uom: wip.base_uom, purchase_uom: wip.base_uom, uom_conversion_factor: 1, standard_cost: null });
  }
  for (const fg of finishedGoods) {
    await upsertItem(companyId, { item_code: fg.item_code, name: fg.name, type: 'finished_good', base_uom: fg.base_uom, purchase_uom: fg.base_uom, uom_conversion_factor: 1, standard_cost: null });
  }
  console.log(`Ensured ${rawMaterials.length} raw materials, ${packagingItems.length} packaging, ${wipItems.length} WIP, ${finishedGoods.length} finished goods.`);

  const { data: allItems } = await admin.from('items').select('item_id, item_code').eq('company_id', companyId);
  const itemIdByCode = new Map(allItems.map((i) => [i.item_code, i.item_id]));

  console.log('\n=== 2. BOM ===');
  await upsertBom(companyId, itemIdByCode, 'WIP-PREMIX-GELATIN-ZALA', PREMIX_GELATIN_OUTPUT_G, 'g', premixGelatinLines);
  await upsertBom(companyId, itemIdByCode, 'FG-GUMMY-ZALA-N200', GUMMY_ZALA_YIELD_BOTOL, 'pcs', gummyZalaLines);
  for (const premix of premixSerbukBoms) {
    const lines = premix.lines.map((l) => ({ component_item_code: l.c, qtyPerBatch: l.qty, uom: 'g' }));
    await upsertBom(companyId, itemIdByCode, premix.parent, 100, 'g', lines);
  }

  // Drinkme Lemon (A1) — versioning SUNGGUHAN (arsipkan BOM fiktif lama, bukan timpa).
  // BOM per 1 box (base_uom PMBX001ITM = 'pcs'): basis 19,655g -> skala ke 1 batch
  // (60000/19,655) -> skala ke 1 box (dibagi box/batch 226,19).
  const drinkmeBoxScale = (DRINKME_BATCH_G / DRINKME_BASIS_G) / DRINKME_BOX_YIELD_PER_BATCH;
  const drinkmeLinesPerBox = [
    ...drinkmeLines.map((l) => ({ component_item_code: l.c, qtyPerBatch: l.qty * drinkmeBoxScale, uom: 'g' })),
    ...drinkmePackagingLinesPerBox.map((l) => ({ component_item_code: l.c, qtyPerBatch: l.qtyPerBox, uom: l.uom }))
  ];
  await archiveAndCreateBomVersion(companyId, itemIdByCode, 'PMBX001ITM', 1, 'pcs', drinkmeLinesPerBox);

  console.log('\n=== 3. Routing ===');
  await upsertRouting(companyId, itemIdByCode, 'WIP-PREMIX-GELATIN-ZALA', premixGelatinRoutingSteps);
  await upsertRouting(companyId, itemIdByCode, 'FG-GUMMY-ZALA-N200', gummyZalaRoutingSteps);
  for (const premix of premixSerbukBoms) {
    await upsertRouting(companyId, itemIdByCode, premix.parent, [premixSerbukRoutingStep]);
  }

  console.log('\n=== 3b. Production Standards (K8, cold-start ESTIMASI_MANUAL) ===');
  const standardsSeed = [
    { item: 'FG-GUMMY-ZALA-N200', metric: 'yield_percentage', value: 85 },
    // rev.4: batch gummy 10kg (bukan 9kg) -> yield 8.500g -> 3.400 pcs -> 56,6667 botol/batch.
    { item: 'FG-GUMMY-ZALA-N200', metric: 'unit_per_batch', value: 56.6667 },
    // Kapasitas pipeline (§4 rev.4, dikoreksi dari rev.2 "sampai 5 batch/hari"): standar
    // PERENCANAAN 4 batch gummy/hari (maksimal BISA 5, tapi 4 dipakai sebagai standar).
    { item: 'FG-GUMMY-ZALA-N200', metric: 'batches_per_day', value: 4 },
    { item: 'PMBX001ITM', metric: 'yield_percentage', value: 95 },
    { item: 'PMBX001ITM', metric: 'unit_per_batch', value: 226.19 },
    // Kapasitas serbuk (klarifikasi pemilik produk 18 Agu: "3-4 batch 60kg/hari") —
    // 3/hari dipakai sebagai standar ESTIMASI_MANUAL (konservatif, pola sama dengan
    // gummy: standar perencanaan = angka bawah rentang, bukan maksimal teoretis).
    { item: 'PMBX001ITM', metric: 'batches_per_day', value: 3 }
  ];
  for (const s of standardsSeed) {
    const itemId = itemIdByCode.get(s.item);
    if (!itemId) continue;
    const { data: existing } = await admin
      .from('production_standards')
      .select('production_standard_id')
      .eq('company_id', companyId)
      .eq('item_id', itemId)
      .is('routing_step_id', null)
      .eq('metric_key', s.metric)
      .maybeSingle();
    if (existing) {
      await admin.from('production_standards').update({ value: s.value }).eq('production_standard_id', existing.production_standard_id);
    } else {
      await admin.from('production_standards').insert([{ company_id: companyId, item_id: itemId, metric_key: s.metric, value: s.value, source: 'ESTIMASI_MANUAL', sample_count: 0 }]);
    }
    console.log(`Ensured production_standard ${s.item}.${s.metric} = ${s.value} [ESTIMASI_MANUAL]`);
  }

  console.log('\n=== 4. Karyawan (33 orang) ===');
  for (const emp of employees) {
    const { data: existing } = await admin.from('employees').select('employee_id').eq('company_id', companyId).eq('name', emp.name).eq('position', emp.position).maybeSingle();
    if (existing) {
      await admin.from('employees').update({ department: emp.department, wage_type: emp.wage_type, wage_rate: emp.wage_rate, production_plant_id: plantId, is_active: true }).eq('employee_id', existing.employee_id);
    } else {
      await admin.from('employees').insert([{ company_id: companyId, production_plant_id: plantId, name: emp.name, position: emp.position, department: emp.department, wage_type: emp.wage_type, wage_rate: emp.wage_rate, is_active: true }]);
    }
  }
  console.log(`Ensured ${employees.length} employees.`);

  console.log('\n=== 5. Konfigurasi Biaya (company_settings) ===');
  for (const [key, value] of Object.entries(costConfigSettings)) {
    const { data: existing } = await admin.from('company_settings').select('company_setting_id').eq('company_id', companyId).eq('setting_key', key).maybeSingle();
    if (existing) {
      await admin.from('company_settings').update({ setting_value: value }).eq('company_setting_id', existing.company_setting_id);
    } else {
      await admin.from('company_settings').insert([{ company_id: companyId, setting_key: key, setting_value: value }]);
    }
  }
  console.log(`Ensured ${Object.keys(costConfigSettings).length} cost config keys.`);

  console.log('\n=== 6. Customer + 2 PO REAL (lewat API resmi, approval 3 dept, Process->SO) ===');

  // Customer PT Sastro Media
  let { data: customer } = await admin.from('customers').select('customer_id').eq('company_id', companyId).eq('name', 'PT Sastro Media').maybeSingle();
  if (!customer) {
    const { data: inserted, error } = await admin.from('customers').insert([{ company_id: companyId, name: 'PT Sastro Media', contact_info: 'PIC: Cyntia A' }]).select('customer_id').single();
    if (error) throw new Error(`Failed to create customer: ${error.message}`);
    customer = inserted;
  }
  console.log(`Ensured customer PT Sastro Media (customer_id=${customer.customer_id}).`);

  const adminToken = await login('company.a@debug.mrp', process.env.DEBUG_COMPANY_A_PASSWORD);
  const ppicToken = await login('ppic.a@debug.mrp', process.env.DEBUG_COMPANY_A_APPROVER_PASSWORD);
  const financeToken = await login('finance.a@debug.mrp', process.env.DEBUG_COMPANY_A_APPROVER_PASSWORD);

  async function ensureCpoWithSo(poNumber, poDate, shipDate, itemCode, qty, unitPrice) {
    const { data: existingPo } = await admin.from('customer_purchase_orders').select('customer_purchase_order_id, status').eq('company_id', companyId).eq('po_number', poNumber).maybeSingle();
    let cpoId;
    if (existingPo) {
      cpoId = existingPo.customer_purchase_order_id;
      console.log(`PO ${poNumber} sudah ada (status=${existingPo.status}), skip create.`);
    } else {
      const itemId = itemIdByCode.get(itemCode);
      const createRes = await apiCall(adminToken, '/api/customer-purchase-orders', 'POST', {
        customer_id: customer.customer_id,
        po_number: poNumber,
        po_date: poDate,
        requested_ship_date: shipDate,
        payment_terms: 'tempo',
        lines: [{ item_id: itemId, qty_ordered: qty, unit_price: unitPrice }]
      });
      if (!createRes.ok) throw new Error(`Gagal create PO ${poNumber}: ${JSON.stringify(createRes.body)}`);
      cpoId = createRes.body.customer_purchase_order_id;
      console.log(`Created PO ${poNumber} (id=${cpoId}).`);
    }

    const { data: approvals } = await admin.from('customer_po_approvals').select('customer_po_approval_id, department, status').eq('customer_purchase_order_id', cpoId);
    const tokenByDept = { finance: financeToken, ppic: ppicToken, manager: adminToken };
    for (const approval of approvals ?? []) {
      if (approval.status === 'pending') {
        const res = await apiCall(tokenByDept[approval.department], '/api/customer-purchase-orders/approve', 'PATCH', { customer_po_approval_id: approval.customer_po_approval_id, status: 'approved' });
        if (!res.ok) throw new Error(`Gagal approve dept ${approval.department} utk PO ${poNumber}: ${JSON.stringify(res.body)}`);
        console.log(`Approved dept ${approval.department} for PO ${poNumber}.`);
      }
    }

    const { data: poNow } = await admin.from('customer_purchase_orders').select('status').eq('customer_purchase_order_id', cpoId).single();
    if (poNow.status === 'new') {
      const processRes = await apiCall(adminToken, '/api/customer-purchase-orders/process', 'POST', { customer_purchase_order_id: cpoId, production_plant_id: plantId });
      if (!processRes.ok) throw new Error(`Gagal process PO ${poNumber}: ${JSON.stringify(processRes.body)}`);
      console.log(`Processed PO ${poNumber} -> SO ${processRes.body.so_number}.`);
    } else {
      console.log(`PO ${poNumber} sudah berstatus ${poNow.status}, skip process.`);
    }
  }

  await ensureCpoWithSo('SAS001', '2026-08-10', '2026-09-10', 'FG-GUMMY-ZALA-N200', 20000, 108000);
  await ensureCpoWithSo('SAS005', '2026-08-12', '2026-09-12', 'PMBX001ITM', 10000, 33000);

  console.log('\n=== 7. Stok ===');
  console.log('Seluruh bahan baku baru = 0 (tidak ada lot dibuat, sesuai real case).');

  let { data: supplier } = await admin.from('suppliers').select('supplier_id').eq('company_id', companyId).eq('name', 'Vendor China (Botol PET)').maybeSingle();
  if (!supplier) {
    const { data: inserted, error } = await admin.from('suppliers').insert([{ company_id: companyId, name: 'Vendor China (Botol PET)', supplier_type: 'material_supplier', lead_time_days: 10 }]).select('supplier_id').single();
    if (error) throw new Error(`Failed to create supplier: ${error.message}`);
    supplier = inserted;
  }

  const { data: existingSupplierPo } = await admin
    .from('purchase_orders')
    .select('purchase_order_id')
    .eq('company_id', companyId)
    .eq('supplier_id', supplier.supplier_id)
    .eq('expected_date', '2026-08-22')
    .maybeSingle();
  if (!existingSupplierPo) {
    const { data: insertedPo, error: poError } = await admin
      .from('purchase_orders')
      .insert([{ company_id: companyId, supplier_id: supplier.supplier_id, production_plant_id: plantId, status: 'ordered', order_date: '2026-08-17', expected_date: '2026-08-22' }])
      .select('purchase_order_id')
      .single();
    if (poError) throw new Error(`Failed to create supplier PO: ${poError.message}`);
    const { error: lineError } = await admin
      .from('purchase_order_lines')
      .insert([{ purchase_order_id: insertedPo.purchase_order_id, item_id: itemIdByCode.get('PKG-BOTOL-PET-N200'), qty_ordered: 30500, qty_received: 0, unit_price: 5500 }]);
    if (lineError) throw new Error(`Failed to create supplier PO line: ${lineError.message}`);
    console.log('Created supplier PO: Vendor China, 30.500 Botol PET N200, ETA 22 Agu 2026, status ordered (belum diterima).');
  } else {
    console.log('Supplier PO Botol PET N200 (ETA 22 Agu) sudah ada, skip.');
  }

  console.log('\n=== SELESAI ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

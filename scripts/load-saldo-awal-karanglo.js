// Muat Saldo Awal Stok Gudang KL BIZ / Plant Karanglo (perintah gabungan B, 19 Agu 2026).
// Sumber: docs/saldo-awal-gudang-karanglo-180826.md (stok opname pabrik, versi FINAL —
// PREMIX POWDER=Sorbitol Powder/MAP, Bromalin/Papain/Derasi Peach=SKIP, ALAT=exclude).
//
// SENGAJA lewat API RESMI /api/stock-adjustments/opening-balance (mekanisme Saldo Awal
// GELOMBANG 0B, diperluas migration 20260819100000 utk terima unit_cost) — BUKAN insert
// SQL langsung — supaya tiap lot benar-benar lewat jalur create_opening_balance_lot()
// yang sama dipakai user asli (movement 'adjustment' + reason_code otomatis).
//
// IDEMPOTENT: lot_number FIXED per item (bukan timestamp), dicek dulu sebelum create.
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const BASE_URL = process.env.SEED_BASE_URL || 'http://localhost:3000';

// ============================================================================
// Item BARU (BARU-BAHAN/BARU-WIP/BARU-KEMASAN) — dibuat kalau belum ada.
// "Derasi Strawberry" SENGAJA TIDAK di sini — item itu SUDAH ADA (RM-DERASI-STRAWBERRY,
// dari demo lama), dipakai ulang (bukan duplikat), harganya dikoreksi ke data opname ini.
// ============================================================================
const newItems = [
  { item_code: 'RM-ALCO-MERAH', name: 'Alco Merah', type: 'raw_material', base_uom: 'g' },
  { item_code: 'RM-DEXTROSE', name: 'Dextrose', type: 'raw_material', base_uom: 'g' },
  { item_code: 'RM-GRAPE-SEED-EXTRACT', name: 'Grape Seed Extract', type: 'raw_material', base_uom: 'g' },
  { item_code: 'RM-GULA-CASTOR', name: 'Gula Castor', type: 'raw_material', base_uom: 'g' },
  { item_code: 'RM-HYALURONIC-ACID', name: 'Hyaluronic Acid', type: 'raw_material', base_uom: 'g' },
  { item_code: 'RM-MAGNESIUM-SULFATE', name: 'Magnesium Sulfate', type: 'raw_material', base_uom: 'g' },
  { item_code: 'RM-SODIUM-ASCORBATE', name: 'Sodium Ascorbate', type: 'raw_material', base_uom: 'g' },
  { item_code: 'WIP-RAW-FIXLIM-1', name: 'RAW Fixlim 1', type: 'wip', base_uom: 'g' },
  { item_code: 'WIP-RAW-QS-COLLAGEN-1', name: 'RAW QS Collagen 1', type: 'wip', base_uom: 'g' },
  { item_code: 'PKG-BOX-ETAWA-FIT', name: 'Box Etawa Fit', type: 'packaging', base_uom: 'pcs' },
  { item_code: 'PKG-BOX-FIXNUTRI-FIXLIM', name: 'Box Fixnutri Fixlim', type: 'packaging', base_uom: 'pcs' },
  { item_code: 'PKG-BOX-QUEENSI-COLLAGEN', name: 'Box Queensi Collagen', type: 'packaging', base_uom: 'pcs' },
  { item_code: 'PKG-BOX-QUEENSI-LEMON-SAMPLE-BG', name: 'Box Queensi Lemon Sample BG', type: 'packaging', base_uom: 'pcs' },
  { item_code: 'PKG-KARDUS-ITM-CUSTOM', name: 'Kardus ITM Custom', type: 'packaging', base_uom: 'pcs' },
  { item_code: 'PKG-SACHET-ROLL-ETAWA-FIT', name: 'Sachet Roll Etawa Fit', type: 'packaging', base_uom: 'roll' },
  { item_code: 'PKG-SACHET-ROLL-FIXNUTRI', name: 'Sachet Roll Fixnutri', type: 'packaging', base_uom: 'roll' },
  { item_code: 'PKG-SILICA-GEL-2G', name: 'Silica Gel 2g', type: 'packaging', base_uom: 'pcs' },
  { item_code: 'PKG-STIKER-SAMPLE-01', name: 'Stiker Sample 01', type: 'packaging', base_uom: 'pcs' }
];

// ============================================================================
// Daftar Muat — { itemCode, qty, unitCost, sourceLabel }. Urutan & angka PERSIS
// docs/saldo-awal-gudang-karanglo-180826.md §1 (baris MAP + BARU, SKIP/ALAT dikecualikan).
// ============================================================================
const lotsToLoad = [
  // --- MAP (16 baris, item sudah ada dari GELOMBANG 1) ---
  { itemCode: 'RM-ASCORBIC-ACID', qty: 8243.5, unitCost: 93.0, sourceLabel: 'ASCORBIC ACID' },
  { itemCode: 'RM-CITRICACID', qty: 15993.5, unitCost: 34.4404, sourceLabel: 'CITRIC ACID' },
  { itemCode: 'RM-COLLAGEN', qty: 2920.0, unitCost: 188.6331, sourceLabel: 'COLLAGEN' },
  { itemCode: 'RM-DERASI-ORANGE', qty: 1065.0, unitCost: 1058.208, sourceLabel: 'DERASI ORANGE JUICE WSP' },
  { itemCode: 'RM-GARAM', qty: 350.0, unitCost: 13.0, sourceLabel: 'GARAM' },
  { itemCode: 'RM-GLUTATHIONE', qty: 1196.0, unitCost: 1950.0, sourceLabel: 'GLUTHATIONE' },
  { itemCode: 'RM-INULIN', qty: 28800.0, unitCost: 80.0, sourceLabel: 'INULIN' },
  { itemCode: 'RM-MALICACID', qty: 9591.0, unitCost: 118.6983, sourceLabel: 'MALIC ACID' },
  { itemCode: 'RM-MALTODEXTRIN', qty: 139630.68, unitCost: 16.6883, sourceLabel: 'MALTODEXTRINE' },
  { itemCode: 'RM-POLYDEXTROSE', qty: 47600.0, unitCost: 50.0, sourceLabel: 'POLYDEXTROSE' },
  { itemCode: 'RM-PSYLIUM-HUSK', qty: 31076.0, unitCost: 156.0061, sourceLabel: 'PSYLIUM HUSK' },
  { itemCode: 'RM-SEREH-POWDER', qty: 725.0, unitCost: 451.1, sourceLabel: 'SEREH POWDER' },
  { itemCode: 'RM-STEVIA-POWDER', qty: 5199.96, unitCost: 871.0694, sourceLabel: 'STEVIA POWDER' },
  { itemCode: 'RM-SUCRALOSE', qty: 14089.96, unitCost: 400.0, sourceLabel: 'SUCRALOSE' },
  { itemCode: 'RM-ZOEFREE', qty: 9079.0, unitCost: 43.0, sourceLabel: 'ZEOFREE' },
  { itemCode: 'RM-SORBITOL-POWDER', qty: 2291440.0, unitCost: 58.0, sourceLabel: 'PREMIX POWDER (alias gudang utk Sorbitol Powder)' },
  // --- BARU-BAHAN (8 baris; Derasi Strawberry reuse item lama) ---
  { itemCode: 'RM-ALCO-MERAH', qty: 1522.1, unitCost: 84.214, sourceLabel: 'ALCO MERAH' },
  { itemCode: 'RM-DERASI-STRAWBERRY', qty: 1746.3, unitCost: 1501.23, sourceLabel: 'DERASI STRAWBERRY' },
  { itemCode: 'RM-DEXTROSE', qty: 17250.0, unitCost: 17.5, sourceLabel: 'DEXTROSE' },
  { itemCode: 'RM-GRAPE-SEED-EXTRACT', qty: 1278.4, unitCost: 600.0, sourceLabel: 'GRAPE SEED EXT' },
  { itemCode: 'RM-GULA-CASTOR', qty: 7500.0, unitCost: 19.5, sourceLabel: 'GULA CASTOR' },
  { itemCode: 'RM-HYALURONIC-ACID', qty: 639.2, unitCost: 2500.0, sourceLabel: 'HYALURONIC ACID' },
  { itemCode: 'RM-MAGNESIUM-SULFATE', qty: 4640.0, unitCost: 16.5812, sourceLabel: 'MAGNESIUM SULFATE' },
  { itemCode: 'RM-SODIUM-ASCORBATE', qty: 6100.0, unitCost: 82.0, sourceLabel: 'SODIUM ASCORBATE' },
  // --- BARU-WIP (2 baris) ---
  { itemCode: 'WIP-RAW-FIXLIM-1', qty: 120000.0, unitCost: 42.3727, sourceLabel: 'RAW FIXLIM 1' },
  { itemCode: 'WIP-RAW-QS-COLLAGEN-1', qty: 40000.0, unitCost: 67.4423, sourceLabel: 'RAW QS COLLAGEN 1' },
  // --- BARU-KEMASAN (9 baris) ---
  { itemCode: 'PKG-BOX-ETAWA-FIT', qty: 3500.0, unitCost: 2500.0, sourceLabel: 'BOX ETAWA FIT' },
  { itemCode: 'PKG-BOX-FIXNUTRI-FIXLIM', qty: 1392.0, unitCost: 2750.0, sourceLabel: 'BOX FIXNUTRI FIXLIM' },
  { itemCode: 'PKG-BOX-QUEENSI-COLLAGEN', qty: 1200.0, unitCost: 2612.8788, sourceLabel: 'BOX QUEENSI COLLAGEN' },
  { itemCode: 'PKG-BOX-QUEENSI-LEMON-SAMPLE-BG', qty: 50.0, unitCost: 2700.0, sourceLabel: 'BOX QUEENSI LEMON SAMPLE BG' },
  { itemCode: 'PKG-KARDUS-ITM-CUSTOM', qty: 489.0, unitCost: 11300.0, sourceLabel: 'KARDUS ITM CUSTOM' },
  { itemCode: 'PKG-SACHET-ROLL-ETAWA-FIT', qty: 14.0, unitCost: 1566000.0, sourceLabel: 'SACHET ROLL ETAWA FIT' },
  { itemCode: 'PKG-SACHET-ROLL-FIXNUTRI', qty: 9.0, unitCost: 1566000.0, sourceLabel: 'SACHET ROLL FIXNUTRI' },
  { itemCode: 'PKG-SILICA-GEL-2G', qty: 1403.0, unitCost: 92.2646, sourceLabel: 'SILICA GEL 2 GRM' },
  { itemCode: 'PKG-STIKER-SAMPLE-01', qty: 1297.0, unitCost: 95.0, sourceLabel: 'STIKER SAMPLE 01' }
  // SKIP (stok sebenarnya HABIS, TIDAK dimuat): Bromalin, Papain, Derasi Peach.
  // ALAT (EXCLUDE, bukan bahan BOM): Cartridge JS12 Black, Corong 3 Side 80mm,
  // Pita LC1 Coding, Plastik Roll Shrink.
];

async function login(email, password) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login gagal: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function main() {
  const { data: company } = await admin.from('users').select('company_id').eq('email', 'company.a@debug.mrp').maybeSingle();
  const companyId = company.company_id;

  const { data: plant } = await admin.from('production_plants').select('production_plant_id').eq('company_id', companyId).eq('name', 'Karanglo').maybeSingle();
  if (!plant) throw new Error('Plant Karanglo belum ada — jalankan pembuatan plant nyata dulu.');
  const plantId = plant.production_plant_id;
  console.log(`Plant Karanglo: id=${plantId}`);

  console.log('\n=== 1. Item baru (BARU-BAHAN/BARU-WIP/BARU-KEMASAN) ===');
  for (const item of newItems) {
    const { data: existing } = await admin.from('items').select('item_id').eq('company_id', companyId).eq('item_code', item.item_code).maybeSingle();
    if (existing) {
      console.log(`Item ${item.item_code} sudah ada, skip create.`);
      continue;
    }
    const { error } = await admin
      .from('items')
      .insert([{ company_id: companyId, item_code: item.item_code, name: item.name, type: item.type, base_uom: item.base_uom, purchase_uom: item.base_uom, uom_conversion_factor: 1, is_active: true }]);
    if (error) throw new Error(`Failed to create item ${item.item_code}: ${error.message}`);
    console.log(`Created item ${item.item_code} - ${item.name} (${item.type}, ${item.base_uom}).`);
  }

  // Reuse "Derasi Strawberry" (item lama demo) — koreksi standard_cost ke data opname ini,
  // dan catat alias "PREMIX POWDER" di nama item Sorbitol Powder (supaya stok opname
  // berikutnya otomatis cocok, sesuai instruksi).
  const { data: derasiStrawberry } = await admin.from('items').select('item_id, standard_cost').eq('company_id', companyId).eq('item_code', 'RM-DERASI-STRAWBERRY').maybeSingle();
  if (derasiStrawberry) {
    await admin.from('items').update({ standard_cost: 1501.23 }).eq('item_id', derasiStrawberry.item_id);
    console.log('Item RM-DERASI-STRAWBERRY (reuse dari demo lama) dikoreksi standard_cost -> 1501,23/g (data opname riil).');
  }
  const { data: sorbitolPowder } = await admin.from('items').select('item_id, name').eq('company_id', companyId).eq('item_code', 'RM-SORBITOL-POWDER').maybeSingle();
  if (sorbitolPowder && !sorbitolPowder.name.includes('Premix Powder')) {
    await admin.from('items').update({ name: `${sorbitolPowder.name} (alias gudang: Premix Powder)` }).eq('item_id', sorbitolPowder.item_id);
    console.log('Item RM-SORBITOL-POWDER diberi catatan alias "Premix Powder" di nama item.');
  }

  const { data: allItems } = await admin.from('items').select('item_id, item_code').eq('company_id', companyId);
  const itemIdByCode = new Map(allItems.map((i) => [i.item_code, i.item_id]));

  const token = await login('company.a@debug.mrp', process.env.DEBUG_COMPANY_A_PASSWORD);

  console.log('\n=== 2. Lot Saldo Awal (lewat API resmi /api/stock-adjustments/opening-balance) ===');
  let totalValue = 0;
  let loadedCount = 0;
  for (const row of lotsToLoad) {
    const itemId = itemIdByCode.get(row.itemCode);
    if (!itemId) throw new Error(`Item ${row.itemCode} tidak ditemukan (harusnya sudah dibuat/sudah ada).`);
    const lotNumber = `SALDO-AWAL-KARANGLO-${row.itemCode}`;

    const { data: existingLot } = await admin.from('lots').select('lot_id, quantity_on_hand, unit_cost').eq('company_id', companyId).eq('lot_number', lotNumber).maybeSingle();
    if (existingLot) {
      console.log(`Lot ${lotNumber} sudah ada (qty=${existingLot.quantity_on_hand}, unit_cost=${existingLot.unit_cost}), skip (idempotent).`);
      totalValue += Number(existingLot.quantity_on_hand) * Number(existingLot.unit_cost ?? 0);
      loadedCount += 1;
      continue;
    }

    const res = await fetch(`${BASE_URL}/api/stock-adjustments/opening-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        item_id: itemId,
        production_plant_id: plantId,
        qty: row.qty,
        unit_cost: row.unitCost,
        lot_number: lotNumber,
        notes: `Saldo awal stok opname 18 Agu 2026 — sumber PDF: ${row.sourceLabel}`
      })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Gagal muat lot ${row.itemCode} (${row.sourceLabel}): ${JSON.stringify(body)}`);
    console.log(`Loaded ${row.itemCode} (${row.sourceLabel}): qty=${row.qty} @ unit_cost=${row.unitCost} -> lot_id=${body.lot_id}, movement_id=${body.stock_movement_id}`);
    totalValue += row.qty * row.unitCost;
    loadedCount += 1;
  }

  console.log(`\n=== SELESAI: ${loadedCount} lot dimuat/terverifikasi. Total nilai = Rp${totalValue.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

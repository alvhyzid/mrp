const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

// Data uji minuman serbuk — kode item PMSW001ITM/PMFLV001ITM/PMAC001ITM/PMPW0001ITM
// diberikan eksplisit oleh user, sisanya (Sachet/Box/kemasan) mengikuti pola
// penamaan yang sama ("PM" + hint + urutan + "ITM"). Formula & angka gram sengaja
// dibuat masuk akal (data UJI, bukan resep asli perusahaan) — silakan sesuaikan
// lewat halaman /boms kalau sudah ada angka riil.
//
// Mengikuti pola yang sama seperti Gummy (adonan curah -> botol jadi): di sini
// premix+sorbitol+film -> Sachet (WIP, level "curah" yang analog Base Gelatin),
// lalu 14x Sachet + karton -> Box isi 14 Sachet (finished_good).
const newItems = [
  { item_code: 'PMSW001ITM', name: 'Premix Sweetener', type: 'wip', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 },
  { item_code: 'PMFLV001ITM', name: 'Premix Flavor', type: 'wip', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 },
  { item_code: 'PMAC001ITM', name: 'Premix Acid', type: 'wip', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 },
  { item_code: 'PMPW0001ITM', name: 'Sorbitol Powder', type: 'raw_material', base_uom: 'g', purchase_uom: 'kg', uom_conversion_factor: 1000 },
  { item_code: 'PMPKF001ITM', name: 'Sachet Film', type: 'packaging', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
  { item_code: 'PMSC001ITM', name: 'Sachet Minuman Serbuk', type: 'wip', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
  { item_code: 'PMPKB001ITM', name: 'Box Karton Isi 14 Sachet', type: 'packaging', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
  { item_code: 'PMBX001ITM', name: 'Box Minuman Serbuk Isi 14 Sachet', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }
];

// BOM level 1: raw materials + premix + film -> 1 Sachet (WIP). Total 20g/sachet,
// buffer_percentage 5% (contoh kompensasi kehilangan mixing/filling).
const SACHET_YIELD_PCS = 1;
const sachetLines = [
  { component_item_code: 'PMPW0001ITM', qtyPerBatch: 15, uom: 'g' },
  { component_item_code: 'PMSW001ITM', qtyPerBatch: 2, uom: 'g' },
  { component_item_code: 'PMFLV001ITM', qtyPerBatch: 2, uom: 'g' },
  { component_item_code: 'PMAC001ITM', qtyPerBatch: 1, uom: 'g' },
  { component_item_code: 'PMPKF001ITM', qtyPerBatch: 1, uom: 'pcs' }
];
const SACHET_BUFFER_PERCENTAGE = 5;

// BOM level 2: 14x Sachet + karton -> 1 Box (finished_good). buffer_percentage lebih
// rendah (2%) karena cuma tahap packing akhir, bukan proses basah/mixing.
const BOX_YIELD_PCS = 1;
const boxLines = [
  { component_item_code: 'PMSC001ITM', qtyPerBatch: 14, uom: 'pcs' },
  { component_item_code: 'PMPKB001ITM', qtyPerBatch: 1, uom: 'pcs' }
];
const BOX_BUFFER_PERCENTAGE = 2;

async function upsertBom(companyId, itemIdByCode, parentItemCode, yieldQty, yieldUom, bufferPercentage, lines) {
  const parentItemId = itemIdByCode.get(parentItemCode);
  if (!parentItemId) throw new Error(`${parentItemCode} not found after upsert.`);

  const { data: existingBom } = await admin.from('boms').select('bom_id').eq('company_id', companyId).eq('parent_item_id', parentItemId).eq('version', 1).maybeSingle();

  let bomId = existingBom?.bom_id;

  if (bomId) {
    const { error: updateError } = await admin
      .from('boms')
      .update({ standard_yield_qty: yieldQty, standard_yield_uom: yieldUom, status: 'active', buffer_percentage: bufferPercentage })
      .eq('bom_id', bomId);
    if (updateError) throw new Error(`Failed to update BOM for ${parentItemCode}: ${updateError.message}`);
    await admin.from('bom_lines').delete().eq('bom_id', bomId);
  } else {
    const { data: insertedBom, error: insertError } = await admin
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: parentItemId, version: 1, standard_yield_qty: yieldQty, standard_yield_uom: yieldUom, status: 'active', buffer_percentage: bufferPercentage }])
      .select('bom_id')
      .single();
    if (insertError) throw new Error(`Failed to insert BOM for ${parentItemCode}: ${insertError.message}`);
    bomId = insertedBom.bom_id;
  }

  const lineRows = lines.map((line) => {
    const componentItemId = itemIdByCode.get(line.component_item_code);
    if (!componentItemId) throw new Error(`Component item ${line.component_item_code} not found.`);
    return { bom_id: bomId, component_item_id: componentItemId, qty_per_unit_output: line.qtyPerBatch / yieldQty, uom: line.uom };
  });

  const { error: linesError } = await admin.from('bom_lines').insert(lineRows);
  if (linesError) throw new Error(`Failed to insert bom_lines for ${parentItemCode}: ${linesError.message}`);

  console.log(`Ensured BOM for ${parentItemCode} (v1, yield ${yieldQty}${yieldUom}, buffer ${bufferPercentage}%, ${lineRows.length} komponen).`);
  return bomId;
}

const stockLots = [
  { item_code: 'PMPW0001ITM', qty: 50000, unit_cost: null },
  { item_code: 'PMSW001ITM', qty: 5000, unit_cost: null },
  { item_code: 'PMFLV001ITM', qty: 5000, unit_cost: null },
  { item_code: 'PMAC001ITM', qty: 3000, unit_cost: null },
  { item_code: 'PMPKF001ITM', qty: 2000, unit_cost: null },
  { item_code: 'PMPKB001ITM', qty: 200, unit_cost: null }
];

async function main() {
  const { data: debugUser, error: debugUserError } = await admin.from('users').select('company_id').eq('email', 'company.a@debug.mrp').maybeSingle();
  if (debugUserError) throw new Error(`Failed to find Company A debug user: ${debugUserError.message}`);
  if (!debugUser) throw new Error('Company A debug user (company.a@debug.mrp) not found. Run npm run seed:test-tenants first.');
  const companyId = debugUser.company_id;

  for (const item of newItems) {
    const { error } = await admin.from('items').upsert([{ ...item, company_id: companyId, is_active: true }], { onConflict: 'company_id,item_code' });
    if (error) throw new Error(`Failed to upsert item ${item.item_code}: ${error.message}`);
    console.log(`Ensured item ${item.item_code} - ${item.name}`);
  }

  const { data: items, error: itemsError } = await admin.from('items').select('item_id,item_code').eq('company_id', companyId);
  if (itemsError) throw new Error(`Failed to load items: ${itemsError.message}`);
  const itemIdByCode = new Map(items.map((item) => [item.item_code, item.item_id]));

  await upsertBom(companyId, itemIdByCode, 'PMSC001ITM', SACHET_YIELD_PCS, 'pcs', SACHET_BUFFER_PERCENTAGE, sachetLines);
  await upsertBom(companyId, itemIdByCode, 'PMBX001ITM', BOX_YIELD_PCS, 'pcs', BOX_BUFFER_PERCENTAGE, boxLines);

  const { data: plant, error: plantError } = await admin.from('production_plants').select('production_plant_id').eq('company_id', companyId).limit(1).maybeSingle();
  if (plantError) throw new Error(`Failed to find production plant: ${plantError.message}`);
  if (!plant) throw new Error('No production_plants found for Company A.');
  const plantId = plant.production_plant_id;

  for (const lot of stockLots) {
    const itemId = itemIdByCode.get(lot.item_code);
    if (!itemId) throw new Error(`Item ${lot.item_code} not found.`);
    const lotNumber = `SEED-${lot.item_code}-001`;
    const { data: existing } = await admin.from('lots').select('lot_id').eq('company_id', companyId).eq('lot_number', lotNumber).maybeSingle();
    if (existing) {
      const { error: updateError } = await admin.from('lots').update({ quantity_on_hand: lot.qty, unit_cost: lot.unit_cost }).eq('lot_id', existing.lot_id);
      if (updateError) throw new Error(`Failed to update lot for ${lot.item_code}: ${updateError.message}`);
    } else {
      const { error: insertError } = await admin.from('lots').insert([
        { company_id: companyId, production_plant_id: plantId, item_id: itemId, lot_number: lotNumber, quantity_on_hand: lot.qty, source_type: 'purchased', status: 'available', unit_cost: lot.unit_cost }
      ]);
      if (insertError) throw new Error(`Failed to insert lot for ${lot.item_code}: ${insertError.message}`);
    }
    console.log(`Ensured lot ${lotNumber}: ${lot.qty} tersedia`);
  }

  console.log('\nSelesai. Rantai: Sorbitol Powder + 3 Premix + Sachet Film -> Sachet (WIP) -> 14x Sachet + Box Karton -> Box Minuman Serbuk Isi 14 Sachet (finished_good).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

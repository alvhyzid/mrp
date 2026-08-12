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

// Catatan: ingredient Sorbitol Liquid, Gliserin, Malic Acid, Citric Acid, Air, Derasi
// Strawberry, dan Delivru Syrup Strawberry TIDAK ada di daftar "item baru" yang
// diminta eksplisit, tapi dipakai di formula -> dibuat juga di sini supaya BOM bisa
// dibangun (setiap baris BOM wajib merujuk item yang benar-benar ada). standard_cost
// sengaja dikosongkan (null) untuk semua item baru karena belum ada data harga nyata
// dari Anda — silakan isi lewat halaman /items kalau sudah ada datanya.
const newItems = [
  // Bahan mentah yang diminta eksplisit
  { item_code: 'RM-MALTODEXTRIN', name: 'Maltodextrin', type: 'raw_material', base_uom: 'g', purchase_uom: 'kg', uom_conversion_factor: 1000 },
  { item_code: 'RM-XANTAMGUM', name: 'Xantam Gum', type: 'raw_material', base_uom: 'g', purchase_uom: 'kg', uom_conversion_factor: 1000 },
  { item_code: 'RM-GLUTATHIONE', name: 'Glutathione', type: 'raw_material', base_uom: 'g', purchase_uom: 'kg', uom_conversion_factor: 1000 },
  // Bahan mentah tambahan (dibutuhkan formula, tidak eksplisit diminta - lihat catatan di atas)
  { item_code: 'RM-SORBITOL-LIQUID', name: 'Sorbitol Liquid', type: 'raw_material', base_uom: 'ml', purchase_uom: 'liter', uom_conversion_factor: 1000 },
  { item_code: 'RM-GLISERIN', name: 'Gliserin', type: 'raw_material', base_uom: 'ml', purchase_uom: 'liter', uom_conversion_factor: 1000 },
  { item_code: 'RM-MALICACID', name: 'Malic Acid', type: 'raw_material', base_uom: 'g', purchase_uom: 'kg', uom_conversion_factor: 1000 },
  { item_code: 'RM-CITRICACID', name: 'Citric Acid', type: 'raw_material', base_uom: 'g', purchase_uom: 'kg', uom_conversion_factor: 1000 },
  { item_code: 'RM-AIR', name: 'Air', type: 'raw_material', base_uom: 'ml', purchase_uom: 'liter', uom_conversion_factor: 1000 },
  { item_code: 'RM-DERASI-STRAWBERRY', name: 'Derasi Strawberry', type: 'raw_material', base_uom: 'g', purchase_uom: 'kg', uom_conversion_factor: 1000 },
  { item_code: 'RM-DELIVRU-SYR-STRAW', name: 'Delivru Syrup Strawberry', type: 'raw_material', base_uom: 'ml', purchase_uom: 'liter', uom_conversion_factor: 1000 },
  // Kemasan
  { item_code: 'PKG-BOTOL-PET-N800', name: 'Botol PET N800', type: 'packaging', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
  { item_code: 'PKG-BOTOL-PET-N400', name: 'Botol PET N400', type: 'packaging', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
  { item_code: 'PKG-INNER-SLEEVE', name: 'Inner Sleeve', type: 'packaging', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
  { item_code: 'PKG-OUTER-BOX', name: 'Outer Box', type: 'packaging', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
  { item_code: 'PKG-SILICA-GEL', name: 'Silica Gel', type: 'packaging', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
  { item_code: 'PKG-SEAL-STICKER', name: 'Seal Sticker', type: 'packaging', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
  // Produk jadi — base_uom 'g' (bukan 'pcs') karena BOM ini menghasilkan MASSA gummy
  // curah (200g), bukan botol jadi — pengemasan ke botol dihitung terpisah saat
  // packing berdasar output aktual (lihat catatan keputusan di bawah).
  { item_code: 'FG-ZALA-BEAUTY-N800', name: 'Zala Beauty Boosted Gummy - Isi 60 (N800)', type: 'finished_good', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 }
];

// Formula per 200g output. component_item_code null berarti "tidak dipakai" (skip).
const FORMULA_YIELD_G = 200;
const formulaLines = [
  { component_item_code: 'RM-MALTITOL', qtyPerBatch: 70, uom: 'g' },
  { component_item_code: 'RM-MALTODEXTRIN', qtyPerBatch: 15, uom: 'g' },
  { component_item_code: 'RM-SORBITOL-LIQUID', qtyPerBatch: 50, uom: 'ml' },
  { component_item_code: 'RM-GLISERIN', qtyPerBatch: 20, uom: 'ml' },
  { component_item_code: 'RM-XANTAMGUM', qtyPerBatch: 0.25, uom: 'g' },
  { component_item_code: 'WIP-BASEGEL', qtyPerBatch: 24, uom: 'g' }, // "Gelatin (dari Base Gelatin)"
  { component_item_code: 'RM-MALICACID', qtyPerBatch: 0.25, uom: 'g' },
  { component_item_code: 'RM-CITRICACID', qtyPerBatch: 1.25, uom: 'g' },
  { component_item_code: 'RM-AIR', qtyPerBatch: 50, uom: 'ml' },
  { component_item_code: 'RM-DERASI-STRAWBERRY', qtyPerBatch: 0.5, uom: 'g' },
  { component_item_code: 'RM-DELIVRU-SYR-STRAW', qtyPerBatch: 15, uom: 'ml' },
  { component_item_code: 'RM-COLLAGEN', qtyPerBatch: 4, uom: 'g' },
  { component_item_code: 'RM-GLUTATHIONE', qtyPerBatch: 0.2, uom: 'g' }
  // Polysorb, Polydextrose, Perfecta 928, Perfecta MB, Gellan Gum: TIDAK dipakai (skip).
];

async function main() {
  const { data: debugUser, error: debugUserError } = await admin
    .from('users')
    .select('company_id')
    .eq('email', 'company.a@debug.mrp')
    .maybeSingle();
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

  const parentItemId = itemIdByCode.get('FG-ZALA-BEAUTY-N800');
  if (!parentItemId) throw new Error('FG-ZALA-BEAUTY-N800 not found after upsert.');

  const { data: existingBom } = await admin
    .from('boms')
    .select('bom_id')
    .eq('company_id', companyId)
    .eq('parent_item_id', parentItemId)
    .eq('version', 1)
    .maybeSingle();

  let bomId = existingBom?.bom_id;

  if (bomId) {
    const { error: updateError } = await admin
      .from('boms')
      .update({ standard_yield_qty: FORMULA_YIELD_G, standard_yield_uom: 'g', status: 'active' })
      .eq('bom_id', bomId);
    if (updateError) throw new Error(`Failed to update BOM: ${updateError.message}`);
    await admin.from('bom_lines').delete().eq('bom_id', bomId);
  } else {
    const { data: insertedBom, error: insertError } = await admin
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: parentItemId, version: 1, standard_yield_qty: FORMULA_YIELD_G, standard_yield_uom: 'g', status: 'active' }])
      .select('bom_id')
      .single();
    if (insertError) throw new Error(`Failed to insert BOM: ${insertError.message}`);
    bomId = insertedBom.bom_id;
  }

  const lineRows = formulaLines.map((line) => {
    const componentItemId = itemIdByCode.get(line.component_item_code);
    if (!componentItemId) {
      throw new Error(`Component item ${line.component_item_code} not found.`);
    }
    return {
      bom_id: bomId,
      component_item_id: componentItemId,
      qty_per_unit_output: line.qtyPerBatch / FORMULA_YIELD_G,
      uom: line.uom
    };
  });

  const { error: linesError } = await admin.from('bom_lines').insert(lineRows);
  if (linesError) throw new Error(`Failed to insert bom_lines: ${linesError.message}`);

  console.log(`\nEnsured BOM for FG-ZALA-BEAUTY-N800 (v1, yield ${FORMULA_YIELD_G}g, ${lineRows.length} komponen, kemasan TIDAK termasuk).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

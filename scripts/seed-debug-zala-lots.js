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

// Karena modul PO Supplier + Goods Receipt belum dibangun, stok bahan mentah di sini
// di-seed manual langsung sebagai lot 'purchased' yang sudah tersedia — cukup untuk
// 1-2 kali uji produksi Zala Beauty Boosted Gummy (planned_qty sekitar 2000g / batch).
// unit_cost HANYA diisi untuk item yang sudah punya standard_cost asli (RM-MALTITOL,
// RM-COLLAGEN) — untuk WIP-BASEGEL dihitung dari BOM-nya sendiri (400g Maltitol +
// 250g Gelatin per 1000g, pakai standard_cost RM-MALTITOL & RM-GELATIN yang sudah
// ada), BUKAN angka rekaan. Sisanya dibiarkan null (belum ada data harga nyata).
const lots = [
  { item_code: 'RM-MALTITOL', qty: 2000, unit_cost: 45 },
  { item_code: 'RM-MALTODEXTRIN', qty: 500, unit_cost: null },
  { item_code: 'RM-SORBITOL-LIQUID', qty: 1500, unit_cost: null },
  { item_code: 'RM-GLISERIN', qty: 600, unit_cost: null },
  { item_code: 'RM-XANTAMGUM', qty: 10, unit_cost: null },
  { item_code: 'WIP-BASEGEL', qty: 1000, unit_cost: (400 * 45 + 250 * 120) / 1000 }, // dihitung dari BOM-nya sendiri
  { item_code: 'RM-MALICACID', qty: 10, unit_cost: null },
  { item_code: 'RM-CITRICACID', qty: 50, unit_cost: null },
  { item_code: 'RM-AIR', qty: 1500, unit_cost: null },
  { item_code: 'RM-DERASI-STRAWBERRY', qty: 20, unit_cost: null },
  { item_code: 'RM-DELIVRU-SYR-STRAW', qty: 500, unit_cost: null },
  { item_code: 'RM-COLLAGEN', qty: 150, unit_cost: 350 },
  { item_code: 'RM-GLUTATHIONE', qty: 10, unit_cost: null }
];

async function main() {
  const { data: debugUser, error: debugUserError } = await admin.from('users').select('company_id').eq('email', 'company.a@debug.mrp').maybeSingle();
  if (debugUserError) throw new Error(`Failed to find Company A debug user: ${debugUserError.message}`);
  if (!debugUser) throw new Error('Company A debug user (company.a@debug.mrp) not found. Run npm run seed:test-tenants first.');
  const companyId = debugUser.company_id;

  const { data: plant, error: plantError } = await admin.from('production_plants').select('production_plant_id').eq('company_id', companyId).limit(1).maybeSingle();
  if (plantError) throw new Error(`Failed to find production plant: ${plantError.message}`);
  if (!plant) throw new Error('No production_plants found for Company A. Create one first.');
  const plantId = plant.production_plant_id;

  const { data: items, error: itemsError } = await admin.from('items').select('item_id,item_code').eq('company_id', companyId);
  if (itemsError) throw new Error(`Failed to load items: ${itemsError.message}`);
  const itemIdByCode = new Map(items.map((item) => [item.item_code, item.item_id]));

  for (const lot of lots) {
    const itemId = itemIdByCode.get(lot.item_code);
    if (!itemId) throw new Error(`Item ${lot.item_code} not found. Run npm run seed:debug-items and seed-debug-zala-gummy.js first.`);

    const lotNumber = `SEED-${lot.item_code}-001`;
    const { data: existing } = await admin.from('lots').select('lot_id').eq('company_id', companyId).eq('lot_number', lotNumber).maybeSingle();

    if (existing) {
      const { error: updateError } = await admin
        .from('lots')
        .update({ quantity_on_hand: lot.qty, unit_cost: lot.unit_cost })
        .eq('lot_id', existing.lot_id);
      if (updateError) throw new Error(`Failed to update lot for ${lot.item_code}: ${updateError.message}`);
    } else {
      const { error: insertError } = await admin.from('lots').insert([
        {
          company_id: companyId,
          production_plant_id: plantId,
          item_id: itemId,
          lot_number: lotNumber,
          quantity_on_hand: lot.qty,
          source_type: 'purchased',
          status: 'available',
          unit_cost: lot.unit_cost
        }
      ]);
      if (insertError) throw new Error(`Failed to insert lot for ${lot.item_code}: ${insertError.message}`);
    }

    console.log(`Ensured lot ${lotNumber}: ${lot.qty} tersedia${lot.unit_cost !== null ? `, unit_cost ${lot.unit_cost}` : ''}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

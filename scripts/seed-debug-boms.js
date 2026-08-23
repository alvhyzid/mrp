const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });


// INF-14 (23 Agu 2026) -- pengawas tingkat project: skrip ini MENULIS data,
// jadi WAJIB gagal keras bila diarahkan ke project berisi data nyata.
require('./guard-real-project').assertNotRealProject('scripts/seed-debug-boms.js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

// Catatan: proporsi di bawah ini ILUSTRATIF (belum tentu resep asli PT Indo Taste
// yang sebenarnya) — dibuat supaya ada data uji yang masuk akal untuk modul BOM.
// Silakan sesuaikan angkanya lewat halaman /boms kalau berbeda dari resep nyata.
const boms = [
  {
    parentItemCode: 'WIP-BASEGEL',
    standard_yield_qty: 1000,
    standard_yield_uom: 'g',
    status: 'active',
    lines: [
      { componentItemCode: 'RM-MALTITOL', qtyPerBatch: 400, uom: 'g' },
      { componentItemCode: 'RM-GELATIN', qtyPerBatch: 250, uom: 'g' }
    ]
  },
  {
    parentItemCode: 'FG-GUMMY-STRAWCOL',
    standard_yield_qty: 1,
    standard_yield_uom: 'pcs',
    status: 'active',
    lines: [
      { componentItemCode: 'WIP-BASEGEL', qtyPerBatch: 15, uom: 'g' },
      { componentItemCode: 'RM-COLLAGEN', qtyPerBatch: 2, uom: 'g' },
      { componentItemCode: 'PKG-BOTOL-PET-N200', qtyPerBatch: 1, uom: 'pcs' }
    ]
  }
];

async function main() {
  // Dicari lewat email debug user, bukan nama company — nama company bisa berubah
  // (mis. sudah diganti user jadi "PT ITM"), tapi email debug user tetap tetap.
  const { data: debugUser, error: debugUserError } = await admin
    .from('users')
    .select('company_id')
    .eq('email', 'company.a@debug.mrp')
    .maybeSingle();
  if (debugUserError) throw new Error(`Failed to find Company A debug user: ${debugUserError.message}`);
  if (!debugUser) throw new Error('Company A debug user (company.a@debug.mrp) not found. Run npm run seed:test-tenants first.');

  const { data: company, error: companyError } = await admin.from('companies').select('company_id,name').eq('company_id', debugUser.company_id).single();
  if (companyError) throw new Error(`Failed to load Company A: ${companyError.message}`);

  const { data: items, error: itemsError } = await admin.from('items').select('item_id,item_code').eq('company_id', company.company_id);
  if (itemsError) throw new Error(`Failed to load items: ${itemsError.message}`);
  const itemIdByCode = new Map(items.map((item) => [item.item_code, item.item_id]));

  for (const bom of boms) {
    const parentItemId = itemIdByCode.get(bom.parentItemCode);
    if (!parentItemId) {
      throw new Error(`Item ${bom.parentItemCode} not found for Company A. Run npm run seed:debug-items first.`);
    }

    const { data: existingBom } = await admin
      .from('boms')
      .select('bom_id')
      .eq('company_id', company.company_id)
      .eq('parent_item_id', parentItemId)
      .eq('version', 1)
      .maybeSingle();

    let bomId = existingBom?.bom_id;

    if (bomId) {
      const { error: updateError } = await admin
        .from('boms')
        .update({ standard_yield_qty: bom.standard_yield_qty, standard_yield_uom: bom.standard_yield_uom, status: bom.status })
        .eq('bom_id', bomId);
      if (updateError) throw new Error(`Failed to update bom for ${bom.parentItemCode}: ${updateError.message}`);
      await admin.from('bom_lines').delete().eq('bom_id', bomId);
    } else {
      const { data: insertedBom, error: insertError } = await admin
        .from('boms')
        .insert([
          {
            company_id: company.company_id,
            parent_item_id: parentItemId,
            version: 1,
            standard_yield_qty: bom.standard_yield_qty,
            standard_yield_uom: bom.standard_yield_uom,
            status: bom.status
          }
        ])
        .select('bom_id')
        .single();
      if (insertError) throw new Error(`Failed to insert bom for ${bom.parentItemCode}: ${insertError.message}`);
      bomId = insertedBom.bom_id;
    }

    const lineRows = bom.lines.map((line) => {
      const componentItemId = itemIdByCode.get(line.componentItemCode);
      if (!componentItemId) {
        throw new Error(`Item ${line.componentItemCode} not found for Company A.`);
      }
      return {
        bom_id: bomId,
        component_item_id: componentItemId,
        qty_per_unit_output: line.qtyPerBatch / bom.standard_yield_qty,
        uom: line.uom
      };
    });

    const { error: linesError } = await admin.from('bom_lines').insert(lineRows);
    if (linesError) throw new Error(`Failed to insert bom_lines for ${bom.parentItemCode}: ${linesError.message}`);

    console.log(`Ensured BOM for ${bom.parentItemCode} (v1, ${bom.lines.length} komponen)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

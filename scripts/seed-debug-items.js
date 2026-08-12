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

const items = [
  {
    item_code: 'RM-MALTITOL',
    name: 'Maltitol Powder',
    type: 'raw_material',
    base_uom: 'g',
    purchase_uom: 'kg',
    uom_conversion_factor: 1000,
    shelf_life_days: 730,
    min_stock_level: 5000,
    reorder_point: 8000,
    reorder_qty: 25000,
    standard_cost: 45
  },
  {
    item_code: 'RM-GELATIN',
    name: 'Gelatin',
    type: 'raw_material',
    base_uom: 'g',
    purchase_uom: 'kg',
    uom_conversion_factor: 1000,
    shelf_life_days: 730,
    min_stock_level: 3000,
    reorder_point: 5000,
    reorder_qty: 15000,
    standard_cost: 120
  },
  {
    item_code: 'RM-COLLAGEN',
    name: 'Kolagen',
    type: 'raw_material',
    base_uom: 'g',
    purchase_uom: 'kg',
    uom_conversion_factor: 1000,
    shelf_life_days: 545,
    min_stock_level: 2000,
    reorder_point: 3500,
    reorder_qty: 10000,
    standard_cost: 350
  },
  {
    item_code: 'WIP-BASEGEL',
    name: 'Base Gelatin',
    type: 'wip',
    base_uom: 'g',
    purchase_uom: 'g',
    uom_conversion_factor: 1,
    shelf_life_days: 3,
    min_stock_level: 0,
    reorder_point: null,
    reorder_qty: null,
    standard_cost: null
  },
  {
    item_code: 'FG-GUMMY-STRAWCOL',
    name: 'Gummy Strawberry Collagen',
    type: 'finished_good',
    base_uom: 'pcs',
    purchase_uom: 'pcs',
    uom_conversion_factor: 1,
    shelf_life_days: 365,
    min_stock_level: 1000,
    reorder_point: null,
    reorder_qty: null,
    standard_cost: 850
  },
  {
    item_code: 'PKG-BOTOL-PET-N200',
    name: 'Botol PET N200',
    type: 'packaging',
    base_uom: 'pcs',
    purchase_uom: 'pcs',
    uom_conversion_factor: 1,
    shelf_life_days: null,
    min_stock_level: 2000,
    reorder_point: 3000,
    reorder_qty: 10000,
    standard_cost: 850
  }
];

async function main() {
  // Dicari lewat email debug user, BUKAN nama company — nama company bisa berubah
  // kapan saja kalau user mengganti nama perusahaannya lewat halaman /company
  // (mis. "Company A" -> "PT ITM"), tapi email debug user tetap tetap.
  const { data: debugUser, error: debugUserError } = await admin
    .from('users')
    .select('company_id')
    .eq('email', 'company.a@debug.mrp')
    .maybeSingle();

  if (debugUserError) {
    throw new Error(`Failed to find Company A debug user: ${debugUserError.message}`);
  }

  if (!debugUser) {
    throw new Error('Company A debug user (company.a@debug.mrp) not found. Run npm run seed:test-tenants first.');
  }

  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('company_id,name')
    .eq('company_id', debugUser.company_id)
    .single();

  if (companyError) {
    throw new Error(`Failed to load Company A: ${companyError.message}`);
  }

  for (const item of items) {
    const { error } = await admin
      .from('items')
      .upsert([{ ...item, company_id: company.company_id, is_active: true }], { onConflict: 'company_id,item_code' });

    if (error) {
      throw new Error(`Failed to upsert item ${item.item_code}: ${error.message}`);
    }

    console.log(`Ensured item ${item.item_code} - ${item.name} for ${company.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

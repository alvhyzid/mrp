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

const steps = [
  { sequence_no: 1, step_name: 'Mixing Adonan', active_duration_minutes: 45, wait_duration_minutes: 0 },
  { sequence_no: 2, step_name: 'Cetak & Curing', active_duration_minutes: 30, wait_duration_minutes: 2880 }, // curing 48 jam
  { sequence_no: 3, step_name: 'Quality Check', active_duration_minutes: 20, wait_duration_minutes: 0 }
];

async function main() {
  const { data: debugUser, error: debugUserError } = await admin.from('users').select('company_id').eq('email', 'company.a@debug.mrp').maybeSingle();
  if (debugUserError) throw new Error(`Failed to find Company A debug user: ${debugUserError.message}`);
  if (!debugUser) throw new Error('Company A debug user (company.a@debug.mrp) not found. Run npm run seed:test-tenants first.');
  const companyId = debugUser.company_id;

  const { data: plant } = await admin.from('production_plants').select('production_plant_id').eq('company_id', companyId).limit(1).maybeSingle();
  const plantId = plant?.production_plant_id ?? null;

  let workCenterId = null;
  if (plantId) {
    const { data: existingWc } = await admin.from('work_centers').select('work_center_id').eq('company_id', companyId).eq('name', 'Line Produksi 1').maybeSingle();
    if (existingWc) {
      workCenterId = existingWc.work_center_id;
    } else {
      const { data: insertedWc, error: wcError } = await admin
        .from('work_centers')
        .insert([{ company_id: companyId, production_plant_id: plantId, name: 'Line Produksi 1', code: 'WC-01', is_active: true }])
        .select('work_center_id')
        .single();
      if (wcError) throw new Error(`Failed to create work center: ${wcError.message}`);
      workCenterId = insertedWc.work_center_id;
    }
    console.log(`Ensured work_center Line Produksi 1 (id=${workCenterId})`);
  }

  const { data: item, error: itemError } = await admin.from('items').select('item_id').eq('company_id', companyId).eq('item_code', 'FG-ZALA-BEAUTY-N800').maybeSingle();
  if (itemError) throw new Error(`Failed to find item: ${itemError.message}`);
  if (!item) throw new Error('FG-ZALA-BEAUTY-N800 not found. Run npm run seed:debug-boms style script for Zala Gummy first.');

  const { data: existingRouting } = await admin.from('routings').select('routing_id').eq('company_id', companyId).eq('item_id', item.item_id).eq('version', 1).maybeSingle();

  let routingId;
  if (existingRouting) {
    routingId = existingRouting.routing_id;
    await admin.from('routing_steps').delete().eq('routing_id', routingId);
  } else {
    const { data: insertedRouting, error: routingError } = await admin
      .from('routings')
      .insert([{ company_id: companyId, item_id: item.item_id, version: 1 }])
      .select('routing_id')
      .single();
    if (routingError) throw new Error(`Failed to create routing: ${routingError.message}`);
    routingId = insertedRouting.routing_id;
  }

  const { error: stepsError } = await admin.from('routing_steps').insert(
    steps.map((step) => ({ ...step, routing_id: routingId, work_center_id: workCenterId }))
  );
  if (stepsError) throw new Error(`Failed to insert routing_steps: ${stepsError.message}`);

  console.log(`Ensured routing v1 for FG-ZALA-BEAUTY-N800 (routing_id=${routingId}, ${steps.length} tahap)`);

  const { error: woUpdateError } = await admin.from('work_orders').update({ routing_id: routingId }).eq('company_id', companyId).eq('item_id', item.item_id).is('routing_id', null);
  if (woUpdateError) throw new Error(`Failed to backfill routing_id on existing work orders: ${woUpdateError.message}`);
  console.log('Backfilled routing_id ke Work Order Zala Gummy yang sudah ada (kalau ada).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

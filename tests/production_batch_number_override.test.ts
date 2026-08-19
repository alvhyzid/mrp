import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createProductionBatch } from '../src/features/mrp/server/createProductionBatch';

// Nomor batch -- pola "rekomendasi + bisa diubah" (keputusan pemilik produk, 20
// Agu 2026, mengikuti format pabrik "3TM13082601"): staf boleh menimpa nomor
// otomatis, tapi keunikan dijaga PER PERUSAHAAN (migration 20260820160000),
// bukan cuma per Work Order seperti sebelumnya.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('Nomor batch produksi — rekomendasi otomatis + boleh ditimpa manual', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let workOrderId: number;
  let workOrder2Id: number;
  let ppicManagerAuthUid: string;
  let ppicManagerToken: string;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  function makeRequest(body: unknown, token: string): NextRequest {
    return new NextRequest('http://localhost/api/production-batches', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'BatchNumberOverrideTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant BatchNumberOverrideTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(plantError.message);
    plantId = plant.production_plant_id;

    const { data: authUser, error: authUserError } = await adminClient.auth.admin.createUser({
      email: 'ppicmanager.batchnumbertest@debug.mrp',
      password: roleTestPassword,
      email_confirm: true,
      user_metadata: { full_name: 'PPIC Manager BatchNumberTest' }
    });
    if (authUserError && !authUserError.message.includes('already been registered')) throw new Error(authUserError.message);
    if (authUser?.user) {
      ppicManagerAuthUid = authUser.user.id;
    } else {
      const { data } = await adminClient.auth.admin.listUsers({ perPage: 100, page: 1 });
      ppicManagerAuthUid = data!.users.find((u: any) => u.email === 'ppicmanager.batchnumbertest@debug.mrp')!.id;
    }
    const { error: appUserError } = await adminClient
      .from('users')
      .upsert([{ auth_uid: ppicManagerAuthUid, company_id: companyId, name: 'PPIC Manager BatchNumberTest', email: 'ppicmanager.batchnumbertest@debug.mrp', role: 'ppic_manager', status: 'active' }], { onConflict: 'auth_uid' });
    if (appUserError) throw new Error(appUserError.message);
    ppicManagerToken = await loginToken('ppicmanager.batchnumbertest@debug.mrp');

    const { data: item, error: itemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'BATCHNUM-TEST-ITEM', name: 'Item Uji Nomor Batch', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    if (itemError) throw new Error(itemError.message);
    itemId = item.item_id;

    const { data: bom, error: bomError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomError) throw new Error(bomError.message);

    const { data: wos, error: woError } = await adminClient
      .from('work_orders')
      .insert([
        { company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bom.bom_id, planned_qty: 100, status: 'in_progress' },
        { company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bom.bom_id, planned_qty: 100, status: 'in_progress' }
      ])
      .select('work_order_id');
    if (woError) throw new Error(woError.message);
    workOrderId = wos![0].work_order_id;
    workOrder2Id = wos![1].work_order_id;
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['production_batches', () => adminClient.from('production_batches').delete().in('work_order_id', [workOrderId, workOrder2Id])],
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['companies', () => adminClient.from('companies').delete().eq('company_id', companyId)]
    ];
    for (const [label, run] of cleanupSteps) {
      const { error } = await run();
      if (error) throw new Error(`Cleanup failed at ${label}: ${error.message}`);
    }
    await adminClient.auth.admin.deleteUser(ppicManagerAuthUid);
  });

  it('kosongkan nomor batch -> tetap dapat rekomendasi otomatis format lama (WO-xxxx-Bxxx)', async () => {
    const req = makeRequest({ work_order_id: workOrderId, planned_qty: 10 }, ppicManagerToken);
    const result = await createProductionBatch(req);
    expect(result.status).toBe(200);
    expect((result.body as any).batch.batch_number).toBe(`WO-${String(workOrderId).padStart(4, '0')}-B001`);
  });

  it('isi nomor batch format pabrik sendiri -> dipakai APA ADANYA, tidak ditolak/diubah', async () => {
    const req = makeRequest({ work_order_id: workOrderId, planned_qty: 10, batch_number: '3TM13082601' }, ppicManagerToken);
    const result = await createProductionBatch(req);
    expect(result.status).toBe(200);
    expect((result.body as any).batch.batch_number).toBe('3TM13082601');
  });

  it('(NEGATIF) nomor batch yang SAMA dipakai lagi di Work Order LAIN pada perusahaan yang sama -> DITOLAK (keunikan per perusahaan, bukan cuma per Work Order)', async () => {
    const req = makeRequest({ work_order_id: workOrder2Id, planned_qty: 5, batch_number: '3TM13082601' }, ppicManagerToken);
    const result = await createProductionBatch(req);
    expect(result.status).toBe(400);
    expect((result.body as any).error).toMatch(/sudah dipakai/);
  });

  it('(NEGATIF) nomor batch yang SAMA di Work Order yang SAMA juga tetap ditolak (bukan hanya lintas-WO)', async () => {
    const req = makeRequest({ work_order_id: workOrderId, planned_qty: 5, batch_number: '3TM13082601' }, ppicManagerToken);
    const result = await createProductionBatch(req);
    expect(result.status).toBe(400);
    expect((result.body as any).error).toMatch(/sudah dipakai/);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createProductionBatch } from '../src/features/mrp/server/createProductionBatch';
import { startProductionBatch } from '../src/features/mrp/server/startProductionBatch';
import { setWorkOrderStatus } from '../src/features/mrp/server/setWorkOrderStatus';
import { reopenWorkOrder } from '../src/features/mrp/server/reopenWorkOrder';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// PRD-12 (22 Agu 2026) -- Work Order status jadi hidup. Keputusan final:
// planned->in_progress OTOMATIS saat batch pertama dimulai; ->completed
// MANUAL oleh PPIC/supervisor; ->paused/cancelled MANUAL wajib alasan;
// batch baru pada WO completed/cancelled DITOLAK DI DATABASE (bukan
// diperingatkan); jalan keluar company_admin/manajer produksi membuka
// kembali dengan alasan wajib+tercatat, riwayat APPEND-ONLY.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeRequest(url: string, token: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

async function loginAs(email: string): Promise<string> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(supabaseUrl!, anonKey, { auth: { persistSession: false } });
  const { data } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
  return data.session!.access_token;
}

describe('PRD-12 — Siklus Hidup Status Work Order', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let bomId: number;
  let adminAuthUid: string;
  let staffAuthUid: string;
  let adminToken: string;
  let staffToken: string;
  const anonSessionClients: SupabaseClient[] = [];

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'Prd12StatusTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient.from('production_plants').insert([{ company_id: companyId, name: 'Plant Prd12', is_active: true }]).select('production_plant_id').single();
    plantId = plant!.production_plant_id;

    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'PRD12-ITEM', name: 'Item Prd12', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs' }])
      .select('item_id')
      .single();
    itemId = item!.item_id;

    const { data: bom } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    bomId = bom!.bom_id;

        adminAuthUid = await ensureAuthUser(adminClient, 'admin.prd12test@debug.mrp', roleTestPassword);
    await adminClient.from('users').insert([{ auth_uid: adminAuthUid, company_id: companyId, name: 'Admin Prd12Test', email: 'admin.prd12test@debug.mrp', role: 'company_admin', status: 'active' }]);

        staffAuthUid = await ensureAuthUser(adminClient, 'staff.prd12test@debug.mrp', roleTestPassword);
    await adminClient.from('users').insert([{ auth_uid: staffAuthUid, company_id: companyId, name: 'Staff Prd12Test', email: 'staff.prd12test@debug.mrp', role: 'production_staff', status: 'active' }]);

    adminToken = await loginAs('admin.prd12test@debug.mrp');
    staffToken = await loginAs('staff.prd12test@debug.mrp');
  });

  afterAll(async () => {
    for (const c of anonSessionClients) await c.auth.signOut().catch(() => {});

    const { data: woRows } = await adminClient.from('work_orders').select('work_order_id').eq('company_id', companyId);
    const woIds = (woRows ?? []).map((w) => w.work_order_id);
    const { data: batchRows } = woIds.length ? await adminClient.from('production_batches').select('production_batch_id').in('work_order_id', woIds) : { data: [] };
    const batchIds = (batchRows ?? []).map((b) => b.production_batch_id);

    const steps: Array<[string, () => any]> = [
      ['system_alerts', () => (woIds.length ? adminClient.from('system_alerts').delete().in('related_work_order_id', woIds) : Promise.resolve({ error: null }))],
      ['work_order_reopen_log', () => (woIds.length ? adminClient.from('work_order_reopen_log').delete().in('work_order_id', woIds) : Promise.resolve({ error: null }))],
      ['production_batch_routing_step_snapshots', () => (batchIds.length ? adminClient.from('production_batch_routing_step_snapshots').delete().in('production_batch_id', batchIds) : Promise.resolve({ error: null }))],
      ['production_batch_standard_crew_snapshots', () => (batchIds.length ? adminClient.from('production_batch_standard_crew_snapshots').delete().in('production_batch_id', batchIds) : Promise.resolve({ error: null }))],
      ['production_batch_bom_line_snapshots', () => (batchIds.length ? adminClient.from('production_batch_bom_line_snapshots').delete().in('production_batch_id', batchIds) : Promise.resolve({ error: null }))],
      ['production_batches', () => adminClient.from('production_batches').delete().eq('company_id', companyId)],
      ['status_transition_log', () => adminClient.from('status_transition_log').delete().eq('company_id', companyId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:admin1', () => adminClient.auth.admin.deleteUser(adminAuthUid)],
      ['auth:admin2', () => adminClient.auth.admin.deleteUser(staffAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, steps);
  });

  it('(c) planned -> in_progress OTOMATIS saat batch pertama dimulai', async () => {
    const { data: wo } = await adminClient.from('work_orders').insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bomId, planned_qty: 100, status: 'planned', priority: 'normal' }]).select('work_order_id').single();
    const woId = wo!.work_order_id;

    const before = await adminClient.from('work_orders').select('status').eq('work_order_id', woId).single();
    expect(before.data!.status).toBe('planned');

    const { data: batch } = await adminClient.from('production_batches').insert([{ company_id: companyId, work_order_id: woId, batch_number: 'PRD12-B001', planned_qty: 100, uom: 'pcs', status: 'planned', planned_date: new Date().toISOString().slice(0, 10) }]).select('production_batch_id').single();

    const startResult = await startProductionBatch(makeRequest('http://localhost/api/production-batches/start', staffToken, 'POST', { production_batch_id: batch!.production_batch_id }));
    expect(startResult.status).toBe(200);

    const after = await adminClient.from('work_orders').select('status').eq('work_order_id', woId).single();
    expect(after.data!.status).toBe('in_progress');
  });

  it('(a) WO completed -> buat batch baru lewat API langsung -> DITOLAK di database', async () => {
    const { data: wo } = await adminClient.from('work_orders').insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bomId, planned_qty: 50, status: 'in_progress', priority: 'normal' }]).select('work_order_id').single();
    const woId = wo!.work_order_id;

    const completeResult = await setWorkOrderStatus(makeRequest('http://localhost/api/work-orders/status', adminToken, 'PATCH', { work_order_id: woId, status: 'completed' }));
    expect(completeResult.status).toBe(200);

    const createResult = await createProductionBatch(makeRequest('http://localhost/api/production-batches', adminToken, 'POST', { work_order_id: woId, planned_qty: 10, planned_date: new Date().toISOString().slice(0, 10) }));
    expect(createResult.status).toBe(400);
    expect((createResult.body as any).error).toContain('sudah selesai/batal');

    const { data: batchesAfter } = await adminClient.from('production_batches').select('production_batch_id').eq('work_order_id', woId);
    expect(batchesAfter).toHaveLength(0);
  });

  it('(b)+(d) buka kembali WO tanpa alasan ditolak; dengan alasan berhasil + riwayat lama utuh; peran tanpa wewenang ditolak server', async () => {
    const { data: wo } = await adminClient.from('work_orders').insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bomId, planned_qty: 20, status: 'completed', priority: 'normal' }]).select('work_order_id').single();
    const woId = wo!.work_order_id;

    // peran tanpa wewenang (production_staff) ditolak
    const staffAttempt = await reopenWorkOrder(makeRequest('http://localhost/api/work-orders/reopen', staffToken, 'POST', { work_order_id: woId, reason: 'coba staf' }));
    expect(staffAttempt.status).toBe(403);

    // tanpa alasan -> ditolak
    const noReasonAttempt = await reopenWorkOrder(makeRequest('http://localhost/api/work-orders/reopen', adminToken, 'POST', { work_order_id: woId, reason: '' }));
    expect(noReasonAttempt.status).toBe(400);

    // dengan alasan -> berhasil (buka pertama)
    const firstReopen = await reopenWorkOrder(makeRequest('http://localhost/api/work-orders/reopen', adminToken, 'POST', { work_order_id: woId, reason: 'Salah input kuantitas, perlu tambahan batch' }));
    expect(firstReopen.status).toBe(200);

    const afterFirst = await adminClient.from('work_orders').select('status').eq('work_order_id', woId).single();
    expect(afterFirst.data!.status).toBe('in_progress');

    // selesaikan lagi, buka kembali KEDUA kalinya -- riwayat pertama harus tetap utuh
    await setWorkOrderStatus(makeRequest('http://localhost/api/work-orders/status', adminToken, 'PATCH', { work_order_id: woId, status: 'completed' }));
    const secondReopen = await reopenWorkOrder(makeRequest('http://localhost/api/work-orders/reopen', adminToken, 'POST', { work_order_id: woId, reason: 'Kedua kalinya, ada koreksi lagi' }));
    expect(secondReopen.status).toBe(200);

    const { data: reopenLogs } = await adminClient.from('work_order_reopen_log').select('reason, previous_status').eq('work_order_id', woId).order('work_order_reopen_log_id', { ascending: true });
    expect(reopenLogs).toHaveLength(2);
    expect(reopenLogs![0].reason).toBe('Salah input kuantitas, perlu tambahan batch');
    expect(reopenLogs![1].reason).toBe('Kedua kalinya, ada koreksi lagi');
  });

  it('paused/cancelled wajib alasan', async () => {
    const { data: wo } = await adminClient.from('work_orders').insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bomId, planned_qty: 30, status: 'in_progress', priority: 'normal' }]).select('work_order_id').single();
    const woId = wo!.work_order_id;

    const noReason = await setWorkOrderStatus(makeRequest('http://localhost/api/work-orders/status', adminToken, 'PATCH', { work_order_id: woId, status: 'paused' }));
    expect(noReason.status).toBe(400);

    const withReason = await setWorkOrderStatus(makeRequest('http://localhost/api/work-orders/status', adminToken, 'PATCH', { work_order_id: woId, status: 'paused', reason: 'Menunggu bahan datang' }));
    expect(withReason.status).toBe(200);

    const { data } = await adminClient.from('work_orders').select('status, status_reason').eq('work_order_id', woId).single();
    expect(data!.status).toBe('paused');
    expect(data!.status_reason).toBe('Menunggu bahan datang');
  });

  it('(e) WO lama yang masih planned -> perilakunya tidak berubah sama sekali (bisa buat batch normal)', async () => {
    const { data: wo } = await adminClient.from('work_orders').insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bomId, planned_qty: 40, status: 'planned', priority: 'normal' }]).select('work_order_id').single();
    const woId = wo!.work_order_id;

    const createResult = await createProductionBatch(makeRequest('http://localhost/api/production-batches', adminToken, 'POST', { work_order_id: woId, planned_qty: 40, planned_date: new Date().toISOString().slice(0, 10) }));
    expect(createResult.status).toBe(200);
  });
});

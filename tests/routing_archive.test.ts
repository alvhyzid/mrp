import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { deleteRouting, archiveRouting, restoreRouting } from '../src/features/mrp/server/deleteOrArchiveRouting';
import { listRoutings } from '../src/features/mrp/server/listRoutings';
import { startProductionBatch } from '../src/features/mrp/server/startProductionBatch';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// Sesi 7 (21 Agu 2026, 7.3/7.4/7.6) — keluhan nyata pemilik produk: "routing
// bisa dibuat & diedit, tidak bisa dihapus". Server yang MEMUTUSKAN hapus vs
// arsip (bukan pengguna) berdasar ada/tidaknya Work Order yang memakainya --
// TIDAK PERNAH hapus permanen baris yang direferensikan, dan TIDAK PERNAH
// mengarsipkan versi yang sedang dipakai batch berjalan (7.6).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeRequest(url: string, token: string, method: string): NextRequest {
  return new NextRequest(url, { method, headers: { Authorization: `Bearer ${token}` } });
}
function makeGetRequest(url: string, token: string): NextRequest {
  return new NextRequest(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
}

describe('Sesi 7 — jalan keluar Routing (hapus permanen vs arsipkan, dihitung server)', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let workCenterId: number;
  let bomId: number;
  let adminAuthUid: string;
  let staffAuthUid: string;
  let adminToken: string;
  let staffToken: string;

  const cleanupRoutingIds: number[] = [];
  const cleanupWorkOrderIds: number[] = [];
  const cleanupBatchIds: number[] = [];

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  async function makeRoutingWithStep(version: number): Promise<number> {
    const { data: routing } = await adminClient.from('routings').insert([{ company_id: companyId, item_id: itemId, version }]).select('routing_id').single();
    const routingId = routing!.routing_id;
    await adminClient.from('routing_steps').insert([{ routing_id: routingId, sequence_no: 1, step_name: 'Mixing', active_duration_minutes: 60, work_center_id: workCenterId }]);
    cleanupRoutingIds.push(routingId);
    return routingId;
  }

  async function makeWorkOrder(routingId: number): Promise<number> {
    const { data: wo } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bomId, routing_id: routingId, planned_qty: 10, status: 'planned' }])
      .select('work_order_id')
      .single();
    cleanupWorkOrderIds.push(wo!.work_order_id);
    return wo!.work_order_id;
  }

  async function makeBatch(workOrderId: number, batchNumber: string): Promise<number> {
    const { data } = await adminClient
      .from('production_batches')
      .insert([{ company_id: companyId, work_order_id: workOrderId, batch_number: batchNumber, planned_qty: 10, uom: 'pcs', status: 'planned' }])
      .select('production_batch_id')
      .single();
    cleanupBatchIds.push(data!.production_batch_id);
    return data!.production_batch_id;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'RoutingArchiveTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient.from('production_plants').insert([{ company_id: companyId, name: 'Plant RoutingArchiveTest', is_active: true }]).select('production_plant_id').single();
    plantId = plant!.production_plant_id;

        adminAuthUid = await ensureAuthUser(adminClient, 'admin.routingarchivetest@debug.mrp', roleTestPassword);
    await adminClient.from('users').insert([{ auth_uid: adminAuthUid, company_id: companyId, name: 'Admin RoutingArchiveTest', email: 'admin.routingarchivetest@debug.mrp', role: 'company_admin', status: 'active' }]);
    adminToken = await loginToken('admin.routingarchivetest@debug.mrp');

        staffAuthUid = await ensureAuthUser(adminClient, 'staff.routingarchivetest@debug.mrp', roleTestPassword);
    await adminClient.from('users').insert([{ auth_uid: staffAuthUid, company_id: companyId, name: 'Staf RoutingArchiveTest', email: 'staff.routingarchivetest@debug.mrp', role: 'production_staff', status: 'active' }]);
    staffToken = await loginToken('staff.routingarchivetest@debug.mrp');

    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'RARCH-FG', name: 'Item RoutingArchiveTest', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    itemId = item!.item_id;

    const { data: bom } = await adminClient.from('boms').insert([{ company_id: companyId, parent_item_id: itemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active', buffer_percentage: 0 }]).select('bom_id').single();
    bomId = bom!.bom_id;

    const { data: workCenter } = await adminClient
      .from('work_centers')
      .insert([{ company_id: companyId, production_plant_id: plantId, name: 'WC RoutingArchiveTest', code: 'WCRAT', is_active: true, capacity_hours_per_day: 8, unit_count: 1 }])
      .select('work_center_id')
      .single();
    workCenterId = workCenter!.work_center_id;
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['status_transition_log', () => adminClient.from('status_transition_log').delete().eq('company_id', companyId)],
      ['production_batch_routing_step_snapshots', () => adminClient.from('production_batch_routing_step_snapshots').delete().eq('company_id', companyId)],
      ['production_batch_standard_crew_snapshots', () => adminClient.from('production_batch_standard_crew_snapshots').delete().eq('company_id', companyId)],
      ['production_batch_bom_line_snapshots', () => adminClient.from('production_batch_bom_line_snapshots').delete().eq('company_id', companyId)],
      ['production_batches', () => adminClient.from('production_batches').delete().eq('company_id', companyId)],
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['routing_step_standard_crew', () => adminClient.from('routing_step_standard_crew').delete().eq('company_id', companyId)],
      ['routing_steps', () => adminClient.from('routing_steps').delete().in('routing_id', cleanupRoutingIds.length ? cleanupRoutingIds : [-1])],
      ['routings', () => adminClient.from('routings').delete().eq('company_id', companyId)],
      ['bom_lines', () => adminClient.from('bom_lines').delete().eq('bom_id', bomId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['work_centers', () => adminClient.from('work_centers').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:admin', () => adminClient.auth.admin.deleteUser(adminAuthUid)],
      ['auth:staff', () => adminClient.auth.admin.deleteUser(staffAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('(a) routing belum dipakai Work Order apa pun -> DELETE berhasil, baris benar-benar hilang', async () => {
    const routingId = await makeRoutingWithStep(1);

    const { count: before } = await adminClient.from('routings').select('routing_id', { count: 'exact', head: true }).eq('routing_id', routingId);
    expect(before).toBe(1);

    const result = await deleteRouting(makeRequest(`http://localhost/api/routings/${routingId}`, adminToken, 'DELETE'), String(routingId));
    expect(result.status).toBe(200);

    const { count: after } = await adminClient.from('routings').select('routing_id', { count: 'exact', head: true }).eq('routing_id', routingId);
    expect(after).toBe(0);
  });

  it('(b) routing SUDAH dipakai Work Order -> DELETE ditolak, pesan menyebut jumlah pemakainya', async () => {
    const routingId = await makeRoutingWithStep(2);
    await makeWorkOrder(routingId);

    const result = await deleteRouting(makeRequest(`http://localhost/api/routings/${routingId}`, adminToken, 'DELETE'), String(routingId));
    expect(result.status).toBe(400);
    expect((result.body as any).error).toContain('1 Work Order');

    const { data: stillThere } = await adminClient.from('routings').select('routing_id').eq('routing_id', routingId).maybeSingle();
    expect(stillThere).not.toBeNull();
  });

  it('(c) routing dipakai WO tapi TIDAK ada batch berjalan -> ARCHIVE berhasil, archived_at/archived_by terisi', async () => {
    const routingId = await makeRoutingWithStep(3);
    await makeWorkOrder(routingId);

    const result = await archiveRouting(makeRequest(`http://localhost/api/routings/${routingId}/archive`, adminToken, 'POST'), String(routingId));
    expect(result.status).toBe(200);

    const { data: row } = await adminClient.from('routings').select('archived_at, archived_by').eq('routing_id', routingId).single();
    expect(row!.archived_at).not.toBeNull();
    expect(row!.archived_by).not.toBeNull();
  });

  it('(c-lanjutan) routing yang diarsipkan TIDAK muncul di listRoutings default, MUNCUL kalau includeArchived=true', async () => {
    const routingId = await makeRoutingWithStep(4);
    await archiveRouting(makeRequest(`http://localhost/api/routings/${routingId}/archive`, adminToken, 'POST'), String(routingId));
    // routing v4 belum dipakai WO -> archiveRouting tetap boleh (tidak wajib dipakai utk diarsipkan)

    const defaultList = await listRoutings(makeGetRequest('http://localhost/api/routings', adminToken));
    const idsDefault = (defaultList.body as any).routings.map((r: any) => r.routing_id);
    expect(idsDefault).not.toContain(routingId);

    const withArchived = await listRoutings(makeGetRequest('http://localhost/api/routings?includeArchived=true', adminToken));
    const idsWithArchived = (withArchived.body as any).routings.map((r: any) => r.routing_id);
    expect(idsWithArchived).toContain(routingId);
  });

  it('(d) routing yang diarsipkan -> RESTORE berhasil, archived_at kembali null, muncul lagi di daftar default', async () => {
    const routingId = await makeRoutingWithStep(5);
    await archiveRouting(makeRequest(`http://localhost/api/routings/${routingId}/archive`, adminToken, 'POST'), String(routingId));

    const restoreResult = await restoreRouting(makeRequest(`http://localhost/api/routings/${routingId}/restore`, adminToken, 'POST'), String(routingId));
    expect(restoreResult.status).toBe(200);

    const { data: row } = await adminClient.from('routings').select('archived_at').eq('routing_id', routingId).single();
    expect(row!.archived_at).toBeNull();

    const defaultList = await listRoutings(makeGetRequest('http://localhost/api/routings', adminToken));
    const ids = (defaultList.body as any).routings.map((r: any) => r.routing_id);
    expect(ids).toContain(routingId);
  });

  it('(e) routing sedang dipakai BATCH BERJALAN (in_progress) -> ARCHIVE ditolak, pesan menyebut nama batch', async () => {
    const routingId = await makeRoutingWithStep(6);
    const workOrderId = await makeWorkOrder(routingId);
    const batchId = await makeBatch(workOrderId, 'RARCH-BATCH-RUNNING');

    const startReq = new NextRequest('http://localhost/api/production-batches/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ production_batch_id: batchId })
    });
    const startResult = await startProductionBatch(startReq);
    expect(startResult.status).toBe(200);

    const archiveResult = await archiveRouting(makeRequest(`http://localhost/api/routings/${routingId}/archive`, adminToken, 'POST'), String(routingId));
    expect(archiveResult.status).toBe(400);
    expect((archiveResult.body as any).error).toContain('RARCH-BATCH-RUNNING');

    const { data: row } = await adminClient.from('routings').select('archived_at').eq('routing_id', routingId).single();
    expect(row!.archived_at).toBeNull();
  });

  it('(f) role tanpa izin (production_staff) -> DELETE dan ARCHIVE ditolak server (403), bukan cuma tombol disembunyikan', async () => {
    const routingId = await makeRoutingWithStep(7);

    const deleteResult = await deleteRouting(makeRequest(`http://localhost/api/routings/${routingId}`, staffToken, 'DELETE'), String(routingId));
    expect(deleteResult.status).toBe(403);

    const archiveResult = await archiveRouting(makeRequest(`http://localhost/api/routings/${routingId}/archive`, staffToken, 'POST'), String(routingId));
    expect(archiveResult.status).toBe(403);

    const { data: stillThere } = await adminClient.from('routings').select('routing_id, archived_at').eq('routing_id', routingId).single();
    expect(stillThere!.archived_at).toBeNull();
  });
});

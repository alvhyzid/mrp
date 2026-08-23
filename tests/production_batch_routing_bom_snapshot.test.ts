import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { startProductionBatch } from '../src/features/mrp/server/startProductionBatch';
import { completeProductionBatch } from '../src/features/mrp/server/completeProductionBatch';
import { getGanttBlockDetail } from '../src/features/mrp/server/getGanttBlockDetail';
import { getProductionBatchBomSnapshot } from '../src/features/mrp/server/getProductionBatchBomSnapshot';
import { updateRouting } from '../src/features/mrp/server/updateRouting';
import { updateBom } from '../src/features/mrp/server/updateBom';
import { getWorkCenterGantt } from '../src/features/mrp/server/getWorkCenterGantt';
import { getWorkCenterCapacity } from '../src/features/mrp/server/getWorkCenterCapacity';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// Sesi 6A (21 Agu 2026) — snapshot routing & BOM per batch. Arkeologi (6A.1)
// membuktikan updateRouting.ts/updateBom.ts menimpa LANGSUNG baris routing_id/
// bom_id yang SAMA (delete+reinsert) tanpa versi baru -- tanpa snapshot ini,
// mengedit routing/BOM hari ini diam-diam mengubah "durasi standar"/"kebutuhan
// bahan" yang ditampilkan untuk batch yang SUDAH SELESAI kemarin. Sesi ini
// membuktikan snapshot menutup celah itu TANPA mengubah aritmatika (batas 6A).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeRequest(url: string, token: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
function makeGetRequest(url: string, token: string): NextRequest {
  return new NextRequest(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
}

describe('Sesi 6A — snapshot routing & BOM per batch (angka batch berjalan/selesai TIDAK berubah kalau master diedit)', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let componentItemId: number;
  let bomId: number;
  let routingId: number;
  let stepMixId: number;
  let workCenterId: number;
  let workOrderId: number;
  let adminAuthUid: string;
  let adminToken: string;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  async function makeBatch(batchNumber: string, plannedDate?: string): Promise<number> {
    const { data, error } = await adminClient
      .from('production_batches')
      .insert([{ company_id: companyId, work_order_id: workOrderId, batch_number: batchNumber, planned_qty: 100, uom: 'pcs', status: 'planned', planned_date: plannedDate ?? null }])
      .select('production_batch_id')
      .single();
    if (error) throw new Error(error.message);
    return data.production_batch_id;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'RoutingBomSnapshotTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient.from('production_plants').insert([{ company_id: companyId, name: 'Plant RoutingBomSnapshotTest', is_active: true }]).select('production_plant_id').single();
    plantId = plant!.production_plant_id;

    const adminUser = await adminClient.auth.admin.createUser({ email: 'admin.routingbomsnapshottest@debug.mrp', password: roleTestPassword, email_confirm: true });
    adminAuthUid = adminUser.data.user!.id;
    await adminClient.from('users').insert([{ auth_uid: adminAuthUid, company_id: companyId, name: 'Admin RoutingBomSnapshotTest', email: 'admin.routingbomsnapshottest@debug.mrp', role: 'company_admin', status: 'active' }]);
    adminToken = await loginToken('admin.routingbomsnapshottest@debug.mrp');

    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'RBSNAP-FG', name: 'Item RoutingBomSnapshotTest', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    itemId = item!.item_id;

    const { data: component } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'RBSNAP-RM', name: 'Bahan RoutingBomSnapshotTest', type: 'raw_material', base_uom: 'kg', purchase_uom: 'kg', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    componentItemId = component!.item_id;

    const { data: bom } = await adminClient.from('boms').insert([{ company_id: companyId, parent_item_id: itemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active', buffer_percentage: 0 }]).select('bom_id').single();
    bomId = bom!.bom_id;
    await adminClient.from('bom_lines').insert([{ bom_id: bomId, component_item_id: componentItemId, qty_per_unit_output: 2, uom: 'kg' }]);

    const { data: workCenter } = await adminClient
      .from('work_centers')
      .insert([{ company_id: companyId, production_plant_id: plantId, name: 'WC RoutingBomSnapshotTest', code: 'WCRBS', is_active: true, capacity_hours_per_day: 8, unit_count: 1 }])
      .select('work_center_id')
      .single();
    workCenterId = workCenter!.work_center_id;

    const { data: routing } = await adminClient.from('routings').insert([{ company_id: companyId, item_id: itemId, version: 1 }]).select('routing_id').single();
    routingId = routing!.routing_id;
    const { data: steps } = await adminClient
      .from('routing_steps')
      .insert([{ routing_id: routingId, sequence_no: 1, step_name: 'Mixing', active_duration_minutes: 60, work_center_id: workCenterId }])
      .select('routing_step_id');
    stepMixId = steps![0].routing_step_id;

    const { data: wo } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bomId, routing_id: routingId, planned_qty: 100, status: 'planned' }])
      .select('work_order_id')
      .single();
    workOrderId = wo!.work_order_id;
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['production_batch_routing_step_snapshots', () => adminClient.from('production_batch_routing_step_snapshots').delete().eq('company_id', companyId)],
      ['production_batch_standard_crew_snapshots', () => adminClient.from('production_batch_standard_crew_snapshots').delete().eq('company_id', companyId)],
      ['production_batch_bom_line_snapshots', () => adminClient.from('production_batch_bom_line_snapshots').delete().eq('company_id', companyId)],
      ['status_transition_log', () => adminClient.from('status_transition_log').delete().eq('company_id', companyId)],
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['production_standard_exclusions', () => adminClient.from('production_standard_exclusions').delete().eq('company_id', companyId)],
      ['production_standard_proposals', () => adminClient.from('production_standard_proposals').delete().eq('company_id', companyId)],
      ['production_standard_samples', () => adminClient.from('production_standard_samples').delete().eq('company_id', companyId)],
      ['production_batches', () => adminClient.from('production_batches').delete().eq('work_order_id', workOrderId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['routing_steps', () => adminClient.from('routing_steps').delete().eq('routing_id', routingId)],
      ['routings', () => adminClient.from('routings').delete().eq('company_id', companyId)],
      ['bom_lines', () => adminClient.from('bom_lines').delete().eq('bom_id', bomId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['work_centers', () => adminClient.from('work_centers').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:admin', () => adminClient.auth.admin.deleteUser(adminAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('(negatif a) batch dimulai -> beku durasi 60mnt & kebutuhan bahan 2kg/unit; edit routing (2x) & BOM (3x) SETELAHNYA -> angka batch ini TIDAK berubah', async () => {
    const batchId = await makeBatch('RBSNAP-BATCH-A');
    const startResult = await startProductionBatch(makeRequest('http://localhost/api/production-batches/start', adminToken, 'POST', { production_batch_id: batchId }));
    expect(startResult.status).toBe(200);

    const { data: batchAfterStart } = await adminClient.from('production_batches').select('routing_snapshot_taken_at').eq('production_batch_id', batchId).single();
    expect(batchAfterStart!.routing_snapshot_taken_at).not.toBeNull();

    const ganttBefore = await getGanttBlockDetail(
      makeGetRequest(`http://localhost/api/gantt/block-detail?production_batch_id=${batchId}&routing_step_id=${stepMixId}`, adminToken)
    );
    expect(ganttBefore.status).toBe(200);
    expect((ganttBefore.body as any).step.active_duration_minutes).toBe(60);
    expect((ganttBefore.body as any).durasi_standar_dari_snapshot).toBe(true);

    const bomSnapshotBefore = await getProductionBatchBomSnapshot(makeGetRequest('http://localhost/x', adminToken), batchId);
    expect(bomSnapshotBefore.status).toBe(200);
    expect((bomSnapshotBefore.body as any).has_snapshot).toBe(true);
    expect((bomSnapshotBefore.body as any).lines[0].qty_per_unit_output).toBe(2);

    // Ubah routing (durasi 2x) DAN BOM (rasio 3x) SETELAH batch ini dimulai.
    const updateRoutingResult = await updateRouting(
      makeRequest('http://localhost/api/routings', adminToken, 'PATCH', {
        routing_id: routingId,
        steps: [{ sequence_no: 1, step_name: 'Mixing', active_duration_minutes: 120, wait_duration_minutes: 0 }]
      })
    );
    expect(updateRoutingResult.status).toBe(200);

    const updateBomResult = await updateBom(
      makeRequest('http://localhost/api/boms', adminToken, 'PATCH', {
        bom_id: bomId,
        standard_yield_qty: 1,
        standard_yield_uom: 'pcs',
        status: 'active',
        buffer_percentage: 0,
        lines: [{ component_item_id: componentItemId, qty_per_unit_output: 6, uom: 'kg' }]
      })
    );
    expect(updateBomResult.status).toBe(200);

    // Baris routing_steps LAMA (stepMixId) sudah dihapus+diganti ID baru oleh
    // updateRouting -- konfirmasi live master BENAR berubah (bukti edit sungguhan
    // terjadi), tapi batch A tetap baca snapshot lewat routing_step_id ASLI.
    const { data: liveStepsAfterEdit } = await adminClient.from('routing_steps').select('routing_step_id, active_duration_minutes').eq('routing_id', routingId);
    expect(liveStepsAfterEdit).toHaveLength(1);
    expect(liveStepsAfterEdit![0].active_duration_minutes).toBe(120);
    expect(liveStepsAfterEdit![0].routing_step_id).not.toBe(stepMixId);

    const ganttAfter = await getGanttBlockDetail(
      makeGetRequest(`http://localhost/api/gantt/block-detail?production_batch_id=${batchId}&routing_step_id=${stepMixId}`, adminToken)
    );
    expect(ganttAfter.status).toBe(200);
    expect((ganttAfter.body as any).step.active_duration_minutes).toBe(60); // TIDAK berubah dari 60 -> 120

    const bomSnapshotAfter = await getProductionBatchBomSnapshot(makeGetRequest('http://localhost/x', adminToken), batchId);
    expect((bomSnapshotAfter.body as any).lines[0].qty_per_unit_output).toBe(2); // TIDAK berubah dari 2 -> 6

    // (negatif c, 6A bukti) SELESAIKAN batch ini -> angkanya TETAP tidak berubah
    // sesudah completed, membuktikan snapshot bukan cuma bertahan selama
    // in_progress tapi juga untuk batch yang sudah SELESAI.
    const completeResult = await completeProductionBatch(makeRequest('http://localhost/api/production-batches/complete', adminToken, 'POST', { production_batch_id: batchId }));
    expect(completeResult.status).toBe(200);

    const ganttAfterComplete = await getGanttBlockDetail(
      makeGetRequest(`http://localhost/api/gantt/block-detail?production_batch_id=${batchId}&routing_step_id=${stepMixId}`, adminToken)
    );
    expect((ganttAfterComplete.body as any).step.active_duration_minutes).toBe(60);
    const bomSnapshotAfterComplete = await getProductionBatchBomSnapshot(makeGetRequest('http://localhost/x', adminToken), batchId);
    expect((bomSnapshotAfterComplete.body as any).lines[0].qty_per_unit_output).toBe(2);
  });

  it('(negatif b, 6A.4) batch BARU dibuat & dimulai SESUDAH perubahan itu -> memakai angka BARU (120mnt, 6kg/unit)', async () => {
    const batchId = await makeBatch('RBSNAP-BATCH-B');
    const startResult = await startProductionBatch(makeRequest('http://localhost/api/production-batches/start', adminToken, 'POST', { production_batch_id: batchId }));
    expect(startResult.status).toBe(200);

    const { data: newLiveStep } = await adminClient.from('routing_steps').select('routing_step_id').eq('routing_id', routingId).single();

    const gantt = await getGanttBlockDetail(makeGetRequest(`http://localhost/api/gantt/block-detail?production_batch_id=${batchId}&routing_step_id=${newLiveStep!.routing_step_id}`, adminToken));
    expect(gantt.status).toBe(200);
    expect((gantt.body as any).step.active_duration_minutes).toBe(120);

    const bomSnapshot = await getProductionBatchBomSnapshot(makeGetRequest('http://localhost/x', adminToken), batchId);
    expect((bomSnapshot.body as any).lines[0].qty_per_unit_output).toBe(6);
  });

  it('(negatif c) batch BELUM dimulai (masih planned) -> TETAP baca master hidup (has_snapshot:false), bukan snapshot karangan', async () => {
    const batchId = await makeBatch('RBSNAP-BATCH-C-NOTSTARTED');
    const bomSnapshot = await getProductionBatchBomSnapshot(makeGetRequest('http://localhost/x', adminToken), batchId);
    expect(bomSnapshot.status).toBe(200);
    expect((bomSnapshot.body as any).has_snapshot).toBe(false);
  });

  it('(negatif d) Gantt Produksi & Kapasitas Work Center juga baca dari snapshot -- posisi/durasi blok & jam terjadwal TIDAK ikut berubah kalau routing diedit setelah batch dimulai', async () => {
    // Pastikan work_center_id terpasang & durasi terkendali (150mnt) SEBELUM
    // batch D dimulai -- tes (a)/(b) sebelumnya sudah mengedit routing ini
    // tanpa menyertakan work_center_id, jadi disetel ulang eksplisit di sini.
    await updateRouting(
      makeRequest('http://localhost/api/routings', adminToken, 'PATCH', {
        routing_id: routingId,
        steps: [{ sequence_no: 1, step_name: 'Mixing', active_duration_minutes: 150, wait_duration_minutes: 0, work_center_id: workCenterId }]
      })
    );

    // TANGGAL LOKAL, BUKAN toISOString(). toISOString() memberi tanggal UTC, dan di
    // zona WIB (UTC+7) antara pukul 00:00-07:00 tanggal UTC masih KEMARIN. Kalau
    // kemarin itu hari Minggu, batch terjadwal di MINGGU SEBELUMNYA, sementara Gantt
    // menghitung minggu dari waktu LOKAL (lihat getWeekRange di weekRange.ts) -- jadi
    // bloknya tidak ketemu dan test gagal.
    //
    // Bug laten ini tidur berbulan-bulan dan baru muncul saat suite kebetulan berjalan
    // Senin dini hari 24 Agu 2026. Berkas weekRange.ts SUDAH memperingatkan hal ini
    // persis di komentar dateToDateString ("bukan toISOString, yang bisa mundur/maju
    // 1 hari"), tapi test ini tetap memakai toISOString.
    const kini = new Date();
    const today = `${kini.getFullYear()}-${String(kini.getMonth() + 1).padStart(2, '0')}-${String(kini.getDate()).padStart(2, '0')}`;
    const batchId = await makeBatch('RBSNAP-BATCH-D-GANTT', today);
    expect((await startProductionBatch(makeRequest('http://localhost/api/production-batches/start', adminToken, 'POST', { production_batch_id: batchId }))).status).toBe(200);

    const { data: liveStepBeforeD } = await adminClient.from('routing_steps').select('routing_step_id, active_duration_minutes').eq('routing_id', routingId).single();
    expect(liveStepBeforeD!.active_duration_minutes).toBe(150);

    const ganttBefore = await getWorkCenterGantt(makeGetRequest('http://localhost/api/work-centers/gantt?view=weekly&week_offset=0', adminToken));
    expect(ganttBefore.status).toBe(200);
    const blockD = (ganttBefore.body as any).blocks.find((b: any) => b.production_batch_id === batchId);
    expect(blockD).toBeTruthy();
    expect(blockD.duration_minutes).toBe(150);

    // CATATAN: batch C ("RBSNAP-BATCH-C-NOTSTARTED", fixture test sebelumnya)
    // masih 'planned' (belum dimulai) dan ikut kena hitungan "minggu ini" (lewat
    // fallback created_at) -- BENAR menurut 6A.4: batch yang belum dimulai TETAP
    // baca master hidup, jadi turut menyumbang 150mnt LIVE ke work center yang
    // sama. Total SEBELUM = 150 (C, live) + 150 (D, beku) = 300mnt = 5 jam --
    // bukan cuma 150 dari D sendiri. Justru INI yang membuktikan 6A.4: batch C
    // ikut LANGSUNG kalau live berubah nanti, batch D TIDAK.
    const capacityBefore = await getWorkCenterCapacity(makeGetRequest('http://localhost/api/work-centers/capacity', adminToken));
    const wcCapacityBefore = (capacityBefore.body as any).workCenters.find((w: any) => w.work_center_id === workCenterId);
    expect(wcCapacityBefore.scheduled_hours).toBe(5); // 150 (C, live) + 150 (D, beku) mnt

    await updateRouting(
      makeRequest('http://localhost/api/routings', adminToken, 'PATCH', {
        routing_id: routingId,
        steps: [{ sequence_no: 1, step_name: 'Mixing', active_duration_minutes: 300, wait_duration_minutes: 0, work_center_id: workCenterId }]
      })
    );
    const { data: liveStepAfterD } = await adminClient.from('routing_steps').select('active_duration_minutes').eq('routing_id', routingId).single();
    expect(liveStepAfterD!.active_duration_minutes).toBe(300); // konfirmasi live BENAR berubah

    const ganttAfter = await getWorkCenterGantt(makeGetRequest('http://localhost/api/work-centers/gantt?view=weekly&week_offset=0', adminToken));
    const blockDAfter = (ganttAfter.body as any).blocks.find((b: any) => b.production_batch_id === batchId);
    expect(blockDAfter.duration_minutes).toBe(150); // TIDAK ikut jadi 300

    // Setelah edit ke 300mnt: batch C (live) ikut naik jadi 300, batch D (beku)
    // TETAP 150 -- total = 300+150 = 450mnt = 7,5 jam, BUKAN 600mnt/10 jam
    // (yang akan terjadi kalau batch D ikut terpengaruh juga).
    const capacityAfter = await getWorkCenterCapacity(makeGetRequest('http://localhost/api/work-centers/capacity', adminToken));
    const wcCapacityAfter = (capacityAfter.body as any).workCenters.find((w: any) => w.work_center_id === workCenterId);
    expect(wcCapacityAfter.scheduled_hours).toBe(7.5);
  });
});

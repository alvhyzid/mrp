import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { startProductionBatch } from '../src/features/mrp/server/startProductionBatch';
import { completeProductionBatch } from '../src/features/mrp/server/completeProductionBatch';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// Fase Produksi Nyata, P1 — "Selesaikan Batch" lewat state machine yang SUDAH ADA
// (status_transition_rules + trigger enforce_status_transition, migration
// 20260817100000) -- transisi production_batches planned->in_progress->completed
// sudah terdaftar sejak awal, cuma belum pernah ada kode aplikasi yang memicunya.
// Fixture perusahaan TERPISAH ("BatchLifecycleTestCorp"), pola sama dengan
// tests/employee_crud_and_k8_standards.test.ts.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error(
    'Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.'
  );
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeRequest(url: string, token: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

describe('Fase Produksi Nyata P1 — Mulai/Selesaikan Batch (state machine + K8 auto-submit)', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let routingId: number;
  let stepMixId: number;
  let stepPackId: number;
  let workOrderId: number;

  let prodStaffAuthUid: string;
  let prodStaffToken: string;
  let warehouseStaffAuthUid: string;
  let warehouseStaffToken: string;

  let batchCompleteFlowId: number; // log lengkap -> jadi sampel K8
  let batchIncompleteFlowId: number; // log tidak lengkap -> dikecualikan
  let batchIllegalJumpId: number; // tetap 'planned', dipakai uji lompat status

  async function getOrCreateAuthUser(email: string, fullName: string) {
    let page = 1;
    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 100, page });
      if (error) throw new Error(error.message);
      const found = data?.users?.find((u: any) => u.email === email);
      if (found) return found;
      if (!data?.nextPage) break;
      page += 1;
    }
    const { data, error } = await adminClient.auth.admin.createUser({ email, password: roleTestPassword, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error) throw new Error(error.message);
    return data.user;
  }

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'BatchLifecycleTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant BatchLifecycleTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(plantError.message);
    plantId = plant.production_plant_id;

    const prodStaffUser = await getOrCreateAuthUser('prodstaff.batchlifecycletest@debug.mrp', 'Operator BatchLifecycleTest');
    const warehouseStaffUser = await getOrCreateAuthUser('whstaff.batchlifecycletest@debug.mrp', 'Warehouse Staff BatchLifecycleTest');
    prodStaffAuthUid = prodStaffUser.id;
    warehouseStaffAuthUid = warehouseStaffUser.id;

    const { error: usersError } = await adminClient.from('users').upsert(
      [
        { auth_uid: prodStaffAuthUid, company_id: companyId, name: 'Operator BatchLifecycleTest', email: 'prodstaff.batchlifecycletest@debug.mrp', role: 'production_staff', status: 'active' },
        { auth_uid: warehouseStaffAuthUid, company_id: companyId, name: 'Warehouse Staff BatchLifecycleTest', email: 'whstaff.batchlifecycletest@debug.mrp', role: 'warehouse_staff', status: 'active' }
      ],
      { onConflict: 'auth_uid' }
    );
    if (usersError) throw new Error(usersError.message);

    prodStaffToken = await loginToken('prodstaff.batchlifecycletest@debug.mrp');
    warehouseStaffToken = await loginToken('whstaff.batchlifecycletest@debug.mrp');

    const { data: item, error: itemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'BATCHLIFECYCLE-ITEM', name: 'Item BatchLifecycleTest', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
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

    const { data: routing, error: routingError } = await adminClient.from('routings').insert([{ company_id: companyId, item_id: itemId, version: 1 }]).select('routing_id').single();
    if (routingError) throw new Error(routingError.message);
    routingId = routing.routing_id;

    const { data: steps, error: stepsError } = await adminClient
      .from('routing_steps')
      .insert([
        { routing_id: routingId, sequence_no: 1, step_name: 'Mixing', active_duration_minutes: 60 },
        { routing_id: routingId, sequence_no: 2, step_name: 'Packing', active_duration_minutes: 30 }
      ])
      .select('routing_step_id, sequence_no');
    if (stepsError) throw new Error(stepsError.message);
    stepMixId = steps!.find((s) => s.sequence_no === 1)!.routing_step_id;
    stepPackId = steps!.find((s) => s.sequence_no === 2)!.routing_step_id;

    const { data: wo, error: woError } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bom.bom_id, routing_id: routingId, planned_qty: 100, status: 'in_progress' }])
      .select('work_order_id')
      .single();
    if (woError) throw new Error(woError.message);
    workOrderId = wo.work_order_id;

    async function makeBatch(batchNumber: string): Promise<number> {
      const { data: batch, error } = await adminClient
        .from('production_batches')
        .insert([{ company_id: companyId, work_order_id: workOrderId, batch_number: batchNumber, planned_qty: 100, uom: 'pcs', status: 'planned' }])
        .select('production_batch_id')
        .single();
      if (error) throw new Error(error.message);
      return batch.production_batch_id;
    }

    batchCompleteFlowId = await makeBatch('BLC-COMPLETE-FLOW');
    batchIncompleteFlowId = await makeBatch('BLC-INCOMPLETE-FLOW');
    batchIllegalJumpId = await makeBatch('BLC-ILLEGAL-JUMP');

    // batchCompleteFlowId: log LENGKAP (kedua tahap completed) + output nyata.
    const startedAt = new Date('2026-08-19T00:00:00Z');
    const midAt = new Date(startedAt.getTime() + 60 * 60000);
    const endAt = new Date(midAt.getTime() + 30 * 60000);
    const { error: progressError } = await adminClient.from('work_order_step_progress').insert([
      { work_order_id: workOrderId, production_batch_id: batchCompleteFlowId, routing_step_id: stepMixId, status: 'completed', qty_input: 100, uom_input: 'pcs', qty_recorded: 95, uom: 'pcs', started_at: startedAt.toISOString(), completed_at: midAt.toISOString() },
      { work_order_id: workOrderId, production_batch_id: batchCompleteFlowId, routing_step_id: stepPackId, status: 'completed', qty_input: 95, uom_input: 'pcs', qty_recorded: 90, uom: 'pcs', started_at: midAt.toISOString(), completed_at: endAt.toISOString() }
    ]);
    if (progressError) throw new Error(progressError.message);
    const { error: outputError } = await adminClient.from('work_order_outputs').insert([{ work_order_id: workOrderId, production_batch_id: batchCompleteFlowId, item_id: itemId, output_type: 'main_output', qty: 90 }]);
    if (outputError) throw new Error(outputError.message);

    // batchIncompleteFlowId: HANYA tahap Mixing completed, Packing tidak pernah dicatat.
    const { error: partialProgressError } = await adminClient
      .from('work_order_step_progress')
      .insert([{ work_order_id: workOrderId, production_batch_id: batchIncompleteFlowId, routing_step_id: stepMixId, status: 'completed', qty_input: 100, uom_input: 'pcs', qty_recorded: 95, uom: 'pcs' }]);
    if (partialProgressError) throw new Error(partialProgressError.message);
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['production_standard_exclusions', () => adminClient.from('production_standard_exclusions').delete().eq('company_id', companyId)],
      ['production_standard_proposals', () => adminClient.from('production_standard_proposals').delete().eq('company_id', companyId)],
      ['production_standard_samples', () => adminClient.from('production_standard_samples').delete().eq('company_id', companyId)],
      ['production_standards', () => adminClient.from('production_standards').delete().eq('company_id', companyId)],
      ['status_transition_log', () => adminClient.from('status_transition_log').delete().eq('company_id', companyId)],
      // Sesi 6A (21 Agu 2026) — startProductionBatch sekarang menulis snapshot
      // routing/BOM/kru beku di sini; harus dibersihkan SEBELUM production_batches.
      ['production_batch_routing_step_snapshots', () => adminClient.from('production_batch_routing_step_snapshots').delete().eq('company_id', companyId)],
      ['production_batch_standard_crew_snapshots', () => adminClient.from('production_batch_standard_crew_snapshots').delete().eq('company_id', companyId)],
      ['production_batch_bom_line_snapshots', () => adminClient.from('production_batch_bom_line_snapshots').delete().eq('company_id', companyId)],
      ['work_order_step_progress', () => adminClient.from('work_order_step_progress').delete().eq('work_order_id', workOrderId)],
      ['work_order_outputs', () => adminClient.from('work_order_outputs').delete().eq('work_order_id', workOrderId)],
      ['production_batches', () => adminClient.from('production_batches').delete().eq('work_order_id', workOrderId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['routing_steps', () => adminClient.from('routing_steps').delete().eq('routing_id', routingId)],
      ['routings', () => adminClient.from('routings').delete().eq('company_id', companyId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:prod_staff', () => adminClient.auth.admin.deleteUser(prodStaffAuthUid)],
      ['auth:warehouse_staff', () => adminClient.auth.admin.deleteUser(warehouseStaffAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('(c, negatif) warehouse_staff (bukan operator/SPV produksi): coba mulai & selesaikan batch -> 403 keduanya', async () => {
    const startReq = makeRequest('http://localhost/api/production-batches/start', warehouseStaffToken, 'POST', { production_batch_id: batchCompleteFlowId });
    expect((await startProductionBatch(startReq)).status).toBe(403);

    const completeReq = makeRequest('http://localhost/api/production-batches/complete', warehouseStaffToken, 'POST', { production_batch_id: batchCompleteFlowId });
    expect((await completeProductionBatch(completeReq)).status).toBe(403);
  });

  it('(b, negatif) lompat status ilegal: coba SELESAIKAN batch yang masih "planned" (skip "Mulai") -> ditolak trigger, status TETAP planned', async () => {
    const req = makeRequest('http://localhost/api/production-batches/complete', prodStaffToken, 'POST', { production_batch_id: batchIllegalJumpId });
    const result = await completeProductionBatch(req);
    expect(result.status).toBe(400);
    expect(String(result.body.error)).toContain('Transisi status');

    const { data: batch } = await adminClient.from('production_batches').select('status').eq('production_batch_id', batchIllegalJumpId).single();
    expect(batch!.status).toBe('planned'); // TIDAK berubah -- trigger menolak SEBELUM commit
  });

  it('(a+positif) operator: Mulai Batch lalu Selesaikan Batch (log LENGKAP) -> status berpindah lewat trigger, tercatat di status_transition_log, DAN otomatis jadi sampel K8', async () => {
    const startReq = makeRequest('http://localhost/api/production-batches/start', prodStaffToken, 'POST', { production_batch_id: batchCompleteFlowId });
    const startResult = await startProductionBatch(startReq);
    expect(startResult.status).toBe(200);

    const { data: afterStart } = await adminClient.from('production_batches').select('status, started_at').eq('production_batch_id', batchCompleteFlowId).single();
    expect(afterStart!.status).toBe('in_progress');
    expect(afterStart!.started_at).not.toBeNull();

    const completeReq = makeRequest('http://localhost/api/production-batches/complete', prodStaffToken, 'POST', { production_batch_id: batchCompleteFlowId });
    const completeResult = await completeProductionBatch(completeReq);
    expect(completeResult.status).toBe(200);

    const { data: afterComplete } = await adminClient.from('production_batches').select('status, completed_at').eq('production_batch_id', batchCompleteFlowId).single();
    expect(afterComplete!.status).toBe('completed');
    expect(afterComplete!.completed_at).not.toBeNull();

    // Trigger enforce_status_transition BENAR-BENAR jalan (bukan di-bypass) --
    // 2 baris log: planned->in_progress, in_progress->completed.
    const { data: transitionLog } = await adminClient
      .from('status_transition_log')
      .select('from_status, to_status')
      .eq('table_name', 'production_batches')
      .eq('record_id', batchCompleteFlowId)
      .order('status_transition_log_id', { ascending: true });
    expect(transitionLog).toEqual([
      { from_status: 'planned', to_status: 'in_progress' },
      { from_status: 'in_progress', to_status: 'completed' }
    ]);

    // Otomatis diajukan sebagai sampel K8 -- TANPA klik terpisah ke learn-standard-sample.
    const k8Sample = completeResult.body.k8_sample as { excluded: boolean; samples_submitted: unknown[] };
    expect(k8Sample.excluded).toBe(false);
    expect(k8Sample.samples_submitted.length).toBeGreaterThan(0);
    const { data: proposal } = await adminClient
      .from('production_standard_proposals')
      .select('metric_key, proposed_value, sample_count')
      .eq('company_id', companyId)
      .eq('item_id', itemId)
      .eq('metric_key', 'unit_per_batch')
      .eq('status', 'pending')
      .maybeSingle();
    expect(proposal).not.toBeNull();
    expect(Number(proposal!.proposed_value)).toBe(90); // qty output main_output batch ini
  });

  it('(a, negatif) selesaikan batch dengan log tahap BELUM LENGKAP -> BOLEH selesai (status berubah), TAPI dikecualikan dari sampel K8', async () => {
    const startReq = makeRequest('http://localhost/api/production-batches/start', prodStaffToken, 'POST', { production_batch_id: batchIncompleteFlowId });
    expect((await startProductionBatch(startReq)).status).toBe(200);

    const completeReq = makeRequest('http://localhost/api/production-batches/complete', prodStaffToken, 'POST', { production_batch_id: batchIncompleteFlowId });
    const completeResult = await completeProductionBatch(completeReq);
    expect(completeResult.status).toBe(200);

    // Status produksi TETAP berubah jadi completed -- kelengkapan pencatatan
    // BUKAN syarat menyelesaikan batch secara fisik.
    const { data: batch } = await adminClient.from('production_batches').select('status').eq('production_batch_id', batchIncompleteFlowId).single();
    expect(batch!.status).toBe('completed');

    // TAPI dikecualikan dari pembelajaran K8, tercatat sebagai pengecualian (bukan dilewati diam-diam).
    const k8Sample = completeResult.body.k8_sample as { excluded: boolean; missing_routing_step_ids: number[] };
    expect(k8Sample.excluded).toBe(true);
    expect(k8Sample.missing_routing_step_ids).toEqual([stepPackId]);

    const { data: exclusions } = await adminClient.from('production_standard_exclusions').select('*').eq('production_batch_id', batchIncompleteFlowId);
    expect(exclusions).toHaveLength(1);
  });

  it('coba mulai batch yang SUDAH completed -> ditolak trigger (completed bukan sumber transisi valid manapun)', async () => {
    const req = makeRequest('http://localhost/api/production-batches/start', prodStaffToken, 'POST', { production_batch_id: batchCompleteFlowId });
    const result = await startProductionBatch(req);
    expect(result.status).toBe(400);
    expect(String(result.body.error)).toContain('Transisi status');
  });
});

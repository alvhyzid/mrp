import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { recordWorkOrderStepProgress } from '../src/features/mrp/server/recordWorkOrderStepProgress';
import { getBatchYieldSummary } from '../src/features/mrp/server/getBatchYieldSummary';
import { learnFromBatchCore } from '../src/features/mrp/server/learnFromBatchCore';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// Investigasi laporan produksi harian nyata (20 Agu 2026) menemukan 2 gap
// blocker pemakaian harian:
// (a) tanggal progres tahap dipaksa "hari ini" -- padahal pencatatan LINTAS
//     HARI adalah pola NORMAL pabrik (mixing tanggal 11 dicatat tanggal 13).
// (b) tidak ada tempat mencatat REJECT per tahap terpisah dari susut proses.
// Migration 20260820170000 menambahkan record_date (input, bukan kolom baru)
// + qty_reject/reject_reason.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function dateDaysAhead(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('Progres Tahap — tanggal kejadian bisa dipilih (gap a) + reject per tahap (gap b)', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let routingId: number;
  let stepMixId: number;
  let stepPackId: number;
  let workOrderId: number;
  let batchId: number;
  let ppicManagerAuthUid: string;
  let ppicManagerToken: string;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  function makeRequest(body: unknown, token: string): NextRequest {
    return new NextRequest('http://localhost/api/work-order-step-progress', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'StepProgressDateRejectTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant StepProgressDateRejectTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(plantError.message);
    plantId = plant.production_plant_id;

    // AUD-21 (25 Agu 2026): pembuatan pengguna auth SELALU lewat ensureAuthUser.
    // Bentuk hasilnya sengaja dipertahankan supaya kode di bawahnya tidak ikut berubah;
    // `error` selalu null karena ensureAuthUser sudah menangani "sudah terdaftar" sendiri.
    const { data: authUser, error: authUserError } = {
      data: { user: { id: await ensureAuthUser(adminClient, 'ppicmanager.stepprogresstest@debug.mrp', roleTestPassword, { full_name: 'PPIC Manager StepProgressTest' }) } },
      error: null as { message: string } | null
    };
    if (authUserError && !authUserError.message.includes('already been registered')) throw new Error(authUserError.message);
    if (authUser?.user) {
      ppicManagerAuthUid = authUser.user.id;
    } else {
      const { data } = await adminClient.auth.admin.listUsers({ perPage: 100, page: 1 });
      ppicManagerAuthUid = data!.users.find((u: any) => u.email === 'ppicmanager.stepprogresstest@debug.mrp')!.id;
    }
    const { error: appUserError } = await adminClient
      .from('users')
      .upsert([{ auth_uid: ppicManagerAuthUid, company_id: companyId, name: 'PPIC Manager StepProgressTest', email: 'ppicmanager.stepprogresstest@debug.mrp', role: 'ppic_manager', status: 'active' }], { onConflict: 'auth_uid' });
    if (appUserError) throw new Error(appUserError.message);
    ppicManagerToken = await loginToken('ppicmanager.stepprogresstest@debug.mrp');

    const { data: item, error: itemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'STEPDATE-TEST-ITEM', name: 'Item Uji Tanggal Progres', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    if (itemError) throw new Error(itemError.message);
    itemId = item.item_id;

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

    const { data: bom, error: bomError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomError) throw new Error(bomError.message);

    const { data: wo, error: woError } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bom.bom_id, routing_id: routingId, planned_qty: 100, status: 'in_progress' }])
      .select('work_order_id')
      .single();
    if (woError) throw new Error(woError.message);
    workOrderId = wo.work_order_id;

    // Batch dibuat lalu created_at DIMUNDURKAN 15 hari -- supaya ada ruang
    // untuk skenario "backdate wajar tapi >7 hari" tanpa melanggar batas
    // "tidak boleh sebelum batch dibuat".
    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .insert([{ company_id: companyId, work_order_id: workOrderId, batch_number: 'STEPDATE-TEST-BATCH-1', planned_qty: 100, uom: 'pcs', status: 'in_progress' }])
      .select('production_batch_id')
      .single();
    if (batchError) throw new Error(batchError.message);
    batchId = batch.production_batch_id;
    const { error: backdateError } = await adminClient.from('production_batches').update({ created_at: `${dateDaysAgo(15)}T00:00:00Z` }).eq('production_batch_id', batchId);
    if (backdateError) throw new Error(backdateError.message);
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['production_standard_exclusions', () => adminClient.from('production_standard_exclusions').delete().eq('company_id', companyId)],
      ['production_standard_proposals', () => adminClient.from('production_standard_proposals').delete().eq('company_id', companyId)],
      ['production_standard_samples', () => adminClient.from('production_standard_samples').delete().eq('company_id', companyId)],
      ['production_standards', () => adminClient.from('production_standards').delete().eq('company_id', companyId)],
      ['work_order_step_progress', () => adminClient.from('work_order_step_progress').delete().eq('work_order_id', workOrderId)],
      ['work_order_outputs', () => adminClient.from('work_order_outputs').delete().eq('work_order_id', workOrderId)],
      ['production_batches', () => adminClient.from('production_batches').delete().eq('work_order_id', workOrderId)],
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['routing_steps', () => adminClient.from('routing_steps').delete().eq('routing_id', routingId)],
      ['routings', () => adminClient.from('routings').delete().eq('company_id', companyId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:ppic_manager', () => adminClient.auth.admin.deleteUser(ppicManagerAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('tanggal kejadian bisa dipilih mundur (kemarin) — tersimpan, tidak ada peringatan', async () => {
    const req = makeRequest(
      { work_order_id: workOrderId, production_batch_id: batchId, routing_step_id: stepMixId, status: 'in_progress', qty_input: 100, uom_input: 'pcs', record_date: dateDaysAgo(1) },
      ppicManagerToken
    );
    const result = await recordWorkOrderStepProgress(req);
    expect(result.status).toBe(200);
    expect((result.body as any).warning).toBeNull();

    const { data: row } = await adminClient.from('work_order_step_progress').select('started_at').eq('production_batch_id', batchId).eq('routing_step_id', stepMixId).single();
    expect(String(row!.started_at).slice(0, 10)).toBe(dateDaysAgo(1));
  });

  it('(NEGATIF) tanggal kejadian di MASA DEPAN — ditolak', async () => {
    const req = makeRequest({ work_order_id: workOrderId, production_batch_id: batchId, routing_step_id: stepMixId, status: 'in_progress', record_date: dateDaysAhead(1) }, ppicManagerToken);
    const result = await recordWorkOrderStepProgress(req);
    expect(result.status).toBe(400);
    expect((result.body as any).error).toMatch(/masa depan/);
  });

  it('(NEGATIF) tanggal kejadian SEBELUM batch ini dibuat — ditolak', async () => {
    const req = makeRequest({ work_order_id: workOrderId, production_batch_id: batchId, routing_step_id: stepMixId, status: 'in_progress', record_date: dateDaysAgo(20) }, ppicManagerToken);
    const result = await recordWorkOrderStepProgress(req);
    expect(result.status).toBe(400);
    expect((result.body as any).error).toMatch(/sebelum batch ini dibuat/);
  });

  it('tanggal kejadian >7 hari yang lalu (tapi masih setelah batch dibuat) — TETAP tersimpan, cuma peringatan lembut', async () => {
    const req = makeRequest({ work_order_id: workOrderId, production_batch_id: batchId, routing_step_id: stepPackId, status: 'in_progress', record_date: dateDaysAgo(10) }, ppicManagerToken);
    const result = await recordWorkOrderStepProgress(req);
    expect(result.status).toBe(200); // TIDAK ditolak
    expect((result.body as any).warning).toMatch(/10 hari yang lalu/);
  });

  it('(NEGATIF) jumlah reject NEGATIF — ditolak', async () => {
    const req = makeRequest({ work_order_id: workOrderId, production_batch_id: batchId, routing_step_id: stepMixId, status: 'in_progress', qty_reject: -5 }, ppicManagerToken);
    const result = await recordWorkOrderStepProgress(req);
    expect(result.status).toBe(400);
    expect((result.body as any).error).toMatch(/tidak boleh negatif/);
  });

  it('(NEGATIF) jumlah reject LEBIH BESAR dari input tahap ini — ditolak', async () => {
    const req = makeRequest({ work_order_id: workOrderId, production_batch_id: batchId, routing_step_id: stepMixId, status: 'in_progress', qty_input: 50, qty_reject: 60 }, ppicManagerToken);
    const result = await recordWorkOrderStepProgress(req);
    expect(result.status).toBe(400);
    expect((result.body as any).error).toMatch(/lebih besar dari jumlah input/);
  });

  it('(NEGATIF) reject tidak konsisten dengan susut (reject > input-output) — ditolak', async () => {
    // input 100, output baik 95 -> total susut cuma 5, reject 20 tidak masuk akal.
    const req = makeRequest(
      { work_order_id: workOrderId, production_batch_id: batchId, routing_step_id: stepMixId, status: 'completed', qty_input: 100, qty_recorded: 95, qty_reject: 20 },
      ppicManagerToken
    );
    const result = await recordWorkOrderStepProgress(req);
    expect(result.status).toBe(400);
    expect((result.body as any).error).toMatch(/tidak konsisten/);
  });

  it('reject valid (dalam batas susut) — tersimpan, terlihat di Ringkasan Yield Batch dengan porsi dari susut yang benar', async () => {
    // input 100, output baik 90 -> susut 10, reject 8 (masuk akal, <= 10).
    const req = makeRequest(
      {
        work_order_id: workOrderId,
        production_batch_id: batchId,
        routing_step_id: stepPackId,
        status: 'completed',
        qty_input: 100,
        uom_input: 'pcs',
        qty_recorded: 90,
        uom: 'pcs',
        qty_reject: 8,
        reject_reason: 'sachet bocor'
      },
      ppicManagerToken
    );
    const result = await recordWorkOrderStepProgress(req);
    expect(result.status).toBe(200);

    const summaryReq = new NextRequest(`http://localhost/api/production-batches/yield-summary?production_batch_id=${batchId}`, { headers: { Authorization: `Bearer ${ppicManagerToken}` } });
    const summary = await getBatchYieldSummary(summaryReq);
    expect(summary.status).toBe(200);
    const packStep = (summary.body as any).steps.find((s: any) => s.routing_step_id === stepPackId);
    expect(packStep.qty_reject).toBe(8);
    expect(packStep.reject_reason).toBe('sachet bocor');
    expect(packStep.reject_share_of_shrinkage_pct).toBeCloseTo(80, 1); // 8/10 * 100
    expect((summary.body as any).total_reject).toBeGreaterThanOrEqual(8);
  });

  it('K8 (learnFromBatchCore) MEMBUANG sampel durasi tidak masuk akal (start & complete di tanggal backdate berbeda, rentang berhari-hari)', async () => {
    // Buat batch KHUSUS supaya tidak bentrok data progres tahap dari test di atas.
    const { data: batch2, error: batch2Error } = await adminClient
      .from('production_batches')
      .insert([{ company_id: companyId, work_order_id: workOrderId, batch_number: 'STEPDATE-TEST-K8-BATCH', planned_qty: 100, uom: 'pcs', status: 'in_progress' }])
      .select('production_batch_id')
      .single();
    if (batch2Error) throw new Error(batch2Error.message);
    const batch2Id = batch2.production_batch_id;
    await adminClient.from('production_batches').update({ created_at: `${dateDaysAgo(15)}T00:00:00Z` }).eq('production_batch_id', batch2Id);

    // Mixing: mulai backdate 5 hari lalu, selesai backdate 3 hari lalu -- rentang
    // 2 hari (2880 menit) JAUH di atas batas wajar 480 menit -> harus DIBUANG.
    // Tiap langkah setup DICEK statusnya secara eksplisit -- kalau salah satu
    // panggilan ini gagal (mis. hiccup jaringan CI), kegagalannya harus jelas
    // DI SINI, bukan menyamar jadi assertion K8 yang membingungkan di bawah.
    async function recordStepOrThrow(body: Record<string, unknown>, label: string) {
      const result = await recordWorkOrderStepProgress(makeRequest(body, ppicManagerToken));
      if (result.status !== 200) throw new Error(`Setup gagal (${label}): status ${result.status} — ${JSON.stringify(result.body)}`);
    }
    await recordStepOrThrow(
      { work_order_id: workOrderId, production_batch_id: batch2Id, routing_step_id: stepMixId, status: 'in_progress', qty_input: 100, uom_input: 'pcs', record_date: dateDaysAgo(5) },
      'mixing mulai'
    );
    await recordStepOrThrow(
      { work_order_id: workOrderId, production_batch_id: batch2Id, routing_step_id: stepMixId, status: 'completed', qty_input: 100, uom_input: 'pcs', qty_recorded: 98, uom: 'pcs', record_date: dateDaysAgo(3) },
      'mixing selesai'
    );
    // Packing: mulai & selesai SAMA HARI (hari ini) -- durasi wajar, HARUS masuk sampel.
    await recordStepOrThrow({ work_order_id: workOrderId, production_batch_id: batch2Id, routing_step_id: stepPackId, status: 'in_progress', qty_input: 98, uom_input: 'pcs' }, 'packing mulai');
    await recordStepOrThrow(
      { work_order_id: workOrderId, production_batch_id: batch2Id, routing_step_id: stepPackId, status: 'completed', qty_input: 98, uom_input: 'pcs', qty_recorded: 95, uom: 'pcs' },
      'packing selesai'
    );

    const { data: outputInsert, error: outputError } = await adminClient
      .from('work_order_outputs')
      .insert([{ work_order_id: workOrderId, production_batch_id: batch2Id, item_id: itemId, output_type: 'main_output', qty: 95 }]);
    if (outputError) throw new Error(JSON.stringify(outputError));
    void outputInsert;

    const result = await learnFromBatchCore(adminClient, companyId, batch2Id);
    expect(result.status).toBe(200);
    expect((result.body as any).excluded).toBe(false);
    const samples = (result.body as any).samples_submitted as Array<{ metric_key: string; routing_step_id?: number }>;

    const mixDurationSample = samples.find((s) => s.metric_key === 'active_duration_minutes' && s.routing_step_id === stepMixId);
    expect(mixDurationSample).toBeUndefined(); // dibuang, rentang tidak masuk akal

    const packDurationSample = samples.find((s) => s.metric_key === 'active_duration_minutes' && s.routing_step_id === stepPackId);
    expect(packDurationSample).toBeDefined(); // sama hari, tetap diajukan
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getMarginWatch } from '../src/features/mrp/server/getMarginWatch';
import { getPlanningFeasibility } from '../src/features/mrp/server/getPlanningFeasibility';
import { lockMarginBaseline } from '../src/features/mrp/server/lockMarginBaseline';
import { lockFeasibilityBaseline } from '../src/features/mrp/server/lockFeasibilityBaseline';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// Sesi 0C (21 Agu 2026) — pisahkan MEMBACA dari MENGUNCI baseline. Sebelum ini,
// getMarginWatch/getPlanningFeasibility mengunci baseline secara *lazy* pada
// panggilan pertama (desain sengaja, TAPI terbukti bisa dipicu role tanpa
// kewenangan finansial cuma dengan "melihat" -- lihat HANDOFF.md Sesi 0/0B).
// Tes ini membuktikan: (a) membuka panel berkali-kali TIDAK PERNAH menulis;
// (b) mengunci ulang HANYA company_admin + alasan wajib, baseline lama
// diarsipkan (bukan dihapus).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeGetRequest(url: string, token: string): NextRequest {
  return new NextRequest(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
}
function makePostRequest(url: string, token: string, body: unknown): NextRequest {
  return new NextRequest(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

describe('Sesi 0C — pisahkan membaca dari mengunci baseline (Margin Watch + Kelayakan Jadwal)', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let customerId: number;
  let cpoId: number;
  let soId: number;
  let soLineId: number;
  let noStandardItemId: number;
  let noStandardSoLineId: number;
  let financeAuthUid: string;
  let financeToken: string;
  let adminAuthUid: string;
  let adminToken: string;
  let ppicAuthUid: string;
  let ppicToken: string;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'BaselineLockSeparationTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient.from('production_plants').insert([{ company_id: companyId, name: 'Plant BaselineLockTest', is_active: true }]).select('production_plant_id').single();
    plantId = plant!.production_plant_id;

    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'BASELINELOCK-ITEM', name: 'Item BaselineLockTest', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1, standard_cost: 100 }])
      .select('item_id')
      .single();
    itemId = item!.item_id;

    await adminClient.from('production_standards').insert([
      { company_id: companyId, item_id: itemId, metric_key: 'unit_per_batch', value: 10, source: 'ESTIMASI_MANUAL', sample_count: 0 },
      { company_id: companyId, item_id: itemId, metric_key: 'batches_per_day', value: 2, source: 'ESTIMASI_MANUAL', sample_count: 0 }
    ]);

    const { data: customer } = await adminClient.from('customers').insert([{ company_id: companyId, name: 'Customer BaselineLockTest', customer_type: 'company' }]).select('customer_id').single();
    customerId = customer!.customer_id;

    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: cpo } = await adminClient
      .from('customer_purchase_orders')
      .insert([{ company_id: companyId, customer_id: customerId, po_number: 'BASELINELOCK-PO-1', requested_ship_date: futureDate, status: 'processed' }])
      .select('customer_purchase_order_id')
      .single();
    cpoId = cpo!.customer_purchase_order_id;

    const { data: so } = await adminClient
      .from('sales_orders')
      .insert([{ company_id: companyId, customer_purchase_order_id: cpoId, customer_id: customerId, production_plant_id: plantId, status: 'confirmed' }])
      .select('sales_order_id')
      .single();
    soId = so!.sales_order_id;

    const { data: soLine } = await adminClient.from('sales_order_lines').insert([{ sales_order_id: soId, item_id: itemId, qty_ordered: 100, unit_price: 1000 }]).select('sales_order_line_id').single();
    soLineId = soLine!.sales_order_line_id;

    // Item SAUDARA TANPA production_standards -- untuk membuktikan gerbang kelengkapan
    // (Sesi 5, 5.0.3) menutup pintu KUNCI KELAYAKAN JADWAL juga, bukan cuma Margin Watch.
    const { data: noStandardItem } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'BASELINELOCK-NOSTANDARD', name: 'Item BaselineLockTest Tanpa Standar', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1, standard_cost: 100 }])
      .select('item_id')
      .single();
    noStandardItemId = noStandardItem!.item_id;

    const { data: noStandardSoLine } = await adminClient
      .from('sales_order_lines')
      .insert([{ sales_order_id: soId, item_id: noStandardItemId, qty_ordered: 50, unit_price: 1000 }])
      .select('sales_order_line_id')
      .single();
    noStandardSoLineId = noStandardSoLine!.sales_order_line_id;

        financeAuthUid = await ensureAuthUser(adminClient, 'finance.baselinelocktest@debug.mrp', roleTestPassword);
    await adminClient.from('users').insert([{ auth_uid: financeAuthUid, company_id: companyId, name: 'Finance BaselineLockTest', email: 'finance.baselinelocktest@debug.mrp', role: 'finance_manager', status: 'active' }]);
    financeToken = await loginToken('finance.baselinelocktest@debug.mrp');

        adminAuthUid = await ensureAuthUser(adminClient, 'admin.baselinelocktest@debug.mrp', roleTestPassword);
    await adminClient.from('users').insert([{ auth_uid: adminAuthUid, company_id: companyId, name: 'Admin BaselineLockTest', email: 'admin.baselinelocktest@debug.mrp', role: 'company_admin', status: 'active' }]);
    adminToken = await loginToken('admin.baselinelocktest@debug.mrp');

        ppicAuthUid = await ensureAuthUser(adminClient, 'ppic.baselinelocktest@debug.mrp', roleTestPassword);
    await adminClient.from('users').insert([{ auth_uid: ppicAuthUid, company_id: companyId, name: 'PPIC BaselineLockTest', email: 'ppic.baselinelocktest@debug.mrp', role: 'ppic_staff', status: 'active' }]);
    ppicToken = await loginToken('ppic.baselinelocktest@debug.mrp');
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['sales_order_line_margin_snapshots', () => adminClient.from('sales_order_line_margin_snapshots').delete().eq('company_id', companyId)],
      ['sales_order_line_feasibility_snapshots', () => adminClient.from('sales_order_line_feasibility_snapshots').delete().eq('company_id', companyId)],
      ['sales_order_lines', () => adminClient.from('sales_order_lines').delete().eq('sales_order_id', soId)],
      ['sales_orders', () => adminClient.from('sales_orders').delete().eq('company_id', companyId)],
      ['customer_po_approvals', () => adminClient.from('customer_po_approvals').delete().eq('customer_purchase_order_id', cpoId)],
      ['customer_purchase_orders', () => adminClient.from('customer_purchase_orders').delete().eq('company_id', companyId)],
      ['customers', () => adminClient.from('customers').delete().eq('company_id', companyId)],
      ['production_standards', () => adminClient.from('production_standards').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:finance', () => adminClient.auth.admin.deleteUser(financeAuthUid)],
      ['auth:admin', () => adminClient.auth.admin.deleteUser(adminAuthUid)],
      ['auth:ppic', () => adminClient.auth.admin.deleteUser(ppicAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it(
    '(negatif a) membuka Margin Watch & Kelayakan Jadwal 5x berturut-turut TIDAK PERNAH menulis baris apa pun',
    async () => {
    for (let i = 0; i < 5; i++) {
      const marginReq = makeGetRequest(`http://localhost/api/sales-order-lines/${soLineId}/margin-watch`, financeToken);
      const marginResult = await getMarginWatch(marginReq, soLineId);
      expect(marginResult.status).toBe(200);
      expect((marginResult.body as any).locked).toBe(false);

      const feasReq = makeGetRequest(`http://localhost/api/sales-order-lines/${soLineId}/planning-feasibility`, ppicToken);
      const feasResult = await getPlanningFeasibility(feasReq, soLineId);
      expect(feasResult.status).toBe(200);
      expect((feasResult.body as any).locked).toBe(false);
    }
    const { count: marginCount } = await adminClient.from('sales_order_line_margin_snapshots').select('*', { count: 'exact', head: true }).eq('sales_order_line_id', soLineId);
    const { count: feasCount } = await adminClient.from('sales_order_line_feasibility_snapshots').select('*', { count: 'exact', head: true }).eq('sales_order_line_id', soLineId);
    expect(marginCount).toBe(0);
    expect(feasCount).toBe(0);
    },
    60000
  );

  it('(negatif c) ppic_staff (bukan finansial) mencoba mengunci Kelayakan Jadwal langsung ke server -> ditolak 403', async () => {
    const lockReq = makePostRequest('http://localhost/api/sales-order-lines/feasibility-baseline-lock', ppicToken, { sales_order_line_id: soLineId });
    const lockResult = await lockFeasibilityBaseline(lockReq);
    expect(lockResult.status).toBe(403);
    const { count } = await adminClient.from('sales_order_line_feasibility_snapshots').select('*', { count: 'exact', head: true }).eq('sales_order_line_id', soLineId);
    expect(count).toBe(0);
  });

  it('(negatif 5.0.3) finance_manager coba KUNCI Kelayakan Jadwal utk item TANPA production_standards -> ditolak 400, tidak ada baris tersimpan', async () => {
    const lockReq = makePostRequest('http://localhost/api/sales-order-lines/feasibility-baseline-lock', financeToken, { sales_order_line_id: noStandardSoLineId });
    const lockResult = await lockFeasibilityBaseline(lockReq);
    expect(lockResult.status).toBe(400);
    expect((lockResult.body as any).error).toContain('standar unit-per-batch');
    const { count } = await adminClient.from('sales_order_line_feasibility_snapshots').select('*', { count: 'exact', head: true }).eq('sales_order_line_id', noStandardSoLineId);
    expect(count).toBe(0);
  });

  it('(positif) finance_manager mengunci Kelayakan Jadwal PERTAMA kali -> berhasil, tanpa perlu alasan', async () => {
    const lockReq = makePostRequest('http://localhost/api/sales-order-lines/feasibility-baseline-lock', financeToken, { sales_order_line_id: soLineId });
    const lockResult = await lockFeasibilityBaseline(lockReq);
    expect(lockResult.status).toBe(200);
    expect((lockResult.body as any).was_relock).toBe(false);
  });

  it('(Sesi 5, item 3) baseline terkunci menyimpan+menampilkan asal-usul standar (source+sample_count) yang membentuknya', async () => {
    // Fixture (beforeAll) mengunci production_standards dgn source ESTIMASI_MANUAL,
    // sample_count 0 utk item ini -- baseline yang BARU SAJA dikunci di test
    // sebelumnya wajib merekam+menampilkan PERSIS itu, bukan mengarang nilai lain.
    const feasReq = makeGetRequest(`http://localhost/api/sales-order-lines/${soLineId}/planning-feasibility`, ppicToken);
    const feasResult = await getPlanningFeasibility(feasReq, soLineId);
    expect(feasResult.status).toBe(200);
    const body = feasResult.body as any;
    expect(body.locked).toBe(true);
    expect(body.standard_provenance).toEqual({
      unit_per_batch: { source: 'ESTIMASI_MANUAL', sample_count: 0 },
      batches_per_day: { source: 'ESTIMASI_MANUAL', sample_count: 0 }
    });
  });

  it('(negatif d1) finance_manager (BUKAN company_admin) coba KUNCI ULANG -> ditolak', async () => {
    const lockReq = makePostRequest('http://localhost/api/sales-order-lines/feasibility-baseline-lock', financeToken, { sales_order_line_id: soLineId, reason: 'coba relock oleh non-admin' });
    const lockResult = await lockFeasibilityBaseline(lockReq);
    expect(lockResult.status).toBe(403);
  });

  it('(negatif d2) company_admin coba KUNCI ULANG TANPA alasan -> ditolak', async () => {
    const lockReq = makePostRequest('http://localhost/api/sales-order-lines/feasibility-baseline-lock', adminToken, { sales_order_line_id: soLineId });
    const lockResult = await lockFeasibilityBaseline(lockReq);
    expect(lockResult.status).toBe(400);
  });

  it('(positif d3) company_admin KUNCI ULANG DENGAN alasan -> berhasil, baseline lama tetap ada dalam keadaan DIARSIPKAN (bukan dihapus)', async () => {
    const { data: before } = await adminClient.from('sales_order_line_feasibility_snapshots').select('sales_order_line_feasibility_snapshot_id').eq('sales_order_line_id', soLineId).is('archived_at', null).single();
    const oldId = before!.sales_order_line_feasibility_snapshot_id;

    const lockReq = makePostRequest('http://localhost/api/sales-order-lines/feasibility-baseline-lock', adminToken, { sales_order_line_id: soLineId, reason: 'standar direvisi PPIC' });
    const lockResult = await lockFeasibilityBaseline(lockReq);
    expect(lockResult.status).toBe(200);
    expect((lockResult.body as any).was_relock).toBe(true);

    const { data: oldRow } = await adminClient.from('sales_order_line_feasibility_snapshots').select('archived_at, archived_reason').eq('sales_order_line_feasibility_snapshot_id', oldId).single();
    expect(oldRow!.archived_at).not.toBeNull();
    expect(oldRow!.archived_reason).toBe('standar direvisi PPIC');

    const { data: newActive } = await adminClient.from('sales_order_line_feasibility_snapshots').select('*').eq('sales_order_line_id', soLineId).is('archived_at', null).single();
    expect(newActive!.sales_order_line_feasibility_snapshot_id).not.toBe(oldId);
    expect(newActive!.relock_reason).toBe('standar direvisi PPIC');

    // baseline lama TIDAK dihapus -- masih ada 2 baris total utk SO line ini (1 aktif + 1 diarsipkan).
    const { count } = await adminClient.from('sales_order_line_feasibility_snapshots').select('*', { count: 'exact', head: true }).eq('sales_order_line_id', soLineId);
    expect(count).toBe(2);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { explodeBomRequirements } from '../src/features/mrp/server/explodeBomRequirements';
import { getPlanningFeasibility } from '../src/features/mrp/server/getPlanningFeasibility';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// Fase Produksi Nyata — perbaikan model kelayakan SADAR-TAHAP (20 Agu 2026).
// Sebelum ini SEMUA komponen BOM (termasuk kemasan yang baru dipakai di tahap
// AKHIR, mis. Box di "Filling Box") dianggap memblokir MULAINYA produksi --
// ditemukan dari kasus nyata SAS005: box datang 3 Sep otomatis membuat sistem
// bilang "produksi baru bisa mulai 3 Sep", padahal sachet (dipakai tahap awal)
// sudah tersedia dan mixing semestinya bisa jalan dari sekarang. Perbaikan:
// bom_lines.routing_step_id (migration 20260820100000) menandai tahap routing
// item induk yang MULAI memakai komponen itu -- NULL/tidak diklasifikasi tetap
// dianggap tahap pertama (TIDAK ADA REGRESI untuk BOM lama).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('Fase Produksi Nyata — kelayakan sadar-tahap (bom_lines.routing_step_id)', () => {
  let companyId: number;
  let plantId: number;
  let topItemId: number;
  let rawStage1ItemId: number; // bom_line eksplisit tahap 1 (Mixing)
  let rawUnclassifiedItemId: number; // bom_line routing_step_id NULL -- harus tetap dianggap tahap 1 (regresi-guard)
  let pkgLateStageItemId: number; // bom_line eksplisit tahap 3 (Packing), TAHAP AKHIR
  let routingId: number;
  let stepMixId: number;
  let stepFillId: number;
  let stepPackId: number;

  let noRoutingItemId: number; // item TANPA routing sama sekali -- semua bom_line harus fallback ke perilaku lama penuh
  let noRoutingRawItemId: number;

  let ppicManagerAuthUid: string;
  let ppicManagerToken: string;

  let customerId: number;
  let cpoId: number;
  let soId: number;
  let soLineId: number; // pakai topItemId (routing 3 tahap)
  let noRoutingCpoId: number;
  let noRoutingSoId: number;
  let noRoutingSoLineId: number;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  function makeRequest(url: string, token: string): NextRequest {
    return new NextRequest(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  }

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'StageAwareFeasibilityTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant StageAwareTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(plantError.message);
    plantId = plant.production_plant_id;

    const { data: authUser, error: authUserError } = await adminClient.auth.admin.createUser({
      email: 'ppicmanager.stageawaretest@debug.mrp',
      password: roleTestPassword,
      email_confirm: true,
      user_metadata: { full_name: 'PPIC Manager StageAwareTest' }
    });
    if (authUserError && !authUserError.message.includes('already been registered')) throw new Error(authUserError.message);
    if (authUser?.user) {
      ppicManagerAuthUid = authUser.user.id;
    } else {
      let page = 1;
      while (true) {
        const { data } = await adminClient.auth.admin.listUsers({ perPage: 100, page });
        const found = data?.users?.find((u: any) => u.email === 'ppicmanager.stageawaretest@debug.mrp');
        if (found) {
          ppicManagerAuthUid = found.id;
          break;
        }
        if (!(data as any)?.nextPage) break;
        page += 1;
      }
    }
    const { error: appUserError } = await adminClient
      .from('users')
      .upsert([{ auth_uid: ppicManagerAuthUid, company_id: companyId, name: 'PPIC Manager StageAwareTest', email: 'ppicmanager.stageawaretest@debug.mrp', role: 'ppic_manager', status: 'active' }], {
        onConflict: 'auth_uid'
      });
    if (appUserError) throw new Error(appUserError.message);
    ppicManagerToken = await loginToken('ppicmanager.stageawaretest@debug.mrp');

    // --- Item + routing 3 tahap: 1 Mixing, 2 Filling, 3 Packing ---
    const { data: items, error: itemsError } = await adminClient
      .from('items')
      .insert([
        { company_id: companyId, item_code: 'STAGE-TEST-TOP', name: 'Produk Jadi Uji Tahap', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'STAGE-TEST-RAW-S1', name: 'Bahan Tahap 1 (eksplisit)', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'STAGE-TEST-RAW-UNCLASSIFIED', name: 'Bahan Belum Diklasifikasi', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'STAGE-TEST-PKG-LATE', name: 'Kemasan Tahap Akhir', type: 'packaging', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'STAGE-TEST-NOROUTING-TOP', name: 'Produk Jadi Tanpa Routing', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'STAGE-TEST-NOROUTING-RAW', name: 'Bahan Tanpa Routing', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 }
      ])
      .select('item_id, item_code');
    if (itemsError) throw new Error(itemsError.message);
    const findId = (code: string) => items!.find((i) => i.item_code === code)!.item_id;
    topItemId = findId('STAGE-TEST-TOP');
    rawStage1ItemId = findId('STAGE-TEST-RAW-S1');
    rawUnclassifiedItemId = findId('STAGE-TEST-RAW-UNCLASSIFIED');
    pkgLateStageItemId = findId('STAGE-TEST-PKG-LATE');
    noRoutingItemId = findId('STAGE-TEST-NOROUTING-TOP');
    noRoutingRawItemId = findId('STAGE-TEST-NOROUTING-RAW');

    const { data: routing, error: routingError } = await adminClient.from('routings').insert([{ company_id: companyId, item_id: topItemId, version: 1 }]).select('routing_id').single();
    if (routingError) throw new Error(routingError.message);
    routingId = routing.routing_id;

    const { data: steps, error: stepsError } = await adminClient
      .from('routing_steps')
      .insert([
        { routing_id: routingId, sequence_no: 1, step_name: 'Mixing', active_duration_minutes: 60 },
        { routing_id: routingId, sequence_no: 2, step_name: 'Filling', active_duration_minutes: 60 },
        { routing_id: routingId, sequence_no: 3, step_name: 'Packing', active_duration_minutes: 60 }
      ])
      .select('routing_step_id, sequence_no');
    if (stepsError) throw new Error(stepsError.message);
    stepMixId = steps!.find((s) => s.sequence_no === 1)!.routing_step_id;
    stepFillId = steps!.find((s) => s.sequence_no === 2)!.routing_step_id;
    stepPackId = steps!.find((s) => s.sequence_no === 3)!.routing_step_id;

    const { data: bom, error: bomError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: topItemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomError) throw new Error(bomError.message);

    const { error: bomLinesError } = await adminClient.from('bom_lines').insert([
      { bom_id: bom.bom_id, component_item_id: rawStage1ItemId, qty_per_unit_output: 1, uom: 'g', routing_step_id: stepMixId },
      { bom_id: bom.bom_id, component_item_id: rawUnclassifiedItemId, qty_per_unit_output: 1, uom: 'g', routing_step_id: null },
      { bom_id: bom.bom_id, component_item_id: pkgLateStageItemId, qty_per_unit_output: 1, uom: 'pcs', routing_step_id: stepPackId }
    ]);
    if (bomLinesError) throw new Error(bomLinesError.message);

    // Semua 3 bahan STOK 0 -- semuanya "kurang" -- yang membedakan hasilnya
    // murni tahap yang ditandai di bom_lines, bukan jumlah stok.
    // (tidak ada lots sama sekali == available 0 untuk ketiganya)

    const { error: standardsError } = await adminClient.from('production_standards').insert([
      { company_id: companyId, item_id: topItemId, metric_key: 'unit_per_batch', value: 10, source: 'ESTIMASI_MANUAL', sample_count: 0 },
      { company_id: companyId, item_id: topItemId, metric_key: 'batches_per_day', value: 1, source: 'ESTIMASI_MANUAL', sample_count: 0 }
    ]);
    if (standardsError) throw new Error(standardsError.message);

    const { data: customer, error: customerError } = await adminClient.from('customers').insert([{ company_id: companyId, name: 'Customer StageAwareTest' }]).select('customer_id').single();
    if (customerError) throw new Error(customerError.message);
    customerId = customer.customer_id;

    const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: cpo, error: cpoError } = await adminClient
      .from('customer_purchase_orders')
      .insert([{ company_id: companyId, customer_id: customerId, po_number: 'STAGETEST-PO-1', requested_ship_date: futureDate, status: 'processed' }])
      .select('customer_purchase_order_id')
      .single();
    if (cpoError) throw new Error(cpoError.message);
    cpoId = cpo.customer_purchase_order_id;

    const { data: so, error: soError } = await adminClient
      .from('sales_orders')
      .insert([{ company_id: companyId, customer_purchase_order_id: cpoId, customer_id: customerId, production_plant_id: plantId, status: 'confirmed' }])
      .select('sales_order_id')
      .single();
    if (soError) throw new Error(soError.message);
    soId = so.sales_order_id;

    const { data: soLine, error: soLineError } = await adminClient
      .from('sales_order_lines')
      .insert([{ sales_order_id: soId, item_id: topItemId, qty_ordered: 10, unit_price: 1000 }])
      .select('sales_order_line_id')
      .single();
    if (soLineError) throw new Error(soLineError.message);
    soLineId = soLine.sales_order_line_id;

    // PO supplier yang belum diterima untuk MASING-MASING bahan yang kurang --
    // ETA sengaja beda-beda (dan makin jauh dari hari ini) supaya gampang
    // dibedakan mana yang memblokir MULAI (tahap 1) vs cuma memblokir SELESAI
    // (tahap 3, akhir).
    const etaStage1 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const etaUnclassified = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const etaLateStage = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: supplier, error: supplierError } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier StageAwareTest', supplier_type: 'material_supplier' }]).select('supplier_id').single();
    if (supplierError) throw new Error(supplierError.message);

    const { data: pos, error: posError } = await adminClient
      .from('purchase_orders')
      .insert([
        { company_id: companyId, supplier_id: supplier.supplier_id, production_plant_id: plantId, status: 'ordered', expected_date: etaStage1 },
        { company_id: companyId, supplier_id: supplier.supplier_id, production_plant_id: plantId, status: 'ordered', expected_date: etaUnclassified },
        { company_id: companyId, supplier_id: supplier.supplier_id, production_plant_id: plantId, status: 'ordered', expected_date: etaLateStage }
      ])
      .select('purchase_order_id');
    if (posError) throw new Error(posError.message);

    const { error: poLinesError } = await adminClient.from('purchase_order_lines').insert([
      { purchase_order_id: pos![0].purchase_order_id, item_id: rawStage1ItemId, qty_ordered: 1000, qty_received: 0, unit_price: 10 },
      { purchase_order_id: pos![1].purchase_order_id, item_id: rawUnclassifiedItemId, qty_ordered: 1000, qty_received: 0, unit_price: 10 },
      { purchase_order_id: pos![2].purchase_order_id, item_id: pkgLateStageItemId, qty_ordered: 1000, qty_received: 0, unit_price: 10 }
    ]);
    if (poLinesError) throw new Error(poLinesError.message);

    // --- Fixture kedua: item TANPA routing sama sekali (regresi-guard) ---
    const { data: noRoutingBom, error: noRoutingBomError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: noRoutingItemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (noRoutingBomError) throw new Error(noRoutingBomError.message);
    const { error: noRoutingLinesError } = await adminClient.from('bom_lines').insert([{ bom_id: noRoutingBom.bom_id, component_item_id: noRoutingRawItemId, qty_per_unit_output: 1, uom: 'g', routing_step_id: null }]);
    if (noRoutingLinesError) throw new Error(noRoutingLinesError.message);

    const { error: noRoutingStandardsError } = await adminClient.from('production_standards').insert([
      { company_id: companyId, item_id: noRoutingItemId, metric_key: 'unit_per_batch', value: 10, source: 'ESTIMASI_MANUAL', sample_count: 0 },
      { company_id: companyId, item_id: noRoutingItemId, metric_key: 'batches_per_day', value: 1, source: 'ESTIMASI_MANUAL', sample_count: 0 }
    ]);
    if (noRoutingStandardsError) throw new Error(noRoutingStandardsError.message);

    const { data: noRoutingCpo, error: noRoutingCpoError } = await adminClient
      .from('customer_purchase_orders')
      .insert([{ company_id: companyId, customer_id: customerId, po_number: 'STAGETEST-PO-NOROUTING', requested_ship_date: futureDate, status: 'processed' }])
      .select('customer_purchase_order_id')
      .single();
    if (noRoutingCpoError) throw new Error(noRoutingCpoError.message);
    noRoutingCpoId = noRoutingCpo.customer_purchase_order_id;

    const { data: noRoutingSo, error: noRoutingSoError } = await adminClient
      .from('sales_orders')
      .insert([{ company_id: companyId, customer_purchase_order_id: noRoutingCpoId, customer_id: customerId, production_plant_id: plantId, status: 'confirmed' }])
      .select('sales_order_id')
      .single();
    if (noRoutingSoError) throw new Error(noRoutingSoError.message);
    noRoutingSoId = noRoutingSo.sales_order_id;

    const { data: noRoutingSoLine, error: noRoutingSoLineError } = await adminClient
      .from('sales_order_lines')
      .insert([{ sales_order_id: noRoutingSoId, item_id: noRoutingItemId, qty_ordered: 10, unit_price: 1000 }])
      .select('sales_order_line_id')
      .single();
    if (noRoutingSoLineError) throw new Error(noRoutingSoLineError.message);
    noRoutingSoLineId = noRoutingSoLine.sales_order_line_id;

    const { data: noRoutingPo, error: noRoutingPoError } = await adminClient
      .from('purchase_orders')
      .insert([{ company_id: companyId, supplier_id: supplier.supplier_id, production_plant_id: plantId, status: 'ordered', expected_date: etaStage1 }])
      .select('purchase_order_id')
      .single();
    if (noRoutingPoError) throw new Error(noRoutingPoError.message);
    const { error: noRoutingPoLineError } = await adminClient.from('purchase_order_lines').insert([{ purchase_order_id: noRoutingPo.purchase_order_id, item_id: noRoutingRawItemId, qty_ordered: 1000, qty_received: 0, unit_price: 10 }]);
    if (noRoutingPoLineError) throw new Error(noRoutingPoLineError.message);
  });

  afterAll(async () => {
    const { data: boms } = await adminClient.from('boms').select('bom_id').eq('company_id', companyId);
    const bomIds = (boms ?? []).map((b) => b.bom_id);
    const { data: pos } = await adminClient.from('purchase_orders').select('purchase_order_id').eq('company_id', companyId);
    const poIds = (pos ?? []).map((p) => p.purchase_order_id);
    const cleanupSteps: Array<[string, () => any]> = [
      ['sales_order_line_feasibility_snapshots', () => adminClient.from('sales_order_line_feasibility_snapshots').delete().eq('company_id', companyId)],
      ['sales_order_lines', () => adminClient.from('sales_order_lines').delete().in('sales_order_id', [soId, noRoutingSoId])],
      ['sales_orders', () => adminClient.from('sales_orders').delete().eq('company_id', companyId)],
      ['customer_po_approvals', () => adminClient.from('customer_po_approvals').delete().in('customer_purchase_order_id', [cpoId, noRoutingCpoId])],
      ['customer_purchase_orders', () => adminClient.from('customer_purchase_orders').delete().eq('company_id', companyId)],
      ['customers', () => adminClient.from('customers').delete().eq('company_id', companyId)],
      ['purchase_order_lines', () => adminClient.from('purchase_order_lines').delete().in('purchase_order_id', poIds.length ? poIds : [-1])],
      ['purchase_orders', () => adminClient.from('purchase_orders').delete().eq('company_id', companyId)],
      ['suppliers', () => adminClient.from('suppliers').delete().eq('company_id', companyId)],
      ['production_standards', () => adminClient.from('production_standards').delete().eq('company_id', companyId)],
      ['bom_lines', () => adminClient.from('bom_lines').delete().in('bom_id', bomIds.length ? bomIds : [-1])],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['routing_steps', () => adminClient.from('routing_steps').delete().eq('routing_id', routingId)],
      ['routings', () => adminClient.from('routings').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:ppic_manager', () => adminClient.auth.admin.deleteUser(ppicManagerAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('explodeBomRequirements menandai blocking_stage sesuai routing_step_id bom_line (NULL = tahap pertama)', async () => {
    const { shortages, firstStageSequenceNo } = await explodeBomRequirements(adminClient, companyId, topItemId, 10);
    expect(firstStageSequenceNo).toBe(1);

    const rawS1 = shortages.find((s) => s.item_id === rawStage1ItemId);
    expect(rawS1?.blocking_stage?.sequence_no).toBe(1);

    const rawUnclassified = shortages.find((s) => s.item_id === rawUnclassifiedItemId);
    expect(rawUnclassified?.blocking_stage).toBeNull(); // belum diklasifikasi -- TAPI diperlakukan sama seperti tahap 1 di getPlanningFeasibility

    const pkgLate = shortages.find((s) => s.item_id === pkgLateStageItemId);
    expect(pkgLate?.blocking_stage?.sequence_no).toBe(3);
    expect(pkgLate?.blocking_stage?.step_name).toBe('Packing');
  });

  it('(NEGATIF/inti perbaikan) bahan tahap AKHIR yang kurang TIDAK memblokir mulainya produksi, hanya bahan tahap pertama yang memblokir', async () => {
    const req = makeRequest(`http://localhost/api/sales-order-lines/${soLineId}/planning-feasibility`, ppicManagerToken);
    const result = await getPlanningFeasibility(req, soLineId);
    expect(result.status).toBe(200);
    const body = result.body as any;

    expect(body.routing_available).toBe(true);
    // production_start_blocked_until HARUS ambil ETA bahan tahap-1 (RAW-S1 atau
    // UNCLASSIFIED, mana yang PALING LAMBAT) -- BUKAN ETA kemasan tahap-akhir
    // (yang ETA-nya sengaja dibuat PALING LAMBAT di antara ketiganya, 20 hari).
    // Kalau bug lama masih ada, tanggal ini akan ikut ETA kemasan tahap-akhir.
    expect(body.production_start_blocked_until).not.toBeNull();
    expect(body.production_start_blocked_until < body.order_ship_ready_date).toBe(true);

    // Kemasan tahap akhir HARUS muncul di late_stage_material_blocks, BUKAN
    // dianggap memblokir mulai.
    const lateBlock = body.late_stage_material_blocks.find((b: any) => b.item_id === pkgLateStageItemId);
    expect(lateBlock).toBeDefined();
    expect(lateBlock.blocking_stage.step_name).toBe('Packing');

    // order_ship_ready_date harus ikut memperhitungkan ETA kemasan tahap akhir
    // itu (mundur ke tanggal SELESAI, bukan tanggal MULAI).
    expect(body.order_ship_ready_date >= lateBlock.expected_date).toBe(true);
  });

  it('(NEGATIF/regresi-guard) item TANPA routing sama sekali tetap berperilaku seperti model lama — SEMUA bahan kurang dianggap memblokir mulai produksi', async () => {
    const req = makeRequest(`http://localhost/api/sales-order-lines/${noRoutingSoLineId}/planning-feasibility`, ppicManagerToken);
    const result = await getPlanningFeasibility(req, noRoutingSoLineId);
    expect(result.status).toBe(200);
    const body = result.body as any;

    expect(body.routing_available).toBe(false);
    // Item tanpa routing: satu-satunya bahan kurang HARUS memblokir mulai
    // (production_start_blocked_until terisi dari PO-nya), TIDAK ADA
    // late_stage_material_blocks sama sekali.
    expect(body.production_start_blocked_until).not.toBeNull();
    expect(body.late_stage_material_blocks).toHaveLength(0);
  });
});

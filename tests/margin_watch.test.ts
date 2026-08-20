import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getMarginWatch } from '../src/features/mrp/server/getMarginWatch';
import { updateMarginFloorThreshold } from '../src/features/mrp/server/updateMarginFloorThreshold';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// Margin Watch Lapis 1 (baseline margin per order, dikunci sekali) + Lapis 2
// (pembongkaran selisih margin AKTUAL jadi 5 kategori). PRINSIP UTAMA yang
// diuji di sini: setiap angka WAJIB dari data nyata -- kategori tanpa data
// HARUS tampil "belum bisa dihitung", TIDAK PERNAH diam-diam jadi 0/angka
// karangan yang terlihat seperti hasil hitungan sungguhan.
//
// Skenario acuan (ACCEPTANCE TEST dari kasus nyata pemilik produk): harga
// master Box Rp1.500, PO supplier sungguhan Rp2.925 (belum diterima) -> harus
// terdeteksi sebagai selisih HARGA Rp1.425/unit x qty pesanan, TANPA
// menunggu barang diterima/dikonsumsi.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('Margin Watch — baseline (Lapis 1) + selisih 5 kategori (Lapis 2)', () => {
  let companyId: number;
  let plantId: number;
  let topItemId: number;
  let boxItemId: number; // leaf dgn harga master vs PO beda (skenario acuan)
  let noCostItemId: number; // leaf TANPA standard_cost (uji "belum bisa dihitung")
  let customerId: number;
  let cpoId: number;
  let soId: number;
  let soLineId: number;
  let financeManagerAuthUid: string;
  let financeManagerToken: string;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  function makeGetRequest(url: string, token: string): NextRequest {
    return new NextRequest(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  }
  function makePatchRequest(url: string, token: string, body: unknown): NextRequest {
    return new NextRequest(url, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'MarginWatchTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant MarginWatchTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(plantError.message);
    plantId = plant.production_plant_id;

    const { data: authUser, error: authUserError } = await adminClient.auth.admin.createUser({
      email: 'financemanager.marginwatchtest@debug.mrp',
      password: roleTestPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Finance Manager MarginWatchTest' }
    });
    if (authUserError && !authUserError.message.includes('already been registered')) throw new Error(authUserError.message);
    if (authUser?.user) {
      financeManagerAuthUid = authUser.user.id;
    } else {
      const { data } = await adminClient.auth.admin.listUsers({ perPage: 100, page: 1 });
      financeManagerAuthUid = data!.users.find((u: any) => u.email === 'financemanager.marginwatchtest@debug.mrp')!.id;
    }
    const { error: appUserError } = await adminClient
      .from('users')
      .upsert([{ auth_uid: financeManagerAuthUid, company_id: companyId, name: 'Finance Manager MarginWatchTest', email: 'financemanager.marginwatchtest@debug.mrp', role: 'finance_manager', status: 'active' }], {
        onConflict: 'auth_uid'
      });
    if (appUserError) throw new Error(appUserError.message);
    financeManagerToken = await loginToken('financemanager.marginwatchtest@debug.mrp');

    const { data: items, error: itemsError } = await adminClient
      .from('items')
      .insert([
        { company_id: companyId, item_code: 'MARGINWATCH-TOP', name: 'Produk Uji Margin Watch', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'MARGINWATCH-BOX', name: 'Box Uji (skenario acuan)', type: 'packaging', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1, standard_cost: 1500 },
        { company_id: companyId, item_code: 'MARGINWATCH-NOCOST', name: 'Bahan Tanpa Harga Master', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 }
      ])
      .select('item_id, item_code');
    if (itemsError) throw new Error(itemsError.message);
    topItemId = items!.find((i) => i.item_code === 'MARGINWATCH-TOP')!.item_id;
    boxItemId = items!.find((i) => i.item_code === 'MARGINWATCH-BOX')!.item_id;
    noCostItemId = items!.find((i) => i.item_code === 'MARGINWATCH-NOCOST')!.item_id;

    const { data: bom, error: bomError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: topItemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomError) throw new Error(bomError.message);
    const { error: bomLinesError } = await adminClient.from('bom_lines').insert([
      { bom_id: bom.bom_id, component_item_id: boxItemId, qty_per_unit_output: 1, uom: 'pcs' },
      { bom_id: bom.bom_id, component_item_id: noCostItemId, qty_per_unit_output: 1, uom: 'g' }
    ]);
    if (bomLinesError) throw new Error(bomLinesError.message);

    const { data: customer, error: customerError } = await adminClient.from('customers').insert([{ company_id: companyId, name: 'Customer MarginWatchTest' }]).select('customer_id').single();
    if (customerError) throw new Error(customerError.message);
    customerId = customer.customer_id;

    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: cpo, error: cpoError } = await adminClient
      .from('customer_purchase_orders')
      .insert([{ company_id: companyId, customer_id: customerId, po_number: 'MARGINWATCH-PO-1', requested_ship_date: futureDate, status: 'processed' }])
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

    // unit_price 5000, standard_cost box 1500 + bahan-tanpa-harga (dianggap 0
    // di baseline aggregate, TAPI ditandai cost_data_complete=false) -> margin
    // baseline HANYA dari box (materialCost bahan-tanpa-harga tidak masuk
    // penjumlahan sama sekali, konsisten dgn "jangan mengarang").
    const { data: soLine, error: soLineError } = await adminClient
      .from('sales_order_lines')
      .insert([{ sales_order_id: soId, item_id: topItemId, qty_ordered: 10000, unit_price: 5000 }])
      .select('sales_order_line_id')
      .single();
    if (soLineError) throw new Error(soLineError.message);
    soLineId = soLine.sales_order_line_id;

    // PO supplier BELUM DITERIMA utk Box, harga Rp2.925 -- persis skenario
    // acuan pemilik produk (Rp1.500 master vs Rp2.925 PO x 10.000 = Rp14,25jt).
    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .insert([{ company_id: companyId, name: 'Supplier MarginWatchTest', supplier_type: 'material_supplier' }])
      .select('supplier_id')
      .single();
    if (supplierError) throw new Error(supplierError.message);
    const { data: po, error: poError } = await adminClient
      .from('purchase_orders')
      .insert([{ company_id: companyId, supplier_id: supplier.supplier_id, production_plant_id: plantId, status: 'ordered', expected_date: futureDate }])
      .select('purchase_order_id')
      .single();
    if (poError) throw new Error(poError.message);
    const { error: poLineError } = await adminClient.from('purchase_order_lines').insert([{ purchase_order_id: po.purchase_order_id, item_id: boxItemId, qty_ordered: 10000, qty_received: 0, unit_price: 2925 }]);
    if (poLineError) throw new Error(poLineError.message);
  });

  afterAll(async () => {
    const { data: boms } = await adminClient.from('boms').select('bom_id').eq('company_id', companyId);
    const bomIds = (boms ?? []).map((b) => b.bom_id);
    const { data: pos } = await adminClient.from('purchase_orders').select('purchase_order_id').eq('company_id', companyId);
    const poIds = (pos ?? []).map((p) => p.purchase_order_id);
    const cleanupSteps: Array<[string, () => any]> = [
      ['sales_order_line_margin_snapshots', () => adminClient.from('sales_order_line_margin_snapshots').delete().eq('company_id', companyId)],
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['sales_order_lines', () => adminClient.from('sales_order_lines').delete().eq('sales_order_id', soId)],
      ['sales_orders', () => adminClient.from('sales_orders').delete().eq('company_id', companyId)],
      ['customer_po_approvals', () => adminClient.from('customer_po_approvals').delete().eq('customer_purchase_order_id', cpoId)],
      ['customer_purchase_orders', () => adminClient.from('customer_purchase_orders').delete().eq('company_id', companyId)],
      ['customers', () => adminClient.from('customers').delete().eq('company_id', companyId)],
      ['purchase_order_lines', () => adminClient.from('purchase_order_lines').delete().in('purchase_order_id', poIds.length ? poIds : [-1])],
      ['purchase_orders', () => adminClient.from('purchase_orders').delete().eq('company_id', companyId)],
      ['suppliers', () => adminClient.from('suppliers').delete().eq('company_id', companyId)],
      ['lots', () => adminClient.from('lots').delete().eq('company_id', companyId)],
      ['work_order_consumption', () => adminClient.from('work_order_consumption').delete().eq('work_order_id', -1)],
      ['work_order_outputs', () => adminClient.from('work_order_outputs').delete().eq('work_order_id', -1)],
      ['bom_lines', () => adminClient.from('bom_lines').delete().in('bom_id', bomIds.length ? bomIds : [-1])],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:finance_manager', () => adminClient.auth.admin.deleteUser(financeManagerAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('Lapis 1 — baseline dikunci, ditandai TIDAK LENGKAP karena 1 bahan belum punya harga master (bukan diam-diam dianggap 0)', async () => {
    const req = makeGetRequest(`http://localhost/api/sales-order-lines/${soLineId}/margin-watch`, financeManagerToken);
    const result = await getMarginWatch(req, soLineId);
    expect(result.status).toBe(200);
    const body = result.body as any;

    expect(body.cost_data_complete).toBe(false);
    expect(body.missing_cost_item_codes).toContain('MARGINWATCH-NOCOST');
    // Box bertipe "packaging" -> masuk standard_packaging_cost_per_unit (bukan
    // material) sesuai bucket per items.type; bahan-tanpa-harga TIDAK ikut
    // dijumlah ke mana pun (bukan diam-diam dianggap 0).
    expect(body.standard_packaging_cost_per_unit).toBeCloseTo(1500, 2);
    expect(body.standard_material_cost_per_unit).toBeCloseTo(0, 2);
    // Rincian PER KOMPONEN (27 Agu 2026, Bagian D MLVT) -- bukan cuma total lump-sum.
    expect(body.packaging_breakdown).toHaveLength(1);
    expect(body.packaging_breakdown[0].item_code).toBe('MARGINWATCH-BOX');
    expect(body.packaging_breakdown[0].qty_per_unit_output).toBeCloseTo(1, 4);
    expect(body.packaging_breakdown[0].unit_cost).toBeCloseTo(1500, 2);
    expect(body.packaging_breakdown[0].cost_per_unit_output).toBeCloseTo(1500, 2);
    // Fixture tidak punya routing/kru standar utk item ini -> SDM standar
    // tetap dihitung (sebagai 0, bukan null) TAPI ditandai labor_cost_complete
    // false dengan catatan eksplisit kenapa (pola sama dgn cost_data_complete).
    expect(body.standard_labor_cost_per_unit).toBeCloseTo(0, 2);
    expect(body.labor_cost_complete).toBe(false);
    expect(Array.isArray(body.labor_cost_notes)).toBe(true);
    expect(body.labor_cost_notes.length).toBeGreaterThan(0);
  });

  it('(INTI/ACCEPTANCE TEST) Selisih HARGA terdeteksi dari PO belum diterima (Rp1.500 master vs Rp2.925 PO x 10.000 = Rp14,25 juta), TANPA menunggu barang diterima', async () => {
    const req = makeGetRequest(`http://localhost/api/sales-order-lines/${soLineId}/margin-watch`, financeManagerToken);
    const result = await getMarginWatch(req, soLineId);
    const body = result.body as any;

    const priceCategory = body.categories.find((c: any) => c.category === 'harga_bahan');
    expect(priceCategory).toBeDefined();
    expect(priceCategory.total_impact).toBeCloseTo(-14250000, 0); // (2925-1500) x 10000, negatif = pengurang margin
    const boxLine = priceCategory.items.find((i: any) => i.item_code === 'MARGINWATCH-BOX');
    expect(boxLine).toBeDefined();
    expect(boxLine.impact).toBeCloseTo(-14250000, 0);
  });

  it('(NEGATIF) order TANPA data aktual sama sekali (belum ada konsumsi/output/reject) — kategori pemakaian/reject/SDM tampil "belum bisa dihitung", BUKAN angka 0 yang terlihat seperti hasil hitungan', async () => {
    const req = makeGetRequest(`http://localhost/api/sales-order-lines/${soLineId}/margin-watch`, financeManagerToken);
    const result = await getMarginWatch(req, soLineId);
    const body = result.body as any;

    const usageCategory = body.categories.find((c: any) => c.category === 'pemakaian_bahan');
    expect(usageCategory.complete).toBe(true); // "complete" secara teknis, tapi alasannya eksplisit
    expect(usageCategory.incomplete_reason).toMatch(/Belum ada Work Order/);
    expect(usageCategory.items).toHaveLength(0);

    const rejectCategory = body.categories.find((c: any) => c.category === 'reject');
    expect(rejectCategory.incomplete_reason).toMatch(/Belum ada Work Order/);

    const laborCategory = body.categories.find((c: any) => c.category === 'sdm');
    expect(laborCategory.complete).toBe(false);
    expect(laborCategory.incomplete_reason).toMatch(/Belum ada Work Order/);
  });

  it('(NEGATIF) proyeksi ditandai TIDAK LENGKAP (projection_complete=false) selama ada kategori yang belum bisa dihitung penuh — tidak menyembunyikan ketidaklengkapan di balik 1 angka akhir', async () => {
    const req = makeGetRequest(`http://localhost/api/sales-order-lines/${soLineId}/margin-watch`, financeManagerToken);
    const result = await getMarginWatch(req, soLineId);
    const body = result.body as any;
    expect(body.projection_complete).toBe(false);
  });

  it('ambang margin: BOLEH diubah kapan saja (beda dari baseline yang terkunci) dan memicu peringatan department finance+management saat proyeksi di bawah ambang', async () => {
    // proyeksi saat ini = standard_margin_total (5000-1500)*10000=35jt + variance harga (-14,25jt) = 20,75jt.
    // Set ambang di ATAS itu -> harus memicu alert.
    const patchReq = makePatchRequest('http://localhost/api/sales-order-lines/margin-watch-threshold', financeManagerToken, { sales_order_line_id: soLineId, margin_floor_threshold: 25000000 });
    const patchResult = await updateMarginFloorThreshold(patchReq);
    expect(patchResult.status).toBe(200);

    const req = makeGetRequest(`http://localhost/api/sales-order-lines/${soLineId}/margin-watch`, financeManagerToken);
    const result = await getMarginWatch(req, soLineId);
    const body = result.body as any;
    expect(body.projected_margin_total).toBeLessThan(25000000);

    const { data: alerts } = await adminClient.from('system_alerts').select('target_department, status').eq('company_id', companyId).eq('alert_type', 'margin_threshold_breach').eq('status', 'open');
    const departments = (alerts ?? []).map((a) => a.target_department).sort();
    expect(departments).toEqual(['finance', 'management']);
  });

  it('(NEGATIF) menaikkan ambang di BAWAH proyeksi menyelesaikan (resolve) peringatan yang tadinya terbuka', async () => {
    const patchReq = makePatchRequest('http://localhost/api/sales-order-lines/margin-watch-threshold', financeManagerToken, { sales_order_line_id: soLineId, margin_floor_threshold: 0 });
    await updateMarginFloorThreshold(patchReq);

    const req = makeGetRequest(`http://localhost/api/sales-order-lines/${soLineId}/margin-watch`, financeManagerToken);
    await getMarginWatch(req, soLineId);

    const { data: alerts } = await adminClient.from('system_alerts').select('status').eq('company_id', companyId).eq('alert_type', 'margin_threshold_breach');
    expect((alerts ?? []).every((a) => a.status === 'resolved')).toBe(true);
  });

  it('(NEGATIF) role di luar akses finansial ditolak 403', async () => {
    const { data: authUser } = await adminClient.auth.admin.createUser({
      email: 'ppicstaff.marginwatchtest@debug.mrp',
      password: roleTestPassword,
      email_confirm: true
    });
    const uid = authUser!.user!.id;
    await adminClient.from('users').upsert([{ auth_uid: uid, company_id: companyId, name: 'PPIC Staff MarginWatchTest', email: 'ppicstaff.marginwatchtest@debug.mrp', role: 'ppic_staff', status: 'active' }], { onConflict: 'auth_uid' });
    const token = await loginToken('ppicstaff.marginwatchtest@debug.mrp');

    const req = makeGetRequest(`http://localhost/api/sales-order-lines/${soLineId}/margin-watch`, token);
    const result = await getMarginWatch(req, soLineId);
    expect(result.status).toBe(403);

    await adminClient.from('users').delete().eq('auth_uid', uid);
    await adminClient.auth.admin.deleteUser(uid);
  });
});

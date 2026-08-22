import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPurchaseOrder } from '../src/features/mrp/server/createPurchaseOrder';
import { createGoodsReceipt } from '../src/features/mrp/server/createGoodsReceipt';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// BAGIAN 3 (22 Agu 2026) — Fondasi PO Supplier (lapisan data & server saja).
// Arkeologi SEBELUM menulis test ini menemukan alur ini SUDAH LENGKAP sejak
// awal (goods_receipts/goods_receipt_lines + trigger process_goods_receipt_line,
// migrasi 20260812154500): konversi UOM, lot dari harga TRANSAKSI PO (bukan
// harga acuan supplier), sisa PO per baris -- semua SUDAH bekerja. Test ini
// MEMBUKTIKAN ULANG rantai itu (pola sama seperti PMB-07b), BUKAN membangun
// dari nol. 1 celah nyata ditemukan+ditambal: createPurchaseOrder.ts tidak
// menolak supplier yang sudah diarsipkan (sekarang ditolak). 1 pertanyaan
// terbuka TIDAK dijawab sendiri (over-receipt) -- dilaporkan ke pemilik
// produk, bukan diputuskan di sini.

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

describe('BAGIAN 3 — Fondasi PO Supplier: Penerimaan Barang & Harga Lot', () => {
  let companyId: number;
  let plantId: number;
  let adminAuthUid: string;
  let adminToken: string;

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'Bagian3PoSupplierTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient.from('production_plants').insert([{ company_id: companyId, name: 'Plant Bagian3', is_active: true }]).select('production_plant_id').single();
    plantId = plant!.production_plant_id;

    const adminUser = await adminClient.auth.admin.createUser({ email: 'admin.bagian3test@debug.mrp', password: roleTestPassword, email_confirm: true });
    adminAuthUid = adminUser.data.user!.id;
    await adminClient.from('users').insert([{ auth_uid: adminAuthUid, company_id: companyId, name: 'Admin Bagian3Test', email: 'admin.bagian3test@debug.mrp', role: 'company_admin', status: 'active' }]);
    adminToken = await loginAs('admin.bagian3test@debug.mrp');
  });

  afterAll(async () => {
    const { data: poRows } = await adminClient.from('purchase_orders').select('purchase_order_id').eq('company_id', companyId);
    const poIds = (poRows ?? []).map((p) => p.purchase_order_id);
    const { data: grRows } = poIds.length ? await adminClient.from('goods_receipts').select('goods_receipt_id').in('purchase_order_id', poIds) : { data: [] };
    const grIds = (grRows ?? []).map((g) => g.goods_receipt_id);

    const steps: Array<[string, () => any]> = [
      ['goods_receipt_overage_log', () => adminClient.from('goods_receipt_overage_log').delete().eq('company_id', companyId)],
      ['goods_receipt_lines', () => (grIds.length ? adminClient.from('goods_receipt_lines').delete().in('goods_receipt_id', grIds) : Promise.resolve({ error: null }))],
      ['goods_receipts', () => (poIds.length ? adminClient.from('goods_receipts').delete().in('purchase_order_id', poIds) : Promise.resolve({ error: null }))],
      ['stock_movements', () => adminClient.from('stock_movements').delete().eq('company_id', companyId)],
      ['lots', () => adminClient.from('lots').delete().eq('company_id', companyId)],
      ['purchase_order_lines', () => (poIds.length ? adminClient.from('purchase_order_lines').delete().in('purchase_order_id', poIds) : Promise.resolve({ error: null }))],
      ['purchase_orders', () => adminClient.from('purchase_orders').delete().eq('company_id', companyId)],
      ['supplier_item_prices', () => adminClient.from('supplier_item_prices').delete().eq('company_id', companyId)],
      ['suppliers', () => adminClient.from('suppliers').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:admin', () => adminClient.auth.admin.deleteUser(adminAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, steps);
  });

  it('(a) terbitkan PO 100kg, terima 95kg -> lot lahir 95kg, sisa PO 5kg', async () => {
    const { data: supplier } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier Bagian3-A', address: 'Alamat', npwp: '00.000.000.0-000.000' }]).select('supplier_id').single();
    const { data: item } = await adminClient.from('items').insert([{ company_id: companyId, item_code: 'BAG3-A', name: 'Item Bagian3 A', type: 'raw_material', base_uom: 'kg', purchase_uom: 'kg', uom_conversion_factor: 1 }]).select('item_id').single();

    const poResult = await createPurchaseOrder(makeRequest('http://localhost/api/purchase-orders', adminToken, 'POST', { supplier_id: supplier!.supplier_id, production_plant_id: plantId, expected_date: null, lines: [{ item_id: item!.item_id, qty_ordered: 100, unit_price: 5000 }] }));
    expect(poResult.status).toBe(201);
    const poId = (poResult.body as any).purchase_order_id;

    const { data: poLines } = await adminClient.from('purchase_order_lines').select('purchase_order_line_id').eq('purchase_order_id', poId);
    const polId = poLines![0].purchase_order_line_id;

    const grResult = await createGoodsReceipt(makeRequest('http://localhost/api/goods-receipts', adminToken, 'POST', { purchase_order_id: poId, lines: [{ purchase_order_line_id: polId, qty_received: 95 }] }));
    expect(grResult.status).toBe(201);

    const { data: updatedLine } = await adminClient.from('purchase_order_lines').select('qty_ordered, qty_received').eq('purchase_order_line_id', polId).single();
    expect(updatedLine!.qty_received).toBe(95);
    expect(updatedLine!.qty_ordered - updatedLine!.qty_received).toBe(5);

    const { data: lot } = await adminClient.from('lots').select('quantity_on_hand').eq('item_id', item!.item_id).single();
    expect(Number(lot!.quantity_on_hand)).toBe(95);
  });

  it('(b) harga lot berasal dari transaksi PO, BUKAN dari harga acuan supplier', async () => {
    const { data: supplier } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier Bagian3-B', address: 'Alamat', npwp: '11.111.111.1-111.111' }]).select('supplier_id').single();
    const { data: item } = await adminClient.from('items').insert([{ company_id: companyId, item_code: 'BAG3-B', name: 'Item Bagian3 B', type: 'raw_material', base_uom: 'kg', purchase_uom: 'kg', uom_conversion_factor: 1 }]).select('item_id').single();

    // Harga acuan supplier SENGAJA dibuat BEDA dari harga PO sungguhan.
    await adminClient.from('supplier_item_prices').insert([{ company_id: companyId, supplier_id: supplier!.supplier_id, item_id: item!.item_id, reference_price: 9999 }]);

    const poResult = await createPurchaseOrder(makeRequest('http://localhost/api/purchase-orders', adminToken, 'POST', { supplier_id: supplier!.supplier_id, production_plant_id: plantId, expected_date: null, lines: [{ item_id: item!.item_id, qty_ordered: 10, unit_price: 4321 }] }));
    const poId = (poResult.body as any).purchase_order_id;
    const { data: poLines } = await adminClient.from('purchase_order_lines').select('purchase_order_line_id').eq('purchase_order_id', poId);
    const polId = poLines![0].purchase_order_line_id;

    await createGoodsReceipt(makeRequest('http://localhost/api/goods-receipts', adminToken, 'POST', { purchase_order_id: poId, lines: [{ purchase_order_line_id: polId, qty_received: 10 }] }));

    const { data: lot } = await adminClient.from('lots').select('unit_cost').eq('item_id', item!.item_id).single();
    expect(Number(lot!.unit_cost)).toBe(4321); // harga PO, BUKAN 9999 (harga acuan)
  });

  it('(c) item dengan faktor konversi -> beli 1 roll, stok bertambah 3.333 sachet (bukan 1)', async () => {
    const { data: supplier } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier Bagian3-C', address: 'Alamat', npwp: '22.222.222.2-222.222' }]).select('supplier_id').single();
    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'BAG3-C', name: 'Sachet Roll Bagian3', type: 'packaging', base_uom: 'sachet', purchase_uom: 'roll', uom_conversion_factor: 3.333 }])
      .select('item_id')
      .single();

    const poResult = await createPurchaseOrder(makeRequest('http://localhost/api/purchase-orders', adminToken, 'POST', { supplier_id: supplier!.supplier_id, production_plant_id: plantId, expected_date: null, lines: [{ item_id: item!.item_id, qty_ordered: 1, unit_price: 500 }] }));
    const poId = (poResult.body as any).purchase_order_id;
    const { data: poLines } = await adminClient.from('purchase_order_lines').select('purchase_order_line_id').eq('purchase_order_id', poId);
    const polId = poLines![0].purchase_order_line_id;

    await createGoodsReceipt(makeRequest('http://localhost/api/goods-receipts', adminToken, 'POST', { purchase_order_id: poId, lines: [{ purchase_order_line_id: polId, qty_received: 1 }] }));

    const { data: lot } = await adminClient.from('lots').select('quantity_on_hand').eq('item_id', item!.item_id).single();
    expect(Number(lot!.quantity_on_hand)).toBeCloseTo(3.333, 3);
  });

  it('penerimaan melebihi qty dipesan -> DIIZINKAN, diberi peringatan angka persis + tercatat di goods_receipt_overage_log', async () => {
    const { data: supplier } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier Bagian3-Over', address: 'Alamat', npwp: '44.444.444.4-444.444' }]).select('supplier_id').single();
    const { data: item } = await adminClient.from('items').insert([{ company_id: companyId, item_code: 'BAG3-OVER', name: 'Item Bagian3 Over', type: 'raw_material', base_uom: 'kg', purchase_uom: 'kg', uom_conversion_factor: 1 }]).select('item_id').single();

    const poResult = await createPurchaseOrder(makeRequest('http://localhost/api/purchase-orders', adminToken, 'POST', { supplier_id: supplier!.supplier_id, production_plant_id: plantId, expected_date: null, lines: [{ item_id: item!.item_id, qty_ordered: 100, unit_price: 2000 }] }));
    const poId = (poResult.body as any).purchase_order_id;
    const { data: poLines } = await adminClient.from('purchase_order_lines').select('purchase_order_line_id').eq('purchase_order_id', poId);
    const polId = poLines![0].purchase_order_line_id;

    const grResult = await createGoodsReceipt(makeRequest('http://localhost/api/goods-receipts', adminToken, 'POST', { purchase_order_id: poId, lines: [{ purchase_order_line_id: polId, qty_received: 110 }] }));
    // DIIZINKAN (bukan ditolak) -- tetap 201, TAPI ada warning dengan angka persis.
    expect(grResult.status).toBe(201);
    expect((grResult.body as any).warnings).toHaveLength(1);
    expect((grResult.body as any).warnings[0]).toContain('dipesan 100');
    expect((grResult.body as any).warnings[0]).toContain('diterima total 110');
    expect((grResult.body as any).warnings[0]).toContain('lebih 10');

    // Kelebihan tetap masuk stok penuh (lot 110, bukan dipotong ke 100).
    const { data: lot } = await adminClient.from('lots').select('quantity_on_hand').eq('item_id', item!.item_id).single();
    expect(Number(lot!.quantity_on_hand)).toBe(110);

    // Tercatat sebagai kejadian tersendiri (siapa/kapan/berapa lebih).
    const { data: overageRows } = await adminClient.from('goods_receipt_overage_log').select('qty_ordered, qty_received_total, qty_over, received_by').eq('purchase_order_line_id', polId);
    expect(overageRows).toHaveLength(1);
    expect(Number(overageRows![0].qty_ordered)).toBe(100);
    expect(Number(overageRows![0].qty_received_total)).toBe(110);
    expect(Number(overageRows![0].qty_over)).toBe(10);
    expect(overageRows![0].received_by).not.toBeNull();
  });

  it('penerimaan TIDAK melebihi qty dipesan -> TIDAK ada warning, TIDAK ada baris di goods_receipt_overage_log', async () => {
    const { data: supplier } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier Bagian3-NoOver', address: 'Alamat', npwp: '55.555.555.5-555.555' }]).select('supplier_id').single();
    const { data: item } = await adminClient.from('items').insert([{ company_id: companyId, item_code: 'BAG3-NOOVER', name: 'Item Bagian3 NoOver', type: 'raw_material', base_uom: 'kg', purchase_uom: 'kg', uom_conversion_factor: 1 }]).select('item_id').single();

    const poResult = await createPurchaseOrder(makeRequest('http://localhost/api/purchase-orders', adminToken, 'POST', { supplier_id: supplier!.supplier_id, production_plant_id: plantId, expected_date: null, lines: [{ item_id: item!.item_id, qty_ordered: 100, unit_price: 2000 }] }));
    const poId = (poResult.body as any).purchase_order_id;
    const { data: poLines } = await adminClient.from('purchase_order_lines').select('purchase_order_line_id').eq('purchase_order_id', poId);
    const polId = poLines![0].purchase_order_line_id;

    const grResult = await createGoodsReceipt(makeRequest('http://localhost/api/goods-receipts', adminToken, 'POST', { purchase_order_id: poId, lines: [{ purchase_order_line_id: polId, qty_received: 100 }] }));
    expect(grResult.status).toBe(201);
    expect((grResult.body as any).warnings).toHaveLength(0);

    const { data: overageRows } = await adminClient.from('goods_receipt_overage_log').select('goods_receipt_overage_log_id').eq('purchase_order_line_id', polId);
    expect(overageRows).toHaveLength(0);
  });

  it('(d) PO ke supplier yang sudah diarsipkan -> ditolak', async () => {
    const { data: supplier } = await adminClient
      .from('suppliers')
      .insert([{ company_id: companyId, name: 'Supplier Bagian3-Arsip', address: 'Alamat', npwp: '33.333.333.3-333.333', archived_at: new Date().toISOString() }])
      .select('supplier_id')
      .single();
    const { data: item } = await adminClient.from('items').insert([{ company_id: companyId, item_code: 'BAG3-D', name: 'Item Bagian3 D', type: 'raw_material', base_uom: 'kg', purchase_uom: 'kg', uom_conversion_factor: 1 }]).select('item_id').single();

    const poResult = await createPurchaseOrder(makeRequest('http://localhost/api/purchase-orders', adminToken, 'POST', { supplier_id: supplier!.supplier_id, production_plant_id: plantId, expected_date: null, lines: [{ item_id: item!.item_id, qty_ordered: 5, unit_price: 1000 }] }));
    expect(poResult.status).toBe(400);
    expect((poResult.body as any).error).toContain('diarsipkan');

    const { data: pos } = await adminClient.from('purchase_orders').select('purchase_order_id').eq('company_id', companyId).eq('supplier_id', supplier!.supplier_id);
    expect(pos).toHaveLength(0);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createPurchaseOrder } from '../src/features/mrp/server/createPurchaseOrder';
import { listPurchaseOrders } from '../src/features/mrp/server/listPurchaseOrders';
import { updateSupplier } from '../src/features/mrp/server/updateSupplier';
import { createCustomerPurchaseOrder } from '../src/features/mrp/server/createCustomerPurchaseOrder';
import { listCustomerPurchaseOrders } from '../src/features/mrp/server/listCustomerPurchaseOrders';
import { listSalesOrders } from '../src/features/mrp/server/listSalesOrders';
import { updateCustomer } from '../src/features/mrp/server/updateCustomer';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// PMB-07a (22 Agu 2026) — Pembekuan Identitas Mitra di Dokumen Terbit. Bukti
// wajib: ubah alamat resmi supplier/client SETELAH dokumen terbit -> dokumen
// LAMA tidak berubah, dokumen BARU pakai alamat baru. Pola sama persis
// snapshot Surat Jalan Alur 1.

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
function makeGetRequest(url: string, token: string): NextRequest {
  return new NextRequest(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
}

describe('PMB-07a — Pembekuan Identitas Mitra di Dokumen Terbit (PO Supplier, PO Klien, Sales Order)', () => {
  let companyId: number;
  let plantId: number;
  let adminAuthUid: string;
  let adminToken: string;
  let itemId: number;
  let anonSessionClient: SupabaseClient;

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'Pmb07aSnapshotTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant Uji Pmb07a', center_lat: -7.9, center_lng: 112.6, geofence_radius_meters: 150 }])
      .select('production_plant_id')
      .single();
    plantId = plant!.production_plant_id;

    const adminUser = await adminClient.auth.admin.createUser({ email: 'admin.pmb07atest@debug.mrp', password: roleTestPassword, email_confirm: true, user_metadata: { full_name: 'Admin Pmb07aTest' } });
    adminAuthUid = adminUser.data.user!.id;
    await adminClient.from('users').insert([{ auth_uid: adminAuthUid, company_id: companyId, name: 'Admin Pmb07aTest', email: 'admin.pmb07atest@debug.mrp', role: 'company_admin', status: 'active' }]);

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    anonSessionClient = createClient(supabaseUrl!, anonKey, { auth: { persistSession: false } });
    const { data: session } = await anonSessionClient.auth.signInWithPassword({ email: 'admin.pmb07atest@debug.mrp', password: roleTestPassword! });
    adminToken = session.session!.access_token;

    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'PMB07A-ITEM', name: 'Item Uji PMB-07a', type: 'raw_material', base_uom: 'kg', purchase_uom: 'kg' }])
      .select('item_id')
      .single();
    itemId = item!.item_id;
  });

  afterAll(async () => {
    if (anonSessionClient) await anonSessionClient.auth.signOut().catch(() => {});

    const { data: cpoRows } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('company_id', companyId);
    const cpoIds = (cpoRows ?? []).map((c) => c.customer_purchase_order_id);
    const { data: poRows } = await adminClient.from('purchase_orders').select('purchase_order_id').eq('company_id', companyId);
    const poIds = (poRows ?? []).map((p) => p.purchase_order_id);

    const steps: Array<[string, () => any]> = [
      ['sales_order_lines', () => adminClient.from('sales_order_lines').delete().eq('sales_order_id', -1)],
      ['sales_orders', () => adminClient.from('sales_orders').delete().eq('company_id', companyId)],
      ['customer_po_approvals', () => (cpoIds.length ? adminClient.from('customer_po_approvals').delete().in('customer_purchase_order_id', cpoIds) : Promise.resolve({ error: null }))],
      ['customer_purchase_order_lines', () => (cpoIds.length ? adminClient.from('customer_purchase_order_lines').delete().in('customer_purchase_order_id', cpoIds) : Promise.resolve({ error: null }))],
      ['customer_purchase_orders', () => adminClient.from('customer_purchase_orders').delete().eq('company_id', companyId)],
      ['purchase_order_lines', () => (poIds.length ? adminClient.from('purchase_order_lines').delete().in('purchase_order_id', poIds) : Promise.resolve({ error: null }))],
      ['purchase_orders', () => adminClient.from('purchase_orders').delete().eq('company_id', companyId)],
      ['status_transition_log', () => adminClient.from('status_transition_log').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['customers', () => adminClient.from('customers').delete().eq('company_id', companyId)],
      ['suppliers', () => adminClient.from('suppliers').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:admin', () => adminClient.auth.admin.deleteUser(adminAuthUid)]
    ];
    // sales_orders SEBELUM sales_order_lines butuh id-nya dulu -- ambil & hapus lines dulu.
    const { data: soRows } = await adminClient.from('sales_orders').select('sales_order_id').eq('company_id', companyId);
    const soIds = (soRows ?? []).map((s) => s.sales_order_id);
    if (soIds.length) await adminClient.from('sales_order_lines').delete().in('sales_order_id', soIds);
    steps[0] = ['sales_order_lines', () => Promise.resolve({ error: null })];

    await cleanupCompanyCascade(adminClient, companyId, steps);
  });

  it('PO Supplier: ubah alamat supplier setelah PO terbit -> PO lama TIDAK berubah, PO baru pakai alamat baru', async () => {
    const { data: supplier } = await adminClient
      .from('suppliers')
      .insert([{ company_id: companyId, name: 'Supplier Uji PMB07a', address: 'Alamat Lama No. 1', npwp: '00.000.000.0-000.000' }])
      .select('supplier_id')
      .single();
    const supplierId = supplier!.supplier_id;

    const po1Result = await createPurchaseOrder(
      makeRequest('http://localhost/api/purchase-orders', adminToken, 'POST', { supplier_id: supplierId, production_plant_id: plantId, expected_date: null, lines: [{ item_id: itemId, qty_ordered: 10, unit_price: 5000 }] })
    );
    expect(po1Result.status).toBe(201);
    const po1Id = (po1Result.body as any).purchase_order_id;

    const updateResult = await updateSupplier(makeRequest('http://localhost/api/suppliers', adminToken, 'PATCH', { supplier_id: supplierId, name: 'Supplier Uji PMB07a', address: 'Alamat BARU No. 99', npwp: '11.111.111.1-111.111' }));
    expect(updateResult.status).toBe(200);

    const po2Result = await createPurchaseOrder(
      makeRequest('http://localhost/api/purchase-orders', adminToken, 'POST', { supplier_id: supplierId, production_plant_id: plantId, expected_date: null, lines: [{ item_id: itemId, qty_ordered: 5, unit_price: 5000 }] })
    );
    expect(po2Result.status).toBe(201);
    const po2Id = (po2Result.body as any).purchase_order_id;

    const listResult = await listPurchaseOrders(makeGetRequest('http://localhost/api/purchase-orders', adminToken));
    expect(listResult.status).toBe(200);
    const pos = (listResult.body as any).purchaseOrders as any[];
    const po1 = pos.find((p) => p.purchase_order_id === po1Id);
    const po2 = pos.find((p) => p.purchase_order_id === po2Id);

    expect(po1.supplier_name).toBe('Supplier Uji PMB07a');
    expect(po1.supplier_address).toBe('Alamat Lama No. 1');
    expect(po1.supplier_npwp).toBe('00.000.000.0-000.000');

    expect(po2.supplier_address).toBe('Alamat BARU No. 99');
    expect(po2.supplier_npwp).toBe('11.111.111.1-111.111');
  });

  it('PO Klien + Sales Order: ubah alamat client setelah PO/SO terbit -> keduanya TIDAK berubah, PO baru pakai alamat baru', async () => {
    const { data: customer } = await adminClient
      .from('customers')
      .insert([{ company_id: companyId, name: 'Client Uji PMB07a', billing_address: 'Alamat Billing Lama', npwp: '22.222.222.2-222.222' }])
      .select('customer_id')
      .single();
    const customerId = customer!.customer_id;

    const cpo1Result = await createCustomerPurchaseOrder(
      makeRequest('http://localhost/api/customer-purchase-orders', adminToken, 'POST', {
        customer_id: customerId, po_number: 'PMB07A-CPO-1', po_date: null, requested_ship_date: null, pic_name: null, pic_position: null, pic_phone: null, pic_email: null, payment_terms: null,
        lines: [{ item_id: itemId, qty_ordered: 10, unit_price: 6000 }], idempotency_key: null
      })
    );
    expect(cpo1Result.status).toBe(200);
    const cpo1Id = (cpo1Result.body as any).customer_purchase_order_id;

    // Setujui 3 department supaya bisa diproses jadi Sales Order. Baris
    // customer_po_approvals sudah dibuat otomatis (trigger) saat CPO terbit --
    // di-UPDATE ke approved di sini, bukan insert baris baru (akan bentrok
    // unique constraint kalau insert).
    const { error: approveError } = await adminClient.from('customer_po_approvals').update({ status: 'approved' }).eq('customer_purchase_order_id', cpo1Id);
    expect(approveError).toBeNull();

    // Fungsi ini butuh jwt_company_id()/jwt_is_company_leadership() dari klaim JWT
    // PEMANGGIL SUNGGUHAN -- kunci service-role tidak punya klaim itu, jadi panggil
    // lewat sesi anon yang sudah login sebagai company_admin.
    const { data: so1Id, error: rpcError } = await anonSessionClient.rpc('process_customer_purchase_order', { p_customer_purchase_order_id: cpo1Id, p_production_plant_id: plantId });
    expect(rpcError).toBeNull();
    expect(so1Id).not.toBeNull();

    const updateResult = await updateCustomer(makeRequest('http://localhost/api/customers', adminToken, 'PATCH', { customer_id: customerId, name: 'Client Uji PMB07a', billing_address: 'Alamat Billing BARU', npwp: '33.333.333.3-333.333' }));
    expect(updateResult.status).toBe(200);

    const cpo2Result = await createCustomerPurchaseOrder(
      makeRequest('http://localhost/api/customer-purchase-orders', adminToken, 'POST', {
        customer_id: customerId, po_number: 'PMB07A-CPO-2', po_date: null, requested_ship_date: null, pic_name: null, pic_position: null, pic_phone: null, pic_email: null, payment_terms: null,
        lines: [{ item_id: itemId, qty_ordered: 3, unit_price: 6000 }], idempotency_key: null
      })
    );
    expect(cpo2Result.status).toBe(200);
    const cpo2Id = (cpo2Result.body as any).customer_purchase_order_id;

    const cpoListResult = await listCustomerPurchaseOrders(makeGetRequest('http://localhost/api/customer-purchase-orders', adminToken));
    const cpos = (cpoListResult.body as any).purchaseOrders as any[];
    const cpo1 = cpos.find((p) => p.customer_purchase_order_id === cpo1Id);
    const cpo2 = cpos.find((p) => p.customer_purchase_order_id === cpo2Id);
    expect(cpo1.customer_billing_address).toBe('Alamat Billing Lama');
    expect(cpo2.customer_billing_address).toBe('Alamat Billing BARU');

    const soListResult = await listSalesOrders(makeGetRequest('http://localhost/api/sales-orders', adminToken));
    const salesOrders = (soListResult.body as any).salesOrders as any[];
    const so1 = salesOrders.find((s) => s.sales_order_id === so1Id);
    expect(so1, 'Sales Order hasil proses CPO harus ditemukan di daftar').toBeDefined();
    expect(so1.customer_name).toBe('Client Uji PMB07a');
    expect(so1.customer_billing_address).toBe('Alamat Billing Lama');
    expect(so1.customer_npwp).toBe('22.222.222.2-222.222');
  });
});

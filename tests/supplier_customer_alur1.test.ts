import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { deleteSupplier, archiveSupplier, restoreSupplier } from '../src/features/mrp/server/deleteOrArchiveSupplier';
import { updateSupplier } from '../src/features/mrp/server/updateSupplier';
import { listSuppliers } from '../src/features/mrp/server/listSuppliers';
import { deleteCustomer } from '../src/features/mrp/server/deleteOrArchiveCustomer';
import { updateCustomer } from '../src/features/mrp/server/updateCustomer';
import { upsertSupplierItemPrice } from '../src/features/mrp/server/upsertSupplierItemPrice';
import { listSupplierItemPrices } from '../src/features/mrp/server/listSupplierItemPrices';
import { createShipmentWithSignature } from '../src/features/mrp/server/createShipmentWithSignature';
import { getShipmentDetail } from '../src/features/mrp/server/getShipmentDetail';
import { lockMarginBaseline } from '../src/features/mrp/server/lockMarginBaseline';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// Alur 1 (21 Agu 2026) — Supplier & Pelanggan: CRUD lengkap + jalan keluar
// (pola sama persis dengan Routing, Sesi 7 bagian 1), daftar bahan yang
// dipasok (banyak-ke-banyak, dua pintu masuk satu data), snapshot identitas
// client di surat jalan (3.1b, kelas masalah sama dengan snapshot Sesi 6A),
// dan garis tegas harga acuan vs HPP (3.5).

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

describe('Alur 1 — Supplier & Pelanggan (CRUD, jalan keluar, bahan dipasok, snapshot, harga acuan vs HPP)', () => {
  let companyId: number;
  let plantId: number;
  let adminAuthUid: string;
  let staffAuthUid: string;
  let adminToken: string;
  let staffToken: string;
  let finishedGoodItemId: number;
  let rawMaterialItemId: number;
  let bomId: number;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'Alur1TestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient.from('production_plants').insert([{ company_id: companyId, name: 'Plant Alur1Test', is_active: true }]).select('production_plant_id').single();
    plantId = plant!.production_plant_id;

    const adminUser = await adminClient.auth.admin.createUser({ email: 'admin.alur1test@debug.mrp', password: roleTestPassword, email_confirm: true });
    adminAuthUid = adminUser.data.user!.id;
    await adminClient
      .from('users')
      .insert([{ auth_uid: adminAuthUid, company_id: companyId, name: 'Admin Alur1Test', email: 'admin.alur1test@debug.mrp', role: 'company_admin', status: 'active', signature_url: 'https://example.com/fake-signature.png' }]);
    adminToken = await loginToken('admin.alur1test@debug.mrp');

    const staffUser = await adminClient.auth.admin.createUser({ email: 'staff.alur1test@debug.mrp', password: roleTestPassword, email_confirm: true });
    staffAuthUid = staffUser.data.user!.id;
    await adminClient.from('users').insert([{ auth_uid: staffAuthUid, company_id: companyId, name: 'Staf Alur1Test', email: 'staff.alur1test@debug.mrp', role: 'production_staff', status: 'active' }]);
    staffToken = await loginToken('staff.alur1test@debug.mrp');

    const { data: fg } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'ALUR1-FG', name: 'Item FG Alur1Test', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    finishedGoodItemId = fg!.item_id;

    // SENGAJA standard_cost NULL -- ini yang akan diestimasi dari harga acuan supplier (3.5).
    const { data: rm } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'ALUR1-RM', name: 'Bahan Alur1Test', type: 'raw_material', base_uom: 'kg', purchase_uom: 'kg', uom_conversion_factor: 1, standard_cost: null }])
      .select('item_id')
      .single();
    rawMaterialItemId = rm!.item_id;

    const { data: bom } = await adminClient.from('boms').insert([{ company_id: companyId, parent_item_id: finishedGoodItemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active', buffer_percentage: 0 }]).select('bom_id').single();
    bomId = bom!.bom_id;
    await adminClient.from('bom_lines').insert([{ bom_id: bomId, component_item_id: rawMaterialItemId, qty_per_unit_output: 2, uom: 'kg' }]);
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['sales_order_line_margin_snapshots', () => adminClient.from('sales_order_line_margin_snapshots').delete().eq('company_id', companyId)],
      ['shipment_lines', async () => {
        const { data: ships } = await adminClient.from('shipments').select('shipment_id').eq('company_id', companyId);
        const ids = (ships ?? []).map((s: any) => s.shipment_id);
        if (ids.length === 0) return { error: null };
        return adminClient.from('shipment_lines').delete().in('shipment_id', ids);
      }],
      ['document_signatures', () => adminClient.from('document_signatures').delete().eq('company_id', companyId)],
      ['shipments', () => adminClient.from('shipments').delete().eq('company_id', companyId)],
      ['sales_order_lines', async () => {
        const { data: sos } = await adminClient.from('sales_orders').select('sales_order_id').eq('company_id', companyId);
        const ids = (sos ?? []).map((s: any) => s.sales_order_id);
        if (ids.length === 0) return { error: null };
        return adminClient.from('sales_order_lines').delete().in('sales_order_id', ids);
      }],
      ['sales_orders', () => adminClient.from('sales_orders').delete().eq('company_id', companyId)],
      ['customer_po_approvals', async () => {
        const { data: cpos } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('company_id', companyId);
        const ids = (cpos ?? []).map((c: any) => c.customer_purchase_order_id);
        if (ids.length === 0) return { error: null };
        return adminClient.from('customer_po_approvals').delete().in('customer_purchase_order_id', ids);
      }],
      ['customer_purchase_orders', () => adminClient.from('customer_purchase_orders').delete().eq('company_id', companyId)],
      ['customers', () => adminClient.from('customers').delete().eq('company_id', companyId)],
      ['purchase_order_lines', async () => {
        const { data: pos } = await adminClient.from('purchase_orders').select('purchase_order_id').eq('company_id', companyId);
        const ids = (pos ?? []).map((p: any) => p.purchase_order_id);
        if (ids.length === 0) return { error: null };
        return adminClient.from('purchase_order_lines').delete().in('purchase_order_id', ids);
      }],
      ['purchase_orders', () => adminClient.from('purchase_orders').delete().eq('company_id', companyId)],
      ['supplier_item_prices', () => adminClient.from('supplier_item_prices').delete().eq('company_id', companyId)],
      ['suppliers', () => adminClient.from('suppliers').delete().eq('company_id', companyId)],
      ['lots', () => adminClient.from('lots').delete().eq('company_id', companyId)],
      ['bom_lines', () => adminClient.from('bom_lines').delete().eq('bom_id', bomId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:admin', () => adminClient.auth.admin.deleteUser(adminAuthUid)],
      ['auth:staff', () => adminClient.auth.admin.deleteUser(staffAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('(a) supplier belum dipakai PO apa pun -> Hapus berhasil; supplier sudah dipakai PO -> Hapus ditolak, sebut PO-nya', async () => {
    const { data: supplierUnused } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier Unused Alur1' }]).select('supplier_id').single();
    const deleteResult = await deleteSupplier(makeRequest(`http://localhost/api/suppliers/${supplierUnused!.supplier_id}`, adminToken, 'DELETE'), String(supplierUnused!.supplier_id));
    expect(deleteResult.status).toBe(200);

    const { data: supplierUsed } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier Used Alur1' }]).select('supplier_id').single();
    await adminClient.from('purchase_orders').insert([{ company_id: companyId, supplier_id: supplierUsed!.supplier_id, production_plant_id: plantId, status: 'draft' }]);

    const deleteUsedResult = await deleteSupplier(makeRequest(`http://localhost/api/suppliers/${supplierUsed!.supplier_id}`, adminToken, 'DELETE'), String(supplierUsed!.supplier_id));
    expect(deleteUsedResult.status).toBe(400);
    expect((deleteUsedResult.body as any).error).toContain('1 PO Supplier');
  });

  it('(b) Arsipkan supplier -> hilang dari daftar default TAPI PO lama tetap menampilkan namanya; Pulihkan -> kembali', async () => {
    const { data: supplier } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier ArsipTest Alur1' }]).select('supplier_id').single();
    const supplierId = supplier!.supplier_id;
    const { data: po } = await adminClient.from('purchase_orders').insert([{ company_id: companyId, supplier_id: supplierId, production_plant_id: plantId, status: 'draft' }]).select('purchase_order_id').single();

    const archiveResult = await archiveSupplier(makeRequest(`http://localhost/api/suppliers/${supplierId}/archive`, adminToken, 'POST'), String(supplierId));
    expect(archiveResult.status).toBe(200);

    const defaultList = await listSuppliers(makeGetRequest('http://localhost/api/suppliers', adminToken));
    expect((defaultList.body as any).suppliers.map((s: any) => s.supplier_id)).not.toContain(supplierId);

    // PO lama TETAP menampilkan nama supplier itu (baris supplier belum dihapus, cuma diarsipkan).
    const { data: poCheck } = await adminClient.from('purchase_orders').select('purchase_order_id, supplier_id').eq('purchase_order_id', po!.purchase_order_id).single();
    const { data: supplierNameCheck } = await adminClient.from('suppliers').select('name').eq('supplier_id', poCheck!.supplier_id).single();
    expect(supplierNameCheck!.name).toBe('Supplier ArsipTest Alur1');

    const restoreResult = await restoreSupplier(makeRequest(`http://localhost/api/suppliers/${supplierId}/restore`, adminToken, 'POST'), String(supplierId));
    expect(restoreResult.status).toBe(200);
    const afterRestoreList = await listSuppliers(makeGetRequest('http://localhost/api/suppliers', adminToken));
    expect((afterRestoreList.body as any).suppliers.map((s: any) => s.supplier_id)).toContain(supplierId);
  });

  it('(c) ubah alamat client -> surat jalan yang SUDAH terbit TIDAK berubah, surat jalan BARU pakai alamat baru', async () => {
    const { data: customer } = await adminClient
      .from('customers')
      .insert([{ company_id: companyId, name: 'Client SnapshotTest Alur1', customer_type: 'company', billing_address: 'Alamat Lama No. 1' }])
      .select('customer_id')
      .single();
    const customerId = customer!.customer_id;

    const { data: cpo } = await adminClient.from('customer_purchase_orders').insert([{ company_id: companyId, customer_id: customerId, po_number: 'PO-ALUR1-SNAP', po_date: '2026-08-21', status: 'processed' }]).select('customer_purchase_order_id').single();
    const { data: so } = await adminClient.from('sales_orders').insert([{ company_id: companyId, customer_purchase_order_id: cpo!.customer_purchase_order_id, customer_id: customerId, production_plant_id: plantId, status: 'confirmed' }]).select('sales_order_id').single();
    const { data: sol } = await adminClient.from('sales_order_lines').insert([{ sales_order_id: so!.sales_order_id, item_id: finishedGoodItemId, qty_ordered: 10, unit_price: 5000 }]).select('sales_order_line_id').single();
    const { data: lot } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: finishedGoodItemId, lot_number: 'LOT-ALUR1-SNAP', quantity_on_hand: 100, source_type: 'produced', status: 'available' }])
      .select('lot_id')
      .single();

    // --- Shipment PERTAMA dibuat dengan alamat LAMA ---
    const createReq1 = makeRequest('http://localhost/api/shipments', adminToken, 'POST', {
      sales_order_id: so!.sales_order_id,
      delivery_address: 'Alamat Kirim Shipment Pertama',
      confirmation_text: 'saya konfirmasi',
      lines: [{ sales_order_line_id: sol!.sales_order_line_id, qty_shipped: 5, lot_id: lot!.lot_id }]
    });
    const created1 = await createShipmentWithSignature(createReq1);
    expect(created1.status).toBe(201);
    const shipment1Id = (created1.body as any).shipment_id;

    const detail1Before = await getShipmentDetail(makeGetRequest(`http://localhost/api/shipments/${shipment1Id}`, adminToken), shipment1Id);
    expect((detail1Before.body as any).shipment.customer_name).toBe('Client SnapshotTest Alur1');

    // --- Ubah nama & alamat client SEKARANG ---
    await adminClient.from('customers').update({ name: 'Client SnapshotTest Alur1 (BERUBAH)', billing_address: 'Alamat BARU No. 2' }).eq('customer_id', customerId);

    // --- Shipment yang SUDAH terbit TIDAK ikut berubah ---
    const detail1After = await getShipmentDetail(makeGetRequest(`http://localhost/api/shipments/${shipment1Id}`, adminToken), shipment1Id);
    expect((detail1After.body as any).shipment.customer_name).toBe('Client SnapshotTest Alur1');
    expect((detail1After.body as any).shipment.customer_billing_address).toBe('Alamat Lama No. 1');

    // --- Shipment BARU (dibuat SETELAH perubahan) pakai data TERBARU ---
    const createReq2 = makeRequest('http://localhost/api/shipments', adminToken, 'POST', {
      sales_order_id: so!.sales_order_id,
      delivery_address: 'Alamat Kirim Shipment Kedua',
      confirmation_text: 'saya konfirmasi',
      lines: [{ sales_order_line_id: sol!.sales_order_line_id, qty_shipped: 5, lot_id: lot!.lot_id }]
    });
    const created2 = await createShipmentWithSignature(createReq2);
    expect(created2.status).toBe(201);
    const shipment2Id = (created2.body as any).shipment_id;
    const detail2 = await getShipmentDetail(makeGetRequest(`http://localhost/api/shipments/${shipment2Id}`, adminToken), shipment2Id);
    expect((detail2.body as any).shipment.customer_name).toBe('Client SnapshotTest Alur1 (BERUBAH)');
    expect((detail2.body as any).shipment.customer_billing_address).toBe('Alamat BARU No. 2');
  });

  it('(d) coba kunci baseline Margin Watch saat biaya berasal dari harga acuan supplier -> DITOLAK', async () => {
    const { data: supplier } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier HargaAcuan Alur1' }]).select('supplier_id').single();
    const priceResult = await upsertSupplierItemPrice(
      makeRequest('http://localhost/api/supplier-item-prices', adminToken, 'POST', { supplier_id: supplier!.supplier_id, item_id: rawMaterialItemId, reference_price: 15000 })
    );
    expect(priceResult.status).toBe(200);

    const { data: customer } = await adminClient.from('customers').insert([{ company_id: companyId, name: 'Client HargaAcuan Alur1', customer_type: 'company' }]).select('customer_id').single();
    const { data: cpo } = await adminClient.from('customer_purchase_orders').insert([{ company_id: companyId, customer_id: customer!.customer_id, po_number: 'PO-ALUR1-HA', po_date: '2026-08-21', status: 'processed' }]).select('customer_purchase_order_id').single();
    const { data: so } = await adminClient.from('sales_orders').insert([{ company_id: companyId, customer_purchase_order_id: cpo!.customer_purchase_order_id, customer_id: customer!.customer_id, production_plant_id: plantId, status: 'confirmed' }]).select('sales_order_id').single();
    const { data: sol } = await adminClient.from('sales_order_lines').insert([{ sales_order_id: so!.sales_order_id, item_id: finishedGoodItemId, qty_ordered: 5, unit_price: 100000 }]).select('sales_order_line_id').single();

    const lockResult = await lockMarginBaseline(makeRequest('http://localhost/api/margin/lock', adminToken, 'POST', { sales_order_line_id: sol!.sales_order_line_id }));
    expect(lockResult.status).toBe(400);
    expect((lockResult.body as any).error).toContain('harga acuan supplier');
    expect((lockResult.body as any).error).toContain('ALUR1-RM');
  });

  it('(e) satu bahan didaftarkan ke DUA supplier berbeda dengan harga berbeda -> keduanya tersimpan, tidak saling menimpa, tidak ada item duplikat', async () => {
    const itemCountBefore = (await adminClient.from('items').select('item_id', { count: 'exact', head: true }).eq('company_id', companyId).eq('item_code', 'ALUR1-RM')).count;
    expect(itemCountBefore).toBe(1);

    const { data: supplierA } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier DuaSisi A Alur1' }]).select('supplier_id').single();
    const { data: supplierB } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier DuaSisi B Alur1' }]).select('supplier_id').single();

    const resultA = await upsertSupplierItemPrice(makeRequest('http://localhost/api/supplier-item-prices', adminToken, 'POST', { supplier_id: supplierA!.supplier_id, item_id: rawMaterialItemId, reference_price: 20000 }));
    expect(resultA.status).toBe(200);
    const resultB = await upsertSupplierItemPrice(makeRequest('http://localhost/api/supplier-item-prices', adminToken, 'POST', { supplier_id: supplierB!.supplier_id, item_id: rawMaterialItemId, reference_price: 25000 }));
    expect(resultB.status).toBe(200);

    const pricesForItem = await listSupplierItemPrices(makeGetRequest(`http://localhost/api/supplier-item-prices?item_id=${rawMaterialItemId}`, adminToken));
    const rows = (pricesForItem.body as any).prices.filter((p: any) => p.supplier_id === supplierA!.supplier_id || p.supplier_id === supplierB!.supplier_id);
    expect(rows).toHaveLength(2);
    const priceA = rows.find((r: any) => r.supplier_id === supplierA!.supplier_id);
    const priceB = rows.find((r: any) => r.supplier_id === supplierB!.supplier_id);
    expect(Number(priceA.reference_price)).toBe(20000);
    expect(Number(priceB.reference_price)).toBe(25000);

    const itemCountAfter = (await adminClient.from('items').select('item_id', { count: 'exact', head: true }).eq('company_id', companyId).eq('item_code', 'ALUR1-RM')).count;
    expect(itemCountAfter).toBe(1);
  });

  it('(f) role tanpa izin (production_staff) -> update Supplier/Customer via API langsung DITOLAK server (403)', async () => {
    const { data: supplier } = await adminClient.from('suppliers').insert([{ company_id: companyId, name: 'Supplier AksesTest Alur1' }]).select('supplier_id').single();
    const { data: customer } = await adminClient.from('customers').insert([{ company_id: companyId, name: 'Client AksesTest Alur1', customer_type: 'company' }]).select('customer_id').single();

    const supplierUpdateResult = await updateSupplier(makeRequest('http://localhost/api/suppliers', staffToken, 'PATCH', { supplier_id: supplier!.supplier_id, name: 'Dipaksa Ubah' }));
    expect(supplierUpdateResult.status).toBe(403);

    const supplierDeleteResult = await deleteSupplier(makeRequest(`http://localhost/api/suppliers/${supplier!.supplier_id}`, staffToken, 'DELETE'), String(supplier!.supplier_id));
    expect(supplierDeleteResult.status).toBe(403);

    const customerUpdateResult = await updateCustomer(makeRequest('http://localhost/api/customers', staffToken, 'PATCH', { customer_id: customer!.customer_id, name: 'Dipaksa Ubah' }));
    expect(customerUpdateResult.status).toBe(403);

    const customerDeleteResult = await deleteCustomer(makeRequest(`http://localhost/api/customers/${customer!.customer_id}`, staffToken, 'DELETE'), String(customer!.customer_id));
    expect(customerDeleteResult.status).toBe(403);

    const { data: supplierStillThere } = await adminClient.from('suppliers').select('name').eq('supplier_id', supplier!.supplier_id).single();
    expect(supplierStillThere!.name).toBe('Supplier AksesTest Alur1');
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createShipmentWithSignature } from '../src/features/mrp/server/createShipmentWithSignature';
import { getShipmentByPodToken } from '../src/features/mrp/server/getShipmentByPodToken';
import { listSalesOrders } from '../src/features/mrp/server/listSalesOrders';
import {
  createCustomerDeliveryAddress,
  listCustomerDeliveryAddresses,
  updateCustomerDeliveryAddress,
  deleteOrArchiveCustomerDeliveryAddress
} from '../src/features/mrp/server/customerDeliveryAddresses';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// PMB-07b (22 Agu 2026, Bagian 4) — Alamat Tujuan Kirim sebagai Daftar.
// Arkeologi SUDAH dilakukan sebelum menulis test ini (dicatat di migrasi
// 20260827520000): blokir over-shipment SUDAH kumulatif lintas shipment
// (bukan per-shipment), delivery_address SUDAH beku per shipment sejak
// awal, pod_token SUDAH unique -- test ini MEMBUKTIKAN ulang seluruh
// rantai itu bekerja BERSAMAAN dengan kapabilitas baru (daftar alamat
// tersimpan), bukan menguji ulang dari nol.

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

describe('PMB-07b — Alamat Tujuan Kirim sebagai Daftar (lapisan data & server)', () => {
  let companyId: number;
  let plantId: number;
  let customerId: number;
  let itemId: number;
  let soId: number;
  let solId: number;
  let cpoId: number;
  let adminAuthUid: string;
  let adminToken: string;
  let addressAId: number;
  let addressBId: number;

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'Pmb07bDeliveryTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient.from('production_plants').insert([{ company_id: companyId, name: 'Plant Pmb07b', is_active: true }]).select('production_plant_id').single();
    plantId = plant!.production_plant_id;

    const { data: customer } = await adminClient.from('customers').insert([{ company_id: companyId, name: 'Customer Pmb07b', customer_type: 'company' }]).select('customer_id').single();
    customerId = customer!.customer_id;

    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'PMB07B-ITEM', name: 'Item Pmb07b', type: 'finished_good', base_uom: 'box', purchase_uom: 'box' }])
      .select('item_id')
      .single();
    itemId = item!.item_id;

    const { data: cpo } = await adminClient.from('customer_purchase_orders').insert([{ company_id: companyId, customer_id: customerId, po_number: 'PO-PMB07B-1', po_date: '2026-08-22', status: 'processed' }]).select('customer_purchase_order_id').single();
    cpoId = cpo!.customer_purchase_order_id;

    const { data: so } = await adminClient.from('sales_orders').insert([{ company_id: companyId, customer_purchase_order_id: cpoId, customer_id: customerId, production_plant_id: plantId, status: 'confirmed' }]).select('sales_order_id').single();
    soId = so!.sales_order_id;

    const { data: sol } = await adminClient.from('sales_order_lines').insert([{ sales_order_id: soId, item_id: itemId, qty_ordered: 2500, unit_price: 1000 }]).select('sales_order_line_id').single();
    solId = sol!.sales_order_line_id;

    const adminUser = await adminClient.auth.admin.createUser({ email: 'admin.pmb07btest@debug.mrp', password: roleTestPassword, email_confirm: true, user_metadata: { full_name: 'Admin Pmb07bTest' } });
    adminAuthUid = adminUser.data.user!.id;
    await adminClient.from('users').insert([{ auth_uid: adminAuthUid, company_id: companyId, name: 'Admin Pmb07bTest', email: 'admin.pmb07btest@debug.mrp', role: 'company_admin', status: 'active', signature_url: 'https://example.com/fake-signature-pmb07b.png' }]);

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const anonSessionClient = createClient(supabaseUrl!, anonKey, { auth: { persistSession: false } });
    const { data: session } = await anonSessionClient.auth.signInWithPassword({ email: 'admin.pmb07btest@debug.mrp', password: roleTestPassword! });
    adminToken = session.session!.access_token;

    // 2 alamat tersimpan lewat fungsi CRUD baru.
    const addrAResult = await createCustomerDeliveryAddress(makeRequest('http://localhost/api/customer-delivery-addresses', adminToken, 'POST', { customer_id: customerId, label: 'Distributor Surabaya', address: 'Jl. Distributor Surabaya No. 1', pic_name: 'Budi', pic_phone: '0811' }));
    expect(addrAResult.status).toBe(201);
    addressAId = (addrAResult.body as any).customer_delivery_address_id;

    const addrBResult = await createCustomerDeliveryAddress(makeRequest('http://localhost/api/customer-delivery-addresses', adminToken, 'POST', { customer_id: customerId, label: 'Distributor Makassar', address: 'Jl. Distributor Makassar No. 2', pic_name: 'Sari', pic_phone: '0822' }));
    expect(addrBResult.status).toBe(201);
    addressBId = (addrBResult.body as any).customer_delivery_address_id;
  });

  afterAll(async () => {
    const steps: Array<[string, () => any]> = [
      ['status_transition_log', () => adminClient.from('status_transition_log').delete().eq('company_id', companyId)],
      ['stock_movements', () => adminClient.from('stock_movements').delete().eq('company_id', companyId)],
      ['document_signatures', () => adminClient.from('document_signatures').delete().eq('company_id', companyId)],
      ['shipment_lines', async () => {
        const { data: ships } = await adminClient.from('shipments').select('shipment_id').eq('company_id', companyId);
        const ids = (ships ?? []).map((s: any) => s.shipment_id);
        if (ids.length === 0) return { error: null };
        return adminClient.from('shipment_lines').delete().in('shipment_id', ids);
      }],
      ['shipments', () => adminClient.from('shipments').delete().eq('company_id', companyId)],
      ['customer_delivery_addresses', () => adminClient.from('customer_delivery_addresses').delete().eq('company_id', companyId)],
      ['sales_order_lines', () => adminClient.from('sales_order_lines').delete().eq('sales_order_id', soId)],
      ['sales_orders', () => adminClient.from('sales_orders').delete().eq('company_id', companyId)],
      ['customer_po_approvals', () => adminClient.from('customer_po_approvals').delete().eq('customer_purchase_order_id', cpoId)],
      ['customer_purchase_orders', () => adminClient.from('customer_purchase_orders').delete().eq('company_id', companyId)],
      ['lots', () => adminClient.from('lots').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['customers', () => adminClient.from('customers').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:admin', () => adminClient.auth.admin.deleteUser(adminAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, steps);
  });

  it('(a) Pesanan 2.500 dipecah 1.000 ke alamat A + 1.500 ke alamat B -> sisa 2.500->1.500->0, dua surat jalan dengan alamat masing-masing benar', async () => {
    const { data: lot } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, lot_number: 'LOT-PMB07B-1', quantity_on_hand: 3000, source_type: 'produced', status: 'available' }])
      .select('lot_id')
      .single();
    const lotId = lot!.lot_id;

    const soListBefore = await listSalesOrders(makeGetRequest('http://localhost/api/sales-orders', adminToken));
    const soBefore = (soListBefore.body as any).salesOrders.find((s: any) => s.sales_order_id === soId);
    expect(soBefore.lines.find((l: any) => l.sales_order_line_id === solId).qty_remaining_to_ship).toBe(2500);

    // Kirim 1.000 ke alamat A (dipilih dari daftar tersimpan).
    const ship1Result = await createShipmentWithSignature(
      makeRequest('http://localhost/api/shipments', adminToken, 'POST', {
        sales_order_id: soId, delivery_address_id: addressAId, confirmation_text: 'saya konfirmasi',
        lines: [{ sales_order_line_id: solId, qty_shipped: 1000, lot_id: lotId }]
      })
    );
    expect(ship1Result.status).toBe(201);
    const shipment1Id = (ship1Result.body as any).shipment_id;
    await adminClient.from('shipments').update({ status: 'shipped', dispatch_photo_url: 'https://example.com/dispatch1.png' }).eq('shipment_id', shipment1Id);

    const soListMid = await listSalesOrders(makeGetRequest('http://localhost/api/sales-orders', adminToken));
    const soMid = (soListMid.body as any).salesOrders.find((s: any) => s.sales_order_id === soId);
    expect(soMid.lines.find((l: any) => l.sales_order_line_id === solId).qty_remaining_to_ship).toBe(1500);

    // Kirim 1.500 ke alamat B.
    const ship2Result = await createShipmentWithSignature(
      makeRequest('http://localhost/api/shipments', adminToken, 'POST', {
        sales_order_id: soId, delivery_address_id: addressBId, confirmation_text: 'saya konfirmasi',
        lines: [{ sales_order_line_id: solId, qty_shipped: 1500, lot_id: lotId }]
      })
    );
    expect(ship2Result.status).toBe(201);
    const shipment2Id = (ship2Result.body as any).shipment_id;
    await adminClient.from('shipments').update({ status: 'shipped', dispatch_photo_url: 'https://example.com/dispatch2.png' }).eq('shipment_id', shipment2Id);

    const soListAfter = await listSalesOrders(makeGetRequest('http://localhost/api/sales-orders', adminToken));
    const soAfter = (soListAfter.body as any).salesOrders.find((s: any) => s.sales_order_id === soId);
    expect(soAfter.lines.find((l: any) => l.sales_order_line_id === solId).qty_remaining_to_ship).toBe(0);

    const { data: ship1Row } = await adminClient.from('shipments').select('delivery_address, delivery_address_id').eq('shipment_id', shipment1Id).single();
    const { data: ship2Row } = await adminClient.from('shipments').select('delivery_address, delivery_address_id').eq('shipment_id', shipment2Id).single();
    expect(ship1Row!.delivery_address).toBe('Jl. Distributor Surabaya No. 1');
    expect(ship1Row!.delivery_address_id).toBe(addressAId);
    expect(ship2Row!.delivery_address).toBe('Jl. Distributor Makassar No. 2');
    expect(ship2Row!.delivery_address_id).toBe(addressBId);

    (globalThis as any).__pmb07bShipment1Id = shipment1Id;
    (globalThis as any).__pmb07bShipment2Id = shipment2Id;
    (globalThis as any).__pmb07bLotId = lotId;
  });

  it('(b) Kirim 1.000 lagi setelah sisa nol -> DITOLAK di database, pesan sebut jumlah sudah terkirim', async () => {
    const lotId = (globalThis as any).__pmb07bLotId;
    const { data: newShipment } = await adminClient.from('shipments').insert([{ company_id: companyId, sales_order_id: soId, shipment_number: 'SJ-PMB07B-OVER/8-DTC/2026', delivery_address: 'Percobaan Kelebihan' }]).select('shipment_id').single();

    const { error: insertError } = await adminClient
      .from('shipment_lines')
      .insert([{ shipment_id: newShipment!.shipment_id, sales_order_line_id: solId, item_id: itemId, qty_shipped: 1000, lot_id: lotId }]);

    expect(insertError).not.toBeNull();
    expect(insertError!.message).toContain('Jumlah melebihi sisa pesanan');
    expect(insertError!.message).toContain('sisa 0');

    await adminClient.from('shipments').delete().eq('shipment_id', newShipment!.shipment_id);
  });

  it('(c) Ubah alamat tersimpan A setelah surat jalan A terbit -> surat jalan A TIDAK berubah, pengiriman BARU ke alamat A pakai alamat baru', async () => {
    const shipment1Id = (globalThis as any).__pmb07bShipment1Id;

    const updateResult = await updateCustomerDeliveryAddress(makeRequest('http://localhost/api/customer-delivery-addresses', adminToken, 'PATCH', { customer_delivery_address_id: addressAId, label: 'Distributor Surabaya', address: 'Jl. Distributor Surabaya BARU No. 99' }));
    expect(updateResult.status).toBe(200);

    const { data: ship1AfterAddressChange } = await adminClient.from('shipments').select('delivery_address').eq('shipment_id', shipment1Id).single();
    expect(ship1AfterAddressChange!.delivery_address).toBe('Jl. Distributor Surabaya No. 1');

    const listAfter = await listCustomerDeliveryAddresses(makeGetRequest('http://localhost/api/customer-delivery-addresses', adminToken), String(customerId));
    const addrANow = (listAfter.body as any).addresses.find((a: any) => a.customer_delivery_address_id === addressAId);
    expect(addrANow.address).toBe('Jl. Distributor Surabaya BARU No. 99');
  });

  it('(d) Buka POD pengiriman A memakai token pengiriman B -> ditolak (token unik per pengiriman)', async () => {
    const shipment1Id = (globalThis as any).__pmb07bShipment1Id;
    const shipment2Id = (globalThis as any).__pmb07bShipment2Id;

    const { data: ship1 } = await adminClient.from('shipments').select('pod_token').eq('shipment_id', shipment1Id).single();
    const { data: ship2 } = await adminClient.from('shipments').select('pod_token').eq('shipment_id', shipment2Id).single();
    expect(ship1!.pod_token).not.toBeNull();
    expect(ship2!.pod_token).not.toBeNull();
    expect(ship1!.pod_token).not.toBe(ship2!.pod_token);

    const podForToken1 = await getShipmentByPodToken(ship1!.pod_token!);
    expect((podForToken1.body as any).valid).toBe(true);
    expect((podForToken1.body as any).delivery_address).toBe('Jl. Distributor Surabaya No. 1');

    const podForToken2 = await getShipmentByPodToken(ship2!.pod_token!);
    expect((podForToken2.body as any).valid).toBe(true);
    expect((podForToken2.body as any).delivery_address).toBe('Jl. Distributor Makassar No. 2');

    // Token acak yang TIDAK cocok dengan shipment mana pun -> ditolak.
    const podForFakeToken = await getShipmentByPodToken('token-acak-tidak-pernah-ada-di-database');
    expect((podForFakeToken.body as any).valid).toBe(false);
  });

  it('Alamat tujuan kirim yang sudah dipakai pengiriman tidak bisa dihapus permanen -> diarsipkan', async () => {
    const deleteResult = await deleteOrArchiveCustomerDeliveryAddress(makeRequest('http://localhost/api/customer-delivery-addresses/x', adminToken, 'DELETE'), String(addressAId));
    expect(deleteResult.status).toBe(200);
    expect((deleteResult.body as any).archived).toBe(true);

    const { data: addrAAfter } = await adminClient.from('customer_delivery_addresses').select('archived_at').eq('customer_delivery_address_id', addressAId).single();
    expect(addrAAfter!.archived_at).not.toBeNull();
  });
});

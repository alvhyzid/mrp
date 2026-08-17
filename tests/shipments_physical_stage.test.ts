import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

// Sesi 3A (docs/rencana-kerja-playbook-ams.md) — fixture terpisah (ShipmentTestCorp),
// pola sama seperti RoleTestCorp: dibuat di beforeAll, dibersihkan total di afterAll.
describe('shipments physical stage — trigger stok & state machine', () => {
  let companyId: number;
  let plantId: number;
  let customerId: number;
  let itemId: number;
  let lotNearId: number;
  let lotFarId: number;
  let soId: number;
  let solId: number;
  let cpoId: number;

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['status_transition_log', () => adminClient.from('status_transition_log').delete().eq('company_id', companyId)],
      ['stock_movements', () => adminClient.from('stock_movements').delete().eq('company_id', companyId)],
      ['shipment_lines', async () => {
        const { data: ships } = await adminClient.from('shipments').select('shipment_id').eq('company_id', companyId);
        const ids = (ships ?? []).map((s: any) => s.shipment_id);
        if (ids.length === 0) return { error: null };
        return adminClient.from('shipment_lines').delete().in('shipment_id', ids);
      }],
      ['shipments', () => adminClient.from('shipments').delete().eq('company_id', companyId)],
      ['sales_order_lines', async () => {
        const { data: sos } = await adminClient.from('sales_orders').select('sales_order_id').eq('company_id', companyId);
        const ids = (sos ?? []).map((s: any) => s.sales_order_id);
        if (ids.length === 0) return { error: null };
        return adminClient.from('sales_order_lines').delete().in('sales_order_id', ids);
      }],
      ['sales_orders', () => adminClient.from('sales_orders').delete().eq('company_id', companyId)],
      ['customer_po_approvals', () => adminClient.from('customer_po_approvals').delete().eq('customer_purchase_order_id', cpoId)],
      ['customer_purchase_orders', () => adminClient.from('customer_purchase_orders').delete().eq('company_id', companyId)],
      ['lots', () => adminClient.from('lots').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['customers', () => adminClient.from('customers').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['companies', () => adminClient.from('companies').delete().eq('company_id', companyId)]
    ];
    for (const [label, run] of cleanupSteps) {
      const { error } = await run();
      if (error) throw new Error(`Cleanup failed at ${label}: ${error.message}`);
    }
  });

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'ShipmentTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(`Failed to create fixture company: ${companyError.message}`);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant ShipmentTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(`Failed to create fixture plant: ${plantError.message}`);
    plantId = plant.production_plant_id;

    const { data: customer, error: customerError } = await adminClient
      .from('customers')
      .insert([{ company_id: companyId, name: 'Customer ShipmentTest', customer_type: 'company' }])
      .select('customer_id')
      .single();
    if (customerError) throw new Error(`Failed to create fixture customer: ${customerError.message}`);
    customerId = customer.customer_id;

    const { data: item, error: itemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'SHIPTEST-ITEM', name: 'Item ShipmentTest', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    if (itemError) throw new Error(`Failed to create fixture item: ${itemError.message}`);
    itemId = item.item_id;

    const { data: lotNear, error: lotNearError } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, lot_number: 'LOT-SHIPTEST-NEAR', quantity_on_hand: 100, source_type: 'produced', status: 'available', expiry_date: '2026-09-01' }])
      .select('lot_id')
      .single();
    if (lotNearError) throw new Error(`Failed to create fixture lot (near expiry): ${lotNearError.message}`);
    lotNearId = lotNear.lot_id;

    const { data: lotFar, error: lotFarError } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, lot_number: 'LOT-SHIPTEST-FAR', quantity_on_hand: 100, source_type: 'produced', status: 'available', expiry_date: '2026-12-01' }])
      .select('lot_id')
      .single();
    if (lotFarError) throw new Error(`Failed to create fixture lot (far expiry): ${lotFarError.message}`);
    lotFarId = lotFar.lot_id;

    // sales_orders.customer_purchase_order_id NOT NULL -> harus lewat CPO nyata dulu.
    const { data: cpo, error: cpoError } = await adminClient
      .from('customer_purchase_orders')
      .insert([{ company_id: companyId, customer_id: customerId, po_number: 'PO-SHIPTEST-1', po_date: '2026-08-17', status: 'processed' }])
      .select('customer_purchase_order_id')
      .single();
    if (cpoError) throw new Error(`Failed to create fixture CPO: ${cpoError.message}`);
    cpoId = cpo.customer_purchase_order_id;

    const { data: so, error: soError } = await adminClient
      .from('sales_orders')
      .insert([{ company_id: companyId, customer_purchase_order_id: cpoId, customer_id: customerId, production_plant_id: plantId, status: 'confirmed' }])
      .select('sales_order_id')
      .single();
    if (soError) throw new Error(`Failed to create fixture sales_order: ${soError.message}`);
    soId = so.sales_order_id;

    const { data: sol, error: solError } = await adminClient
      .from('sales_order_lines')
      .insert([{ sales_order_id: soId, item_id: itemId, qty_ordered: 50, unit_price: 10000 }])
      .select('sales_order_line_id')
      .single();
    if (solError) throw new Error(`Failed to create fixture sales_order_line: ${solError.message}`);
    solId = sol.sales_order_line_id;
  });

  it('suggest_fefo_lots: lot dengan expiry_date terdekat muncul lebih dulu', async () => {
    const { data, error } = await adminClient.rpc('suggest_fefo_lots', { p_item_id: itemId, p_production_plant_id: plantId });
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data![0].lot_id).toBe(lotNearId);
    expect(data![1].lot_id).toBe(lotFarId);
  });

  it('insert shipment_line dengan lot_id NULL -> DITOLAK (traceability wajib)', async () => {
    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .insert([{ company_id: companyId, sales_order_id: soId, shipment_number: 'SJ-NULLTEST/8-STC/2026', delivery_address: 'Jl. Null Test' }])
      .select('shipment_id')
      .single();
    if (shipmentError) throw new Error(`Failed to create shipment fixture: ${shipmentError.message}`);

    const { error } = await adminClient
      .from('shipment_lines')
      .insert([{ shipment_id: shipment!.shipment_id, sales_order_line_id: solId, item_id: itemId, qty_shipped: 5, lot_id: null }]);

    expect(error).not.toBeNull();
    expect(error!.code).toBe('23502');
  });

  it('transisi draft -> delivered langsung (skip shipped) -> DITOLAK oleh state machine', async () => {
    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .insert([{ company_id: companyId, sales_order_id: soId, shipment_number: 'SJ-SKIPTEST/8-STC/2026', delivery_address: 'Jl. Skip Test' }])
      .select('shipment_id')
      .single();
    if (shipmentError) throw new Error(`Failed to create shipment fixture: ${shipmentError.message}`);

    const { error } = await adminClient.from('shipments').update({ status: 'delivered' }).eq('shipment_id', shipment!.shipment_id);

    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak valid untuk tabel shipments');
  });

  // Hardening 17 Agu 2026 — "foto bukti pengiriman wajib" sebelumnya cuma dijaga di
  // updateShipmentStatus.ts (aplikasi), bukan di database. Tes ini membuktikan jalur
  // langsung ke DB (skip endpoint aplikasi sama sekali, persis seperti percobaan di
  // sini) TETAP ditolak oleh enforce_status_transition() sendiri.
  it('transisi draft -> shipped LANGSUNG lewat DB tanpa dispatch_photo_url -> DITOLAK', async () => {
    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .insert([{ company_id: companyId, sales_order_id: soId, shipment_number: 'SJ-NOPHOTOTEST/8-STC/2026', delivery_address: 'Jl. No Photo Test' }])
      .select('shipment_id')
      .single();
    if (shipmentError) throw new Error(`Failed to create shipment fixture: ${shipmentError.message}`);

    const { data: updated, error } = await adminClient
      .from('shipments')
      .update({ status: 'shipped' })
      .eq('shipment_id', shipment!.shipment_id)
      .select('shipment_id, status')
      .maybeSingle();

    expect(updated).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.code).toBe('23514');
    expect(error!.message).toContain('Foto bukti pengiriman wajib');

    const { data: afterAttempt } = await adminClient.from('shipments').select('status, dispatch_photo_url').eq('shipment_id', shipment!.shipment_id).single();
    expect(afterAttempt!.status).toBe('draft');
    expect(afterAttempt!.dispatch_photo_url).toBeNull();

    // Jalur SAH (dispatch_photo_url diisi dalam UPDATE yang sama, persis
    // processShipmentDispatch.ts) tetap harus berhasil — bukti guard ini tidak
    // menghalangi transisi normal, cuma yang melewatkan foto.
    const { error: legitError } = await adminClient
      .from('shipments')
      .update({ status: 'shipped', dispatch_photo_url: 'https://example.com/test-dispatch-photo.png' })
      .eq('shipment_id', shipment!.shipment_id);
    expect(legitError).toBeNull();
  });

  it('ship qty melebihi stok fisik lot (tapi masih dalam sisa qty_ordered) -> DITOLAK saat status shipped, stok tidak berubah (tidak sampai negatif)', async () => {
    const { data: lotTiny, error: lotTinyError } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, lot_number: 'LOT-SHIPTEST-TINY', quantity_on_hand: 2, source_type: 'produced', status: 'available' }])
      .select('lot_id')
      .single();
    if (lotTinyError) throw new Error(`Failed to create lotTiny fixture: ${lotTinyError.message}`);

    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .insert([{ company_id: companyId, sales_order_id: soId, shipment_number: 'SJ-INSUFFICIENT/8-STC/2026', delivery_address: 'Jl. Insufficient Test' }])
      .select('shipment_id')
      .single();
    if (shipmentError) throw new Error(`Failed to create shipment fixture: ${shipmentError.message}`);

    // qty_shipped=10 sengaja MASIH di bawah sisa qty_ordered solId (50) supaya baris ini
    // lolos trigger enforce_shipment_line_qty_limit (INSERT), dan skenario yang benar-benar
    // diuji di sini murni "stok fisik lot tidak cukup" (bukan tertukar dgn limit qty_ordered).
    const { error: insertError } = await adminClient.from('shipment_lines').insert([{ shipment_id: shipment!.shipment_id, sales_order_line_id: solId, item_id: itemId, qty_shipped: 10, lot_id: lotTiny!.lot_id }]);
    expect(insertError).toBeNull();

    const { error } = await adminClient.from('shipments').update({ status: 'shipped', dispatch_photo_url: 'https://example.com/test-dispatch-photo.png' }).eq('shipment_id', shipment!.shipment_id);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak cukup');

    const { data: lotAfter } = await adminClient.from('lots').select('quantity_on_hand').eq('lot_id', lotTiny!.lot_id).single();
    expect(Number(lotAfter!.quantity_on_hand)).toBe(2);

    // Bersihkan supaya baris draft ini tidak ikut terhitung di sisa qty_ordered solId
    // untuk test lain (trigger qty-limit menghitung SEMUA baris non-cancelled, termasuk draft).
    await adminClient.from('shipment_lines').delete().eq('shipment_id', shipment!.shipment_id);
    await adminClient.from('shipments').delete().eq('shipment_id', shipment!.shipment_id);
  });

  it('ship qty melebihi sisa qty_ordered SO line -> DITOLAK oleh database (penegakan diubah 17 Agu 2026, BUKAN lagi diizinkan)', async () => {
    const { data: solSmall, error: solSmallError } = await adminClient
      .from('sales_order_lines')
      .insert([{ sales_order_id: soId, item_id: itemId, qty_ordered: 10, unit_price: 5000 }])
      .select('sales_order_line_id')
      .single();
    if (solSmallError) throw new Error(`Failed to create solSmall fixture: ${solSmallError.message}`);

    const { data: lotBig, error: lotBigError } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, lot_number: 'LOT-SHIPTEST-BIG', quantity_on_hand: 1000, source_type: 'produced', status: 'available' }])
      .select('lot_id')
      .single();
    if (lotBigError) throw new Error(`Failed to create lotBig fixture: ${lotBigError.message}`);

    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .insert([{ company_id: companyId, sales_order_id: soId, shipment_number: 'SJ-OVERSHIP/8-STC/2026', delivery_address: 'Jl. Overship Test' }])
      .select('shipment_id')
      .single();
    if (shipmentError) throw new Error(`Failed to create shipment fixture: ${shipmentError.message}`);

    // Trigger enforce_shipment_line_qty_limit fires BEFORE INSERT -> baris ini DITOLAK
    // sebelum sempat tercipta sama sekali (bukan ditolak belakangan saat status=shipped).
    const { error: insertError } = await adminClient
      .from('shipment_lines')
      .insert([{ shipment_id: shipment!.shipment_id, sales_order_line_id: solSmall!.sales_order_line_id, item_id: itemId, qty_shipped: 15, lot_id: lotBig!.lot_id }]);

    expect(insertError).not.toBeNull();
    expect(insertError!.message).toContain('Jumlah melebihi sisa pesanan');
    expect(insertError!.message).toContain('sisa 10');
    expect(insertError!.message).toContain('diminta 15');

    const { data: linesAfter } = await adminClient.from('shipment_lines').select('shipment_line_id').eq('shipment_id', shipment!.shipment_id);
    expect(linesAfter).toEqual([]);

    const { data: solSmallAfter } = await adminClient.from('sales_order_lines').select('qty_ordered, qty_shipped').eq('sales_order_line_id', solSmall!.sales_order_line_id).single();
    expect(Number(solSmallAfter!.qty_ordered)).toBe(10);
    expect(Number(solSmallAfter!.qty_shipped)).toBe(0);
  });

  it('ship qty TEPAT SAMA dengan sisa qty_ordered SO line -> DIIZINKAN (batas atas, bukan strictly-less-than)', async () => {
    const { data: solExact, error: solExactError } = await adminClient
      .from('sales_order_lines')
      .insert([{ sales_order_id: soId, item_id: itemId, qty_ordered: 20, unit_price: 5000 }])
      .select('sales_order_line_id')
      .single();
    if (solExactError) throw new Error(`Failed to create solExact fixture: ${solExactError.message}`);

    const { data: lotBig, error: lotBigError } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, lot_number: 'LOT-SHIPTEST-EXACT', quantity_on_hand: 1000, source_type: 'produced', status: 'available' }])
      .select('lot_id')
      .single();
    if (lotBigError) throw new Error(`Failed to create lotBig fixture: ${lotBigError.message}`);

    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .insert([{ company_id: companyId, sales_order_id: soId, shipment_number: 'SJ-EXACTSHIP/8-STC/2026', delivery_address: 'Jl. Exact Test' }])
      .select('shipment_id')
      .single();
    if (shipmentError) throw new Error(`Failed to create shipment fixture: ${shipmentError.message}`);

    const { error: insertError } = await adminClient
      .from('shipment_lines')
      .insert([{ shipment_id: shipment!.shipment_id, sales_order_line_id: solExact!.sales_order_line_id, item_id: itemId, qty_shipped: 20, lot_id: lotBig!.lot_id }]);
    expect(insertError).toBeNull();

    const { error } = await adminClient.from('shipments').update({ status: 'shipped', dispatch_photo_url: 'https://example.com/test-dispatch-photo.png' }).eq('shipment_id', shipment!.shipment_id);
    expect(error).toBeNull();

    const { data: solAfter } = await adminClient.from('sales_order_lines').select('qty_ordered, qty_shipped').eq('sales_order_line_id', solExact!.sales_order_line_id).single();
    expect(Number(solAfter!.qty_ordered)).toBe(20);
    expect(Number(solAfter!.qty_shipped)).toBe(20);
  });

  it('alur penuh: stok TIDAK berkurang saat baris ditambahkan (masih draft), berkurang TEPAT saat status jadi shipped', async () => {
    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .insert([{ company_id: companyId, sales_order_id: soId, shipment_number: 'SJ-FULLFLOW/8-STC/2026', delivery_address: 'Jl. Full Flow Test', recipient_name: 'Budi Penerima', recipient_phone: '08123456789', vehicle_number: 'B 1234 XYZ', driver_name: 'Pak Sopir' }])
      .select('shipment_id, status')
      .single();
    if (shipmentError) throw new Error(`Failed to create shipment fixture: ${shipmentError.message}`);
    expect(shipment!.status).toBe('draft');

    const { error: linesError } = await adminClient.from('shipment_lines').insert([
      { shipment_id: shipment!.shipment_id, sales_order_line_id: solId, item_id: itemId, qty_shipped: 30, lot_id: lotNearId },
      { shipment_id: shipment!.shipment_id, sales_order_line_id: solId, item_id: itemId, qty_shipped: 10, lot_id: lotFarId }
    ]);
    if (linesError) throw new Error(`Failed to insert shipment_lines fixture: ${linesError.message}`);

    const { data: lotsWhileDraft } = await adminClient.from('lots').select('lot_id, quantity_on_hand').in('lot_id', [lotNearId, lotFarId]).order('lot_id');
    expect(Number(lotsWhileDraft![0].quantity_on_hand)).toBe(100);
    expect(Number(lotsWhileDraft![1].quantity_on_hand)).toBe(100);

    const { error: shipError } = await adminClient.from('shipments').update({ status: 'shipped', dispatch_photo_url: 'https://example.com/test-dispatch-photo.png' }).eq('shipment_id', shipment!.shipment_id);
    expect(shipError).toBeNull();

    const { data: lotsAfterShip } = await adminClient.from('lots').select('lot_id, quantity_on_hand').in('lot_id', [lotNearId, lotFarId]).order('lot_id');
    expect(Number(lotsAfterShip![0].quantity_on_hand)).toBe(70);
    expect(Number(lotsAfterShip![1].quantity_on_hand)).toBe(90);

    const { data: movements } = await adminClient.from('stock_movements').select('lot_id, movement_type, qty').eq('reference_doc', `SHIP-${shipment!.shipment_id}`).order('lot_id');
    expect(movements).toHaveLength(2);
    expect(movements![0].lot_id).toBe(lotNearId);
    expect(movements![0].movement_type).toBe('shipment');
    expect(Number(movements![0].qty)).toBe(-30);
    expect(movements![1].lot_id).toBe(lotFarId);
    expect(movements![1].movement_type).toBe('shipment');
    expect(Number(movements![1].qty)).toBe(-10);

    const { data: transitionLog } = await adminClient
      .from('status_transition_log')
      .select('table_name, record_id, from_status, to_status')
      .eq('table_name', 'shipments')
      .eq('record_id', shipment!.shipment_id)
      .single();
    expect(transitionLog).toMatchObject({ from_status: 'draft', to_status: 'shipped' });

    // shipped -> shipped, delivered -> lulus sekali lagi lewat state machine
    const { error: deliverError } = await adminClient.from('shipments').update({ status: 'delivered' }).eq('shipment_id', shipment!.shipment_id);
    expect(deliverError).toBeNull();
  });
});

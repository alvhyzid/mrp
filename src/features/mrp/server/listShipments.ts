import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// GET saja — tanpa pembatasan role tambahan (selaras dengan RLS shipments_select_for_company
// yang cuma menyaring company_id, tanpa syarat role). Aksi (create/status) yang dibatasi role,
// lihat createShipment.ts/updateShipmentStatus.ts.
export async function listShipments(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: shipments, error: shipmentsError } = await adminClient
      .from('shipments')
      .select('shipment_id, sales_order_id, shipment_number, shipment_date, status, delivery_address, recipient_name, recipient_phone, vehicle_number, driver_name, created_at')
      .eq('company_id', appUser.company_id)
      .order('created_at', { ascending: false });
    if (shipmentsError) return { status: 500, body: { error: shipmentsError.message } };
    if (!shipments || shipments.length === 0) {
      return { status: 200, body: { shipments: [] } };
    }

    const shipmentIds = shipments.map((s) => s.shipment_id);
    const soIds = Array.from(new Set(shipments.map((s) => s.sales_order_id)));

    const [linesRes, soRes] = await Promise.all([
      adminClient.from('shipment_lines').select('shipment_line_id, shipment_id, sales_order_line_id, item_id, qty_shipped, lot_id').in('shipment_id', shipmentIds),
      adminClient.from('sales_orders').select('sales_order_id, so_number, customer_id').in('sales_order_id', soIds)
    ]);
    if (linesRes.error) return { status: 500, body: { error: linesRes.error.message } };
    if (soRes.error) return { status: 500, body: { error: soRes.error.message } };

    const itemIds = Array.from(new Set((linesRes.data ?? []).map((l) => l.item_id)));
    const lotIds = Array.from(new Set((linesRes.data ?? []).map((l) => l.lot_id)));
    const customerIds = Array.from(new Set((soRes.data ?? []).map((so) => so.customer_id)));

    const [itemsRes, lotsRes, customersRes] = await Promise.all([
      itemIds.length ? adminClient.from('items').select('item_id, item_code, name, base_uom').in('item_id', itemIds) : Promise.resolve({ data: [], error: null }),
      lotIds.length ? adminClient.from('lots').select('lot_id, lot_number, expiry_date').in('lot_id', lotIds) : Promise.resolve({ data: [], error: null }),
      customerIds.length ? adminClient.from('customers').select('customer_id, name').in('customer_id', customerIds) : Promise.resolve({ data: [], error: null })
    ]);
    if (itemsRes.error) return { status: 500, body: { error: itemsRes.error.message } };
    if (lotsRes.error) return { status: 500, body: { error: lotsRes.error.message } };
    if (customersRes.error) return { status: 500, body: { error: customersRes.error.message } };

    const soById = new Map((soRes.data ?? []).map((so) => [so.sales_order_id, so]));
    const itemsById = new Map((itemsRes.data ?? []).map((i) => [i.item_id, i]));
    const lotsById = new Map((lotsRes.data ?? []).map((l) => [l.lot_id, l]));
    const customersById = new Map((customersRes.data ?? []).map((c) => [c.customer_id, c]));

    const linesByShipmentId = new Map<number, typeof linesRes.data>();
    for (const line of linesRes.data ?? []) {
      const list = linesByShipmentId.get(line.shipment_id) ?? [];
      list.push(line);
      linesByShipmentId.set(line.shipment_id, list);
    }

    const result = shipments.map((shipment) => {
      const so = soById.get(shipment.sales_order_id);
      return {
        shipment_id: shipment.shipment_id,
        shipment_number: shipment.shipment_number,
        shipment_date: shipment.shipment_date,
        status: shipment.status,
        delivery_address: shipment.delivery_address,
        recipient_name: shipment.recipient_name,
        recipient_phone: shipment.recipient_phone,
        vehicle_number: shipment.vehicle_number,
        driver_name: shipment.driver_name,
        created_at: shipment.created_at,
        sales_order_id: shipment.sales_order_id,
        so_number: so?.so_number ?? null,
        customer_id: so?.customer_id ?? null,
        customer_name: so ? (customersById.get(so.customer_id)?.name ?? null) : null,
        lines: (linesByShipmentId.get(shipment.shipment_id) ?? []).map((line) => {
          const item = itemsById.get(line.item_id);
          const lot = lotsById.get(line.lot_id);
          return {
            shipment_line_id: line.shipment_line_id,
            sales_order_line_id: line.sales_order_line_id,
            item_id: line.item_id,
            item_code: item?.item_code ?? null,
            item_name: item?.name ?? null,
            item_base_uom: item?.base_uom ?? null,
            qty_shipped: line.qty_shipped,
            lot_id: line.lot_id,
            lot_number: lot?.lot_number ?? null,
            lot_expiry_date: lot?.expiry_date ?? null
          };
        })
      };
    });

    return { status: 200, body: { shipments: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

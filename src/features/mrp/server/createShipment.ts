import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageShipments } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

type AdminClient = ReturnType<typeof getAdminClient>;

// Format & mekanisme PERSIS meniru generateSoNumber() di processCustomerPurchaseOrder.ts
// (sequence 3-digit reset tahunan per company, kode company dari company_settings key
// 'so_number_company_code' — key-nya dipakai ulang apa adanya, konsepnya generik "kode
// singkat perusahaan", bukan spesifik SO), TAPI prefix "SJ-" (Surat Jalan) supaya tidak
// tertukar visual dengan so_number. SENGAJA cuma 1 implementasi di sini (bukan didup-
// likasi juga sebagai fungsi database seperti process_customer_purchase_order()) — versi
// DB itu diakui sebagai utang teknis sinkronisasi di komentar processCustomerPurchaseOrder.ts,
// tidak direplikasi di sini (lihat migration 20260817140000).
async function generateShipmentNumber(adminClient: AdminClient, companyId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: company } = await adminClient.from('companies').select('name').eq('company_id', companyId).single();
  const { data: setting } = await adminClient
    .from('company_settings')
    .select('setting_value')
    .eq('company_id', companyId)
    .eq('setting_key', 'so_number_company_code')
    .maybeSingle();

  const companyCode = setting?.setting_value?.trim()
    ? setting.setting_value.trim()
    : (company?.name ?? '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'CO';

  const yearStart = new Date(Date.UTC(year, 0, 1)).toISOString();
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1)).toISOString();

  const { count } = await adminClient
    .from('shipments')
    .select('shipment_id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', yearStart)
    .lt('created_at', yearEnd);

  const sequence = (count ?? 0) + 1;
  const sequenceStr = String(sequence).padStart(3, '0');

  return `SJ-${sequenceStr}/${month}-${companyCode}/${year}`;
}

// Header shipments (status default 'draft') + shipment_lines ditulis di sini. Trigger
// database enforce_shipment_line_qty_limit (migration 20260817150000) menolak baris
// yang melebihi sisa qty_ordered SAAT insert — pesan errornya diteruskan APA ADANYA ke
// client (bukan diterjemahkan ulang), supaya staf lihat persis kenapa ditolak. Kalau
// insert baris gagal, header yang baru dibuat DIHAPUS lagi supaya tidak ada draft
// kosong (0 baris) tertinggal di database.
export async function createShipment(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageShipments(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin membuat pengiriman.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const salesOrderId = Number(body.sales_order_id);
    const deliveryAddress = String(body.delivery_address ?? '').trim();
    const recipientName = body.recipient_name ? String(body.recipient_name).trim() : null;
    const recipientPhone = body.recipient_phone ? String(body.recipient_phone).trim() : null;
    const vehicleNumber = body.vehicle_number ? String(body.vehicle_number).trim() : null;
    const driverName = body.driver_name ? String(body.driver_name).trim() : null;

    if (!salesOrderId) {
      return { status: 400, body: { error: 'Sales Order wajib dipilih.' } };
    }
    if (!deliveryAddress) {
      return { status: 400, body: { error: 'Alamat tujuan wajib diisi.' } };
    }
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return { status: 400, body: { error: 'Minimal 1 baris item wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: so, error: soError } = await adminClient
      .from('sales_orders')
      .select('sales_order_id, company_id')
      .eq('sales_order_id', salesOrderId)
      .maybeSingle();
    if (soError) return { status: 500, body: { error: soError.message } };
    if (!so || so.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Sales Order tidak ditemukan di perusahaan Anda.' } };
    }

    const { data: soLines, error: soLinesError } = await adminClient
      .from('sales_order_lines')
      .select('sales_order_line_id, item_id')
      .eq('sales_order_id', salesOrderId);
    if (soLinesError) return { status: 500, body: { error: soLinesError.message } };
    const soLinesById = new Map((soLines ?? []).map((line) => [line.sales_order_line_id, line]));

    const shipmentLines: { sales_order_line_id: number; item_id: number; qty_shipped: number; lot_id: number }[] = [];
    for (const raw of body.lines as Record<string, unknown>[]) {
      const salesOrderLineId = Number(raw.sales_order_line_id);
      const qtyShipped = Number(raw.qty_shipped);
      const lotId = Number(raw.lot_id);
      if (!salesOrderLineId || !Number.isFinite(qtyShipped) || qtyShipped <= 0) continue;
      const soLine = soLinesById.get(salesOrderLineId);
      if (!soLine) return { status: 400, body: { error: 'Salah satu baris Sales Order tidak valid.' } };
      if (!lotId) {
        return { status: 400, body: { error: 'Setiap baris wajib memilih lot (traceability wajib).' } };
      }
      shipmentLines.push({ sales_order_line_id: salesOrderLineId, item_id: soLine.item_id, qty_shipped: qtyShipped, lot_id: lotId });
    }
    if (shipmentLines.length === 0) {
      return { status: 400, body: { error: 'Minimal 1 baris item dengan jumlah dan lot valid wajib diisi.' } };
    }

    const shipmentNumber = await generateShipmentNumber(adminClient, appUser.company_id);

    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .insert([
        {
          company_id: appUser.company_id,
          sales_order_id: salesOrderId,
          shipment_number: shipmentNumber,
          delivery_address: deliveryAddress,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          vehicle_number: vehicleNumber,
          driver_name: driverName
        }
      ])
      .select('shipment_id, shipment_number, status, shipment_date')
      .single();
    if (shipmentError) return { status: 500, body: { error: shipmentError.message } };

    const { data: createdLines, error: linesError } = await adminClient
      .from('shipment_lines')
      .insert(shipmentLines.map((line) => ({ shipment_id: shipment.shipment_id, ...line })))
      .select('shipment_line_id, sales_order_line_id, item_id, qty_shipped, lot_id');

    if (linesError) {
      // Baris gagal (mis. ditolak enforce_shipment_line_qty_limit) -> hapus header
      // draft kosong yang baru dibuat, jangan ditinggal jadi sampah.
      await adminClient.from('shipments').delete().eq('shipment_id', shipment.shipment_id);
      return { status: 400, body: { error: linesError.message } };
    }

    return {
      status: 201,
      body: {
        shipment_id: shipment.shipment_id,
        shipment_number: shipment.shipment_number,
        status: shipment.status,
        shipment_date: shipment.shipment_date,
        lines: createdLines
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

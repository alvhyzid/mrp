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
// 'so_number_company_code'), prefix "SJ-" (Surat Jalan) supaya tidak tertukar visual
// dengan so_number. SENGAJA cuma 1 implementasi di sini, tidak diduplikasi jadi fungsi DB.
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

// Sesi 2 (final, dikoreksi) — GANTI createShipment.ts lama: sekarang Langkah 2 wizard
// (bukan form 1-langkah) SELALU menyertakan tanda tangan. shipments + shipment_lines +
// document_signatures ditulis dalam SATU transaksi lewat RPC
// create_shipment_with_signature() (migration 20260817180000) — kalau salah satu baris
// gagal (mis. ditolak enforce_shipment_line_qty_limit), SEMUANYA batal termasuk header
// shipments, TIDAK ADA lagi manual delete-compensation seperti versi lama.
//
// PENTING: status SELALU tetap 'draft' di sini, stok TIDAK berkurang — itu murni tugas
// tombol "Dikirim" terpisah yang sudah ada (updateShipmentStatus.ts, Sesi 3A/3B),
// TIDAK diubah oleh fungsi ini sama sekali.
export async function createShipmentWithSignature(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageShipments(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin membuat pengiriman.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }
    if (!appUser.signature_url) {
      return { status: 400, body: { error: 'Anda belum mengunggah tanda tangan digital. Unggah dulu lewat halaman Profil.' } };
    }

    const body = await request.json();
    const salesOrderId = Number(body.sales_order_id);
    const deliveryAddress = String(body.delivery_address ?? '').trim();
    const recipientName = body.recipient_name ? String(body.recipient_name).trim() : null;
    const recipientPhone = body.recipient_phone ? String(body.recipient_phone).trim() : null;
    const vehicleNumber = body.vehicle_number ? String(body.vehicle_number).trim() : null;
    const driverName = body.driver_name ? String(body.driver_name).trim() : null;
    const confirmationText = String(body.confirmation_text ?? '').trim();

    if (!salesOrderId) {
      return { status: 400, body: { error: 'Sales Order wajib dipilih.' } };
    }
    if (!deliveryAddress) {
      return { status: 400, body: { error: 'Alamat tujuan wajib diisi.' } };
    }
    if (!confirmationText) {
      return { status: 400, body: { error: 'Teks konfirmasi wajib diisi.' } };
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

    const { data: result, error: rpcError } = await adminClient
      .rpc('create_shipment_with_signature', {
        p_company_id: appUser.company_id,
        p_sales_order_id: salesOrderId,
        p_shipment_number: shipmentNumber,
        p_delivery_address: deliveryAddress,
        p_recipient_name: recipientName,
        p_recipient_phone: recipientPhone,
        p_vehicle_number: vehicleNumber,
        p_driver_name: driverName,
        p_lines: shipmentLines,
        p_signed_by: appUser.user_id,
        p_signer_role: appUser.role,
        p_signature_url_snapshot: appUser.signature_url,
        p_confirmation_text: confirmationText
      })
      .single();

    if (rpcError) {
      return { status: 400, body: { error: rpcError.message } };
    }

    const row = result as { out_shipment_id: number; out_shipment_number: string; out_document_signature_id: number };
    return {
      status: 201,
      body: {
        shipment_id: row.out_shipment_id,
        shipment_number: row.out_shipment_number,
        document_signature_id: row.out_document_signature_id,
        status: 'draft'
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

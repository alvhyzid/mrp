import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageShipments } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// UI (Sesi 3B) cuma mengekspos 2 tombol transisi: draft->shipped dan shipped->delivered
// (sesuai LANGKAH e) — route ini sengaja membatasi target status ke 2 nilai itu saja,
// TAPI legalitas transisi sesungguhnya (termasuk pengurangan stok, insert stock_movements,
// update sales_order_lines.qty_shipped) tetap sepenuhnya ditegakkan oleh trigger database
// enforce_status_transition() + shipments_process_shipped (migration 20260817140000) —
// pesan error dari trigger diteruskan APA ADANYA, tidak diterjemahkan ulang di sini.
const ALLOWED_TARGET_STATUSES = ['shipped', 'delivered'];

export async function updateShipmentStatus(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageShipments(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengubah status pengiriman.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const shipmentId = Number(body.shipment_id);
    const status = String(body.status ?? '').trim();

    if (!shipmentId) {
      return { status: 400, body: { error: 'ID pengiriman tidak valid.' } };
    }
    if (!ALLOWED_TARGET_STATUSES.includes(status)) {
      return { status: 400, body: { error: 'Status tujuan tidak valid (harus shipped/delivered).' } };
    }

    const adminClient = getAdminClient();

    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .select('shipment_id, company_id, status')
      .eq('shipment_id', shipmentId)
      .maybeSingle();
    if (shipmentError) return { status: 500, body: { error: shipmentError.message } };
    if (!shipment || shipment.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Pengiriman tidak ditemukan di perusahaan Anda.' } };
    }

    const { data: updated, error: updateError } = await adminClient
      .from('shipments')
      .update({ status })
      .eq('shipment_id', shipmentId)
      .select('shipment_id, status')
      .single();

    if (updateError) {
      return { status: 400, body: { error: updateError.message } };
    }

    return { status: 200, body: { shipment_id: updated.shipment_id, status: updated.status } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canAccessWarehouseDashboard } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Header goods_receipts + baris goods_receipt_lines ditulis di sini; SISANYA
// (konversi purchase_uom -> base_uom pakai items.uom_conversion_factor, insert
// lots baru, stock_movements, update purchase_order_lines.qty_received, resolve
// system_alerts material_shortage/po_delayed) dikerjakan OTOMATIS oleh trigger DB
// process_goods_receipt_line() (migrasi 20260812154500) — sengaja tidak
// diduplikasi di sini, satu sumber kebenaran di database.
export async function createGoodsReceipt(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canAccessWarehouseDashboard(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin konfirmasi barang datang.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const purchaseOrderId = Number(body.purchase_order_id);
    if (!purchaseOrderId) return { status: 400, body: { error: 'PO Supplier wajib diisi.' } };
    if (!Array.isArray(body.lines) || body.lines.length === 0) return { status: 400, body: { error: 'Minimal 1 baris item diterima wajib diisi.' } };

    const adminClient = getAdminClient();

    const { data: po, error: poError } = await adminClient
      .from('purchase_orders')
      .select('purchase_order_id, company_id, production_plant_id, status')
      .eq('purchase_order_id', purchaseOrderId)
      .maybeSingle();
    if (poError) return { status: 500, body: { error: poError.message } };
    if (!po || po.company_id !== appUser.company_id) return { status: 404, body: { error: 'PO tidak ditemukan.' } };
    if (po.status === 'received' || po.status === 'cancelled') {
      return { status: 400, body: { error: 'PO ini sudah diterima penuh atau dibatalkan.' } };
    }

    const { data: poLines, error: poLinesError } = await adminClient
      .from('purchase_order_lines')
      .select('purchase_order_line_id, item_id, qty_ordered, qty_received')
      .eq('purchase_order_id', purchaseOrderId);
    if (poLinesError) return { status: 500, body: { error: poLinesError.message } };
    const poLinesById = new Map((poLines ?? []).map((l) => [l.purchase_order_line_id, l]));

    const receiptLines: { purchase_order_line_id: number; item_id: number; qty_received: number }[] = [];
    for (const raw of body.lines as Record<string, unknown>[]) {
      const purchaseOrderLineId = Number(raw.purchase_order_line_id);
      const qtyReceived = Number(raw.qty_received);
      if (!purchaseOrderLineId || !Number.isFinite(qtyReceived) || qtyReceived <= 0) continue;
      const poLine = poLinesById.get(purchaseOrderLineId);
      if (!poLine) return { status: 400, body: { error: 'Salah satu baris PO tidak valid.' } };
      receiptLines.push({ purchase_order_line_id: purchaseOrderLineId, item_id: poLine.item_id, qty_received: qtyReceived });
    }
    if (receiptLines.length === 0) return { status: 400, body: { error: 'Jumlah diterima wajib diisi minimal 1 baris.' } };

    const { data: gr, error: grError } = await adminClient
      .from('goods_receipts')
      .insert([{ company_id: appUser.company_id, purchase_order_id: purchaseOrderId, production_plant_id: po.production_plant_id, received_by: appUser.user_id, status: 'completed' }])
      .select('goods_receipt_id')
      .single();
    if (grError) return { status: 500, body: { error: grError.message } };

    // BAGIAN 3 (22 Agu 2026) — keputusan pemilik produk: penerimaan MELEBIHI
    // qty dipesan pada 1 baris PO DIIZINKAN (barang sudah ADA secara fisik di
    // gudang saat sistem tahu — menolak cuma bikin kelebihan itu tidak
    // tercatat), TAPI diberi peringatan + tercatat sebagai kejadian tersendiri
    // (kelebihan menyangkut uang, tagihan supplier akan lebih besar dari PO).
    // BUKAN gerbang keras — dihitung dari qty_received SEBELUM penerimaan ini
    // (poLinesById, diambil sebelum loop insert di bawah).
    const overageWarnings: { item_id: number; qty_ordered: number; qty_received_total: number; qty_over: number }[] = [];

    // Trigger process_goods_receipt_line() jalan PER BARIS saat insert ini — jadi
    // dikirim satu-satu (bukan bulk insert) supaya tiap baris pasti lewat trigger
    // dengan data goods_receipt_line_id yang benar untuk update lot_id-nya sendiri.
    for (const line of receiptLines) {
      const { data: insertedLine, error: lineError } = await adminClient
        .from('goods_receipt_lines')
        .insert([{ goods_receipt_id: gr.goods_receipt_id, purchase_order_line_id: line.purchase_order_line_id, item_id: line.item_id, qty_received: line.qty_received }])
        .select('goods_receipt_line_id')
        .single();
      if (lineError) return { status: 500, body: { error: lineError.message } };

      const poLine = poLinesById.get(line.purchase_order_line_id)!;
      const qtyRemainingBefore = poLine.qty_ordered - poLine.qty_received;
      const qtyOver = line.qty_received - qtyRemainingBefore;
      if (qtyOver > 0) {
        const qtyReceivedTotal = poLine.qty_received + line.qty_received;
        const { error: overageError } = await adminClient.from('goods_receipt_overage_log').insert([
          {
            company_id: appUser.company_id,
            goods_receipt_line_id: insertedLine!.goods_receipt_line_id,
            purchase_order_line_id: line.purchase_order_line_id,
            item_id: line.item_id,
            qty_ordered: poLine.qty_ordered,
            qty_received_total: qtyReceivedTotal,
            qty_over: qtyOver,
            received_by: appUser.user_id
          }
        ]);
        if (overageError) return { status: 500, body: { error: overageError.message } };
        overageWarnings.push({ item_id: line.item_id, qty_ordered: poLine.qty_ordered, qty_received_total: qtyReceivedTotal, qty_over: qtyOver });
      }
    }

    // purchase_orders.status TIDAK diupdate oleh trigger DB (cuma qty_received per
    // baris) — hitung di sini apakah semua baris sudah terpenuhi penuh.
    const { data: updatedLines, error: updatedLinesError } = await adminClient
      .from('purchase_order_lines')
      .select('qty_ordered, qty_received')
      .eq('purchase_order_id', purchaseOrderId);
    if (updatedLinesError) return { status: 500, body: { error: updatedLinesError.message } };
    const allReceived = (updatedLines ?? []).every((l) => l.qty_received >= l.qty_ordered);
    const anyReceived = (updatedLines ?? []).some((l) => l.qty_received > 0);
    const newStatus = allReceived ? 'received' : anyReceived ? 'partially_received' : po.status;
    if (newStatus !== po.status) {
      const { error: statusError } = await adminClient.from('purchase_orders').update({ status: newStatus }).eq('purchase_order_id', purchaseOrderId);
      if (statusError) return { status: 500, body: { error: statusError.message } };
    }

    const { data: createdLines, error: createdLinesError } = await adminClient
      .from('goods_receipt_lines')
      .select('goods_receipt_line_id, item_id, qty_received, lot_id')
      .eq('goods_receipt_id', gr.goods_receipt_id);
    if (createdLinesError) return { status: 500, body: { error: createdLinesError.message } };

    const warnings = overageWarnings.map(
      (w) => `Item ${w.item_id}: dipesan ${w.qty_ordered}, diterima total ${w.qty_received_total} — lebih ${w.qty_over} dari yang dipesan.`
    );

    return { status: 201, body: { goods_receipt_id: gr.goods_receipt_id, purchase_order_status: newStatus, lines: createdLines, warnings } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Margin Watch — ambang margin minimum per SO line ("jangan sampai di bawah
// RpX"), BOLEH diubah kapan saja (beda dari baseline cost/harga snapshot yang
// terkunci permanen) — murni preferensi pemilik order. HANYA kolom ini yang
// pernah di-UPDATE dari app layer; baseline cost/harga tidak pernah tersentuh
// endpoint ini sama sekali.
export async function updateMarginFloorThreshold(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canViewFinancialData(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya akses ke Margin Watch.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const salesOrderLineId = Number(body.sales_order_line_id);
    if (!salesOrderLineId) {
      return { status: 400, body: { error: 'sales_order_line_id wajib diisi.' } };
    }
    const thresholdRaw = body.margin_floor_threshold;
    const threshold = thresholdRaw === null || thresholdRaw === '' || thresholdRaw === undefined ? null : Number(thresholdRaw);
    if (threshold !== null && !Number.isFinite(threshold)) {
      return { status: 400, body: { error: 'Ambang margin harus berupa angka (atau dikosongkan untuk menonaktifkan peringatan).' } };
    }

    const adminClient = getAdminClient();
    const { data: snapshot, error: snapshotError } = await adminClient
      .from('sales_order_line_margin_snapshots')
      .select('sales_order_line_margin_snapshot_id, company_id')
      .eq('sales_order_line_id', salesOrderLineId)
      .is('archived_at', null)
      .maybeSingle();
    if (snapshotError) return { status: 500, body: { error: snapshotError.message } };
    if (!snapshot || snapshot.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Belum ada baseline Margin Watch yang terkunci untuk baris ini — kunci baseline dulu (tombol "Kunci sebagai Acuan Pembanding") supaya ambang margin bisa diatur.' } };
    }

    const { error: updateError } = await adminClient
      .from('sales_order_line_margin_snapshots')
      .update({ margin_floor_threshold: threshold })
      .eq('sales_order_line_margin_snapshot_id', snapshot.sales_order_line_margin_snapshot_id);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

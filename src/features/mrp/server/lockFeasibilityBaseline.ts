import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Sesi 0C (21 Agu 2026) — aksi EKSPLISIT terpisah dari getPlanningFeasibility.ts
// (yang sekarang murni membaca/menghitung, tidak pernah menulis). SEBELUMNYA
// peran ppic_manager/ppic_staff/production_manager ikut bisa memicu penulisan
// ini lewat sekadar membuka panel "Cek Kelayakan" -- keputusan produk baru
// (0C.3) mempersempit AKSI MENGUNCI ke peran berkewenangan finansial saja;
// melihat/menghitung kelayakan tetap terbuka untuk peran PPIC/Purchasing
// seperti sebelumnya (tidak berubah, lihat getPlanningFeasibility.ts).
export async function lockFeasibilityBaseline(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canViewFinancialData(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya kewenangan finansial untuk mengunci rencana Kelayakan Jadwal.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const salesOrderLineId = Number(body.sales_order_line_id);
    if (!salesOrderLineId) {
      return { status: 400, body: { error: 'sales_order_line_id wajib diisi.' } };
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    const adminClient = getAdminClient();

    const { data: soLine, error: soLineError } = await adminClient
      .from('sales_order_lines')
      .select('sales_order_line_id, sales_order_id, item_id')
      .eq('sales_order_line_id', salesOrderLineId)
      .maybeSingle();
    if (soLineError) return { status: 500, body: { error: soLineError.message } };
    if (!soLine) return { status: 404, body: { error: 'Baris sales order tidak ditemukan.' } };

    const { data: so, error: soError } = await adminClient.from('sales_orders').select('company_id').eq('sales_order_id', soLine.sales_order_id).maybeSingle();
    if (soError) return { status: 500, body: { error: soError.message } };
    if (!so || so.company_id !== appUser.company_id) return { status: 404, body: { error: 'Sales order tidak ditemukan di perusahaan Anda.' } };

    const { data: standards, error: standardsError } = await adminClient
      .from('production_standards')
      .select('metric_key, value')
      .eq('company_id', appUser.company_id)
      .eq('item_id', soLine.item_id)
      .is('routing_step_id', null)
      .in('metric_key', ['unit_per_batch', 'batches_per_day']);
    if (standardsError) return { status: 500, body: { error: standardsError.message } };
    const unitPerBatch = standards?.find((s) => s.metric_key === 'unit_per_batch')?.value;
    const batchesPerDay = standards?.find((s) => s.metric_key === 'batches_per_day')?.value;
    if (!unitPerBatch || !batchesPerDay) {
      return { status: 400, body: { error: 'Belum bisa dikunci: standar unit-per-batch dan/atau kapasitas batch/hari belum ada untuk item ini.' } };
    }

    const { data: existingActive, error: existingError } = await adminClient
      .from('sales_order_line_feasibility_snapshots')
      .select('sales_order_line_feasibility_snapshot_id')
      .eq('sales_order_line_id', salesOrderLineId)
      .is('archived_at', null)
      .maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };

    if (existingActive) {
      if (appUser.role !== 'company_admin') {
        return { status: 403, body: { error: 'Rencana Kelayakan Jadwal untuk baris ini sudah terkunci -- hanya company_admin yang boleh mengunci ulang.' } };
      }
      if (!reason) {
        return { status: 400, body: { error: 'Alasan wajib diisi untuk mengunci ulang rencana yang sudah ada.' } };
      }

      const { error: archiveError } = await adminClient
        .from('sales_order_line_feasibility_snapshots')
        .update({ archived_at: new Date().toISOString(), archived_reason: reason })
        .eq('sales_order_line_feasibility_snapshot_id', existingActive.sales_order_line_feasibility_snapshot_id);
      if (archiveError) return { status: 500, body: { error: archiveError.message } };
    }

    const { data: inserted, error: insertError } = await adminClient
      .from('sales_order_line_feasibility_snapshots')
      .insert([
        {
          company_id: appUser.company_id,
          sales_order_line_id: salesOrderLineId,
          unit_per_batch: unitPerBatch,
          batches_per_day: batchesPerDay,
          locked_by: appUser.user_id,
          relock_reason: existingActive ? reason : null
        }
      ])
      .select('sales_order_line_feasibility_snapshot_id, created_at')
      .single();
    if (insertError) return { status: 500, body: { error: insertError.message } };

    return { status: 200, body: { success: true, locked_at: inserted.created_at, was_relock: !!existingActive } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

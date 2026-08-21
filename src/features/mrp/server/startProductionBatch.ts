import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canRecordStepProgress } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// "Mulai Batch" (Fase Produksi Nyata, P1) — planned -> in_progress. Transisi
// sudah terdaftar di status_transition_rules (migration 20260817100000) sejak
// awal, cuma belum pernah ada kode aplikasi yang benar-benar memicunya. UPDATE
// di sini SENGAJA tidak memvalidasi transisi sendiri — trigger enforce_status_
// transition() di database yang menegakkan, supaya tidak ada 2 tempat berbeda
// yang bisa longgar sendiri-sendiri.
//
// Sesi 6A (21 Agu 2026) — SAAT batch dimulai (bukan dibuat, bukan selesai),
// beku-kan (snapshot) routing_steps/routing_step_standard_crew/bom_lines yang
// SEDANG berlaku untuk work_order_id/bom_id/routing_id batch ini. Alasan:
// updateRouting.ts/updateBom.ts menimpa LANGSUNG baris routing_id/bom_id yang
// SAMA (delete+reinsert, bukan versi baru) -- tanpa snapshot ini, mengedit
// routing/BOM hari ini diam-diam mengubah "durasi standar"/"kebutuhan bahan"
// yang ditampilkan untuk batch yang SUDAH SELESAI kemarin (lihat komentar
// migrasi 20260827230000 utk bukti kode persisnya). Aritmatika TIDAK berubah,
// cuma SUMBER angkanya -- batch yang BELUM dimulai (status planned) TETAP
// membaca master hidup (6A.4), supaya perbaikan routing/BOM sebelum batch
// jalan tetap berlaku seperti biasa.
export async function startProductionBatch(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canRecordStepProgress(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin memulai batch produksi.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const productionBatchId = Number(body.production_batch_id);
    if (!productionBatchId) {
      return { status: 400, body: { error: 'production_batch_id wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, company_id, status, work_order_id')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan di perusahaan Anda.' } };
    }

    const { data: workOrder, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, bom_id, routing_id')
      .eq('work_order_id', batch.work_order_id)
      .maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };

    const snapshotFields: Record<string, unknown> = { status: 'in_progress', started_at: new Date().toISOString() };

    if (workOrder?.routing_id) {
      const { data: steps, error: stepsError } = await adminClient
        .from('routing_steps')
        .select('routing_step_id, sequence_no, step_name, work_center_id, active_duration_minutes, wait_duration_minutes, duration_per_unit_minutes')
        .eq('routing_id', workOrder.routing_id);
      if (stepsError) return { status: 500, body: { error: stepsError.message } };

      const workCenterIds = Array.from(new Set((steps ?? []).map((s) => s.work_center_id).filter((id): id is number => !!id)));
      const { data: workCenters } = workCenterIds.length
        ? await adminClient.from('work_centers').select('work_center_id, name, code').in('work_center_id', workCenterIds)
        : { data: [] as { work_center_id: number; name: string; code: string }[] };
      const workCentersById = new Map((workCenters ?? []).map((wc) => [wc.work_center_id, wc]));

      if (steps && steps.length > 0) {
        const { error: stepSnapshotError } = await adminClient.from('production_batch_routing_step_snapshots').insert(
          steps.map((step) => ({
            company_id: appUser.company_id,
            production_batch_id: productionBatchId,
            routing_step_id: step.routing_step_id,
            sequence_no: step.sequence_no,
            step_name: step.step_name,
            work_center_id: step.work_center_id,
            work_center_name: step.work_center_id ? workCentersById.get(step.work_center_id)?.name ?? null : null,
            work_center_code: step.work_center_id ? workCentersById.get(step.work_center_id)?.code ?? null : null,
            active_duration_minutes: step.active_duration_minutes,
            wait_duration_minutes: step.wait_duration_minutes,
            duration_per_unit_minutes: step.duration_per_unit_minutes
          }))
        );
        if (stepSnapshotError) return { status: 500, body: { error: stepSnapshotError.message } };
      }

      const { data: crew, error: crewError } = await adminClient
        .from('routing_step_standard_crew')
        .select('routing_step_standard_crew_id, role_label, wage_type, headcount, hours_per_day, is_full_day_dedicated, source, notes')
        .eq('routing_id', workOrder.routing_id);
      if (crewError) return { status: 500, body: { error: crewError.message } };
      if (crew && crew.length > 0) {
        const { error: crewSnapshotError } = await adminClient.from('production_batch_standard_crew_snapshots').insert(
          crew.map((c) => ({
            company_id: appUser.company_id,
            production_batch_id: productionBatchId,
            routing_step_standard_crew_id: c.routing_step_standard_crew_id,
            role_label: c.role_label,
            wage_type: c.wage_type,
            headcount: c.headcount,
            hours_per_day: c.hours_per_day,
            is_full_day_dedicated: c.is_full_day_dedicated,
            source: c.source,
            notes: c.notes
          }))
        );
        if (crewSnapshotError) return { status: 500, body: { error: crewSnapshotError.message } };
      }

      snapshotFields.snapshotted_routing_id = workOrder.routing_id;
    }

    if (workOrder?.bom_id) {
      const { data: bom, error: bomError } = await adminClient.from('boms').select('bom_id, version, buffer_percentage').eq('bom_id', workOrder.bom_id).maybeSingle();
      if (bomError) return { status: 500, body: { error: bomError.message } };

      const { data: lines, error: linesError } = await adminClient
        .from('bom_lines')
        .select('bom_line_id, component_item_id, qty_per_unit_output, uom, routing_step_id')
        .eq('bom_id', workOrder.bom_id);
      if (linesError) return { status: 500, body: { error: linesError.message } };

      if (lines && lines.length > 0) {
        const { error: lineSnapshotError } = await adminClient.from('production_batch_bom_line_snapshots').insert(
          lines.map((line) => ({
            company_id: appUser.company_id,
            production_batch_id: productionBatchId,
            bom_line_id: line.bom_line_id,
            component_item_id: line.component_item_id,
            qty_per_unit_output: line.qty_per_unit_output,
            uom: line.uom,
            routing_step_id: line.routing_step_id
          }))
        );
        if (lineSnapshotError) return { status: 500, body: { error: lineSnapshotError.message } };
      }

      snapshotFields.snapshotted_bom_id = workOrder.bom_id;
      snapshotFields.snapshotted_bom_version = bom?.version ?? null;
      snapshotFields.snapshotted_buffer_percentage = bom?.buffer_percentage ?? null;
    }

    snapshotFields.routing_snapshot_taken_at = new Date().toISOString();

    const { error: updateError } = await adminClient.from('production_batches').update(snapshotFields).eq('production_batch_id', productionBatchId);
    if (updateError) return { status: 400, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

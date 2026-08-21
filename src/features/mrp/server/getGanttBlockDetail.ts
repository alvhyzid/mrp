import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canAccessPpicDashboard } from '@/lib/roles';
import { getEffectiveStepDurationMinutes } from './stepDuration';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Detail 1 blok Gantt (1 routing_step untuk 1 production_batch), dipanggil saat
// user klik blok. Akses disamakan dengan Dashboard PPIC tempat Gantt-nya tampil —
// siapa pun yang boleh lihat Gantt boleh lihat detail bloknya. Sengaja TIDAK
// menyertakan employees.wage_rate (data finansial sensitif) di work_order_assignments.
export async function getGanttBlockDetail(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }
    if (!canAccessPpicDashboard(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin melihat Gantt Produksi.' } };
    }

    const productionBatchId = Number(request.nextUrl.searchParams.get('production_batch_id'));
    const routingStepId = Number(request.nextUrl.searchParams.get('routing_step_id'));
    if (!productionBatchId || !routingStepId) {
      return { status: 400, body: { error: 'Batch produksi dan tahap routing wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, company_id, work_order_id, batch_number, planned_qty, uom, planned_date, status, started_at, completed_at, shift_id, routing_snapshot_taken_at')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan.' } };
    }

    // Sesi 6A (21 Agu 2026) — batch yang SUDAH DIMULAI membaca durasi standar dari
    // SNAPSHOT beku (production_batch_routing_step_snapshots), BUKAN routing_steps
    // hidup — supaya mengedit routing hari ini tidak diam-diam mengubah "durasi
    // standar" yang tampil untuk batch yang sudah berjalan/selesai. Batch yang
    // BELUM dimulai (routing_snapshot_taken_at masih null, status masih 'planned')
    // tetap membaca master hidup (6A.4) — dan batch LAMA sebelum fitur ini ada
    // (status sudah in_progress/completed TAPI routing_snapshot_taken_at null)
    // ditandai jujur "tanpa snapshot (sebelum fitur ini)", bukan snapshot karangan.
    const usesSnapshot = !!batch.routing_snapshot_taken_at;
    const isLegacyWithoutSnapshot = !batch.routing_snapshot_taken_at && batch.status !== 'planned';

    let step: { routing_step_id: number | null; routing_id?: number; sequence_no: number; step_name: string; work_center_id: number | null; active_duration_minutes: number | null; duration_per_unit_minutes: number | null; wait_duration_minutes: number | null } | null = null;
    let workCenterNameFromSnapshot: string | null = null;
    let workCenterCodeFromSnapshot: string | null = null;

    if (usesSnapshot) {
      const { data: stepSnapshot, error: stepSnapshotError } = await adminClient
        .from('production_batch_routing_step_snapshots')
        .select('routing_step_id, sequence_no, step_name, work_center_id, work_center_name, work_center_code, active_duration_minutes, duration_per_unit_minutes, wait_duration_minutes')
        .eq('production_batch_id', productionBatchId)
        .eq('routing_step_id', routingStepId)
        .maybeSingle();
      if (stepSnapshotError) return { status: 500, body: { error: stepSnapshotError.message } };
      if (!stepSnapshot) return { status: 404, body: { error: 'Tahap routing (versi beku batch ini) tidak ditemukan.' } };
      step = stepSnapshot;
      workCenterNameFromSnapshot = stepSnapshot.work_center_name;
      workCenterCodeFromSnapshot = stepSnapshot.work_center_code;
    } else {
      const { data: liveStep, error: stepError } = await adminClient
        .from('routing_steps')
        .select('routing_step_id, routing_id, sequence_no, step_name, work_center_id, active_duration_minutes, duration_per_unit_minutes, wait_duration_minutes')
        .eq('routing_step_id', routingStepId)
        .maybeSingle();
      if (stepError) return { status: 500, body: { error: stepError.message } };
      if (!liveStep) return { status: 404, body: { error: 'Tahap routing tidak ditemukan.' } };
      step = liveStep;
    }

    const { data: workOrder, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, item_id, routing_id')
      .eq('work_order_id', batch.work_order_id)
      .maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!workOrder) return { status: 404, body: { error: 'Work Order tidak ditemukan.' } };
    if (!usesSnapshot && workOrder.routing_id !== step.routing_id) {
      return { status: 400, body: { error: 'Tahap routing ini tidak terkait dengan Work Order batch ini.' } };
    }

    const [itemRes, workCenterRes, shiftRes, assignmentsRes, progressRes] = await Promise.all([
      adminClient.from('items').select('item_id, item_code, name').eq('item_id', workOrder.item_id).maybeSingle(),
      !usesSnapshot && step.work_center_id
        ? adminClient.from('work_centers').select('work_center_id, name, code').eq('work_center_id', step.work_center_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      batch.shift_id
        ? adminClient.from('shifts').select('shift_id, name, start_time, end_time').eq('shift_id', batch.shift_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      adminClient
        .from('work_order_assignments')
        .select('work_order_assignment_id, employee_id, status, scheduled_hours, actual_hours, qty_produced')
        .eq('production_batch_id', productionBatchId)
        .eq('routing_step_id', routingStepId),
      adminClient
        .from('work_order_step_progress')
        .select('work_order_step_progress_id, status, qty_input, uom_input, qty_recorded, qty_reject, reject_reason, uom, started_at, completed_at, notes')
        .eq('production_batch_id', productionBatchId)
        .eq('routing_step_id', routingStepId)
        .order('work_order_step_progress_id', { ascending: false })
    ]);
    if (itemRes.error) return { status: 500, body: { error: itemRes.error.message } };
    if (workCenterRes.error) return { status: 500, body: { error: workCenterRes.error.message } };
    if (shiftRes.error) return { status: 500, body: { error: shiftRes.error.message } };
    if (assignmentsRes.error) return { status: 500, body: { error: assignmentsRes.error.message } };
    if (progressRes.error) return { status: 500, body: { error: progressRes.error.message } };

    const employeeIds = Array.from(new Set((assignmentsRes.data ?? []).map((a) => a.employee_id)));
    const { data: employees, error: employeesError } = employeeIds.length
      ? await adminClient.from('employees').select('employee_id, name, position').in('employee_id', employeeIds)
      : { data: [] as { employee_id: number; name: string; position: string | null }[], error: null };
    if (employeesError) return { status: 500, body: { error: employeesError.message } };
    const employeesById = new Map((employees ?? []).map((e) => [e.employee_id, e]));

    return {
      status: 200,
      body: {
        batch: {
          production_batch_id: batch.production_batch_id,
          work_order_id: batch.work_order_id,
          batch_number: batch.batch_number,
          planned_qty: batch.planned_qty,
          uom: batch.uom,
          planned_date: batch.planned_date,
          status: batch.status,
          started_at: batch.started_at,
          completed_at: batch.completed_at
        },
        item: itemRes.data ? { item_code: itemRes.data.item_code, item_name: itemRes.data.name } : null,
        step: {
          routing_step_id: step.routing_step_id,
          step_name: step.step_name,
          sequence_no: step.sequence_no,
          active_duration_minutes: getEffectiveStepDurationMinutes(step, Number(batch.planned_qty)),
          wait_duration_minutes: step.wait_duration_minutes ?? 0
        },
        // Sesi 6A: durasi_standar_dari_snapshot = true berarti angka di atas BEKU
        // sejak batch ini dimulai (tidak ikut berubah walau routing diedit
        // sesudahnya). tanpa_snapshot_batch_lama = true berarti batch ini sudah
        // berjalan/selesai TAPI dibuat SEBELUM fitur ini ada -- angkanya di atas
        // masih dibaca live (apa adanya, bukan snapshot karangan).
        durasi_standar_dari_snapshot: usesSnapshot,
        tanpa_snapshot_batch_lama: isLegacyWithoutSnapshot,
        workCenter: usesSnapshot
          ? workCenterNameFromSnapshot
            ? { name: workCenterNameFromSnapshot, code: workCenterCodeFromSnapshot }
            : null
          : workCenterRes.data
            ? { name: workCenterRes.data.name, code: workCenterRes.data.code }
            : null,
        shift: shiftRes.data ? { name: shiftRes.data.name, start_time: shiftRes.data.start_time, end_time: shiftRes.data.end_time } : null,
        assignments: (assignmentsRes.data ?? []).map((a) => ({
          work_order_assignment_id: a.work_order_assignment_id,
          employee_name: employeesById.get(a.employee_id)?.name ?? null,
          employee_position: employeesById.get(a.employee_id)?.position ?? null,
          status: a.status,
          scheduled_hours: a.scheduled_hours,
          actual_hours: a.actual_hours,
          qty_produced: a.qty_produced
        })),
        progress: (progressRes.data ?? []).map((p) => ({
          ...p,
          // % susut = (input - output) / input × 100 — cuma dihitung kalau input DAN
          // output sama-sama ada (mis. baru mulai, output belum dicatat -> null).
          shrinkage_pct: p.qty_input !== null && p.qty_input > 0 && p.qty_recorded !== null ? Math.round(((p.qty_input - p.qty_recorded) / p.qty_input) * 10000) / 100 : null
        }))
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

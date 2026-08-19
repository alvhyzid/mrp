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
      return { status: 400, body: { error: 'production_batch_id dan routing_step_id wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, company_id, work_order_id, batch_number, planned_qty, uom, planned_date, status, started_at, completed_at, shift_id')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan.' } };
    }

    const { data: step, error: stepError } = await adminClient
      .from('routing_steps')
      .select('routing_step_id, routing_id, sequence_no, step_name, work_center_id, active_duration_minutes, duration_per_unit_minutes, wait_duration_minutes')
      .eq('routing_step_id', routingStepId)
      .maybeSingle();
    if (stepError) return { status: 500, body: { error: stepError.message } };
    if (!step) return { status: 404, body: { error: 'Tahap routing tidak ditemukan.' } };

    const { data: workOrder, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, item_id, routing_id')
      .eq('work_order_id', batch.work_order_id)
      .maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!workOrder || workOrder.routing_id !== step.routing_id) {
      return { status: 400, body: { error: 'Tahap routing ini tidak terkait dengan Work Order batch ini.' } };
    }

    const [itemRes, workCenterRes, shiftRes, assignmentsRes, progressRes] = await Promise.all([
      adminClient.from('items').select('item_id, item_code, name').eq('item_id', workOrder.item_id).maybeSingle(),
      step.work_center_id
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
        .select('work_order_step_progress_id, status, qty_input, uom_input, qty_recorded, uom, started_at, completed_at, notes')
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
        workCenter: workCenterRes.data ? { name: workCenterRes.data.name, code: workCenterRes.data.code } : null,
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

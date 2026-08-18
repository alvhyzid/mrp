import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageWorkOrder } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Labor log — pencatatan jam kerja AKTUAL per orang per batch (GELOMBANG 2 poin 2,
// spesifikasi-aturan-biaya-v1.md K1/K4). Tabel work_order_assignments sudah ada dari
// modul Work Order lama, TAPI belum pernah ada endpoint yang menulis ke situ — di sini
// dipakai APA ADANYA (perluas pemakaian, bukan restrukturisasi), field yang dipakai
// cuma production_batch_id, employee_id, actual_hours, work_date (kolom baru,
// migration 20260818100000) + qty_produced (utk wage_type piece_rate).
export async function recordLaborLog(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageWorkOrder(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mencatat jam kerja.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const workOrderId = Number(body.work_order_id);
    const productionBatchId = Number(body.production_batch_id);
    const employeeId = Number(body.employee_id);
    const actualHours = body.actual_hours !== undefined && body.actual_hours !== null ? Number(body.actual_hours) : null;
    const qtyProduced = body.qty_produced !== undefined && body.qty_produced !== null ? Number(body.qty_produced) : null;
    const workDate = body.work_date ? String(body.work_date).trim() : new Date().toISOString().slice(0, 10);

    if (!workOrderId || !productionBatchId || !employeeId) {
      return { status: 400, body: { error: 'Work Order, batch produksi, dan karyawan wajib dipilih.' } };
    }
    if (actualHours === null && qtyProduced === null) {
      return { status: 400, body: { error: 'Isi jam kerja aktual atau jumlah hasil (piece rate).' } };
    }
    if (actualHours !== null && (!Number.isFinite(actualHours) || actualHours <= 0)) {
      return { status: 400, body: { error: 'Jam kerja aktual harus lebih besar dari 0.' } };
    }
    if (qtyProduced !== null && (!Number.isFinite(qtyProduced) || qtyProduced <= 0)) {
      return { status: 400, body: { error: 'Jumlah hasil (piece rate) harus lebih besar dari 0.' } };
    }

    const adminClient = getAdminClient();

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, work_order_id, company_id, shift_id')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id || batch.work_order_id !== workOrderId) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan untuk Work Order ini.' } };
    }

    const { data: employee, error: employeeError } = await adminClient.from('employees').select('employee_id, company_id, is_active').eq('employee_id', employeeId).maybeSingle();
    if (employeeError) return { status: 500, body: { error: employeeError.message } };
    if (!employee || employee.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Karyawan tidak ditemukan di perusahaan Anda.' } };
    }
    if (!employee.is_active) {
      return { status: 400, body: { error: 'Karyawan ini sudah tidak aktif.' } };
    }

    // 1 baris per (batch, employee) — kalau sudah ada, UPDATE (mis. koreksi jam),
    // bukan menumpuk baris baru untuk orang yang sama di batch yang sama.
    const { data: existing } = await adminClient
      .from('work_order_assignments')
      .select('work_order_assignment_id')
      .eq('production_batch_id', productionBatchId)
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await adminClient
        .from('work_order_assignments')
        .update({ actual_hours: actualHours, qty_produced: qtyProduced, work_date: workDate, status: 'completed', shift_id: batch.shift_id })
        .eq('work_order_assignment_id', existing.work_order_assignment_id);
      if (updateError) return { status: 500, body: { error: updateError.message } };
      return { status: 200, body: { success: true, work_order_assignment_id: existing.work_order_assignment_id, updated: true } };
    }

    const { data: inserted, error: insertError } = await adminClient
      .from('work_order_assignments')
      .insert([
        {
          work_order_id: workOrderId,
          production_batch_id: productionBatchId,
          employee_id: employeeId,
          shift_id: batch.shift_id,
          status: 'completed',
          actual_hours: actualHours,
          qty_produced: qtyProduced,
          work_date: workDate
        }
      ])
      .select('work_order_assignment_id')
      .single();
    if (insertError) return { status: 500, body: { error: insertError.message } };

    return { status: 201, body: { success: true, work_order_assignment_id: inserted.work_order_assignment_id, updated: false } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

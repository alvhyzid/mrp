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
// cuma production_batch_id, employee_id, routing_step_id, actual_hours, work_date
// (kolom baru, migration 20260818100000) + qty_produced (utk wage_type piece_rate).
//
// KLARIFIKASI pemilik produk (K1, ditambahkan setelah GELOMBANG 2 pertama): tim
// produksi = POOL BERGILIR — 1 orang WAJAR punya BANYAK baris jam di hari yang sama,
// lintas TAHAP berbeda (routing_step_id berbeda) DAN lintas BATCH berbeda. Baris ini
// key-nya (batch, employee, routing_step) — BUKAN (batch, employee) saja seperti versi
// sebelumnya (yang salah: diam-diam MENIMPA jam tahap pertama begitu orang yang sama
// dicatat lagi di tahap KEDUA pada batch yang SAMA). Tidak ada larangan/blokir keras
// lintas batch atau lintas tahap sama sekali di sini — jam berlebih dalam 1 hari HANYA
// menghasilkan peringatan lembut (lihat di bawah), tidak pernah ditolak.
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
    const routingStepId = body.routing_step_id !== undefined && body.routing_step_id !== null && body.routing_step_id !== '' ? Number(body.routing_step_id) : null;
    const actualHours = body.actual_hours !== undefined && body.actual_hours !== null ? Number(body.actual_hours) : null;
    const qtyProduced = body.qty_produced !== undefined && body.qty_produced !== null ? Number(body.qty_produced) : null;
    const workDate = body.work_date ? String(body.work_date).trim() : new Date().toISOString().slice(0, 10);
    // Penanda LEMBUR (keputusan pemilik produk, shift 2 20 Agu 2026) — kasus
    // jarang "orang yang seharusnya pulang tapi lanjut bekerja". TIDAK mengubah
    // tarif (belum ditentukan) -- cuma penanda supaya bisa dikoreksi nanti.
    const isOvertime = body.is_overtime === true;

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

    const { data: employee, error: employeeError } = await adminClient.from('employees').select('employee_id, company_id, is_active, name, wage_type, wage_rate').eq('employee_id', employeeId).maybeSingle();
    if (employeeError) return { status: 500, body: { error: employeeError.message } };
    if (!employee || employee.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Karyawan tidak ditemukan di perusahaan Anda.' } };
    }
    if (!employee.is_active) {
      return { status: 400, body: { error: 'Karyawan ini sudah tidak aktif.' } };
    }

    if (routingStepId) {
      const { data: step, error: stepError } = await adminClient.from('routing_steps').select('routing_step_id, routing_id').eq('routing_step_id', routingStepId).maybeSingle();
      if (stepError) return { status: 500, body: { error: stepError.message } };
      if (!step) return { status: 404, body: { error: 'Tahap routing tidak ditemukan.' } };
      const { data: routing, error: routingError } = await adminClient.from('routings').select('routing_id, company_id').eq('routing_id', step.routing_id).maybeSingle();
      if (routingError) return { status: 500, body: { error: routingError.message } };
      if (!routing || routing.company_id !== appUser.company_id) {
        return { status: 404, body: { error: 'Tahap routing tidak ditemukan di perusahaan Anda.' } };
      }
    }

    // Key: (batch, employee, routing_step) — SATU baris per kombinasi ini (update kalau
    // dicatat ulang persis kombinasi yang sama, mis. koreksi jam; baris BARU kalau
    // tahap atau batch-nya beda, sesuai klarifikasi pool bergilir di atas).
    let existingQuery = adminClient.from('work_order_assignments').select('work_order_assignment_id').eq('production_batch_id', productionBatchId).eq('employee_id', employeeId);
    existingQuery = routingStepId ? existingQuery.eq('routing_step_id', routingStepId) : existingQuery.is('routing_step_id', null);
    const { data: existing } = await existingQuery.maybeSingle();

    let assignmentId: number;
    let wasUpdated: boolean;
    if (existing) {
      const { error: updateError } = await adminClient
        .from('work_order_assignments')
        .update({ actual_hours: actualHours, qty_produced: qtyProduced, work_date: workDate, status: 'completed', shift_id: batch.shift_id, is_overtime: isOvertime })
        .eq('work_order_assignment_id', existing.work_order_assignment_id);
      if (updateError) return { status: 500, body: { error: updateError.message } };
      assignmentId = existing.work_order_assignment_id;
      wasUpdated = true;
    } else {
      const { data: inserted, error: insertError } = await adminClient
        .from('work_order_assignments')
        .insert([
          {
            work_order_id: workOrderId,
            production_batch_id: productionBatchId,
            employee_id: employeeId,
            routing_step_id: routingStepId,
            shift_id: batch.shift_id,
            status: 'completed',
            actual_hours: actualHours,
            qty_produced: qtyProduced,
            work_date: workDate,
            is_overtime: isOvertime
          }
        ])
        .select('work_order_assignment_id')
        .single();
      if (insertError) return { status: 500, body: { error: insertError.message } };
      assignmentId = inserted.work_order_assignment_id;
      wasUpdated = false;
    }

    // Peringatan LEMBUT (BUKAN blokir) kalau total jam orang ini di TANGGAL yang sama —
    // dijumlah lintas SEMUA batch/tahap — melebihi jam kerja efektif hari itu (K4: 7
    // jam biasa / 5 jam Sabtu). Lembur/pengecualian nyata terjadi, jadi ini cuma sinyal
    // "cek lagi input-nya", bukan penolakan.
    let warning: string | null = null;
    if (actualHours !== null) {
      const { data: sameDayRows } = await adminClient.from('work_order_assignments').select('actual_hours').eq('employee_id', employeeId).eq('work_date', workDate).not('status', 'in', '(absent,replaced)');
      const totalHoursToday = (sameDayRows ?? []).reduce((sum, row) => sum + Number(row.actual_hours ?? 0), 0);

      const { data: calendarSettings } = await adminClient
        .from('company_settings')
        .select('setting_key, setting_value')
        .eq('company_id', appUser.company_id)
        .in('setting_key', ['work_calendar_weekday_hours', 'work_calendar_saturday_hours']);
      const weekdayHours = Number(calendarSettings?.find((s) => s.setting_key === 'work_calendar_weekday_hours')?.setting_value ?? 7);
      const saturdayHours = Number(calendarSettings?.find((s) => s.setting_key === 'work_calendar_saturday_hours')?.setting_value ?? 5);
      const dow = new Date(`${workDate}T00:00:00Z`).getUTCDay();
      const effectiveHoursToday = dow === 6 ? saturdayHours : weekdayHours;

      if (totalHoursToday > effectiveHoursToday) {
        warning = `Total jam ${employee.name} pada ${workDate} sekarang ${totalHoursToday} jam — melebihi jam kerja efektif hari itu (${effectiveHoursToday} jam). Cek lagi kalau ini bukan lembur yang disengaja.`;
      }
    }

    return { status: existing ? 200 : 201, body: { success: true, work_order_assignment_id: assignmentId, updated: wasUpdated, warning } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageHr } from '@/lib/roles';
import { recomputeAttendanceDay } from './recomputeAttendanceDay';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Koreksi (docs §3 "KOREKSI") -- karyawan/HRD mengajukan, HRD memutuskan.
// Disetujui -> MENAMBAH event baru (ledger append-only tetap terjaga, event
// asli tidak pernah disentuh), bukan mengedit attendance_events yang ada.
export async function requestAttendanceCorrection(
  request: NextRequest,
  input: { employeeId: number; attendanceDate: string; requestedEventType: 'IN' | 'OUT'; requestedOccurredAt: string; reason: string }
): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    if (!input.reason?.trim()) return { status: 400, body: { error: 'Alasan koreksi wajib diisi.' } };

    const adminClient = getAdminClient();
    if (!canManageHr(appUser.role)) {
      const { data: employee } = await adminClient.from('employees').select('linked_user_id').eq('employee_id', input.employeeId).maybeSingle();
      if (!employee || employee.linked_user_id !== appUser.user_id) {
        return { status: 403, body: { error: 'Tidak bisa mengajukan koreksi atas nama karyawan lain.' } };
      }
    }

    const { data: correction, error } = await adminClient
      .from('attendance_corrections')
      .insert([
        {
          company_id: appUser.company_id,
          employee_id: input.employeeId,
          attendance_date: input.attendanceDate,
          requested_event_type: input.requestedEventType,
          requested_occurred_at: input.requestedOccurredAt,
          reason: input.reason,
          requested_by: appUser.user_id
        }
      ])
      .select('*')
      .single();
    if (error) return { status: 500, body: { error: error.message } };

    return { status: 200, body: { correction } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function decideAttendanceCorrection(request: NextRequest, correctionId: number, approve: boolean): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageHr(appUser.role)) {
      return { status: 403, body: { error: 'Hanya HRD/company_admin yang dapat memutuskan koreksi absensi.' } };
    }
    const adminClient = getAdminClient();
    const { data: correction, error: fetchError } = await adminClient.from('attendance_corrections').select('*').eq('attendance_correction_id', correctionId).maybeSingle();
    if (fetchError) return { status: 500, body: { error: fetchError.message } };
    if (!correction || correction.company_id !== appUser.company_id) return { status: 404, body: { error: 'Koreksi tidak ditemukan.' } };
    if (correction.status !== 'PENDING') return { status: 400, body: { error: 'Koreksi ini sudah diputuskan sebelumnya.' } };

    let resultingEventId: number | null = null;
    if (approve) {
      const { data: event, error: insertError } = await adminClient
        .from('attendance_events')
        .insert([
          {
            company_id: appUser.company_id,
            employee_id: correction.employee_id,
            event_type: correction.requested_event_type,
            occurred_at: correction.requested_occurred_at,
            method: 'MANUAL_HRD',
            geofence_status: 'TANPA_GPS',
            flags: { correction: true, correction_id: correctionId },
            recorded_by: appUser.user_id
          }
        ])
        .select('attendance_event_id')
        .single();
      if (insertError) return { status: 500, body: { error: insertError.message } };
      resultingEventId = event.attendance_event_id;
      await recomputeAttendanceDay(adminClient, appUser.company_id, correction.employee_id, correction.attendance_date);
    }

    const { error: updateError } = await adminClient
      .from('attendance_corrections')
      .update({ status: approve ? 'APPROVED' : 'REJECTED', decided_by: appUser.user_id, decided_at: new Date().toISOString(), resulting_event_id: resultingEventId })
      .eq('attendance_correction_id', correctionId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

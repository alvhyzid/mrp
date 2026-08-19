import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageHr } from '@/lib/roles';
import { recomputeAttendanceDay } from './recomputeAttendanceDay';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function createLeaveRequest(
  request: NextRequest,
  input: { employeeId: number; leaveType: 'IZIN' | 'SAKIT' | 'CUTI'; startDate: string; endDate: string; reason?: string }
): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    if (input.endDate < input.startDate) return { status: 400, body: { error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' } };

    const adminClient = getAdminClient();
    if (!canManageHr(appUser.role)) {
      const { data: employee } = await adminClient.from('employees').select('linked_user_id').eq('employee_id', input.employeeId).maybeSingle();
      if (!employee || employee.linked_user_id !== appUser.user_id) {
        return { status: 403, body: { error: 'Tidak bisa mengajukan izin atas nama karyawan lain.' } };
      }
    }

    const { data: leaveRequest, error } = await adminClient
      .from('leave_requests')
      .insert([
        {
          company_id: appUser.company_id,
          employee_id: input.employeeId,
          leave_type: input.leaveType,
          start_date: input.startDate,
          end_date: input.endDate,
          reason: input.reason ?? null,
          requested_by: appUser.user_id
        }
      ])
      .select('*')
      .single();
    if (error) return { status: 500, body: { error: error.message } };

    return { status: 200, body: { leaveRequest } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function decideLeaveRequest(request: NextRequest, leaveRequestId: number, approve: boolean): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageHr(appUser.role)) {
      return { status: 403, body: { error: 'Hanya HRD/company_admin yang dapat memutuskan pengajuan izin.' } };
    }
    const adminClient = getAdminClient();
    const { data: leaveRequest, error: fetchError } = await adminClient.from('leave_requests').select('*').eq('leave_request_id', leaveRequestId).maybeSingle();
    if (fetchError) return { status: 500, body: { error: fetchError.message } };
    if (!leaveRequest || leaveRequest.company_id !== appUser.company_id) return { status: 404, body: { error: 'Pengajuan tidak ditemukan.' } };
    if (leaveRequest.status !== 'PENDING') return { status: 400, body: { error: 'Pengajuan ini sudah diputuskan sebelumnya.' } };

    const { error: updateError } = await adminClient
      .from('leave_requests')
      .update({ status: approve ? 'APPROVED' : 'REJECTED', decided_by: appUser.user_id, decided_at: new Date().toISOString() })
      .eq('leave_request_id', leaveRequestId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    if (approve) {
      const start = new Date(`${leaveRequest.start_date}T00:00:00Z`);
      const end = new Date(`${leaveRequest.end_date}T00:00:00Z`);
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        await recomputeAttendanceDay(adminClient, appUser.company_id, leaveRequest.employee_id, d.toISOString().slice(0, 10));
      }
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

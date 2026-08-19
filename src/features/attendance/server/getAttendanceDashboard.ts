import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageHr, getManagedDepartmentForRole } from '@/lib/roles';
import { closeStaleOpenAttendanceDays } from './closeStaleOpenAttendanceDays';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Scoping SAMA PERSIS pola listAttendanceByDate.ts (Bagian HR yang sudah ada):
// company_admin/HR -> semua, manager department -> staf department-nya,
// karyawan -> baris dirinya sendiri. Diterapkan di TypeScript (service-role
// client melewati RLS), bukan RLS langsung -- konsisten satu pola.
export async function getAttendanceDashboard(request: NextRequest, date: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const adminClient = getAdminClient();
    await closeStaleOpenAttendanceDays(adminClient, appUser.company_id);

    const { data: attendance, error } = await adminClient
      .from('employee_attendance')
      .select('employee_attendance_id, employee_id, attendance_date, check_in_at, check_out_at, status, work_minutes, late_minutes, overtime_minutes, geofence_status, flags')
      .eq('company_id', appUser.company_id)
      .eq('attendance_date', date);
    if (error) return { status: 500, body: { error: error.message } };

    const { data: employees, error: employeesError } = await adminClient
      .from('employees')
      .select('employee_id, name, position, department, linked_user_id')
      .eq('company_id', appUser.company_id);
    if (employeesError) return { status: 500, body: { error: employeesError.message } };
    const employeesById = new Map((employees ?? []).map((e) => [e.employee_id, e]));

    const hasFullAccess = canManageHr(appUser.role);
    const managedDepartment = getManagedDepartmentForRole(appUser.role);

    const visible = (attendance ?? []).filter((row) => {
      if (hasFullAccess) return true;
      const employee = employeesById.get(row.employee_id);
      if (!employee) return false;
      if (managedDepartment && employee.department === managedDepartment) return true;
      if (employee.linked_user_id === appUser.user_id) return true;
      return false;
    });

    const result = visible.map((row) => {
      const employee = employeesById.get(row.employee_id);
      return { ...row, employee_name: employee?.name ?? null, employee_position: employee?.position ?? null, employee_department: employee?.department ?? null };
    });

    const body: Record<string, unknown> = { attendance: result, date };

    if (hasFullAccess) {
      // 2 query terpisah lalu digabung -- lebih aman daripada mengandalkan
      // sintaks operator jsonb di dalam string .or() PostgREST.
      const [outOfArea, autoClosed] = await Promise.all([
        adminClient
          .from('employee_attendance')
          .select('employee_attendance_id, employee_id, attendance_date, status, flags')
          .eq('company_id', appUser.company_id)
          .eq('status', 'DI_LUAR_AREA')
          .order('attendance_date', { ascending: false })
          .limit(100),
        adminClient
          .from('employee_attendance')
          .select('employee_attendance_id, employee_id, attendance_date, status, flags')
          .eq('company_id', appUser.company_id)
          .contains('flags', { auto_closed: true })
          .order('attendance_date', { ascending: false })
          .limit(100)
      ]);
      const reviewRows = new Map<number, any>();
      for (const row of [...(outOfArea.data ?? []), ...(autoClosed.data ?? [])]) reviewRows.set(row.employee_attendance_id, row);
      body.reviewQueue = Array.from(reviewRows.values()).map((row) => ({ ...row, employee_name: employeesById.get(row.employee_id)?.name ?? null }));

      const { data: pendingCorrections } = await adminClient
        .from('attendance_corrections')
        .select('*')
        .eq('company_id', appUser.company_id)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });
      body.pendingCorrections = (pendingCorrections ?? []).map((row) => ({ ...row, employee_name: employeesById.get(row.employee_id)?.name ?? null }));

      const { data: pendingLeaveRequests } = await adminClient
        .from('leave_requests')
        .select('*')
        .eq('company_id', appUser.company_id)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });
      body.pendingLeaveRequests = (pendingLeaveRequests ?? []).map((row) => ({ ...row, employee_name: employeesById.get(row.employee_id)?.name ?? null }));
    }

    return { status: 200, body };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

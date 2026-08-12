import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageHr, getManagedDepartmentForRole } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Meniru persis scoping RLS employee_attendance_select (lihat migration
// 20260813121500) di lapisan aplikasi, karena endpoint ini pakai service-role
// client yang melewati RLS: company_admin/hr -> semua, manager department -> staf
// department-nya sendiri, karyawan -> baris dirinya sendiri.
export async function listAttendanceByDate(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const date = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

    const adminClient = getAdminClient();
    const { data: attendance, error } = await adminClient
      .from('employee_attendance')
      .select('employee_attendance_id, employee_id, attendance_date, check_in_at, check_out_at, status, notes')
      .eq('company_id', appUser.company_id)
      .eq('attendance_date', date);

    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    const { data: employees, error: employeesError } = await adminClient
      .from('employees')
      .select('employee_id, name, position, department, linked_user_id')
      .eq('company_id', appUser.company_id);
    if (employeesError) {
      return { status: 500, body: { error: employeesError.message } };
    }
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
      return {
        ...row,
        employee_name: employee?.name ?? null,
        employee_position: employee?.position ?? null,
        employee_department: employee?.department ?? null
      };
    });

    return { status: 200, body: { attendance: result, date } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

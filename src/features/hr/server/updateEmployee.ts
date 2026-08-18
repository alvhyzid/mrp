import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { parseEmployeeInput } from './employeeValidation';
import { canManageHr } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Dipakai juga untuk "nonaktifkan" (is_active=false) -- SENGAJA tidak ada endpoint
// DELETE sama sekali. Karyawan terikat work_order_assignments/employee_attendance
// (riwayat labor log & absensi) -- hard delete akan melanggar FK atau, kalau
// dipaksa via cascade, menghapus riwayat produksi. Nonaktifkan = tidak lagi bisa
// dipilih di WO baru (WorkOrdersPage sudah filter is_active), riwayat lama utuh.
export async function updateEmployee(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageHr(appUser.role)) {
      return { status: 403, body: { error: 'Hanya company_admin, hr_manager, atau hr_staff yang dapat mengubah data karyawan.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const employeeId = Number(body.employee_id);
    if (!employeeId) {
      return { status: 400, body: { error: 'ID karyawan tidak valid.' } };
    }

    const { input, error } = parseEmployeeInput(body);
    if (error || !input) {
      return { status: 400, body: { error } };
    }

    const adminClient = getAdminClient();

    const { data: existingEmployee, error: existingError } = await adminClient
      .from('employees')
      .select('employee_id, company_id')
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (existingError) {
      return { status: 500, body: { error: existingError.message } };
    }

    if (!existingEmployee || existingEmployee.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Karyawan tidak ditemukan.' } };
    }

    if (input.production_plant_id) {
      const { data: plant } = await adminClient
        .from('production_plants')
        .select('production_plant_id')
        .eq('production_plant_id', input.production_plant_id)
        .eq('company_id', appUser.company_id)
        .maybeSingle();
      if (!plant) {
        return { status: 400, body: { error: 'Plant tidak ditemukan di perusahaan ini.' } };
      }
    }

    const { error: updateError } = await adminClient.from('employees').update(input).eq('employee_id', employeeId);

    if (updateError) {
      return { status: 500, body: { error: updateError.message } };
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

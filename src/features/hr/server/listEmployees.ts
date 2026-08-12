import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageHr } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Sumber data SAMA dengan employees_secure di database (satu tabel employees) —
// service-role client di sini melewati RLS, jadi masking gaji direplikasi persis
// di lapisan aplikasi (canManageHr, atau karyawan itu sendiri), sejalan dengan
// pola yang sudah dipakai listItems/listBoms untuk standard_cost.
export async function listEmployees(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { data: employees, error } = await adminClient
      .from('employees')
      .select('employee_id, production_plant_id, department, name, position, wage_type, wage_rate, linked_user_id, is_active, created_at')
      .eq('company_id', appUser.company_id)
      .order('name', { ascending: true });

    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    const { data: plants } = await adminClient
      .from('production_plants')
      .select('production_plant_id, name')
      .eq('company_id', appUser.company_id);
    const plantsById = new Map((plants ?? []).map((p) => [p.production_plant_id, p]));

    const canSeeWages = canManageHr(appUser.role);

    const result = (employees ?? []).map((employee) => {
      const isSelf = employee.linked_user_id === appUser.user_id;
      const showWage = canSeeWages || isSelf;
      return {
        employee_id: employee.employee_id,
        production_plant_id: employee.production_plant_id,
        production_plant_name: employee.production_plant_id ? plantsById.get(employee.production_plant_id)?.name ?? null : null,
        department: employee.department,
        name: employee.name,
        position: employee.position,
        wage_type: showWage ? employee.wage_type : null,
        wage_rate: showWage ? employee.wage_rate : null,
        linked_user_id: employee.linked_user_id,
        is_active: employee.is_active,
        created_at: employee.created_at
      };
    });

    return { status: 200, body: { employees: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

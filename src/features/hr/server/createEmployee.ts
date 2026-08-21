import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { parseEmployeeInput } from './employeeValidation';
import { canManageHr } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Gerbang role sama persis dengan policy employees_write_hr (migration
// 20260812151500) -- company_admin/hr_manager/hr_staff. RLS sendiri sudah
// menolak role lain kalau app layer ini bocor, tapi dicek di sini dulu supaya
// pesan error-nya jelas (bukan 500 generik dari database).
export async function createEmployee(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageHr(appUser.role)) {
      return { status: 403, body: { error: 'Hanya Admin Perusahaan, Manajer HRD, atau Staf HRD yang dapat menambah karyawan.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const { input, error } = parseEmployeeInput(body);
    if (error || !input) {
      return { status: 400, body: { error } };
    }

    const adminClient = getAdminClient();

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

    const { error: insertError } = await adminClient.from('employees').insert([
      {
        ...input,
        company_id: appUser.company_id
      }
    ]);

    if (insertError) {
      return { status: 500, body: { error: insertError.message } };
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageHr } from '@/lib/roles';
import { getEmployerCostConfig, computeMonthlyEmployerUplift } from '@/features/mrp';

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
      .select(
        'employee_id, production_plant_id, department, name, position, wage_type, wage_rate, linked_user_id, is_active, created_at, factory_employee_code, employment_status, ptkp_status, ter_category, ter_rate_percent, daily_meal_allowance, daily_transport_allowance, bpjs_kesehatan_enrolled, bpjs_contribution_basis, allowance_frequency'
      )
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

    // Biaya pemberi kerja/bulan (BPJS uplift) HANYA punya arti "per bulan" yang
    // stabil untuk wage_type=monthly -- PHL/harian tidak punya gaji bulanan
    // tetap (tergantung hari hadir), jadi TIDAK dihitung di sini (null + alasan),
    // bukan diperkirakan dari asumsi hari kerja yang bisa menyesatkan.
    const { config: employerCostConfig } = await getEmployerCostConfig(adminClient, appUser.company_id);

    const result = (employees ?? []).map((employee) => {
      const isSelf = employee.linked_user_id === appUser.user_id;
      const showWage = canSeeWages || isSelf;

      let employerMonthlyUplift: number | null = null;
      let employerMonthlyUpliftNote: string | null = null;
      if (showWage && employee.wage_type === 'monthly') {
        if (!employerCostConfig) {
          employerMonthlyUpliftNote = 'Konfigurasi rate BPJS perusahaan belum lengkap di company_settings.';
        } else {
          const uplift = computeMonthlyEmployerUplift(Number(employee.wage_rate), employee.bpjs_kesehatan_enrolled, employerCostConfig, employee.bpjs_contribution_basis);
          employerMonthlyUplift = uplift.upliftAmount;
          employerMonthlyUpliftNote = uplift.notes.join(' ') || null;
        }
      } else if (showWage && employee.wage_type !== 'monthly') {
        employerMonthlyUpliftNote = 'Karyawan non-bulanan (PHL/harian) tidak punya biaya pemberi kerja "per bulan" yang tetap -- tergantung hari hadir.';
      }

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
        created_at: employee.created_at,
        factory_employee_code: employee.factory_employee_code,
        employment_status: employee.employment_status,
        // PTKP/TER/tunjangan/BPJS -- data finansial personal, sama sensitifnya
        // dengan wage_rate -- pakai gerbang privasi yang SAMA (showWage), bukan
        // gerbang baru terpisah.
        ptkp_status: showWage ? employee.ptkp_status : null,
        ter_category: showWage ? employee.ter_category : null,
        ter_rate_percent: showWage ? employee.ter_rate_percent : null,
        daily_meal_allowance: showWage ? employee.daily_meal_allowance : null,
        daily_transport_allowance: showWage ? employee.daily_transport_allowance : null,
        bpjs_kesehatan_enrolled: showWage ? employee.bpjs_kesehatan_enrolled : null,
        bpjs_contribution_basis: showWage ? employee.bpjs_contribution_basis : null,
        allowance_frequency: employee.allowance_frequency,
        employer_monthly_uplift: employerMonthlyUplift,
        employer_monthly_uplift_note: employerMonthlyUpliftNote
      };
    });

    return { status: 200, body: { employees: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

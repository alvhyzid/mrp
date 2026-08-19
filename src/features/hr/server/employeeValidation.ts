export const wageTypes = ['hourly', 'daily', 'monthly', 'piece_rate'];
export const employeeDepartments = ['production', 'ppic', 'finance', 'purchasing', 'warehouse', 'hr', 'management', 'fat', 'rnd'];
export const employmentStatuses = ['kontrak', 'phl', 'freelance'];

export interface EmployeeInput {
  name: string;
  position: string | null;
  department: string | null;
  production_plant_id: number | null;
  wage_type: string;
  wage_rate: number;
  is_active: boolean;
  factory_employee_code: string | null;
  employment_status: string | null;
  ptkp_status: string | null;
  ter_category: string | null;
  ter_rate_percent: number | null;
  daily_meal_allowance: number | null;
  daily_transport_allowance: number | null;
  bpjs_kesehatan_enrolled: boolean | null;
}

function parseOptionalInt(value: unknown, fieldLabel: string): { value: number | null; error?: string } {
  if (value === undefined || value === null || value === '') {
    return { value: null };
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { value: null, error: `${fieldLabel} tidak valid.` };
  }
  return { value: parsed };
}

function parseOptionalNonNegativeNumber(value: unknown, fieldLabel: string): { value: number | null; error?: string } {
  if (value === undefined || value === null || value === '') {
    return { value: null };
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return { value: null, error: `${fieldLabel} tidak valid.` };
  }
  return { value: parsed };
}

function parseOptionalBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null || value === '') return null;
  return Boolean(value);
}

export function parseEmployeeInput(body: Record<string, unknown>): { input?: EmployeeInput; error?: string } {
  const name = String(body.name ?? '').trim();
  const wage_type = String(body.wage_type ?? '').trim();

  if (!name) {
    return { error: 'Nama karyawan wajib diisi.' };
  }

  if (!wageTypes.includes(wage_type)) {
    return { error: 'Skema gaji tidak valid.' };
  }

  const wageRateRaw = Number(body.wage_rate);
  if (Number.isNaN(wageRateRaw) || wageRateRaw <= 0) {
    return { error: 'Nilai gaji harus berupa angka lebih besar dari 0.' };
  }

  const position = String(body.position ?? '').trim();
  const department = String(body.department ?? '').trim();
  if (department && !employeeDepartments.includes(department)) {
    return { error: 'Department tidak valid.' };
  }

  const plant = parseOptionalInt(body.production_plant_id, 'Plant');
  if (plant.error) return { error: plant.error };

  const employment_status = String(body.employment_status ?? '').trim();
  if (employment_status && !employmentStatuses.includes(employment_status)) {
    return { error: 'Status kepegawaian tidak valid.' };
  }

  const ter_rate_percent = parseOptionalNonNegativeNumber(body.ter_rate_percent, 'Tarif TER');
  if (ter_rate_percent.error) return { error: ter_rate_percent.error };

  const daily_meal_allowance = parseOptionalNonNegativeNumber(body.daily_meal_allowance, 'Tunjangan makan');
  if (daily_meal_allowance.error) return { error: daily_meal_allowance.error };

  const daily_transport_allowance = parseOptionalNonNegativeNumber(body.daily_transport_allowance, 'Tunjangan transport');
  if (daily_transport_allowance.error) return { error: daily_transport_allowance.error };

  const factory_employee_code = String(body.factory_employee_code ?? '').trim();
  const ptkp_status = String(body.ptkp_status ?? '').trim();
  const ter_category = String(body.ter_category ?? '').trim();

  return {
    input: {
      name,
      position: position || null,
      department: department || null,
      production_plant_id: plant.value,
      wage_type,
      wage_rate: wageRateRaw,
      is_active: body.is_active === undefined ? true : Boolean(body.is_active),
      factory_employee_code: factory_employee_code || null,
      employment_status: employment_status || null,
      ptkp_status: ptkp_status || null,
      ter_category: ter_category || null,
      ter_rate_percent: ter_rate_percent.value,
      daily_meal_allowance: daily_meal_allowance.value,
      daily_transport_allowance: daily_transport_allowance.value,
      bpjs_kesehatan_enrolled: parseOptionalBoolean(body.bpjs_kesehatan_enrolled)
    }
  };
}

export const wageTypes = ['hourly', 'daily', 'monthly', 'piece_rate'];
export const employeeDepartments = ['production', 'ppic', 'finance', 'purchasing', 'warehouse', 'hr', 'management'];

export interface EmployeeInput {
  name: string;
  position: string | null;
  department: string | null;
  production_plant_id: number | null;
  wage_type: string;
  wage_rate: number;
  is_active: boolean;
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

  return {
    input: {
      name,
      position: position || null,
      department: department || null,
      production_plant_id: plant.value,
      wage_type,
      wage_rate: wageRateRaw,
      is_active: body.is_active === undefined ? true : Boolean(body.is_active)
    }
  };
}

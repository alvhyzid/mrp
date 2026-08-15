export interface SupplierInput {
  name: string;
  contact_info: string | null;
  lead_time_days: number | null;
  supplier_type: 'material_supplier' | 'subcontractor' | 'both';
}

const validSupplierTypes = ['material_supplier', 'subcontractor', 'both'];

export function parseSupplierInput(body: Record<string, unknown>): { data?: SupplierInput; error?: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return { error: 'Nama supplier wajib diisi.' };

  const supplierType = typeof body.supplier_type === 'string' ? body.supplier_type : 'material_supplier';
  if (!validSupplierTypes.includes(supplierType)) return { error: 'Jenis supplier tidak valid.' };

  const contactInfo = body.contact_info ? String(body.contact_info).trim() : null;

  let leadTimeDays: number | null = null;
  if (body.lead_time_days !== undefined && body.lead_time_days !== null && body.lead_time_days !== '') {
    const parsed = Number(body.lead_time_days);
    if (!Number.isInteger(parsed) || parsed < 0) return { error: 'Lead time (hari) harus angka bulat positif.' };
    leadTimeDays = parsed;
  }

  return { data: { name, contact_info: contactInfo, lead_time_days: leadTimeDays, supplier_type: supplierType as SupplierInput['supplier_type'] } };
}

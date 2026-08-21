export interface SupplierInput {
  name: string;
  contact_info: string | null;
  lead_time_days: number | null;
  supplier_type: 'material_supplier' | 'subcontractor' | 'both';
  address: string | null;
  npwp: string | null;
  pic_name: string | null;
  pic_phone: string | null;
  pic_email: string | null;
  payment_terms: string | null;
}

const validSupplierTypes = ['material_supplier', 'subcontractor', 'both'];

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

// Alur 1 (3.3) — hanya nama yang wajib. Field lain SENGAJA opsional: field
// wajib yang tidak dipakai adalah gesekan harian (keputusan pemilik produk).
export function parseSupplierInput(body: Record<string, unknown>): { data?: SupplierInput; error?: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return { error: 'Nama supplier wajib diisi.' };

  const supplierType = typeof body.supplier_type === 'string' ? body.supplier_type : 'material_supplier';
  if (!validSupplierTypes.includes(supplierType)) return { error: 'Jenis supplier tidak valid.' };

  let leadTimeDays: number | null = null;
  if (body.lead_time_days !== undefined && body.lead_time_days !== null && body.lead_time_days !== '') {
    const parsed = Number(body.lead_time_days);
    if (!Number.isInteger(parsed) || parsed < 0) return { error: 'Lead time (hari) harus angka bulat positif.' };
    leadTimeDays = parsed;
  }

  return {
    data: {
      name,
      contact_info: optionalText(body.contact_info),
      lead_time_days: leadTimeDays,
      supplier_type: supplierType as SupplierInput['supplier_type'],
      address: optionalText(body.address),
      npwp: optionalText(body.npwp),
      pic_name: optionalText(body.pic_name),
      pic_phone: optionalText(body.pic_phone),
      pic_email: optionalText(body.pic_email),
      payment_terms: optionalText(body.payment_terms)
    }
  };
}

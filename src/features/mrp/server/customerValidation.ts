import { buatKontrakGalatField } from '@/lib/kontrakGalatField';

// KONTRAK GALAT FIELD modul ini (DS-25 / WS-B). Registri hanya memuat dua nama yang
// benar-benar bisa ditolak server — Alur 1 menetapkan hanya nama yang wajib, sama seperti
// supplier. Nama yang ada di registri tetapi tanpa kontrol akan ditandai pada sesuatu yang
// tidak ada, dan galatnya hilang persis seperti kalau namanya salah ketik.
export const FIELD_PELANGGAN = ['name', 'customer_type'] as const;
export type FieldPelanggan = (typeof FIELD_PELANGGAN)[number];

const kontrak = buatKontrakGalatField(FIELD_PELANGGAN, [] as const);
export const galatFieldPelanggan = kontrak.galatField;
export const petakanGalatPelanggan = kontrak.petakan;

export const customerTypes = ['company', 'individual'];

export interface CustomerInput {
  name: string;
  customer_type: string;
  contact_info: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  npwp: string | null;
  pic_name: string | null;
  pic_phone: string | null;
  pic_email: string | null;
  payment_terms: string | null;
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

// Alur 1 (3.3) — hanya nama yang wajib, sama seperti supplier.
export function parseCustomerInput(body: Record<string, unknown>): { input?: CustomerInput; error?: string; field?: FieldPelanggan } {
  const name = String(body.name ?? '').trim();
  const customerType = String(body.customer_type ?? 'company').trim();

  if (!name) {
    return { error: 'Nama client wajib diisi.', field: 'name' };
  }

  if (!customerTypes.includes(customerType)) {
    return { error: 'Tipe client tidak valid.', field: 'customer_type' };
  }

  return {
    input: {
      name,
      customer_type: customerType,
      contact_info: optionalText(body.contact_info),
      billing_address: optionalText(body.billing_address),
      shipping_address: optionalText(body.shipping_address),
      npwp: optionalText(body.npwp),
      pic_name: optionalText(body.pic_name),
      pic_phone: optionalText(body.pic_phone),
      pic_email: optionalText(body.pic_email),
      payment_terms: optionalText(body.payment_terms)
    }
  };
}

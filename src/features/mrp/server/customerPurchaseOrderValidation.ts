import { buatKontrakGalatField } from '@/lib/kontrakGalatField';

// KONTRAK GALAT FIELD modul ini (DS-25 / WS-01). Namanya SAMA PERSIS dengan kunci
// `emptyForm` dan `FormLine` di layar PO klien — itulah yang membuat pemetaannya bisa
// dijamin, bukan sekadar diharapkan.
//
// REGISTRI SENGAJA HANYA MEMUAT NAMA YANG BISA DITOLAK SERVER, bukan seluruh isian
// formulir. Nama yang ada di registri tetapi tidak punya kontrol akan lolos pemeriksaan
// runtime lalu ditandai pada sesuatu yang tidak ada — dan galatnya hilang persis seperti
// kalau namanya salah ketik. Penjaga (h) di tests/validasi_field_po_klien.test.ts menolaknya.
export const FIELD_PO_KLIEN = ['customer_id', 'po_number', 'payment_terms'] as const;
export const FIELD_PO_KLIEN_BARIS = ['item_id', 'qty_ordered', 'unit_price'] as const;
export type FieldPoKlien = (typeof FIELD_PO_KLIEN)[number] | (typeof FIELD_PO_KLIEN_BARIS)[number];

const kontrak = buatKontrakGalatField(FIELD_PO_KLIEN, FIELD_PO_KLIEN_BARIS);
export const galatFieldPoKlien = kontrak.galatField;
export const petakanGalatPoKlien = kontrak.petakan;

export const paymentTermsOptions = ['full', 'tempo'];

export interface CustomerPoLineInput {
  item_id: number;
  qty_ordered: number;
  unit_price: number;
}

export interface CustomerPoInput {
  customer_id: number;
  po_number: string;
  po_date: string | null;
  requested_ship_date: string | null;
  pic_name: string | null;
  pic_position: string | null;
  pic_phone: string | null;
  pic_email: string | null;
  payment_terms: string | null;
  lines: CustomerPoLineInput[];
  idempotency_key: string | null;
}

/// Hasil validasi. `field`/`line` mengikuti STANDAR VALIDASI FABRIX §3: diisi HANYA untuk
/// galat yang bisa diperbaiki pengguna dengan mengubah satu isian yang terlihat.
export interface CustomerPoParseResult {
  input?: CustomerPoInput;
  error?: string;
  field?: FieldPoKlien;
  line?: number;
}

function parsePositiveInt(value: unknown, fieldLabel: string): { value?: number; error?: string } {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: `${fieldLabel} tidak valid.` };
  }
  return { value: parsed };
}

function parsePositiveNumber(value: unknown, fieldLabel: string): { value?: number; error?: string } {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return { error: `${fieldLabel} harus berupa angka lebih besar dari 0.` };
  }
  return { value: parsed };
}

function optionalString(value: unknown): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

export function parseCustomerPoInput(body: Record<string, unknown>): CustomerPoParseResult {
  const customerId = parsePositiveInt(body.customer_id, 'Client');
  if (customerId.error) return { error: customerId.error, field: 'customer_id' };

  const poNumber = String(body.po_number ?? '').trim();
  if (!poNumber) {
    return { error: 'Nomor PO client wajib diisi.', field: 'po_number' };
  }

  const paymentTerms = optionalString(body.payment_terms);
  if (paymentTerms && !paymentTermsOptions.includes(paymentTerms)) {
    return { error: 'Syarat pembayaran tidak valid.', field: 'payment_terms' };
  }

  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  if (rawLines.length === 0) {
    // GOLONGAN B, dan itu disengaja: penggunanya harus MENAMBAH baris, bukan memperbaiki
    // sesuatu yang terlihat. Menandainya di sebuah kontrol akan menunjuk isian yang bukan
    // penyebabnya.
    return { error: 'PO harus punya minimal 1 baris item.' };
  }

  const lines: CustomerPoLineInput[] = [];
  for (const [indeks, rawLine] of rawLines.entries()) {
    const line = rawLine as Record<string, unknown>;
    const itemId = parsePositiveInt(line.item_id, 'Item');
    if (itemId.error) return { error: itemId.error, field: 'item_id', line: indeks };

    const qtyOrdered = parsePositiveNumber(line.qty_ordered, 'Jumlah dipesan');
    if (qtyOrdered.error) return { error: qtyOrdered.error, field: 'qty_ordered', line: indeks };

    const unitPrice = parsePositiveNumber(line.unit_price, 'Harga satuan');
    if (unitPrice.error) return { error: unitPrice.error, field: 'unit_price', line: indeks };

    lines.push({ item_id: itemId.value!, qty_ordered: qtyOrdered.value!, unit_price: unitPrice.value! });
  }

  return {
    input: {
      customer_id: customerId.value!,
      po_number: poNumber,
      po_date: optionalString(body.po_date),
      requested_ship_date: optionalString(body.requested_ship_date),
      pic_name: optionalString(body.pic_name),
      pic_position: optionalString(body.pic_position),
      pic_phone: optionalString(body.pic_phone),
      pic_email: optionalString(body.pic_email),
      payment_terms: paymentTerms,
      lines,
      // Opsional — dikirim client untuk mencegah submit ganda (double-click/retry
      // jaringan) bikin dokumen duplikat. Kalau kosong, endpoint tetap jalan seperti
      // biasa (cuma diandalkan lewat unique(company_id, po_number) seperti sebelumnya).
      idempotency_key: optionalString(body.idempotency_key)
    }
  };
}

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

export function parseCustomerPoInput(body: Record<string, unknown>): { input?: CustomerPoInput; error?: string } {
  const customerId = parsePositiveInt(body.customer_id, 'Client');
  if (customerId.error) return { error: customerId.error };

  const poNumber = String(body.po_number ?? '').trim();
  if (!poNumber) {
    return { error: 'Nomor PO client wajib diisi.' };
  }

  const paymentTerms = optionalString(body.payment_terms);
  if (paymentTerms && !paymentTermsOptions.includes(paymentTerms)) {
    return { error: 'Syarat pembayaran tidak valid.' };
  }

  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  if (rawLines.length === 0) {
    return { error: 'PO harus punya minimal 1 baris item.' };
  }

  const lines: CustomerPoLineInput[] = [];
  for (const rawLine of rawLines) {
    const line = rawLine as Record<string, unknown>;
    const itemId = parsePositiveInt(line.item_id, 'Item');
    if (itemId.error) return { error: itemId.error };

    const qtyOrdered = parsePositiveNumber(line.qty_ordered, 'Jumlah dipesan');
    if (qtyOrdered.error) return { error: qtyOrdered.error };

    const unitPrice = parsePositiveNumber(line.unit_price, 'Harga satuan');
    if (unitPrice.error) return { error: unitPrice.error };

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

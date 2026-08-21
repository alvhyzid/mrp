export interface SupplierItemPriceInput {
  supplier_id: number;
  item_id: number;
  supplier_item_code: string | null;
  supplier_item_name: string | null;
  reference_price: number | null;
  price_valid_from: string | null;
  min_order_qty: number | null;
  min_order_uom: string | null;
  lead_time_days_override: number | null;
  notes: string | null;
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function optionalNonNegativeNumber(value: unknown, fieldLabel: string): { value?: number | null; error?: string } {
  if (value === undefined || value === null || value === '') return { value: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return { error: `${fieldLabel} harus angka 0 atau lebih.` };
  return { value: parsed };
}

// Alur 1 (3.4) — item WAJIB dipilih dari master (item_id, bukan teks bebas).
// Semua field selain supplier_id/item_id opsional -- harga acuan bisa belum
// ada saat baris pertama kali dibuat (mis. baru tahu supplier ini memasok
// bahan ini, harga menyusul).
export function parseSupplierItemPriceInput(body: Record<string, unknown>): { data?: SupplierItemPriceInput; error?: string } {
  const supplierId = Number(body.supplier_id);
  if (!supplierId) return { error: 'Supplier wajib dipilih.' };
  const itemId = Number(body.item_id);
  if (!itemId) return { error: 'Bahan wajib dipilih dari daftar item.' };

  const referencePrice = optionalNonNegativeNumber(body.reference_price, 'Harga acuan');
  if (referencePrice.error) return { error: referencePrice.error };

  const minOrderQty = optionalNonNegativeNumber(body.min_order_qty, 'Minimum order');
  if (minOrderQty.error) return { error: minOrderQty.error };

  let leadTimeOverride: number | null = null;
  if (body.lead_time_days_override !== undefined && body.lead_time_days_override !== null && body.lead_time_days_override !== '') {
    const parsed = Number(body.lead_time_days_override);
    if (!Number.isInteger(parsed) || parsed < 0) return { error: 'Lead time khusus bahan ini harus angka bulat positif.' };
    leadTimeOverride = parsed;
  }

  const priceValidFrom = body.price_valid_from ? String(body.price_valid_from) : null;

  return {
    data: {
      supplier_id: supplierId,
      item_id: itemId,
      supplier_item_code: optionalText(body.supplier_item_code),
      supplier_item_name: optionalText(body.supplier_item_name),
      reference_price: referencePrice.value ?? null,
      price_valid_from: priceValidFrom,
      min_order_qty: minOrderQty.value ?? null,
      min_order_uom: optionalText(body.min_order_uom),
      lead_time_days_override: leadTimeOverride,
      notes: optionalText(body.notes)
    }
  };
}

export interface PurchaseOrderLineInput {
  item_id: number;
  qty_ordered: number;
  unit_price: number | null;
}

export interface PurchaseOrderInput {
  supplier_id: number;
  production_plant_id: number;
  expected_date: string | null;
  lines: PurchaseOrderLineInput[];
}

export function parsePurchaseOrderInput(body: Record<string, unknown>): { data?: PurchaseOrderInput; error?: string } {
  const supplierId = Number(body.supplier_id);
  if (!supplierId || !Number.isInteger(supplierId) || supplierId <= 0) return { error: 'Supplier wajib dipilih.' };

  const productionPlantId = Number(body.production_plant_id);
  if (!productionPlantId || !Number.isInteger(productionPlantId) || productionPlantId <= 0) return { error: 'Lokasi pabrik (alamat kirim) wajib dipilih.' };

  const expectedDate = body.expected_date ? String(body.expected_date).trim() : null;

  if (!Array.isArray(body.lines) || body.lines.length === 0) return { error: 'Minimal 1 baris item wajib diisi.' };

  const lines: PurchaseOrderLineInput[] = [];
  for (const raw of body.lines as Record<string, unknown>[]) {
    const itemId = Number(raw.item_id);
    if (!itemId || !Number.isInteger(itemId) || itemId <= 0) return { error: 'Item pada salah satu baris tidak valid.' };

    const qtyOrdered = Number(raw.qty_ordered);
    if (!Number.isFinite(qtyOrdered) || qtyOrdered <= 0) return { error: 'Jumlah pesan harus angka positif.' };

    let unitPrice: number | null = null;
    if (raw.unit_price !== undefined && raw.unit_price !== null && raw.unit_price !== '') {
      const parsed = Number(raw.unit_price);
      if (!Number.isFinite(parsed) || parsed < 0) return { error: 'Harga satuan harus angka positif.' };
      unitPrice = parsed;
    }

    lines.push({ item_id: itemId, qty_ordered: qtyOrdered, unit_price: unitPrice });
  }

  return { data: { supplier_id: supplierId, production_plant_id: productionPlantId, expected_date: expectedDate, lines } };
}

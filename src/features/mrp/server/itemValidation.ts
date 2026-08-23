export const itemTypes = ['raw_material', 'wip', 'finished_good', 'packaging'];

export interface ItemInput {
  item_code: string;
  name: string;
  type: string;
  base_uom: string;
  purchase_uom: string;
  uom_conversion_factor: number;
  shelf_life_days: number | null;
  min_stock_level: number;
  // MST-19 — persen dari jumlah yang PERNAH MASUK. Null = pakai angka mutlak lama.
  min_stock_percent: number | null;
  reorder_point: number | null;
  reorder_qty: number | null;
  is_active: boolean;
  standard_cost: number | null;
  bpom_registration_number: string | null;
  // MST-15/B.3 — sepasang dengan nomor BPOM, keduanya diminta saat pengurusan BPOM.
  halal_certificate_number: string | null;
}

function parseOptionalNumber(value: unknown, fieldLabel: string): { value: number | null; error?: string } {
  if (value === undefined || value === null || value === '') {
    return { value: null };
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return { value: null, error: `${fieldLabel} harus berupa angka positif.` };
  }
  return { value: parsed };
}

export function parseItemInput(body: Record<string, unknown>): { input?: ItemInput; error?: string } {
  const item_code = String(body.item_code ?? '').trim();
  const name = String(body.name ?? '').trim();
  const type = String(body.type ?? '').trim();
  const base_uom = String(body.base_uom ?? '').trim();
  const purchase_uom = String(body.purchase_uom ?? body.base_uom ?? '').trim();

  if (!item_code || !name || !type || !base_uom || !purchase_uom) {
    return { error: 'Kode item, nama, tipe, satuan dasar, dan satuan beli wajib diisi.' };
  }

  if (!itemTypes.includes(type)) {
    return { error: 'Tipe item tidak valid.' };
  }

  const conversionFactor = parseOptionalNumber(body.uom_conversion_factor, 'Faktor konversi satuan');
  if (conversionFactor.error) return { error: conversionFactor.error };
  if (conversionFactor.value !== null && conversionFactor.value <= 0) {
    return { error: 'Faktor konversi satuan harus lebih besar dari 0.' };
  }

  const shelfLife = parseOptionalNumber(body.shelf_life_days, 'Shelf life');
  if (shelfLife.error) return { error: shelfLife.error };

  const minStock = parseOptionalNumber(body.min_stock_level, 'Min stock level');
  if (minStock.error) return { error: minStock.error };

  const minStockPercent = parseOptionalNumber(body.min_stock_percent, 'Min stock level (persen)');
  if (minStockPercent.error) return { error: minStockPercent.error };
  // Batas atas 100 ditegakkan DI SINI juga, bukan cuma lewat CHECK database: pesan dari
  // database berbunyi seperti galat teknis, sedangkan ini bisa dibaca pengguna.
  if (minStockPercent.value !== null && (minStockPercent.value <= 0 || minStockPercent.value > 100)) {
    return { error: 'Min stock level (persen) harus di atas 0 dan maksimal 100.' };
  }

  const reorderPoint = parseOptionalNumber(body.reorder_point, 'Reorder point');
  if (reorderPoint.error) return { error: reorderPoint.error };

  const reorderQty = parseOptionalNumber(body.reorder_qty, 'Reorder qty');
  if (reorderQty.error) return { error: reorderQty.error };

  const standardCost = parseOptionalNumber(body.standard_cost, 'Standard cost');
  if (standardCost.error) return { error: standardCost.error };

  const bpomRegistrationNumber = String(body.bpom_registration_number ?? '').trim();
  const halalCertificateNumber = String(body.halal_certificate_number ?? '').trim();

  return {
    input: {
      item_code,
      name,
      type,
      base_uom,
      purchase_uom,
      uom_conversion_factor: conversionFactor.value ?? 1,
      shelf_life_days: shelfLife.value,
      min_stock_level: minStock.value ?? 0,
      min_stock_percent: minStockPercent.value,
      reorder_point: reorderPoint.value,
      reorder_qty: reorderQty.value,
      is_active: body.is_active === undefined ? true : Boolean(body.is_active),
      standard_cost: standardCost.value,
      bpom_registration_number: bpomRegistrationNumber || null,
      halal_certificate_number: halalCertificateNumber || null
    }
  };
}

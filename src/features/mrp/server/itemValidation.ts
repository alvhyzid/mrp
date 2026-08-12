export const itemTypes = ['raw_material', 'wip', 'finished_good', 'packaging'];

export interface ItemInput {
  item_code: string;
  name: string;
  type: string;
  uom: string;
  shelf_life_days: number | null;
  min_stock_level: number;
  reorder_point: number | null;
  reorder_qty: number | null;
  is_active: boolean;
  standard_cost: number | null;
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
  const uom = String(body.uom ?? '').trim();

  if (!item_code || !name || !type || !uom) {
    return { error: 'Kode item, nama, tipe, dan satuan (UOM) wajib diisi.' };
  }

  if (!itemTypes.includes(type)) {
    return { error: 'Tipe item tidak valid.' };
  }

  const shelfLife = parseOptionalNumber(body.shelf_life_days, 'Shelf life');
  if (shelfLife.error) return { error: shelfLife.error };

  const minStock = parseOptionalNumber(body.min_stock_level, 'Min stock level');
  if (minStock.error) return { error: minStock.error };

  const reorderPoint = parseOptionalNumber(body.reorder_point, 'Reorder point');
  if (reorderPoint.error) return { error: reorderPoint.error };

  const reorderQty = parseOptionalNumber(body.reorder_qty, 'Reorder qty');
  if (reorderQty.error) return { error: reorderQty.error };

  const standardCost = parseOptionalNumber(body.standard_cost, 'Standard cost');
  if (standardCost.error) return { error: standardCost.error };

  return {
    input: {
      item_code,
      name,
      type,
      uom,
      shelf_life_days: shelfLife.value,
      min_stock_level: minStock.value ?? 0,
      reorder_point: reorderPoint.value,
      reorder_qty: reorderQty.value,
      is_active: body.is_active === undefined ? true : Boolean(body.is_active),
      standard_cost: standardCost.value
    }
  };
}

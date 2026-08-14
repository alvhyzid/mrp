export const bomStatuses = ['draft', 'active', 'archived'];

export interface BomLineInput {
  component_item_id: number;
  qty_per_unit_output: number;
  uom: string;
}

export interface BomInput {
  parent_item_id: number;
  standard_yield_qty: number;
  standard_yield_uom: string;
  status: string;
  buffer_percentage: number | null;
  lines: BomLineInput[];
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

export function parseBomInput(body: Record<string, unknown>): { input?: BomInput; error?: string } {
  const parentItemId = parsePositiveInt(body.parent_item_id, 'Item induk');
  if (parentItemId.error) return { error: parentItemId.error };

  const standardYieldQty = parsePositiveNumber(body.standard_yield_qty, 'Jumlah hasil standar');
  if (standardYieldQty.error) return { error: standardYieldQty.error };

  const standardYieldUom = String(body.standard_yield_uom ?? '').trim();
  if (!standardYieldUom) {
    return { error: 'Satuan hasil wajib diisi.' };
  }

  const status = String(body.status ?? 'draft').trim();
  if (!bomStatuses.includes(status)) {
    return { error: 'Status BOM tidak valid.' };
  }

  let bufferPercentage: number | null = null;
  if (body.buffer_percentage !== undefined && body.buffer_percentage !== null && body.buffer_percentage !== '') {
    const parsedBuffer = Number(body.buffer_percentage);
    if (Number.isNaN(parsedBuffer) || parsedBuffer < 0 || parsedBuffer > 100) {
      return { error: 'Persentase buffer harus di antara 0 dan 100.' };
    }
    bufferPercentage = parsedBuffer;
  }

  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  if (rawLines.length === 0) {
    return { error: 'BOM harus punya minimal 1 komponen.' };
  }

  const lines: BomLineInput[] = [];
  const seenComponents = new Set<number>();

  for (const rawLine of rawLines) {
    const line = rawLine as Record<string, unknown>;
    const componentItemId = parsePositiveInt(line.component_item_id, 'Item komponen');
    if (componentItemId.error) return { error: componentItemId.error };

    if (componentItemId.value === parentItemId.value) {
      return { error: 'Item komponen tidak boleh sama dengan item induk BOM (referensi ke diri sendiri).' };
    }

    if (seenComponents.has(componentItemId.value!)) {
      return { error: 'Item komponen yang sama tidak boleh muncul dua kali di satu BOM.' };
    }
    seenComponents.add(componentItemId.value!);

    const qtyPerUnitOutput = parsePositiveNumber(line.qty_per_unit_output, 'Jumlah per unit output');
    if (qtyPerUnitOutput.error) return { error: qtyPerUnitOutput.error };

    const uom = String(line.uom ?? '').trim();
    if (!uom) {
      return { error: 'Satuan komponen wajib diisi.' };
    }

    lines.push({ component_item_id: componentItemId.value!, qty_per_unit_output: qtyPerUnitOutput.value!, uom });
  }

  return {
    input: {
      parent_item_id: parentItemId.value!,
      standard_yield_qty: standardYieldQty.value!,
      standard_yield_uom: standardYieldUom,
      status,
      buffer_percentage: bufferPercentage,
      lines
    }
  };
}

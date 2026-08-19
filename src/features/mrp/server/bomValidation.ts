import type { SupabaseClient } from '@supabase/supabase-js';

export const bomStatuses = ['draft', 'active', 'archived'];

export interface BomLineInput {
  component_item_id: number;
  qty_per_unit_output: number;
  uom: string;
  // Tahap routing item INDUK yang mulai memakai komponen ini (opsional). NULL =
  // belum diklasifikasi, diperlakukan sebagai "dibutuhkan sejak tahap pertama"
  // (perilaku lama, lihat migration 20260820100000_bom_line_routing_step.sql).
  routing_step_id: number | null;
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

    let routingStepId: number | null = null;
    if (line.routing_step_id !== undefined && line.routing_step_id !== null && line.routing_step_id !== '') {
      const parsedStep = parsePositiveInt(line.routing_step_id, 'Tahap routing');
      if (parsedStep.error) return { error: parsedStep.error };
      routingStepId = parsedStep.value!;
    }

    lines.push({ component_item_id: componentItemId.value!, qty_per_unit_output: qtyPerUnitOutput.value!, uom, routing_step_id: routingStepId });
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

// Sebuah routing_step_id di bom_lines HARUS milik routing item INDUK BOM itu
// sendiri (bukan routing item lain) -- kalau tidak, "tahap ke-N" jadi tidak
// bermakna (mengacu ke routing yang salah). Dipanggil dari createBom & updateBom.
export async function validateLineRoutingSteps(
  adminClient: SupabaseClient,
  companyId: number,
  parentItemId: number,
  lines: BomLineInput[]
): Promise<string | null> {
  const stepIds = Array.from(new Set(lines.map((l) => l.routing_step_id).filter((id): id is number => id !== null)));
  if (stepIds.length === 0) return null;

  const { data: steps, error: stepsError } = await adminClient.from('routing_steps').select('routing_step_id, routing_id').in('routing_step_id', stepIds);
  if (stepsError) return stepsError.message;

  const routingIds = Array.from(new Set((steps ?? []).map((s) => s.routing_id)));
  const { data: routings, error: routingsError } = routingIds.length
    ? await adminClient.from('routings').select('routing_id, item_id, company_id').in('routing_id', routingIds)
    : { data: [] as { routing_id: number; item_id: number; company_id: number }[], error: null };
  if (routingsError) return routingsError.message;

  const validRoutingIds = new Set((routings ?? []).filter((r) => r.company_id === companyId && r.item_id === parentItemId).map((r) => r.routing_id));
  const validStepIds = new Set((steps ?? []).filter((s) => validRoutingIds.has(s.routing_id)).map((s) => s.routing_step_id));

  for (const stepId of stepIds) {
    if (!validStepIds.has(stepId)) {
      return 'Salah satu tahap routing yang dipilih tidak ditemukan di routing item induk BOM ini.';
    }
  }
  return null;
}

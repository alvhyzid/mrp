export const workOrderPriorities = ['low', 'normal', 'high', 'urgent'];

export interface WorkOrderInput {
  production_plant_id: number;
  sales_order_line_id: number;
  bom_id: number;
  routing_id: number | null;
  planned_qty: number;
  priority: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
}

function parsePositiveInt(value: unknown, fieldLabel: string): { value?: number; error?: string } {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: `${fieldLabel} tidak valid.` };
  }
  return { value: parsed };
}

function optionalString(value: unknown): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

export function parseWorkOrderInput(body: Record<string, unknown>): { input?: WorkOrderInput; error?: string } {
  const plantId = parsePositiveInt(body.production_plant_id, 'Lokasi pabrik');
  if (plantId.error) return { error: plantId.error };

  const salesOrderLineId = parsePositiveInt(body.sales_order_line_id, 'SO line');
  if (salesOrderLineId.error) return { error: salesOrderLineId.error };

  const bomId = parsePositiveInt(body.bom_id, 'BOM');
  if (bomId.error) return { error: bomId.error };

  let routingId: number | null = null;
  if (body.routing_id !== undefined && body.routing_id !== null && body.routing_id !== '') {
    const parsedRouting = parsePositiveInt(body.routing_id, 'Routing');
    if (parsedRouting.error) return { error: parsedRouting.error };
    routingId = parsedRouting.value!;
  }

  const plannedQty = Number(body.planned_qty);
  if (Number.isNaN(plannedQty) || plannedQty <= 0) {
    return { error: 'Jumlah rencana (planned qty) harus lebih besar dari 0.' };
  }

  const priority = String(body.priority ?? 'normal').trim();
  if (!workOrderPriorities.includes(priority)) {
    return { error: 'Prioritas tidak valid.' };
  }

  return {
    input: {
      production_plant_id: plantId.value!,
      sales_order_line_id: salesOrderLineId.value!,
      bom_id: bomId.value!,
      routing_id: routingId,
      planned_qty: plannedQty,
      priority,
      scheduled_start: optionalString(body.scheduled_start),
      scheduled_end: optionalString(body.scheduled_end)
    }
  };
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listBoms(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const canSeeCost = canViewFinancialData(appUser.role);

    const { data: boms, error: bomsError } = await adminClient
      .from('boms')
      .select('bom_id, parent_item_id, version, standard_yield_qty, standard_yield_uom, status, created_at')
      .eq('company_id', appUser.company_id)
      .order('created_at', { ascending: false });

    if (bomsError) {
      return { status: 500, body: { error: bomsError.message } };
    }

    if (!boms || boms.length === 0) {
      return { status: 200, body: { boms: [] } };
    }

    const { data: items, error: itemsError } = await adminClient
      .from('items')
      .select('item_id, item_code, name, type, base_uom, standard_cost')
      .eq('company_id', appUser.company_id);

    if (itemsError) {
      return { status: 500, body: { error: itemsError.message } };
    }

    const itemsById = new Map((items ?? []).map((item) => [item.item_id, item]));

    const bomIds = boms.map((bom) => bom.bom_id);
    const { data: lines, error: linesError } = await adminClient
      .from('bom_lines')
      .select('bom_line_id, bom_id, component_item_id, qty_per_unit_output, uom')
      .in('bom_id', bomIds);

    if (linesError) {
      return { status: 500, body: { error: linesError.message } };
    }

    const linesByBomId = new Map<number, typeof lines>();
    for (const line of lines ?? []) {
      const list = linesByBomId.get(line.bom_id) ?? [];
      list.push(line);
      linesByBomId.set(line.bom_id, list);
    }

    const result = boms.map((bom) => {
      const parentItem = itemsById.get(bom.parent_item_id);
      const bomLines = (linesByBomId.get(bom.bom_id) ?? []).map((line) => {
        const componentItem = itemsById.get(line.component_item_id);
        return {
          bom_line_id: line.bom_line_id,
          component_item_id: line.component_item_id,
          component_item_code: componentItem?.item_code ?? null,
          component_item_name: componentItem?.name ?? null,
          component_item_type: componentItem?.type ?? null,
          component_standard_cost: canSeeCost ? (componentItem?.standard_cost ?? null) : null,
          qty_per_unit_output: line.qty_per_unit_output,
          uom: line.uom
        };
      });

      return {
        bom_id: bom.bom_id,
        parent_item_id: bom.parent_item_id,
        parent_item_code: parentItem?.item_code ?? null,
        parent_item_name: parentItem?.name ?? null,
        parent_item_base_uom: parentItem?.base_uom ?? null,
        version: bom.version,
        standard_yield_qty: bom.standard_yield_qty,
        standard_yield_uom: bom.standard_yield_uom,
        status: bom.status,
        created_at: bom.created_at,
        lines: bomLines
      };
    });

    return { status: 200, body: { boms: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

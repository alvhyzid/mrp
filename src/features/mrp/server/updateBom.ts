import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageBom } from '@/lib/roles';
import { parseBomInput } from './bomValidation';
import { findBomCycleError } from './bomCycleCheck';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function updateBom(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageBom(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola BOM.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const bomId = Number(body.bom_id);
    if (!bomId) {
      return { status: 400, body: { error: 'ID BOM tidak valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: existingBom, error: existingBomError } = await adminClient
      .from('boms')
      .select('bom_id, company_id, parent_item_id')
      .eq('bom_id', bomId)
      .maybeSingle();

    if (existingBomError) {
      return { status: 500, body: { error: existingBomError.message } };
    }

    if (!existingBom || existingBom.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'BOM tidak ditemukan.' } };
    }

    // parent_item_id & version tidak bisa diubah lewat edit — item induk BOM yang
    // sebenarnya (dari DB) dipakai untuk validasi, bukan apa pun yang dikirim client.
    const { input, error } = parseBomInput({ ...body, parent_item_id: existingBom.parent_item_id });
    if (error || !input) {
      return { status: 400, body: { error } };
    }

    const componentIds = input.lines.map((line) => line.component_item_id);
    const { data: relevantItems, error: itemsError } = await adminClient
      .from('items')
      .select('item_id')
      .in('item_id', componentIds)
      .eq('company_id', appUser.company_id);

    if (itemsError) {
      return { status: 500, body: { error: itemsError.message } };
    }

    const validItemIds = new Set((relevantItems ?? []).map((item) => item.item_id));
    for (const componentId of componentIds) {
      if (!validItemIds.has(componentId)) {
        return { status: 400, body: { error: 'Salah satu item komponen tidak ditemukan di perusahaan Anda.' } };
      }
    }

    const cycleError = await findBomCycleError(adminClient, appUser.company_id, existingBom.parent_item_id, componentIds, bomId);
    if (cycleError) {
      return { status: 400, body: { error: cycleError } };
    }

    const { error: updateError } = await adminClient
      .from('boms')
      .update({
        standard_yield_qty: input.standard_yield_qty,
        standard_yield_uom: input.standard_yield_uom,
        status: input.status,
        buffer_percentage: input.buffer_percentage
      })
      .eq('bom_id', bomId);

    if (updateError) {
      return { status: 500, body: { error: updateError.message } };
    }

    const { error: deleteLinesError } = await adminClient.from('bom_lines').delete().eq('bom_id', bomId);
    if (deleteLinesError) {
      return { status: 500, body: { error: deleteLinesError.message } };
    }

    const { error: linesInsertError } = await adminClient.from('bom_lines').insert(
      input.lines.map((line) => ({
        bom_id: bomId,
        component_item_id: line.component_item_id,
        qty_per_unit_output: line.qty_per_unit_output,
        uom: line.uom
      }))
    );

    if (linesInsertError) {
      return { status: 500, body: { error: linesInsertError.message } };
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

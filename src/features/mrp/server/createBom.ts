import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageBom } from '@/lib/roles';
import { parseBomInput, validateLineRoutingSteps } from './bomValidation';
import { findBomCycleError } from './bomCycleCheck';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function createBom(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageBom(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola BOM.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const { input, error } = parseBomInput(body);
    if (error || !input) {
      return { status: 400, body: { error } };
    }

    const adminClient = getAdminClient();

    const componentIds = input.lines.map((line) => line.component_item_id);
    const { data: relevantItems, error: itemsError } = await adminClient
      .from('items')
      .select('item_id, company_id')
      .in('item_id', [input.parent_item_id, ...componentIds])
      .eq('company_id', appUser.company_id);

    if (itemsError) {
      return { status: 500, body: { error: itemsError.message } };
    }

    const validItemIds = new Set((relevantItems ?? []).map((item) => item.item_id));
    if (!validItemIds.has(input.parent_item_id)) {
      return { status: 400, body: { error: 'Item induk tidak ditemukan di perusahaan Anda.' } };
    }
    for (const componentId of componentIds) {
      if (!validItemIds.has(componentId)) {
        return { status: 400, body: { error: 'Salah satu item komponen tidak ditemukan di perusahaan Anda.' } };
      }
    }

    const cycleError = await findBomCycleError(adminClient, appUser.company_id, input.parent_item_id, componentIds);
    if (cycleError) {
      return { status: 400, body: { error: cycleError } };
    }

    const routingStepError = await validateLineRoutingSteps(adminClient, appUser.company_id, input.parent_item_id, input.lines);
    if (routingStepError) {
      return { status: 400, body: { error: routingStepError } };
    }

    const { data: latestVersion } = await adminClient
      .from('boms')
      .select('version')
      .eq('parent_item_id', input.parent_item_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    const { data: insertedBom, error: bomInsertError } = await adminClient
      .from('boms')
      .insert([
        {
          company_id: appUser.company_id,
          parent_item_id: input.parent_item_id,
          version: nextVersion,
          standard_yield_qty: input.standard_yield_qty,
          standard_yield_uom: input.standard_yield_uom,
          status: input.status,
          buffer_percentage: input.buffer_percentage,
          standard_yield_basis_note: input.standard_yield_basis_note,
          standard_yield_source: input.standard_yield_source
        }
      ])
      .select('bom_id')
      .single();

    if (bomInsertError || !insertedBom) {
      return { status: 500, body: { error: bomInsertError?.message ?? 'Gagal membuat BOM.' } };
    }

    const { error: linesInsertError } = await adminClient.from('bom_lines').insert(
      input.lines.map((line) => ({
        bom_id: insertedBom.bom_id,
        component_item_id: line.component_item_id,
        qty_per_unit_output: line.qty_per_unit_output,
        uom: line.uom,
        routing_step_id: line.routing_step_id
      }))
    );

    if (linesInsertError) {
      await adminClient.from('boms').delete().eq('bom_id', insertedBom.bom_id);
      return { status: 500, body: { error: linesInsertError.message } };
    }

    return { status: 200, body: { success: true, bom_id: insertedBom.bom_id, version: nextVersion } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

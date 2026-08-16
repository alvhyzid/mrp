import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageWorkOrder } from '@/lib/roles';
import { parseWorkOrderInput } from './workOrderValidation';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function createWorkOrder(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageWorkOrder(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin membuat Work Order.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const { input, error } = parseWorkOrderInput(body);
    if (error || !input) {
      return { status: 400, body: { error } };
    }

    const adminClient = getAdminClient();

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .select('production_plant_id')
      .eq('production_plant_id', input.production_plant_id)
      .eq('company_id', appUser.company_id)
      .maybeSingle();
    if (plantError) return { status: 500, body: { error: plantError.message } };
    if (!plant) return { status: 400, body: { error: 'Lokasi pabrik tidak ditemukan di perusahaan Anda.' } };

    const { data: bom, error: bomError } = await adminClient
      .from('boms')
      .select('bom_id, company_id, parent_item_id')
      .eq('bom_id', input.bom_id)
      .maybeSingle();
    if (bomError) return { status: 500, body: { error: bomError.message } };
    if (!bom || bom.company_id !== appUser.company_id) {
      return { status: 400, body: { error: 'BOM tidak ditemukan di perusahaan Anda.' } };
    }

    let itemId = bom.parent_item_id;

    // sales_order_line_id boleh kosong (nullable di skema) — dipakai untuk WO produksi WIP
    // di muka (mis. Base Gelatin) yang belum terikat SO customer. PPIC yang menentukan
    // kapan WO perlu ditaut ke SO line dan kapan tidak.
    if (input.sales_order_line_id !== null) {
      const { data: soLine, error: soLineError } = await adminClient
        .from('sales_order_lines')
        .select('sales_order_line_id, item_id, qty_ordered, sales_order_id')
        .eq('sales_order_line_id', input.sales_order_line_id)
        .maybeSingle();
      if (soLineError) return { status: 500, body: { error: soLineError.message } };
      if (!soLine) return { status: 400, body: { error: 'SO line tidak ditemukan.' } };

      const { data: so, error: soError } = await adminClient
        .from('sales_orders')
        .select('company_id, status')
        .eq('sales_order_id', soLine.sales_order_id)
        .single();
      if (soError) return { status: 500, body: { error: soError.message } };
      if (so.company_id !== appUser.company_id) return { status: 400, body: { error: 'SO line tidak ditemukan di perusahaan Anda.' } };

      if (bom.parent_item_id !== soLine.item_id) {
        return { status: 400, body: { error: 'BOM yang dipilih bukan untuk item pada SO line ini.' } };
      }

      itemId = soLine.item_id;
    }

    if (input.routing_id) {
      const { data: routing, error: routingError } = await adminClient
        .from('routings')
        .select('routing_id, company_id, item_id')
        .eq('routing_id', input.routing_id)
        .maybeSingle();
      if (routingError) return { status: 500, body: { error: routingError.message } };
      if (!routing || routing.company_id !== appUser.company_id || routing.item_id !== itemId) {
        return { status: 400, body: { error: 'Routing yang dipilih tidak valid untuk item ini.' } };
      }
    }

    const { data: insertedWo, error: insertError } = await adminClient
      .from('work_orders')
      .insert([
        {
          company_id: appUser.company_id,
          production_plant_id: input.production_plant_id,
          item_id: itemId,
          bom_id: input.bom_id,
          routing_id: input.routing_id,
          sales_order_line_id: input.sales_order_line_id,
          planned_qty: input.planned_qty,
          status: 'planned',
          priority: input.priority,
          scheduled_start: input.scheduled_start,
          scheduled_end: input.scheduled_end
        }
      ])
      .select('work_order_id')
      .single();

    if (insertError || !insertedWo) {
      return { status: 500, body: { error: insertError?.message ?? 'Gagal membuat Work Order.' } };
    }

    return { status: 200, body: { success: true, work_order_id: insertedWo.work_order_id } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageProductionDisruptions } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const disruptionTypes = ['equipment_breakdown', 'utility_outage', 'external_factor', 'reprioritized', 'changeover', 'other'];

export async function createProductionDisruption(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageProductionDisruptions(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mencatat gangguan produksi.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const disruptionType = String(body.disruption_type ?? '').trim();
    const productionPlantId = Number(body.production_plant_id);
    const workCenterId = body.work_center_id ? Number(body.work_center_id) : null;
    const workOrderId = body.work_order_id ? Number(body.work_order_id) : null;
    const productionBatchId = body.production_batch_id ? Number(body.production_batch_id) : null;
    const description = body.description ? String(body.description).trim() : null;

    if (!disruptionTypes.includes(disruptionType)) {
      return { status: 400, body: { error: 'Jenis gangguan tidak valid.' } };
    }
    if (!productionPlantId) {
      return { status: 400, body: { error: 'Lokasi pabrik wajib dipilih.' } };
    }

    const adminClient = getAdminClient();

    const { data: plant, error: plantError } = await adminClient.from('production_plants').select('production_plant_id, company_id').eq('production_plant_id', productionPlantId).maybeSingle();
    if (plantError) return { status: 500, body: { error: plantError.message } };
    if (!plant || plant.company_id !== appUser.company_id) {
      return { status: 400, body: { error: 'Lokasi pabrik tidak valid.' } };
    }

    if (workCenterId) {
      const { data: wc, error: wcError } = await adminClient.from('work_centers').select('work_center_id, company_id').eq('work_center_id', workCenterId).maybeSingle();
      if (wcError) return { status: 500, body: { error: wcError.message } };
      if (!wc || wc.company_id !== appUser.company_id) {
        return { status: 400, body: { error: 'Work Center tidak valid.' } };
      }
    }
    if (workOrderId) {
      const { data: wo, error: woError } = await adminClient.from('work_orders').select('work_order_id, company_id').eq('work_order_id', workOrderId).maybeSingle();
      if (woError) return { status: 500, body: { error: woError.message } };
      if (!wo || wo.company_id !== appUser.company_id) {
        return { status: 400, body: { error: 'Work Order tidak valid.' } };
      }
    }

    const { data: created, error: insertError } = await adminClient
      .from('production_disruptions')
      .insert([
        {
          company_id: appUser.company_id,
          disruption_type: disruptionType,
          production_plant_id: productionPlantId,
          work_center_id: workCenterId,
          work_order_id: workOrderId,
          production_batch_id: productionBatchId,
          started_at: new Date().toISOString(),
          description
        }
      ])
      .select('production_disruption_id')
      .single();
    if (insertError) return { status: 500, body: { error: insertError.message } };

    return { status: 201, body: { production_disruption_id: created.production_disruption_id } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

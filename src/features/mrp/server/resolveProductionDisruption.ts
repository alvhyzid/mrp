import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageProductionDisruptions } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function resolveProductionDisruption(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageProductionDisruptions(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin menyelesaikan gangguan produksi.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const productionDisruptionId = Number(body.production_disruption_id);
    if (!productionDisruptionId) {
      return { status: 400, body: { error: 'Gangguan produksi wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: disruption, error: fetchError } = await adminClient
      .from('production_disruptions')
      .select('production_disruption_id, company_id, resolved_at')
      .eq('production_disruption_id', productionDisruptionId)
      .maybeSingle();
    if (fetchError) return { status: 500, body: { error: fetchError.message } };
    if (!disruption || disruption.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Gangguan produksi tidak ditemukan.' } };
    }
    if (disruption.resolved_at) {
      return { status: 400, body: { error: 'Gangguan ini sudah ditandai selesai sebelumnya.' } };
    }

    const { error: updateError } = await adminClient.from('production_disruptions').update({ resolved_at: new Date().toISOString() }).eq('production_disruption_id', productionDisruptionId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

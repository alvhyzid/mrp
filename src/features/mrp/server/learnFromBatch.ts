import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canProposeProductionStandard } from '@/lib/roles';
import { learnFromBatchCore } from './learnFromBatchCore';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Endpoint HTTP untuk memicu MANUAL pengajuan sampel K8 dari satu batch (mis.
// batch lama yang belum pernah lewat completeProductionBatch.ts). Logic gerbang
// kelengkapan + hitung sampel ada di learnFromBatchCore.ts — dipakai juga
// otomatis oleh completeProductionBatch.ts saat batch ditandai selesai.
export async function learnFromBatch(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canProposeProductionStandard(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya akses untuk mengajukan sampel standar produksi.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const productionBatchId = Number(body.production_batch_id);
    if (!productionBatchId) {
      return { status: 400, body: { error: 'production_batch_id wajib diisi.' } };
    }

    const adminClient = getAdminClient();
    return await learnFromBatchCore(adminClient, appUser.company_id, productionBatchId);
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canRecordStepProgress } from '@/lib/roles';
import { learnFromBatchCore } from './learnFromBatchCore';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// "Selesaikan Batch" (Fase Produksi Nyata, P1) — in_progress -> completed lewat
// state machine yang SUDAH ADA (status_transition_rules + trigger
// enforce_status_transition, migration 20260817100000) — TIDAK di-bypass sama
// sekali, transisi ilegal (mis. planned -> completed langsung) ditolak trigger,
// bukan dicek ulang di sini.
//
// Begitu transisi berhasil, batch OTOMATIS diajukan sebagai sampel K8
// (learnFromBatchCore) — TIDAK menunggu klik terpisah. Batch dengan log tahap
// belum lengkap TETAP BOLEH diselesaikan (status produksi ≠ kelengkapan
// pencatatan) — cuma dikecualikan dari sampel belajar, tercatat di
// production_standard_exclusions (lihat learnFromBatchCore.ts).
export async function completeProductionBatch(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canRecordStepProgress(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin menyelesaikan batch produksi.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const productionBatchId = Number(body.production_batch_id);
    if (!productionBatchId) {
      return { status: 400, body: { error: 'production_batch_id wajib diisi.' } };
    }
    const rework = Boolean(body.rework);

    const adminClient = getAdminClient();

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, company_id, status')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan di perusahaan Anda.' } };
    }

    const { error: updateError } = await adminClient
      .from('production_batches')
      .update({ status: 'completed', completed_at: new Date().toISOString(), rework })
      .eq('production_batch_id', productionBatchId);
    if (updateError) return { status: 400, body: { error: updateError.message } };

    const learnResult = await learnFromBatchCore(adminClient, appUser.company_id, productionBatchId);

    return { status: 200, body: { success: true, k8_sample: learnResult.body } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

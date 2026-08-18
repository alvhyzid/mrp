import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canRecordStepProgress } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// "Mulai Batch" (Fase Produksi Nyata, P1) — planned -> in_progress. Transisi
// sudah terdaftar di status_transition_rules (migration 20260817100000) sejak
// awal, cuma belum pernah ada kode aplikasi yang benar-benar memicunya. UPDATE
// di sini SENGAJA tidak memvalidasi transisi sendiri — trigger enforce_status_
// transition() di database yang menegakkan, supaya tidak ada 2 tempat berbeda
// yang bisa longgar sendiri-sendiri.
export async function startProductionBatch(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canRecordStepProgress(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin memulai batch produksi.' } };
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
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('production_batch_id', productionBatchId);
    if (updateError) return { status: 400, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

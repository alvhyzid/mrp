import type { NextRequest } from 'next/server';
import { getAdminClient, getCurrentUser } from '@/lib/supabaseServer';
import { canViewFinancialData, canViewWages } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Biaya SDM per batch untuk tampilan (Margin Kontribusi & halaman detail batch).
// Aturan tampilan K1: general_manager/finance_manager cuma lihat TOTAL, rincian
// per-orang HANYA company_admin — dua RPC terpisah (masing-masing sudah menggerbangi
// dirinya sendiri di level DB, migration 20260818100000/110000), di sini cuma
// meneruskan appUser.role sebagai konteks lewat JWT bawaan Supabase (endpoint ini
// TIDAK pakai service-role utk pemanggilan RPC-nya supaya gate JWT di DB tetap jalan).
export async function getBatchLaborCost(request: NextRequest, productionBatchId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }
    if (!canViewFinancialData(appUser.role) && !canViewWages(appUser.role)) {
      return { status: 403, body: { error: 'Anda tidak punya akses ke biaya SDM.' } };
    }

    // RPC harus dipanggil dengan JWT user asli (bukan service-role) supaya gate
    // privasi K1 di level DB berlaku — pakai client baru yang membawa Authorization
    // header user, BUKAN adminClient.
    const authHeader = request.headers.get('authorization');
    const { createClient } = await import('@supabase/supabase-js');
    const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader ?? '' } }
    });

    const { data: total, error: totalError } = await userClient.rpc('get_production_batch_labor_cost_total', { p_production_batch_id: productionBatchId });
    if (totalError) return { status: 400, body: { error: totalError.message } };

    const { data: detail, error: detailError } = await userClient.rpc('get_production_batch_labor_cost_detail', { p_production_batch_id: productionBatchId });
    if (detailError) return { status: 400, body: { error: detailError.message } };

    return { status: 200, body: { total_cost: total, detail: detail ?? [] } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

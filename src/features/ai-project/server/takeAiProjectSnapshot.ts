import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';
import { computeAllProgress } from './computeAiProjectProgress';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Snapshot progres harian -- dipanggil manual (tombol UI) atau lewat cron
// eksternal nanti (BELUM ada cron di sesi ini, di luar cakupan K1b). Simpan
// overall_percent + per_phase supaya tren minggu-ke-minggu bisa ditampilkan.
export async function takeAiProjectSnapshot(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Dashboard Proyek AI khusus company_admin atau general_manager (tim inti).' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { overallPercent, phaseProgress } = await computeAllProgress(adminClient, appUser.company_id);

    const perPhase = Object.fromEntries(phaseProgress.map((p) => [p.code, { progress_percent: p.progress_percent, contribution_to_total: p.contribution_to_total }]));

    const { error: insertError } = await adminClient.from('ai_project_progress_snapshots').insert([{ company_id: appUser.company_id, overall_percent: overallPercent, per_phase: perPhase }]);
    if (insertError) return { status: 500, body: { error: insertError.message } };

    return { status: 200, body: { success: true, overall_percent: overallPercent } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';
import { computeProcessMiningInsights } from './computeProcessMiningInsights';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Dashboard Process Mining (Fase 0.4) -- ditafsirkan leadership-only, sama
// dgn Dashboard Proyek AI (Bagian C): ini alat analisis operasional internal
// utk pemilik produk & PPIC/manajemen menilai temuannya, bukan fitur tenant
// biasa. TANPA LLM -- murni query & agregasi.
export async function getProcessMiningDashboard(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Dashboard Process Mining khusus Admin Perusahaan atau General Manager.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const result = await computeProcessMiningInsights(adminClient, appUser.company_id);
    return { status: 200, body: { ...result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

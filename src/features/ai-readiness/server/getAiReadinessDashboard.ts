import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { hitungKesiapanAi } from './recomputeAiReadiness';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Halaman Kesiapan AI (§3.4) -- TENANT-FACING, bukan alat internal (beda dari
// Dashboard Proyek AI / Process Mining yang leadership-only). Semua role
// company boleh lihat kesiapan perusahaannya sendiri.
export async function getAiReadinessDashboard(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const capabilities = await hitungKesiapanAi(adminClient, appUser.company_id);
    const unlockedCount = capabilities.filter((c) => c.is_unlocked).length;
    const overallReadinessPercent =
      capabilities.length > 0
        ? Math.round((capabilities.reduce((sum, c) => sum + c.readiness_percent, 0) / capabilities.length) * 100) / 100
        : 0;

    return {
      status: 200,
      body: {
        capabilities,
        unlocked_count: unlockedCount,
        total_count: capabilities.length,
        overall_readiness_percent: overallReadinessPercent
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

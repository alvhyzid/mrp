import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';
import { seedKamusMetricTerms } from '@/features/kamus/server';
import { seedKpiRegistry } from './seedKpiRegistry';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Idempoten (upsert by metric_key) -- boleh dipanggil ulang tanpa efek samping,
// pola sama runAiProjectSeed.ts. Kamus METRIC diseed dulu (kpi_registry.metric_key
// WAJIB sudah ada di kamus_terms, FK komposit menegakkan ini di level DB).
export async function runKpiSeed(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Seed modul KPI khusus company_admin atau general_manager.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const kamusResult = await seedKamusMetricTerms(adminClient, appUser.company_id);
    const registryResult = await seedKpiRegistry(adminClient, appUser.company_id);

    return { status: 200, body: { kamus: kamusResult, registry: registryResult } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';
import { generateKamusBacklog } from './generateKamusBacklog';
import { seedKamusMetricTerms } from './seedKamusMetricTerms';
import { seedKamusIngredientRules } from './seedKamusIngredientRules';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Jalankan generator backlog (scan skema FIELD) + seed METRIC -- leadership-only
// (aksi administratif, bukan menjawab pertanyaan). Idempoten -- aman dipanggil
// berkali-kali, cuma menambah baris kolom/metrik BARU.
export async function runKamusGenerator(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Hanya company_admin atau general_manager yang dapat menjalankan generator kamus.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const fieldResult = await generateKamusBacklog(adminClient, appUser.company_id);
    const metricResult = await seedKamusMetricTerms(adminClient, appUser.company_id);
    const ruleResult = await seedKamusIngredientRules(adminClient, appUser.company_id);

    const priority12 = (fieldResult.countsByPriority[1] ?? 0) + (fieldResult.countsByPriority[2] ?? 0) + metricResult.inserted + ruleResult.inserted;
    // STOP CONDITION (§7 dokumen): >200 baris prioritas 1-2 -> laporkan, jangan
    // paksa dipakai (bukan error keras, cuma penanda eksplisit di respons).
    const stopConditionTriggered = priority12 > 200;

    return {
      status: 200,
      body: { field: fieldResult, metric: metricResult, rule: ruleResult, priority1And2Total: priority12, stopConditionTriggered }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

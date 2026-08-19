import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';
import { seedAiProjectStructure } from './seedAiProjectStructure';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function runAiProjectSeed(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Dashboard Proyek AI khusus company_admin atau general_manager (tim inti).' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const result = await seedAiProjectStructure(adminClient, appUser.company_id);

    // STOP CONDITION §7: >40 tugas -> laporkan (bukan error keras, penanda eksplisit).
    const stopConditionTriggered = result.totalTasks > 40;

    return { status: 200, body: { ...result, stopConditionTriggered } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

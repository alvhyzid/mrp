import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listWorkCenters(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { data: workCenters, error } = await adminClient
      .from('work_centers')
      .select('work_center_id, name, code, production_plant_id, is_active')
      .eq('company_id', appUser.company_id)
      .order('name', { ascending: true });

    if (error) return { status: 500, body: { error: error.message } };

    return { status: 200, body: { workCenters: workCenters ?? [] } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

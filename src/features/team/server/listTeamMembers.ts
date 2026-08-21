import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listTeamMembers(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (appUser.role !== 'company_admin') {
      return { status: 403, body: { error: 'Hanya Admin Perusahaan yang dapat melihat daftar tim.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('users')
      .select('user_id, name, email, role, status')
      .eq('company_id', appUser.company_id)
      .order('user_id', { ascending: true });

    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    return { status: 200, body: { members: data, currentUserId: appUser.user_id } };
  } catch (error) {
    return {
      status: 401,
      body: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listDocumentTypes(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }
    const adminClient = getAdminClient();
    const { data: types, error } = await adminClient.from('document_types').select('*').eq('company_id', appUser.company_id).order('code');
    if (error) return { status: 500, body: { error: error.message } };
    return { status: 200, body: { document_types: types ?? [] } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function getCompany(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('companies')
      .select('company_id, name, industry_type, status, logo_url')
      .eq('company_id', appUser.company_id)
      .single();

    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    return { status: 200, body: { company: data } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function updateCompany(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (appUser.role !== 'company_admin') {
      return { status: 403, body: { error: 'Hanya Admin Perusahaan yang dapat mengubah data perusahaan.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const name = String(body.name || '').trim();
    const industryType = String(body.industry_type || '').trim();

    if (!name || !industryType) {
      return { status: 400, body: { error: 'Nama perusahaan dan jenis industri wajib diisi.' } };
    }

    const adminClient = getAdminClient();
    const { error: updateError } = await adminClient
      .from('companies')
      .update({ name, industry_type: industryType })
      .eq('company_id', appUser.company_id);

    if (updateError) {
      return { status: 500, body: { error: updateError.message } };
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

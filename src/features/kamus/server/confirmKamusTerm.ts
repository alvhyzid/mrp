import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Konfirmasi "dua mata" -- HANYA leadership (company_admin/general_manager),
// pola sama K8 (decideProductionStandardProposal). Jawaban berstatus DIJAWAB
// masuk ke sini sebelum resmi jadi bagian kamus yang diekspor.
export async function confirmKamusTerm(request: NextRequest, kamusTermId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Hanya Admin Perusahaan atau General Manager yang dapat mengonfirmasi jawaban kamus.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { data: existing, error: existingError } = await adminClient
      .from('kamus_terms')
      .select('kamus_term_id, company_id, status')
      .eq('kamus_term_id', kamusTermId)
      .maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };
    if (!existing || existing.company_id !== appUser.company_id) return { status: 404, body: { error: 'Istilah tidak ditemukan.' } };
    if (existing.status !== 'DIJAWAB') {
      return { status: 400, body: { error: 'Hanya istilah berstatus DIJAWAB yang bisa dikonfirmasi.' } };
    }

    const { error: updateError } = await adminClient
      .from('kamus_terms')
      .update({ status: 'DIKONFIRMASI', confirmed_by: appUser.user_id })
      .eq('kamus_term_id', kamusTermId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canDecideProductionStandardProposal } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// K8 bagian D.1 — SATU-SATUNYA jalur yang boleh mengubah production_standards
// dari sumber ESTIMASI_MANUAL ke DIPELAJARI (atau memperbarui nilai yang sudah
// DIPELAJARI). Gerbang role SENGAJA lebih sempit dari yang boleh menulis
// production_standards secara umum (RLS) — lihat catatan di
// canDecideProductionStandardProposal (src/lib/roles.ts).
export async function decideProductionStandardProposal(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canDecideProductionStandardProposal(appUser.role)) {
      return { status: 403, body: { error: 'Hanya Admin Perusahaan, General Manager, atau Manajer PPIC yang dapat mengesahkan usulan standar produksi.' } };
    }
    if (!appUser.company_id || !appUser.user_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const proposalId = Number(body.production_standard_proposal_id);
    const decision = String(body.decision ?? '');
    if (!proposalId || !['approved', 'rejected'].includes(decision)) {
      return { status: 400, body: { error: 'Usulan standar dan keputusan (setuju/tolak) wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: proposal, error: proposalError } = await adminClient
      .from('production_standard_proposals')
      .select('production_standard_proposal_id, company_id, status')
      .eq('production_standard_proposal_id', proposalId)
      .maybeSingle();
    if (proposalError) return { status: 500, body: { error: proposalError.message } };
    if (!proposal || proposal.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Usulan tidak ditemukan di perusahaan Anda.' } };
    }
    if (proposal.status !== 'pending') {
      return { status: 400, body: { error: 'Usulan ini sudah diputuskan sebelumnya.' } };
    }

    const { error: rpcError } = await adminClient.rpc('decide_production_standard_proposal', {
      p_proposal_id: proposalId,
      p_decision: decision,
      p_user_id: appUser.user_id
    });
    if (rpcError) return { status: 400, body: { error: rpcError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

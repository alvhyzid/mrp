import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { SUPER_ADMIN_ROLE } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Override kesiapan (§3.3): "HANYA boleh dipakai admin internal (bukan admin
// tenant), wajib beralasan dan berbatas waktu -- untuk demo atau uji coba."
// Admin internal = super_admin (staf platform kita, lintas-tenant) -- BUKAN
// company_admin tenant manapun, sekalipun tenant itu sendiri. Tidak ada UI
// yang memanggil fungsi ini (tidak ada admin console platform sekarang) --
// disiapkan agar RLS + gerbang TypeScript-nya sudah teruji sebelum konsolnya
// dibangun nanti.
export async function createAiCapabilityOverride(
  request: NextRequest,
  input: { companyId: number; capabilityCode: string; reason: string; expiresAt: string }
): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (appUser.role !== SUPER_ADMIN_ROLE) {
      return { status: 403, body: { error: 'Override kesiapan AI hanya bisa dibuat oleh Admin Internal Platform, bukan admin perusahaan.' } };
    }
    if (!input.reason?.trim()) {
      return { status: 400, body: { error: 'Alasan override wajib diisi.' } };
    }
    if (!input.expiresAt) {
      return { status: 400, body: { error: 'Override wajib berbatas waktu (tanggal kedaluwarsa).' } };
    }

    const adminClient = getAdminClient();
    const { data: capability, error: capError } = await adminClient
      .from('ai_capabilities')
      .select('ai_capability_id')
      .eq('code', input.capabilityCode)
      .maybeSingle();
    if (capError) return { status: 500, body: { error: capError.message } };
    if (!capability) return { status: 404, body: { error: 'Kemampuan tidak ditemukan.' } };

    const { error: insertError } = await adminClient.from('ai_capability_overrides').insert([
      {
        company_id: input.companyId,
        capability_id: capability.ai_capability_id,
        unlocked_by: appUser.user_id,
        reason: input.reason,
        expires_at: input.expiresAt
      }
    ]);
    if (insertError) return { status: 500, body: { error: insertError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

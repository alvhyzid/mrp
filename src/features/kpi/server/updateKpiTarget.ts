import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageKpiRegistry } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Skenario negatif (b) sesi KPI-1: target KPI DISIPLIN terkunci ideal, TIDAK bisa
// diubah tenant sama sekali (bukan cuma dibatasi role) -- gerbang ganda: cek kind
// SEBELUM cek role, supaya jelas ini penolakan "memang tidak boleh", bukan "Anda
// tidak berwenang". Perubahan target_value KPI HASIL tercatat kpi_registry_history
// (skenario c3).
export async function updateKpiTarget(request: NextRequest, kpiRegistryId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { data: kpi, error: kpiError } = await adminClient.from('kpi_registry').select('*').eq('kpi_registry_id', kpiRegistryId).maybeSingle();
    if (kpiError) return { status: 500, body: { error: kpiError.message } };
    if (!kpi || kpi.company_id !== appUser.company_id) return { status: 404, body: { error: 'KPI tidak ditemukan.' } };

    if (kpi.kind === 'DISIPLIN') {
      return { status: 400, body: { error: 'Target KPI DISIPLIN terkunci ideal (100%/0) dan tidak bisa diubah — ini bukan kebijakan yang bisa dinegosiasikan tenant.' } };
    }

    if (!canManageKpiRegistry(appUser.role)) {
      return { status: 403, body: { error: 'Hanya Admin Perusahaan/General Manager yang boleh menetapkan target KPI.' } };
    }

    const body = await request.json();
    const newTarget = body.target_value === null || body.target_value === undefined ? null : Number(body.target_value);
    if (newTarget !== null && Number.isNaN(newTarget)) {
      return { status: 400, body: { error: 'Nilai target harus berupa angka atau dikosongkan.' } };
    }

    const oldTarget = kpi.target_value !== null ? Number(kpi.target_value) : null;
    if (oldTarget === newTarget) {
      return { status: 200, body: { success: true, unchanged: true } };
    }

    const { error: updateError } = await adminClient
      .from('kpi_registry')
      .update({ target_value: newTarget, target_set_at: new Date().toISOString(), target_set_by: appUser.user_id })
      .eq('kpi_registry_id', kpiRegistryId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    const { error: historyError } = await adminClient.from('kpi_registry_history').insert([
      { kpi_registry_id: kpiRegistryId, changed_by: appUser.user_id, field_changed: 'target_value', old_value: oldTarget !== null ? String(oldTarget) : null, new_value: newTarget !== null ? String(newTarget) : null }
    ]);
    if (historyError) return { status: 500, body: { error: historyError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

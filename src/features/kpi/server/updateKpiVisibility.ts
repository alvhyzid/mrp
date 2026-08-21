import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageKpiRegistry } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const VALID_VISIBILITY = ['DIRI', 'ATASAN', 'DEPARTEMEN', 'PUBLIK_AGREGAT'];
const VALID_ATTRIBUTION = ['INDIVIDU', 'TIM', 'LINI', 'PROSES', 'PERUSAHAAN'];

// Skenario negatif (c3): perubahan visibility/attribution_level tercatat
// kpi_registry_history — satu baris per field, pola sama updateKpiTarget.ts.
// Leadership-only (canManageKpiRegistry) — ini kebijakan tenant, bukan
// keputusan operasional harian pemilik KPI.
export async function updateKpiVisibility(request: NextRequest, kpiRegistryId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }
    if (!canManageKpiRegistry(appUser.role)) {
      return { status: 403, body: { error: 'Hanya Admin Perusahaan/General Manager yang boleh mengubah visibilitas/atribusi KPI.' } };
    }

    const adminClient = getAdminClient();
    const { data: kpi, error: kpiError } = await adminClient.from('kpi_registry').select('*').eq('kpi_registry_id', kpiRegistryId).maybeSingle();
    if (kpiError) return { status: 500, body: { error: kpiError.message } };
    if (!kpi || kpi.company_id !== appUser.company_id) return { status: 404, body: { error: 'KPI tidak ditemukan.' } };

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    const historyRows: { kpi_registry_id: number; changed_by: number; field_changed: string; old_value: string | null; new_value: string | null }[] = [];

    if (body.visibility !== undefined) {
      if (!Array.isArray(body.visibility) || body.visibility.some((v: unknown) => typeof v !== 'string' || !VALID_VISIBILITY.includes(v))) {
        return { status: 400, body: { error: `visibility harus array berisi: ${VALID_VISIBILITY.join(', ')}.` } };
      }
      const oldVisibility = JSON.stringify(kpi.visibility ?? []);
      const newVisibility = JSON.stringify(body.visibility);
      if (oldVisibility !== newVisibility) {
        updates.visibility = body.visibility;
        historyRows.push({ kpi_registry_id: kpiRegistryId, changed_by: appUser.user_id, field_changed: 'visibility', old_value: oldVisibility, new_value: newVisibility });
      }
    }

    if (body.attribution_level !== undefined) {
      if (typeof body.attribution_level !== 'string' || !VALID_ATTRIBUTION.includes(body.attribution_level)) {
        return { status: 400, body: { error: `attribution_level harus salah satu: ${VALID_ATTRIBUTION.join(', ')}.` } };
      }
      if (kpi.attribution_level !== body.attribution_level) {
        updates.attribution_level = body.attribution_level;
        historyRows.push({ kpi_registry_id: kpiRegistryId, changed_by: appUser.user_id, field_changed: 'attribution_level', old_value: kpi.attribution_level, new_value: body.attribution_level });
      }
    }

    if (Object.keys(updates).length === 0) {
      return { status: 200, body: { success: true, unchanged: true } };
    }

    const { error: updateError } = await adminClient.from('kpi_registry').update(updates).eq('kpi_registry_id', kpiRegistryId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    const { error: historyError } = await adminClient.from('kpi_registry_history').insert(historyRows);
    if (historyError) return { status: 500, body: { error: historyError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

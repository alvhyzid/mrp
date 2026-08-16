import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Klik alert di Bell Icon -> tandai acknowledged (badge berkurang). Siapa saja
// di perusahaan yang sama boleh acknowledge (sama seperti pola resolve alert
// lain di sistem ini — lihat komentar system_alerts_update_for_company di
// migration 20260812154000).
export async function acknowledgeSystemAlert(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const alertId = Number(body.system_alert_id);
    if (!alertId) {
      return { status: 400, body: { error: 'ID alert tidak valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: alert, error: alertError } = await adminClient
      .from('system_alerts')
      .select('system_alert_id, company_id, status')
      .eq('system_alert_id', alertId)
      .maybeSingle();
    if (alertError) return { status: 500, body: { error: alertError.message } };
    if (!alert || alert.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Alert tidak ditemukan.' } };
    }
    if (alert.status !== 'open') {
      return { status: 400, body: { error: 'Alert ini sudah tidak berstatus terbuka.' } };
    }

    const { error: updateError } = await adminClient
      .from('system_alerts')
      .update({ status: 'acknowledged', acknowledged_by: appUser.user_id, acknowledged_at: new Date().toISOString() })
      .eq('system_alert_id', alertId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership, getDepartmentForRole } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Data bersama (satu tabel system_alerts) dipakai lintas dashboard department —
// tiap dashboard cuma memfilter alert_type yang relevan buat mereka lewat query
// param, bukan tabel/endpoint terpisah (lihat Prinsip Desain #8 di docs).
export async function listSystemAlerts(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const alertTypesParam = request.nextUrl.searchParams.get('alert_types');
    const alertTypes = alertTypesParam ? alertTypesParam.split(',').map((v) => v.trim()).filter(Boolean) : null;
    const status = request.nextUrl.searchParams.get('status') ?? 'open';
    // scope=my_department: dipakai Bell Icon Notifikasi — company_admin/general_manager
    // tetap lihat semua (leadership dikecualikan dari filter ini), role lain cuma lihat
    // alert dengan target_department null (relevan semua department) ATAU department
    // mereka sendiri. Department DIHITUNG DARI ROLE user yang login (server-side), bukan
    // dari input client, supaya tidak bisa diminta lihat department orang lain.
    const scope = request.nextUrl.searchParams.get('scope');

    const adminClient = getAdminClient();
    let query = adminClient
      .from('system_alerts')
      .select('system_alert_id, alert_type, target_department, related_work_order_id, related_po_id, related_item_id, message, severity, status, created_at, acknowledged_by, acknowledged_at')
      .eq('company_id', appUser.company_id)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (alertTypes && alertTypes.length > 0) {
      query = query.in('alert_type', alertTypes);
    }
    if (scope === 'my_department' && !isCompanyLeadership(appUser.role)) {
      const department = getDepartmentForRole(appUser.role);
      query = department ? query.or(`target_department.is.null,target_department.eq.${department}`) : query.is('target_department', null);
    }

    const { data: alerts, error } = await query;
    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    const itemIds = Array.from(new Set((alerts ?? []).map((a) => a.related_item_id).filter((id): id is number => !!id)));
    const { data: items } = itemIds.length
      ? await adminClient.from('items').select('item_id, item_code, name').in('item_id', itemIds)
      : { data: [] as { item_id: number; item_code: string; name: string }[] };
    const itemsById = new Map((items ?? []).map((i) => [i.item_id, i]));

    const result = (alerts ?? []).map((alert) => ({
      ...alert,
      related_item_code: alert.related_item_id ? itemsById.get(alert.related_item_id)?.item_code ?? null : null,
      related_item_name: alert.related_item_id ? itemsById.get(alert.related_item_id)?.name ?? null : null
    }));

    return { status: 200, body: { alerts: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

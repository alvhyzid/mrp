import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listCustomers(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const includeArchived = new URL(request.url).searchParams.get('includeArchived') === 'true';

    let query = adminClient
      .from('customers')
      .select(
        'customer_id, name, customer_type, contact_info, created_at, billing_address, shipping_address, npwp, pic_name, pic_phone, pic_email, payment_terms, archived_at, archived_by'
      )
      .eq('company_id', appUser.company_id)
      .order('name', { ascending: true });
    if (!includeArchived) query = query.is('archived_at', null);

    const { data, error } = await query;
    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    const customerIds = (data ?? []).map((c) => c.customer_id);
    const [cpoRes, archiversRes] = await Promise.all([
      customerIds.length
        ? adminClient.from('customer_purchase_orders').select('customer_id').eq('company_id', appUser.company_id).in('customer_id', customerIds)
        : Promise.resolve({ data: [] as { customer_id: number }[], error: null }),
      (() => {
        const archivedByIds = Array.from(new Set((data ?? []).map((c) => c.archived_by).filter((id): id is number => !!id)));
        return archivedByIds.length
          ? adminClient.from('users').select('user_id, name').in('user_id', archivedByIds)
          : Promise.resolve({ data: [] as { user_id: number; name: string }[], error: null });
      })()
    ]);
    if (cpoRes.error) return { status: 500, body: { error: cpoRes.error.message } };

    const cpoCountByCustomerId = new Map<number, number>();
    for (const cpo of cpoRes.data ?? []) cpoCountByCustomerId.set(cpo.customer_id, (cpoCountByCustomerId.get(cpo.customer_id) ?? 0) + 1);
    const archiverNameById = new Map((archiversRes.data ?? []).map((u) => [u.user_id, u.name]));

    const customers = (data ?? []).map((c) => ({
      ...c,
      purchase_order_count: cpoCountByCustomerId.get(c.customer_id) ?? 0,
      can_delete: (cpoCountByCustomerId.get(c.customer_id) ?? 0) === 0,
      archived_by_name: c.archived_by ? (archiverNameById.get(c.archived_by) ?? null) : null
    }));

    return { status: 200, body: { customers } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

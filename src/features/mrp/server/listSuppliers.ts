import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listSuppliers(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const includeArchived = new URL(request.url).searchParams.get('includeArchived') === 'true';

    let query = adminClient
      .from('suppliers')
      .select('supplier_id, name, contact_info, lead_time_days, supplier_type, address, npwp, pic_name, pic_phone, pic_email, payment_terms, archived_at, archived_by')
      .eq('company_id', appUser.company_id)
      .order('name', { ascending: true });
    if (!includeArchived) query = query.is('archived_at', null);

    const { data, error } = await query;
    if (error) return { status: 500, body: { error: error.message } };

    const supplierIds = (data ?? []).map((s) => s.supplier_id);
    const [poRes, priceRes, archiversRes] = await Promise.all([
      supplierIds.length
        ? adminClient.from('purchase_orders').select('supplier_id').eq('company_id', appUser.company_id).in('supplier_id', supplierIds)
        : Promise.resolve({ data: [] as { supplier_id: number }[], error: null }),
      supplierIds.length
        ? adminClient.from('supplier_item_prices').select('supplier_id').eq('company_id', appUser.company_id).in('supplier_id', supplierIds)
        : Promise.resolve({ data: [] as { supplier_id: number }[], error: null }),
      (() => {
        const archivedByIds = Array.from(new Set((data ?? []).map((s) => s.archived_by).filter((id): id is number => !!id)));
        return archivedByIds.length
          ? adminClient.from('users').select('user_id, name').in('user_id', archivedByIds)
          : Promise.resolve({ data: [] as { user_id: number; name: string }[], error: null });
      })()
    ]);
    if (poRes.error) return { status: 500, body: { error: poRes.error.message } };
    if (priceRes.error) return { status: 500, body: { error: priceRes.error.message } };

    const poCountBySupplierId = new Map<number, number>();
    for (const po of poRes.data ?? []) poCountBySupplierId.set(po.supplier_id, (poCountBySupplierId.get(po.supplier_id) ?? 0) + 1);
    const priceCountBySupplierId = new Map<number, number>();
    for (const p of priceRes.data ?? []) priceCountBySupplierId.set(p.supplier_id, (priceCountBySupplierId.get(p.supplier_id) ?? 0) + 1);
    const archiverNameById = new Map((archiversRes.data ?? []).map((u) => [u.user_id, u.name]));

    const suppliers = (data ?? []).map((s) => {
      const usageCount = (poCountBySupplierId.get(s.supplier_id) ?? 0) + (priceCountBySupplierId.get(s.supplier_id) ?? 0);
      return {
        ...s,
        purchase_order_count: poCountBySupplierId.get(s.supplier_id) ?? 0,
        supplied_item_count: priceCountBySupplierId.get(s.supplier_id) ?? 0,
        can_delete: usageCount === 0,
        archived_by_name: s.archived_by ? (archiverNameById.get(s.archived_by) ?? null) : null
      };
    });

    return { status: 200, body: { suppliers } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listItems(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('items')
      .select(
        'item_id, item_code, name, type, base_uom, purchase_uom, uom_conversion_factor, shelf_life_days, min_stock_level, reorder_point, reorder_qty, is_active, standard_cost, bpom_registration_number'
      )
      .eq('company_id', appUser.company_id)
      .order('item_code', { ascending: true });

    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    // standard_cost adalah data finansial sensitif (lihat "Kontrol Akses Data
    // Finansial" di docs) — service-role client selalu dapat kolom ini dari DB, jadi
    // masking dilakukan di sini sebelum dikirim ke client, sejalan dengan masking
    // yang sama di view items_secure (defense-in-depth kalau ada akses langsung).
    const canSeeCost = canViewFinancialData(appUser.role);
    const items = (data ?? []).map((item) => (canSeeCost ? item : { ...item, standard_cost: null }));

    return { status: 200, body: { items } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

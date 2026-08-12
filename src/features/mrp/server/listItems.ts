import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

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
        'item_id, item_code, name, type, uom, shelf_life_days, min_stock_level, reorder_point, reorder_qty, is_active, standard_cost'
      )
      .eq('company_id', appUser.company_id)
      .order('item_code', { ascending: true });

    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    return { status: 200, body: { items: data } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

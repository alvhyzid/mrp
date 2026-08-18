import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';
import { createClient } from '@supabase/supabase-js';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Margin Kontribusi per SO (spesifikasi-aturan-biaya-v1.md K2 Tingkat 1) — akses
// dibatasi ke company_admin/general_manager/finance_manager (canViewFinancialData),
// SAMA dengan akses data finansial lain di aplikasi ini (harga jual, standard_cost).
export async function getSalesOrderMargin(request: NextRequest, salesOrderId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canViewFinancialData(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya akses ke data margin.' } };
    }

    const authHeader = request.headers.get('authorization');
    const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader ?? '' } }
    });

    const { data, error } = await userClient.rpc('get_sales_order_margin', { p_sales_order_id: salesOrderId }).single();
    if (error) return { status: 400, body: { error: error.message } };

    return { status: 200, body: data as Record<string, unknown> };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

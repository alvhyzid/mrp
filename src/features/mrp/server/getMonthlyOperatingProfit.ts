import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';
import { createClient } from '@supabase/supabase-js';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Laba Operasional bulanan (K2 Tingkat 2) — TIDAK ADA alokasi overhead ke batch di v1
// (overhead_allocation='off'), jadi ini Σ margin kontribusi bulan itu − overhead
// bulanan (company_settings.monthly_overhead_baseline). Ditampilkan BERDAMPINGAN
// dengan Margin Kontribusi per order di UI (K2: "Kedua angka selalu tampil berdampingan").
export async function getMonthlyOperatingProfit(request: NextRequest, year: number, month: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canViewFinancialData(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya akses ke data margin.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const authHeader = request.headers.get('authorization');
    const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader ?? '' } }
    });

    const { data, error } = await userClient.rpc('get_monthly_operating_profit', { p_company_id: appUser.company_id, p_year: year, p_month: month }).single();
    if (error) return { status: 400, body: { error: error.message } };

    return { status: 200, body: data as Record<string, unknown> };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

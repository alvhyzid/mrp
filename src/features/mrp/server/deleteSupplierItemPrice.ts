import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManagePurchasing } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function deleteSupplierItemPrice(request: NextRequest, priceIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManagePurchasing(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola daftar bahan yang dipasok.' } };
    }
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const priceId = Number(priceIdParam);
    if (!priceId) return { status: 400, body: { error: 'ID baris tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: existing, error: existingError } = await adminClient.from('supplier_item_prices').select('supplier_item_price_id, company_id').eq('supplier_item_price_id', priceId).maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };
    if (!existing || existing.company_id !== appUser.company_id) return { status: 404, body: { error: 'Baris tidak ditemukan.' } };

    const { error: deleteError } = await adminClient.from('supplier_item_prices').delete().eq('supplier_item_price_id', priceId);
    if (deleteError) return { status: 500, body: { error: deleteError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

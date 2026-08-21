import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManagePurchasing } from '@/lib/roles';
import { parseSupplierItemPriceInput } from './supplierItemPriceValidation';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Alur 1 (3.4) — dipanggil dari DUA layar (Supplier "tambah bahan yang
// dipasok" dan Item "supplier yang memasok ini"), keduanya menulis ke sini.
// SATU baris per (supplier_id, item_id) -- kalau sudah ada, diperbarui di
// tempat (bukan riwayat bertingkat, tidak diminta 3.4).
export async function upsertSupplierItemPrice(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManagePurchasing(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola daftar bahan yang dipasok.' } };
    }
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const body = await request.json();
    const { data: parsed, error: parseError } = parseSupplierItemPriceInput(body);
    if (parseError || !parsed) return { status: 400, body: { error: parseError ?? 'Input tidak valid.' } };

    const adminClient = getAdminClient();

    const [supplierRes, itemRes] = await Promise.all([
      adminClient.from('suppliers').select('supplier_id, company_id, archived_at').eq('supplier_id', parsed.supplier_id).maybeSingle(),
      adminClient.from('items').select('item_id, company_id').eq('item_id', parsed.item_id).maybeSingle()
    ]);
    if (supplierRes.error) return { status: 500, body: { error: supplierRes.error.message } };
    if (itemRes.error) return { status: 500, body: { error: itemRes.error.message } };
    if (!supplierRes.data || supplierRes.data.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Supplier tidak ditemukan di perusahaan Anda.' } };
    }
    if (supplierRes.data.archived_at) {
      return { status: 400, body: { error: 'Supplier ini sudah diarsipkan — pulihkan dulu sebelum menambah bahan yang dipasok.' } };
    }
    if (!itemRes.data || itemRes.data.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Bahan tidak ditemukan di perusahaan Anda. Buat dulu bahan barunya di layar Item.' } };
    }

    const { error: upsertError } = await adminClient
      .from('supplier_item_prices')
      .upsert(
        [
          {
            company_id: appUser.company_id,
            supplier_id: parsed.supplier_id,
            item_id: parsed.item_id,
            supplier_item_code: parsed.supplier_item_code,
            supplier_item_name: parsed.supplier_item_name,
            reference_price: parsed.reference_price,
            price_valid_from: parsed.price_valid_from,
            min_order_qty: parsed.min_order_qty,
            min_order_uom: parsed.min_order_uom,
            lead_time_days_override: parsed.lead_time_days_override,
            notes: parsed.notes,
            updated_at: new Date().toISOString()
          }
        ],
        { onConflict: 'supplier_id,item_id' }
      );
    if (upsertError) return { status: 500, body: { error: upsertError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

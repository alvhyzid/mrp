import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManagePurchasing } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Alur 1 (3.2) — pola SAMA PERSIS dengan Routing (Sesi 7 bagian 1), lihat
// deleteOrArchiveRouting.ts. "Hapus" hanya berhasil kalau supplier ini TIDAK
// dipakai PO Supplier apa pun dan TIDAK punya baris "bahan yang dipasok".
// "Arsipkan" untuk yang sudah dipakai. Keputusan dihitung server, bukan
// dipilih pengguna.
async function findSupplierUsage(adminClient: ReturnType<typeof getAdminClient>, companyId: number, supplierId: number) {
  const [poRes, priceRes] = await Promise.all([
    adminClient.from('purchase_orders').select('purchase_order_id').eq('company_id', companyId).eq('supplier_id', supplierId),
    adminClient.from('supplier_item_prices').select('supplier_item_price_id').eq('company_id', companyId).eq('supplier_id', supplierId)
  ]);
  return { poCount: (poRes.data ?? []).length, priceCount: (priceRes.data ?? []).length };
}

export async function deleteSupplier(request: NextRequest, supplierIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManagePurchasing(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola supplier.' } };
    }
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const supplierId = Number(supplierIdParam);
    if (!supplierId) return { status: 400, body: { error: 'ID Supplier tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: supplier, error: supplierError } = await adminClient.from('suppliers').select('supplier_id, company_id').eq('supplier_id', supplierId).maybeSingle();
    if (supplierError) return { status: 500, body: { error: supplierError.message } };
    if (!supplier || supplier.company_id !== appUser.company_id) return { status: 404, body: { error: 'Supplier tidak ditemukan.' } };

    const { poCount, priceCount } = await findSupplierUsage(adminClient, appUser.company_id, supplierId);
    if (poCount > 0 || priceCount > 0) {
      const parts: string[] = [];
      if (poCount > 0) parts.push(`${poCount} PO Supplier`);
      if (priceCount > 0) parts.push(`${priceCount} bahan yang dipasok`);
      return { status: 400, body: { error: `Tidak bisa dihapus: dipakai ${parts.join(' dan ')}. Arsipkan supplier ini, jangan dihapus.` } };
    }

    const { error: deleteError } = await adminClient.from('suppliers').delete().eq('supplier_id', supplierId);
    if (deleteError) return { status: 500, body: { error: deleteError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function archiveSupplier(request: NextRequest, supplierIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManagePurchasing(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola supplier.' } };
    }
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const supplierId = Number(supplierIdParam);
    if (!supplierId) return { status: 400, body: { error: 'ID Supplier tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: supplier, error: supplierError } = await adminClient.from('suppliers').select('supplier_id, company_id, archived_at').eq('supplier_id', supplierId).maybeSingle();
    if (supplierError) return { status: 500, body: { error: supplierError.message } };
    if (!supplier || supplier.company_id !== appUser.company_id) return { status: 404, body: { error: 'Supplier tidak ditemukan.' } };
    if (supplier.archived_at) return { status: 400, body: { error: 'Supplier ini sudah diarsipkan.' } };

    const { error: archiveError } = await adminClient
      .from('suppliers')
      .update({ archived_at: new Date().toISOString(), archived_by: appUser.user_id })
      .eq('supplier_id', supplierId);
    if (archiveError) return { status: 500, body: { error: archiveError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function restoreSupplier(request: NextRequest, supplierIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManagePurchasing(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola supplier.' } };
    }
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const supplierId = Number(supplierIdParam);
    if (!supplierId) return { status: 400, body: { error: 'ID Supplier tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: supplier, error: supplierError } = await adminClient.from('suppliers').select('supplier_id, company_id, archived_at').eq('supplier_id', supplierId).maybeSingle();
    if (supplierError) return { status: 500, body: { error: supplierError.message } };
    if (!supplier || supplier.company_id !== appUser.company_id) return { status: 404, body: { error: 'Supplier tidak ditemukan.' } };
    if (!supplier.archived_at) return { status: 400, body: { error: 'Supplier ini tidak sedang diarsipkan.' } };

    const { error: restoreError } = await adminClient.from('suppliers').update({ archived_at: null, archived_by: null }).eq('supplier_id', supplierId);
    if (restoreError) return { status: 500, body: { error: restoreError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

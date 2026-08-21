import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageCustomerPo } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Alur 1 (3.2) — pola sama persis dengan Routing (Sesi 7 bagian 1) dan
// Supplier. "Hapus" hanya berhasil kalau client ini TIDAK dipakai PO Klien
// apa pun.
async function countCustomerPurchaseOrders(adminClient: ReturnType<typeof getAdminClient>, companyId: number, customerId: number): Promise<number> {
  const { data } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('company_id', companyId).eq('customer_id', customerId);
  return (data ?? []).length;
}

export async function deleteCustomer(request: NextRequest, customerIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageCustomerPo(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola client.' } };
    }
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const customerId = Number(customerIdParam);
    if (!customerId) return { status: 400, body: { error: 'ID Client tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: customer, error: customerError } = await adminClient.from('customers').select('customer_id, company_id').eq('customer_id', customerId).maybeSingle();
    if (customerError) return { status: 500, body: { error: customerError.message } };
    if (!customer || customer.company_id !== appUser.company_id) return { status: 404, body: { error: 'Client tidak ditemukan.' } };

    const poCount = await countCustomerPurchaseOrders(adminClient, appUser.company_id, customerId);
    if (poCount > 0) {
      return { status: 400, body: { error: `Tidak bisa dihapus: dipakai ${poCount} PO Klien. Arsipkan client ini, jangan dihapus.` } };
    }

    const { error: deleteError } = await adminClient.from('customers').delete().eq('customer_id', customerId);
    if (deleteError) return { status: 500, body: { error: deleteError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function archiveCustomer(request: NextRequest, customerIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageCustomerPo(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola client.' } };
    }
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const customerId = Number(customerIdParam);
    if (!customerId) return { status: 400, body: { error: 'ID Client tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: customer, error: customerError } = await adminClient.from('customers').select('customer_id, company_id, archived_at').eq('customer_id', customerId).maybeSingle();
    if (customerError) return { status: 500, body: { error: customerError.message } };
    if (!customer || customer.company_id !== appUser.company_id) return { status: 404, body: { error: 'Client tidak ditemukan.' } };
    if (customer.archived_at) return { status: 400, body: { error: 'Client ini sudah diarsipkan.' } };

    const { error: archiveError } = await adminClient
      .from('customers')
      .update({ archived_at: new Date().toISOString(), archived_by: appUser.user_id })
      .eq('customer_id', customerId);
    if (archiveError) return { status: 500, body: { error: archiveError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function restoreCustomer(request: NextRequest, customerIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageCustomerPo(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola client.' } };
    }
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const customerId = Number(customerIdParam);
    if (!customerId) return { status: 400, body: { error: 'ID Client tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: customer, error: customerError } = await adminClient.from('customers').select('customer_id, company_id, archived_at').eq('customer_id', customerId).maybeSingle();
    if (customerError) return { status: 500, body: { error: customerError.message } };
    if (!customer || customer.company_id !== appUser.company_id) return { status: 404, body: { error: 'Client tidak ditemukan.' } };
    if (!customer.archived_at) return { status: 400, body: { error: 'Client ini tidak sedang diarsipkan.' } };

    const { error: restoreError } = await adminClient.from('customers').update({ archived_at: null, archived_by: null }).eq('customer_id', customerId);
    if (restoreError) return { status: 500, body: { error: restoreError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

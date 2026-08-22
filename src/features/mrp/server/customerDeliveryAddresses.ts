import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageCustomerPo } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// PMB-07b (22 Agu 2026) — Alamat Tujuan Kirim sebagai Daftar. LAPISAN DATA &
// SERVER SAJA — layarnya MENUNGGU cetakan UX dari koreksi pemilik produk di
// Alur 1, belum ada halaman yang memanggil fungsi-fungsi ini. Pola CRUD +
// arsip SAMA PERSIS dengan Supplier/Customer (Alur 1) — nama panggilan,
// alamat, PIC menempel ke SATU customer, boleh banyak per customer, TIDAK
// diwariskan otomatis ke shipment (dipilih manual saat shipment dibuat).

export async function createCustomerDeliveryAddress(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageCustomerPo(appUser.role)) return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola alamat tujuan kirim.' } };
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const body = await request.json();
    const customerId = Number(body.customer_id);
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const picName = body.pic_name ? String(body.pic_name).trim() : null;
    const picPhone = body.pic_phone ? String(body.pic_phone).trim() : null;

    if (!customerId) return { status: 400, body: { error: 'Client wajib dipilih.' } };
    if (!label) return { status: 400, body: { error: 'Nama panggilan alamat wajib diisi.' } };
    if (!address) return { status: 400, body: { error: 'Alamat wajib diisi.' } };

    const adminClient = getAdminClient();
    const { data: customer, error: customerError } = await adminClient.from('customers').select('customer_id, company_id').eq('customer_id', customerId).maybeSingle();
    if (customerError) return { status: 500, body: { error: customerError.message } };
    if (!customer || customer.company_id !== appUser.company_id) return { status: 400, body: { error: 'Client tidak valid.' } };

    const { data, error } = await adminClient
      .from('customer_delivery_addresses')
      .insert([{ company_id: appUser.company_id, customer_id: customerId, label, address, pic_name: picName, pic_phone: picPhone }])
      .select('customer_delivery_address_id')
      .single();
    if (error) return { status: 500, body: { error: error.message } };

    return { status: 201, body: { customer_delivery_address_id: data!.customer_delivery_address_id } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function listCustomerDeliveryAddresses(request: NextRequest, customerIdParam?: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const adminClient = getAdminClient();
    let query = adminClient
      .from('customer_delivery_addresses')
      .select('customer_delivery_address_id, customer_id, label, address, pic_name, pic_phone, archived_at, created_at')
      .eq('company_id', appUser.company_id)
      .order('created_at', { ascending: false });

    const customerId = customerIdParam ? Number(customerIdParam) : null;
    if (customerId) query = query.eq('customer_id', customerId);

    const { data, error } = await query;
    if (error) return { status: 500, body: { error: error.message } };

    return { status: 200, body: { addresses: data ?? [] } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function updateCustomerDeliveryAddress(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageCustomerPo(appUser.role)) return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola alamat tujuan kirim.' } };
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const body = await request.json();
    const addressId = Number(body.customer_delivery_address_id);
    if (!addressId) return { status: 400, body: { error: 'ID Alamat tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: existing, error: existingError } = await adminClient.from('customer_delivery_addresses').select('customer_delivery_address_id, company_id, archived_at').eq('customer_delivery_address_id', addressId).maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };
    if (!existing || existing.company_id !== appUser.company_id) return { status: 404, body: { error: 'Alamat tidak ditemukan.' } };
    if (existing.archived_at) return { status: 400, body: { error: 'Alamat yang sudah diarsipkan tidak bisa diubah. Pulihkan dulu.' } };

    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    if (!label) return { status: 400, body: { error: 'Nama panggilan alamat wajib diisi.' } };
    if (!address) return { status: 400, body: { error: 'Alamat wajib diisi.' } };

    const { error: updateError } = await adminClient
      .from('customer_delivery_addresses')
      .update({ label, address, pic_name: body.pic_name ? String(body.pic_name).trim() : null, pic_phone: body.pic_phone ? String(body.pic_phone).trim() : null })
      .eq('customer_delivery_address_id', addressId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

// "Hapus" hanya berhasil kalau alamat ini TIDAK PERNAH dipakai satu pun
// shipment (shipments.delivery_address_id) — pola sama Routing/Supplier/
// Customer. Kalau sudah dipakai, WAJIB Arsipkan.
export async function deleteOrArchiveCustomerDeliveryAddress(request: NextRequest, addressIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageCustomerPo(appUser.role)) return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola alamat tujuan kirim.' } };
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const addressId = Number(addressIdParam);
    if (!addressId) return { status: 400, body: { error: 'ID Alamat tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: existing, error: existingError } = await adminClient.from('customer_delivery_addresses').select('customer_delivery_address_id, company_id').eq('customer_delivery_address_id', addressId).maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };
    if (!existing || existing.company_id !== appUser.company_id) return { status: 404, body: { error: 'Alamat tidak ditemukan.' } };

    const { data: usage } = await adminClient.from('shipments').select('shipment_id').eq('delivery_address_id', addressId);
    const usageCount = (usage ?? []).length;

    if (usageCount > 0) {
      const { error: archiveError } = await adminClient.from('customer_delivery_addresses').update({ archived_at: new Date().toISOString(), archived_by: appUser.user_id }).eq('customer_delivery_address_id', addressId);
      if (archiveError) return { status: 500, body: { error: archiveError.message } };
      return { status: 200, body: { archived: true, message: `Tidak bisa dihapus: dipakai ${usageCount} pengiriman. Diarsipkan, bukan dihapus.` } };
    }

    const { error: deleteError } = await adminClient.from('customer_delivery_addresses').delete().eq('customer_delivery_address_id', addressId);
    if (deleteError) return { status: 500, body: { error: deleteError.message } };

    return { status: 200, body: { deleted: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function restoreCustomerDeliveryAddress(request: NextRequest, addressIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageCustomerPo(appUser.role)) return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola alamat tujuan kirim.' } };
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const addressId = Number(addressIdParam);
    if (!addressId) return { status: 400, body: { error: 'ID Alamat tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: existing, error: existingError } = await adminClient.from('customer_delivery_addresses').select('customer_delivery_address_id, company_id').eq('customer_delivery_address_id', addressId).maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };
    if (!existing || existing.company_id !== appUser.company_id) return { status: 404, body: { error: 'Alamat tidak ditemukan.' } };

    const { error: restoreError } = await adminClient.from('customer_delivery_addresses').update({ archived_at: null, archived_by: null }).eq('customer_delivery_address_id', addressId);
    if (restoreError) return { status: 500, body: { error: restoreError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

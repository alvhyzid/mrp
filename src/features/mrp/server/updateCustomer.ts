import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageCustomerPo } from '@/lib/roles';
import { parseCustomerInput, galatFieldPelanggan } from './customerValidation';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Alur 1 (3.2) — customer SEBELUMNYA tidak bisa diedit sama sekali.
export async function updateCustomer(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageCustomerPo(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola client.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const customerId = Number(body.customer_id);
    if (!customerId) return { status: 400, body: { error: 'ID Client tidak valid.' } };

    const { input, error, field } = parseCustomerInput(body);
    if (error || !input) return { status: 400, body: field ? galatFieldPelanggan(error ?? 'Input tidak valid.', field) : { error } };

    const adminClient = getAdminClient();
    const { data: existing, error: existingError } = await adminClient.from('customers').select('customer_id, company_id, archived_at').eq('customer_id', customerId).maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };
    if (!existing || existing.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Client tidak ditemukan.' } };
    }
    if (existing.archived_at) {
      return { status: 400, body: { error: 'Client yang sudah diarsipkan tidak bisa diubah. Pulihkan dulu.' } };
    }

    const { error: updateError } = await adminClient.from('customers').update(input).eq('customer_id', customerId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

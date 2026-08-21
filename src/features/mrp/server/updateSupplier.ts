import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManagePurchasing } from '@/lib/roles';
import { parseSupplierInput } from './supplierValidation';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Alur 1 (3.2) — supplier SEBELUMNYA tidak bisa diedit sama sekali. Ini
// bagian terbesar pekerjaan Alur 1.
export async function updateSupplier(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManagePurchasing(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola supplier.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const supplierId = Number(body.supplier_id);
    if (!supplierId) return { status: 400, body: { error: 'ID Supplier tidak valid.' } };

    const { data: parsed, error: parseError } = parseSupplierInput(body);
    if (parseError || !parsed) return { status: 400, body: { error: parseError ?? 'Input tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: existing, error: existingError } = await adminClient.from('suppliers').select('supplier_id, company_id, archived_at').eq('supplier_id', supplierId).maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };
    if (!existing || existing.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Supplier tidak ditemukan.' } };
    }
    if (existing.archived_at) {
      return { status: 400, body: { error: 'Supplier yang sudah diarsipkan tidak bisa diubah. Pulihkan dulu.' } };
    }

    const { error: updateError } = await adminClient.from('suppliers').update(parsed).eq('supplier_id', supplierId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

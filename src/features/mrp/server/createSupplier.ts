import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManagePurchasing } from '@/lib/roles';
import { parseSupplierInput } from './supplierValidation';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function createSupplier(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManagePurchasing(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola supplier.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const { data: parsed, error: parseError } = parseSupplierInput(body);
    if (parseError || !parsed) return { status: 400, body: { error: parseError ?? 'Input tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: created, error: insertError } = await adminClient
      .from('suppliers')
      .insert([{ company_id: appUser.company_id, ...parsed }])
      .select('supplier_id')
      .single();
    if (insertError) return { status: 500, body: { error: insertError.message } };

    return { status: 201, body: { supplier_id: created.supplier_id } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

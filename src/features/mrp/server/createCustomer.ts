import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';
import { parseCustomerInput } from './customerValidation';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function createCustomer(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!(isCompanyLeadership(appUser.role) || ['ppic_manager', 'ppic_staff'].includes(appUser.role))) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin menambah client.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const { input, error } = parseCustomerInput(body);
    if (error || !input) {
      return { status: 400, body: { error } };
    }

    const adminClient = getAdminClient();
    const { data: inserted, error: insertError } = await adminClient
      .from('customers')
      .insert([{ ...input, company_id: appUser.company_id }])
      .select('customer_id, name, customer_type, contact_info')
      .single();

    if (insertError) {
      return { status: 500, body: { error: insertError.message } };
    }

    return { status: 200, body: { success: true, customer: inserted } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

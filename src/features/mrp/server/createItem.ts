import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { parseItemInput } from './itemValidation';
import { isCompanyLeadership } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function createItem(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Hanya Admin Perusahaan atau General Manager yang dapat menambah item.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const { input, error } = parseItemInput(body);
    if (error || !input) {
      return { status: 400, body: { error } };
    }

    const adminClient = getAdminClient();

    const { data: existingItem, error: existingItemError } = await adminClient
      .from('items')
      .select('item_id')
      .eq('company_id', appUser.company_id)
      .eq('item_code', input.item_code)
      .maybeSingle();

    if (existingItemError) {
      return { status: 500, body: { error: existingItemError.message } };
    }

    if (existingItem) {
      return { status: 400, body: { error: 'Kode item sudah dipakai di perusahaan ini.' } };
    }

    const { error: insertError } = await adminClient.from('items').insert([
      {
        ...input,
        company_id: appUser.company_id
      }
    ]);

    if (insertError) {
      return { status: 500, body: { error: insertError.message } };
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

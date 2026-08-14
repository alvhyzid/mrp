import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listProductionBatches(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const { searchParams } = new URL(request.url);
    const workOrderId = Number(searchParams.get('work_order_id'));
    if (!workOrderId) {
      return { status: 400, body: { error: 'work_order_id wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: wo, error: woError } = await adminClient.from('work_orders').select('work_order_id, company_id').eq('work_order_id', workOrderId).maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!wo || wo.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Work Order tidak ditemukan.' } };
    }

    const { data: batches, error } = await adminClient
      .from('production_batches')
      .select('production_batch_id, batch_number, shift_id, planned_qty, uom, status, started_at, completed_at, created_at')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: false });

    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    return { status: 200, body: { batches: batches ?? [] } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

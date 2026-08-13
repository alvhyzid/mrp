import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listWorkOrderStepProgress(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const workOrderId = Number(request.nextUrl.searchParams.get('work_order_id'));
    if (!workOrderId) {
      return { status: 400, body: { error: 'work_order_id wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: wo, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, company_id')
      .eq('work_order_id', workOrderId)
      .maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!wo || wo.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Work Order tidak ditemukan.' } };
    }

    const { data: progress, error } = await adminClient
      .from('work_order_step_progress')
      .select('work_order_step_progress_id, routing_step_id, status, qty_recorded, uom, started_at, completed_at, notes')
      .eq('work_order_id', workOrderId);

    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    return { status: 200, body: { stepProgress: progress } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

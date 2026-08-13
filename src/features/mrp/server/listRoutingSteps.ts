import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listRoutingSteps(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const routingId = Number(request.nextUrl.searchParams.get('routing_id'));
    if (!routingId) {
      return { status: 400, body: { error: 'routing_id wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: routing, error: routingError } = await adminClient
      .from('routings')
      .select('routing_id, company_id')
      .eq('routing_id', routingId)
      .maybeSingle();
    if (routingError) return { status: 500, body: { error: routingError.message } };
    if (!routing || routing.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Routing tidak ditemukan.' } };
    }

    const { data: steps, error } = await adminClient
      .from('routing_steps')
      .select('routing_step_id, sequence_no, step_name, active_duration_minutes, wait_duration_minutes, work_center_id')
      .eq('routing_id', routingId)
      .order('sequence_no', { ascending: true });

    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    return { status: 200, body: { routingSteps: steps } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

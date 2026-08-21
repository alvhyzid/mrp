import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listRoutings(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    // Sesi 7 (7.4) — default TIDAK menyertakan yang diarsipkan (dropdown Work
    // Order baru & daftar utama), kecuali diminta eksplisit lewat
    // ?includeArchived=true (filter "Tampilkan yang diarsipkan" di layar).
    const includeArchived = new URL(request.url).searchParams.get('includeArchived') === 'true';

    let routingsQuery = adminClient
      .from('routings')
      .select('routing_id, item_id, version, archived_at, archived_by')
      .eq('company_id', appUser.company_id)
      .order('routing_id', { ascending: false });
    if (!includeArchived) {
      routingsQuery = routingsQuery.is('archived_at', null);
    }
    const { data: routings, error: routingsError } = await routingsQuery;

    if (routingsError) {
      return { status: 500, body: { error: routingsError.message } };
    }

    if (!routings || routings.length === 0) {
      return { status: 200, body: { routings: [] } };
    }

    const [itemsRes, stepsRes, workCentersRes, workOrdersRes] = await Promise.all([
      adminClient.from('items').select('item_id, item_code, name, base_uom').eq('company_id', appUser.company_id),
      adminClient
        .from('routing_steps')
        .select('routing_step_id, routing_id, sequence_no, step_name, active_duration_minutes, duration_per_unit_minutes, wait_duration_minutes, work_center_id')
        .in(
          'routing_id',
          routings.map((r) => r.routing_id)
        ),
      adminClient.from('work_centers').select('work_center_id, name, code').eq('company_id', appUser.company_id),
      // Sesi 6A (21 Agu 2026, 6A.5) — WO mana saja (per routing_id) yang punya
      // Work Order dengan company_id ini, dipakai di bawah untuk menghitung
      // berapa BATCH BERJALAN (status in_progress) memakai tiap routing_id.
      adminClient
        .from('work_orders')
        .select('work_order_id, routing_id')
        .eq('company_id', appUser.company_id)
        .in(
          'routing_id',
          routings.map((r) => r.routing_id)
        )
    ]);

    if (itemsRes.error) return { status: 500, body: { error: itemsRes.error.message } };
    if (stepsRes.error) return { status: 500, body: { error: stepsRes.error.message } };
    if (workCentersRes.error) return { status: 500, body: { error: workCentersRes.error.message } };
    if (workOrdersRes.error) return { status: 500, body: { error: workOrdersRes.error.message } };

    const routingIdByWorkOrderId = new Map((workOrdersRes.data ?? []).map((wo) => [wo.work_order_id, wo.routing_id]));
    const runningBatchCountByRoutingId = new Map<number, number>();
    if (routingIdByWorkOrderId.size > 0) {
      const { data: runningBatches, error: runningBatchesError } = await adminClient
        .from('production_batches')
        .select('work_order_id')
        .eq('status', 'in_progress')
        .in('work_order_id', Array.from(routingIdByWorkOrderId.keys()));
      if (runningBatchesError) return { status: 500, body: { error: runningBatchesError.message } };
      for (const batch of runningBatches ?? []) {
        const routingId = routingIdByWorkOrderId.get(batch.work_order_id);
        if (routingId) {
          runningBatchCountByRoutingId.set(routingId, (runningBatchCountByRoutingId.get(routingId) ?? 0) + 1);
        }
      }
    }

    // Sesi 7 (7.3) — dipakai layar utk memutuskan tombol Hapus vs Arsipkan
    // (server yang menghitung, layar tinggal menampilkan).
    const referencedWorkOrderCountByRoutingId = new Map<number, number>();
    for (const wo of workOrdersRes.data ?? []) {
      referencedWorkOrderCountByRoutingId.set(wo.routing_id, (referencedWorkOrderCountByRoutingId.get(wo.routing_id) ?? 0) + 1);
    }

    const archivedByUserIds = Array.from(new Set(routings.map((r) => r.archived_by).filter((id): id is number => !!id)));
    const archivedByNameById = new Map<number, string>();
    if (archivedByUserIds.length > 0) {
      const { data: archivers, error: archiversError } = await adminClient.from('users').select('user_id, name').in('user_id', archivedByUserIds);
      if (archiversError) return { status: 500, body: { error: archiversError.message } };
      for (const u of archivers ?? []) archivedByNameById.set(u.user_id, u.name);
    }

    const itemsById = new Map((itemsRes.data ?? []).map((i) => [i.item_id, i]));
    const workCentersById = new Map((workCentersRes.data ?? []).map((wc) => [wc.work_center_id, wc]));

    const stepsByRoutingId = new Map<number, typeof stepsRes.data>();
    for (const step of stepsRes.data ?? []) {
      const list = stepsByRoutingId.get(step.routing_id) ?? [];
      list.push(step);
      stepsByRoutingId.set(step.routing_id, list);
    }
    for (const list of stepsByRoutingId.values()) list.sort((a, b) => a.sequence_no - b.sequence_no);

    const result = routings.map((routing) => {
      const item = itemsById.get(routing.item_id);
      const steps = (stepsByRoutingId.get(routing.routing_id) ?? []).map((step) => {
        const wc = step.work_center_id ? workCentersById.get(step.work_center_id) : undefined;
        return {
          routing_step_id: step.routing_step_id,
          sequence_no: step.sequence_no,
          step_name: step.step_name,
          active_duration_minutes: step.active_duration_minutes,
          duration_per_unit_minutes: step.duration_per_unit_minutes,
          wait_duration_minutes: step.wait_duration_minutes,
          work_center_id: step.work_center_id,
          work_center_name: wc?.name ?? null,
          work_center_code: wc?.code ?? null
        };
      });
      return {
        routing_id: routing.routing_id,
        item_id: routing.item_id,
        item_code: item?.item_code ?? null,
        item_name: item?.name ?? null,
        item_base_uom: item?.base_uom ?? null,
        version: routing.version,
        steps,
        running_batch_count: runningBatchCountByRoutingId.get(routing.routing_id) ?? 0,
        referenced_work_order_count: referencedWorkOrderCountByRoutingId.get(routing.routing_id) ?? 0,
        can_delete: (referencedWorkOrderCountByRoutingId.get(routing.routing_id) ?? 0) === 0,
        archived_at: routing.archived_at,
        archived_by_name: routing.archived_by ? (archivedByNameById.get(routing.archived_by) ?? null) : null
      };
    });

    return { status: 200, body: { routings: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

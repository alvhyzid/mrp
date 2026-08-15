import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageBom } from '@/lib/roles';
import { parseRoutingInput } from './routingValidation';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Akses disamakan PERSIS dengan yang boleh kelola BOM (canManageBom) — bukan cuma
// konvensi UI, RLS routings_write_ppic/routing_steps_write_ppic di migrasi
// 20260812153000_bom_routing_workcenters.sql memang sudah mendefinisikan role yang
// SAMA untuk kedua tabel ini sejak awal.
export async function createRouting(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageBom(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola Routing.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const { input, error } = parseRoutingInput(body);
    if (error || !input) {
      return { status: 400, body: { error } };
    }

    const adminClient = getAdminClient();

    const { data: item, error: itemError } = await adminClient.from('items').select('item_id, company_id').eq('item_id', input.item_id).maybeSingle();
    if (itemError) return { status: 500, body: { error: itemError.message } };
    if (!item || item.company_id !== appUser.company_id) {
      return { status: 400, body: { error: 'Item tidak ditemukan di perusahaan Anda.' } };
    }

    const workCenterIds = Array.from(new Set(input.steps.map((s) => s.work_center_id).filter((id): id is number => !!id)));
    if (workCenterIds.length) {
      const { data: workCenters, error: wcError } = await adminClient.from('work_centers').select('work_center_id').in('work_center_id', workCenterIds).eq('company_id', appUser.company_id);
      if (wcError) return { status: 500, body: { error: wcError.message } };
      const validWcIds = new Set((workCenters ?? []).map((wc) => wc.work_center_id));
      for (const wcId of workCenterIds) {
        if (!validWcIds.has(wcId)) {
          return { status: 400, body: { error: 'Salah satu Work Center tidak ditemukan di perusahaan Anda.' } };
        }
      }
    }

    const { data: latestVersion } = await adminClient.from('routings').select('version').eq('item_id', input.item_id).order('version', { ascending: false }).limit(1).maybeSingle();
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    const { data: insertedRouting, error: routingInsertError } = await adminClient
      .from('routings')
      .insert([{ company_id: appUser.company_id, item_id: input.item_id, version: nextVersion }])
      .select('routing_id')
      .single();

    if (routingInsertError || !insertedRouting) {
      return { status: 500, body: { error: routingInsertError?.message ?? 'Gagal membuat Routing.' } };
    }

    const { error: stepsInsertError } = await adminClient.from('routing_steps').insert(
      input.steps.map((step) => ({
        routing_id: insertedRouting.routing_id,
        sequence_no: step.sequence_no,
        step_name: step.step_name,
        active_duration_minutes: step.active_duration_minutes,
        wait_duration_minutes: step.wait_duration_minutes,
        work_center_id: step.work_center_id
      }))
    );

    if (stepsInsertError) {
      await adminClient.from('routings').delete().eq('routing_id', insertedRouting.routing_id);
      return { status: 500, body: { error: stepsInsertError.message } };
    }

    return { status: 200, body: { success: true, routing_id: insertedRouting.routing_id, version: nextVersion } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

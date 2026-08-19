import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageBom } from '@/lib/roles';
import { parseRoutingInput } from './routingValidation';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function updateRouting(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageBom(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola Routing.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const routingId = Number(body.routing_id);
    if (!routingId) {
      return { status: 400, body: { error: 'ID Routing tidak valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: existingRouting, error: existingError } = await adminClient.from('routings').select('routing_id, company_id, item_id').eq('routing_id', routingId).maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };
    if (!existingRouting || existingRouting.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Routing tidak ditemukan.' } };
    }

    // item_id & version tidak bisa diubah lewat edit (sama seperti BOM) — dipaksa
    // pakai item_id yang sebenarnya dari DB, bukan apa pun yang dikirim client.
    const { input, error } = parseRoutingInput({ ...body, item_id: existingRouting.item_id });
    if (error || !input) {
      return { status: 400, body: { error } };
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

    // bom_lines.routing_step_id yang menunjuk tahap routing ini HARUS dilepas
    // dulu SEBELUM tahapnya dihapus -- kalau tidak, delete di bawah akan gagal
    // kena FK constraint (ditemukan lewat pengalaman nyata sesi ini, saat
    // membangun ulang routing SAS005 yang bom_lines-nya sudah ditandai). Ini
    // BUKAN kehilangan data BOM, cuma melepas tanda tahapnya -- otomatis
    // kembali ke perilaku "dianggap tahap pertama" sampai ditandai ulang.
    const { data: staleSteps } = await adminClient.from('routing_steps').select('routing_step_id').eq('routing_id', routingId);
    const staleStepIds = (staleSteps ?? []).map((s) => s.routing_step_id);
    if (staleStepIds.length > 0) {
      const { error: untagError } = await adminClient.from('bom_lines').update({ routing_step_id: null }).in('routing_step_id', staleStepIds);
      if (untagError) return { status: 500, body: { error: untagError.message } };
    }

    const { error: deleteStepsError } = await adminClient.from('routing_steps').delete().eq('routing_id', routingId);
    if (deleteStepsError) return { status: 500, body: { error: deleteStepsError.message } };

    const { error: stepsInsertError } = await adminClient.from('routing_steps').insert(
      input.steps.map((step) => ({
        routing_id: routingId,
        sequence_no: step.sequence_no,
        step_name: step.step_name,
        active_duration_minutes: step.active_duration_minutes,
        wait_duration_minutes: step.wait_duration_minutes,
        work_center_id: step.work_center_id,
        duration_per_unit_minutes: step.duration_per_unit_minutes
      }))
    );

    if (stepsInsertError) {
      return { status: 500, body: { error: stepsInsertError.message } };
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

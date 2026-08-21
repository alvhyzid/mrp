import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageBom } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Sesi 7 (21 Agu 2026, 7.3) — dua aksi TERPISAH, bukan satu keputusan otomatis:
// - "Hapus" (deleteRouting) HANYA berhasil kalau routing ini TIDAK direferensikan
//   Work Order apa pun (status apa pun). Kalau dipaksa lewat API pada routing
//   yang sudah dipakai, DITOLAK dengan pesan yang menyebut jumlah pemakainya —
//   layar TIDAK PERNAH menampilkan tombol "Hapus" untuk routing yang dipakai,
//   tapi server tetap menolak sendiri kalau dipanggil langsung (7.3).
// - "Arsipkan" (archiveRouting) untuk routing yang sudah dipakai — ditolak
//   HANYA kalau versi ini sedang dipakai batch berjalan (in_progress) SEKARANG
//   (7.6): mengarsipkan berarti "jangan dipakai lagi utk pekerjaan baru",
//   padahal batch itu masih aktif memakainya hari ini.

async function findReferencingWorkOrderIds(adminClient: ReturnType<typeof getAdminClient>, companyId: number, routingId: number): Promise<number[]> {
  const { data } = await adminClient.from('work_orders').select('work_order_id').eq('company_id', companyId).eq('routing_id', routingId);
  return (data ?? []).map((wo) => wo.work_order_id);
}

async function loadRouting(adminClient: ReturnType<typeof getAdminClient>, routingId: number) {
  return adminClient.from('routings').select('routing_id, company_id, item_id, version, archived_at').eq('routing_id', routingId).maybeSingle();
}

export async function deleteRouting(request: NextRequest, routingIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageBom(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola Routing.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const routingId = Number(routingIdParam);
    if (!routingId) return { status: 400, body: { error: 'ID Routing tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: routing, error: routingError } = await loadRouting(adminClient, routingId);
    if (routingError) return { status: 500, body: { error: routingError.message } };
    if (!routing || routing.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Routing tidak ditemukan.' } };
    }

    const workOrderIds = await findReferencingWorkOrderIds(adminClient, appUser.company_id, routingId);
    if (workOrderIds.length > 0) {
      return {
        status: 400,
        body: { error: `Tidak bisa dihapus: dipakai ${workOrderIds.length} Work Order. Arsipkan routing ini, jangan dihapus.` }
      };
    }

    // Tidak direferensikan sama sekali -> aman dihapus permanen. Lepas tanda
    // bom_lines.routing_step_id dulu (tautan lunak, pola sama seperti
    // updateRouting.ts — bukan referensi yang memblokir penghapusan).
    const { data: steps } = await adminClient.from('routing_steps').select('routing_step_id').eq('routing_id', routingId);
    const stepIds = (steps ?? []).map((s) => s.routing_step_id);
    if (stepIds.length > 0) {
      const { error: untagError } = await adminClient.from('bom_lines').update({ routing_step_id: null }).in('routing_step_id', stepIds);
      if (untagError) return { status: 500, body: { error: untagError.message } };
    }

    const { error: deleteCrewError } = await adminClient.from('routing_step_standard_crew').delete().eq('routing_id', routingId);
    if (deleteCrewError) return { status: 500, body: { error: deleteCrewError.message } };

    const { error: deleteStepsError } = await adminClient.from('routing_steps').delete().eq('routing_id', routingId);
    if (deleteStepsError) return { status: 500, body: { error: deleteStepsError.message } };

    const { error: deleteRoutingError } = await adminClient.from('routings').delete().eq('routing_id', routingId);
    if (deleteRoutingError) return { status: 500, body: { error: deleteRoutingError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function archiveRouting(request: NextRequest, routingIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageBom(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola Routing.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const routingId = Number(routingIdParam);
    if (!routingId) return { status: 400, body: { error: 'ID Routing tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: routing, error: routingError } = await loadRouting(adminClient, routingId);
    if (routingError) return { status: 500, body: { error: routingError.message } };
    if (!routing || routing.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Routing tidak ditemukan.' } };
    }
    if (routing.archived_at) {
      return { status: 400, body: { error: 'Routing ini sudah diarsipkan.' } };
    }

    const workOrderIds = await findReferencingWorkOrderIds(adminClient, appUser.company_id, routingId);
    const { data: activeBatches, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, batch_number')
      .eq('company_id', appUser.company_id)
      .eq('status', 'in_progress')
      .or(workOrderIds.length > 0 ? `snapshotted_routing_id.eq.${routingId},work_order_id.in.(${workOrderIds.join(',')})` : `snapshotted_routing_id.eq.${routingId}`);
    if (batchError) return { status: 500, body: { error: batchError.message } };

    if ((activeBatches ?? []).length > 0) {
      const names = activeBatches!.map((b) => b.batch_number).join(', ');
      return {
        status: 400,
        body: { error: `Tidak bisa diarsipkan: sedang dipakai batch berjalan ${names}. Tunggu sampai batch tersebut selesai.` }
      };
    }

    const { error: archiveError } = await adminClient
      .from('routings')
      .update({ archived_at: new Date().toISOString(), archived_by: appUser.user_id })
      .eq('routing_id', routingId);
    if (archiveError) return { status: 500, body: { error: archiveError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function restoreRouting(request: NextRequest, routingIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageBom(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola Routing.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const routingId = Number(routingIdParam);
    if (!routingId) return { status: 400, body: { error: 'ID Routing tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: routing, error: routingError } = await loadRouting(adminClient, routingId);
    if (routingError) return { status: 500, body: { error: routingError.message } };
    if (!routing || routing.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Routing tidak ditemukan.' } };
    }
    if (!routing.archived_at) {
      return { status: 400, body: { error: 'Routing ini tidak sedang diarsipkan.' } };
    }

    const { error: restoreError } = await adminClient.from('routings').update({ archived_at: null, archived_by: null }).eq('routing_id', routingId);
    if (restoreError) return { status: 500, body: { error: restoreError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

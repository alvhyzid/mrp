import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canAccessProductionDashboard } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// "Jadwal Hari Ini" (Fase Produksi Nyata, P3) — sebelum ini, tampilan berjadwal
// (Gantt Harian/Mingguan/Bulanan) HANYA bisa diakses role PPIC (ppic_manager/
// ppic_staff) — role Produksi (production_manager/production_staff) sama sekali
// tidak punya akses ke halaman itu, jadi tidak ada cara melihat "apa yang harus
// dikerjakan hari ini" tanpa bertanya ke SPV secara manual.
//
// Isolasi plant: batch di-filter ke plant milik EMPLOYEE yang ter-link ke user
// yang login (employees.linked_user_id) — bukan Gantt penuh lintas plant.
// Kalau user tidak ter-link ke employee manapun (mis. akun leadership/uji), TIDAK
// difilter plant sama sekali (leadership memang perlu lihat semua plant).
export async function listTodaysProductionBatches(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canAccessProductionDashboard(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya akses ke jadwal produksi.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: employee } = await adminClient
      .from('employees')
      .select('production_plant_id')
      .eq('company_id', appUser.company_id)
      .eq('linked_user_id', appUser.user_id)
      .maybeSingle();
    const myPlantId: number | null = employee?.production_plant_id ?? null;

    const today = new Date().toISOString().slice(0, 10);

    // Batch relevan hari ini = dijadwalkan hari ini (planned_date) ATAU sudah
    // berjalan (in_progress) tapi belum selesai — batch kemarin yang masih
    // dikerjakan tetap harus tampil, bukan cuma yang planned_date-nya persis hari ini.
    const { data: batches, error: batchesError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, batch_number, planned_qty, uom, status, planned_date, work_order_id')
      .eq('company_id', appUser.company_id)
      .in('status', ['planned', 'in_progress'])
      .or(`planned_date.eq.${today},status.eq.in_progress`);
    if (batchesError) return { status: 500, body: { error: batchesError.message } };

    const workOrderIds = [...new Set((batches ?? []).map((b) => b.work_order_id))];
    const { data: workOrders } = workOrderIds.length
      ? await adminClient.from('work_orders').select('work_order_id, item_id, routing_id, production_plant_id').in('work_order_id', workOrderIds)
      : { data: [] as { work_order_id: number; item_id: number; routing_id: number | null; production_plant_id: number }[] };
    const woById = new Map((workOrders ?? []).map((w) => [w.work_order_id, w]));

    const relevantWoIds = myPlantId ? (workOrders ?? []).filter((w) => w.production_plant_id === myPlantId).map((w) => w.work_order_id) : workOrderIds;
    const relevantWoIdSet = new Set(relevantWoIds);

    const itemIds = [...new Set((workOrders ?? []).map((w) => w.item_id))];
    const { data: items } = itemIds.length ? await adminClient.from('items').select('item_id, item_code, name, base_uom').in('item_id', itemIds) : { data: [] };
    const itemById = new Map((items ?? []).map((i) => [i.item_id, i]));

    const plantIds = [...new Set((workOrders ?? []).map((w) => w.production_plant_id))];
    const { data: plants } = plantIds.length ? await adminClient.from('production_plants').select('production_plant_id, name').in('production_plant_id', plantIds) : { data: [] };
    const plantById = new Map((plants ?? []).map((p) => [p.production_plant_id, p]));

    const result = (batches ?? [])
      .filter((b) => relevantWoIdSet.has(b.work_order_id))
      .map((b) => {
        const wo = woById.get(b.work_order_id);
        const item = wo ? itemById.get(wo.item_id) : null;
        const plant = wo ? plantById.get(wo.production_plant_id) : null;
        return {
          production_batch_id: b.production_batch_id,
          batch_number: b.batch_number,
          planned_qty: b.planned_qty,
          uom: b.uom,
          status: b.status,
          planned_date: b.planned_date,
          work_order_id: b.work_order_id,
          routing_id: wo?.routing_id ?? null,
          item_code: item?.item_code ?? null,
          item_name: item?.name ?? null,
          item_base_uom: item?.base_uom ?? null,
          production_plant_id: wo?.production_plant_id ?? null,
          production_plant_name: plant?.name ?? null
        };
      })
      .sort((a, b) => (a.status === b.status ? a.batch_number.localeCompare(b.batch_number) : a.status === 'in_progress' ? -1 : 1));

    return { status: 200, body: { today, my_plant_id: myPlantId, batches: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

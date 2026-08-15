import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { getWeekRange, dateToDateString } from './weekRange';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

type RoutingStep = {
  routing_step_id: number;
  routing_id: number;
  sequence_no: number;
  step_name: string;
  work_center_id: number | null;
  active_duration_minutes: number | null;
  wait_duration_minutes: number | null;
};

// Tampilan Gantt VIEW-ONLY (bukan drag-and-drop — itu iterasi terpisah menyusul).
// Lihat docs/rencana-ams-mvp.md Bagian 3 poin 2. Blok = 1 kemunculan routing_step
// untuk 1 batch, diproyeksikan dari production_batches.planned_date secara
// berurutan sesuai routing_steps.sequence_no.
//
// POSISI (tanggal mulai tiap tahap) vs LEBAR (durasi visual blok) SENGAJA pakai
// dua besaran berbeda:
// - Posisi: offset kumulatif dari SEMUA tahap sebelumnya, active_duration_minutes
//   DAN wait_duration_minutes-nya — ini waktu NYATA yang berlalu sebelum tahap
//   berikutnya bisa mulai (mis. QC baru bisa mulai setelah curing 48 jam selesai).
// - Lebar blok: active_duration_minutes tahap itu SENDIRI saja — supaya blok
//   tetap terlihat "mesin cuma sibuk sebentar", bukan seakan-akan terpakai
//   sepanjang waktu tunggu.
// CATATAN: ini BEDA dari getWorkCenterCapacity.ts, yang menjumlah cuma
// active_duration_minutes untuk kalkulasi total jam terjadwal per minggu —
// dua kalkulasi itu menjawab pertanyaan berbeda (kapan tahap ini terjadi, vs
// berapa total jam mesin benar-benar aktif) dan SENGAJA tidak disamakan.
const MINUTES_PER_DAY = 24 * 60;
export async function getWorkCenterGantt(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const weekOffsetRaw = Number(request.nextUrl.searchParams.get('week_offset') ?? '0');
    const weekOffset = Number.isFinite(weekOffsetRaw) ? Math.trunc(weekOffsetRaw) : 0;

    const adminClient = getAdminClient();
    const { weekStart, weekEnd } = getWeekRange(weekOffset);

    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(dateToDateString(d));
    }
    const firstDay = days[0];
    const lastDay = days[days.length - 1];

    const { data: workCenters, error: wcError } = await adminClient
      .from('work_centers')
      .select('work_center_id, name, code')
      .eq('company_id', appUser.company_id)
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (wcError) return { status: 500, body: { error: wcError.message } };

    const { data: batches, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, batch_number, work_order_id, planned_qty, uom, planned_date, status')
      .eq('company_id', appUser.company_id)
      .in('status', ['planned', 'in_progress']);
    if (batchError) return { status: 500, body: { error: batchError.message } };

    const woIds = Array.from(new Set((batches ?? []).map((b) => b.work_order_id)));
    const { data: workOrders, error: woError } = woIds.length
      ? await adminClient.from('work_orders').select('work_order_id, routing_id, item_id').in('work_order_id', woIds)
      : { data: [] as { work_order_id: number; routing_id: number | null; item_id: number }[], error: null };
    if (woError) return { status: 500, body: { error: woError.message } };

    const woById = new Map((workOrders ?? []).map((wo) => [wo.work_order_id, wo]));
    const itemIds = Array.from(new Set((workOrders ?? []).map((wo) => wo.item_id)));
    const routingIds = Array.from(new Set((workOrders ?? []).map((wo) => wo.routing_id).filter((id): id is number => !!id)));

    const [itemsRes, stepsRes] = await Promise.all([
      itemIds.length
        ? adminClient.from('items').select('item_id, item_code, name').in('item_id', itemIds)
        : Promise.resolve({ data: [] as { item_id: number; item_code: string | null; name: string }[], error: null }),
      routingIds.length
        ? adminClient.from('routing_steps').select('routing_step_id, routing_id, sequence_no, step_name, work_center_id, active_duration_minutes, wait_duration_minutes').in('routing_id', routingIds)
        : Promise.resolve({ data: [] as RoutingStep[], error: null })
    ]);
    if (itemsRes.error) return { status: 500, body: { error: itemsRes.error.message } };
    if (stepsRes.error) return { status: 500, body: { error: stepsRes.error.message } };

    const itemsById = new Map((itemsRes.data ?? []).map((i) => [i.item_id, i]));
    const stepsByRoutingId = new Map<number, RoutingStep[]>();
    for (const step of stepsRes.data ?? []) {
      const list = stepsByRoutingId.get(step.routing_id) ?? [];
      list.push(step);
      stepsByRoutingId.set(step.routing_id, list);
    }
    for (const list of stepsByRoutingId.values()) list.sort((a, b) => a.sequence_no - b.sequence_no);

    const blocks: {
      work_center_id: number;
      date: string;
      production_batch_id: number;
      batch_number: string;
      batch_status: string;
      item_code: string | null;
      item_name: string | null;
      routing_step_id: number;
      step_name: string;
      sequence_no: number;
      duration_minutes: number;
      day_offset: number;
    }[] = [];
    const unscheduled: {
      production_batch_id: number;
      batch_number: string;
      batch_status: string;
      item_code: string | null;
      item_name: string | null;
      planned_qty: number;
      uom: string;
      primary_work_center_id: number | null;
    }[] = [];

    for (const batch of batches ?? []) {
      const wo = woById.get(batch.work_order_id);
      const item = wo ? itemsById.get(wo.item_id) : undefined;

      const routingId = wo?.routing_id;
      const steps = routingId ? (stepsByRoutingId.get(routingId) ?? []) : [];

      if (!batch.planned_date) {
        const firstStepWithWc = steps.find((s) => s.work_center_id);
        unscheduled.push({
          production_batch_id: batch.production_batch_id,
          batch_number: batch.batch_number,
          batch_status: batch.status,
          item_code: item?.item_code ?? null,
          item_name: item?.name ?? null,
          planned_qty: batch.planned_qty,
          uom: batch.uom,
          primary_work_center_id: firstStepWithWc?.work_center_id ?? null
        });
        continue;
      }

      const baseDate = new Date(`${batch.planned_date}T00:00:00`);
      let cumulativeMinutes = 0;

      for (const step of steps) {
        const dayOffset = Math.floor(cumulativeMinutes / MINUTES_PER_DAY);
        const stepDate = new Date(baseDate);
        stepDate.setDate(baseDate.getDate() + dayOffset);
        const stepDateStr = dateToDateString(stepDate);

        if (step.work_center_id && stepDateStr >= firstDay && stepDateStr <= lastDay) {
          blocks.push({
            work_center_id: step.work_center_id,
            date: stepDateStr,
            production_batch_id: batch.production_batch_id,
            batch_number: batch.batch_number,
            batch_status: batch.status,
            item_code: item?.item_code ?? null,
            item_name: item?.name ?? null,
            routing_step_id: step.routing_step_id,
            step_name: step.step_name,
            sequence_no: step.sequence_no,
            duration_minutes: step.active_duration_minutes ?? 0,
            day_offset: dayOffset
          });
        }
        // Kumulatif (posisi) tetap jalan biar urutan step berikutnya tetap benar,
        // terlepas dari step ini punya work_center atau jatuh di luar minggu yang
        // dilihat — dan SENGAJA ikut wait_duration_minutes (beda dari lebar blok
        // di atas, yang cuma active_duration_minutes).
        cumulativeMinutes += (step.active_duration_minutes ?? 0) + (step.wait_duration_minutes ?? 0);
      }
    }

    return {
      status: 200,
      body: {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        weekOffset,
        days,
        workCenters: workCenters ?? [],
        blocks,
        unscheduled
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

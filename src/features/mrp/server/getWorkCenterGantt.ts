import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { getWeekRange, dateToDateString } from './weekRange';
import { getEffectiveStepDurationMinutes } from './stepDuration';

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
  duration_per_unit_minutes: number | null;
  wait_duration_minutes: number | null;
};

type Shift = { shift_id: number; start_time: string };

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Tampilan Gantt — Mingguan (SUDAH ADA sejak awal, logikanya TIDAK DIUBAH),
// Harian, dan Bulanan (rencana-ams-mvp.md Bagian 3 poin 4). Ketiganya BERBAGI
// SATU loop kumulatif di bawah (per batch, per routing_step, cumulativeMinutes
// = active + wait tahap-tahap SEBELUMNYA) — beda view cuma beda rentang
// tanggal yang di-filter dan beda bentuk agregasi hasil akhirnya, BUKAN beda
// rumus penempatan.
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
//
// TAMPILAN HARIAN: hari (dayOffset/stepDateStr) tetap dihitung PERSIS seperti
// Mingguan (jangkar tengah malam planned_date) — supaya 1 tahap yang sama
// selalu jatuh di tanggal yang sama di kedua tampilan. Yang BEDA cuma posisi
// JAM di dalam hari itu (minute_of_day), ditambahkan sebagai info tampilan
// SETELAH hari ditentukan: jangkar jam = shifts.start_time batch itu (kalau
// ada shift_id), + cumulativeMinutes yang SAMA dipakai untuk posisi hari.
const MINUTES_PER_DAY = 24 * 60;
export async function getWorkCenterGantt(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const view = (request.nextUrl.searchParams.get('view') ?? 'weekly') as 'weekly' | 'daily' | 'monthly';
    const adminClient = getAdminClient();

    let days: string[] = [];
    let weekStart: Date | null = null;
    let weekEnd: Date | null = null;
    let weekOffset = 0;
    let year = 0;
    let month = 0;

    if (view === 'daily') {
      const dateParam = request.nextUrl.searchParams.get('date');
      const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : dateToDateString(new Date());
      days = [date];
    } else if (view === 'monthly') {
      const now = new Date();
      year = Number(request.nextUrl.searchParams.get('year') ?? now.getFullYear());
      month = Number(request.nextUrl.searchParams.get('month') ?? now.getMonth() + 1);
      if (!Number.isFinite(year) || year < 2000) year = now.getFullYear();
      if (!Number.isFinite(month) || month < 1 || month > 12) month = now.getMonth() + 1;
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        days.push(`${year}-${pad2(month)}-${pad2(d)}`);
      }
    } else {
      const weekOffsetRaw = Number(request.nextUrl.searchParams.get('week_offset') ?? '0');
      weekOffset = Number.isFinite(weekOffsetRaw) ? Math.trunc(weekOffsetRaw) : 0;
      const range = getWeekRange(weekOffset);
      weekStart = range.weekStart;
      weekEnd = range.weekEnd;
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        days.push(dateToDateString(d));
      }
    }
    const firstDay = days[0];
    const lastDay = days[days.length - 1];

    const { data: workCenters, error: wcError } = await adminClient
      .from('work_centers')
      .select('work_center_id, name, code, capacity_hours_per_day')
      .eq('company_id', appUser.company_id)
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (wcError) return { status: 500, body: { error: wcError.message } };

    const { data: batches, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, batch_number, work_order_id, planned_qty, uom, planned_date, status, shift_id')
      .eq('company_id', appUser.company_id)
      .in('status', ['planned', 'in_progress']);
    if (batchError) return { status: 500, body: { error: batchError.message } };

    const woIds = Array.from(new Set((batches ?? []).map((b) => b.work_order_id)));
    const shiftIds = Array.from(new Set((batches ?? []).map((b) => b.shift_id).filter((id): id is number => !!id)));
    const [woRes, shiftsRes] = await Promise.all([
      woIds.length
        ? adminClient.from('work_orders').select('work_order_id, routing_id, item_id').in('work_order_id', woIds)
        : Promise.resolve({ data: [] as { work_order_id: number; routing_id: number | null; item_id: number }[], error: null }),
      shiftIds.length ? adminClient.from('shifts').select('shift_id, start_time').in('shift_id', shiftIds) : Promise.resolve({ data: [] as Shift[], error: null })
    ]);
    if (woRes.error) return { status: 500, body: { error: woRes.error.message } };
    if (shiftsRes.error) return { status: 500, body: { error: shiftsRes.error.message } };

    const woById = new Map((woRes.data ?? []).map((wo) => [wo.work_order_id, wo]));
    const shiftsById = new Map((shiftsRes.data ?? []).map((s) => [s.shift_id, s]));
    const itemIds = Array.from(new Set((woRes.data ?? []).map((wo) => wo.item_id)));
    const routingIds = Array.from(new Set((woRes.data ?? []).map((wo) => wo.routing_id).filter((id): id is number => !!id)));

    const [itemsRes, stepsRes] = await Promise.all([
      itemIds.length
        ? adminClient.from('items').select('item_id, item_code, name').in('item_id', itemIds)
        : Promise.resolve({ data: [] as { item_id: number; item_code: string | null; name: string }[], error: null }),
      routingIds.length
        ? adminClient.from('routing_steps').select('routing_step_id, routing_id, sequence_no, step_name, work_center_id, active_duration_minutes, duration_per_unit_minutes, wait_duration_minutes').in('routing_id', routingIds)
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
      minute_of_day: number;
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
      const shift = batch.shift_id ? shiftsById.get(batch.shift_id) : undefined;
      const anchorMinutes = shift ? parseTimeToMinutes(shift.start_time) : 0;
      let cumulativeMinutes = 0;

      for (const step of steps) {
        // Hari (dayOffset/stepDateStr): PERSIS logika Mingguan, jangkar tengah
        // malam planned_date — tidak boleh berubah walau ada shift, supaya 1
        // tahap selalu jatuh di tanggal yang sama lintas semua tampilan.
        const dayOffset = Math.floor(cumulativeMinutes / MINUTES_PER_DAY);
        const stepDate = new Date(baseDate);
        stepDate.setDate(baseDate.getDate() + dayOffset);
        const stepDateStr = dateToDateString(stepDate);
        // Jam dalam hari itu: cuma dipakai tampilan Harian — jangkar shift
        // start_time + cumulativeMinutes yang SAMA (bukan rumus baru).
        const minuteOfDay = (anchorMinutes + cumulativeMinutes) % MINUTES_PER_DAY;

        const effectiveActiveMinutes = getEffectiveStepDurationMinutes(step, Number(batch.planned_qty));

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
            duration_minutes: effectiveActiveMinutes,
            day_offset: dayOffset,
            minute_of_day: minuteOfDay
          });
        }
        // Kumulatif (posisi) tetap jalan biar urutan step berikutnya tetap benar,
        // terlepas dari step ini punya work_center atau jatuh di luar rentang yang
        // dilihat — dan SENGAJA ikut wait_duration_minutes (beda dari lebar blok
        // di atas, yang cuma durasi aktif efektif tahap ini sendiri).
        cumulativeMinutes += effectiveActiveMinutes + (step.wait_duration_minutes ?? 0);
      }
    }

    if (view === 'monthly') {
      // Bulanan: TIDAK menampilkan blok tahap detail (tidak terbaca di skala
      // ini) — cukup agregat jumlah batch + total menit aktif per hari per
      // Work Center, diturunkan dari `blocks` yang sama di atas (bukan hitungan
      // baru), supaya tetap konsisten dengan Mingguan/Harian.
      const summaryMap = new Map<string, { work_center_id: number; date: string; batchNumbers: Set<string>; activeMinutes: number }>();
      for (const block of blocks) {
        const key = `${block.work_center_id}_${block.date}`;
        const entry = summaryMap.get(key) ?? { work_center_id: block.work_center_id, date: block.date, batchNumbers: new Set<string>(), activeMinutes: 0 };
        entry.batchNumbers.add(block.batch_number);
        entry.activeMinutes += block.duration_minutes;
        summaryMap.set(key, entry);
      }
      const monthlySummary = Array.from(summaryMap.values()).map((e) => ({
        work_center_id: e.work_center_id,
        date: e.date,
        batch_count: e.batchNumbers.size,
        active_minutes: e.activeMinutes
      }));

      return {
        status: 200,
        body: {
          view,
          year,
          month,
          days,
          workCenters: workCenters ?? [],
          monthlySummary,
          unscheduled
        }
      };
    }

    return {
      status: 200,
      body: {
        view,
        weekStart: weekStart ? weekStart.toISOString() : null,
        weekEnd: weekEnd ? weekEnd.toISOString() : null,
        weekOffset,
        date: view === 'daily' ? days[0] : null,
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

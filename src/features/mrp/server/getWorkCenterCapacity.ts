import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { getWeekRange } from './weekRange';
import { getEffectiveStepDurationMinutes } from './stepDuration';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Asumsi hari kerja per minggu SEKARANG diambil dari company_settings (key
// "working_days_per_week"), pola sama seperti "standard_hours_per_day" /
// "so_number_company_code" yang sudah ada — bukan lagi hardcode. Default 6
// (Senin-Sabtu) dipakai kalau company belum pernah mengatur key ini.
const DEFAULT_WORKING_DAYS_PER_WEEK = 6;

async function getWorkingDaysPerWeek(adminClient: ReturnType<typeof getAdminClient>, companyId: number): Promise<number> {
  const { data } = await adminClient
    .from('company_settings')
    .select('setting_value')
    .eq('company_id', companyId)
    .eq('setting_key', 'working_days_per_week')
    .maybeSingle();
  const parsed = data?.setting_value ? Number(data.setting_value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 7 ? parsed : DEFAULT_WORKING_DAYS_PER_WEEK;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Laporan sederhana "mesin ini terjadwal berapa jam minggu ini, dari total jam
// tersedia berapa" — murni dihitung dari data yang sudah ada (production_batches
// aktif minggu ini -> work_orders -> routing_steps -> work_center_id), bukan
// algoritma optimasi baru. Lihat docs/rencana-ams-mvp.md Bagian 3 poin 1.
export async function getWorkCenterCapacity(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: workCenters, error: wcError } = await adminClient
      .from('work_centers')
      .select('work_center_id, production_plant_id, name, code, capacity_hours_per_day, unit_count, is_active')
      .eq('company_id', appUser.company_id)
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (wcError) return { status: 500, body: { error: wcError.message } };

    const workingDaysPerWeek = await getWorkingDaysPerWeek(adminClient, appUser.company_id);

    if (!workCenters || workCenters.length === 0) {
      return { status: 200, body: { workCenters: [], workingDaysPerWeek } };
    }

    const plantIds = Array.from(new Set(workCenters.map((wc) => wc.production_plant_id)));

    const { weekStart, weekEnd } = getWeekRange(0);

    const [plantsRes, batchesRes] = await Promise.all([
      adminClient.from('production_plants').select('production_plant_id, name').in('production_plant_id', plantIds),
      adminClient
        .from('production_batches')
        .select('production_batch_id, work_order_id, planned_qty, status, planned_date, started_at, created_at')
        .eq('company_id', appUser.company_id)
        .in('status', ['planned', 'in_progress'])
    ]);
    if (plantsRes.error) return { status: 500, body: { error: plantsRes.error.message } };
    if (batchesRes.error) return { status: 500, body: { error: batchesRes.error.message } };

    const plantsById = new Map((plantsRes.data ?? []).map((p) => [p.production_plant_id, p]));

    // Acuan tanggal: planned_date (UTAMA — kapan batch SEHARUSNYA dikerjakan,
    // diisi PPIC saat bikin batch) -> started_at (fallback untuk data lama yang
    // belum punya planned_date, sudah benar-benar mulai) -> created_at (fallback
    // terakhir, batch lama yang belum sempat mulai maupun belum punya planned_date).
    const batchesThisWeek = (batchesRes.data ?? []).filter((b) => {
      const ref = b.planned_date ? new Date(`${b.planned_date}T00:00:00`) : new Date(b.started_at ?? b.created_at);
      return ref >= weekStart && ref < weekEnd;
    });

    const woIds = Array.from(new Set(batchesThisWeek.map((b) => b.work_order_id)));
    const { data: workOrders, error: woError } = woIds.length
      ? await adminClient.from('work_orders').select('work_order_id, routing_id').in('work_order_id', woIds)
      : { data: [] as { work_order_id: number; routing_id: number | null }[], error: null };
    if (woError) return { status: 500, body: { error: woError.message } };

    const routingIdByWoId = new Map((workOrders ?? []).map((wo) => [wo.work_order_id, wo.routing_id]));
    const routingIds = Array.from(new Set((workOrders ?? []).map((wo) => wo.routing_id).filter((id): id is number => !!id)));

    const { data: routingSteps, error: rsError } = routingIds.length
      ? await adminClient.from('routing_steps').select('routing_id, work_center_id, active_duration_minutes, duration_per_unit_minutes').in('routing_id', routingIds)
      : { data: [] as { routing_id: number; work_center_id: number | null; active_duration_minutes: number | null; duration_per_unit_minutes: number | null }[], error: null };
    if (rsError) return { status: 500, body: { error: rsError.message } };

    const stepsByRoutingId = new Map<number, typeof routingSteps>();
    for (const step of routingSteps ?? []) {
      const list = stepsByRoutingId.get(step.routing_id) ?? [];
      list.push(step);
      stepsByRoutingId.set(step.routing_id, list);
    }

    const scheduledMinutesByWorkCenter = new Map<number, number>();
    for (const batch of batchesThisWeek) {
      const routingId = routingIdByWoId.get(batch.work_order_id);
      if (!routingId) continue;
      const steps = stepsByRoutingId.get(routingId) ?? [];
      for (const step of steps) {
        if (!step.work_center_id) continue;
        const current = scheduledMinutesByWorkCenter.get(step.work_center_id) ?? 0;
        scheduledMinutesByWorkCenter.set(step.work_center_id, current + getEffectiveStepDurationMinutes(step, Number(batch.planned_qty)));
      }
    }

    const result = workCenters.map((wc) => {
      const scheduledHours = round1((scheduledMinutesByWorkCenter.get(wc.work_center_id) ?? 0) / 60);
      // capacity_hours_per_day TETAP kapasitas PER UNIT mesin (dipakai form edit
      // di UI) -- unit_count dikalikan TERPISAH ke total_capacity_hours, supaya
      // menyimpan kapasitas tidak diam-diam menimpa angka per-unit dengan angka
      // yang sudah dikali unit_count.
      const capacityPerDay = wc.capacity_hours_per_day !== null ? Number(wc.capacity_hours_per_day) : null;
      const unitCount = Number(wc.unit_count ?? 1);
      const totalCapacityHours = capacityPerDay !== null ? round1(capacityPerDay * unitCount * workingDaysPerWeek) : null;
      const utilizationPct = totalCapacityHours !== null && totalCapacityHours > 0 ? round1((scheduledHours / totalCapacityHours) * 100) : null;
      return {
        work_center_id: wc.work_center_id,
        name: wc.name,
        code: wc.code,
        production_plant_id: wc.production_plant_id,
        production_plant_name: plantsById.get(wc.production_plant_id)?.name ?? null,
        capacity_hours_per_day: capacityPerDay,
        unit_count: unitCount,
        scheduled_hours: scheduledHours,
        total_capacity_hours: totalCapacityHours,
        utilization_pct: utilizationPct
      };
    });

    return {
      status: 200,
      body: {
        workCenters: result,
        workingDaysPerWeek,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString()
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

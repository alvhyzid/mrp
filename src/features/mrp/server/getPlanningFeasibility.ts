import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Deteksi Konflik Perencanaan (GELOMBANG 2 poin 5, spesifikasi-aturan-biaya-v1.md §4/§5
// Contoh 1). Untuk 1 sales_order_line: kebutuhan batch (qty ÷ unit_per_batch, standar
// ber-asal-usul K8), kapasitas (batch/hari, K8), hari kerja tersedia s/d tanggal kirim
// (dari kalender kerja tenant), DAN tanggal mulai paling awal yang REALISTIS (kalau ada
// komponen BOM stok 0 dengan PO supplier yang BELUM diterima — Filling tidak mungkin
// mulai sebelum PO itu datang, K4/§4). Status FEASIBLE/TIDAK + estimasi qty yang
// realistis terkirim tepat waktu kalau TIDAK feasible.
export async function getPlanningFeasibility(request: NextRequest, salesOrderLineId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canViewFinancialData(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya akses ke laporan perencanaan ini.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: soLine, error: soLineError } = await adminClient
      .from('sales_order_lines')
      .select('sales_order_line_id, sales_order_id, item_id, qty_ordered')
      .eq('sales_order_line_id', salesOrderLineId)
      .maybeSingle();
    if (soLineError) return { status: 500, body: { error: soLineError.message } };
    if (!soLine) return { status: 404, body: { error: 'Baris sales order tidak ditemukan.' } };

    const { data: so, error: soError } = await adminClient
      .from('sales_orders')
      .select('sales_order_id, company_id, customer_purchase_order_id')
      .eq('sales_order_id', soLine.sales_order_id)
      .maybeSingle();
    if (soError) return { status: 500, body: { error: soError.message } };
    if (!so || so.company_id !== appUser.company_id) return { status: 404, body: { error: 'Sales order tidak ditemukan di perusahaan Anda.' } };

    const { data: cpo, error: cpoError } = await adminClient
      .from('customer_purchase_orders')
      .select('requested_ship_date')
      .eq('customer_purchase_order_id', so.customer_purchase_order_id)
      .maybeSingle();
    if (cpoError) return { status: 500, body: { error: cpoError.message } };
    if (!cpo?.requested_ship_date) {
      return { status: 400, body: { error: 'PO client ini tidak punya tanggal kirim yang diminta — tidak bisa dihitung kelayakan jadwalnya.' } };
    }

    const { data: item, error: itemError } = await adminClient.from('items').select('item_id, item_code, name').eq('item_id', soLine.item_id).maybeSingle();
    if (itemError) return { status: 500, body: { error: itemError.message } };
    if (!item) return { status: 404, body: { error: 'Item tidak ditemukan.' } };

    const { data: standards, error: standardsError } = await adminClient
      .from('production_standards')
      .select('metric_key, value, source')
      .eq('company_id', appUser.company_id)
      .eq('item_id', item.item_id)
      .is('routing_step_id', null)
      .in('metric_key', ['unit_per_batch', 'batches_per_day']);
    if (standardsError) return { status: 500, body: { error: standardsError.message } };

    const liveUnitPerBatch = standards?.find((s) => s.metric_key === 'unit_per_batch')?.value;
    const liveBatchesPerDay = standards?.find((s) => s.metric_key === 'batches_per_day')?.value;
    if (!liveUnitPerBatch || !liveBatchesPerDay) {
      return {
        status: 200,
        body: {
          feasible: null,
          reason: 'Standar unit-per-batch dan/atau kapasitas batch/hari belum ada untuk item ini — tidak bisa dihitung kelayakan jadwalnya.',
          item_code: item.item_code,
          item_name: item.name
        }
      };
    }

    // K8 bagian D.4 (Fase Produksi Nyata) — SNAPSHOT standar per rencana. Panggilan
    // PERTAMA untuk sales_order_line ini mengunci unit_per_batch/batches_per_day
    // yang dipakai SELAMANYA untuk baris itu (insert sekali, tidak pernah di-UPDATE
    // dari sini) — supaya kalau standar itu berubah belakangan (job pembelajaran K8
    // di-approve planner), angka rencana yang SUDAH dihitung/dipakai tidak ikut
    // berubah diam-diam. Live value tetap dibaca setiap panggilan untuk dibandingkan
    // dan dilaporkan sebagai `standard_drift` kalau beda dari snapshot.
    const { data: existingSnapshot, error: snapshotReadError } = await adminClient
      .from('sales_order_line_feasibility_snapshots')
      .select('unit_per_batch, batches_per_day, created_at')
      .eq('sales_order_line_id', salesOrderLineId)
      .maybeSingle();
    if (snapshotReadError) return { status: 500, body: { error: snapshotReadError.message } };

    let unitPerBatch = Number(liveUnitPerBatch);
    let batchesPerDay = Number(liveBatchesPerDay);
    let snapshotTakenAt: string;
    let standardDrift: Record<string, unknown> | null = null;

    if (!existingSnapshot) {
      const { data: inserted, error: snapshotInsertError } = await adminClient
        .from('sales_order_line_feasibility_snapshots')
        .insert([{ company_id: appUser.company_id, sales_order_line_id: salesOrderLineId, unit_per_batch: unitPerBatch, batches_per_day: batchesPerDay }])
        .select('created_at')
        .single();
      if (snapshotInsertError) return { status: 500, body: { error: snapshotInsertError.message } };
      snapshotTakenAt = inserted.created_at;
    } else {
      unitPerBatch = Number(existingSnapshot.unit_per_batch);
      batchesPerDay = Number(existingSnapshot.batches_per_day);
      snapshotTakenAt = existingSnapshot.created_at;

      if (unitPerBatch !== Number(liveUnitPerBatch) || batchesPerDay !== Number(liveBatchesPerDay)) {
        standardDrift = {
          message: 'Standar produksi untuk item ini sudah berubah sejak rencana ini pertama dihitung — angka rencana di bawah TETAP memakai standar lama (tidak diubah diam-diam).',
          unit_per_batch: { used_in_plan: unitPerBatch, current: Number(liveUnitPerBatch) },
          batches_per_day: { used_in_plan: batchesPerDay, current: Number(liveBatchesPerDay) }
        };
      }
    }

    const batchesNeeded = Math.ceil(Number(soLine.qty_ordered) / Number(unitPerBatch));
    const daysNeeded = Math.ceil(batchesNeeded / Number(batchesPerDay));

    // Deteksi blocker material: komponen BOM item ini yang stok-nya 0 (di plant mana
    // pun company ini) TAPI ada PO supplier yang belum sepenuhnya diterima -> tanggal
    // paling awal Filling bisa mulai = expected_date PO itu (yang PALING LAMBAT, kalau
    // ada beberapa komponen blocked sekaligus).
    const { data: bom } = await adminClient.from('boms').select('bom_id').eq('company_id', appUser.company_id).eq('parent_item_id', item.item_id).eq('status', 'active').maybeSingle();
    let materialBlockedUntil: string | null = null;
    if (bom) {
      const { data: bomLines } = await adminClient.from('bom_lines').select('component_item_id').eq('bom_id', bom.bom_id);
      const componentItemIds = (bomLines ?? []).map((l) => l.component_item_id);
      if (componentItemIds.length > 0) {
        const { data: stockRows } = await adminClient.from('lots').select('item_id, quantity_on_hand').in('item_id', componentItemIds).eq('status', 'available');
        const stockByItem = new Map<number, number>();
        for (const row of stockRows ?? []) {
          stockByItem.set(row.item_id, (stockByItem.get(row.item_id) ?? 0) + Number(row.quantity_on_hand));
        }
        const zeroStockItemIds = componentItemIds.filter((id) => (stockByItem.get(id) ?? 0) <= 0);
        if (zeroStockItemIds.length > 0) {
          const { data: relevantPos } = await adminClient
            .from('purchase_orders')
            .select('purchase_order_id, expected_date')
            .eq('company_id', appUser.company_id)
            .in('status', ['ordered', 'partially_received']);
          const posById = new Map((relevantPos ?? []).map((po) => [po.purchase_order_id, po]));

          if (posById.size > 0) {
            const { data: pendingLines } = await adminClient
              .from('purchase_order_lines')
              .select('purchase_order_id, item_id, qty_ordered, qty_received')
              .in('item_id', zeroStockItemIds)
              .in('purchase_order_id', Array.from(posById.keys()));

            for (const line of pendingLines ?? []) {
              if (Number(line.qty_received) < Number(line.qty_ordered)) {
                const po = posById.get(line.purchase_order_id);
                if (po?.expected_date && (!materialBlockedUntil || po.expected_date > materialBlockedUntil)) {
                  materialBlockedUntil = po.expected_date;
                }
              }
            }
          }
        }
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const earliestStart = materialBlockedUntil && materialBlockedUntil > today ? materialBlockedUntil : today;

    const { data: calendarSettings } = await adminClient
      .from('company_settings')
      .select('setting_key, setting_value')
      .eq('company_id', appUser.company_id)
      .in('setting_key', ['work_calendar_weekday_hours', 'work_calendar_saturday_hours']);
    const weekdayHours = Number(calendarSettings?.find((s) => s.setting_key === 'work_calendar_weekday_hours')?.setting_value ?? 7);
    const saturdayHours = Number(calendarSettings?.find((s) => s.setting_key === 'work_calendar_saturday_hours')?.setting_value ?? 5);

    const totalWorkingDays = countWorkingDays(today, cpo.requested_ship_date, weekdayHours, saturdayHours);
    const effectiveWorkingDays = countWorkingDays(earliestStart, cpo.requested_ship_date, weekdayHours, saturdayHours);

    const feasible = daysNeeded <= effectiveWorkingDays;
    const realisticQty = feasible ? Number(soLine.qty_ordered) : Math.floor(effectiveWorkingDays * Number(batchesPerDay) * Number(unitPerBatch));

    return {
      status: 200,
      body: {
        item_code: item.item_code,
        item_name: item.name,
        qty_ordered: soLine.qty_ordered,
        unit_per_batch: unitPerBatch,
        batches_per_day: batchesPerDay,
        batches_needed: batchesNeeded,
        days_needed: daysNeeded,
        requested_ship_date: cpo.requested_ship_date,
        today,
        material_blocked_until: materialBlockedUntil,
        total_working_days_to_deadline: totalWorkingDays,
        effective_working_days_after_material_block: effectiveWorkingDays,
        feasible,
        realistic_qty_deliverable_on_time: realisticQty,
        standard_snapshot_taken_at: snapshotTakenAt,
        standard_drift: standardDrift
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

// Hitung hari kerja (Sen-Sab, Minggu selalu libur) antara 2 tanggal (inklusif start,
// EKSKLUSIF end date itu sendiri dianggap hari kerja terakhir yang tersedia — barang
// harus SELESAI sebelum/pada tanggal kirim, jadi tanggal kirim sendiri tetap dihitung
// kalau itu hari kerja).
function countWorkingDays(startDateStr: string, endDateStr: string, weekdayHours: number, saturdayHours: number): number {
  const start = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T00:00:00Z`);
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getUTCDay(); // 0=Minggu, 6=Sabtu
    if (dow === 0) {
      // Minggu selalu libur
    } else if (dow === 6) {
      if (saturdayHours > 0) count += 1;
    } else if (weekdayHours > 0) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

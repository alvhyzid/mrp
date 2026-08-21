import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewPlanningFeasibility } from '@/lib/roles';
import { explodeBomRequirements, type BlockingStage, type MaterialShortage, type ComponentToProduce } from './explodeBomRequirements';

function itemById2(shortages: MaterialShortage[], toProduce: ComponentToProduce[], itemId: number): { item_code: string; name: string } | undefined {
  return shortages.find((s) => s.item_id === itemId) ?? toProduce.find((c) => c.item_id === itemId);
}

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
    if (!canViewPlanningFeasibility(appUser.role)) {
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

    // K8 bagian D.4 (Fase Produksi Nyata) — SNAPSHOT standar per rencana. Sesi 0C
    // (21 Agu 2026): MEMBACA panel ini TIDAK PERNAH lagi menulis apa pun --
    // rencana HANYA terkunci lewat aksi eksplisit terpisah
    // (lockFeasibilityBaseline.ts), bergerbang peran finansial. Kalau belum
    // pernah dikunci, angka di bawah dihitung LIVE dan dikembalikan dengan
    // locked:false -- TIDAK disimpan. Lihat HANDOFF.md Sesi 0/0B/0C.
    const { data: existingSnapshot, error: snapshotReadError } = await adminClient
      .from('sales_order_line_feasibility_snapshots')
      .select('unit_per_batch, batches_per_day, created_at, locked_by, relock_reason')
      .eq('sales_order_line_id', salesOrderLineId)
      .is('archived_at', null)
      .maybeSingle();
    if (snapshotReadError) return { status: 500, body: { error: snapshotReadError.message } };

    let unitPerBatch = Number(liveUnitPerBatch);
    let batchesPerDay = Number(liveBatchesPerDay);
    const isLocked = !!existingSnapshot;
    let snapshotTakenAt: string | null = null;
    let standardDrift: Record<string, unknown> | null = null;
    let lockedByName: string | null = null;
    let relockReason: string | null = null;

    if (existingSnapshot) {
      unitPerBatch = Number(existingSnapshot.unit_per_batch);
      batchesPerDay = Number(existingSnapshot.batches_per_day);
      snapshotTakenAt = existingSnapshot.created_at;
      relockReason = existingSnapshot.relock_reason;
      if (existingSnapshot.locked_by) {
        const { data: lockedByUser } = await adminClient.from('users').select('name').eq('user_id', existingSnapshot.locked_by).maybeSingle();
        lockedByName = lockedByUser?.name ?? null;
      }

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

    // SADAR-TAHAP (Fase Produksi Nyata, perbaikan model kelayakan 20 Agu 2026):
    // sebelum ini, SEMUA komponen BOM (bahkan kemasan yang baru dipakai di tahap
    // AKHIR, mis. Box di tahap "Filling Box") dianggap memblokir MULAINYA
    // produksi -- padahal semestinya cuma memblokir tahap itu sendiri dan
    // sesudahnya. Sekarang: eksplosi BOM berjenjang (explodeBomRequirements)
    // sudah membawa blocking_stage per shortage/komponen-yang-perlu-diproduksi.
    // Shortage yang blocking_stage-nya = tahap PERTAMA routing item ini (atau
    // routing_step_id belum diklasifikasi -- default tahap pertama, TIDAK ADA
    // REGRESI dari perilaku lama) itu yang memblokir MULAI produksi. Shortage di
    // tahap sesudahnya cuma memperlambat tanggal SELESAI/kirim, bukan mulainya.
    const { shortages: materialShortages, toProduce: componentsToProduce, firstStageSequenceNo } = await explodeBomRequirements(
      adminClient,
      appUser.company_id,
      item.item_id,
      Number(soLine.qty_ordered)
    );

    const blockedEntries = [
      ...materialShortages.map((s) => ({ item_id: s.item_id, blocking_stage: s.blocking_stage })),
      ...componentsToProduce.map((c) => ({ item_id: c.item_id, blocking_stage: c.blocking_stage }))
    ];
    const startBlockingItemIds = blockedEntries
      .filter((e) => (e.blocking_stage?.sequence_no ?? firstStageSequenceNo) === firstStageSequenceNo)
      .map((e) => e.item_id);
    // Tahap SESUDAH tahap pertama saja -- per item (bisa beda tahap kalau muncul
    // di beberapa entri, ambil yang paling akhir/paling membatasi untuk item itu).
    const lateStageByItemId = new Map<number, { sequence_no: number; step_name: string }>();
    for (const entry of blockedEntries) {
      if (entry.blocking_stage && entry.blocking_stage.sequence_no !== firstStageSequenceNo) {
        const existing = lateStageByItemId.get(entry.item_id);
        if (!existing || entry.blocking_stage.sequence_no > existing.sequence_no) {
          lateStageByItemId.set(entry.item_id, entry.blocking_stage);
        }
      }
    }

    // Cari expected_date PO supplier yang BELUM sepenuhnya diterima, per item --
    // dipakai baik untuk shortage tahap pertama (memblokir mulai) maupun tahap
    // sesudahnya (memblokir selesai/kirim).
    const allBlockedItemIds = Array.from(new Set(blockedEntries.map((e) => e.item_id)));
    const etaByItemId = new Map<number, string>();
    if (allBlockedItemIds.length > 0) {
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
          .in('item_id', allBlockedItemIds)
          .in('purchase_order_id', Array.from(posById.keys()));

        for (const line of pendingLines ?? []) {
          if (Number(line.qty_received) < Number(line.qty_ordered)) {
            const po = posById.get(line.purchase_order_id);
            if (po?.expected_date) {
              const existing = etaByItemId.get(line.item_id);
              if (!existing || po.expected_date > existing) {
                etaByItemId.set(line.item_id, po.expected_date);
              }
            }
          }
        }
      }
    }

    // Kalau ada beberapa shortage tahap-pertama dengan PO berbeda, MULAI baru
    // bisa dilakukan setelah yang PALING LAMBAT datang.
    let productionStartBlockedUntil: string | null = null;
    for (const itemId of startBlockingItemIds) {
      const eta = etaByItemId.get(itemId);
      if (eta && (!productionStartBlockedUntil || eta > productionStartBlockedUntil)) {
        productionStartBlockedUntil = eta;
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const earliestStart = productionStartBlockedUntil && productionStartBlockedUntil > today ? productionStartBlockedUntil : today;

    const { data: calendarSettings } = await adminClient
      .from('company_settings')
      .select('setting_key, setting_value')
      .eq('company_id', appUser.company_id)
      .in('setting_key', ['work_calendar_weekday_hours', 'work_calendar_saturday_hours']);
    const weekdayHours = Number(calendarSettings?.find((s) => s.setting_key === 'work_calendar_weekday_hours')?.setting_value ?? 7);
    const saturdayHours = Number(calendarSettings?.find((s) => s.setting_key === 'work_calendar_saturday_hours')?.setting_value ?? 5);

    const totalWorkingDays = countWorkingDays(today, cpo.requested_ship_date, weekdayHours, saturdayHours);
    const effectiveWorkingDays = countWorkingDays(earliestStart, cpo.requested_ship_date, weekdayHours, saturdayHours);

    // Estimasi kuantitas realistis yang BISA terkirim tepat waktu -- diambil dari
    // yang PALING MEMBATASI di antara: (a) jendela hari kerja sejak mulai
    // produksi (kapasitas), dan (b) untuk tiap bahan tahap-akhir yang masih
    // kurang & punya ETA PO, jendela hari kerja sejak bahan itu SIAP (bukan
    // sejak mulai produksi) -- KETERBATASAN MODEL yang disadari: dipakai jendela
    // throughput TOTAL yang sama (daysNeeded) untuk tahap akhir itu, bukan
    // kapasitas per-tahap yang sesungguhnya (data durasi/kapasitas per tahap
    // belum cukup rinci) -- estimasi ini cenderung KONSERVATIF (melebih-lebihkan
    // risiko keterlambatan), bukan optimistis.
    let realisticQty = Number(soLine.qty_ordered);
    realisticQty = Math.min(realisticQty, Math.floor(effectiveWorkingDays * Number(batchesPerDay) * Number(unitPerBatch)));

    let orderShipReadyDate = addWorkingDays(earliestStart, daysNeeded, weekdayHours, saturdayHours);
    const lateStageBlocks: Array<{ item_id: number; item_code: string; name: string; blocking_stage: BlockingStage; expected_date: string | null; stage_ready_date: string | null }> = [];
    for (const [itemId, stage] of lateStageByItemId) {
      const item2 = itemById2(materialShortages, componentsToProduce, itemId);
      const eta = etaByItemId.get(itemId) ?? null;
      const stageReady = eta ? (eta > earliestStart ? eta : earliestStart) : null;
      lateStageBlocks.push({ item_id: itemId, item_code: item2?.item_code ?? '', name: item2?.name ?? '', blocking_stage: stage, expected_date: eta, stage_ready_date: stageReady });
      if (stageReady) {
        const stageFinishCandidate = addWorkingDays(stageReady, daysNeeded, weekdayHours, saturdayHours);
        if (stageFinishCandidate > orderShipReadyDate) orderShipReadyDate = stageFinishCandidate;
        const stageWorkingDays = countWorkingDays(stageReady, cpo.requested_ship_date, weekdayHours, saturdayHours);
        realisticQty = Math.min(realisticQty, Math.floor(stageWorkingDays * Number(batchesPerDay) * Number(unitPerBatch)));
      }
    }
    realisticQty = Math.max(0, realisticQty);

    const feasible = realisticQty >= Number(soLine.qty_ordered) && orderShipReadyDate <= cpo.requested_ship_date;

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
        routing_available: firstStageSequenceNo !== null,
        production_start_blocked_until: productionStartBlockedUntil,
        order_ship_ready_date: orderShipReadyDate,
        late_stage_material_blocks: lateStageBlocks,
        total_working_days_to_deadline: totalWorkingDays,
        effective_working_days_after_material_block: effectiveWorkingDays,
        feasible,
        realistic_qty_deliverable_on_time: realisticQty,
        material_shortages: materialShortages,
        components_to_produce: componentsToProduce,
        standard_snapshot_taken_at: snapshotTakenAt,
        locked: isLocked,
        locked_by_name: lockedByName,
        relock_reason: relockReason,
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

// Tanggal hari kerja ke-N (inklusif) mulai dari startDateStr -- dipakai untuk
// mengubah "N hari kerja dari tanggal X" jadi tanggal kalender sungguhan.
// workingDaysNeeded <= 0 mengembalikan startDateStr apa adanya.
function addWorkingDays(startDateStr: string, workingDaysNeeded: number, weekdayHours: number, saturdayHours: number): string {
  if (workingDaysNeeded <= 0) return startDateStr;
  let count = 0;
  const cursor = new Date(`${startDateStr}T00:00:00Z`);
  let lastWorkingDay = startDateStr;
  while (count < workingDaysNeeded) {
    const dow = cursor.getUTCDay();
    const isWorkingDay = dow === 0 ? false : dow === 6 ? saturdayHours > 0 : weekdayHours > 0;
    if (isWorkingDay) {
      count += 1;
      lastWorkingDay = cursor.toISOString().slice(0, 10);
    }
    if (count < workingDaysNeeded) cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return lastWorkingDay;
}

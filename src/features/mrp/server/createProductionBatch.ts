import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageWorkOrder } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// planned_qty diinput BEBAS oleh PPIC (atau siapa pun berwenang) — TIDAK terpaku ke
// boms.standard_yield_qty (lihat catatan di docs/rancangan-skema-database-mrp.md).
// Kebutuhan bahan (qty_per_unit_output x planned_qty x (1+buffer%)) dihitung &
// ditampilkan di UI SEBELUM batch ini dibuat (pakai data BOM yang sudah dimuat
// client dari /api/boms) — endpoint ini cuma menyimpan batch-nya, bukan menghitung
// ulang kebutuhan bahan (itu murni preview, tidak disimpan sebagai baris terpisah).
export async function createProductionBatch(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageWorkOrder(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin membuat batch produksi.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const workOrderId = Number(body.work_order_id);
    const plannedQty = Number(body.planned_qty);
    const shiftId = body.shift_id ? Number(body.shift_id) : null;

    if (!workOrderId) {
      return { status: 400, body: { error: 'Work Order wajib dipilih.' } };
    }
    if (!plannedQty || plannedQty <= 0) {
      return { status: 400, body: { error: 'Planned qty batch harus lebih besar dari 0.' } };
    }

    // planned_date: kapan batch ini SEHARUSNYA dikerjakan (dasar Dashboard
    // Kapasitas) — default ke hari ini kalau PPIC tidak isi, bukan dibiarkan
    // kosong begitu saja (batch baru dibuat tanpa tanggal rencana tidak masuk akal).
    const plannedDateRaw = typeof body.planned_date === 'string' ? body.planned_date.trim() : '';
    if (plannedDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(plannedDateRaw)) {
      return { status: 400, body: { error: 'Format tanggal rencana tidak valid.' } };
    }
    const plannedDate = plannedDateRaw || new Date().toISOString().slice(0, 10);

    // Nomor batch -- pola "rekomendasi + bisa diubah" (keputusan pemilik produk,
    // 20 Agu 2026): kalau staf isi batch_number sendiri (mis. format pabrik
    // "3TM13082601"), PAKAI ITU APA ADANYA -- jangan ditolak/dipaksa format lain.
    // Kosong = tetap pakai format otomatis lama. Keunikan dijaga PER PERUSAHAAN
    // (migration 20260820160000), bukan cuma per Work Order lagi.
    const overrideBatchNumber = typeof body.batch_number === 'string' ? body.batch_number.trim() : '';

    const adminClient = getAdminClient();

    const { data: wo, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, company_id, item_id, status')
      .eq('work_order_id', workOrderId)
      .maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!wo || wo.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Work Order tidak ditemukan.' } };
    }
    if (wo.status === 'completed' || wo.status === 'cancelled') {
      return { status: 400, body: { error: 'Work Order ini sudah selesai/batal, tidak bisa dibuatkan batch baru.' } };
    }

    if (shiftId) {
      const { data: shift, error: shiftError } = await adminClient.from('shifts').select('shift_id, company_id').eq('shift_id', shiftId).maybeSingle();
      if (shiftError) return { status: 500, body: { error: shiftError.message } };
      if (!shift || shift.company_id !== appUser.company_id) {
        return { status: 400, body: { error: 'Shift tidak valid untuk perusahaan Anda.' } };
      }
    }

    const { data: item, error: itemError } = await adminClient.from('items').select('base_uom').eq('item_id', wo.item_id).maybeSingle();
    if (itemError) return { status: 500, body: { error: itemError.message } };
    const uom = item?.base_uom ?? '';

    let batchNumber: string;
    if (overrideBatchNumber) {
      const { data: existingBatch, error: existingBatchError } = await adminClient
        .from('production_batches')
        .select('production_batch_id')
        .eq('company_id', appUser.company_id)
        .eq('batch_number', overrideBatchNumber)
        .maybeSingle();
      if (existingBatchError) return { status: 500, body: { error: existingBatchError.message } };
      if (existingBatch) {
        return { status: 400, body: { error: `Nomor batch "${overrideBatchNumber}" sudah dipakai — nomor batch harus unik di seluruh perusahaan.` } };
      }
      batchNumber = overrideBatchNumber;
    } else {
      // Format otomatis "WO-{work_order_id}-B{urutan}" (perilaku lama, dipakai
      // sebagai rekomendasi default kalau staf tidak isi nomor sendiri) — urutan
      // dihitung dari jumlah batch yang sudah ada untuk WO ini.
      const { count, error: countError } = await adminClient
        .from('production_batches')
        .select('production_batch_id', { count: 'exact', head: true })
        .eq('work_order_id', workOrderId);
      if (countError) return { status: 500, body: { error: countError.message } };
      const sequence = (count ?? 0) + 1;
      batchNumber = `WO-${String(workOrderId).padStart(4, '0')}-B${String(sequence).padStart(3, '0')}`;
    }

    const { data: inserted, error: insertError } = await adminClient
      .from('production_batches')
      .insert([
        {
          company_id: appUser.company_id,
          work_order_id: workOrderId,
          batch_number: batchNumber,
          shift_id: shiftId,
          planned_qty: plannedQty,
          planned_date: plannedDate,
          uom,
          status: 'planned'
        }
      ])
      .select('production_batch_id, batch_number, planned_qty, planned_date, uom, status')
      .single();

    if (insertError || !inserted) {
      return { status: 500, body: { error: insertError?.message ?? 'Gagal membuat batch produksi.' } };
    }

    return { status: 200, body: { success: true, batch: inserted } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

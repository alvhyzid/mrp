import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canRecordStepProgress } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const stepStatuses = ['pending', 'in_progress', 'completed'];

// Satu baris "berjalan" (bukan completed) per (production_batch_id, routing_step_id)
// — BUKAN lagi per work_order_id, karena batch-batch dalam 1 shift bisa berada di
// tahap BERBEDA secara bersamaan (mis. Batch 1 sedang curing 48 jam, Batch 3 baru
// mixing). Dipanggil ini akan UPDATE baris yang masih berjalan kalau ada, atau
// INSERT baru kalau belum ada sama sekali. Skema tidak punya unique constraint yang
// memaksa ini, jadi pengulangan (mis. tahap diulang) tetap bisa dicatat sebagai
// baris baru begitu baris sebelumnya sudah completed.
export async function recordWorkOrderStepProgress(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canRecordStepProgress(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mencatat progres produksi.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const workOrderId = Number(body.work_order_id);
    const productionBatchId = Number(body.production_batch_id);
    const routingStepId = Number(body.routing_step_id);
    const status = String(body.status ?? '').trim();
    const qtyRecorded = body.qty_recorded === undefined || body.qty_recorded === null || body.qty_recorded === '' ? null : Number(body.qty_recorded);
    const uom = body.uom ? String(body.uom).trim() : null;
    const qtyInput = body.qty_input === undefined || body.qty_input === null || body.qty_input === '' ? null : Number(body.qty_input);
    const uomInput = body.uom_input ? String(body.uom_input).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;
    const qtyReject = body.qty_reject === undefined || body.qty_reject === null || body.qty_reject === '' ? null : Number(body.qty_reject);
    const rejectReason = body.reject_reason ? String(body.reject_reason).trim() : null;

    // Tanggal KEJADIAN (bukan tanggal input) — pola pabrik nyata: progres tahap
    // seringkali baru dicatat 1-2 hari setelah kejadian (mixing tanggal 11
    // dicatat tanggal 13). Default hari ini kalau tidak diisi, TIDAK dipaksa.
    const todayStr = new Date().toISOString().slice(0, 10);
    const recordDateRaw = typeof body.record_date === 'string' ? body.record_date.trim() : '';
    const recordDate = recordDateRaw || todayStr;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
      return { status: 400, body: { error: 'Format tanggal kejadian tidak valid.' } };
    }

    if (!workOrderId || !routingStepId) {
      return { status: 400, body: { error: 'Work Order dan tahap routing wajib diisi.' } };
    }
    if (!productionBatchId) {
      return { status: 400, body: { error: 'Batch produksi wajib dipilih — buat batch dulu kalau belum ada.' } };
    }
    if (!stepStatuses.includes(status)) {
      return { status: 400, body: { error: 'Status tahap tidak valid.' } };
    }
    if (recordDate > todayStr) {
      return { status: 400, body: { error: 'Tanggal kejadian tidak boleh di masa depan.' } };
    }
    if (qtyReject !== null && (!Number.isFinite(qtyReject) || qtyReject < 0)) {
      return { status: 400, body: { error: 'Jumlah reject tidak boleh negatif.' } };
    }
    if (qtyReject !== null && qtyInput !== null && qtyReject > qtyInput) {
      return { status: 400, body: { error: 'Jumlah reject tidak boleh lebih besar dari jumlah input tahap ini.' } };
    }
    // Konsistensi dengan susut proses -- reject adalah SEBAGIAN dari total susut
    // (input - output baik), bukan tambahan terpisah di luar itu. Kalau reject
    // lebih besar dari total susut yang tercatat, datanya tidak masuk akal
    // (mis. input 100, output baik 95, reject 20 -> 95+20=115 > 100 input).
    if (qtyReject !== null && qtyInput !== null && qtyRecorded !== null) {
      const totalShrinkage = qtyInput - qtyRecorded;
      if (qtyReject > totalShrinkage + 0.0001) {
        return {
          status: 400,
          body: { error: `Jumlah reject (${qtyReject}) tidak konsisten — total susut tahap ini (input ${qtyInput} − output ${qtyRecorded} = ${totalShrinkage}) lebih kecil dari reject yang dicatat.` }
        };
      }
    }

    const adminClient = getAdminClient();

    const { data: wo, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, company_id')
      .eq('work_order_id', workOrderId)
      .maybeSingle();
    if (woError) return { status: 500, body: { error: woError.message } };
    if (!wo || wo.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Work Order tidak ditemukan.' } };
    }

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, work_order_id, company_id, created_at')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id || batch.work_order_id !== workOrderId) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan untuk Work Order ini.' } };
    }

    const batchCreatedDateStr = String(batch.created_at).slice(0, 10);
    if (recordDate < batchCreatedDateStr) {
      return { status: 400, body: { error: `Tanggal kejadian tidak boleh sebelum batch ini dibuat (${batchCreatedDateStr}).` } };
    }
    // Peringatan LEMBUT (bukan blokir) kalau tanggal kejadian jauh ke belakang
    // -- staf tetap bisa mencatat (mis. catch-up mingguan), cuma diingatkan
    // supaya sadar ini backdate jauh, bukan salah ketik tahun.
    const daysAgo = Math.floor((new Date(`${todayStr}T00:00:00Z`).getTime() - new Date(`${recordDate}T00:00:00Z`).getTime()) / 86400000);
    const dateWarning = daysAgo > 7 ? `Tanggal kejadian ${recordDate} adalah ${daysAgo} hari yang lalu — pastikan ini benar, bukan salah input.` : null;

    const { data: step, error: stepError } = await adminClient
      .from('routing_steps')
      .select('routing_step_id')
      .eq('routing_step_id', routingStepId)
      .maybeSingle();
    if (stepError) return { status: 500, body: { error: stepError.message } };
    if (!step) return { status: 400, body: { error: 'Tahap routing tidak ditemukan.' } };

    const { data: existing, error: existingError } = await adminClient
      .from('work_order_step_progress')
      .select('work_order_step_progress_id, status, started_at')
      .eq('production_batch_id', productionBatchId)
      .eq('routing_step_id', routingStepId)
      .neq('status', 'completed')
      .order('work_order_step_progress_id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };

    // Jam-menit dari waktu SEKARANG dilekatkan ke tanggal KEJADIAN yang dipilih
    // staf -- supaya isian hari-yang-sama (paling umum) tetap presisi seperti
    // sebelumnya, TAPI stempel waktu tetap jatuh di tanggal yang benar untuk
    // isian backdate. K8 (learnFromBatchCore.ts) punya batas atas kewajaran
    // durasi terpisah untuk menyaring kasus start & complete dicatat di tanggal
    // backdate yang BEDA (rentang berhari-hari bukan durasi aktif sungguhan).
    const recordDateTime = new Date(`${recordDate}T${new Date().toISOString().slice(11)}`).toISOString();

    if (existing) {
      const { error: updateError } = await adminClient
        .from('work_order_step_progress')
        .update({
          status,
          qty_input: qtyInput,
          uom_input: uomInput,
          qty_recorded: qtyRecorded,
          qty_reject: qtyReject,
          reject_reason: rejectReason,
          uom,
          notes,
          started_at: existing.started_at ?? (status !== 'pending' ? recordDateTime : null),
          completed_at: status === 'completed' ? recordDateTime : null
        })
        .eq('work_order_step_progress_id', existing.work_order_step_progress_id);
      if (updateError) return { status: 500, body: { error: updateError.message } };
    } else {
      const { error: insertError } = await adminClient.from('work_order_step_progress').insert([
        {
          work_order_id: workOrderId,
          production_batch_id: productionBatchId,
          routing_step_id: routingStepId,
          qty_reject: qtyReject,
          reject_reason: rejectReason,
          status,
          qty_input: qtyInput,
          uom_input: uomInput,
          qty_recorded: qtyRecorded,
          uom,
          notes,
          started_at: status !== 'pending' ? recordDateTime : null,
          completed_at: status === 'completed' ? recordDateTime : null
        }
      ]);
      if (insertError) return { status: 500, body: { error: insertError.message } };
    }

    return { status: 200, body: { success: true, warning: dateWarning } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

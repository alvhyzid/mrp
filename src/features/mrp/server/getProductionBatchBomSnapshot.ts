import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Sesi 6A (21 Agu 2026) — "Kebutuhan Bahan" yang ditampilkan saat mencatat
// pemakaian bahan untuk batch TERTENTU wajib memakai baris BOM BEKU milik
// batch itu (kalau sudah dimulai), BUKAN bom_lines hidup — supaya mengedit BOM
// hari ini tidak diam-diam mengubah angka referensi utk batch yang sedang
// berjalan/sudah selesai (lihat startProductionBatch.ts utk kapan snapshot
// diambil). Batch yang BELUM dimulai (has_snapshot:false) tetap dilempar balik
// ke pemanggil supaya halaman jatuh balik ke bom_lines hidup seperti biasa.
export async function getProductionBatchBomSnapshot(request: NextRequest, productionBatchId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: batch, error: batchError } = await adminClient
      .from('production_batches')
      .select('production_batch_id, company_id, routing_snapshot_taken_at, snapshotted_buffer_percentage')
      .eq('production_batch_id', productionBatchId)
      .maybeSingle();
    if (batchError) return { status: 500, body: { error: batchError.message } };
    if (!batch || batch.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Batch produksi tidak ditemukan di perusahaan Anda.' } };
    }

    if (!batch.routing_snapshot_taken_at) {
      return { status: 200, body: { has_snapshot: false, buffer_percentage: null, lines: [] } };
    }

    const { data: lines, error: linesError } = await adminClient
      .from('production_batch_bom_line_snapshots')
      .select('component_item_id, qty_per_unit_output, uom')
      .eq('production_batch_id', productionBatchId);
    if (linesError) return { status: 500, body: { error: linesError.message } };

    const componentItemIds = Array.from(new Set((lines ?? []).map((l) => l.component_item_id)));
    const { data: items, error: itemsError } = componentItemIds.length
      ? await adminClient.from('items').select('item_id, item_code, name').in('item_id', componentItemIds)
      : { data: [] as { item_id: number; item_code: string; name: string }[], error: null };
    if (itemsError) return { status: 500, body: { error: itemsError.message } };
    const itemsById = new Map((items ?? []).map((i) => [i.item_id, i]));

    return {
      status: 200,
      body: {
        has_snapshot: true,
        buffer_percentage: batch.snapshotted_buffer_percentage,
        lines: (lines ?? []).map((line) => ({
          component_item_id: line.component_item_id,
          component_item_code: itemsById.get(line.component_item_id)?.item_code ?? null,
          component_item_name: itemsById.get(line.component_item_id)?.name ?? null,
          qty_per_unit_output: line.qty_per_unit_output,
          uom: line.uom
        }))
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

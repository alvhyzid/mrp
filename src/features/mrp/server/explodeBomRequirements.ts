import type { SupabaseClient } from '@supabase/supabase-js';

export interface BlockingStage {
  sequence_no: number;
  step_name: string;
}

export interface MaterialShortage {
  item_id: number;
  item_code: string;
  name: string;
  needed: number;
  available: number;
  short: number;
  blocking_stage: BlockingStage | null;
}

export interface ComponentToProduce {
  item_id: number;
  item_code: string;
  name: string;
  qty_needed: number;
  blocking_stage: BlockingStage | null;
}

export interface ExplodeBomResult {
  shortages: MaterialShortage[];
  toProduce: ComponentToProduce[];
  // Tahap PERTAMA di routing item induk (sequence_no terkecil) -- shortage/
  // toProduce dengan blocking_stage bertepatan dengan ini yang memblokir MULAI-nya
  // produksi (lihat getPlanningFeasibility.ts). null kalau item induk tidak punya
  // routing sama sekali (semua komponen dianggap memblokir mulai, seperti dulu).
  firstStageSequenceNo: number | null;
}

// Deteksi Konflik Perencanaan (Fase Produksi Nyata, P2) — sebelum ini, kekurangan
// bahan HANYA dicek 1 level (komponen langsung BOM item ini) di
// getPlanningFeasibility.ts — cukup untuk mendeteksi bahan stok 0, TAPI
// melewatkan bahan yang cukup di level atas tapi ternyata TIDAK CUKUP kalau
// dihitung total pemakaiannya sampai ke premix (mis. Maltodextrin dipakai
// LANGSUNG di adonan Drinkme DAN sebagai carrier di dalam 5 premix WIP
// sekaligus — baru ketahuan kurang kalau kedua pemakaian itu dijumlah, bukan
// dicek terpisah per level). Ditemukan lewat analisis manual SAS005 sesi
// sebelumnya (Maltodextrin: kebutuhan ±1050kg vs stok 139kg) — sekarang jadi
// kode nyata, bukan skrip sekali pakai.
//
// Item WIP yang punya BOM aktif sendiri TIDAK dihitung sebagai "kekurangan beli"
// — item itu ditandai "perlu diproduksi" (componentsToProduce), lalu dijabarkan
// lagi ke bahan penyusunnya. Leaf (item tanpa BOM aktif) yang kebutuhannya
// melebihi stok company-wide (semua plant, status available) itulah yang jadi
// materialShortages.
//
// SADAR-TAHAP (20 Agu 2026, perbaikan model kelayakan): setiap bom_line di BOM
// item PALING ATAS (top-level) boleh menunjuk routing_step_id -- tahap routing
// item itu sendiri yang mulai memakai komponen itu. Tahap itu DIWARISKAN ke
// SELURUH bahan yang ditemukan di bawahnya lewat rekursi (mis. bahan mentah di
// dalam sebuah premix WIP mewarisi tahap dari bom_line premix itu SENDIRI di BOM
// top-level -- bukan dari bom_line premix itu di dalam BOM-nya sendiri, karena
// itu proses produksi premix yang terpisah, bukan bagian dari routing top-level
// ini). bom_line top-level yang routing_step_id-nya NULL (belum diklasifikasi)
// diperlakukan sebagai tahap PERTAMA routing -- perilaku lama (memblokir mulai
// produksi) dipertahankan persis supaya BOM yang belum diisi tidak ada regresi.
export async function explodeBomRequirements(
  adminClient: SupabaseClient,
  companyId: number,
  topItemId: number,
  qtyOrdered: number
): Promise<ExplodeBomResult> {
  const { data: items } = await adminClient.from('items').select('item_id, item_code, name').eq('company_id', companyId);
  const itemById = new Map((items ?? []).map((i) => [i.item_id, i]));

  const { data: activeBoms } = await adminClient.from('boms').select('bom_id, parent_item_id').eq('company_id', companyId).eq('status', 'active');
  const bomByParent = new Map((activeBoms ?? []).map((b) => [b.parent_item_id, b]));

  const bomIds = (activeBoms ?? []).map((b) => b.bom_id);
  const { data: bomLines } = bomIds.length
    ? await adminClient.from('bom_lines').select('bom_id, component_item_id, qty_per_unit_output, routing_step_id').in('bom_id', bomIds)
    : { data: [] as { bom_id: number; component_item_id: number; qty_per_unit_output: number; routing_step_id: number | null }[] };
  const linesByBom = new Map<number, { bom_id: number; component_item_id: number; qty_per_unit_output: number; routing_step_id: number | null }[]>();
  for (const line of bomLines ?? []) {
    if (!linesByBom.has(line.bom_id)) linesByBom.set(line.bom_id, []);
    linesByBom.get(line.bom_id)!.push(line);
  }

  const { data: lots } = await adminClient.from('lots').select('item_id, quantity_on_hand').eq('company_id', companyId).eq('status', 'available');
  const stockByItem = new Map<number, number>();
  for (const row of lots ?? []) {
    stockByItem.set(row.item_id, (stockByItem.get(row.item_id) ?? 0) + Number(row.quantity_on_hand));
  }

  // Tahap routing item PALING ATAS saja yang relevan untuk pelabelan blocking
  // stage -- tiap item WIP di bawahnya punya proses produksi + routing sendiri
  // yang terpisah (sudah ditangani lewat componentsToProduce + lead time-nya
  // sendiri di tempat lain), bukan bagian dari routing top-level ini.
  const { data: topRouting } = await adminClient.from('routings').select('routing_id').eq('company_id', companyId).eq('item_id', topItemId).maybeSingle();
  const stepById = new Map<number, BlockingStage>();
  let firstStageSequenceNo: number | null = null;
  if (topRouting) {
    const { data: steps } = await adminClient.from('routing_steps').select('routing_step_id, sequence_no, step_name').eq('routing_id', topRouting.routing_id);
    for (const step of steps ?? []) {
      stepById.set(step.routing_step_id, { sequence_no: step.sequence_no, step_name: step.step_name });
      if (firstStageSequenceNo === null || step.sequence_no < firstStageSequenceNo) firstStageSequenceNo = step.sequence_no;
    }
  }
  const firstStage: BlockingStage | null = firstStageSequenceNo !== null ? Array.from(stepById.values()).find((s) => s.sequence_no === firstStageSequenceNo) ?? null : null;

  const requirement = new Map<number, number>();
  const produceNeed = new Map<number, number>();
  // Kalau 1 item ditemukan lewat lebih dari 1 jalur (mis. bahan langsung DAN
  // lewat premix -- kasus Maltodextrin), ambil tahap PALING AWAL di antara semua
  // jalur itu (paling konservatif -- bahan itu genuinely dibutuhkan sejak tahap
  // paling awal manapun yang memakainya).
  const stageByRequirementItem = new Map<number, BlockingStage | null>();
  const stageByProduceItem = new Map<number, BlockingStage | null>();
  const visiting = new Set<number>();

  function stageIsEarlier(a: BlockingStage | null, b: BlockingStage | null): boolean {
    // null (belum diklasifikasi) == tahap pertama untuk keperluan perbandingan.
    const seqA = a?.sequence_no ?? firstStageSequenceNo ?? -Infinity;
    const seqB = b?.sequence_no ?? firstStageSequenceNo ?? -Infinity;
    return seqA < seqB;
  }

  function explode(itemId: number, qtyNeeded: number, inheritedStage: BlockingStage | null, isTopLevel: boolean) {
    // Jaga-jaga siklus BOM (seharusnya sudah dicegah bom_component_creates_cycle
    // saat BOM dibuat, tapi eksplosi ini tidak boleh infinite loop kalau ada
    // data lama yang lolos sebelum guard itu ada).
    if (visiting.has(itemId)) return;
    visiting.add(itemId);

    const bom = bomByParent.get(itemId);
    if (bom) {
      if (itemId !== topItemId) {
        produceNeed.set(itemId, (produceNeed.get(itemId) ?? 0) + qtyNeeded);
        const existing = stageByProduceItem.has(itemId) ? stageByProduceItem.get(itemId)! : null;
        if (!stageByProduceItem.has(itemId) || stageIsEarlier(inheritedStage, existing)) {
          stageByProduceItem.set(itemId, inheritedStage);
        }
      }
      const lines = linesByBom.get(bom.bom_id) ?? [];
      for (const line of lines) {
        // Tahap cuma di-resolve dari bom_line MILIK ITEM PALING ATAS itu sendiri
        // -- level di bawahnya mewarisi tahap yang sama (lihat komentar di atas
        // fungsi ini).
        const lineStage: BlockingStage | null = isTopLevel ? (line.routing_step_id ? stepById.get(line.routing_step_id) ?? null : null) : inheritedStage;
        explode(line.component_item_id, qtyNeeded * Number(line.qty_per_unit_output), lineStage, false);
      }
    } else {
      requirement.set(itemId, (requirement.get(itemId) ?? 0) + qtyNeeded);
      const existing = stageByRequirementItem.has(itemId) ? stageByRequirementItem.get(itemId)! : null;
      if (!stageByRequirementItem.has(itemId) || stageIsEarlier(inheritedStage, existing)) {
        stageByRequirementItem.set(itemId, inheritedStage);
      }
    }
    visiting.delete(itemId);
  }

  explode(topItemId, qtyOrdered, firstStage, true);

  const shortages: MaterialShortage[] = [];
  for (const [itemId, needed] of requirement) {
    const available = stockByItem.get(itemId) ?? 0;
    const short = needed - available;
    if (short > 0.0001) {
      const item = itemById.get(itemId);
      if (!item) continue;
      shortages.push({ item_id: itemId, item_code: item.item_code, name: item.name, needed, available, short, blocking_stage: stageByRequirementItem.get(itemId) ?? null });
    }
  }
  shortages.sort((a, b) => b.short - a.short);

  const toProduce: ComponentToProduce[] = [];
  for (const [itemId, qty] of produceNeed) {
    const item = itemById.get(itemId);
    if (!item) continue;
    toProduce.push({ item_id: itemId, item_code: item.item_code, name: item.name, qty_needed: qty, blocking_stage: stageByProduceItem.get(itemId) ?? null });
  }

  return { shortages, toProduce, firstStageSequenceNo };
}

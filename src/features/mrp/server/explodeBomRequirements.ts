import type { SupabaseClient } from '@supabase/supabase-js';

export interface MaterialShortage {
  item_id: number;
  item_code: string;
  name: string;
  needed: number;
  available: number;
  short: number;
}

export interface ComponentToProduce {
  item_id: number;
  item_code: string;
  name: string;
  qty_needed: number;
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
export async function explodeBomRequirements(
  adminClient: SupabaseClient,
  companyId: number,
  topItemId: number,
  qtyOrdered: number
): Promise<{ shortages: MaterialShortage[]; toProduce: ComponentToProduce[] }> {
  const { data: items } = await adminClient.from('items').select('item_id, item_code, name').eq('company_id', companyId);
  const itemById = new Map((items ?? []).map((i) => [i.item_id, i]));

  const { data: activeBoms } = await adminClient.from('boms').select('bom_id, parent_item_id').eq('company_id', companyId).eq('status', 'active');
  const bomByParent = new Map((activeBoms ?? []).map((b) => [b.parent_item_id, b]));

  const bomIds = (activeBoms ?? []).map((b) => b.bom_id);
  const { data: bomLines } = bomIds.length
    ? await adminClient.from('bom_lines').select('bom_id, component_item_id, qty_per_unit_output').in('bom_id', bomIds)
    : { data: [] as { bom_id: number; component_item_id: number; qty_per_unit_output: number }[] };
  const linesByBom = new Map<number, { bom_id: number; component_item_id: number; qty_per_unit_output: number }[]>();
  for (const line of bomLines ?? []) {
    if (!linesByBom.has(line.bom_id)) linesByBom.set(line.bom_id, []);
    linesByBom.get(line.bom_id)!.push(line);
  }

  const { data: lots } = await adminClient.from('lots').select('item_id, quantity_on_hand').eq('company_id', companyId).eq('status', 'available');
  const stockByItem = new Map<number, number>();
  for (const row of lots ?? []) {
    stockByItem.set(row.item_id, (stockByItem.get(row.item_id) ?? 0) + Number(row.quantity_on_hand));
  }

  const requirement = new Map<number, number>();
  const produceNeed = new Map<number, number>();
  const visiting = new Set<number>();

  function explode(itemId: number, qtyNeeded: number) {
    // Jaga-jaga siklus BOM (seharusnya sudah dicegah bom_component_creates_cycle
    // saat BOM dibuat, tapi eksplosi ini tidak boleh infinite loop kalau ada
    // data lama yang lolos sebelum guard itu ada).
    if (visiting.has(itemId)) return;
    visiting.add(itemId);

    const bom = bomByParent.get(itemId);
    if (bom) {
      if (itemId !== topItemId) {
        produceNeed.set(itemId, (produceNeed.get(itemId) ?? 0) + qtyNeeded);
      }
      const lines = linesByBom.get(bom.bom_id) ?? [];
      for (const line of lines) {
        explode(line.component_item_id, qtyNeeded * Number(line.qty_per_unit_output));
      }
    } else {
      requirement.set(itemId, (requirement.get(itemId) ?? 0) + qtyNeeded);
    }
    visiting.delete(itemId);
  }

  explode(topItemId, qtyOrdered);

  const shortages: MaterialShortage[] = [];
  for (const [itemId, needed] of requirement) {
    const available = stockByItem.get(itemId) ?? 0;
    const short = needed - available;
    if (short > 0.0001) {
      const item = itemById.get(itemId);
      if (!item) continue;
      shortages.push({ item_id: itemId, item_code: item.item_code, name: item.name, needed, available, short });
    }
  }
  shortages.sort((a, b) => b.short - a.short);

  const toProduce: ComponentToProduce[] = [];
  for (const [itemId, qty] of produceNeed) {
    const item = itemById.get(itemId);
    if (!item) continue;
    toProduce.push({ item_id: itemId, item_code: item.item_code, name: item.name, qty_needed: qty });
  }

  return { shortages, toProduce };
}

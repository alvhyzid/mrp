import type { SupabaseClient } from '@supabase/supabase-js';

// Cek pendahuluan di lapisan aplikasi supaya user dapat pesan error yang jelas
// (400) alih-alih exception mentah dari database (500). Trigger
// guard_bom_line_not_self_referencing di database TETAP jadi penjaga utama/otoritatif
// (lihat migration 20260812180000) — ini cuma lapisan UX tambahan.
export async function findBomCycleError(
  adminClient: SupabaseClient,
  companyId: number,
  parentItemId: number,
  componentItemIds: number[],
  // Saat mengedit BOM yang sudah ada, baris lama BOM ini sendiri dikeluarkan dari
  // graf sebelum dicek — baris itu memang akan diganti, jadi tidak relevan.
  excludeBomId?: number
): Promise<string | null> {
  let bomsQuery = adminClient.from('boms').select('bom_id, parent_item_id').eq('company_id', companyId);
  if (excludeBomId) {
    bomsQuery = bomsQuery.neq('bom_id', excludeBomId);
  }
  const { data: boms } = await bomsQuery;
  const bomIds = (boms ?? []).map((bom) => bom.bom_id);

  const { data: lines } = bomIds.length
    ? await adminClient.from('bom_lines').select('bom_id, component_item_id').in('bom_id', bomIds)
    : { data: [] as { bom_id: number; component_item_id: number }[] };

  const bomIdToParent = new Map((boms ?? []).map((bom) => [bom.bom_id, bom.parent_item_id]));
  const adjacency = new Map<number, number[]>();
  for (const line of lines ?? []) {
    const parent = bomIdToParent.get(line.bom_id);
    if (parent === undefined) continue;
    const list = adjacency.get(parent) ?? [];
    list.push(line.component_item_id);
    adjacency.set(parent, list);
  }

  const isReachable = (start: number, target: number): boolean => {
    const visited = new Set<number>();
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === target) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency.get(current) ?? []) stack.push(next);
    }
    return false;
  };

  for (const componentItemId of componentItemIds) {
    if (componentItemId === parentItemId) {
      return 'Item komponen tidak boleh sama dengan item induk BOM (referensi ke diri sendiri).';
    }
    if (isReachable(componentItemId, parentItemId)) {
      return `Item komponen ini sudah membutuhkan item induk BOM ini lewat resep lain (langsung atau tidak langsung) — tidak boleh dipakai, akan membuat siklus.`;
    }
  }

  return null;
}

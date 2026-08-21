import type { SupabaseClient } from '@supabase/supabase-js';

export interface StandardCostResult {
  materialCostPerUnit: number;
  packagingCostPerUnit: number;
  // false kalau ADA bahan/kemasan (leaf, tanpa BOM sendiri) yang belum punya
  // items.standard_cost -- materialCostPerUnit/packagingCostPerUnit di atas
  // TETAP dihitung dari yang tersedia (bukan dibuang total), TAPI harus
  // ditampilkan sebagai "belum lengkap", bukan dianggap angka final yang bisa
  // dipercaya penuh (prinsip "dilarang mengarang angka" -- Margin Watch,
  // 20 Agu 2026).
  complete: boolean;
  missingCostItemCodes: string[];
  // Item YANG ADA harganya tapi ditandai items.cost_unverified=true (25 Agu 2026,
  // formula resmi Gummy Zala V2/Drinkme V1) -- beda dari missingCostItemCodes:
  // di sini harga ADA dan IKUT dihitung, cuma belum dikonfirmasi purchasing.
  unverifiedCostItemCodes: string[];
  // Alur 1 (3.5, 21 Agu 2026) -- item yang items.standard_cost-nya NULL, tapi
  // ADA harga acuan supplier (supplier_item_prices) sehingga tetap DIESTIMASI
  // (bukan langsung dianggap "belum lengkap"). Estimasi ini BOLEH tampil di
  // preview Margin Watch, TAPI baseline TIDAK BOLEH dikunci selama daftar ini
  // tidak kosong -- ditegakkan di lockMarginBaseline.ts.
  estimatedFromReferencePriceItemCodes: string[];
}

// Margin Watch Lapis 1 (baseline) -- kebalikan dari explodeBomRequirements.ts
// (yang menjumlah KEBUTUHAN vs STOK untuk qty pesanan tertentu): di sini
// menjumlah BIAYA STANDAR per 1 unit output, dari items.standard_cost tiap
// bahan/kemasan LEAF (item tanpa BOM aktif sendiri) yang ditemukan lewat
// rekursi BOM yang SAMA. WIP dengan BOM aktif sendiri tidak dihitung biayanya
// langsung -- direkursi ke bahan penyusunnya (biaya WIP = jumlah biaya
// penyusunnya, konsisten dengan bagaimana BOM 2-tingkat Drinkme kini bekerja).
export async function computeStandardCostPerUnit(adminClient: SupabaseClient, companyId: number, topItemId: number): Promise<StandardCostResult> {
  const { data: items } = await adminClient.from('items').select('item_id, item_code, type, standard_cost, cost_unverified').eq('company_id', companyId);
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

  const leafNeeded = new Map<number, number>();
  const visiting = new Set<number>();

  function explode(itemId: number, qtyNeeded: number) {
    if (visiting.has(itemId)) return;
    visiting.add(itemId);
    const bom = bomByParent.get(itemId);
    if (bom) {
      for (const line of linesByBom.get(bom.bom_id) ?? []) {
        explode(line.component_item_id, qtyNeeded * Number(line.qty_per_unit_output));
      }
    } else {
      leafNeeded.set(itemId, (leafNeeded.get(itemId) ?? 0) + qtyNeeded);
    }
    visiting.delete(itemId);
  }
  explode(topItemId, 1);

  let materialCostPerUnit = 0;
  let packagingCostPerUnit = 0;
  const missingCostItemCodes: string[] = [];
  const unverifiedCostItemCodes: string[] = [];
  const estimatedFromReferencePriceItemCodes: string[] = [];

  // Alur 1 (3.5) -- untuk item TANPA standard_cost, cek harga acuan supplier
  // sebagai ESTIMASI TERAKHIR sebelum menyerah ke "belum lengkap". Kalau ada
  // lebih dari satu supplier, pakai yang paling MURAH -- perkiraan margin
  // seharusnya konservatif (jangan optimis), bukan asal ambil satu.
  const missingItemIds = Array.from(leafNeeded.keys()).filter((id) => {
    const item = itemById.get(id);
    return item && (item.standard_cost === null || item.standard_cost === undefined);
  });
  const referencePriceByItemId = new Map<number, number>();
  if (missingItemIds.length > 0) {
    const { data: refPrices } = await adminClient
      .from('supplier_item_prices')
      .select('item_id, reference_price')
      .eq('company_id', companyId)
      .in('item_id', missingItemIds)
      .not('reference_price', 'is', null);
    for (const row of refPrices ?? []) {
      const current = referencePriceByItemId.get(row.item_id);
      const price = Number(row.reference_price);
      if (current === undefined || price < current) referencePriceByItemId.set(row.item_id, price);
    }
  }

  for (const [itemId, qty] of leafNeeded) {
    const item = itemById.get(itemId);
    if (!item) continue;
    if (item.standard_cost === null || item.standard_cost === undefined) {
      const referencePrice = referencePriceByItemId.get(itemId);
      if (referencePrice === undefined) {
        missingCostItemCodes.push(item.item_code);
        continue;
      }
      estimatedFromReferencePriceItemCodes.push(item.item_code);
      const cost = qty * referencePrice;
      if (item.type === 'packaging') packagingCostPerUnit += cost;
      else materialCostPerUnit += cost;
      continue;
    }
    if (item.cost_unverified) unverifiedCostItemCodes.push(item.item_code);
    const cost = qty * Number(item.standard_cost);
    if (item.type === 'packaging') packagingCostPerUnit += cost;
    else materialCostPerUnit += cost;
  }

  return {
    materialCostPerUnit,
    packagingCostPerUnit,
    complete: missingCostItemCodes.length === 0,
    missingCostItemCodes,
    unverifiedCostItemCodes,
    estimatedFromReferencePriceItemCodes
  };
}

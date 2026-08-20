import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { computeStandardCostPerUnit } from '@/features/mrp';
import { computeStandardLaborCostPerUnit } from '@/features/mrp';
import { formatCurrency, formatNumberId } from '@/lib/currency';

export interface KpiComputeResult {
  value: number | null;
  periodStart: string;
  periodEnd: string;
  complete: boolean;
  formula: string;
  inputs: { label: string; value: string }[];
  sourceDocument?: string;
}

function calendarMonthBounds(reference: Date): { start: string; end: string } {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function isoWeekBounds(reference: Date): { start: string; end: string } {
  const day = reference.getUTCDay() === 0 ? 7 : reference.getUTCDay(); // Senin=1..Minggu=7
  const monday = new Date(reference);
  monday.setUTCDate(reference.getUTCDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

// Margin kontribusi & Laba Operasional bulanan PERSIS memakai RPC yang SAMA sudah
// dipakai OperatingProfitPage -- SATU sumber kebenaran, bukan dihitung ulang beda
// jalur (prinsip "rekonsiliasi angka finansial harus persis", lihat memory sesi).
// Dipanggil lewat client user (bukan admin client) karena get_monthly_operating_profit
// mengecek jwt_company_id()/jwt_can_view_financial_data() di dalam fungsinya sendiri.
export async function fetchOperatingProfitRpc(
  request: NextRequest,
  companyId: number
): Promise<{ total_margin: number; overhead: number; operating_profit: number; period_start: string; period_end: string } | null> {
  const authHeader = request.headers.get('authorization');
  const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader ?? '' } }
  });
  const now = new Date();
  const { data, error } = await userClient
    .rpc('get_monthly_operating_profit', { p_company_id: companyId, p_year: now.getUTCFullYear(), p_month: now.getUTCMonth() + 1 })
    .single();
  if (error) return null;
  return data as { total_margin: number; overhead: number; operating_profit: number; period_start: string; period_end: string };
}

export function computeMarginKontribusiFromRpc(rpc: Awaited<ReturnType<typeof fetchOperatingProfitRpc>>): KpiComputeResult {
  if (!rpc) {
    const { start, end } = calendarMonthBounds(new Date());
    return { value: null, periodStart: start, periodEnd: end, complete: false, formula: '', inputs: [] };
  }
  return {
    value: Number(rpc.total_margin),
    periodStart: rpc.period_start,
    periodEnd: rpc.period_end,
    complete: true,
    formula: 'Σ (qty_shipped × (harga jual − unit_cost lot dikirim)) untuk semua baris pengiriman berstatus terkirim/diterima dalam periode ini -- PERSIS rumus yang ditampilkan di Laba Operasional (get_monthly_operating_profit).',
    inputs: [{ label: 'Periode', value: `${rpc.period_start} – ${rpc.period_end}` }],
    sourceDocument: 'get_monthly_operating_profit (migration 20260821140000)'
  };
}

export function computeLabaOperasionalFromRpc(rpc: Awaited<ReturnType<typeof fetchOperatingProfitRpc>>): KpiComputeResult {
  if (!rpc) {
    const { start, end } = calendarMonthBounds(new Date());
    return { value: null, periodStart: start, periodEnd: end, complete: false, formula: '', inputs: [] };
  }
  return {
    value: Number(rpc.operating_profit),
    periodStart: rpc.period_start,
    periodEnd: rpc.period_end,
    complete: true,
    formula: 'Margin Kontribusi (Realized) − Overhead SDM bulanan, periode yang sama dengan kartu Margin Kontribusi.',
    inputs: [
      { label: 'Margin kontribusi', value: formatCurrency(Number(rpc.total_margin), { maxDecimals: 0 }) },
      { label: 'Overhead SDM', value: formatCurrency(Number(rpc.overhead), { maxDecimals: 0 }) }
    ],
    sourceDocument: 'get_monthly_operating_profit (migration 20260821140000)'
  };
}

// Biaya produksi per unit per produk -- rata-rata SEDERHANA lintas item finished_good
// aktif berBOM aktif & data biaya lengkap (bukan tertimbang qty terjual -- keterbatasan
// disadari, dicatat di HANDOFF). Rincian per produk ada di `inputs` untuk transparansi.
export async function computeBiayaProduksiPerUnit(adminClient: SupabaseClient, companyId: number): Promise<KpiComputeResult> {
  const { start, end } = calendarMonthBounds(new Date());
  const { data: items } = await adminClient.from('items').select('item_id, item_code, name').eq('company_id', companyId).eq('type', 'finished_good').eq('is_active', true);

  const perProduct: { code: string; name: string; cost: number }[] = [];
  let incompleteCount = 0;
  for (const item of items ?? []) {
    const cost = await computeStandardCostPerUnit(adminClient, companyId, item.item_id);
    const labor = await computeStandardLaborCostPerUnit(adminClient, companyId, item.item_id);
    if (!cost.complete || !labor.complete) {
      incompleteCount += 1;
      continue;
    }
    perProduct.push({ code: item.item_code, name: item.name, cost: cost.materialCostPerUnit + cost.packagingCostPerUnit + labor.costPerUnit });
  }

  if (perProduct.length === 0) {
    return { value: null, periodStart: start, periodEnd: end, complete: false, formula: '', inputs: [] };
  }

  const average = perProduct.reduce((sum, p) => sum + p.cost, 0) / perProduct.length;

  return {
    value: average,
    periodStart: start,
    periodEnd: end,
    complete: incompleteCount === 0,
    formula:
      'Rata-rata SEDERHANA (bukan tertimbang qty terjual) dari biaya standar per unit (bahan + kemasan + SDM, rumus sama Margin Watch) lintas SEMUA produk jadi aktif yang datanya lengkap. Produk dengan biaya standar belum lengkap dikecualikan dari rata-rata, dilaporkan jumlahnya.',
    inputs: perProduct.map((p) => ({ label: `${p.code} — ${p.name}`, value: formatCurrency(p.cost) })).concat(incompleteCount > 0 ? [{ label: 'Produk dikecualikan (biaya belum lengkap)', value: String(incompleteCount) }] : []),
    sourceDocument: 'computeStandardCostPerUnit.ts + computeStandardLaborCostPerUnit.ts'
  };
}

// Yield per tahap per produk -- rata-rata SEDERHANA total_yield_pct (rumus PERSIS
// getBatchYieldSummary.ts: output tahap terakhir ÷ input tahap pertama) lintas SEMUA
// batch berstatus completed dalam periode (minggu berjalan).
export async function computeYieldPerTahapProduk(adminClient: SupabaseClient, companyId: number): Promise<KpiComputeResult> {
  const { start, end } = isoWeekBounds(new Date());

  const { data: batches } = await adminClient
    .from('production_batches')
    .select('production_batch_id, batch_number, work_order_id, completed_at')
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('completed_at', `${start}T00:00:00Z`)
    .lte('completed_at', `${end}T23:59:59Z`);

  if (!batches || batches.length === 0) {
    return { value: null, periodStart: start, periodEnd: end, complete: true, formula: '', inputs: [{ label: 'Batch selesai periode ini', value: '0' }] };
  }

  const workOrderIds = Array.from(new Set(batches.map((b) => b.work_order_id)));
  const { data: workOrders } = await adminClient.from('work_orders').select('work_order_id, item_id, routing_id').in('work_order_id', workOrderIds);
  const woById = new Map((workOrders ?? []).map((w) => [w.work_order_id, w]));

  const itemIds = Array.from(new Set((workOrders ?? []).map((w) => w.item_id)));
  const { data: items } = itemIds.length ? await adminClient.from('items').select('item_id, item_code').in('item_id', itemIds) : { data: [] as { item_id: number; item_code: string }[] };
  const itemById = new Map((items ?? []).map((i) => [i.item_id, i]));

  const routingIds = Array.from(new Set((workOrders ?? []).map((w) => w.routing_id).filter((id): id is number => !!id)));
  const { data: routingSteps } = routingIds.length
    ? await adminClient.from('routing_steps').select('routing_step_id, routing_id, sequence_no').in('routing_id', routingIds).order('sequence_no', { ascending: true })
    : { data: [] as { routing_step_id: number; routing_id: number; sequence_no: number }[] };
  const stepsByRouting = new Map<number, { routing_step_id: number; sequence_no: number }[]>();
  for (const s of routingSteps ?? []) {
    if (!stepsByRouting.has(s.routing_id)) stepsByRouting.set(s.routing_id, []);
    stepsByRouting.get(s.routing_id)!.push(s);
  }

  const batchIds = batches.map((b) => b.production_batch_id);
  const { data: progress } = await adminClient
    .from('work_order_step_progress')
    .select('work_order_step_progress_id, production_batch_id, routing_step_id, qty_input, qty_recorded')
    .in('production_batch_id', batchIds)
    .order('work_order_step_progress_id', { ascending: false });

  const latestByBatchStep = new Map<string, { qty_input: number | null; qty_recorded: number | null }>();
  for (const row of progress ?? []) {
    const key = `${row.production_batch_id}:${row.routing_step_id}`;
    if (!latestByBatchStep.has(key)) latestByBatchStep.set(key, { qty_input: row.qty_input, qty_recorded: row.qty_recorded });
  }

  const perProduct: { code: string; batch: string; yieldPct: number }[] = [];
  for (const batch of batches) {
    const wo = woById.get(batch.work_order_id);
    if (!wo || !wo.routing_id) continue;
    const steps = (stepsByRouting.get(wo.routing_id) ?? []).sort((a, b) => a.sequence_no - b.sequence_no);
    if (steps.length === 0) continue;
    const firstStep = latestByBatchStep.get(`${batch.production_batch_id}:${steps[0].routing_step_id}`);
    const lastStep = latestByBatchStep.get(`${batch.production_batch_id}:${steps[steps.length - 1].routing_step_id}`);
    if (!firstStep?.qty_input || firstStep.qty_input <= 0 || lastStep?.qty_recorded == null) continue;
    const yieldPct = Math.round((lastStep.qty_recorded / firstStep.qty_input) * 10000) / 100;
    perProduct.push({ code: itemById.get(wo.item_id)?.item_code ?? '-', batch: batch.batch_number, yieldPct });
  }

  if (perProduct.length === 0) {
    return {
      value: null,
      periodStart: start,
      periodEnd: end,
      complete: true,
      formula: '',
      inputs: [{ label: 'Batch selesai periode ini', value: String(batches.length) }, { label: 'Batch dgn yield terhitung', value: '0' }]
    };
  }

  const average = perProduct.reduce((sum, p) => sum + p.yieldPct, 0) / perProduct.length;

  return {
    value: average,
    periodStart: start,
    periodEnd: end,
    complete: true,
    formula: 'Rata-rata SEDERHANA total_yield_pct (output tahap TERAKHIR ÷ input tahap PERTAMA × 100%, rumus PERSIS getBatchYieldSummary.ts) lintas semua batch berstatus selesai minggu berjalan yang punya data tahap pertama & terakhir lengkap.',
    inputs: perProduct.map((p) => ({ label: `${p.batch} (${p.code})`, value: `${p.yieldPct}%` })),
    sourceDocument: 'getBatchYieldSummary.ts (rumus yang sama, diagregasi lintas batch)'
  };
}

// Nilai persediaan -- Σ (quantity_on_hand × unit_cost) lot berstatus available,
// SEMUA lokasi, company ini. "Uang yang tidur di gudang."
export async function computeNilaiPersediaan(adminClient: SupabaseClient, companyId: number): Promise<KpiComputeResult> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: lots } = await adminClient.from('lots').select('item_id, quantity_on_hand, unit_cost').eq('company_id', companyId).eq('status', 'available');

  let total = 0;
  let missingCostCount = 0;
  const byItem = new Map<number, number>();
  for (const lot of lots ?? []) {
    if (lot.unit_cost === null) {
      missingCostCount += 1;
      continue;
    }
    const value = Number(lot.quantity_on_hand) * Number(lot.unit_cost);
    total += value;
    byItem.set(lot.item_id, (byItem.get(lot.item_id) ?? 0) + value);
  }

  const { data: items } = byItem.size ? await adminClient.from('items').select('item_id, item_code').in('item_id', Array.from(byItem.keys())) : { data: [] as { item_id: number; item_code: string }[] };
  const codeById = new Map((items ?? []).map((i) => [i.item_id, i.item_code]));

  const topItems = Array.from(byItem.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([itemId, value]) => ({ label: codeById.get(itemId) ?? `item ${itemId}`, value: formatCurrency(value, { maxDecimals: 0 }) }));

  return {
    value: total,
    periodStart: today,
    periodEnd: today,
    complete: missingCostCount === 0,
    formula: 'Σ (quantity_on_hand × unit_cost) seluruh lot berstatus available company ini, semua lokasi. Lot tanpa unit_cost dikecualikan (dilaporkan jumlahnya, bukan dianggap 0).',
    inputs: topItems.concat(missingCostCount > 0 ? [{ label: 'Lot tanpa unit_cost (dikecualikan)', value: String(missingCostCount) }] : []),
    sourceDocument: 'lots.unit_cost × lots.quantity_on_hand'
  };
}

export { formatNumberId };

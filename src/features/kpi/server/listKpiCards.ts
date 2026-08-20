import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewKpi } from '@/lib/roles';
import {
  fetchOperatingProfitRpc,
  computeMarginKontribusiFromRpc,
  computeLabaOperasionalFromRpc,
  computeBiayaProduksiPerUnit,
  computeYieldPerTahapProduk,
  computeNilaiPersediaan,
  type KpiComputeResult
} from './computeKpiValues';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

type KpiRegistryRow = {
  kpi_registry_id: number;
  metric_key: string;
  kind: string;
  pillar: string;
  owner_role: string;
  frequency: string;
  target_value: number | null;
  benchmark_value: number | null;
  benchmark_label: string | null;
  benchmark_source: string | null;
  attribution_level: string;
  visibility: string[];
  improvement_levers: string[] | null;
};

async function computeByMetricKey(
  metricKey: string,
  request: NextRequest,
  adminClient: ReturnType<typeof getAdminClient>,
  companyId: number,
  rpcCache: { value: Awaited<ReturnType<typeof fetchOperatingProfitRpc>> | undefined }
): Promise<KpiComputeResult> {
  if (metricKey === 'metric.margin_kontribusi' || metricKey === 'metric.laba_operasional_bulanan') {
    if (rpcCache.value === undefined) rpcCache.value = await fetchOperatingProfitRpc(request, companyId);
    return metricKey === 'metric.margin_kontribusi' ? computeMarginKontribusiFromRpc(rpcCache.value) : computeLabaOperasionalFromRpc(rpcCache.value);
  }
  if (metricKey === 'metric.biaya_produksi_per_unit') return computeBiayaProduksiPerUnit(adminClient, companyId);
  if (metricKey === 'metric.yield_per_tahap_produk') return computeYieldPerTahapProduk(adminClient, companyId);
  if (metricKey === 'metric.nilai_persediaan') return computeNilaiPersediaan(adminClient, companyId);
  throw new Error(`Tidak ada mesin hitung untuk metric_key: ${metricKey}`);
}

// Panel Asal-Usul bertab (revisi §3): kartu KPI dihitung LIVE tiap dibuka lalu
// di-cache ke kpi_snapshots (upsert) -- pola SAMA ai_capability_status/
// computeAiProjectProgress (belum ada cron/Vercel Cron di proyek ini).
export async function listKpiCards(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: registryRows, error: registryError } = await adminClient
      .from('kpi_registry')
      .select('kpi_registry_id, metric_key, kind, pillar, owner_role, frequency, target_value, benchmark_value, benchmark_label, benchmark_source, attribution_level, visibility, improvement_levers')
      .eq('company_id', appUser.company_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (registryError) return { status: 500, body: { error: registryError.message } };

    const visibleRows = ((registryRows ?? []) as KpiRegistryRow[]).filter((kpi) => canViewKpi(appUser.role, kpi));

    const metricKeys = visibleRows.map((r) => r.metric_key);
    const { data: kamusRows } = metricKeys.length
      ? await adminClient.from('kamus_terms').select('term_key, ai_draft, answer_plain, status').eq('company_id', appUser.company_id).in('term_key', metricKeys)
      : { data: [] as { term_key: string; ai_draft: string | null; answer_plain: string | null; status: string }[] };
    const kamusByKey = new Map((kamusRows ?? []).map((k) => [k.term_key, k]));

    const registryIds = visibleRows.map((r) => r.kpi_registry_id);
    const { data: respRows } = registryIds.length
      ? await adminClient.from('kpi_responsibilities').select('kpi_registry_id, role, user_id, responsibility, note').in('kpi_registry_id', registryIds)
      : { data: [] as { kpi_registry_id: number; role: string | null; user_id: number | null; responsibility: string; note: string | null }[] };
    const respByRegistryId = new Map<number, typeof respRows>();
    for (const r of respRows ?? []) {
      if (!respByRegistryId.has(r.kpi_registry_id)) respByRegistryId.set(r.kpi_registry_id, []);
      respByRegistryId.get(r.kpi_registry_id)!.push(r);
    }

    const { data: openActions } = registryIds.length
      ? await adminClient.from('kpi_actions').select('kpi_registry_id, kpi_action_id, finding, action_text, status, due_date').in('kpi_registry_id', registryIds).in('status', ['TERBUKA', 'BERJALAN'])
      : { data: [] as { kpi_registry_id: number; kpi_action_id: number; finding: string; action_text: string; status: string; due_date: string | null }[] };
    const actionsByRegistryId = new Map<number, typeof openActions>();
    for (const a of openActions ?? []) {
      if (!actionsByRegistryId.has(a.kpi_registry_id)) actionsByRegistryId.set(a.kpi_registry_id, []);
      actionsByRegistryId.get(a.kpi_registry_id)!.push(a);
    }

    const rpcCache: { value: Awaited<ReturnType<typeof fetchOperatingProfitRpc>> | undefined } = { value: undefined };

    const cards = [];
    for (const kpi of visibleRows) {
      const result = await computeByMetricKey(kpi.metric_key, request, adminClient, appUser.company_id, rpcCache);

      if (result.value !== null) {
        const inputsHash = Buffer.from(JSON.stringify(result.inputs)).toString('base64').slice(0, 64);
        await adminClient
          .from('kpi_snapshots')
          .upsert(
            { company_id: appUser.company_id, metric_key: kpi.metric_key, period_start: result.periodStart, period_end: result.periodEnd, value: result.value, inputs_hash: inputsHash },
            { onConflict: 'company_id,metric_key,period_start,period_end' }
          );
      }

      const { data: history } = await adminClient
        .from('kpi_snapshots')
        .select('period_start, period_end, value')
        .eq('company_id', appUser.company_id)
        .eq('metric_key', kpi.metric_key)
        .order('period_start', { ascending: false })
        .limit(8);
      const sparkline = (history ?? []).map((h) => ({ period_start: h.period_start, value: h.value !== null ? Number(h.value) : null })).reverse();
      const previousPeriod = (history ?? []).find((h) => h.period_start !== result.periodStart);
      const delta = previousPeriod && previousPeriod.value !== null && result.value !== null ? result.value - Number(previousPeriod.value) : null;

      const kamus = kamusByKey.get(kpi.metric_key);
      const responsibilities = respByRegistryId.get(kpi.kpi_registry_id) ?? [];

      cards.push({
        kpi_registry_id: kpi.kpi_registry_id,
        metric_key: kpi.metric_key,
        kind: kpi.kind,
        pillar: kpi.pillar,
        owner_role: kpi.owner_role,
        frequency: kpi.frequency,
        attribution_level: kpi.attribution_level,
        value: result.value,
        period_start: result.periodStart,
        period_end: result.periodEnd,
        complete: result.complete,
        target_value: kpi.target_value !== null ? Number(kpi.target_value) : null,
        benchmark_value: kpi.benchmark_value !== null ? Number(kpi.benchmark_value) : null,
        benchmark_label: kpi.benchmark_label,
        benchmark_source: kpi.benchmark_source,
        delta,
        sparkline,
        improvement_levers: kpi.improvement_levers ?? [],
        provenance: { formula: result.formula, inputs: result.inputs, sourceDocument: result.sourceDocument },
        definition: kamus ? { termKey: kamus.term_key, businessAnswer: kamus.answer_plain, draft: kamus.ai_draft, status: kamus.status } : null,
        responsibilities: responsibilities.map((r) => ({ role: r.role, user_id: r.user_id, responsibility: r.responsibility, note: r.note })),
        open_actions: (actionsByRegistryId.get(kpi.kpi_registry_id) ?? []).map((a) => ({ kpi_action_id: a.kpi_action_id, finding: a.finding, action_text: a.action_text, status: a.status, due_date: a.due_date }))
      });
    }

    return { status: 200, body: { cards } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

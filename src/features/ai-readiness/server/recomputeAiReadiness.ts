import type { SupabaseClient } from '@supabase/supabase-js';
import { metricComputers } from './computeMetric';

export interface RequirementResult {
  code: string;
  label: string;
  metric_key: string;
  actual: number;
  threshold: number;
  comparator: 'GTE' | 'LTE';
  met: boolean;
  percent: number; // seberapa dekat actual ke threshold, dibatasi maks 100
}

export interface CapabilityReadiness {
  capability_id: number;
  code: string;
  name: string;
  description: string;
  tier: string;
  readiness_percent: number;
  is_unlocked: boolean;
  requirements: RequirementResult[];
  blocking_reasons: { code: string; label: string; actual: number; threshold: number }[];
}

function requirementPercent(actual: number, threshold: number, comparator: 'GTE' | 'LTE'): number {
  if (comparator === 'GTE') {
    if (threshold <= 0) return actual >= threshold ? 100 : 0;
    return Math.min(100, (actual / threshold) * 100);
  }
  // LTE: makin kecil actual dari threshold, makin dekat 100 -- tidak dipakai
  // metric_key manapun saat ini (semua prasyarat terdaftar pakai GTE), tapi
  // dijaga simetris kalau kelak ada.
  if (actual <= threshold) return 100;
  if (actual <= 0) return 0;
  return Math.max(0, Math.min(100, (threshold / actual) * 100));
}

function meetsThreshold(actual: number, threshold: number, comparator: 'GTE' | 'LTE'): boolean {
  return comparator === 'GTE' ? actual >= threshold : actual <= threshold;
}

// Menghitung ulang kesiapan SEMUA kemampuan utk satu tenant dari data nyata,
// lalu menyimpannya ke ai_capability_status (upsert -- idempoten, lihat
// tests/ai_readiness.test.ts butir "job dijalankan 2x"). Query murah (hitung
// baris/rentang tanggal atas skala data 1 tenant), jadi dihitung LIVE setiap
// dashboard dibuka lalu di-cache ke tabel -- BUKAN dijadwalkan cron (belum ada
// infrastruktur cron di proyek ini, dan membangunnya sekarang utk 1 tenant
// nyata adalah abstraksi spekulatif). Pola sama dgn computeAiProjectProgress.ts
// (Bagian C) yang juga menghitung AUTO_QUERY live per panggilan.
export async function recomputeAiReadiness(adminClient: SupabaseClient, companyId: number): Promise<CapabilityReadiness[]> {
  const { data: capabilities, error: capError } = await adminClient
    .from('ai_capabilities')
    .select('ai_capability_id, code, name, description, tier, sort_order')
    .order('sort_order', { ascending: true });
  if (capError) throw new Error(capError.message);

  const { data: requirements, error: reqError } = await adminClient
    .from('ai_capability_requirements')
    .select('capability_id, code, label, metric_key, threshold, comparator, weight, is_blocking, sort_order')
    .order('sort_order', { ascending: true });
  if (reqError) throw new Error(reqError.message);

  const metricCache = new Map<string, number>();
  async function getMetric(metricKey: string): Promise<number> {
    if (metricCache.has(metricKey)) return metricCache.get(metricKey)!;
    const compute = metricComputers[metricKey];
    if (!compute) throw new Error(`metric_key "${metricKey}" belum terimplementasi -- lihat computeMetric.ts.`);
    const value = await compute(adminClient, companyId);
    metricCache.set(metricKey, value);
    return value;
  }

  const results: CapabilityReadiness[] = [];
  for (const capability of capabilities ?? []) {
    const reqs = (requirements ?? []).filter((r) => r.capability_id === capability.ai_capability_id);

    if (reqs.length === 0) {
      results.push({
        capability_id: capability.ai_capability_id,
        code: capability.code,
        name: capability.name,
        description: capability.description,
        tier: capability.tier,
        readiness_percent: 100,
        is_unlocked: true,
        requirements: [],
        blocking_reasons: []
      });
      continue;
    }

    const requirementResults: RequirementResult[] = [];
    let weightedSum = 0;
    let totalWeight = 0;
    const blockingReasons: CapabilityReadiness['blocking_reasons'] = [];

    for (const req of reqs) {
      const actual = await getMetric(req.metric_key);
      const comparator = req.comparator as 'GTE' | 'LTE';
      const met = meetsThreshold(actual, Number(req.threshold), comparator);
      const percent = requirementPercent(actual, Number(req.threshold), comparator);
      requirementResults.push({
        code: req.code,
        label: req.label,
        metric_key: req.metric_key,
        actual,
        threshold: Number(req.threshold),
        comparator,
        met,
        percent
      });
      weightedSum += percent * Number(req.weight);
      totalWeight += Number(req.weight);
      if (req.is_blocking && !met) {
        blockingReasons.push({ code: req.code, label: req.label, actual, threshold: Number(req.threshold) });
      }
    }

    results.push({
      capability_id: capability.ai_capability_id,
      code: capability.code,
      name: capability.name,
      description: capability.description,
      tier: capability.tier,
      readiness_percent: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0,
      is_unlocked: blockingReasons.length === 0,
      requirements: requirementResults,
      blocking_reasons: blockingReasons
    });
  }

  const upsertRows = results.map((r) => ({
    company_id: companyId,
    capability_id: r.capability_id,
    readiness_percent: r.readiness_percent,
    is_unlocked: r.is_unlocked,
    blocking_reasons: r.blocking_reasons,
    computed_at: new Date().toISOString()
  }));
  const { error: upsertError } = await adminClient
    .from('ai_capability_status')
    .upsert(upsertRows, { onConflict: 'company_id,capability_id' });
  if (upsertError) throw new Error(upsertError.message);

  return results;
}

// Gerbang tunggal (§3.3): satu fungsi dipanggil sebelum endpoint/UI kemampuan
// AI manapun dijalankan. Membaca status TER-CACHE (bukan menghitung ulang) --
// caller yang butuh angka terbaru harus memanggil recomputeAiReadiness() dulu.
export async function isCapabilityUnlocked(adminClient: SupabaseClient, companyId: number, capabilityCode: string): Promise<boolean> {
  const { data: capability, error: capError } = await adminClient
    .from('ai_capabilities')
    .select('ai_capability_id')
    .eq('code', capabilityCode)
    .maybeSingle();
  if (capError) throw new Error(capError.message);
  if (!capability) return false;

  const { data: override } = await adminClient
    .from('ai_capability_overrides')
    .select('ai_capability_override_id')
    .eq('company_id', companyId)
    .eq('capability_id', capability.ai_capability_id)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (override) return true;

  const { data: status, error: statusError } = await adminClient
    .from('ai_capability_status')
    .select('is_unlocked')
    .eq('company_id', companyId)
    .eq('capability_id', capability.ai_capability_id)
    .maybeSingle();
  if (statusError) throw new Error(statusError.message);
  return status?.is_unlocked ?? false;
}

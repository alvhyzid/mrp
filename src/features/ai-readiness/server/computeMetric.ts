import type { SupabaseClient } from '@supabase/supabase-js';

// Mesin pengukuran Kesiapan AI (docs/spesifikasi-kesiapan-ai-tenant.md §3.2) --
// setiap metric_key dihitung dari data nyata tenant, TIDAK ADA nilai yang bisa
// diketik manual. Hanya metric_key yang benar-benar bisa dihitung dari skema
// saat ini yang terdaftar di sini (lihat catatan penyimpangan di migration
// 20260822090000_ai_readiness.sql -- quality.* dan eval.pass_rate SENGAJA
// tidak ada karena tabel sumbernya belum dibangun).
type MetricComputer = (adminClient: SupabaseClient, companyId: number) => Promise<number>;

async function kamusConfirmedRatio(adminClient: SupabaseClient, companyId: number, extra: (q: any) => any): Promise<number> {
  let query = adminClient.from('kamus_terms').select('status').eq('company_id', companyId);
  query = extra(query);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const total = data?.length ?? 0;
  if (total === 0) return 0;
  const confirmed = data!.filter((row: { status: string }) => row.status === 'DIKONFIRMASI').length;
  return (confirmed / total) * 100;
}

export const metricComputers: Record<string, MetricComputer> = {
  'kamus.p12_confirmed_ratio': (adminClient, companyId) =>
    kamusConfirmedRatio(adminClient, companyId, (q) => q.in('priority', [1, 2])),

  'kamus.metric_finance_ratio': (adminClient, companyId) =>
    kamusConfirmedRatio(adminClient, companyId, (q) => q.eq('scope', 'METRIC').eq('domain', 'uang')),

  'data.days_of_history': async (adminClient, companyId) => {
    const { data, error } = await adminClient
      .from('status_transition_log')
      .select('changed_at')
      .eq('company_id', companyId)
      .order('changed_at', { ascending: true });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return 0;
    const earliest = new Date(data[0].changed_at).getTime();
    const latest = new Date(data[data.length - 1].changed_at).getTime();
    return (latest - earliest) / (1000 * 60 * 60 * 24);
  },

  'data.status_transitions_count': async (adminClient, companyId) => {
    const { count, error } = await adminClient
      .from('status_transition_log')
      .select('status_transition_log_id', { count: 'exact', head: true })
      .eq('company_id', companyId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  'k8.learned_items_count': async (adminClient, companyId) => {
    const { data, error } = await adminClient
      .from('production_standards')
      .select('item_id')
      .eq('company_id', companyId)
      .eq('source', 'DIPELAJARI');
    if (error) throw new Error(error.message);
    const distinctItems = new Set((data ?? []).map((row: { item_id: number }) => row.item_id));
    return distinctItems.size;
  },

  // §1.5: "% downtime terklasifikasi (bukan 'unclassified')". production_disruptions
  // TERNYATA sudah ada (koreksi -- laporan sebelumnya keliru menyebut tabel ini
  // tidak ada). disruption_type NOT NULL dgn check constraint termasuk nilai
  // 'other' sbg keranjang serba-guna -- itulah padanan "unclassified" di sini
  // (tidak ada sentinel terpisah, tapi 'other' persis berperan sbg itu: dipakai
  // saat tidak ada kategori nyata yang cocok).
  'quality.downtime_classified': async (adminClient, companyId) => {
    const { data, error } = await adminClient.from('production_disruptions').select('disruption_type').eq('company_id', companyId);
    if (error) throw new Error(error.message);
    const total = data?.length ?? 0;
    if (total === 0) return 0;
    const classified = data!.filter((row: { disruption_type: string }) => row.disruption_type !== 'other').length;
    return (classified / total) * 100;
  }
};

export function isMetricComputable(metricKey: string): boolean {
  return metricKey in metricComputers;
}

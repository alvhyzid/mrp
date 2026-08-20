'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency';

const DISPLAY_TITLES: Record<string, string> = {
  'metric.margin_kontribusi': 'Margin Kontribusi Bulanan',
  'metric.biaya_produksi_per_unit': 'Biaya Produksi per Unit',
  'metric.laba_operasional_bulanan': 'Laba Operasional Bulanan',
  'metric.yield_per_tahap_produk': 'Yield per Tahap',
  'metric.nilai_persediaan': 'Nilai Persediaan'
};

function formatValueForMetric(metricKey: string, value: number | null): string {
  if (value === null) return 'belum bisa dihitung';
  if (metricKey === 'metric.yield_per_tahap_produk') return `${value.toFixed(1)}%`;
  return formatCurrency(value, { maxDecimals: 0 });
}

type MyKpiResponse = {
  role: string;
  department: string | null;
  kpis: { kpi_registry_id: number; metric_key: string; pillar: string; attribution_level: string; value: number | null; target_value: number | null; note: string }[];
  open_actions: { kpi_action_id: number; finding: string; action_text: string; due_date: string | null; status: string }[];
};

// "KPI Saya" (revisi §1.2) -- cermin performa DEPARTEMEN/PERAN untuk diri sendiri,
// BUKAN leaderboard antar pegawai. Kelima KPI kategori A semuanya TIM/LINI/
// PERUSAHAAN (tidak ada yang INDIVIDU), jadi angkanya sama dengan yang dilihat
// rekan seperan -- yang benar-benar personal di halaman ini adalah tindakan
// (kpi_actions) yang ditugaskan eksplisit ke Anda.
export default function MyKpiPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [data, setData] = useState<MyKpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadData = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setLoading(true);
    const response = await fetch('/api/kpi/saya', { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || 'Gagal memuat KPI Saya.');
      setLoading(false);
      return;
    }
    setData(body);
    setError('');
    setLoading(false);
  }, [getAccessToken]);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/kpi/saya');
        return;
      }
      setCheckingAccess(false);
      await loadData();
    };
    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="px-6 text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="flex w-full flex-col gap-6 px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Personal</p>
          <h1 className="text-2xl font-semibold text-foreground">KPI Saya</h1>
          <p className="mt-1 text-sm text-muted-foreground">KPI yang relevan dengan peran Anda, dan tindakan yang jadi tanggung jawab Anda. Bukan papan peringkat -- tidak ada perbandingan antar pegawai di sini.</p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}

        {data && !loading ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.kpis.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada KPI yang relevan dengan peran Anda ({data.role}).</p>
              ) : (
                data.kpis.map((k) => (
                  <Card key={k.kpi_registry_id}>
                    <CardContent className="flex flex-col gap-1 pt-6">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{DISPLAY_TITLES[k.metric_key] ?? k.metric_key}</span>
                      <span className="text-xl font-semibold text-foreground">{formatValueForMetric(k.metric_key, k.value)}</span>
                      <span className="text-xs text-muted-foreground">Target: {k.target_value !== null ? formatValueForMetric(k.metric_key, k.target_value) : 'belum ditetapkan, baseline berjalan'}</span>
                      <p className="text-xs italic text-muted-foreground">{k.note}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <Card>
              <CardHeader>
                <CardDescription className="uppercase tracking-[0.2em]">Tindak Lanjut</CardDescription>
                <CardTitle className="text-lg">Tindakan Terbuka Anda</CardTitle>
              </CardHeader>
              <CardContent>
                {data.open_actions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada tindakan terbuka yang ditugaskan ke Anda saat ini.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.open_actions.map((a) => (
                      <div key={a.kpi_action_id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <div>
                          <p className="font-medium text-foreground">{a.finding}</p>
                          <p className="text-xs text-muted-foreground">{a.action_text}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.due_date ? <span className="text-xs text-muted-foreground">Tenggat {a.due_date}</span> : null}
                          <Badge variant="secondary">{a.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </main>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';

type RequirementResult = {
  code: string;
  label: string;
  metric_key: string;
  actual: number;
  threshold: number;
  comparator: 'GTE' | 'LTE';
  met: boolean;
  percent: number;
};

type CapabilityReadiness = {
  capability_id: number;
  code: string;
  name: string;
  description: string;
  tier: string;
  readiness_percent: number;
  is_unlocked: boolean;
  requirements: RequirementResult[];
  blocking_reasons: { code: string; label: string; actual: number; threshold: number }[];
};

type DashboardData = {
  capabilities: CapabilityReadiness[];
  unlocked_count: number;
  total_count: number;
  overall_readiness_percent: number;
};

const tierLabels: Record<string, string> = { CORE: 'Inti', INSIGHT: 'Analisis', COPILOT: 'Copilot' };

function actionLinkForMetric(metricKey: string): { href: string; text: string } | null {
  if (metricKey === 'kamus.p12_confirmed_ratio') {
    return { href: '/kamus?priority=1&status=DRAF_AI', text: 'Jawab & konfirmasi antrean Kamus prioritas 1-2' };
  }
  if (metricKey === 'kamus.metric_finance_ratio') {
    return { href: '/kamus?scope=METRIC&domain=uang', text: 'Konfirmasi antrean Kamus metrik keuangan' };
  }
  return null;
}

function metricGuidance(metricKey: string): string | null {
  if (metricKey === 'data.days_of_history' || metricKey === 'data.status_transitions_count') {
    return 'Bertambah otomatis seiring waktu berjalan (tercatat tiap kali status berubah di sistem).';
  }
  if (metricKey === 'k8.learned_items_count') {
    return 'Selesaikan lebih banyak batch produksi sampai tuntas -- sistem mempelajari standar dari data nyata.';
  }
  return null;
}

function formatMetricValue(metricKey: string, value: number): string {
  if (metricKey.endsWith('_ratio')) return `${value.toFixed(1)}%`;
  if (metricKey === 'data.days_of_history') return `${value.toFixed(0)} hari`;
  return value.toFixed(0);
}

export default function AiReadinessPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/ai-readiness');
        return;
      }
      const accessToken = await getAccessToken();
      const response = await fetch('/api/ai-readiness', { headers: { Authorization: `Bearer ${accessToken}` } });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || 'Gagal memuat kesiapan AI.');
        setCheckingAccess(false);
        return;
      }
      setData(body);
      setCheckingAccess(false);
    };
    load();
  }, [router, getAccessToken]);

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="px-6 text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  const lockedCapabilities = data?.capabilities.filter((c) => !c.is_unlocked) ?? [];

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="flex w-full flex-col gap-6 px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Kesiapan AI</p>
          <h1 className="text-2xl font-semibold text-foreground">Sejauh Mana Data Anda Siap untuk AI</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Setiap kemampuan AI dibuka bertahap sesuai kesiapan data Anda, bukan dinyalakan sekaligus di atas data yang belum layak. Ini mencegah hasil AI
            yang dangkal & mengecewakan di awal.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {data ? (
          <>
            <Card>
              <CardContent className="flex flex-wrap items-center gap-6 pt-6">
                <div>
                  <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Kesiapan Keseluruhan
                    <ProvenanceInfoButton
                      label="Kesiapan Keseluruhan"
                      envelope={{
                        formula: 'Rata-rata sederhana dari readiness_percent semua kemampuan AI (bukan tertimbang) — tiap kemampuan bobotnya sama di angka ini, walau prasyarat DI DALAM tiap kemampuan sendiri tertimbang.',
                        inputs: [{ label: 'Jumlah kemampuan dirata-rata', value: String(data.total_count) }]
                      }}
                    />
                  </span>
                  <p className="text-2xl font-semibold text-foreground">{data.overall_readiness_percent.toFixed(1)}%</p>
                </div>
                <div>
                  <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Kemampuan Terbuka
                    <ProvenanceInfoButton
                      label="Kemampuan Terbuka"
                      envelope={{
                        formula: 'Jumlah kemampuan yang SEMUA prasyarat is_blocking=true-nya terpenuhi (gerbang keras, bukan skor) dibagi total kemampuan. Kemampuan tanpa prasyarat blocking selalu terbuka.',
                        inputs: [
                          { label: 'Terbuka', value: String(data.unlocked_count) },
                          { label: 'Total', value: String(data.total_count) }
                        ]
                      }}
                    />
                  </span>
                  <p className="text-2xl font-semibold text-foreground">
                    {data.unlocked_count} / {data.total_count}
                  </p>
                </div>
              </CardContent>
            </Card>

            {lockedCapabilities.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardDescription className="uppercase tracking-[0.2em]">Yang Bisa Anda Kerjakan</CardDescription>
                  <CardTitle className="text-lg">Tugas untuk Membuka Kemampuan Berikutnya</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {lockedCapabilities.flatMap((c) =>
                    c.blocking_reasons.map((reason) => {
                      const metricKey = c.requirements.find((r) => r.code === reason.code)?.metric_key ?? '';
                      const action = actionLinkForMetric(metricKey);
                      return (
                        <div key={`${c.code}-${reason.code}`} className="flex items-center justify-between rounded-md border p-3 text-sm">
                          <div>
                            <p className="font-medium text-foreground">
                              {c.name}: {reason.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Saat ini {formatMetricValue(metricKey, reason.actual)} dari target {formatMetricValue(metricKey, reason.threshold)}
                            </p>
                          </div>
                          {action ? (
                            <Link href={action.href} className="text-sm font-medium text-primary underline underline-offset-2">
                              {action.text}
                            </Link>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            ) : null}

            <div className="flex flex-col gap-4">
              {data.capabilities.map((c) => (
                <Card key={c.code}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardDescription className="uppercase tracking-[0.2em]">{tierLabels[c.tier] ?? c.tier}</CardDescription>
                        <CardTitle className="text-lg">{c.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.is_unlocked ? 'success' : 'secondary'}>{c.is_unlocked ? 'Terbuka' : 'Terkunci'}</Badge>
                        <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                          {c.readiness_percent.toFixed(1)}%
                          <ProvenanceInfoButton
                            label={`Kesiapan — ${c.name}`}
                            envelope={{
                              formula: 'Rata-rata TERTIMBANG persen tiap prasyarat kemampuan ini (Σ persen×bobot ÷ Σ bobot). Terbuka HANYA kalau semua prasyarat is_blocking=true terpenuhi — skor tinggi TIDAK otomatis membuka kalau ada 1 prasyarat blocking yang belum tercapai.',
                              inputs: c.requirements.map((r) => ({ label: r.label, value: `${r.percent.toFixed(1)}% (bobot dari admin platform)` }))
                            }}
                          />
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                  </CardHeader>
                  {c.requirements.length > 0 ? (
                    <CardContent className="flex flex-col gap-2">
                      {c.requirements.map((r) => {
                        const guidance = metricGuidance(r.metric_key);
                        return (
                          <div key={r.code} className="flex flex-col gap-0.5 rounded-md border p-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                {r.label}
                                <ProvenanceInfoButton
                                  label={r.label}
                                  envelope={{
                                    formula: `Persen = MIN(100, aktual ÷ ambang × 100) untuk metrik "${r.metric_key}" (komparator ${r.comparator === 'GTE' ? 'aktual harus ≥ ambang' : 'aktual harus ≤ ambang'}). Nilai aktual dihitung LIVE dari data nyata, bukan cache statis.`,
                                    inputs: [
                                      { label: 'Aktual', value: formatMetricValue(r.metric_key, r.actual) },
                                      { label: 'Ambang', value: formatMetricValue(r.metric_key, r.threshold) },
                                      { label: 'Persen', value: `${r.percent.toFixed(1)}%` }
                                    ],
                                    sourceDocument: 'recomputeAiReadiness.ts'
                                  }}
                                />
                              </span>
                              <Badge variant={r.met ? 'success' : 'warning'}>
                                {formatMetricValue(r.metric_key, r.actual)} / {formatMetricValue(r.metric_key, r.threshold)}
                              </Badge>
                            </div>
                            {!r.met && guidance ? <p className="text-xs italic text-muted-foreground">{guidance}</p> : null}
                          </div>
                        );
                      })}
                    </CardContent>
                  ) : (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">Tidak ada prasyarat — selalu aktif.</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

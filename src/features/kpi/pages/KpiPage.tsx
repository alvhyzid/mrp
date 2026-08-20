'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { formatCurrency } from '@/lib/currency';
import { isCompanyLeadership } from '@/lib/roles';

type KpiCardData = {
  kpi_registry_id: number;
  metric_key: string;
  kind: string;
  pillar: string;
  owner_role: string;
  frequency: string;
  attribution_level: string;
  value: number | null;
  period_start: string;
  period_end: string;
  complete: boolean;
  target_value: number | null;
  benchmark_value: number | null;
  benchmark_label: string | null;
  benchmark_source: string | null;
  delta: number | null;
  sparkline: { period_start: string; value: number | null }[];
  improvement_levers: string[];
  provenance: { formula: string; inputs: { label: string; value: string }[]; sourceDocument?: string };
  definition: { termKey: string; businessAnswer: string | null; draft: string | null; status: string } | null;
  responsibilities: { role: string | null; user_id: number | null; responsibility: string; note: string | null }[];
  open_actions: { kpi_action_id: number; finding: string; action_text: string; status: string; due_date: string | null }[];
};

// Konfigurasi TAMPILAN murni (bukan data tersimpan) -- judul manusiawi, format
// angka, dan arah "lebih baik" per KPI. `null` = arah tidak jelas (nilai
// persediaan: terlalu tinggi = modal tertidur, terlalu rendah = risiko stock-out).
const DISPLAY_CONFIG: Record<string, { title: string; format: (v: number) => string; higherIsBetter: boolean | null }> = {
  'metric.margin_kontribusi': { title: 'Margin Kontribusi Bulanan', format: (v) => formatCurrency(v, { maxDecimals: 0 }), higherIsBetter: true },
  'metric.margin_kontribusi_persen': { title: 'Margin Kontribusi %', format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
  'metric.biaya_produksi_per_unit': { title: 'Biaya Produksi per Unit (Rata-rata)', format: (v) => formatCurrency(v, { maxDecimals: 0 }), higherIsBetter: false },
  'metric.laba_operasional_bulanan': { title: 'Laba Operasional Bulanan', format: (v) => formatCurrency(v, { maxDecimals: 0 }), higherIsBetter: true },
  'metric.yield_per_tahap_produk': { title: 'Yield per Tahap (Rata-rata Mingguan)', format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
  'metric.nilai_persediaan': { title: 'Nilai Persediaan', format: (v) => formatCurrency(v, { maxDecimals: 0 }), higherIsBetter: null }
};

export default function KpiPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [cards, setCards] = useState<KpiCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadCards = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setLoading(true);
    const response = await fetch('/api/kpi', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Gagal memuat KPI.');
      setLoading(false);
      return;
    }
    setCards(data.cards || []);
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
        router.replace('/login?redirectTo=/kpi');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      setRole(meData?.user?.role ?? null);
      setCheckingAccess(false);
      await loadCards();
    };
    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMessage('');
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setSeeding(false);
      return;
    }
    const response = await fetch('/api/kpi/seed', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    setSeeding(false);
    if (!response.ok) {
      setSeedMessage(data.error || 'Gagal seed KPI.');
      return;
    }
    setSeedMessage(`Kamus: ${data.kamus.inserted} baris baru. Registry: ${data.registry.registryInserted} KPI baru, ${data.registry.responsibilitiesInserted} tanggung jawab baru.`);
    await loadCards();
  };

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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Ringkasan</p>
            <h1 className="text-2xl font-semibold text-foreground">KPI Perusahaan</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              5 KPI awal (Margin, Biaya/unit, Laba Operasional, Yield, Nilai Persediaan) -- baseline dulu, target kemudian. Klik ikon ⓘ di tiap kartu untuk detail lengkap.
            </p>
          </div>
          <Link href="/kpi/saya" className="text-sm font-medium text-primary underline underline-offset-2">
            KPI Saya →
          </Link>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && cards.length === 0 ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Belum Ada KPI</CardDescription>
              <CardTitle className="text-lg">{isCompanyLeadership(role) ? 'Seed 5 KPI awal untuk memulai' : 'Tidak ada KPI yang bisa Anda lihat dari role ini'}</CardTitle>
            </CardHeader>
            {isCompanyLeadership(role) ? (
              <CardContent className="flex flex-col gap-2">
                <Button size="sm" className="w-fit" disabled={seeding} onClick={handleSeed}>
                  {seeding ? 'Menjalankan...' : 'Seed 5 KPI Awal'}
                </Button>
                {seedMessage ? <p className="text-xs text-muted-foreground">{seedMessage}</p> : null}
              </CardContent>
            ) : null}
          </Card>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat KPI...</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const config = DISPLAY_CONFIG[card.metric_key] ?? { title: card.metric_key, format: (v: number) => String(v), higherIsBetter: null };
              return (
                <KpiCard
                  key={card.kpi_registry_id}
                  title={config.title}
                  pillar={card.pillar}
                  value={card.value}
                  formatValue={config.format}
                  targetValue={card.target_value}
                  benchmarkValue={card.benchmark_value}
                  benchmarkLabel={card.benchmark_label}
                  delta={card.delta}
                  higherIsBetter={config.higherIsBetter}
                  sparkline={card.sparkline}
                  complete={card.complete}
                  frequency={card.frequency}
                  provenanceEnvelope={{ formula: card.provenance.formula, inputs: card.provenance.inputs, sourceDocument: card.provenance.sourceDocument }}
                  definition={card.definition}
                  kpiTab={{
                    valueLabel: card.value !== null ? config.format(card.value) : 'belum bisa dihitung',
                    targetLabel: card.target_value !== null ? config.format(card.target_value) : null,
                    benchmarkLabel: card.benchmark_value !== null ? `${config.format(card.benchmark_value)} (${card.benchmark_label ?? 'arah'})` : null,
                    deltaLabel: card.delta !== null ? `${card.delta >= 0 ? '+' : ''}${config.format(card.delta)}` : null,
                    attributionLevel: card.attribution_level,
                    responsibilities: card.responsibilities,
                    improvementLevers: card.improvement_levers,
                    openActions: card.open_actions.map((a) => ({ finding: a.finding, actionText: a.action_text, dueDate: a.due_date }))
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

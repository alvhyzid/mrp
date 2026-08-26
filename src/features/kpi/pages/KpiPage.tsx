'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Breadcrumb, BreadcrumbItem, Button, InlineNotification, Link as CarbonLink, SkeletonText } from '@carbon/react';
import { KpiCard } from '@/components/ui/kpi-card';
import { formatCurrency, formatNumberId } from '@/lib/currency';
import { isCompanyLeadership } from '@/lib/roles';
import { authedJson } from '@/lib/authedFetch';

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
  'metric.margin_kontribusi_persen': { title: 'Margin Kontribusi %', format: (v) => `${formatNumberId(v, 1)}%`, higherIsBetter: true },
  'metric.biaya_produksi_per_unit': { title: 'Biaya Produksi per Unit (Rata-rata)', format: (v) => formatCurrency(v, { maxDecimals: 0 }), higherIsBetter: false },
  'metric.laba_operasional_bulanan': { title: 'Laba Operasional Bulanan', format: (v) => formatCurrency(v, { maxDecimals: 0 }), higherIsBetter: true },
  'metric.yield_per_tahap_produk': { title: 'Yield per Tahap (Rata-rata Mingguan)', format: (v) => `${formatNumberId(v, 1)}%`, higherIsBetter: true },
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

  // AUD-36 — merekam snapshot KPI kini AKSI YANG DISENGAJA, bukan efek samping membuka
  // halaman. Sebelumnya setiap pemuatan halaman ini menulis baris ke kpi_snapshots, sehingga
  // grafik trennya sebenarnya merekam "kapan orang membuka halaman", bukan "bagaimana
  // angkanya bergerak".
  const [merekam, setMerekam] = useState(false);
  const [pesanRekam, setPesanRekam] = useState<string | null>(null);

  const handleRekamSnapshot = async () => {
    setMerekam(true);
    setPesanRekam(null);
    try {
      const { ok, body } = await authedJson('/api/kpi/snapshot', { method: 'POST' });
      setPesanRekam(
        ok
          ? `${(body as { tersimpan?: number }).tersimpan ?? 0} KPI direkam untuk periode ini.`
          : ((body as { error?: string }).error ?? 'Gagal merekam snapshot.')
      );
    } catch (e) {
      setPesanRekam(e instanceof Error ? e.message : String(e));
    }
    setMerekam(false);
    await loadCards();
  };

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
      <div className="halaman">
        <SkeletonText heading width="16rem" />
        <SkeletonText paragraph lineCount={3} />
      </div>
    );
  }

  return (
    <div className="halaman">
      <Breadcrumb noTrailingSlash className="halaman__remah">
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <span className="cds--link halaman__remah-mati">Data &amp; Analytics</span>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>KPI</BreadcrumbItem>
      </Breadcrumb>

      <div>
        <h1 className="halaman__judul">KPI perusahaan</h1>
        <p className="halaman__pengantar">
          {loading ? 'Memuat…' : `${cards.length} KPI ditampilkan.`} Baseline dulu, target kemudian —
          klik ikon info di tiap kartu untuk melihat dari mana angkanya berasal.
        </p>
      </div>

      <div className="kpi-aksi">
        {/* PEMICU PEREKAMAN SNAPSHOT (AUD-36). Tombol ini ada karena penyimpanannya DICABUT
            dari pemuatan halaman: tanpa pemicu yang terlihat, riwayat KPI tidak akan pernah
            bertambah lagi — dan grafik trennya akan merekam KAPAN ORANG MEMBUKA HALAMAN,
            bukan bagaimana angkanya bergerak. */}
        <Button size="md" kind="tertiary" disabled={merekam} onClick={handleRekamSnapshot}>
          {merekam ? 'Merekam…' : 'Rekam angka periode ini'}
        </Button>
        <CarbonLink as={Link} href="/kpi/saya">
          KPI saya →
        </CarbonLink>
      </div>

      {pesanRekam ? <InlineNotification kind="info" lowContrast title={pesanRekam} hideCloseButton /> : null}
      {error ? <InlineNotification kind="error" lowContrast title="Gagal memuat" subtitle={error} hideCloseButton /> : null}

      {!loading && cards.length === 0 ? (
        <div className="kpi-kosong">
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title={isCompanyLeadership(role) ? 'Belum ada KPI' : 'Tidak ada KPI yang bisa Anda lihat dari peran ini'}
            subtitle={isCompanyLeadership(role) ? seedMessage || 'Enam KPI awal perlu dibuat sekali untuk memulai.' : undefined}
          />
          {isCompanyLeadership(role) ? (
            <Button size="sm" kind="tertiary" disabled={seeding} onClick={handleSeed}>
              {seeding ? 'Menjalankan…' : 'Buat 6 KPI awal'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <SkeletonText paragraph lineCount={4} />
      ) : (
        <div className="kisi-metrik kpi-kisi">
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
  );
}

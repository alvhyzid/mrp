'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Breadcrumb, BreadcrumbItem, InlineNotification, Link as CarbonLink, SkeletonText, Tag, Tile } from '@carbon/react';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { formatNumberId } from '@/lib/currency';

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
  if (metricKey.endsWith('_ratio')) return `${formatNumberId(value, 1)}%`;
  if (metricKey === 'data.days_of_history') return `${formatNumberId(value, 0)} hari`;
  return formatNumberId(value, 0);
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
      <div className="halaman">
        <SkeletonText heading width="20rem" />
        <SkeletonText paragraph lineCount={4} />
      </div>
    );
  }

  const lockedCapabilities = data?.capabilities.filter((c) => !c.is_unlocked) ?? [];

  return (
    <div className="halaman">
      <Breadcrumb noTrailingSlash className="halaman__remah">
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <span className="cds--link halaman__remah-mati">AI</span>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>AI Readiness</BreadcrumbItem>
      </Breadcrumb>

      <div>
        <h1 className="halaman__judul">Sejauh mana data Anda siap untuk AI</h1>
        <p className="halaman__pengantar">
          Setiap kemampuan AI dibuka bertahap sesuai kesiapan data Anda, bukan dinyalakan sekaligus di atas data
          yang belum layak. Ini mencegah hasil AI yang dangkal dan mengecewakan di awal.
        </p>
      </div>

      {error ? <InlineNotification kind="error" lowContrast title="Gagal memuat" subtitle={error} hideCloseButton /> : null}

      {data ? (
        <>
          <div className="kisi-metrik ai-ringkas">
            <Tile>
              <span className="metrik__label ai-label">
                Kesiapan keseluruhan
                <ProvenanceInfoButton
                  label="Kesiapan Keseluruhan"
                  envelope={{
                    formula:
                      'Rata-rata sederhana dari readiness_percent semua kemampuan AI (bukan tertimbang) — tiap kemampuan bobotnya sama di angka ini, walau prasyarat DI DALAM tiap kemampuan sendiri tertimbang.',
                    inputs: [{ label: 'Jumlah kemampuan dirata-rata', value: formatNumberId(data.total_count, 0) }]
                  }}
                />
              </span>
              <span className="metrik__angka">{formatNumberId(data.overall_readiness_percent, 1)}%</span>
            </Tile>
            <Tile>
              <span className="metrik__label ai-label">
                Kemampuan terbuka
                <ProvenanceInfoButton
                  label="Kemampuan Terbuka"
                  envelope={{
                    formula:
                      'Jumlah kemampuan yang SEMUA prasyarat is_blocking=true-nya terpenuhi (gerbang keras, bukan skor) dibagi total kemampuan. Kemampuan tanpa prasyarat blocking selalu terbuka.',
                    inputs: [
                      { label: 'Terbuka', value: formatNumberId(data.unlocked_count, 0) },
                      { label: 'Total', value: formatNumberId(data.total_count, 0) }
                    ]
                  }}
                />
              </span>
              <span className="metrik__angka">
                {formatNumberId(data.unlocked_count, 0)} / {formatNumberId(data.total_count, 0)}
              </span>
            </Tile>
          </div>

          {lockedCapabilities.length > 0 ? (
            <Tile className="ai-kartu">
              <h2 className="halaman__subjudul">Tugas untuk membuka kemampuan berikutnya</h2>
              <div className="ai-daftar">
                {lockedCapabilities.flatMap((c) =>
                  c.blocking_reasons.map((reason) => {
                    const metricKey = c.requirements.find((r) => r.code === reason.code)?.metric_key ?? '';
                    const action = actionLinkForMetric(metricKey);
                    return (
                      <div key={`${c.code}-${reason.code}`} className="ai-baris">
                        <div>
                          <p className="ai-baris__judul">
                            {c.name}: {reason.label}
                          </p>
                          <p className="halaman__redup">
                            Saat ini {formatMetricValue(metricKey, reason.actual)} dari target{' '}
                            {formatMetricValue(metricKey, reason.threshold)}
                          </p>
                        </div>
                        {action ? (
                          <CarbonLink as={Link} href={action.href}>
                            {action.text}
                          </CarbonLink>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </Tile>
          ) : null}

          {data.capabilities.map((c) => (
            <Tile key={c.code} className="ai-kartu">
              <div className="ai-kepala">
                <div>
                  <span className="metrik__label">{tierLabels[c.tier] ?? c.tier}</span>
                  <h2 className="halaman__subjudul halaman__subjudul--rapat">{c.name}</h2>
                </div>
                <div className="ai-kepala__kanan">
                  {/* Tag Carbon: hijau = terbuka, abu = terkunci. Warna mengikuti ARTI. */}
                  <Tag type={c.is_unlocked ? 'green' : 'gray'}>{c.is_unlocked ? 'Terbuka' : 'Terkunci'}</Tag>
                  <span className="ai-persen">
                    {formatNumberId(c.readiness_percent, 1)}%
                    <ProvenanceInfoButton
                      label={`Kesiapan — ${c.name}`}
                      envelope={{
                        formula:
                          'Rata-rata TERTIMBANG persen tiap prasyarat kemampuan ini (Σ persen×bobot ÷ Σ bobot). Terbuka HANYA kalau semua prasyarat is_blocking=true terpenuhi — skor tinggi TIDAK otomatis membuka kalau ada 1 prasyarat blocking yang belum tercapai.',
                        inputs: c.requirements.map((r) => ({
                          label: r.label,
                          value: `${formatNumberId(r.percent, 1)}% (bobot dari admin platform)`
                        }))
                      }}
                    />
                  </span>
                </div>
              </div>
              <p className="halaman__redup">{c.description}</p>

              {c.requirements.length > 0 ? (
                <div className="ai-daftar">
                  {c.requirements.map((r) => {
                    const guidance = metricGuidance(r.metric_key);
                    return (
                      <div key={r.code} className="ai-syarat">
                        <div className="ai-syarat__atas">
                          <span className="ai-syarat__label">
                            {r.label}
                            <ProvenanceInfoButton
                              label={r.label}
                              envelope={{
                                formula: `Persen = MIN(100, aktual ÷ ambang × 100) untuk metrik "${r.metric_key}" (komparator ${r.comparator === 'GTE' ? 'aktual harus ≥ ambang' : 'aktual harus ≤ ambang'}). Nilai aktual dihitung LIVE dari data nyata, bukan cache statis.`,
                                inputs: [
                                  { label: 'Aktual', value: formatMetricValue(r.metric_key, r.actual) },
                                  { label: 'Ambang', value: formatMetricValue(r.metric_key, r.threshold) },
                                  { label: 'Persen', value: `${formatNumberId(r.percent, 1)}%` }
                                ],
                                sourceDocument: 'recomputeAiReadiness.ts'
                              }}
                            />
                          </span>
                          <Tag type={r.met ? 'green' : 'magenta'}>
                            {formatMetricValue(r.metric_key, r.actual)} / {formatMetricValue(r.metric_key, r.threshold)}
                          </Tag>
                        </div>
                        {/* Petunjuk hanya muncul untuk syarat yang BELUM terpenuhi: menampilkan
                            saran untuk hal yang sudah beres cuma menambah teks tanpa tindakan. */}
                        {!r.met && guidance ? <p className="ai-petunjuk">{guidance}</p> : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="halaman__redup">Tidak ada prasyarat — kemampuan ini selalu aktif.</p>
              )}
            </Tile>
          ))}
        </>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { InlineNotification, SkeletonText, Tag, Tile } from '@carbon/react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { formatCurrency, formatNumberId } from '@/lib/currency';
import { getRoleLabel } from '@/lib/glossary';

const ACTION_STATUS_LABELS: Record<string, string> = { TERBUKA: 'Terbuka', BERJALAN: 'Berjalan', SELESAI: 'Selesai' };

const DISPLAY_TITLES: Record<string, string> = {
  'metric.margin_kontribusi': 'Margin Kontribusi Bulanan',
  'metric.margin_kontribusi_persen': 'Margin Kontribusi %',
  'metric.biaya_produksi_per_unit': 'Biaya Produksi per Unit',
  'metric.laba_operasional_bulanan': 'Laba Operasional Bulanan',
  'metric.yield_per_tahap_produk': 'Yield per Tahap',
  'metric.nilai_persediaan': 'Nilai Persediaan'
};

function formatValueForMetric(metricKey: string, value: number | null): string {
  if (value === null) return 'belum bisa dihitung';
  if (metricKey === 'metric.yield_per_tahap_produk' || metricKey === 'metric.margin_kontribusi_persen') return `${formatNumberId(value, 1)}%`;
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
    <div className="halaman">
      <KepalaHalaman
        remah={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Data & Analytics" },
          { label: "My KPI" }
        ]}
        judul="KPI saya"
        pengantar="KPI yang relevan dengan peran Anda, dan tindakan yang jadi tanggung jawab Anda. Bukan papan peringkat — tidak ada perbandingan antar pegawai di sini."
      />

      {error ? <InlineNotification kind="error" lowContrast title="Gagal memuat" subtitle={error} hideCloseButton /> : null}

      {loading ? (
        <>
          <SkeletonText heading width="14rem" />
          <SkeletonText paragraph lineCount={3} />
        </>
      ) : null}

      {data && !loading ? (
        <>
          {data.kpis.length === 0 ? (
            <p className="halaman__pengantar">
              Belum ada KPI yang relevan dengan peran Anda ({getRoleLabel(data.role)}).
            </p>
          ) : (
            <div className="kisi-metrik">
              {data.kpis.map((k) => (
                <Tile key={k.kpi_registry_id}>
                  <span className="metrik__label">{DISPLAY_TITLES[k.metric_key] ?? k.metric_key}</span>
                  <span className="metrik__angka">{formatValueForMetric(k.metric_key, k.value)}</span>
                  <p className="kpi-target">
                    Target:{' '}
                    {k.target_value !== null
                      ? formatValueForMetric(k.metric_key, k.target_value)
                      : 'belum ditetapkan, baseline berjalan'}
                  </p>
                  <p className="kpi-catatan">{k.note}</p>
                </Tile>
              ))}
            </div>
          )}

          <div>
            <h2 className="halaman__subjudul">Tindakan terbuka Anda</h2>
            {data.open_actions.length === 0 ? (
              <p className="halaman__pengantar">Tidak ada tindakan terbuka yang ditugaskan ke Anda saat ini.</p>
            ) : (
              <div className="kpi-tindakan">
                {data.open_actions.map((a) => (
                  <Tile key={a.kpi_action_id} className="kpi-tindakan__baris">
                    <div>
                      <p className="kpi-tindakan__temuan">{a.finding}</p>
                      <p className="halaman__redup">{a.action_text}</p>
                    </div>
                    <div className="kpi-tindakan__kanan">
                      {a.due_date ? <span className="halaman__redup">Tenggat {a.due_date}</span> : null}
                      <Tag type={a.status === 'SELESAI' ? 'green' : a.status === 'BERJALAN' ? 'blue' : 'gray'}>
                        {ACTION_STATUS_LABELS[a.status] ?? a.status}
                      </Tag>
                    </div>
                  </Tile>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

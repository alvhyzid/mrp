'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { formatNumberId } from '@/lib/currency';
import { getEntityLabel, COMMON_STATUS_LABELS } from '@/lib/glossary';

function statusLabel(s: string): string {
  return COMMON_STATUS_LABELS[s] ?? s;
}

type ProcessMiningResult = {
  total_transitions: number;
  earliest_transition_at: string | null;
  latest_transition_at: string | null;
  data_sufficient_for_trend_analysis: boolean;
  status_durations: { table_name: string; status: string; sample_count: number; avg_duration_hours: number | null }[];
  transition_counts: { table_name: string; from_status: string; to_status: string; count: number }[];
  backward_or_cancelled_transitions: { table_name: string; from_status: string; to_status: string; count: number }[];
  notes: string[];
};

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} menit`;
  if (hours < 48) return `${formatNumberId(hours, 1)} jam`;
  return `${formatNumberId(hours / 24, 1)} hari`;
}

export default function ProcessMiningPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [data, setData] = useState<ProcessMiningResult | null>(null);
  const [error, setError] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/process-mining');
        return;
      }
      const accessToken = await getAccessToken();
      const response = await fetch('/api/process-mining', { headers: { Authorization: `Bearer ${accessToken}` } });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || 'Gagal memuat.');
        setAccessDenied(response.status === 403);
        setCheckingAccess(false);
        return;
      }
      setData(body);
      setCheckingAccess(false);
    };
    checkAccessAndLoad();
  }, [router, getAccessToken]);

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="px-6 text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="max-w-3xl px-6">
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em] text-destructive">Akses Ditolak</CardDescription>
              <CardTitle className="text-2xl">Process Mining</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Halaman internal ini khusus company_admin atau general_manager.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="flex w-full flex-col gap-6 px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Internal — Tim Inti</p>
          <h1 className="text-2xl font-semibold text-foreground">Process Mining</h1>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {data ? (
          <>
            <Card>
              <CardContent className="flex flex-col gap-1 pt-6">
                <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Dasar Data
                  <ProvenanceInfoButton
                    label="Dasar Data Process Mining"
                    envelope={{
                      formula: 'COUNT seluruh baris status_transition_log perusahaan ini (semua tabel/status digabung). Rentang hari = tanggal transisi terbaru − tanggal transisi tertua. Analisis tren di bawah baru ditampilkan kalau rentang ≥14 hari (konsisten dengan ambang KPI baseline lain di sistem ini).',
                      inputs: [
                        { label: 'Total transisi', value: String(data.total_transitions) },
                        { label: 'Sejak', value: data.earliest_transition_at?.slice(0, 10) ?? '-' },
                        { label: 'Terbaru', value: data.latest_transition_at?.slice(0, 10) ?? '-' }
                      ]
                    }}
                  />
                </span>
                <span className="text-lg font-medium text-foreground">
                  Berdasarkan {data.total_transitions} transisi status
                  {data.earliest_transition_at ? ` sejak ${data.earliest_transition_at.slice(0, 10)}` : ''}
                </span>
                {!data.data_sufficient_for_trend_analysis ? (
                  <Badge variant="warning" className="w-fit">
                    Data belum cukup untuk analisis tren (rentang &lt;14 hari)
                  </Badge>
                ) : null}
                {data.notes.map((note, idx) => (
                  <p key={idx} className="text-xs italic text-muted-foreground">
                    {note}
                  </p>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription className="uppercase tracking-[0.2em]">Penumpukan</CardDescription>
                <CardTitle className="flex items-center gap-1 text-lg">
                  Durasi Rata-Rata per Status (diurutkan terlama)
                  <ProvenanceInfoButton
                    label="Durasi Rata-Rata per Status"
                    envelope={{
                      formula:
                        'Rata-rata selisih waktu antar transisi status berurutan di status_transition_log, per kombinasi tabel+status. Hanya ditampilkan sebagai angka kalau sampelnya ≥3 (ambang MIN_SAMPLES_FOR_DURATION) — di bawah itu ditandai "data belum cukup", BUKAN dirata-rata dari sampel terlalu sedikit yang bisa kebetulan.',
                      inputs: [{ label: 'Ambang minimal sampel', value: '3 per status' }],
                      sourceDocument: 'computeProcessMiningInsights.ts'
                    }}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {data.status_durations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada pasangan transisi berurutan untuk dihitung durasinya.</p>
                ) : (
                  data.status_durations.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span>
                        {getEntityLabel(d.table_name)} — {statusLabel(d.status)}
                      </span>
                      <span className="font-medium">
                        {d.avg_duration_hours === null ? (
                          <span className="italic text-muted-foreground">data belum cukup ({formatNumberId(d.sample_count, 0)} sampel)</span>
                        ) : (
                          `${formatHours(d.avg_duration_hours)} (${formatNumberId(d.sample_count, 0)} sampel)`
                        )}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription className="uppercase tracking-[0.2em]">Transisi</CardDescription>
                <CardTitle className="flex items-center gap-1 text-lg">
                  Transisi Paling Sering
                  <ProvenanceInfoButton
                    label="Transisi Paling Sering"
                    envelope={{
                      formula: 'Jumlah baris status_transition_log dikelompokkan per tabel+status asal+status tujuan, diurutkan dari yang paling sering, ditampilkan 10 teratas.',
                      inputs: [{ label: 'Ditampilkan', value: '10 kombinasi tersering' }],
                      sourceDocument: 'computeProcessMiningInsights.ts'
                    }}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {data.transition_counts.slice(0, 10).map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>
                      {getEntityLabel(t.table_name)}: {statusLabel(t.from_status)} → {statusLabel(t.to_status)}
                    </span>
                    <span className="font-medium">{formatNumberId(t.count, 0)}×</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription className="uppercase tracking-[0.2em]">Perhatian</CardDescription>
                <CardTitle className="flex items-center gap-1 text-lg">
                  Transisi Mundur / Dibatalkan
                  <ProvenanceInfoButton
                    label="Transisi Mundur / Dibatalkan"
                    envelope={{
                      formula: 'Dari daftar "Transisi Paling Sering", disaring hanya yang status TUJUANnya salah satu dari: cancelled, rejected, batal, draft — daftar tetap di kode (bukan dari data), supaya mudah diaudit.',
                      inputs: [{ label: 'Status tujuan yang dihitung', value: 'cancelled, rejected, batal, draft' }],
                      sourceDocument: 'computeProcessMiningInsights.ts'
                    }}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {data.backward_or_cancelled_transitions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada transisi mundur/dibatalkan tercatat.</p>
                ) : (
                  data.backward_or_cancelled_transitions.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>
                        {getEntityLabel(t.table_name)}: {statusLabel(t.from_status)} → {statusLabel(t.to_status)}
                      </span>
                      <span className="font-medium">{formatNumberId(t.count, 0)}×</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </main>
  );
}

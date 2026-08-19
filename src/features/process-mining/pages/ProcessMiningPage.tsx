'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  if (hours < 48) return `${hours.toFixed(1)} jam`;
  return `${(hours / 24).toFixed(1)} hari`;
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
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Dasar Data</span>
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
                <CardTitle className="text-lg">Durasi Rata-Rata per Status (diurutkan terlama)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {data.status_durations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada pasangan transisi berurutan untuk dihitung durasinya.</p>
                ) : (
                  data.status_durations.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span>
                        {d.table_name}.{d.status}
                      </span>
                      <span className="font-medium">
                        {d.avg_duration_hours === null ? (
                          <span className="italic text-muted-foreground">data belum cukup ({d.sample_count} sampel)</span>
                        ) : (
                          `${formatHours(d.avg_duration_hours)} (${d.sample_count} sampel)`
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
                <CardTitle className="text-lg">Transisi Paling Sering</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {data.transition_counts.slice(0, 10).map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>
                      {t.table_name}: {t.from_status} → {t.to_status}
                    </span>
                    <span className="font-medium">{t.count}×</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription className="uppercase tracking-[0.2em]">Perhatian</CardDescription>
                <CardTitle className="text-lg">Transisi Mundur / Dibatalkan</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {data.backward_or_cancelled_transitions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada transisi mundur/dibatalkan tercatat.</p>
                ) : (
                  data.backward_or_cancelled_transitions.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>
                        {t.table_name}: {t.from_status} → {t.to_status}
                      </span>
                      <span className="font-medium">{t.count}×</span>
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

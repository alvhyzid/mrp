'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { canViewFinancialData } from '@/lib/roles';
import { formatCurrency } from '@/lib/currency';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';

const monthLabels = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

type OperatingProfitResult = {
  total_margin: number;
  overhead: number;
  operating_profit: number;
  period_start: string;
  period_end: string;
};

function formatDateId(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OperatingProfitPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [result, setResult] = useState<OperatingProfitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadResult = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setLoading(true);
    const response = await fetch(`/api/reports/monthly-operating-profit?year=${year}&month=${month}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Gagal memuat Laba Operasional.');
      setLoading(false);
      return;
    }
    setResult(data);
    setError('');
    setLoading(false);
  }, [getAccessToken, year, month]);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/operating-profit');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      if (!meResponse.ok || !canViewFinancialData(meData?.user?.role)) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }
      setCheckingAccess(false);
      await loadResult();
    };
    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!checkingAccess && !accessDenied) {
      loadResult();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

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
              <CardTitle className="text-2xl">Laba Operasional</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Halaman ini khusus company_admin, general_manager, atau finance_manager.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="flex w-full flex-col gap-6 px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Laporan Finance</p>
          <h1 className="text-2xl font-semibold text-foreground">Laba Operasional</h1>
        </div>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Pilih Periode</CardDescription>
            <CardTitle className="text-xl">
              {monthLabels[month - 1]} {year}
              {result ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({formatDateId(result.period_start)} — {formatDateId(result.period_end)})
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthLabels.map((label, idx) => (
                  <SelectItem key={label} value={String(idx + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : result ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex flex-col gap-1 pt-6">
                <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Margin Kontribusi (Realized)
                  <ProvenanceInfoButton
                    label="Margin Kontribusi Bulanan"
                    envelope={{
                      formula:
                        'Σ (qty_shipped × (harga jual per unit − unit_cost lot yang dikirim)) untuk semua baris pengiriman berstatus terkirim/diterima dalam periode ini. unit_cost diambil dari lot aktual yang dikirim (biaya sungguhan lot itu, bukan standar) — kalau lot belum punya unit_cost, dianggap 0 di baris itu.',
                      inputs: [{ label: 'Periode', value: `${formatDateId(result.period_start)} – ${formatDateId(result.period_end)}` }],
                      sourceDocument: 'get_monthly_operating_profit (migration 20260821140000)'
                    }}
                  />
                </span>
                <span className="text-2xl font-semibold text-foreground">{formatCurrency(result.total_margin, { maxDecimals: 0 })}</span>
                <span className="text-xs text-muted-foreground">Dari semua pengiriman yang sudah keluar gudang di periode ini</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 pt-6">
                <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Overhead SDM
                  <ProvenanceInfoButton
                    label="Overhead SDM Bulanan"
                    envelope={{
                      formula: 'Nilai tetap dari company_settings.monthly_overhead_baseline untuk periode ini — TIDAK dialokasikan ke batch/order tertentu di v1 (overhead_allocation="off").',
                      inputs: [{ label: 'Periode', value: `${formatDateId(result.period_start)} – ${formatDateId(result.period_end)}` }],
                      sourceDocument: 'docs/spesifikasi-aturan-biaya-v1.md (K2 Tingkat 2)'
                    }}
                  />
                </span>
                <span className="text-2xl font-semibold text-foreground">{formatCurrency(result.overhead, { maxDecimals: 0 })}</span>
                <span className="text-xs text-muted-foreground">Angka standar bulanan (belum alokasi per batch)</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 pt-6">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Laba Operasional</span>
                <span className={`text-2xl font-semibold ${result.operating_profit < 0 ? 'text-destructive' : 'text-success'}`}>
                  {formatCurrency(result.operating_profit, { maxDecimals: 0 })}
                </span>
                <span className="text-xs text-muted-foreground">Margin Kontribusi − Overhead SDM</span>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </main>
  );
}

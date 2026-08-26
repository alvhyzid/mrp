'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Breadcrumb, BreadcrumbItem, Dropdown, InlineNotification, SkeletonText, Tile } from '@carbon/react';
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
      <div className="halaman">
        <SkeletonText heading width="16rem" />
        <SkeletonText paragraph lineCount={3} />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <h1 className="halaman__judul">Laba operasional</h1>
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="Halaman ini khusus pimpinan perusahaan dan Manajer Finance"
          subtitle="Akun Anda tidak punya izin melihat angka laba operasional."
        />
      </div>
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  // Tiga kartu angka disusun dari satu daftar, bukan tiga blok yang disalin. Panel Asal-Usul
  // ikut per kartu -- setiap angka keuangan wajib bisa menjawab "ini metode apa".
  const kartu = result
    ? [
        {
          kunci: 'margin',
          label: 'Margin kontribusi (terealisasi)',
          nilai: formatCurrency(result.total_margin, { maxDecimals: 0 }),
          keterangan: 'Dari semua pengiriman yang sudah keluar gudang di periode ini',
          waspada: false,
          asalUsul: {
            label: 'Margin Kontribusi Bulanan',
            envelope: {
              formula:
                'Σ (qty_shipped × (harga jual per unit − unit_cost lot yang dikirim)) untuk semua baris pengiriman berstatus terkirim/diterima dalam periode ini. unit_cost diambil dari lot aktual yang dikirim (biaya sungguhan lot itu, bukan standar) — kalau lot belum punya unit_cost, dianggap 0 di baris itu.',
              inputs: [{ label: 'Periode', value: `${formatDateId(result.period_start)} – ${formatDateId(result.period_end)}` }],
              sourceDocument: 'get_monthly_operating_profit (migration 20260821140000)'
            }
          }
        },
        {
          kunci: 'overhead',
          label: 'Overhead SDM',
          nilai: formatCurrency(result.overhead, { maxDecimals: 0 }),
          keterangan: 'Angka standar bulanan (belum dialokasikan per batch)',
          waspada: false,
          asalUsul: {
            label: 'Overhead SDM Bulanan',
            envelope: {
              formula:
                'Nilai tetap dari company_settings.monthly_overhead_baseline untuk periode ini — TIDAK dialokasikan ke batch/order tertentu di v1 (overhead_allocation="off").',
              inputs: [{ label: 'Periode', value: `${formatDateId(result.period_start)} – ${formatDateId(result.period_end)}` }],
              sourceDocument: 'docs/spesifikasi-aturan-biaya-v1.md (K2 Tingkat 2)'
            }
          }
        },
        {
          kunci: 'laba',
          label: 'Laba operasional',
          nilai: formatCurrency(result.operating_profit, { maxDecimals: 0 }),
          keterangan: 'Margin kontribusi − overhead SDM',
          waspada: result.operating_profit < 0,
          asalUsul: {
            label: 'Laba Operasional',
            envelope: {
              formula:
                'Margin Kontribusi (Realized) − Overhead SDM, keduanya untuk periode yang sama. Bukan angka tersimpan sendiri — hasil pengurangan langsung dari dua kartu di sebelahnya.',
              inputs: [
                { label: 'Margin Kontribusi', value: formatCurrency(result.total_margin, { maxDecimals: 0 }) },
                { label: 'Overhead SDM', value: formatCurrency(result.overhead, { maxDecimals: 0 }) }
              ]
            }
          }
        }
      ]
    : [];

  return (
    <div className="halaman">
      <Breadcrumb noTrailingSlash className="halaman__remah">
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <span className="cds--link halaman__remah-mati">Finance &amp; Costing</span>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Operating Profit</BreadcrumbItem>
      </Breadcrumb>

      <div>
        <h1 className="halaman__judul">Laba operasional</h1>
        <p className="halaman__pengantar">
          {monthLabels[month - 1]} {year}
          {result ? ` — periode ${formatDateId(result.period_start)} sampai ${formatDateId(result.period_end)}` : ''}.
          Periodenya mengikuti tanggal gajian perusahaan, bukan bulan kalender.
        </p>
      </div>

      <div className="laba-periode">
        <Dropdown
          id="laba-bulan"
          size="lg"
          titleText="Bulan"
          label="Pilih bulan"
          items={monthLabels.map((_, idx) => idx + 1)}
          selectedItem={month}
          itemToString={(item: number) => monthLabels[item - 1]}
          onChange={({ selectedItem }: { selectedItem: number | null }) => selectedItem && setMonth(selectedItem)}
        />
        <Dropdown
          id="laba-tahun"
          size="lg"
          titleText="Tahun"
          label="Pilih tahun"
          items={years}
          selectedItem={year}
          itemToString={(item: number) => String(item)}
          onChange={({ selectedItem }: { selectedItem: number | null }) => selectedItem && setYear(selectedItem)}
        />
      </div>

      {error ? <InlineNotification kind="error" lowContrast title="Gagal memuat" subtitle={error} hideCloseButton /> : null}

      {loading ? (
        <SkeletonText paragraph lineCount={3} />
      ) : result ? (
        <div className="kisi-metrik laba-kisi">
          {kartu.map((k) => (
            <Tile key={k.kunci}>
              <span className="metrik__label laba-label">
                {k.label}
                <ProvenanceInfoButton label={k.asalUsul.label} envelope={k.asalUsul.envelope} />
              </span>
              <span className={`metrik__angka ${k.waspada ? 'metrik__angka--waspada' : ''}`}>{k.nilai}</span>
              <p className="halaman__redup laba-keterangan">{k.keterangan}</p>
            </Tile>
          ))}
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { Tag, Tile } from '@carbon/react';
import { ProvenanceInfoButton, type DefinitionTabData, type KpiTabData } from '@/components/ui/provenance-info-button';
import type { ProvenanceEnvelope } from '@/lib/provenance';

const pillarLabels: Record<string, string> = {
  EFISIENSI: 'Efisiensi',
  OPTIMASI: 'Optimasi',
  TRANSPARANSI: 'Transparansi',
  IMPROVEMENT: 'Improvement',
  RECORD: 'Record'
};

// Bentuk kartu KPI standar (docs/rencana-kerja-kpi.md §2, penyerahan-opus-fitur-kpi.md
// §1.2): nilai kini + target + delta vs periode lalu + sparkline. Aturan visual Zebra
// BI ditegakkan DI SINI (bukan cuma panduan): sparkline SVG polos (garis, bukan area
// 3D), TIDAK ADA pie/3D/gridline berlebihan, sumbu tersirat mulai dari titik data
// terendah -- garis polos tanpa dekorasi.
export function KpiCard({
  title,
  pillar,
  value,
  formatValue,
  targetValue,
  benchmarkValue,
  benchmarkLabel,
  delta,
  higherIsBetter,
  sparkline,
  complete,
  frequency,
  provenanceEnvelope,
  definition,
  kpiTab
}: {
  title: string;
  pillar: string;
  value: number | null;
  formatValue: (v: number) => string;
  targetValue: number | null;
  benchmarkValue: number | null;
  benchmarkLabel: string | null;
  delta: number | null;
  higherIsBetter: boolean | null;
  sparkline: { period_start: string; value: number | null }[];
  complete: boolean;
  frequency: string;
  provenanceEnvelope: ProvenanceEnvelope;
  definition: DefinitionTabData | null;
  kpiTab: KpiTabData;
}) {
  const points = sparkline.filter((s) => s.value !== null) as { period_start: string; value: number }[];
  // Warna selisih mengikuti ARTI, bukan tanda plus/minus: untuk sebagian KPI turun itu BAIK
  // (mis. biaya per unit). higherIsBetter null berarti arahnya memang belum ditetapkan --
  // dan angka yang arahnya tidak diketahui TIDAK boleh diwarnai seolah sudah dinilai.
  const deltaClass =
    delta === null || higherIsBetter === null
      ? 'kartu-kpi__selisih'
      : (delta >= 0) === higherIsBetter
        ? 'kartu-kpi__selisih kartu-kpi__selisih--baik'
        : 'kartu-kpi__selisih kartu-kpi__selisih--buruk';

  return (
    <Tile className="kartu-kpi">
      <div className="kartu-kpi__kepala">
        <span className="metrik__label kartu-kpi__judul">
          {title}
          <ProvenanceInfoButton label={title} envelope={provenanceEnvelope} definition={definition} kpi={kpiTab} />
        </span>
        <Tag type="cool-gray">{pillarLabels[pillar] ?? pillar}</Tag>
      </div>

      <span className="metrik__angka">{value !== null ? formatValue(value) : 'Belum bisa dihitung'}</span>

      {/* "Data belum lengkap" WAJIB terlihat sebagai peringatan, bukan keterangan biasa:
          angka yang dihitung dari data separuh terlihat sama meyakinkannya dengan yang utuh. */}
      {!complete ? (
        <span className="kartu-kpi__belum-lengkap">
          Data belum lengkap — angka ini dihitung dari yang tersedia, bukan final.
        </span>
      ) : null}

      <div className="kartu-kpi__banding">
        <span>
          Target: <strong>{targetValue !== null ? formatValue(targetValue) : 'belum ditetapkan, baseline berjalan'}</strong>
        </span>
        {benchmarkValue !== null ? (
          <span>
            Pembanding industri: <strong>{formatValue(benchmarkValue)}</strong> ({benchmarkLabel ?? 'arah, bukan kontrak'})
          </span>
        ) : null}
        {delta !== null ? (
          <span className={deltaClass}>
            Selisih: {delta >= 0 ? '+' : ''}
            {formatValue(delta)} dibanding periode lalu
          </span>
        ) : null}
      </div>

      {points.length >= 2 ? <Sparkline points={points.map((p) => p.value)} /> : null}

      <span className="halaman__redup">Frekuensi: {frequency.charAt(0) + frequency.slice(1).toLowerCase()}</span>
    </Tile>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const width = 160;
  const height = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="kartu-kpi__grafik" aria-hidden="true">
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  const deltaColor = delta === null || higherIsBetter === null ? 'text-muted-foreground' : (delta >= 0) === higherIsBetter ? 'text-success' : 'text-destructive';

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{title}</span>
            <ProvenanceInfoButton label={title} envelope={provenanceEnvelope} definition={definition} kpi={kpiTab} />
          </div>
          <Badge variant="secondary">{pillarLabels[pillar] ?? pillar}</Badge>
        </div>

        <span className="text-2xl font-semibold text-foreground">{value !== null ? formatValue(value) : 'Belum bisa dihitung'}</span>
        {!complete ? <span className="text-xs text-warning-subtle-foreground">Data belum lengkap -- angka ini dihitung dari yang tersedia, bukan final.</span> : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            Target: <span className="font-medium text-foreground">{targetValue !== null ? formatValue(targetValue) : 'belum ditetapkan, baseline berjalan'}</span>
          </span>
          {benchmarkValue !== null ? (
            <span>
              Benchmark: <span className="font-medium text-foreground">{formatValue(benchmarkValue)}</span> ({benchmarkLabel ?? 'arah, bukan kontrak'})
            </span>
          ) : null}
          {delta !== null ? (
            <span className={deltaColor}>
              Delta: {delta >= 0 ? '+' : ''}
              {formatValue(delta)} vs periode lalu
            </span>
          ) : null}
        </div>

        {points.length >= 2 ? <Sparkline points={points.map((p) => p.value)} /> : null}

        <span className="text-xs text-muted-foreground">Frekuensi: {frequency.charAt(0) + frequency.slice(1).toLowerCase()}</span>
      </CardContent>
    </Card>
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
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-primary" aria-hidden="true">
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

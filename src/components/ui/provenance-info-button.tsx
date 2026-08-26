'use client';

import { useState } from 'react';
import { Information } from '@carbon/icons-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { ProvenanceEnvelope } from '@/lib/provenance';
import { humanizeProvenanceText, getRoleLabel } from '@/lib/glossary';
import { useIsCompanyAdmin } from '@/lib/useIsCompanyAdmin';

const standardStatusLabels: Record<string, string> = {
  ESTIMASI_MANUAL: 'Estimasi Manual',
  DIPELAJARI: 'Dipelajari dari Data Nyata'
};

// Tab "Definisi" (opsional -- revisi-kpi-visibilitas-tanggung-jawab.md §3) --
// arti bisnis dari kamus (K1). Cuma ditampilkan kalau baris kamus_terms-nya
// dikirim si pemanggil.
export interface DefinitionTabData {
  termKey: string;
  businessAnswer: string | null; // kamus_terms.answer_plain -- null kalau belum dijawab
  draft: string | null; // kamus_terms.ai_draft -- fallback kalau belum ada jawaban resmi
  status: string;
}

// Tab "KPI & Tanggung Jawab" (opsional, §3) -- HANYA muncul bila angka ini
// terdaftar sebagai KPI (kpi_registry). Nilai/target/benchmark/tren SUDAH
// dihitung pemanggil (KpiCard) -- komponen ini murni presentasional.
export interface KpiTabData {
  valueLabel: string;
  targetLabel: string | null;
  benchmarkLabel: string | null;
  deltaLabel: string | null;
  attributionLevel: string;
  responsibilities: { role: string | null; responsibility: string; note: string | null }[];
  improvementLevers: string[];
  openActions: { finding: string; actionText: string; dueDate: string | null }[];
}

// Panel Asal-Usul (docs/langkah-membangun-fitur-ai.md Langkah 0.3, D1) -- "klik
// angka -> lihat rumus, nilai input, dokumen sumber, riwayat perubahan, status K8".
// SATU affordance per angka (revisi §3: "jangan tiga ikon kecil berjejer") --
// diperluas jadi panel BERTAB opsional (Definisi / Asal-usul / KPI & Tanggung
// Jawab) alih-alih komponen ketiga berdiri sendiri. Tab bar HANYA muncul kalau
// lebih dari satu tab punya data -- ~50 pemanggil lama yang cuma kirim `envelope`
// tetap tampil PERSIS seperti sebelumnya (satu panel, tanpa tab), zero regresi.
export function ProvenanceInfoButton({
  envelope,
  label,
  definition,
  kpi
}: {
  envelope: ProvenanceEnvelope;
  label?: string;
  definition?: DefinitionTabData | null;
  kpi?: KpiTabData | null;
}) {
  const [open, setOpen] = useState(false);
  const [showTechnicalDetail, setShowTechnicalDetail] = useState(false);
  const isCompanyAdmin = useIsCompanyAdmin();
  const tabs = [
    { key: 'definisi' as const, title: 'Definisi', available: !!definition },
    { key: 'asal-usul' as const, title: 'Asal-usul', available: true },
    { key: 'kpi' as const, title: 'KPI & Tanggung Jawab', available: !!kpi }
  ].filter((t) => t.available);
  const [activeTab, setActiveTab] = useState<'definisi' | 'asal-usul' | 'kpi'>(definition ? 'definisi' : 'asal-usul');
  const showTabBar = tabs.length > 1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label ? `Lihat asal angka: ${label}` : 'Lihat asal angka'}
        className="inline-flex items-center text-muted-foreground hover:text-foreground"
      >
        <Information size={16} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{label ?? 'Asal Angka Ini'}</DialogTitle>
          </DialogHeader>
          {showTabBar ? (
            <div className="-mt-2 flex gap-1 border-b">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wide ${
                    activeTab === t.key ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          ) : null}

          {definition && (!showTabBar || activeTab === 'definisi') ? (
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Arti Bisnis</p>
                <p>{definition.businessAnswer ?? definition.draft ?? 'Belum ada penjelasan tersimpan.'}</p>
                {!definition.businessAnswer && definition.draft ? <p className="mt-1 text-xs italic text-muted-foreground">Draf awal, belum dikonfirmasi manusia.</p> : null}
              </div>
            </div>
          ) : null}

          {!showTabBar || activeTab === 'asal-usul' ? (
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rumus</p>
                <p>{humanizeProvenanceText(envelope.formula)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nilai Input</p>
                <ul className="flex flex-col gap-0.5">
                  {envelope.inputs.map((input, idx) => (
                    <li key={idx} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{humanizeProvenanceText(input.label)}</span>
                      <span className="font-medium">{input.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {envelope.standardStatus ? <Badge variant="secondary">{standardStatusLabels[envelope.standardStatus] ?? envelope.standardStatus}</Badge> : null}
              {envelope.history && envelope.history.length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Riwayat</p>
                  <ul className="flex flex-col gap-0.5 text-xs">
                    {envelope.history.map((h, idx) => (
                      <li key={idx}>
                        {h.changedAt}: {h.note}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">Riwayat perubahan belum terlacak untuk angka ini.</p>
              )}
            </div>
          ) : null}

          {activeTab === 'kpi' && kpi ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Nilai kini</p>
                  <p className="font-medium text-foreground">{kpi.valueLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target</p>
                  <p className="font-medium text-foreground">{kpi.targetLabel ?? 'belum ditetapkan, baseline berjalan'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Benchmark industri</p>
                  <p className="font-medium text-foreground">{kpi.benchmarkLabel ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Delta vs periode lalu</p>
                  <p className="font-medium text-foreground">{kpi.deltaLabel ?? '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tingkat Atribusi</p>
                <p className="text-xs">{kpi.attributionLevel}</p>
              </div>
              {kpi.responsibilities.length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pemilik &amp; Kontributor</p>
                  <ul className="flex flex-col gap-0.5 text-xs">
                    {kpi.responsibilities.map((r, idx) => (
                      <li key={idx}>
                        {r.responsibility}: {getRoleLabel(r.role)}
                        {r.note ? ` — ${r.note}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {kpi.improvementLevers.length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cara Menaikkan KPI Ini</p>
                  <ul className="list-disc pl-4 text-xs">
                    {kpi.improvementLevers.map((lever, idx) => (
                      <li key={idx}>{lever}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {kpi.openActions.length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tindakan Terbuka</p>
                  <ul className="flex flex-col gap-0.5 text-xs">
                    {kpi.openActions.map((a, idx) => (
                      <li key={idx}>
                        {a.finding} — {a.actionText}
                        {a.dueDate ? ` (tenggat ${a.dueDate})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">Tidak ada tindakan terbuka terkait KPI ini.</p>
              )}
            </div>
          ) : null}

          {/* penjaga-kebocoran:mulai
              Sesi 6 (21 Agu 2026, 6.4) — identifier tabel/kolom mentah TIDAK
              PERNAH dihapus dari sistem (fondasi Kamus & Fase AI), tapi
              dipindah ke sini: tertutup secara default, dan HANYA DIRENDER
              SAMA SEKALI (bukan disembunyikan CSS) kalau isCompanyAdmin true --
              non-admin tidak akan menemukan identifier ini bahkan di HTML. */}
          {isCompanyAdmin && (!showTabBar || activeTab === 'asal-usul' || activeTab === 'definisi') ? (
            <div className="mt-1 border-t pt-2">
              <button
                type="button"
                onClick={() => setShowTechnicalDetail((v) => !v)}
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
              >
                {showTechnicalDetail ? '▾' : '▸'} Detail Teknis
              </button>
              {showTechnicalDetail ? (
                <div className="mt-2 flex flex-col gap-2 text-xs">
                  {definition ? (
                    <p className="font-mono text-muted-foreground">Kamus: {definition.termKey}</p>
                  ) : null}
                  {(!showTabBar || activeTab === 'asal-usul') ? (
                    <>
                      <p className="font-mono text-muted-foreground">Rumus mentah: {envelope.formula}</p>
                      {envelope.sourceDocument ? <p className="font-mono text-muted-foreground">Sumber kode/dokumen: {envelope.sourceDocument}</p> : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {/* penjaga-kebocoran:selesai */}
        </DialogContent>
      </Dialog>
    </>
  );
}

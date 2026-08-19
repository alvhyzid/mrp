'use client';

import { useState } from 'react';
import { Information } from '@carbon/icons-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { ProvenanceEnvelope } from '@/lib/provenance';

const standardStatusLabels: Record<string, string> = {
  ESTIMASI_MANUAL: 'Estimasi Manual',
  DIPELAJARI: 'Dipelajari dari Data Nyata'
};

// Panel Asal-Usul (docs/langkah-membangun-fitur-ai.md Langkah 0.3, D1) --
// "klik angka -> lihat rumus, nilai input, dokumen sumber, riwayat perubahan,
// status K8". Ikon kecil di sebelah angka manapun yang punya ProvenanceEnvelope
// -- SATU komponen generik dipakai lintas modul (BOM, Margin Watch, dst),
// bukan diimplementasikan ulang tiap tempat.
export function ProvenanceInfoButton({ envelope, label }: { envelope: ProvenanceEnvelope; label?: string }) {
  const [open, setOpen] = useState(false);
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
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rumus</p>
              <p>{envelope.formula}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nilai Input</p>
              <ul className="flex flex-col gap-0.5">
                {envelope.inputs.map((input, idx) => (
                  <li key={idx} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{input.label}</span>
                    <span className="font-medium">{input.value}</span>
                  </li>
                ))}
              </ul>
            </div>
            {envelope.sourceDocument ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dokumen Sumber</p>
                <p className="font-mono text-xs">{envelope.sourceDocument}</p>
              </div>
            ) : null}
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
        </DialogContent>
      </Dialog>
    </>
  );
}

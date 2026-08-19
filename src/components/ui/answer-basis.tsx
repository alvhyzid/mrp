import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

// Komponen AnswerBasis (docs/spesifikasi-kesiapan-ai-tenant.md §3.5, §1.6) --
// "setiap jawaban AI wajib menyertakan baris dasar, termasuk bila dasarnya
// kurang." DISIAPKAN SEKARANG, belum dipakai fitur AI apa pun (belum ada yang
// menjawab pakai LLM di proyek ini) -- generik lintas modul, sama seperti
// ProvenanceInfoButton disiapkan sebelum semua retrofit selesai.
export interface AnswerBasisProps {
  // Jumlah data pendasar, mis. "8 batch tercatat sejak 1 Agustus".
  sampleBasisText: string;
  // Status istilah terkait di kamus -- null kalau jawaban ini tidak bergantung pada 1 istilah tertentu.
  kamusTermStatus?: 'BELUM' | 'DRAF_AI' | 'DIJAWAB' | 'DIKONFIRMASI' | 'TIDAK_RELEVAN' | null;
  kamusTermId?: number | null;
  // Status standar K8 terkait -- null kalau jawaban ini tidak bergantung pada satu standar tertentu.
  k8Status?: 'ESTIMASI_MANUAL' | 'DIPELAJARI' | null;
}

export function AnswerBasis({ sampleBasisText, kamusTermStatus, kamusTermId, k8Status }: AnswerBasisProps) {
  const kamusUndefined = kamusTermStatus && kamusTermStatus !== 'DIKONFIRMASI';

  return (
    <div className="flex flex-col gap-1.5 border-t pt-2 text-xs text-muted-foreground">
      <p>Berdasarkan {sampleBasisText}.</p>
      {kamusUndefined ? (
        <div className="flex items-center gap-2">
          <Badge variant="warning">Istilah belum didefinisikan di kamus Anda</Badge>
          <p>Jawaban berdasarkan pemahaman umum, bukan definisi pabrik Anda.</p>
          {kamusTermId ? (
            <Link href={`/kamus?priority=1`} className="font-medium text-foreground underline">
              Definisikan sekarang
            </Link>
          ) : null}
        </div>
      ) : null}
      {k8Status === 'ESTIMASI_MANUAL' ? <Badge variant="secondary">Standar kapasitas masih ESTIMASI_MANUAL, belum dipelajari dari produksi nyata.</Badge> : null}
    </div>
  );
}

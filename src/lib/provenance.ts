// Tipe ProvenanceEnvelope (docs/langkah-membangun-fitur-ai.md Langkah 0.2, D0
// Drop-AI) -- bentuk generik utk menjelaskan asal-usul SATU angka yang
// ditampilkan ke pengguna: rumus, nilai input yang dipakai, dokumen sumber,
// riwayat perubahan, status standar (K8: ESTIMASI_MANUAL/DIPELAJARI). Prinsip
// baru proyek ini (build-for-real-tenant-not-speculative-abstraction):
// tipe ini KECIL & KONKRET, tidak mencoba menggeneralisasi lebih dari yang
// dibutuhkan sekarang.
export interface ProvenanceEnvelope {
  /** Rumus/formula dlm bahasa manusia, mis. "kru harian ÷ batch/hari ÷ unit/batch". */
  formula: string;
  /** Nilai input yang benar-benar dipakai menghasilkan angka ini. */
  inputs: { label: string; value: string }[];
  /** Rujukan dokumen sumber resmi, kalau ada (mis. "docs/spesifikasi-aturan-biaya-v1.md §3"). */
  sourceDocument?: string;
  /** Status standar K8 -- null/undefined kalau tidak relevan (bukan angka standar). */
  standardStatus?: 'ESTIMASI_MANUAL' | 'DIPELAJARI' | null;
  /** Riwayat perubahan, kalau tersedia (opsional -- banyak angka belum punya riwayat terlacak). */
  history?: { changedAt: string; note: string }[];
}

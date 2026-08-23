// URUTAN DAFTAR TUGAS (Bagian II.3 & II.4) — DIPISAH dari komponen halaman supaya
// bisa diuji tanpa merender apa pun.
//
// KENAPA DIPISAH: aturan urutannya bukan detail tampilan, melainkan ATURAN MAKNA.
// "Mendesak" harus di atas "Penting" karena artinya lebih mendesak, bukan karena M
// sebelum P di abjad. Aturan semacam itu terlalu mudah rusak diam-diam saat komponen
// diutak-atik, dan kerusakannya TIDAK terlihat sebagai error — cuma sebagai urutan
// yang terasa aneh dan biasanya tidak ada yang mengadukannya.

export type BuildTaskUrgency = 'super_urgent' | 'mendesak' | 'penting' | 'bisa_menunggu' | 'tidak_mendesak';
export type BuildTaskStatus =
  | 'menunggu'
  | 'sedang_dikerjakan'
  | 'menunggu_persetujuan'
  | 'selesai'
  | 'ditunda_sadar'
  | 'dibatalkan';

export type SortKey = 'task_code' | 'name' | 'status' | 'urgency' | 'pic' | 'age';

export interface SortableTask {
  task_code: string;
  name: string;
  pic: string;
  urgency: BuildTaskUrgency;
  status: BuildTaskStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  approved_at: string | null;
}

// SATU-SATUNYA sumber urutan urgensi. Menyortir "Mendesak" dan "Penting" secara abjad
// tidak berarti apa-apa.
export const URGENCY_RANK: Record<BuildTaskUrgency, number> = {
  super_urgent: 0,
  mendesak: 1,
  penting: 2,
  bisa_menunggu: 3,
  tidak_mendesak: 4
};

// Urutan status mengikuti ALUR KERJA, bukan abjad: yang sedang berjalan di atas, yang
// sudah tutup buku di bawah.
export const STATUS_RANK: Record<BuildTaskStatus, number> = {
  sedang_dikerjakan: 0,
  menunggu_persetujuan: 1,
  menunggu: 2,
  ditunda_sadar: 3,
  selesai: 4,
  dibatalkan: 5
};

export function isTaskUnresolved(status: BuildTaskStatus) {
  return status !== 'selesai' && status !== 'dibatalkan';
}

// Jumlah HARI menggantung, untuk MENYORTIR. Sengaja berbeda dari teks yang dibaca
// manusia ("3 hari"): menyortir teks akan menaruh "10 hari" sebelum "2 hari", karena
// sebagai huruf "1" memang sebelum "2".
export function ageInDays(task: SortableTask, sekarang = Date.now()): number {
  let since: string | null = null;
  if (task.status === 'menunggu') since = task.created_at;
  else if (task.status === 'sedang_dikerjakan') since = task.started_at ?? task.created_at;
  else if (task.status === 'menunggu_persetujuan') since = task.completed_at ?? task.created_at;
  else if (task.status === 'selesai') since = task.approved_at ?? task.completed_at;
  if (!since) return -1;
  return Math.max(0, Math.floor((sekarang - new Date(since).getTime()) / (1000 * 60 * 60 * 24)));
}

// sortKey null = URUTAN DEFAULT (bukan "belum disortir"): SUPER URGENT yang belum
// selesai selalu paling atas, lalu yang belum selesai, lalu urgensi dari atas.
export function sortBuildTasks<T extends SortableTask>(
  list: T[],
  sortKey: SortKey | null,
  sortDir: 'asc' | 'desc',
  sekarang = Date.now()
): T[] {
  const out = [...list];
  if (!sortKey) {
    out.sort((a, b) => {
      const aSuper = a.urgency === 'super_urgent' && isTaskUnresolved(a.status);
      const bSuper = b.urgency === 'super_urgent' && isTaskUnresolved(b.status);
      if (aSuper !== bSuper) return aSuper ? -1 : 1;
      const aOpen = isTaskUnresolved(a.status);
      const bOpen = isTaskUnresolved(b.status);
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
      if (u !== 0) return u;
      return a.task_code.localeCompare(b.task_code);
    });
    return out;
  }
  const arah = sortDir === 'asc' ? 1 : -1;
  out.sort((a, b) => {
    let c = 0;
    if (sortKey === 'urgency') c = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    else if (sortKey === 'status') c = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    else if (sortKey === 'age') c = ageInDays(a, sekarang) - ageInDays(b, sekarang);
    else c = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), 'id');
    // Pemutus seri TETAP kode task, supaya urutan tidak berubah-ubah antar render
    // untuk data yang sama.
    if (c === 0) c = a.task_code.localeCompare(b.task_code);
    return c * arah;
  });
  return out;
}

import { describe, it, expect } from 'vitest';
import {
  sortBuildTasks,
  URGENCY_RANK,
  STATUS_RANK,
  ageInDays,
  type SortableTask,
  type BuildTaskUrgency,
  type BuildTaskStatus
} from '../src/features/mrp/buildTaskSorting';

// Menguji ATURAN MAKNA, bukan tampilan. "Mendesak" harus di atas "Penting" karena
// artinya memang lebih mendesak — bukan karena M sebelum P di abjad. Kalau aturan ini
// rusak diam-diam, kerusakannya TIDAK muncul sebagai error, cuma sebagai urutan yang
// terasa aneh, dan biasanya tidak ada yang mengadukannya.

const KINI = new Date('2026-08-24T00:00:00Z').getTime();

function task(
  kode: string,
  urgency: BuildTaskUrgency,
  status: BuildTaskStatus,
  extra: Partial<SortableTask> = {}
): SortableTask {
  return {
    task_code: kode,
    name: `Nama ${kode}`,
    pic: 'Claude Code',
    urgency,
    status,
    created_at: '2026-08-20T00:00:00Z',
    started_at: null,
    completed_at: null,
    approved_at: null,
    ...extra
  };
}

describe('Urutan Daftar Tugas (II.3 & II.4)', () => {
  it('URUTAN LOGIS urgensi, BUKAN abjad', () => {
    // Secara abjad urutannya akan jadi: Bisa Menunggu, Mendesak, Penting, SUPER URGENT,
    // Tidak Mendesak -- yang berarti SUPER URGENT nyaris di dasar. Itu yang dicegah.
    const daftar = [
      task('E-05', 'tidak_mendesak', 'menunggu'),
      task('B-02', 'mendesak', 'menunggu'),
      task('D-04', 'bisa_menunggu', 'menunggu'),
      task('A-01', 'super_urgent', 'menunggu'),
      task('C-03', 'penting', 'menunggu')
    ];
    const hasil = sortBuildTasks(daftar, 'urgency', 'asc', KINI).map((t) => t.urgency);
    expect(hasil).toEqual(['super_urgent', 'mendesak', 'penting', 'bisa_menunggu', 'tidak_mendesak']);
  });

  it('URUTAN LOGIS status mengikuti alur kerja, BUKAN abjad', () => {
    const daftar = [
      task('A', 'penting', 'selesai'),
      task('B', 'penting', 'menunggu'),
      task('C', 'penting', 'sedang_dikerjakan'),
      task('D', 'penting', 'dibatalkan'),
      task('E', 'penting', 'menunggu_persetujuan'),
      task('F', 'penting', 'ditunda_sadar')
    ];
    const hasil = sortBuildTasks(daftar, 'status', 'asc', KINI).map((t) => t.status);
    expect(hasil).toEqual([
      'sedang_dikerjakan',
      'menunggu_persetujuan',
      'menunggu',
      'ditunda_sadar',
      'selesai',
      'dibatalkan'
    ]);
  });

  it('URUTAN DEFAULT: SUPER URGENT yang belum selesai SELALU paling atas', () => {
    const daftar = [
      task('Z-99', 'mendesak', 'sedang_dikerjakan'),
      task('A-01', 'penting', 'menunggu'),
      task('M-50', 'super_urgent', 'menunggu')
    ];
    expect(sortBuildTasks(daftar, null, 'asc', KINI)[0].task_code).toBe('M-50');
  });

  it('URUTAN DEFAULT: SUPER URGENT yang SUDAH SELESAI tidak lagi dipaksa ke atas', () => {
    // Kalau tidak dibedakan, task super urgent yang sudah tuntas akan terus menyumbat
    // puncak daftar dan menutupi yang benar-benar perlu dikerjakan.
    const daftar = [
      task('M-50', 'super_urgent', 'selesai', { approved_at: '2026-08-21T00:00:00Z' }),
      task('A-01', 'penting', 'menunggu')
    ];
    expect(sortBuildTasks(daftar, null, 'asc', KINI)[0].task_code).toBe('A-01');
  });

  it('URUTAN DEFAULT: yang belum selesai mendahului yang sudah, walau urgensinya lebih rendah', () => {
    const daftar = [
      task('A-01', 'mendesak', 'selesai', { approved_at: '2026-08-21T00:00:00Z' }),
      task('B-02', 'tidak_mendesak', 'menunggu')
    ];
    expect(sortBuildTasks(daftar, null, 'asc', KINI).map((t) => t.task_code)).toEqual(['B-02', 'A-01']);
  });

  it('menyortir "menggantung" sebagai ANGKA, bukan teks', () => {
    // Sebagai teks, "10 hari" akan mendahului "2 hari" karena huruf "1" sebelum "2".
    const daftar = [
      task('A', 'penting', 'menunggu', { created_at: '2026-08-22T00:00:00Z' }), // 2 hari
      task('B', 'penting', 'menunggu', { created_at: '2026-08-14T00:00:00Z' }) // 10 hari
    ];
    expect(sortBuildTasks(daftar, 'age', 'asc', KINI).map((t) => t.task_code)).toEqual(['A', 'B']);
    expect(ageInDays(daftar[0], KINI)).toBe(2);
    expect(ageInDays(daftar[1], KINI)).toBe(10);
  });

  it('arah turun membalik urutan, dan tetap logis (bukan abjad terbalik)', () => {
    const daftar = [
      task('A', 'super_urgent', 'menunggu'),
      task('B', 'tidak_mendesak', 'menunggu'),
      task('C', 'penting', 'menunggu')
    ];
    expect(sortBuildTasks(daftar, 'urgency', 'desc', KINI).map((t) => t.urgency)).toEqual([
      'tidak_mendesak',
      'penting',
      'super_urgent'
    ]);
  });

  it('seri diputus oleh kode task, supaya urutan tidak berubah-ubah untuk data yang sama', () => {
    const daftar = [task('C-03', 'penting', 'menunggu'), task('A-01', 'penting', 'menunggu'), task('B-02', 'penting', 'menunggu')];
    const sekali = sortBuildTasks(daftar, 'urgency', 'asc', KINI).map((t) => t.task_code);
    const dua = sortBuildTasks([...daftar].reverse(), 'urgency', 'asc', KINI).map((t) => t.task_code);
    expect(sekali).toEqual(['A-01', 'B-02', 'C-03']);
    expect(dua).toEqual(sekali);
  });

  it('peringkat urgensi & status lengkap — tidak ada nilai yang tak punya peringkat', () => {
    // Nilai enum baru yang lupa diberi peringkat akan menghasilkan NaN dan mengacaukan
    // seluruh urutan tanpa error.
    expect(Object.values(URGENCY_RANK).every((v) => Number.isInteger(v))).toBe(true);
    expect(Object.values(STATUS_RANK).every((v) => Number.isInteger(v))).toBe(true);
    expect(Object.keys(URGENCY_RANK)).toHaveLength(5);
    expect(Object.keys(STATUS_RANK)).toHaveLength(6);
  });

  it('tidak mengubah larik aslinya', () => {
    const daftar = [task('B', 'penting', 'menunggu'), task('A', 'mendesak', 'menunggu')];
    const sebelum = daftar.map((t) => t.task_code);
    sortBuildTasks(daftar, 'urgency', 'asc', KINI);
    expect(daftar.map((t) => t.task_code)).toEqual(sebelum);
  });
});

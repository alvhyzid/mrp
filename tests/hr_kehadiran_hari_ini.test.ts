import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { tanpaKomentar } from './util/tanpaKomentar';

// ============================================================================
// P0 — "HADIR HARI INI" DI DASHBOARD HRD
// ============================================================================
// Kartu "Hadir hari ini" SELALU menampilkan 0 untuk absensi yang dibuat sistem.
//
// SEBABNYA DUA KOSAKATA YANG SAMA-SAH DI SATU KOLOM:
//   recomputeAttendanceDay.ts menulis  'HADIR' · 'TERLAMBAT' · 'PULANG' ·
//                                      'DI_LUAR_AREA' · 'ALPA' · leave_type
//   HrDashboardPage.tsx menyaring      'present' · 'late'
//   kekangan basis data MENGIZINKAN KEDUANYA, jadi tidak ada yang berbunyi.
//
// Ini bukan cacat tampilan. Ia angka yang berbohong tanpa terlihat berbohong —
// grafiknya rapi, datanya nyata, artinya salah.
//
// ============================================================================
// KENAPA KOSAKATA LAMA TETAP DIHITUNG
// ============================================================================
// 'present'/'late' TIDAK ditulis satu pun kode server. Tetapi kolomnya masih
// `default 'present'`, kekangannya masih mengizinkannya, dan jalur absen-mandiri
// RLS menyisipkannya langsung. Hari ini justru HANYA itulah yang dihitung —
// jadi membuangnya adalah kemunduran, bukan pembersihan.
// ============================================================================

const MODUL = 'src/features/attendance/statusAbsensi.ts';
const PINTU = 'src/features/attendance/index.ts';
const DASBOR = 'src/features/hr/pages/HrDashboardPage.tsx';
const HALAMAN_ABSENSI = 'src/features/attendance/pages/AttendancePage.tsx';
const SERVER = 'src/features/hr/server/listAttendanceByDate.ts';

describe('P0 /hr — "Hadir hari ini" menghitung kosakata yang benar-benar ditulis', () => {
  it('(pra) modul kosakata absensi bersama ADA', () => {
    expect(existsSync(MODUL), `${MODUL} harus ada sebagai SATU sumber kosakata absensi`).toBe(true);
  });

  it('(a) HADIR dihitung sebagai hadir', async () => {
    const { hitungHadirHariIni } = await import('@/features/attendance/statusAbsensi');
    expect(hitungHadirHariIni([{ status: 'HADIR' }])).toBe(1);
  });

  it('(b) TERLAMBAT dihitung sebagai hadir', async () => {
    const { hitungHadirHariIni } = await import('@/features/attendance/statusAbsensi');
    expect(hitungHadirHariIni([{ status: 'TERLAMBAT' }])).toBe(1);
  });

  it('(c) PULANG dihitung sebagai hadir', async () => {
    // PULANG berarti sudah absen masuk DAN pulang — orangnya jelas hadir hari itu.
    const { hitungHadirHariIni } = await import('@/features/attendance/statusAbsensi');
    expect(hitungHadirHariIni([{ status: 'PULANG' }])).toBe(1);
  });

  it('(d) status yang BUKAN kehadiran tidak dihitung', async () => {
    const { hitungHadirHariIni } = await import('@/features/attendance/statusAbsensi');
    for (const s of ['ALPA', 'IZIN', 'SAKIT', 'CUTI', 'BELUM_HADIR', 'absent', 'on_leave', 'sick']) {
      expect(hitungHadirHariIni([{ status: s }]), `${s} tidak boleh dihitung hadir`).toBe(0);
    }
  });

  it('(e) kosakata LAMA tetap dihitung — kalau tidak, ini kemunduran', async () => {
    const { hitungHadirHariIni } = await import('@/features/attendance/statusAbsensi');
    expect(hitungHadirHariIni([{ status: 'present' }]), "'present' dihitung hari ini, jangan dicabut").toBe(1);
    expect(hitungHadirHariIni([{ status: 'late' }]), "'late' dihitung hari ini, jangan dicabut").toBe(1);
  });

  it('(f) DI_LUAR_AREA TIDAK dihitung — menunggu keputusan pemilik produk', async () => {
    // Orangnya MEMANG absen masuk, hanya di luar area. Apakah itu "hadir" adalah
    // pertanyaan bisnis, dan keputusan yang diberikan hanya menyebut HADIR,
    // TERLAMBAT, dan PULANG. Uji ini mengunci keadaan sekarang supaya perubahannya
    // kelak menjadi tindakan SADAR, bukan pergeseran diam-diam.
    const { hitungHadirHariIni } = await import('@/features/attendance/statusAbsensi');
    expect(hitungHadirHariIni([{ status: 'DI_LUAR_AREA' }])).toBe(0);
  });

  it('(g) menghitung campuran, bukan hanya satu baris', async () => {
    const { hitungHadirHariIni } = await import('@/features/attendance/statusAbsensi');
    const baris = [
      { status: 'HADIR' }, { status: 'TERLAMBAT' }, { status: 'PULANG' },
      { status: 'ALPA' }, { status: 'CUTI' }, { status: 'present' }
    ];
    expect(hitungHadirHariIni(baris)).toBe(4);
  });

  it('(h) SATU sumber kosakata — nol peta status absensi yang ditulis sendiri di halaman', () => {
    // Peta lengkap dan benar SUDAH ADA di AttendancePage, dan HrDashboardPage punya
    // salinan yang tidak lengkap. Itu persis kelas "dua jalur hidup": pengetahuannya
    // ada di repo, hanya tidak dipakai bersama.
    //
    // Versi pertama uji ini mencocokkan NAMA variabel dan MENUDUH SALAH:
    // `employmentStatusLabels` di dasbor HRD adalah peta JENIS KEPEGAWAIAN
    // (kontrak/PHL/freelance) — domain lain, dan sah. Penjaga yang salah tuduh melatih
    // orang mengabaikan hasilnya, jadi ia diperketat ke yang sebenarnya menentukan:
    // adakah KUNCI KOSAKATA ABSENSI ditulis di berkas halaman.
    const KUNCI_ABSENSI = ['HADIR', 'TERLAMBAT', 'DI_LUAR_AREA', 'ALPA', 'on_leave'];
    for (const berkas of [DASBOR, HALAMAN_ABSENSI]) {
      const isi = tanpaKomentar(readFileSync(berkas, 'utf8'));
      const ditulisSendiri = KUNCI_ABSENSI.filter((k) => new RegExp(`\\b${k}\\s*:`).test(isi));
      expect(
        ditulisSendiri,
        `${berkas} tidak boleh menulis kosakata absensi sendiri — sudah ada modul bersama`
      ).toEqual([]);
      expect(isi, `${berkas} harus memakai modul kosakata bersama`).toMatch(
        /@\/features\/attendance|\.\.\/statusAbsensi/
      );
    }
  });

  it('(i) dasbor memakai fungsi bersama, bukan menyaring sendiri', () => {
    const isi = tanpaKomentar(readFileSync(DASBOR, 'utf8'));
    expect(isi).toMatch(/hitungHadirHariIni/);
    expect(
      /status === 'present'|status === 'late'/.test(isi),
      'penyaring huruf-kecil yang ditulis tangan harus dicabut'
    ).toBe(false);
  });

  it('(j) modul diekspor lewat pintu resmi feature', () => {
    const pintu = tanpaKomentar(readFileSync(PINTU, 'utf8'));
    expect(pintu, 'aturan struktur folder: impor lintas feature lewat index.ts').toMatch(/statusAbsensi/);
  });

  it('(k) penyaring TANGGAL dan TENANT tetap di server', () => {
    // Dua dimensi ini tidak dijaga fungsi penghitung, melainkan kueri server —
    // disebut di sini supaya tidak dikira hilang saat penghitungnya dipindahkan.
    const isi = tanpaKomentar(readFileSync(SERVER, 'utf8'));
    expect(isi, 'harus menyaring per tanggal').toMatch(/\.eq\('attendance_date'/);
    expect(isi, 'harus menyaring per perusahaan').toMatch(/\.eq\('company_id'/);
  });
});

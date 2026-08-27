// KOSAKATA STATUS ABSENSI — SATU SUMBER untuk seluruh aplikasi.
//
// ============================================================================
// KENAPA MODUL INI ADA
// ============================================================================
// Kolom `employee_attendance.status` menerima DUA KOSAKATA yang sama-sah, dan
// kekangan basis datanya mengizinkan keduanya:
//
//   BARU (ditulis recomputeAttendanceDay):
//     HADIR · TERLAMBAT · PULANG · DI_LUAR_AREA · ALPA · IZIN · SAKIT · CUTI
//   LAMA (nilai bawaan kolom `default 'present'` + jalur absen-mandiri RLS):
//     present · late · absent · on_leave · sick
//   TERDAFTAR TAPI TIDAK PERNAH DITULIS kode mana pun:
//     BELUM_HADIR · ISTIRAHAT · KOREKSI_PENDING
//
// Kartu "Hadir hari ini" di dasbor HRD menyaring HANYA kosakata lama, sehingga
// SETIAP baris absensi yang dibuat sistem dihitung NOL. Angkanya rapi, datanya
// nyata, artinya salah — dan tidak ada galat, tidak ada test merah, tidak ada
// yang mengeluh.
//
// Peta label yang LENGKAP sebenarnya sudah ada di AttendancePage; yang tidak ada
// adalah pemakaian BERSAMA-nya. Modul ini memindahkannya jadi satu pintu supaya
// halaman ketiga yang lahir bulan depan tidak menulis salinan ketiga.
//
// ============================================================================
// YANG DITANGANI DAN YANG TIDAK
// ============================================================================
// DITANGANI: menerjemahkan status jadi label, warna Tag, dan menjawab "apakah
// status ini berarti orangnya hadir hari itu".
// TIDAK DITANGANI: penyaringan TANGGAL dan penyaringan PERUSAHAAN. Keduanya
// hidup di kueri server (`listAttendanceByDate`: `.eq('attendance_date', …)` dan
// `.eq('company_id', …)`) dan sengaja TIDAK dipindah ke sini — memindahkan
// penyaring tenant ke lapisan tampilan akan melemahkannya.

export type WarnaTagAbsensi = 'green' | 'magenta' | 'red' | 'blue' | 'gray';

/// Status yang berarti orangnya BENAR-BENAR HADIR pada hari itu.
///
/// Keputusan pemilik produk: HADIR, TERLAMBAT, dan PULANG dihitung hadir.
///   HADIR     = sudah absen masuk, belum absen pulang (masih bekerja)
///   TERLAMBAT = sudah masuk DAN pulang, datangnya melewati toleransi
///   PULANG    = sudah masuk DAN pulang, tepat waktu
///
/// `present` dan `late` ikut DENGAN SENGAJA. Keduanya tidak ditulis satu pun kode
/// server hari ini, TETAPI kolomnya masih `default 'present'`, kekangannya masih
/// mengizinkannya, dan jalur absen-mandiri RLS menyisipkannya langsung. Hari ini
/// justru HANYA itulah yang dihitung — jadi mencabutnya adalah kemunduran.
///
/// `DI_LUAR_AREA` SENGAJA TIDAK ADA DI SINI, dan itu keputusan yang belum diambil,
/// bukan kelalaian: orangnya MEMANG absen masuk, hanya di luar area yang
/// ditetapkan. Apakah itu dihitung hadir adalah pertanyaan bisnis. Sampai
/// dijawab, ia tidak dihitung — dan `tests/hr_kehadiran_hari_ini.test.ts` butir (f)
/// mengunci keadaan itu supaya perubahannya kelak jadi tindakan SADAR.
export const STATUS_DIHITUNG_HADIR: ReadonlySet<string> = new Set([
  'HADIR',
  'TERLAMBAT',
  'PULANG',
  'present',
  'late'
]);

/// Label yang tampil di layar. Memuat KEDUA kosakata, karena keduanya bisa ada di
/// baris yang sama-sama nyata.
export const labelStatusAbsensi: Record<string, string> = {
  HADIR: 'Hadir',
  TERLAMBAT: 'Terlambat',
  PULANG: 'Pulang',
  DI_LUAR_AREA: 'Di Luar Area (perlu ditinjau)',
  ALPA: 'Alpa',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  CUTI: 'Cuti',
  BELUM_HADIR: 'Belum hadir',
  ISTIRAHAT: 'Istirahat',
  KOREKSI_PENDING: 'Menunggu koreksi',
  present: 'Hadir',
  late: 'Terlambat',
  absent: 'Tidak hadir',
  on_leave: 'Cuti',
  sick: 'Sakit'
};

/// Warna Tag mengikuti ARTI, bukan selera:
///   hijau   = hadir sesuai aturan
///   magenta = perlu diperiksa manusia
///   merah   = tidak hadir TANPA keterangan
///   biru    = tidak hadir DENGAN keterangan yang sah
///
/// Membedakan dua yang terakhir penting: keduanya "tidak masuk", dan hanya satu
/// yang jadi masalah. Mewarnai cuti dan sakit merah membuat hak karyawan terlihat
/// seperti pelanggaran.
export const warnaTagStatusAbsensi: Record<string, WarnaTagAbsensi> = {
  HADIR: 'green',
  PULANG: 'green',
  TERLAMBAT: 'magenta',
  DI_LUAR_AREA: 'magenta',
  KOREKSI_PENDING: 'magenta',
  ALPA: 'red',
  IZIN: 'blue',
  SAKIT: 'blue',
  CUTI: 'blue',
  BELUM_HADIR: 'gray',
  ISTIRAHAT: 'gray',
  present: 'green',
  late: 'magenta',
  absent: 'red',
  on_leave: 'blue',
  sick: 'blue'
};

/// Label untuk status yang tidak dikenal: tampilkan apa adanya, JANGAN kosongkan.
/// Slug mentah di layar jelek, tetapi ia memberi tahu ada kosakata baru yang belum
/// diterjemahkan. Mengosongkannya menyembunyikan hal yang sama tanpa memberi tanda.
export function labelAbsensi(status: string): string {
  return labelStatusAbsensi[status] ?? status;
}

export function warnaAbsensi(status: string): WarnaTagAbsensi {
  return warnaTagStatusAbsensi[status] ?? 'gray';
}

/// Menghitung berapa orang yang HADIR dari sekumpulan baris absensi.
///
/// Baris yang masuk WAJIB sudah disaring per tanggal dan per perusahaan oleh
/// pemanggilnya — fungsi ini tidak tahu apa-apa tentang keduanya.
export function hitungHadirHariIni(baris: ReadonlyArray<{ status: string }>): number {
  return baris.filter((b) => STATUS_DIHITUNG_HADIR.has(b.status)).length;
}

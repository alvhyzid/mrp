// KONTRAK GALAT FIELD — SATU MEKANISME, BANYAK MODUL.
//
// ============================================================================================
// KENAPA BERKAS INI ADA
// ============================================================================================
// Pilot pertama (T-V4) membuktikan bahwa galat yang menyebut field-nya sebagai DATA bisa
// sampai ke kontrol yang benar. Tapi ia membuktikannya dengan kode yang hidup di satu modul.
// Menyalinnya ke modul berikutnya akan melahirkan dua pintu yang menyimpang — kelas cacat
// "dua jalur hidup" yang justru sedang diberantas: perbaikan diterapkan di satu salinan,
// salinan kedua tidak ikut, dan tidak ada yang mengeluh sampai salah satunya meleset.
//
// Yang BERBEDA antar modul hanyalah DAFTAR NAMA field-nya. Mekanismenya — memeriksa nama
// terhadap daftar, memeriksa indeks baris terhadap jumlah baris yang tampil, memutuskan
// field atau formulir, dan mempertahankan kalimat aslinya — sama persis. Berkas ini memuat
// yang sama itu, satu kali.
//
// ============================================================================================
// APA YANG SENGAJA TIDAK ADA DI SINI
// ============================================================================================
// Nol nama field, nol nama modul, nol aturan bisnis. Begitu berkas ini tahu ada modul
// tertentu, ia berhenti jadi kontrak dan mulai jadi kumpulan cabang — dan penjaga (i) di
// tests/kontrak_galat_field_bersama.test.ts menolaknya.

/// Hasil pemetaan sebuah galat dari jawaban server.
///
/// `formulir` berarti: tampilkan di tingkat formulir DENGAN KALIMAT ASLINYA. Galat tidak
/// boleh hilang hanya karena pemetaannya tidak bisa dilakukan, dan tidak ada pesan baru yang
/// dikarang untuk menggantikannya.
export type GalatFieldTerpetakan<F extends string> =
  | { jenis: 'field'; field: F; line: number | undefined; pesan: string }
  | { jenis: 'formulir'; pesan: string };

export interface KontrakGalatField<A extends string, B extends string> {
  /// Menyusun badan jawaban untuk galat yang memang milik satu isian.
  ///
  /// WAJIB dipakai alih-alih menulis objek mentah. Alasannya diukur, bukan diduga: badan
  /// jawaban di lapisan server bertipe `Record<string, unknown>`, jadi nama yang salah ketik
  /// di dalamnya LOLOS typecheck sepenuhnya. Nama hanya diperiksa saat kompilasi bila ia
  /// melewati sebuah parameter bertipe.
  galatField(pesan: string, field: A | B, line?: number): Record<string, unknown>;

  /// Memetakan jawaban server ke kontrol, atau menaikkannya ke tingkat formulir.
  ///
  /// `jumlahBaris` adalah jumlah baris yang SEDANG TAMPIL di formulir saat jawaban diterima —
  /// bukan jumlah saat dikirim. Itu yang membuat indeks basi (mis. setelah sebuah baris
  /// dihapus) tertolak alih-alih menandai baris yang salah.
  petakan(body: Record<string, unknown>, jumlahBaris: number): GalatFieldTerpetakan<A | B>;
}

/// Membuat kontrak untuk sebuah modul dari DUA daftar nama:
///   `atas`  — isian di tingkat formulir
///   `baris` — isian yang hidup di dalam baris berulang; boleh kosong
///
/// SEMANTIK `line`: indeks BERBASIS NOL, dan hanya bermakna untuk nama di `baris`. Modul yang
/// tidak punya baris cukup mengirim daftar kosong — tidak ada perlakuan khusus yang perlu
/// ditulis di modulnya.
export function buatKontrakGalatField<A extends string, B extends string>(
  atas: readonly A[],
  baris: readonly B[]
): KontrakGalatField<A, B> {
  const semua: readonly string[] = [...atas, ...baris];

  const dikenal = (nilai: unknown): nilai is A | B => typeof nilai === 'string' && semua.includes(nilai);
  const milikBaris = (nilai: unknown): nilai is B => typeof nilai === 'string' && (baris as readonly string[]).includes(nilai);

  return {
    galatField(pesan, field, line) {
      return { error: pesan, field, ...(line !== undefined ? { line } : {}) };
    },

    petakan(body, jumlahBaris) {
      const pesan = typeof body.error === 'string' && body.error ? body.error : 'Isian ini ditolak.';
      const field = body.field;
      if (!dikenal(field)) return { jenis: 'formulir', pesan };

      // Nama yang BUKAN milik baris: `line` tidak bermakna dan diabaikan. Menaikkannya ke
      // tingkat formulir justru akan MEMINDAHKAN galat yang sebenarnya bisa ditunjuk.
      if (!milikBaris(field)) return { jenis: 'field', field, line: undefined, pesan };

      const line = body.line;
      const sah = typeof line === 'number' && Number.isInteger(line) && line >= 0 && line < jumlahBaris;
      if (!sah) return { jenis: 'formulir', pesan };
      return { jenis: 'field', field, line, pesan };
    }
  };
}

// AMBANG STOK MINIMUM (MST-19).
//
// Dipisah dari server & komponen supaya aturannya bisa diuji tanpa database dan tanpa
// merender apa pun. Yang diputuskan di sini bukan tampilan, melainkan ARTI: kapan sebuah
// item disebut menipis, dan kapan ia sebenarnya belum punya dasar untuk dinilai.

export type StatusStok =
  | 'belum_pernah_masuk' // belum pernah ada pembelian/produksi sama sekali
  | 'habis' // pernah masuk, sekarang nol
  | 'menipis' // di bawah ambang
  | 'aman'
  | 'tanpa_ambang'; // pengguna memang belum menetapkan ambang apa pun

// DARI MANA ambang itu datang. Wajib ikut terbawa sampai layar — lihat aturan "field yang
// saling membatalkan" di CLAUDE.md: tiga isian yang saling menimpa TIDAK boleh berdiri
// tanpa keterangan mana yang sedang menang.
export type SumberAmbang =
  | 'persen_item' // persen khusus item ini
  | 'persen_perusahaan' // persen bawaan perusahaan (setelan ke-18)
  | 'angka_mutlak' // min_stock_level warisan
  | 'tidak_ada';

export interface PenilaianStok {
  status: StatusStok;
  ambang: number | null;
  sumberAmbang: SumberAmbang;
  stokSekarang: number;
  totalPernahMasuk: number;
  // Kalimat siap tampil. Ditaruh di sini, bukan di komponen, supaya dua layar yang
  // menampilkan hal yang sama tidak pernah mengatakannya dengan cara berbeda.
  keterangan: string;
}

export interface InputPenilaianStok {
  stokSekarang: number;
  totalPernahMasuk: number;
  minStockPercent: number | null;
  minStockLevel: number | null;
  /// Setelan ke-18 (MST-27). Null bila perusahaan belum menetapkannya.
  persenBawaanPerusahaan: number | null;
}

// AMBANG EFEKTIF — TIGA LAPIS, urutannya mengikat dan hanya ditulis DI SINI.
//
//   1. persen milik item             -> yang paling khusus menang
//   2. persen bawaan perusahaan      -> setelan ke-18, MST-27
//   3. min_stock_level (angka mutlak) -> warisan item lama
//
// KENAPA LAPIS PERUSAHAAN ADA (KK.3, 25 Agu 2026): persen per item sudah lama tersedia
// dan TIDAK PERNAH sekali pun diisi pemilik produk. Isian yang harus diisi ratusan kali
// tidak akan diisi — itu bukan ramalan, itu yang sudah terjadi. Satu angka untuk seluruh
// perusahaan membuat peringatan stok hidup tanpa menunggu ratusan isian.
//
// Kolom mutlak SENGAJA dipertahankan di lapis terakhir supaya item lama tidak kehilangan
// ambangnya dalam semalam. Yang dijaga agar tiga isian ini tidak jadi tiga sumber
// kebenaran adalah aturan MENANG yang tegas di satu tempat ini, bukan disebar ke pemanggil.
export function tentukanAmbang(input: InputPenilaianStok): { ambang: number | null; sumber: SumberAmbang } {
  const { minStockPercent, minStockLevel, persenBawaanPerusahaan, totalPernahMasuk } = input;
  if (minStockPercent !== null && minStockPercent > 0) {
    return { ambang: (totalPernahMasuk * minStockPercent) / 100, sumber: 'persen_item' };
  }
  if (persenBawaanPerusahaan !== null && persenBawaanPerusahaan > 0) {
    return { ambang: (totalPernahMasuk * persenBawaanPerusahaan) / 100, sumber: 'persen_perusahaan' };
  }
  if (minStockLevel !== null && minStockLevel > 0) return { ambang: minStockLevel, sumber: 'angka_mutlak' };
  return { ambang: null, sumber: 'tidak_ada' };
}

/// Bentuk ringkas yang hanya butuh angkanya. Meneruskan ke `tentukanAmbang` — SATU
/// perhitungan, bukan dua yang bisa menyimpang.
export function hitungAmbang(input: InputPenilaianStok): number | null {
  return tentukanAmbang(input).ambang;
}

/// Kalimat pendek yang menyebut ambang ini berasal dari mana. Dipakai di keterangan dan
/// boleh dipakai layar mana pun.
export function jelaskanSumberAmbang(sumber: SumberAmbang, persen: number | null): string {
  switch (sumber) {
    case 'persen_item':
      return `${persen ?? 0}% dari jumlah yang pernah masuk, ambang khusus item ini`;
    case 'persen_perusahaan':
      return `${persen ?? 0}% dari jumlah yang pernah masuk, memakai persen bawaan perusahaan`;
    case 'angka_mutlak':
      return 'angka tetap yang diisi di item ini';
    default:
      return 'belum ada ambang';
  }
}

export function nilaiStok(input: InputPenilaianStok): PenilaianStok {
  const { stokSekarang, totalPernahMasuk } = input;
  const { ambang, sumber } = tentukanAmbang(input);
  const persenTerpakai =
    sumber === 'persen_item' ? input.minStockPercent : sumber === 'persen_perusahaan' ? input.persenBawaanPerusahaan : null;
  const asal = jelaskanSumberAmbang(sumber, persenTerpakai);

  // BEDAKAN DUA KEADAAN YANG SELAMA INI TAMPAK SAMA. Keduanya menampilkan nol, tapi
  // artinya berbeda jauh dan tindakannya berbeda:
  //   - "belum pernah masuk": barang ini belum pernah dibeli/diproduksi sama sekali.
  //     Tidak ada yang perlu ditindaklanjuti gudang; yang perlu adalah pembelian pertama.
  //     Persen pun belum punya dasar hitung — persen dari nol selalu nol.
  //   - "habis": barang ini pernah ada dan sekarang nol. INI yang perlu ditindaklanjuti.
  if (totalPernahMasuk <= 0) {
    return {
      status: 'belum_pernah_masuk',
      ambang: null,
      sumberAmbang: 'tidak_ada',
      stokSekarang,
      totalPernahMasuk,
      keterangan: 'Belum pernah ada pembelian atau produksi untuk item ini, jadi ambang stok belum punya dasar hitung.'
    };
  }

  if (stokSekarang <= 0) {
    return {
      status: 'habis',
      ambang,
      sumberAmbang: sumber,
      stokSekarang,
      totalPernahMasuk,
      keterangan: 'Stok HABIS. Item ini pernah ada dan sekarang nol.'
    };
  }

  if (ambang === null) {
    return {
      status: 'tanpa_ambang',
      ambang: null,
      sumberAmbang: 'tidak_ada',
      stokSekarang,
      totalPernahMasuk,
      keterangan:
        'Belum ada ambang stok minimum untuk item ini, dan perusahaan juga belum menetapkan persen bawaan — jadi sistem tidak bisa menilai stoknya menipis atau tidak.'
    };
  }

  if (stokSekarang < ambang) {
    return {
      status: 'menipis',
      ambang,
      sumberAmbang: sumber,
      stokSekarang,
      totalPernahMasuk,
      keterangan: `Stok menipis: ${stokSekarang} di bawah ambang ${Math.round(ambang * 100) / 100} (${asal}).`
    };
  }

  return {
    status: 'aman',
    ambang,
    sumberAmbang: sumber,
    stokSekarang,
    totalPernahMasuk,
    keterangan: `Stok aman: ${stokSekarang} di atas ambang ${Math.round(ambang * 100) / 100} (${asal}).`
  };
}

// Hanya DUA keadaan yang layak jadi peringatan. "belum pernah masuk" dan "tanpa ambang"
// SENGAJA tidak memicu apa pun: keduanya bukan masalah stok, melainkan data yang memang
// belum ada — dan peringatan yang berbunyi untuk hal yang bukan masalah adalah cara
// tercepat membuat orang berhenti membaca peringatan.
export function perluPeringatan(p: PenilaianStok): boolean {
  return p.status === 'menipis' || p.status === 'habis';
}

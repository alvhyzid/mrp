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

export interface PenilaianStok {
  status: StatusStok;
  ambang: number | null;
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
}

// Ambang efektif. `min_stock_percent` MENANG bila terisi; `min_stock_level` (angka
// mutlak) hanya dipakai sebagai warisan untuk item yang belum dipindah ke persen.
//
// Dua kolom untuk satu maksud memang bukan keadaan ideal dan sengaja dicatat: kolom
// mutlak dipertahankan supaya item lama tidak kehilangan ambangnya dalam semalam. Yang
// dijaga agar tidak jadi "dua sumber kebenaran" adalah aturan MENANG yang tegas di sini
// — satu tempat, bukan disebar ke tiap pemanggil.
export function hitungAmbang(input: InputPenilaianStok): number | null {
  const { minStockPercent, minStockLevel, totalPernahMasuk } = input;
  if (minStockPercent !== null && minStockPercent > 0) {
    return (totalPernahMasuk * minStockPercent) / 100;
  }
  if (minStockLevel !== null && minStockLevel > 0) return minStockLevel;
  return null;
}

export function nilaiStok(input: InputPenilaianStok): PenilaianStok {
  const { stokSekarang, totalPernahMasuk } = input;
  const ambang = hitungAmbang(input);

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
      stokSekarang,
      totalPernahMasuk,
      keterangan: 'Belum pernah ada pembelian atau produksi untuk item ini, jadi ambang stok belum punya dasar hitung.'
    };
  }

  if (stokSekarang <= 0) {
    return {
      status: 'habis',
      ambang,
      stokSekarang,
      totalPernahMasuk,
      keterangan: 'Stok HABIS. Item ini pernah ada dan sekarang nol.'
    };
  }

  if (ambang === null) {
    return {
      status: 'tanpa_ambang',
      ambang: null,
      stokSekarang,
      totalPernahMasuk,
      keterangan: 'Belum ada ambang stok minimum untuk item ini, jadi sistem tidak bisa menilai stoknya menipis atau tidak.'
    };
  }

  if (stokSekarang < ambang) {
    return {
      status: 'menipis',
      ambang,
      stokSekarang,
      totalPernahMasuk,
      keterangan: `Stok menipis: ${stokSekarang} di bawah ambang ${Math.round(ambang * 100) / 100}.`
    };
  }

  return {
    status: 'aman',
    ambang,
    stokSekarang,
    totalPernahMasuk,
    keterangan: `Stok aman: ${stokSekarang} di atas ambang ${Math.round(ambang * 100) / 100}.`
  };
}

// Hanya DUA keadaan yang layak jadi peringatan. "belum pernah masuk" dan "tanpa ambang"
// SENGAJA tidak memicu apa pun: keduanya bukan masalah stok, melainkan data yang memang
// belum ada — dan peringatan yang berbunyi untuk hal yang bukan masalah adalah cara
// tercepat membuat orang berhenti membaca peringatan.
export function perluPeringatan(p: PenilaianStok): boolean {
  return p.status === 'menipis' || p.status === 'habis';
}

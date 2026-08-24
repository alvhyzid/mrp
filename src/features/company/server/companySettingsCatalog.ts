// KATALOG SETELAN PERUSAHAAN (MST-26, 25 Agu 2026).
//
// Satu tempat yang menentukan: setelan apa saja yang ada, apa artinya dalam bahasa orang
// pabrik, bagaimana memvalidasinya, dan — yang paling menentukan — APAKAH IA MEMENGARUHI
// PERHITUNGAN YANG SUDAH LEWAT.
//
// KENAPA KATALOGNYA DI SATU BERKAS, bukan tersebar di layar: sebelum ini, ketujuh belas
// setelan hanya hidup sebagai baris di database tanpa nama yang bisa dibaca manusia.
// Menyebarkan labelnya ke JSX berarti label yang sama ditulis ulang setiap kali ada layar
// yang menampilkannya, dan mulai menyimpang seperti 88 warna yang ditulis tangan.

export type JenisSetelan = 'angka' | 'persen' | 'rupiah' | 'pilihan' | 'teks';

export interface DefinisiSetelan {
  kunci: string;
  label: string;
  /// Penjelasan yang menjawab "apa yang terjadi kalau saya isi ini", bukan istilah bukunya
  /// (Prinsip Penamaan Field, CLAUDE.md 24 Agu 2026).
  bantuan: string;
  kelompok: string;
  jenis: JenisSetelan;
  pilihan?: { nilai: string; label: string }[];
  min?: number;
  max?: number;
  /// TRUE bila mengubahnya bisa menggeser angka yang SUDAH dilaporkan. Setelan bertanda ini
  /// WAJIB punya tanggal berlaku, dan layarnya wajib memperingatkan.
  memengaruhiHistoris: boolean;
}

export const KELOMPOK_SETELAN = [
  'Periode & kalender kerja',
  'BPJS ditanggung perusahaan',
  'Metode perhitungan biaya',
  'Umum'
] as const;

export const KATALOG_SETELAN: DefinisiSetelan[] = [
  {
    kunci: 'payroll_period_start_day',
    label: 'Tanggal mulai periode gajian',
    bantuan: 'Gaji dihitung dari tanggal ini sampai tanggal yang sama bulan berikutnya. Contoh: 26 berarti periode 26 Agustus sampai 25 September.',
    kelompok: 'Periode & kalender kerja',
    jenis: 'angka',
    min: 1,
    max: 28,
    memengaruhiHistoris: true
  },
  {
    kunci: 'standard_working_days_per_month',
    label: 'Hari kerja per bulan',
    bantuan: 'Dipakai membagi gaji bulanan jadi biaya per hari. Menaikkannya membuat biaya per hari turun.',
    kelompok: 'Periode & kalender kerja',
    jenis: 'angka',
    min: 1,
    max: 31,
    memengaruhiHistoris: true
  },
  {
    kunci: 'standard_hours_per_month',
    label: 'Jam kerja per bulan',
    bantuan: 'Dipakai membagi gaji bulanan jadi biaya per jam. Angka lazim 173,3333 (40 jam per minggu).',
    kelompok: 'Periode & kalender kerja',
    jenis: 'angka',
    min: 1,
    max: 400,
    memengaruhiHistoris: true
  },
  {
    kunci: 'work_calendar_weekday_hours',
    label: 'Jam kerja Senin–Jumat',
    bantuan: 'Berapa jam sehari dihitung kerja penuh di hari biasa. Dipakai menghitung keterlambatan dan lembur.',
    kelompok: 'Periode & kalender kerja',
    jenis: 'angka',
    min: 0,
    max: 24,
    memengaruhiHistoris: true
  },
  {
    kunci: 'work_calendar_saturday_hours',
    label: 'Jam kerja Sabtu',
    bantuan: 'Isi 0 bila Sabtu libur.',
    kelompok: 'Periode & kalender kerja',
    jenis: 'angka',
    min: 0,
    max: 24,
    memengaruhiHistoris: true
  },

  {
    kunci: 'bpjs_kesehatan_employer_rate_percent',
    label: 'BPJS Kesehatan — bagian perusahaan',
    bantuan: 'Persen dari dasar upah yang dibayar perusahaan, di luar potongan karyawan. Masuk biaya tenaga kerja.',
    kelompok: 'BPJS ditanggung perusahaan',
    jenis: 'persen',
    min: 0,
    max: 100,
    memengaruhiHistoris: true
  },
  {
    kunci: 'bpjs_jht_employer_rate_percent',
    label: 'BPJS JHT — bagian perusahaan',
    bantuan: 'Jaminan Hari Tua. Persen dari dasar upah yang dibayar perusahaan.',
    kelompok: 'BPJS ditanggung perusahaan',
    jenis: 'persen',
    min: 0,
    max: 100,
    memengaruhiHistoris: true
  },
  {
    kunci: 'bpjs_jkk_employer_rate_percent',
    label: 'BPJS JKK — bagian perusahaan',
    bantuan: 'Jaminan Kecelakaan Kerja. Tarifnya mengikuti tingkat risiko usaha.',
    kelompok: 'BPJS ditanggung perusahaan',
    jenis: 'persen',
    min: 0,
    max: 100,
    memengaruhiHistoris: true
  },
  {
    kunci: 'bpjs_jkm_employer_rate_percent',
    label: 'BPJS JKM — bagian perusahaan',
    bantuan: 'Jaminan Kematian. Persen dari dasar upah yang dibayar perusahaan.',
    kelompok: 'BPJS ditanggung perusahaan',
    jenis: 'persen',
    min: 0,
    max: 100,
    memengaruhiHistoris: true
  },
  {
    kunci: 'bpjs_wage_basis_floor',
    label: 'Batas bawah dasar upah BPJS',
    bantuan: 'Upah di bawah angka ini tetap dihitung memakai angka ini. Biasanya mengikuti upah minimum daerah.',
    kelompok: 'BPJS ditanggung perusahaan',
    jenis: 'rupiah',
    min: 0,
    memengaruhiHistoris: true
  },
  {
    kunci: 'bpjs_wage_basis_ceiling',
    label: 'Batas atas dasar upah BPJS',
    bantuan: 'Upah di atas angka ini tetap dihitung memakai angka ini. Ditetapkan pemerintah.',
    kelompok: 'BPJS ditanggung perusahaan',
    jenis: 'rupiah',
    min: 0,
    memengaruhiHistoris: true
  },

  {
    kunci: 'labor_costing_method',
    label: 'Cara membebankan biaya tenaga kerja ke batch',
    bantuan: 'Catatan jam kerja: biaya mengikuti jam yang benar-benar dicatat per batch. Rata-rata per batch: total biaya sebulan dibagi jumlah batch.',
    kelompok: 'Metode perhitungan biaya',
    jenis: 'pilihan',
    pilihan: [
      { nilai: 'labor_log', label: 'Catatan jam kerja per batch' },
      { nilai: 'batch_average', label: 'Rata-rata per batch' }
    ],
    memengaruhiHistoris: true
  },
  {
    kunci: 'overhead_allocation',
    label: 'Pembebanan overhead pabrik ke batch',
    bantuan: 'Bila dimatikan, overhead pabrik tidak masuk HPP per batch sama sekali.',
    kelompok: 'Metode perhitungan biaya',
    jenis: 'pilihan',
    pilihan: [
      { nilai: 'off', label: 'Tidak dibebankan' },
      { nilai: 'per_batch', label: 'Dibagi rata per jumlah batch' }
    ],
    memengaruhiHistoris: true
  },
  {
    kunci: 'monthly_overhead_baseline',
    label: 'Perkiraan overhead pabrik per bulan',
    bantuan: 'Dipakai membagi overhead ke batch bila pembebanan dinyalakan.',
    kelompok: 'Metode perhitungan biaya',
    jenis: 'rupiah',
    min: 0,
    memengaruhiHistoris: true
  },
  {
    kunci: 'scrap_valuation',
    label: 'Nilai sisa produksi',
    bantuan: 'Nol: sisa dianggap tidak bernilai. Nilai bahan: sisa mengurangi biaya batch sebesar nilai bahannya.',
    kelompok: 'Metode perhitungan biaya',
    jenis: 'pilihan',
    pilihan: [
      { nilai: 'zero', label: 'Dianggap nol' },
      { nilai: 'material_value', label: 'Senilai bahannya' }
    ],
    memengaruhiHistoris: true
  },

  {
    kunci: 'currency_code',
    label: 'Mata uang',
    bantuan: 'Dipakai di seluruh tampilan angka uang.',
    kelompok: 'Umum',
    jenis: 'teks',
    memengaruhiHistoris: false
  },
  {
    kunci: 'so_number_company_code',
    label: 'Kode perusahaan di nomor pesanan',
    bantuan: 'Muncul di nomor Sales Order dan Surat Jalan. Contoh: ITM membuat nomor 001/8-ITM/2026.',
    kelompok: 'Umum',
    jenis: 'teks',
    memengaruhiHistoris: false
  }
];

export const PETA_SETELAN = new Map(KATALOG_SETELAN.map((s) => [s.kunci, s]));

/// Memvalidasi satu nilai terhadap definisinya. Mengembalikan pesan galat dalam Bahasa
/// Indonesia, atau null bila sah. Dipakai server DAN layar, supaya keduanya tidak bisa
/// menyimpang -- kelas cacat "dua jalur hidup untuk hal yang sama".
export function validasiSetelan(kunci: string, nilai: string): string | null {
  const def = PETA_SETELAN.get(kunci);
  if (!def) return `Setelan "${kunci}" tidak dikenal.`;

  const teks = String(nilai ?? '').trim();
  if (teks === '') return `${def.label} wajib diisi.`;

  if (def.jenis === 'pilihan') {
    const sah = (def.pilihan ?? []).some((p) => p.nilai === teks);
    return sah ? null : `${def.label}: pilihan "${teks}" tidak dikenal.`;
  }

  if (def.jenis === 'teks') {
    if (teks.length > 20) return `${def.label} maksimal 20 karakter.`;
    return null;
  }

  const angka = Number(teks);
  if (!Number.isFinite(angka)) return `${def.label} harus berupa angka.`;
  if (def.min !== undefined && angka < def.min) return `${def.label} tidak boleh kurang dari ${def.min}.`;
  if (def.max !== undefined && angka > def.max) return `${def.label} tidak boleh lebih dari ${def.max}.`;
  return null;
}

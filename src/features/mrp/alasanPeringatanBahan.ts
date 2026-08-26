import { perluPeringatan, type PenilaianStok } from './stockThreshold';

// SATU PERINGATAN PER BAHAN, SEBABNYA DISEBUTKAN DI DALAMNYA (GDG-10 / KK.1, 25 Agu 2026).
//
// ============================================================================
// KENAPA DIGABUNG, dan kenapa itu bukan sekadar merapikan tampilan
// ============================================================================
// Sebelum ini ada DUA peringatan untuk satu bahan yang sama:
//   - "sisa stok di bawah ambang"   -> melihat ke belakang, milik gudang & purchasing
//   - "bahan kurang untuk sekian batch" -> melihat ke depan, milik produksi & PPIC
//
// Pemisahan itu masuk akal dari sisi PERHITUNGAN, dan tidak masuk akal dari sisi ORANG
// YANG MEMBACANYA. Alasan pemilik produk, dicatat utuh karena akan dirujuk untuk peringatan
// lain: "Orang gudang tidak bertanya apakah stok di bawah ambang persen atau apakah
// kebutuhan melebihi sisa. Ia bertanya satu hal: bahan ini perlu dipesan atau tidak."
//
// Dan yang paling berharga: dua sebab yang BERTENTANGAN jadi terlihat. Bila stok cukup
// menurut persen tapi kurang menurut jadwal produksi, itu informasi terpenting di layar —
// dan dua peringatan terpisah justru menyembunyikannya, karena tidak ada satu tempat pun
// yang memuat keduanya sekaligus.
//
// Sudah dinaikkan jadi aturan umum di CLAUDE.md: peringatan disusun menurut KEPUTUSAN yang
// harus diambil orang, bukan menurut perhitungan yang menghasilkannya.
//
// ============================================================================
// BERKAS INI MURNI PERHITUNGAN
// ============================================================================
// Tidak menyentuh database, tidak merender apa pun. Yang diputuskan di sini adalah ARTI:
// bahan ini perlu dipesan atau tidak, dan kalimat apa yang menjelaskannya. Dengan begitu
// aturannya bisa diuji tanpa fixture, dan dua layar yang menampilkan hal yang sama tidak
// pernah mengatakannya dengan cara berbeda.

export interface KebutuhanProduksi {
  /// Total kuantitas bahan ini yang dibutuhkan seluruh Work Order yang masih berjalan.
  totalDibutuhkan: number;
  /// Kuantitas yang benar-benar ada dan bisa dipakai.
  tersedia: number;
  /// Berapa Work Order yang membutuhkannya. Dipakai di kalimat, bukan di perhitungan.
  jumlahWorkOrder: number;
  /// Nama perintah produksi yang tertahan, siap tampil. Diminta pemilik produk: peringatan
  /// gabungan harus menyebut perintah produksi MANA, bukan cuma berapa banyak — sebab
  /// peringatan per Work Order yang dulu menyebutkannya sudah dicabut.
  perintah: string[];
}

export interface InputPeringatanBahan {
  namaBahan: string;
  satuan: string;
  stok: PenilaianStok;
  /// null berarti BELUM DIKETAHUI — beda dari "nol kebutuhan". Lihat catatan di bawah.
  kebutuhan: KebutuhanProduksi | null;
}

export type KodeSebab = 'stok_menipis' | 'stok_habis' | 'kurang_untuk_produksi';

export interface PeringatanBahan {
  perlu: boolean;
  keparahan: 'warning' | 'critical';
  sebabMenyala: KodeSebab[];
  /// TRUE bila satu sebab menyala sementara sebab lain justru menenangkan. Ini keadaan yang
  /// paling perlu dilihat manusia, dan justru yang paling mudah hilang saat peringatannya
  /// dipisah-pisah.
  bertentangan: boolean;
  pesan: string;
}

function angka(n: number): string {
  // Dibulatkan ke 2 desimal lalu dirapikan: 40 tetap "40", bukan "40.00".
  const b = Math.round(n * 100) / 100;
  return String(b);
}

export function susunPeringatanBahan(input: InputPeringatanBahan): PeringatanBahan {
  const { namaBahan, satuan, stok, kebutuhan } = input;

  const diam: PeringatanBahan = {
    perlu: false,
    keparahan: 'warning',
    sebabMenyala: [],
    bertentangan: false,
    pesan: ''
  };

  // BAHAN YANG BELUM PERNAH DIBELI TIDAK MASUK PERINGATAN INI SAMA SEKALI (KK.2 butir d).
  // "Belum ada pembelian" dan "stok habis" sama-sama menampilkan nol, dan artinya berbeda
  // jauh: yang pertama belum pernah dipakai siapa pun, yang kedua pernah ada lalu habis.
  // Mencampurnya membuat daftar peringatan penuh bahan yang memang belum pernah dipakai —
  // dan daftar seperti itu berhenti dibaca dalam hitungan hari.
  if (stok.status === 'belum_pernah_masuk') return diam;

  const kurang = kebutuhan !== null && kebutuhan.totalDibutuhkan > kebutuhan.tersedia;
  const kekurangan = kurang ? kebutuhan!.totalDibutuhkan - kebutuhan!.tersedia : 0;

  // KEPUTUSAN "status stok mana yang layak jadi peringatan" tetap hidup di SATU tempat --
  // perluPeringatan() di stockThreshold.ts. Menuliskannya ulang di sini akan melahirkan
  // jalur kedua yang tidak ikut berubah saat yang pertama diperbaiki: kelas cacat yang
  // sudah menggigit berkali-kali di proyek ini.
  const sebabMenyala: KodeSebab[] = [];
  if (perluPeringatan(stok)) sebabMenyala.push(stok.status === 'habis' ? 'stok_habis' : 'stok_menipis');
  if (kurang) sebabMenyala.push('kurang_untuk_produksi');

  if (sebabMenyala.length === 0) return diam;

  // BAGIAN SEBAB — seluruhnya, bukan yang pertama saja (KK.2 butir a).
  const bagian: string[] = [];
  if (stok.status === 'habis') {
    bagian.push('stok HABIS');
  } else if (stok.status === 'menipis') {
    bagian.push(
      stok.ambang === null
        ? 'sisa stok di bawah ambang'
        : `sisa ${angka(stok.stokSekarang)} ${satuan}, di bawah ambang ${angka(stok.ambang)} ${satuan}`
    );
  }
  if (kurang) {
    const wo = kebutuhan!.jumlahWorkOrder;
    // Menyebut NAMA perintah produksinya, bukan cuma jumlahnya. Dibatasi tiga supaya
    // kalimatnya tetap terbaca; sisanya disebut sebagai hitungan.
    const nama = kebutuhan!.perintah;
    const disebut = nama.slice(0, 3).join(', ');
    const sisa = nama.length - 3;
    const rincian = nama.length === 0 ? '' : sisa > 0 ? ` (${disebut}, dan ${sisa} lagi)` : ` (${disebut})`;
    bagian.push(`kurang ${angka(kekurangan)} ${satuan} untuk ${wo} perintah produksi yang sedang berjalan${rincian}`);
  }

  // SEBAB YANG TIDAK MENYALA PUN DISEBUT BILA MEMBANTU KEPUTUSAN (KK.2 butir b).
  // Ini yang MENCEGAH PEMBELIAN TERGESA-GESA: stok yang terlihat menipis menurut persen
  // belum tentu kurang untuk produksi yang benar-benar dijadwalkan.
  let bertentangan = false;
  let penenang: string | null = null;
  if (stok.status === 'menipis' && kebutuhan !== null && !kurang) {
    bertentangan = true;
    penenang = 'Masih cukup untuk seluruh produksi yang sedang berjalan.';
  } else if (kurang && stok.status === 'aman') {
    bertentangan = true;
    penenang = 'Sisa stoknya sendiri masih di atas ambang.';
  }

  // Kebutuhan produksi yang BELUM DIKETAHUI disebut apa adanya, tidak dianggap nol.
  // Menganggapnya nol berarti diam-diam mengklaim "produksi tidak membutuhkannya", dan itu
  // klaim yang tidak dimiliki siapa pun di sini.
  const catatanTakDiketahui =
    kebutuhan === null ? 'Kebutuhan produksi belum bisa dihitung, jadi sebab itu tidak ikut dinilai.' : null;

  const inti = bagian.join(', DAN ');
  // Sebab yang BERTENTANGAN ditandai di DEPAN (KK.2 butir c) — bukan diselipkan di ekor
  // kalimat. Justru keadaan inilah yang paling perlu dilihat manusia, dan yang paling mudah
  // terlewat bila ia cuma jadi anak kalimat.
  const kepala = bertentangan ? `${namaBahan} — PERIKSA DULU.` : `${namaBahan} — perlu dipesan.`;
  const pesan = [kepala, `${inti[0].toUpperCase()}${inti.slice(1)}.`, penenang, catatanTakDiketahui]
    .filter(Boolean)
    .join(' ');

  return {
    perlu: true,
    // Habis atau kurang untuk produksi yang sudah berjalan sama-sama menghentikan pekerjaan;
    // menipis saja belum.
    keparahan: stok.status === 'habis' || kurang ? 'critical' : 'warning',
    sebabMenyala,
    bertentangan,
    pesan
  };
}

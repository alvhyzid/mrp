'use client';

import { ModalFooter, ProgressIndicator, ProgressStep } from '@carbon/react';

import { useMediaQuery } from '@/lib/useMediaQuery';

// MODAL BERTAHAP — SATU PINTU BERSAMA untuk formulir panjang (DS-18, 26 Agu 2026).
//
// ============================================================================
// KENAPA KOMPONEN, BUKAN CETAKAN YANG DISALIN
// ============================================================================
// Cetakannya lahir di modal PO klien dan langsung dibutuhkan TIGA modal lain (karyawan,
// item, BOM). Menyalinnya empat kali berarti empat tempat yang harus ditemukan saat salah
// satu detailnya diperbaiki — dan proyek ini sudah punya lima contoh kelas itu: 88 warna
// tulis tangan, elemen mentah berdampingan komponen bersama, 18 tooltip hover, 36 pengambil
// tanda pengenal, dan tabel yang melewatkan kelas responsif.
//
// ============================================================================
// DUA HAL YANG MUDAH SALAH, DAN ITULAH ISI KOMPONEN INI
// ============================================================================
// 1. FOOTER WAJIB memakai prop `secondaryButtons`, BUKAN children. Hanya lewat prop itu
//    Carbon memasang kelas `--modal-footer--three-button` yang memberi lebar 25% per tombol.
//    Tiga tombol yang ditulis sebagai children menghasilkan tombol selebar 50% yang meluber.
// 2. `children` TETAP diwajibkan oleh tipe ModalFooter di @carbon/react 1.114 meski
//    komponennya tidak merendernya sama sekali saat secondaryButtons dipakai. Diisi {null}.
//
// DEVIASI YANG DISEBUT TERBUKA: halaman Usage Carbon menggambar tombol Batal sebagai GHOST,
// sedangkan komponen React-nya merender kedua tombol sekunder dengan kind="secondary" dan
// tidak menyediakan pilihan. Yang diikuti KOMPONENNYA, bukan gambarnya. Posisi Batal di kiri
// diatur satu aturan CSS di customer-po.scss (.cds--modal-footer--three-button).

export interface LangkahModal {
  /// Judul PENDEK. Diukur 26 Agu 2026: judul panjang terpotong jadi "Orang yang dihub..."
  /// pada modal 691px, dan penanda langkah yang terpotong tidak memberi tahu apa pun.
  judul: string;
  /// Keterangan satu baris di bawah judul. Di sinilah arti lengkapnya hidup.
  ringkas: string;
}

interface PenandaProps {
  langkah: LangkahModal[];
  aktif: number;
  onPindah: (indeks: number) => void;
  className?: string;
}

/// Lantai lebar per langkah yang dipasang Carbon, dalam piksel.
///
/// Dibaca dari paket terpasang, bukan ditaksir:
///   @carbon/styles/scss/components/progress-indicator/_progress-indicator.scss
///   .cds--progress--space-equal .cds--progress-step { min-inline-size: 8rem }
///
/// Bila Carbon kelak mengubah angka ini, ambang di bawah ikut meleset — dan gejalanya
/// adalah luberan yang persis sama seperti sebelum DS-21. Penjaganya:
/// tests/ds21_penanda_langkah_responsif.test.ts membaca nilainya langsung dari paket.
const LANTAI_LANGKAH_PX = 128;

/// Sisa yang tidak bisa dipakai langkah: jarak dalam isi modal, dibulatkan ke atas.
/// Diturunkan dari pengukuran, bukan dipilih: pada viewport 360px lebar isi modal terukur
/// 358px, dan luberan terukur cocok persis dengan `16 + N x 128 - 358` untuk N = 2, 3, dan 4.
const SISA_TAK_TERPAKAI_PX = 18;

/// Ambang tempat penanda MASIH MUAT mendatar, dihitung dari jumlah langkahnya sendiri.
///
/// ==========================================================================
/// KENAPA DIHITUNG, BUKAN SATU AMBANG UNTUK SEMUA
/// ==========================================================================
/// Versi pertama memakai satu ambang tetap (breakpoint md Carbon, 672px) untuk semua
/// formulir. Diukur, ia MEMPERBAIKI ketiga formulir yang meluber TAPI MENGENAKAN ONGKOS
/// pada formulir yang tidak pernah meluber: BOM hanya punya dua langkah, penandanya muat
/// dengan nyaman di 360px, namun tetap dipaksa menurun dan tumbuh 28px -> 116px. Delapan
/// puluh delapan piksel terbuang justru di layar terkecil, untuk cacat yang tidak ia punya.
///
/// Aturan proyek menjawabnya langsung: jangan menawarkan — atau menetapkan — sesuatu yang
/// seharusnya DIHITUNG. Apakah penanda muat adalah aritmetika, bukan selera.
///
/// Ambangnya jadi: 2 langkah 274px · 3 langkah 402px · 4 langkah 530px.
/// Ia juga menggeneralisasi dengan benar: formulir enam langkah kelak akan menurun sampai
/// 786px, dan itu memang lebar tempat ia benar-benar berhenti muat.
function ambangMendatar(jumlahLangkah: number): string {
  return `(min-width: ${jumlahLangkah * LANTAI_LANGKAH_PX + SISA_TAK_TERPAKAI_PX}px)`;
}

/// Penanda langkah. Ia juga navigasi: langkah yang sudah dilewati bisa diklik untuk kembali.
///
/// ==========================================================================
/// DS-21 — KENAPA IA MENURUN DI LAYAR SEMPIT
/// ==========================================================================
/// Diukur di peramban pada viewport 360px: penanda ini meluber melewati tepi kanan isi
/// modal, dan besarnya berskala dengan jumlah langkah —
///   2 langkah 0px · 3 langkah 42px · 4 langkah 170px.
///
/// Penyebabnya satu deklarasi milik Carbon:
///   .cds--progress--space-equal .cds--progress-step { min-inline-size: 8rem }
/// 8rem = 128px LANTAI per langkah. `spaceEqually` memberi flex-grow, tetapi lantai itu
/// menahannya sehingga langkahnya tidak bisa menyusut. Aritmetikanya mereproduksi ketiga
/// angka terhadap lebar isi modal 358px: 16 + N x 128 - 358.
///
/// Varian `vertical` Carbon MENCABUT lantai itu (`min-inline-size: initial`), jadi
/// perbaikannya memakai Carbon apa adanya — bukan menimpanya.
///
/// EMPAT JALAN LAIN YANG DITOLAK, dicatat supaya tidak dicoba ulang:
///  0. Satu ambang tetap 42rem untuk semua formulir — diukur mengenakan 88px ruang
///     terbuang pada BOM di 360px, formulir yang penandanya tidak pernah meluber.
///  1. Memotong dengan `overflow: hidden` — menyembunyikan berapa langkah tersisa.
///  2. Mencabut `spaceEqually` saja — lantainya cuma turun 8rem -> 7rem (112px), yang
///     menyembuhkan formulir 3 langkah tetapi MENINGGALKAN PO Klien meluber 106px.
///  3. Menimpa lantainya jadi nol dan tetap mendatar — 4 langkah jadi ~85px masing-masing,
///     dan `.cds--progress-label` memotong teksnya. Berkas ini sendiri sudah mencatat bahwa
///     penanda langkah yang terpotong tidak memberi tahu apa pun (lihat LangkahModal.judul).
export function PenandaLangkah({ langkah, aktif, onPindah, className }: PenandaProps) {
  const mendatar = useMediaQuery(ambangMendatar(langkah.length), true);

  return (
    <ProgressIndicator
      currentIndex={aktif}
      // Carbon menonaktifkan space-equal sendiri saat vertical
      // (ProgressIndicator.js: `spaceEqually && !vertical`). Dibuat bersyarat di sini juga
      // supaya yang terbaca di kode sama dengan yang benar-benar berlaku.
      spaceEqually={mendatar}
      vertical={!mendatar}
      onChange={onPindah}
      className={className}
    >
      {langkah.map((l) => (
        <ProgressStep key={l.judul} label={l.judul} secondaryLabel={l.ringkas} />
      ))}
    </ProgressIndicator>
  );
}

interface FooterProps {
  langkah: LangkahModal[];
  aktif: number;
  onPindah: (indeks: number) => void;
  onBatal: () => void;
  /// Label tombol utama di LANGKAH TERAKHIR — aksi finalnya, mis. "Buat PO klien".
  labelAksiAkhir: string;
  onSimpan: () => void;
  sedangMenyimpan?: boolean;
}

/// Footer bertahap: Batal di kiri, Sebelumnya + Berikutnya berpasangan di kanan.
export function FooterBertahap({
  langkah,
  aktif,
  onPindah,
  onBatal,
  labelAksiAkhir,
  onSimpan,
  sedangMenyimpan = false
}: FooterProps) {
  const terakhir = aktif >= langkah.length - 1;
  return (
    <ModalFooter
      secondaryButtons={[
        { buttonText: 'Batal', onClick: onBatal },
        { buttonText: 'Sebelumnya', onClick: () => onPindah(Math.max(0, aktif - 1)) }
      ]}
      primaryButtonText={terakhir ? (sedangMenyimpan ? 'Menyimpan...' : labelAksiAkhir) : 'Berikutnya'}
      primaryButtonDisabled={sedangMenyimpan}
      onRequestSubmit={() => {
        if (!terakhir) {
          onPindah(aktif + 1);
          return;
        }
        onSimpan();
      }}
    >
      {/* Lihat catatan nomor 2 di kepala berkas: tipe mewajibkannya, komponennya mengabaikannya. */}
      {null}
    </ModalFooter>
  );
}

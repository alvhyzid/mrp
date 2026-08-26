'use client';

import { ModalFooter, ProgressIndicator, ProgressStep } from '@carbon/react';

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

/// Penanda langkah. Ia juga navigasi: langkah yang sudah dilewati bisa diklik untuk kembali.
export function PenandaLangkah({ langkah, aktif, onPindah, className }: PenandaProps) {
  return (
    <ProgressIndicator currentIndex={aktif} spaceEqually onChange={onPindah} className={className}>
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

'use client';

import { Breadcrumb, BreadcrumbItem } from '@carbon/react';

// KEPALA HALAMAN — SATU PINTU BERSAMA untuk remah roti + judul + baris jumlah (26 Agu 2026).
//
// KENAPA KOMPONEN, BUKAN ATURAN TERTULIS. Cetakan ini ditetapkan pemilik produk di halaman
// Master Item. Bila tiap halaman menyalinnya sendiri, cetakannya tersalin ~30 kali dan
// perbaikan berikutnya harus menemukan 30 tempat — itu persis kelas "dua jalur hidup" yang
// sudah menggigit lewat 88 warna heksadesimal, 36 pengambil tanda pengenal, dan 18 tooltip
// hover. Terbukti sekali lagi 26 Agu 2026: halaman Routing dibangun dengan menyalin cetakan
// halaman Pelanggan, dan ikut membawa apa yang salah di sana.
//
// ANATOMI (dari Master Item, bukan dari selera):
//   1. REMAH ROTI. Tingkat tengah adalah nama WORKSPACE di menu kiri — ia BUKAN halaman,
//      jadi tidak boleh tampak seperti tautan. Carbon menempelkan kelas `cds--link` ke
//      setiap butir remah termasuk yang tidak punya alamat; `.halaman__remah-mati`
//      mengembalikannya ke warna teks sekunder supaya jujur.
//   2. JUDUL pendek.
//   3. SATU BARIS PENGANTAR yang menyebut BERAPA BANYAK yang sedang dilihat — bukan
//      paragraf penjelasan. Orang membuka daftar untuk mencari sesuatu, bukan untuk membaca.

export type ButirRemah = {
  label: string;
  /// Diisi HANYA bila tingkat ini benar-benar punya halaman. Dikosongkan untuk nama
  /// kelompok menu — dan itu keadaan yang normal, bukan kekurangan.
  href?: string;
};

interface Props {
  remah: ButirRemah[];
  judul: string;
  /// Baris jumlah. Node, bukan string, supaya halaman bisa menyisipkan angka terhitung.
  pengantar?: React.ReactNode;
}

export function KepalaHalaman({ remah, judul, pengantar }: Props) {
  return (
    <>
      {remah.length > 0 ? (
        <Breadcrumb noTrailingSlash className="halaman__remah">
          {remah.map((butir, i) => {
            const terakhir = i === remah.length - 1;
            if (terakhir) {
              return (
                <BreadcrumbItem key={butir.label} isCurrentPage>
                  {butir.label}
                </BreadcrumbItem>
              );
            }
            return (
              <BreadcrumbItem key={butir.label} href={butir.href}>
                {butir.href ? butir.label : <span className="halaman__remah-mati">{butir.label}</span>}
              </BreadcrumbItem>
            );
          })}
        </Breadcrumb>
      ) : null}

      <h1 className="halaman__judul">{judul}</h1>
      {pengantar ? <p className="halaman__pengantar">{pengantar}</p> : null}
    </>
  );
}

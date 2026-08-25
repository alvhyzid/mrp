'use client';

import { Layer, Tile } from '@carbon/react';

// RANGKA LAYAR PUBLIK (DS-02, 25 Agu 2026) — satu cetakan untuk ketujuh layar yang dilihat
// pihak luar: beranda, daftar, masuk, lupa sandi, atur ulang sandi, undangan, dan konfirmasi
// penerimaan barang.
//
// KENAPA SATU KOMPONEN, bukan menyalin susunannya ke tiap halaman:
// sebelum migrasi ini, ketujuh layar menyalin susunan yang sama persis — kartu di tengah,
// judul, pengantar, isi — dan tiap salinan menyimpan warna serta ukurannya sendiri. Akibatnya
// setiap perbaikan harus diterapkan tujuh kali, dan cukup satu yang terlewat untuk membuat
// perbaikannya terlihat "sudah diterapkan" padahal belum. Itu kelas cacat "dua jalur hidup
// untuk hal yang sama" yang sedang diberantas, dan cara satu-satunya menutupnya adalah tidak
// menyediakan jalur kedua.
//
// Komponen ini SENGAJA tidak menerima className atau style: begitu ia bisa ditimpa dari luar,
// jalur kedua itu terbuka lagi.

interface LayarPublikProps {
  judul: string;
  pengantar?: string;
  /// Kartu yang lebih lebar untuk isi bertabel (konfirmasi penerimaan barang).
  lebar?: boolean;
  children: React.ReactNode;
}

export function LayarPublik({ judul, pengantar, lebar = false, children }: LayarPublikProps) {
  return (
    <main className="publik-halaman">
      <Tile className={lebar ? 'publik-kartu publik-kartu--lebar' : 'publik-kartu'}>
        <h1 className="publik-judul">{judul}</h1>
        {pengantar && <p className="publik-pengantar">{pengantar}</p>}
        {/*
          LAPIS. Bukan hiasan, dan bukan pilihan — ini yang membuat field TERLIHAT.

          Di tema Gray 10, latar halaman abu-abu (#f4f4f4) dan lapis PERTAMA putih (#fff).
          Tile menempati lapis pertama itu. Field yang diletakkan begitu saja di dalamnya juga
          memakai warna lapis pertama, jadi PUTIH DI ATAS PUTIH — hanya garis bawahnya yang
          menandai di mana harus mengetik.

          <Layer> menggeser isinya ke lapis KEDUA, tempat warna field jadi abu-abu muda. Kotak
          isiannya kembali terlihat sebagai kotak.

          Ini ditemukan dengan MELIHAT tangkapan layarnya, bukan dengan mengukur: halaman ini
          sudah lolos seluruh pengukuran — nol sudut membulat, nol elemen mentah, nol gulir
          menyamping — dan tetap punya formulir yang kotaknya tidak kelihatan. Pengukuran
          membuktikan sebuah nilai sesuai niatnya; ia tidak bisa melihat bahwa dua nilai yang
          sama-sama benar kebetulan berwarna sama.
        */}
        <Layer>{children}</Layer>
      </Tile>
    </main>
  );
}

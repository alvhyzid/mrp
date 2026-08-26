'use client';

import { ToastNotification } from '@carbon/react';

// AREA NOTIFIKASI — SATU PINTU untuk seluruh pesan melayang di aplikasi (25 Agu 2026).
//
// ============================================================================
// APA YANG CARBON TETAPKAN, DAN APA YANG TIDAK — diukur dari paket terpasang
// ============================================================================
// DITETAPKAN Carbon:
//   - lebar toast 288px (352px di breakpoint `max`), beserta bayangannya;
//   - anatomi, warna, dan ikon per jenis.
//
// TIDAK ditetapkan Carbon, dan ini yang membuat berkas ini perlu ada:
//   - POSISI. `_toast-notification.scss` punya NOL aturan `position`. Carbon menyerahkan
//     penempatannya ke aplikasi.
//   - DURASI. `timeout` bawaan ToastNotification adalah **0**, artinya TIDAK PERNAH hilang
//     sendiri. Carbon tidak menyebut angka mana pun.
//
// Karena keduanya tidak ditetapkan Carbon, keduanya adalah KEPUTUSAN KITA — dan keputusan
// itu hidup DI SINI, satu tempat, supaya tiap halaman tidak memilih posisinya sendiri-sendiri.

/// Berapa lama pesan BERHASIL bertahan sebelum hilang sendiri.
///
/// ANGKANYA KEPUTUSAN KITA, BUKAN ANGKA CARBON — Carbon tidak menyebut durasi apa pun.
/// Lima detik dipilih karena dua alasan yang bisa diperiksa:
///   1. cukup untuk membaca satu kalimat konfirmasi pendek tanpa terburu-buru;
///   2. isinya TIDAK PENTING untuk disimpan — perubahannya sudah terlihat di layar, jadi
///      hilangnya pesan tidak menghilangkan informasi apa pun.
/// Ubah di sini bila terasa terlalu cepat; jangan disebar ke tiap halaman.
export const DURASI_NOTIFIKASI_MS = 5000;

export type JenisNotifikasi = 'success' | 'error' | 'warning' | 'info';

export interface Notifikasi {
  id: string;
  jenis: JenisNotifikasi;
  judul: string;
  rincian?: string;
}

/// Pesan GAGAL TIDAK ikut hilang sendiri, dan ini bukan kelalaian.
///
/// Panduan Carbon sendiri: "jangan pakai toast untuk informasi yang harus diingat pengguna
/// sambil bekerja". Pesan berhasil boleh lewat begitu saja; pesan gagal memuat hal yang
/// harus DITINDAKLANJUTI, dan pesan yang menghilang sebelum dibaca sama dengan pesan yang
/// tidak pernah muncul. Yang gagal hanya bisa ditutup dengan sengaja.
function durasiUntuk(jenis: JenisNotifikasi): number {
  return jenis === 'success' || jenis === 'info' ? DURASI_NOTIFIKASI_MS : 0;
}

interface Props {
  daftar: Notifikasi[];
  onTutup: (id: string) => void;
}

/// Ditempatkan di KANAN ATAS, tepat DI BAWAH header aplikasi.
///
/// BATAS YANG DISEBUT TERBUKA: jarak dari atas mengikuti tinggi header kerangka aplikasi
/// (3rem), lewat variabel `--fabrix-offset-notifikasi` di src/styles/carbon.scss. Layar
/// PUBLIK (login, daftar, POD) tidak punya header itu; bila kelak mereka memakai area ini,
/// variabelnya WAJIB disetel ulang ke 0 di stylesheet layar publik — kalau tidak, pesannya
/// akan menggantung 48px dari atas tanpa apa pun di atasnya.
export function AreaNotifikasi({ daftar, onTutup }: Props) {
  if (daftar.length === 0) return null;

  return (
    <div className="area-notifikasi" role="region" aria-label="Pemberitahuan">
      {daftar.map((n) => (
        <ToastNotification
          key={n.id}
          kind={n.jenis}
          lowContrast
          title={n.judul}
          subtitle={n.rincian}
          timeout={durasiUntuk(n.jenis)}
          // `alert` memaksa pembaca layar menyela; `status` mengumumkan dengan sopan.
          // Yang gagal memang layak menyela, yang berhasil tidak.
          role={n.jenis === 'error' ? 'alert' : 'status'}
          statusIconDescription={n.jenis === 'error' ? 'Gagal' : 'Berhasil'}
          onClose={() => {
            onTutup(n.id);
            return true;
          }}
        />
      ))}
    </div>
  );
}

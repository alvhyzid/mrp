'use client';

import { useId, useState, type ReactNode } from 'react';
import { Help } from '@carbon/icons-react';

// LABEL KOLOM DENGAN IKON BANTUAN (MST-15 / B.2).
//
// Keluhan pemilik produk: beberapa kolom di formulir tidak jelas maksudnya, dan
// penjelasannya tidak ada di mana pun kecuali di kepala orang yang membuatnya.
//
// KENAPA SATU KOMPONEN (label + ikon + panel), BUKAN ikon berdiri sendiri:
// versi pertama cuma mengekspor ikonnya, dan pemanggil menyusun sendiri barisnya.
// Hasilnya di layar 360 px panel penjelasan ikut masuk ke baris label dan menggencet
// labelnya jadi kolom sempit setinggi enam baris. Dengan tata letaknya dikunci di
// dalam komponen, pemanggil tidak bisa salah menyusunnya -- dan itu berlaku juga
// untuk kolom-kolom yang belum ditulis.
//
// TIGA KEPUTUSAN RANCANGAN LAIN:
// 1. DIBUKA DENGAN KLIK, BUKAN HOVER. Tooltip yang muncul saat kursor lewat tidak
//    bisa dipakai di layar sentuh sama sekali -- dan aplikasi ini dipakai di lantai
//    produksi lewat HP/tablet. Klik bekerja di keduanya.
// 2. TERBUKA DI TEMPAT (inline) DI BAWAH LABEL, bukan melayang di atas. Panel
//    melayang gampang terpotong di dalam modal yang menggulir; teks yang terbuka di
//    bawah labelnya ikut menggulir bersama isinya dan tidak pernah terpotong.
// 3. BUKAN memakai ProvenanceInfoButton. Itu untuk ANGKA hasil hitungan (rumus, nilai
//    input, dokumen sumber). Ini untuk ARTI sebuah kolom isian -- memakai panel
//    bertab yang berat untuk satu kalimat penjelasan justru membuat penjelasannya
//    terasa lebih rumit daripada pertanyaannya.
//
// AREA SENTUH 44x44 px mengikuti aturan responsive proyek (bisa ditekan jari, termasuk
// jari bersarung tangan) -- TAPI area itu dibuat lewat lapisan absolut, bukan lewat
// ukuran tombolnya. Lihat komentar panjang di dalam komponen: tombol yang benar-benar
// setinggi 44px membuat baris label berikon lebih tinggi 8px daripada label biasa, dan
// itu menggeser seluruh field di sebelahnya.
export function FieldLabel({ children, help }: { children: ReactNode; help?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Tanpa help: dirender sebagai satu baris teks biasa. Tingginya kini SAMA dengan
  // versi berikon (20px), jadi keduanya boleh berdampingan di satu grid tanpa bergeser.
  if (!help) {
    return <span className="text-sm font-medium text-foreground">{children}</span>;
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{children}</span>
        {/* TINGGI BARIS LABEL WAJIB SAMA, ada ikon maupun tidak.
            //
            // Versi pertama memakai tombol h-11 (44px) supaya target sentuhnya memenuhi
            // aturan responsive. Akibatnya baris label BERIKON setinggi 28px sementara
            // baris label biasa 20px -- terukur, bukan dikira-kira. Selisih 8px itu
            // menggeser field di bawahnya, sehingga kolom berikon tidak pernah rata
            // dengan kolom di sebelahnya. Pemilik produk melihatnya sebagai formulir
            // yang "tidak rapi", dan memang begitu.
            //
            // Sekarang tombolnya seukuran ikonnya (20px, setinggi satu baris teks),
            // TAPI area sentuhnya tetap 44x44 lewat lapisan tak terlihat yang
            // diposisikan absolut (after:-inset-3 => 20 + 12 + 12 = 44). Area sentuh
            // tidak ikut menentukan tinggi baris, jadi target sentuh TIDAK dikorbankan
            // demi perataan -- keduanya didapat. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? 'Tutup penjelasan kolom ini' : 'Apa maksud kolom ini?'}
          onClick={() => setOpen((v) => !v)}
          className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors after:absolute after:-inset-3 after:content-[''] hover:text-foreground focus:outline-none focus:outline-2 focus:outline-ring"
        >
          <Help size={16} />
        </button>
      </span>
      {open ? (
        <span
          id={panelId}
          className="block border-l-2 border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground"
        >
          {help}
        </span>
      ) : null}
    </span>
  );
}

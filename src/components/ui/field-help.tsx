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
// Ukuran tombol 44x44 px mengikuti aturan responsive proyek (bisa ditekan jari,
// termasuk jari bersarung tangan), walau ikonnya sendiri kecil.
export function FieldLabel({ children, help }: { children: ReactNode; help?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!help) {
    return <span className="text-sm font-medium text-foreground">{children}</span>;
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{children}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? 'Tutup penjelasan kolom ini' : 'Apa maksud kolom ini?'}
          onClick={() => setOpen((v) => !v)}
          className="-my-2 -mr-3 inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:outline-2 focus:outline-ring"
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

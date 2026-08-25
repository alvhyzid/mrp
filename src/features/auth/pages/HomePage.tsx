'use client';

import Link from 'next/link';
import { Button } from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';
import { LayarPublik } from '@/components/ui/layar-publik';

// Dimigrasikan ke Carbon pada 25 Agu 2026 (DS-02).
//
// Dua tombol berdampingan: "Masuk" primer, "Daftar" sekunder. Perbedaannya BUKAN hiasan —
// Carbon memakai tingkat tombol untuk menyatakan mana jalan yang biasa ditempuh. Sebagian
// besar orang yang membuka halaman ini sudah punya akun; yang mendaftar hanya sekali seumur
// pemakaian. Dua tombol yang terlihat sama berat memaksa setiap pengunjung membaca keduanya.

export default function HomePage() {
  return (
    // Nama produk SENGAJA tidak diubah di migrasi ini. Di dokumen internal sistem ini disebut
    // FABRIX, di layar ia "MRP SaaS" — perbedaan itu nyata dan perlu diputuskan pemilik
    // produk, bukan diselipkan diam-diam ke dalam pekerjaan yang niatnya soal tampilan.
    <LayarPublik
      judul="MRP SaaS"
      pengantar="Fondasi platform MRP multi-tenant untuk manufaktur. Masuk dulu untuk melanjutkan."
      aksi={
        <>
          <Button size="lg" kind="secondary" href="/register" as={Link}>
            Daftar
          </Button>
          <Button size="lg" href="/login" as={Link} renderIcon={ArrowRight}>
            Masuk
          </Button>
        </>
      }
    >
      <p className="publik-teks--redup">
        Sebagian besar orang yang membuka halaman ini sudah punya akun. Mendaftar hanya
        dilakukan sekali, saat perusahaan Anda pertama kali memakai sistem.
      </p>
    </LayarPublik>
  );
}

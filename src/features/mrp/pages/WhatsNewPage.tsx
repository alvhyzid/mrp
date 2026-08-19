'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Daftar dikelola manual (BUKAN otomatis dari commit log -- itu sistem
// tersendiri yang belum dibutuhkan, prinsip "jangan bikin abstraksi untuk
// kebutuhan yang belum nyata"). Perbarui daftar ini tiap kali fitur baru
// yang terlihat pengguna selesai dibangun -- item PALING BARU di paling atas.
const items: { title: string; date: string; href: string; description: string }[] = [
  {
    title: 'Laba Operasional',
    date: '21 Agu 2026',
    href: '/operating-profit',
    description: 'Halaman baru: margin kontribusi, overhead SDM, dan laba operasional per periode gajian (26 s/d 25), bukan lagi cuma bisa dicek lewat API.'
  },
  {
    title: 'Tim & Undangan',
    date: '21 Agu 2026',
    href: '/team',
    description: 'Kelola anggota tim dan undangan baru -- sudah ada sejak lama, sekarang punya jalan masuk dari menu (sebelumnya harus tahu alamatnya sendiri).'
  },
  {
    title: 'Keterangan Asal Angka di BOM',
    date: '21 Agu 2026',
    href: '/boms',
    description: 'Hasil standar per batch sekarang tampil dengan satuan asli item (botol/karton/sachet, bukan "pcs" generik) plus keterangan cara angkanya dihitung.'
  },
  {
    title: 'Margin Watch',
    date: '20 Agu 2026',
    href: '/sales-orders',
    description: 'Buka baris Sales Order mana pun untuk melihat proyeksi margin berjalan dan rincian 5 kategori selisih (harga bahan, pemakaian, reject, SDM, lembur) dibanding rencana.'
  },
  {
    title: 'Biaya SDM Standar dari Kru Nyata',
    date: '20-21 Agu 2026',
    href: '/sales-orders',
    description: 'Biaya SDM per batch sekarang dihitung dari komposisi kru nyata (gaji + tunjangan + BPJS pemberi kerja), bukan tarif rata-rata kasar -- ikut menentukan margin di panel Margin Watch.'
  },
  {
    title: 'Data Karyawan & Payroll Nyata',
    date: '21 Agu 2026',
    href: '/hr',
    description: 'Dashboard HRD sekarang menampilkan data karyawan asli (kode pabrik, PTKP, status kepegawaian) menggantikan data simulasi.'
  },
  {
    title: 'Cek Kelayakan & Kekurangan Bahan',
    date: '19-20 Agu 2026',
    href: '/sales-orders',
    description: 'Sistem memberi tahu apakah pesanan bisa dipenuhi tepat waktu berdasarkan kapasitas produksi nyata dan stok bahan yang ada.'
  },
  {
    title: 'Mulai/Selesaikan Batch Produksi',
    date: '19 Agu 2026',
    href: '/production',
    description: 'Staf produksi bisa mencatat mulai dan selesainya tiap batch langsung dari dashboard, termasuk hasil aktual dan reject.'
  },
  {
    title: 'Catat Jam Kerja (Labor Log)',
    date: '18-19 Agu 2026',
    href: '/work-orders',
    description: 'Catat jam kerja staf per batch produksi -- jadi dasar perhitungan biaya SDM aktual dibanding rencana.'
  },
  {
    title: 'Usulan Standar Produksi (K8)',
    date: '18 Agu 2026',
    href: '/ppic',
    description: 'Sistem mengusulkan standar produksi baru (unit per batch, batch per hari) begitu ada cukup data batch nyata -- tinggal disetujui atau ditolak PPIC.'
  },
  {
    title: 'Bukti Penerimaan & Surat Jalan',
    date: '17 Agu 2026',
    href: '/shipments',
    description: 'Pengiriman sekarang butuh foto bukti muat sebelum berangkat, dan customer bisa konfirmasi barang diterima lewat link/QR tanpa perlu login.'
  },
  {
    title: 'Format Rupiah Konsisten',
    date: '21 Agu 2026',
    href: '/items',
    description: 'Semua tampilan uang di seluruh sistem sekarang konsisten "Rp1.500.000" -- sebelumnya beberapa tempat menampilkan angka mentah tanpa pemisah ribuan.'
  }
];

export default function WhatsNewPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/whats-new');
        return;
      }
      setCheckingAccess(false);
    };
    checkAccess();
  }, [router]);

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="px-6 text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="flex w-full flex-col gap-6 px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Internal</p>
          <h1 className="text-2xl font-semibold text-foreground">Apa yang Baru</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fitur yang baru selesai dibangun -- klik judulnya untuk langsung membuka halamannya.</p>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">
                    <Link href={item.href} className="hover:underline">
                      {item.title}
                    </Link>
                  </CardTitle>
                  <Badge variant="secondary">{item.date}</Badge>
                </div>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={item.href} className="text-sm text-primary hover:underline">
                  Buka halaman →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}

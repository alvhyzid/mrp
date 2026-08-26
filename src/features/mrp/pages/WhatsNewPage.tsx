'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Link as CarbonLink, SkeletonText, Tag, Tile } from '@carbon/react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';

// Daftar dikelola manual (BUKAN otomatis dari commit log -- itu sistem
// tersendiri yang belum dibutuhkan, prinsip "jangan bikin abstraksi untuk
// kebutuhan yang belum nyata"). Perbarui daftar ini tiap kali fitur baru
// yang terlihat pengguna selesai dibangun -- item PALING BARU di paling atas.
const items: { title: string; date: string; href: string; description: string }[] = [
  {
    title: 'KPI Perusahaan',
    date: '25 Agu 2026',
    href: '/kpi',
    description: '5 KPI awal (Margin Kontribusi, Biaya/Unit, Laba Operasional, Yield, Nilai Persediaan) dalam bentuk kartu -- nilai kini, target, benchmark industri, dan tren, semuanya dihitung otomatis dari data nyata. Ada juga halaman "KPI Saya" -- KPI yang relevan dengan peran Anda, bukan papan peringkat.'
  },
  {
    title: 'Yield Aktual vs Rencana',
    date: '25 Agu 2026',
    href: '/production',
    description: 'Detail Work Order sekarang menunjukkan hasil produksi sungguhan dibanding rencana (dengan persentase) -- sebelumnya harus dihitung manual, hasil produksi tidak pernah tampil berdampingan dengan rencananya.'
  },
  {
    title: 'Biaya Pemberi Kerja per Bulan (Karyawan)',
    date: '25 Agu 2026',
    href: '/hr',
    description: 'Dashboard HRD sekarang menampilkan total biaya perusahaan per karyawan bulanan (gaji + BPJS) di satu kolom, bukan cuma gaji pokok -- PHL/harian ditandai tidak berlaku karena tidak punya angka bulanan tetap.'
  },
  {
    title: 'Klik Ikon Info untuk Lihat Asal Angka',
    date: '25 Agu 2026',
    href: '/sales-orders',
    description: 'Panel "Asal Angka" (ikon info kecil) sekarang ada di ±30 tempat lebih banyak: Margin Watch, Kelayakan Jadwal, biaya standar Item/BOM/Routing, Laba Operasional, Work Order, Warehouse, Pengiriman, dan Absensi -- klik ikonnya kapan pun bingung dari mana angka itu berasal.'
  },
  {
    title: 'Dashboard Proyek AI',
    date: '21 Agu 2026',
    href: '/ai-project',
    description: 'Khusus pemilik produk & leadership: progres roadmap fitur AI dihitung dari data nyata, bukan kira-kira, plus daftar "bisa dikerjakan sekarang".'
  },
  {
    title: 'Kamus — Antrean Penjelasan Data',
    date: '21 Agu 2026',
    href: '/kamus',
    description: 'Jelaskan makna kolom/metrik data supaya sistem dan tim baru tidak perlu bertanya berulang -- bisa dijawab siapa saja, kapan saja.'
  },
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
      <div className="halaman">
        <SkeletonText heading width="16rem" />
        <SkeletonText paragraph lineCount={4} />
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Internal" },
          { label: "What&apos;s New" }
        ]}
        judul="Apa yang baru"
        pengantar={
          <>
            {items.length} fitur yang baru selesai dibangun — klik judulnya untuk langsung membuka halamannya.
          </>
        }
      />

      <div className="baru-daftar">
        {items.map((item) => (
          <Tile key={item.title} className="baru-kartu">
            <div className="baru-kartu__kepala">
              {/* Link Carbon, bukan <a> bergaya sendiri: warna, garis bawah, dan penanda
                  fokusnya sudah ditetapkan Carbon. `as={Link}` menjaga perpindahan halaman
                  tetap lewat router Next, bukan memuat ulang seluruh aplikasi. */}
              <CarbonLink as={Link} href={item.href} className="baru-kartu__judul">
                {item.title}
              </CarbonLink>
              <Tag type="cool-gray">{item.date}</Tag>
            </div>
            <p className="halaman__redup">{item.description}</p>
          </Tile>
        ))}
      </div>
    </div>
  );
}

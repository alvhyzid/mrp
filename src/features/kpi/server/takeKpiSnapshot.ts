import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { listKpiCards } from './listKpiCards';

// MEREKAM SNAPSHOT KPI — aksi yang DISENGAJA, bukan efek samping membuka halaman (AUD-36).
//
// Sebelum 25 Agu 2026, snapshot ditulis di dalam jalur GET `listKpiCards`. Membuka halaman
// KPI menulis data. Selain melanggar aturan tetap proyek, ia merusak ARTI riwayatnya sendiri:
// grafik tren merekam "kapan orang membuka halaman", bukan "bagaimana angkanya bergerak".
//
// Sekarang perekamannya punya pemicu sendiri, dan pemicunya terlihat pengguna sebagai tombol.
// Pola ini sudah lebih dulu benar di takeAiProjectSnapshot.

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function takeKpiSnapshot(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    // Menghitung lewat jalur yang SAMA dengan yang ditampilkan di layar. Menghitungnya
    // sendiri di sini akan melahirkan jalur kedua, dan jalur kedua tidak ikut berubah saat
    // yang pertama diperbaiki.
    const hasil = await listKpiCards(request);
    if (hasil.status !== 200) return hasil;

    const kartu = (hasil.body.cards ?? []) as {
      metric_key: string;
      value: number | null;
      period_start: string;
      period_end: string;
      // `inputs` hidup di dalam panel Asal-Usul, bukan di akar kartu. Diambil dari sana
      // supaya sidik jarinya SAMA dengan yang ditampilkan ke pengguna -- kalau dihitung dari
      // tempat lain, jejaknya bisa berbeda dari yang dilihat orang di layar.
      provenance?: { inputs?: unknown };
    }[];

    const adminClient = getAdminClient();
    const baris = kartu
      .filter((k) => k.value !== null)
      .map((k) => ({
        company_id: appUser.company_id,
        metric_key: k.metric_key,
        period_start: k.period_start,
        period_end: k.period_end,
        value: k.value,
        inputs_hash: Buffer.from(JSON.stringify(k.provenance?.inputs ?? {})).toString('base64').slice(0, 64)
      }));

    if (baris.length === 0) {
      return { status: 200, body: { success: true, tersimpan: 0, pesan: 'Tidak ada KPI yang punya angka untuk direkam.' } };
    }

    // Upsert, bukan insert: merekam dua kali untuk periode yang sama tidak boleh melahirkan
    // dua baris yang saling bertentangan untuk periode yang sama.
    const { error } = await adminClient
      .from('kpi_snapshots')
      .upsert(baris, { onConflict: 'company_id,metric_key,period_start,period_end' });
    if (error) return { status: 500, body: { error: error.message } };

    return { status: 200, body: { success: true, tersimpan: baris.length } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

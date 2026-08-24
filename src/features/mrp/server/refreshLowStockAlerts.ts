import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { nilaiStok, perluPeringatan, type PenilaianStok } from '@/features/mrp/stockThreshold';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// MST-19 — MENGHIDUPKAN PEMICU `low_stock`.
//
// LATAR YANG PENTING: jenis alert `low_stock` sudah TERDAFTAR di CHECK constraint
// system_alerts dan sudah DITAMPILKAN di dashboard gudang sejak lama — tapi TIDAK ADA
// SATU PUN kode yang pernah membuatnya. Selama berbulan-bulan layar menampilkan tempat
// untuk peringatan yang tidak pernah bisa muncul. Ini salah satu dari empat kejadian
// "terlihat bekerja padahal tidak" yang sudah tercatat di CLAUDE.md, dan berkas ini
// menutupnya.
//
// DUA PERINGATAN YANG SENGAJA DIPISAH, jangan disatukan:
//   - `low_stock` (berkas ini) MELIHAT KE BELAKANG: sisa stok sudah di bawah ambang.
//     Pemiliknya gudang & purchasing. Tidak butuh rencana produksi apa pun.
//   - `material_shortage` (mesin kelayakan yang SUDAH ADA) MELIHAT KE DEPAN: bahan tidak
//     cukup untuk sekian batch yang direncanakan. Pemiliknya produksi/PPIC.
//   Menyatukannya akan membuat gudang menerima peringatan yang baru berarti setelah ada
//   rencana produksi, dan produksi menerima peringatan yang tidak menyebut rencana apa pun.
//
// target_department = null DISENGAJA, dan ini kompromi yang dicatat terbuka:
// system_alerts hanya punya SATU kolom department, sementara peringatan ini perlu terlihat
// gudang, purchasing, DAN produksi. Nilai null sudah didefinisikan sistem sebagai "relevan
// semua department" (lihat listSystemAlerts), jadi memakainya menghindari membangun
// mekanisme multi-department kedua. Konsekuensinya peringatan ini juga terlihat HR &
// finance — lebih luas dari yang diminta, tapi jauh lebih murah daripada jalur kedua.
export async function refreshLowStockAlerts(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    const companyId = appUser.company_id;
    const adminClient = getAdminClient();

    // Hanya item yang PUNYA ambang. Item tanpa ambang tidak bisa dinilai menipis atau
    // tidak — dan menebaknya berarti membangkitkan peringatan tanpa dasar.
    const { data: items, error: itemsError } = await adminClient
      .from('items')
      .select('item_id, item_code, name, base_uom, min_stock_level, min_stock_percent')
      .eq('company_id', companyId)
      .eq('is_active', true);
    if (itemsError) return { status: 500, body: { error: itemsError.message } };

    const kandidat = (items ?? []).filter(
      (i) => (i.min_stock_percent !== null && Number(i.min_stock_percent) > 0) || Number(i.min_stock_level ?? 0) > 0
    );
    if (kandidat.length === 0) {
      return { status: 200, body: { diperiksa: 0, dibuat: 0, ditutup: 0, catatan: 'Belum ada item yang punya ambang stok minimum.' } };
    }

    const itemIds = kandidat.map((i) => i.item_id);

    // Stok sekarang: dijumlah LINTAS PLANT per item, sama seperti kartu "di bawah min.
    // stok" di Ringkasan — supaya dua layar tidak pernah menyebut angka berbeda.
    const { data: lots, error: lotsError } = await adminClient
      .from('lots')
      .select('item_id, quantity_on_hand, status')
      .eq('company_id', companyId)
      .in('item_id', itemIds);
    if (lotsError) return { status: 500, body: { error: lotsError.message } };

    const stokPerItem = new Map<number, number>();
    for (const l of lots ?? []) {
      if (l.status !== 'available') continue;
      stokPerItem.set(l.item_id, (stokPerItem.get(l.item_id) ?? 0) + Number(l.quantity_on_hand ?? 0));
    }

    // "Pernah masuk" dihitung sekali untuk semua item (satu kueri), bukan satu kueri per
    // item -- pelajaran dari deleteOrDeactivateItem yang sempat butuh >5 detik karena
    // memeriksa berurutan.
    const { data: gerakan, error: gerakanError } = await adminClient
      .from('stock_movements')
      .select('qty, movement_type, lots!inner(item_id)')
      .eq('company_id', companyId)
      .in('lots.item_id', itemIds);
    if (gerakanError) return { status: 500, body: { error: gerakanError.message } };

    const masukPerItem = new Map<number, number>();
    for (const g of (gerakan ?? []) as unknown as { qty: number; movement_type: string; lots: { item_id: number } }[]) {
      const qty = Number(g.qty ?? 0);
      const masuk = g.movement_type === 'receipt' || g.movement_type === 'production_output' || (g.movement_type === 'adjustment' && qty > 0);
      if (!masuk) continue;
      const id = g.lots.item_id;
      masukPerItem.set(id, (masukPerItem.get(id) ?? 0) + qty);
    }

    const { data: alertAktif, error: alertError } = await adminClient
      .from('system_alerts')
      .select('system_alert_id, related_item_id, message')
      .eq('company_id', companyId)
      .eq('alert_type', 'low_stock')
      .eq('status', 'open');
    if (alertError) return { status: 500, body: { error: alertError.message } };
    const alertPerItem = new Map<number, { system_alert_id: number; message: string }>();
    for (const a of alertAktif ?? []) if (a.related_item_id) alertPerItem.set(a.related_item_id, a);

    const perluDibuat: Record<string, unknown>[] = [];
    const perluDitutup: number[] = [];
    const rincian: { item_code: string | null; status: PenilaianStok['status'] }[] = [];

    for (const item of kandidat) {
      const penilaian = nilaiStok({
        stokSekarang: stokPerItem.get(item.item_id) ?? 0,
        totalPernahMasuk: masukPerItem.get(item.item_id) ?? 0,
        minStockPercent: item.min_stock_percent === null ? null : Number(item.min_stock_percent),
        minStockLevel: item.min_stock_level === null ? null : Number(item.min_stock_level)
      });
      rincian.push({ item_code: item.item_code, status: penilaian.status });

      const sudahAda = alertPerItem.get(item.item_id);
      if (perluPeringatan(penilaian)) {
        // Tidak membuat peringatan kedua untuk item yang peringatannya masih terbuka --
        // peringatan yang menumpuk untuk satu hal membuat orang berhenti membacanya.
        if (sudahAda) continue;
        perluDibuat.push({
          company_id: companyId,
          alert_type: 'low_stock',
          related_item_id: item.item_id,
          message: `${item.item_code ?? item.name}: ${penilaian.keterangan}`,
          severity: penilaian.status === 'habis' ? 'critical' : 'warning',
          status: 'open',
          target_department: null
        });
      } else if (sudahAda) {
        // Stok sudah pulih (atau ambangnya dicabut) -> peringatan lama DITUTUP otomatis.
        // Tanpa ini, daftar peringatan cuma bertambah dan tidak pernah berkurang, lalu
        // berhenti dipercaya.
        perluDitutup.push(sudahAda.system_alert_id);
      }
    }

    if (perluDibuat.length > 0) {
      const { error } = await adminClient.from('system_alerts').insert(perluDibuat);
      if (error) return { status: 500, body: { error: error.message } };
    }
    if (perluDitutup.length > 0) {
      const { error } = await adminClient
        .from('system_alerts')
        .update({ status: 'resolved' })
        .in('system_alert_id', perluDitutup);
      if (error) return { status: 500, body: { error: error.message } };
    }

    return {
      status: 200,
      body: { diperiksa: kandidat.length, dibuat: perluDibuat.length, ditutup: perluDitutup.length, rincian }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
    return { status: message === 'UNAUTHORIZED' ? 401 : 500, body: { error: message } };
  }
}

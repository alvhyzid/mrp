import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { nilaiStok, type PenilaianStok } from '@/features/mrp/stockThreshold';
import { susunPeringatanBahan } from '@/features/mrp/alasanPeringatanBahan';

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
// PEMISAHAN DUA PERINGATAN DICABUT PEMILIK PRODUK (GDG-10 / KK.1, 25 Agu 2026).
//
// Berkas ini dulu menuliskan alasan MEMISAHKAN keduanya: `low_stock` melihat ke belakang
// (sisa stok di bawah ambang, milik gudang & purchasing), `material_shortage` melihat ke
// depan (bahan kurang untuk sekian batch, milik produksi & PPIC). Alasan itu benar dari
// sisi PERHITUNGAN dan keliru dari sisi ORANG YANG MEMBACANYA.
//
// Kata pemilik produk, dan ini yang membatalkannya: "Orang gudang tidak bertanya apakah
// stok di bawah ambang persen atau apakah kebutuhan melebihi sisa. Ia bertanya satu hal:
// bahan ini perlu dipesan atau tidak."
//
// Sejak sekarang berkas ini menghasilkan SATU peringatan per bahan yang menyebut SELURUH
// sebab yang menyala, dan menandai di depan bila kedua sebab BERTENTANGAN — keadaan yang
// justru paling perlu dilihat manusia dan yang paling mudah hilang saat peringatannya
// dipisah. Kalimatnya disusun di alasanPeringatanBahan.ts (murni perhitungan, tanpa
// database), supaya aturannya bisa diuji tanpa fixture.
//
// BELUM DIPUTUSKAN, dan sengaja tidak diubah sendiri: peringatan `material_shortage`
// PER WORK ORDER yang dibuat fungsi database recompute_work_order_material_readiness masih
// berjalan seperti biasa. Granularitasnya berbeda (per perintah produksi, bukan per bahan),
// jadi mencabutnya adalah keputusan pemilik produk — bukan efek samping pekerjaan ini.
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

    // PERSEN BAWAAN PERUSAHAAN (setelan ke-18, MST-27). Dibaca lebih dulu karena ia
    // menentukan item mana saja yang PUNYA ambang sama sekali: sebelum setelan ini ada,
    // item tanpa angka sendiri tidak pernah bisa diperiksa — dan itu hampir seluruh item,
    // karena persen per item tidak pernah sekali pun diisi.
    const { data: setelan } = await adminClient
      .from('company_settings')
      .select('setting_value')
      .eq('company_id', companyId)
      .eq('setting_key', 'default_min_stock_percent')
      .maybeSingle();
    const mentah = setelan?.setting_value;
    const persenBawaanPerusahaan =
      mentah === undefined || mentah === null || String(mentah).trim() === '' ? null : Number(mentah);

    // ========================================================================
    // KEBUTUHAN PRODUKSI YANG SEDANG BERJALAN (GDG-10 / KK.1)
    // ========================================================================
    // Sebab KEDUA dari peringatan gabungan. Dihitung dari Work Order yang belum selesai:
    // kuantitas rencana dikali kebutuhan per unit di BOM-nya.
    //
    // Dua keputusan yang sengaja diambil dan disebutkan terbuka:
    //   1. Stok yang dibandingkan adalah stok LINTAS PLANT, sama seperti sebab pertama di
    //      berkas ini dan sama seperti kartu "di bawah min. stok" di Ringkasan. Fungsi
    //      database recompute_work_order_material_readiness memakai stok PER PLANT karena
    //      ia menilai satu Work Order tertentu; di sini yang dinilai adalah BAHANNYA, dan
    //      bahan yang ada di gudang sebelah tetap bahan yang dimiliki perusahaan.
    //   2. Bila kueri kebutuhan gagal, sebab ini dinyatakan TIDAK DIKETAHUI (null) —
    //      BUKAN nol. Menganggapnya nol berarti diam-diam mengklaim "produksi tidak
    //      membutuhkannya", dan peringatannya akan terdengar lebih tenang daripada keadaan
    //      sebenarnya.
    let kebutuhanPerItem: Map<number, { totalDibutuhkan: number; jumlahWorkOrder: number; perintah: string[] }> | null = null;
    const { data: woAktif, error: woError } = await adminClient
      .from('work_orders')
      .select('work_order_id, bom_id, planned_qty, status, item_id')
      .eq('company_id', companyId)
      .in('status', ['planned', 'in_progress', 'paused']);

    if (!woError && woAktif) {
      // NAMA yang dipakai menyebut sebuah perintah produksi di kalimat peringatan.
      // Work Order sendiri TIDAK punya nomor di sistem ini (lihat CLAUDE.md), jadi yang
      // dipakai: nomor batch produksinya bila sudah ada, kalau belum kode produknya.
      // Menyebut angka work_order_id mentah ke pengguna bukan pilihan — itu identifier
      // internal, bukan sesuatu yang pernah diucapkan orang di lantai produksi.
      const woIds = woAktif.map((w) => w.work_order_id);
      const namaWo = new Map<number, string>();
      if (woIds.length > 0) {
        const { data: batch } = await adminClient
          .from('production_batches')
          .select('work_order_id, batch_number')
          .in('work_order_id', woIds);
        for (const b of batch ?? []) {
          if (b.batch_number && !namaWo.has(b.work_order_id)) namaWo.set(b.work_order_id, b.batch_number);
        }
        const produkIds = [...new Set(woAktif.map((w) => w.item_id).filter((x): x is number => x !== null))];
        const { data: produk } = produkIds.length
          ? await adminClient.from('items').select('item_id, item_code, name').in('item_id', produkIds)
          : { data: [] as { item_id: number; item_code: string | null; name: string }[] };
        const kodeProduk = new Map((produk ?? []).map((i) => [i.item_id, i.item_code ?? i.name]));
        for (const wo of woAktif) {
          if (namaWo.has(wo.work_order_id)) continue;
          namaWo.set(wo.work_order_id, `${kodeProduk.get(wo.item_id) ?? 'produk'} ${Number(wo.planned_qty ?? 0)}`);
        }
      }

      const bomIds = [...new Set(woAktif.map((w) => w.bom_id).filter((x): x is number => x !== null))];
      if (bomIds.length === 0) {
        kebutuhanPerItem = new Map();
      } else {
        const { data: baris, error: barisError } = await adminClient
          .from('bom_lines')
          .select('bom_id, component_item_id, qty_per_unit_output')
          .in('bom_id', bomIds);
        if (!barisError && baris) {
          const perBom = new Map<number, { component_item_id: number; qty_per_unit_output: number }[]>();
          for (const b of baris) {
            const daftar = perBom.get(b.bom_id) ?? [];
            daftar.push({ component_item_id: b.component_item_id, qty_per_unit_output: Number(b.qty_per_unit_output ?? 0) });
            perBom.set(b.bom_id, daftar);
          }
          kebutuhanPerItem = new Map();
          // Work Order dihitung lewat HIMPUNAN, bukan penambahan. Satu BOM boleh memuat
          // komponen yang sama lebih dari satu baris (mis. dipakai di dua tahap), dan
          // menambah satu per baris akan membuat kalimatnya berkata "3 perintah produksi"
          // padahal perintahnya cuma satu. Angka yang muncul di layar harus berarti persis
          // seperti bunyinya.
          const woPerItem = new Map<number, Set<number>>();
          for (const wo of woAktif) {
            if (wo.bom_id === null) continue;
            for (const komponen of perBom.get(wo.bom_id) ?? []) {
              const sebelumnya = kebutuhanPerItem.get(komponen.component_item_id) ?? {
                totalDibutuhkan: 0,
                jumlahWorkOrder: 0,
                perintah: [] as string[]
              };
              const himpunan = woPerItem.get(komponen.component_item_id) ?? new Set<number>();
              const baru = !himpunan.has(wo.work_order_id);
              himpunan.add(wo.work_order_id);
              woPerItem.set(komponen.component_item_id, himpunan);
              kebutuhanPerItem.set(komponen.component_item_id, {
                totalDibutuhkan: sebelumnya.totalDibutuhkan + komponen.qty_per_unit_output * Number(wo.planned_qty ?? 0),
                jumlahWorkOrder: himpunan.size,
                perintah: baru ? [...sebelumnya.perintah, namaWo.get(wo.work_order_id) ?? 'perintah produksi'] : sebelumnya.perintah
              });
            }
          }
        }
      }
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

    // Hanya item yang PUNYA ambang. Item tanpa ambang tidak bisa dinilai menipis atau
    // tidak — dan menebaknya berarti membangkitkan peringatan tanpa dasar.
    const { data: items, error: itemsError } = await adminClient
      .from('items')
      .select('item_id, item_code, name, base_uom, min_stock_level, min_stock_percent')
      .eq('company_id', companyId)
      .eq('is_active', true);
    if (itemsError) return { status: 500, body: { error: itemsError.message } };

    // Persen bawaan perusahaan berlaku untuk SEMUA item, jadi begitu ia terisi tidak ada
    // lagi item yang tersaring keluar karena ambang. Penyaringan tetap dipertahankan untuk
    // keadaan sebaliknya: perusahaan yang belum mengisi setelan ke-18 sama sekali.
    //
    // DIPERLUAS GDG-10: item yang DIBUTUHKAN Work Order berjalan ikut diperiksa MESKIPUN
    // tidak punya ambang apa pun. Kedua sebab berdiri sendiri — tidak adanya ambang tidak
    // boleh membungkam sebab yang lain, dan bahan yang kurang untuk produksi yang sudah
    // dijadwalkan adalah masalah entah ambangnya diisi atau tidak.
    const adaPersenPerusahaan = persenBawaanPerusahaan !== null && persenBawaanPerusahaan > 0;
    const kandidat = (items ?? []).filter(
      (i) =>
        adaPersenPerusahaan ||
        (i.min_stock_percent !== null && Number(i.min_stock_percent) > 0) ||
        Number(i.min_stock_level ?? 0) > 0 ||
        (kebutuhanPerItem?.has(i.item_id) ?? false) ||
        // Item yang MASIH punya peringatan terbuka WAJIB ikut dinilai, meski sebabnya sudah
        // tidak ada lagi. Tanpa ini peringatannya tidak akan pernah bisa ditutup: begitu
        // sebabnya hilang, itemnya keluar dari daftar yang diperiksa, dan peringatan lama
        // menggantung selamanya di layar orang gudang. Ditemukan lewat test yang
        // MEMBATALKAN Work Order lalu memeriksa apakah peringatannya benar-benar tutup.
        alertPerItem.has(i.item_id)
    );
    if (kandidat.length === 0) {
      return {
        status: 200,
        body: {
          diperiksa: 0,
          dibuat: 0,
          ditutup: 0,
          catatan:
            'Belum ada item yang punya ambang stok minimum, perusahaan belum mengisi "Sisa stok yang memicu peringatan" di Setelan Perhitungan, dan tidak ada perintah produksi berjalan yang membutuhkan bahan apa pun.'
        }
      };
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

    const perluDibuat: Record<string, unknown>[] = [];
    const perluDitutup: number[] = [];
    const perluDiperbarui: { id: number; pesan: string; keparahan: 'warning' | 'critical' }[] = [];
    const rincian: { item_code: string | null; status: PenilaianStok['status']; sebab: string[] }[] = [];

    for (const item of kandidat) {
      const stokSekarang = stokPerItem.get(item.item_id) ?? 0;
      const penilaian = nilaiStok({
        stokSekarang,
        totalPernahMasuk: masukPerItem.get(item.item_id) ?? 0,
        minStockPercent: item.min_stock_percent === null ? null : Number(item.min_stock_percent),
        minStockLevel: item.min_stock_level === null ? null : Number(item.min_stock_level),
        persenBawaanPerusahaan
      });

      // SATU peringatan, SELURUH sebabnya di dalamnya (GDG-10). Kalimatnya disusun di
      // alasanPeringatanBahan.ts supaya aturannya bisa diuji tanpa database sama sekali.
      const kebutuhanItem = kebutuhanPerItem?.get(item.item_id) ?? null;
      const peringatan = susunPeringatanBahan({
        namaBahan: item.item_code ?? item.name,
        satuan: item.base_uom ?? 'satuan',
        stok: penilaian,
        kebutuhan:
          kebutuhanPerItem === null
            ? null // kebutuhan produksi TIDAK DIKETAHUI, bukan nol
            : {
                totalDibutuhkan: kebutuhanItem?.totalDibutuhkan ?? 0,
                tersedia: stokSekarang,
                jumlahWorkOrder: kebutuhanItem?.jumlahWorkOrder ?? 0,
                perintah: kebutuhanItem?.perintah ?? []
              }
      });
      rincian.push({ item_code: item.item_code, status: penilaian.status, sebab: peringatan.sebabMenyala });

      const sudahAda = alertPerItem.get(item.item_id);
      if (peringatan.perlu) {
        // Peringatan yang masih terbuka DIPERBARUI, tidak digandakan -- sebabnya bisa
        // bertambah (stok yang tadinya cuma menipis kini juga kurang untuk produksi), dan
        // peringatan lama yang menyebut sebab yang sudah tidak lengkap lebih menyesatkan
        // daripada tidak ada.
        if (sudahAda) {
          if (sudahAda.message !== peringatan.pesan) perluDiperbarui.push({ id: sudahAda.system_alert_id, pesan: peringatan.pesan, keparahan: peringatan.keparahan });
          continue;
        }
        perluDibuat.push({
          company_id: companyId,
          alert_type: 'low_stock',
          related_item_id: item.item_id,
          message: peringatan.pesan,
          severity: peringatan.keparahan,
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
    for (const u of perluDiperbarui) {
      const { error } = await adminClient
        .from('system_alerts')
        .update({ message: u.pesan, severity: u.keparahan })
        .eq('system_alert_id', u.id);
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
      body: { diperiksa: kandidat.length, dibuat: perluDibuat.length, diperbarui: perluDiperbarui.length, ditutup: perluDitutup.length, rincian }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
    return { status: message === 'UNAUTHORIZED' ? 401 : 500, body: { error: message } };
  }
}

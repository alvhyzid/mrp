import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// MST-16 — "Hapus" pada panel Detail Item.
//
// POLA SAMA PERSIS dengan Supplier (deleteOrArchiveSupplier.ts) dan Routing
// (deleteOrArchiveRouting.ts), dan itu disengaja: menghapus item yang sudah dipakai
// akan memutus jejak lot, BOM, dan dokumen pembelian — padahal ketertelusuran lot
// adalah syarat kepatuhan BPOM/halal yang tidak boleh disederhanakan.
//
// KEPUTUSANNYA DIHITUNG SERVER, BUKAN DIPILIH PENGGUNA. Pengguna tidak bisa tahu
// dari layar apakah sebuah bahan pernah masuk BOM tiga bulan lalu; server tahu.
// Item yang sudah dipakai TIDAK dihapus — dinonaktifkan (is_active = false), yang
// di layar sudah tampil sebagai "Nonaktif" dan menghilangkannya dari pilihan baru
// tanpa menghapus riwayat apa pun.
//
// Daftar tabel di bawah diambil dari SELURUH foreign key yang menunjuk `items`
// (19 tabel), bukan dari ingatan. Yang TIDAK ikut dihitung sebagai "terpakai":
//   - system_alerts.related_item_id — sekadar catatan peringatan, bukan transaksi;
//     menahan penghapusan karena sebuah notifikasi lama akan menyesatkan.
// Sisanya dihitung semua, termasuk tabel snapshot dan standar produksi, karena
// semuanya menyimpan jejak yang jadi tidak terbaca bila itemnya hilang.
//
// `berCompanyId` DIUKUR dari information_schema, BUKAN diasumsikan. Versi pertama
// menyaring `company_id` di SEMUA tabel dan langsung gagal di tabel pertama
// ("Gagal memeriksa pemakaian di bom_lines"), karena 7 dari 18 tabel di sini adalah
// tabel BARIS yang cakupan perusahaannya menempel pada induknya, bukan pada dirinya
// sendiri. Ketahuan lewat verifikasi manual di browser -- bukan lewat typecheck,
// yang memang tidak bisa tahu kolom mana yang ada di database.
//
// Untuk tabel tanpa `company_id`, menyaring dengan `item_id` saja SUDAH aman: item-nya
// sendiri sudah diverifikasi milik perusahaan pemanggil beberapa baris di atas, dan
// satu item_id hanya pernah dimiliki satu perusahaan.
const TABEL_PEMAKAI: { tabel: string; kolom: string; sebutan: string; berCompanyId: boolean }[] = [
  { tabel: 'bom_lines', kolom: 'component_item_id', sebutan: 'baris BOM', berCompanyId: false },
  { tabel: 'boms', kolom: 'parent_item_id', sebutan: 'BOM', berCompanyId: true },
  { tabel: 'customer_purchase_order_lines', kolom: 'item_id', sebutan: 'baris PO Client', berCompanyId: false },
  { tabel: 'goods_receipt_lines', kolom: 'item_id', sebutan: 'baris penerimaan barang', berCompanyId: false },
  { tabel: 'goods_receipt_overage_log', kolom: 'item_id', sebutan: 'catatan kelebihan terima', berCompanyId: true },
  { tabel: 'lots', kolom: 'item_id', sebutan: 'lot/batch stok', berCompanyId: true },
  { tabel: 'production_batch_bom_line_snapshots', kolom: 'component_item_id', sebutan: 'snapshot BOM batch', berCompanyId: true },
  { tabel: 'production_standard_exclusions', kolom: 'item_id', sebutan: 'pengecualian standar produksi', berCompanyId: true },
  { tabel: 'production_standard_proposals', kolom: 'item_id', sebutan: 'usulan standar produksi', berCompanyId: true },
  { tabel: 'production_standard_samples', kolom: 'item_id', sebutan: 'sampel standar produksi', berCompanyId: true },
  { tabel: 'production_standards', kolom: 'item_id', sebutan: 'standar produksi', berCompanyId: true },
  { tabel: 'purchase_order_lines', kolom: 'item_id', sebutan: 'baris PO Supplier', berCompanyId: false },
  { tabel: 'routings', kolom: 'item_id', sebutan: 'routing', berCompanyId: true },
  { tabel: 'sales_order_lines', kolom: 'item_id', sebutan: 'baris Sales Order', berCompanyId: false },
  { tabel: 'shipment_lines', kolom: 'item_id', sebutan: 'baris pengiriman', berCompanyId: false },
  { tabel: 'supplier_item_prices', kolom: 'item_id', sebutan: 'harga pemasok', berCompanyId: true },
  { tabel: 'work_order_outputs', kolom: 'item_id', sebutan: 'hasil Work Order', berCompanyId: false },
  { tabel: 'work_orders', kolom: 'item_id', sebutan: 'Work Order', berCompanyId: true }
];

export async function deleteOrDeactivateItem(request: NextRequest, itemIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    // Izin SAMA PERSIS dengan createItem/updateItem (isCompanyLeadership) -- menghapus
    // item tidak boleh lebih longgar daripada membuatnya.
    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Hanya Admin Perusahaan atau General Manager yang dapat menghapus item.' } };
    }
    if (!appUser.company_id) return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };

    const itemId = Number(itemIdParam);
    if (!itemId) return { status: 400, body: { error: 'ID Item tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: item, error: itemError } = await adminClient
      .from('items')
      .select('item_id, company_id, name, is_active')
      .eq('item_id', itemId)
      .maybeSingle();
    if (itemError) return { status: 500, body: { error: itemError.message } };
    if (!item || item.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Item tidak ditemukan.' } };
    }

    // BERSAMAAN, bukan berurutan. Versi pertama menunggu 18 pemeriksaan satu per satu
    // dan butuh LEBIH DARI 5 DETIK sebelum menjawab -- cukup lama untuk membuat pengguna
    // mengira tombolnya tidak berfungsi lalu menekannya lagi. Ke-18 pemeriksaan ini saling
    // bebas, jadi tidak ada alasan menjalankannya bergiliran.
    const hasil = await Promise.all(
      TABEL_PEMAKAI.map(async ({ tabel, kolom, sebutan, berCompanyId }) => {
        let q = adminClient.from(tabel).select(kolom, { count: 'exact', head: true }).eq(kolom, itemId);
        if (berCompanyId) q = q.eq('company_id', appUser.company_id);
        const { count, error } = await q;
        return { tabel, sebutan, count: count ?? 0, error };
      })
    );

    const gagal = hasil.find((h) => h.error);
    if (gagal) {
      return { status: 500, body: { error: `Gagal memeriksa pemakaian di ${gagal.tabel}: ${gagal.error!.message}` } };
    }

    // Urutan pemakaian mengikuti urutan TABEL_PEMAKAI supaya pesannya konsisten dari
    // panggilan ke panggilan, tidak berubah-ubah mengikuti mana yang selesai duluan.
    const pemakaian = hasil.filter((h) => h.count > 0).map((h) => `${h.count} ${h.sebutan}`);

    if (pemakaian.length > 0) {
      if (!item.is_active) {
        return {
          status: 400,
          body: {
            error: `Item ini sudah dipakai (${pemakaian.join(', ')}) dan sudah berstatus Nonaktif. Riwayatnya harus tetap utuh, jadi tidak bisa dihapus.`
          }
        };
      }
      const { error: nonaktifError } = await adminClient
        .from('items')
        .update({ is_active: false })
        .eq('item_id', itemId);
      if (nonaktifError) return { status: 500, body: { error: nonaktifError.message } };
      return {
        status: 200,
        body: {
          success: true,
          action: 'dinonaktifkan',
          message: `"${item.name}" sudah dipakai (${pemakaian.join(', ')}), jadi TIDAK dihapus melainkan dinonaktifkan. Riwayat lot, BOM, dan dokumen pembeliannya tetap utuh, dan item ini tidak lagi muncul sebagai pilihan baru.`
        }
      };
    }

    const { error: deleteError } = await adminClient.from('items').delete().eq('item_id', itemId);
    if (deleteError) return { status: 500, body: { error: deleteError.message } };

    return {
      status: 200,
      body: { success: true, action: 'dihapus', message: `"${item.name}" dihapus permanen karena belum dipakai di mana pun.` }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
    return { status: message === 'UNAUTHORIZED' ? 401 : 500, body: { error: message } };
  }
}

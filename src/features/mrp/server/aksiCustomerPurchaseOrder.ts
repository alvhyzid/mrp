import type { NextRequest } from 'next/server';
import { getAdminClient, getCurrentUser, getUserScopedClient, parseBearerToken } from '@/lib/supabaseServer';

// WS-S05 — aksi terkendali PO klien: Tahan / Lepas / Batalkan (BD-06).
//
// KENAPA SELURUHNYA LEWAT FUNGSI BASIS DATA, BUKAN `update` DARI SINI.
// Bukan selera arsitektur, melainkan kebutuhan yang tidak bisa dipenuhi cara lain:
// jejak keputusan (siapa, peran apa, departemen apa, kategori alasan apa) ditulis oleh
// trigger status, dan trigger tidak menerima parameter. Satu-satunya cara menitipkan
// konteks itu adalah lewat setelan sesi ber-lingkup transaksi -- dan PostgREST tidak
// mengizinkan dua pernyataan dalam satu transaksi dari klien. Jadi konteks dan
// perpindahan statusnya HARUS terjadi di dalam satu fungsi basis data.
//
// Konsekuensinya: memakai `update` dari sini akan tetap memindahkan statusnya dan tetap
// mencatat barisnya -- hanya TANPA pelaku dan TANPA alasan. Yaitu kegagalan yang tidak
// berbunyi: jejaknya terlihat ada, isinya kosong.
//
// KLIEN BER-SESI PENGGUNA, bukan service role: fungsi-fungsi itu menegakkan wewenangnya
// sendiri lewat klaim JWT, dan service role tidak membawa klaim apa pun.

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// DEC-S13 -- `lepas_darurat` adalah aksi TERSENDIRI, bukan parameter dari `lepas`.
// Dipisahkan supaya jejaknya, kategori alasannya, dan wewenangnya tidak pernah tertukar
// dengan pelepasan biasa: yang satu keputusan rutin, yang satu melampaui wewenang orang lain.
export type AksiPoKlien = 'tahan' | 'lepas' | 'lepas_darurat' | 'batalkan';

const FUNGSI: Record<AksiPoKlien, string> = {
  tahan: 'tahan_po_klien',
  lepas: 'lepas_po_klien',
  lepas_darurat: 'lepas_darurat_po_klien',
  batalkan: 'batalkan_po_klien'
};

// Pesan galat dari basis data SUDAH Bahasa Indonesia dan sudah bisa dibaca orang pabrik.
// Yang diterjemahkan di sini hanya KODE STATUS-nya. Menulis ulang kalimatnya akan
// melahirkan dua sumber pesan yang harus tetap cocok.
function statusUntukPesan(pesan: string): number {
  if (pesan.includes('tidak ditemukan di perusahaan Anda')) return 404;
  if (pesan.includes('Hanya Manager atau General Manager')) return 403;
  if (pesan.includes('tidak mewakili departemen')) return 403;
  if (pesan.includes('Hanya departemen itu yang boleh melepasnya')) return 403;
  if (pesan.includes('tidak berwenang melakukan pelepasan darurat')) return 403;
  if (pesan.includes('Pakai pelepasan biasa')) return 409;
  if (pesan.includes('hanya boleh dipakai departemen')) return 403;
  if (pesan.includes('Kategori alasan tidak dikenali')) return 400;
  if (pesan.includes('mewajibkan catatan tambahan')) return 400;
  if (pesan.includes('hanya bisa ditahan')) return 400;
  if (pesan.includes('tidak sedang ditahan')) return 400;
  if (pesan.includes('tidak bisa dibatalkan')) return 400;
  if (pesan.includes('Transisi status')) return 400;
  return 500;
}

export async function aksiCustomerPurchaseOrder(request: NextRequest, aksi: AksiPoKlien): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    const accessToken = await parseBearerToken(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const customerPurchaseOrderId = Number(body.customer_purchase_order_id);
    const reasonCategory = typeof body.reason_category === 'string' ? body.reason_category.trim() : '';
    const reasonNote = typeof body.reason_note === 'string' ? body.reason_note.trim() : '';

    if (!customerPurchaseOrderId) {
      return { status: 400, body: { error: 'PO client wajib dipilih.' } };
    }
    if (!reasonCategory) {
      return { status: 400, body: { error: 'Kategori alasan wajib dipilih.', field: 'reason_category' } };
    }

    const userClient = getUserScopedClient(accessToken);
    const { error } = await userClient.rpc(FUNGSI[aksi], {
      p_customer_purchase_order_id: customerPurchaseOrderId,
      p_reason_category: reasonCategory,
      p_reason_note: reasonNote || null
    });

    if (error) {
      // Kewajiban catatan tambahan adalah galat TINGKAT FIELD -- pengguna bisa langsung
      // memperbaikinya di kotak yang salah, bukan mencarinya sendiri di dasar modal.
      const field = error.message.includes('mewajibkan catatan tambahan') ? 'reason_note' : undefined;
      return { status: statusUntukPesan(error.message), body: field ? { error: error.message, field } : { error: error.message } };
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

// Katalog kategori alasan dibaca dari basis data, bukan ditulis di kode layar.
// Alasannya bukan kerapian: daftar yang hidup di kode UI tidak bisa dipakai menyaring
// riwayat di sisi server, dan akan bercabang begitu ada layar kedua yang menampilkannya.
export async function listDecisionReasonCategories(request: NextRequest, entity: string, action: string): Promise<ApiResult> {
  try {
    await getCurrentUser(request);
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('decision_reason_categories')
      .select('code, label, department, requires_note')
      .eq('entity', entity)
      .eq('action', action)
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (error) return { status: 500, body: { error: error.message } };
    return { status: 200, body: { categories: data ?? [] } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

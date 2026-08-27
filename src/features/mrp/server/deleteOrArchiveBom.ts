import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageBom } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// ============================================================================
// DS-17 — SIKLUS HIDUP BOM: HAPUS / ARSIP / PULIHKAN
// ============================================================================
// SATU AKSI, BUKAN DUA. Berbeda dari Routing (yang menyediakan "Hapus" dan "Arsipkan"
// sebagai dua endpoint terpisah), BOM memakai pola `deleteOrDeactivateItem`: pengguna
// menekan satu tombol, dan SERVER yang memutuskan hasilnya.
//
// Alasannya sudah tertulis sebagai aturan proyek: pengguna TIDAK BISA TAHU dari layar
// apakah sebuah BOM pernah dipakai Work Order tiga bulan lalu atau pernah ikut membeku di
// snapshot batch. Menawarkan pilihan "hapus atau arsipkan" berarti meminta keputusan dari
// orang yang tidak punya informasinya.
//
// ============================================================================
// KENAPA BOM TIDAK MENYALIN ATURAN ROUTING BULAT-BULAT
// ============================================================================
// Routing menolak PENGARSIPAN bila ada batch yang sedang berjalan. BOM TIDAK memakai
// aturan itu, dan itu keputusan sadar pemilik produk (27 Agu 2026):
//
//   Batch yang berjalan memakai `snapshotted_bom_id` — SALINAN BEKU miliknya sendiri,
//   bukan BOM hidup. Mengarsipkan BOM induknya tidak mengubah satu angka pun di batch
//   itu. Yang dicegah pengarsipan adalah PEMAKAIAN BARU, dan batch yang sudah jalan
//   bukan pemakaian baru.
//
// Konsekuensinya: keberadaan sejarah TIDAK PERNAH memblokir pengarsipan. Ia hanya
// memblokir PENGHAPUSAN — dan itu memang tujuannya, karena `snapshotted_bom_id` adalah
// jejak ketertelusuran BPOM/halal.
//
// ============================================================================
// APA YANG DIPERIKSA, DAN KENAPA HANYA DUA
// ============================================================================
// Diverifikasi dari pg_constraint 27 Agu 2026: hanya TIGA tabel merujuk `boms` —
// `bom_lines` (anaknya sendiri), `work_orders.bom_id`, dan
// `production_batches.snapshotted_bom_id`. Seluruhnya NO ACTION; nol CASCADE.
//
// `bom_lines` bukan pemakaian, melainkan isi BOM itu sendiri, jadi ia ikut terhapus.
// Dua sisanya adalah pemakaian, dan keduanya memaksa arsip.
// ============================================================================

type Pemakaian = { workOrders: number; batches: number };

async function hitungPemakaian(
  adminClient: ReturnType<typeof getAdminClient>,
  companyId: number,
  bomId: number
): Promise<{ pemakaian: Pemakaian; error: string | null }> {
  // BERSAMAAN, bukan berurutan — mengikuti pelajaran deleteOrDeactivateItem: pemeriksaan
  // yang saling bebas tidak punya alasan menunggu giliran.
  const [wo, batch] = await Promise.all([
    adminClient
      .from('work_orders')
      .select('work_order_id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('bom_id', bomId),
    adminClient
      .from('production_batches')
      .select('production_batch_id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('snapshotted_bom_id', bomId)
  ]);

  if (wo.error) return { pemakaian: { workOrders: 0, batches: 0 }, error: `Gagal memeriksa pemakaian di work_orders: ${wo.error.message}` };
  if (batch.error) return { pemakaian: { workOrders: 0, batches: 0 }, error: `Gagal memeriksa pemakaian di production_batches: ${batch.error.message}` };

  return { pemakaian: { workOrders: wo.count ?? 0, batches: batch.count ?? 0 }, error: null };
}

/// Kalimat alasan yang menyebut ANGKA SUNGGUHAN, bukan "sudah dipakai" yang kabur.
/// Bila dua-duanya menyala, KEDUANYA disebut — satu sebab yang disembunyikan membuat
/// pembacanya mengira ia sudah tahu seluruh alasannya.
function kalimatPemakaian(p: Pemakaian): string {
  const bagian: string[] = [];
  if (p.workOrders > 0) bagian.push(`${p.workOrders} Work Order`);
  if (p.batches > 0) bagian.push(`${p.batches} batch produksi`);
  return bagian.join(' dan ');
}

async function muatBom(adminClient: ReturnType<typeof getAdminClient>, bomId: number) {
  return adminClient
    .from('boms')
    .select('bom_id, company_id, parent_item_id, version, status, archived_at')
    .eq('bom_id', bomId)
    .maybeSingle();
}

async function namaItem(adminClient: ReturnType<typeof getAdminClient>, itemId: number): Promise<string> {
  const { data } = await adminClient.from('items').select('item_code, name').eq('item_id', itemId).maybeSingle();
  if (!data) return 'BOM';
  return `${data.item_code ?? ''} ${data.name ?? ''}`.trim() || 'BOM';
}

/// SATU PINTU. Server memutuskan hapus atau arsip; pemanggil tidak memilih.
export async function deleteOrArchiveBom(request: NextRequest, bomIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    // Otorisasi DI SERVER, bukan sekadar menyembunyikan tombol: dipanggil langsung lewat
    // API pun harus ditolak. Diuji dua arah di tests/bom_lifecycle.test.ts.
    if (!canManageBom(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola BOM.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const bomId = Number(bomIdParam);
    if (!bomId) return { status: 400, body: { error: 'ID BOM tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: bom, error: bomError } = await muatBom(adminClient, bomId);
    if (bomError) return { status: 500, body: { error: bomError.message } };
    // BOM milik perusahaan lain dijawab 404, BUKAN 403: menjawab "tidak boleh" akan
    // memberi tahu bahwa barisnya ADA di tenant lain. Isolasi tenant, bukan kesopanan.
    if (!bom || bom.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'BOM tidak ditemukan.' } };
    }
    if (bom.archived_at) {
      return { status: 400, body: { error: 'BOM ini sudah diarsipkan.' } };
    }

    const label = await namaItem(adminClient, bom.parent_item_id);
    const { pemakaian, error: hitungError } = await hitungPemakaian(adminClient, appUser.company_id, bomId);
    if (hitungError) return { status: 500, body: { error: hitungError } };

    // ---- CABANG ARSIP -----------------------------------------------------------------
    if (pemakaian.workOrders > 0 || pemakaian.batches > 0) {
      const { error: arsipError } = await adminClient
        .from('boms')
        .update({ status: 'archived', archived_at: new Date().toISOString(), archived_by: appUser.user_id })
        .eq('bom_id', bomId);
      if (arsipError) return { status: 500, body: { error: arsipError.message } };

      return {
        status: 200,
        body: {
          success: true,
          action: 'diarsipkan',
          usage: pemakaian,
          message:
            `"${label}" v${bom.version} sudah dipakai (${kalimatPemakaian(pemakaian)}), jadi TIDAK dihapus melainkan ` +
            'diarsipkan. Angka batch yang sudah jalan tidak berubah — batch memakai salinan bekunya sendiri. ' +
            'BOM ini tidak lagi bisa dipilih untuk Work Order baru.'
        }
      };
    }

    // ---- CABANG HAPUS -----------------------------------------------------------------
    // Anak lebih dulu. Nol FK memakai CASCADE di basis data ini (diverifikasi), jadi
    // menghapus induknya lebih dulu akan GAGAL, bukan menghapus anaknya diam-diam.
    const { error: hapusBarisError } = await adminClient.from('bom_lines').delete().eq('bom_id', bomId);
    if (hapusBarisError) return { status: 500, body: { error: hapusBarisError.message } };

    const { error: hapusError } = await adminClient.from('boms').delete().eq('bom_id', bomId);
    if (hapusError) return { status: 500, body: { error: hapusError.message } };

    return {
      status: 200,
      body: {
        success: true,
        action: 'dihapus',
        usage: pemakaian,
        message: `"${label}" v${bom.version} dihapus permanen karena belum dipakai Work Order maupun batch produksi.`
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: message === 'UNAUTHORIZED' ? 401 : 500, body: { error: message } };
  }
}

/// Memulihkan BOM yang diarsipkan kembali menjadi aktif.
///
/// TIDAK menyentuh `production_batches.snapshotted_bom_id` maupun Work Order mana pun —
/// pemulihan hanya membuka kembali BOM untuk pemakaian BARU. Sejarah tidak ikut berubah,
/// dan itu memang syaratnya.
export async function restoreBom(request: NextRequest, bomIdParam: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canManageBom(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengelola BOM.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const bomId = Number(bomIdParam);
    if (!bomId) return { status: 400, body: { error: 'ID BOM tidak valid.' } };

    const adminClient = getAdminClient();
    const { data: bom, error: bomError } = await muatBom(adminClient, bomId);
    if (bomError) return { status: 500, body: { error: bomError.message } };
    if (!bom || bom.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'BOM tidak ditemukan.' } };
    }
    if (!bom.archived_at) {
      return { status: 400, body: { error: 'BOM ini tidak sedang diarsipkan.' } };
    }

    const { error: pulihError } = await adminClient
      .from('boms')
      .update({ status: 'active', archived_at: null, archived_by: null })
      .eq('bom_id', bomId);
    if (pulihError) return { status: 500, body: { error: pulihError.message } };

    const label = await namaItem(adminClient, bom.parent_item_id);
    return {
      status: 200,
      body: { success: true, action: 'dipulihkan', message: `"${label}" v${bom.version} aktif kembali dan bisa dipakai Work Order baru.` }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: message === 'UNAUTHORIZED' ? 401 : 500, body: { error: message } };
  }
}

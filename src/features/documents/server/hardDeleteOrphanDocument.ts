import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canHardDeleteOrphanDocument } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Aturan §3.1 (tidak bisa ditawar): "Hapus = arsip." Dokumen bertaut entitas
// transaksi TIDAK PERNAH hard-delete -- rantai telusur BPOM/BPJPH memutus di situ.
// Hard delete HANYA untuk berkas yatim (document_links KOSONG), oleh company_admin
// SAJA (jawaban eksplisit pemilik produk 26 Agu 2026), dengan alasan tercatat.
export async function hardDeleteOrphanDocument(request: NextRequest, documentId: number, reason: string): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canHardDeleteOrphanDocument(appUser.role)) {
      return { status: 403, body: { error: 'Hanya company_admin yang dapat menghapus permanen berkas yatim.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }
    if (!reason || !reason.trim()) {
      return { status: 400, body: { error: 'Alasan wajib diisi untuk hapus permanen.' } };
    }

    const adminClient = getAdminClient();
    const { data: doc, error: docError } = await adminClient.from('documents').select('document_id, company_id, storage_path, title').eq('document_id', documentId).maybeSingle();
    if (docError) return { status: 500, body: { error: docError.message } };
    if (!doc || doc.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Dokumen tidak ditemukan di perusahaan Anda.' } };
    }

    const { count: linkCount, error: linkError } = await adminClient.from('document_links').select('document_link_id', { count: 'exact', head: true }).eq('document_id', documentId);
    if (linkError) return { status: 500, body: { error: linkError.message } };
    if ((linkCount ?? 0) > 0) {
      return { status: 400, body: { error: 'Dokumen ini bertaut ke entitas lain -- tidak boleh dihapus permanen. Arsipkan (status DIARSIP) sebagai gantinya.' } };
    }

    await adminClient.from('document_access_log').insert([
      { company_id: appUser.company_id, document_id: documentId, document_title_snapshot: doc.title, accessed_by: appUser.user_id, action: 'delete', reason }
    ]);

    const { error: storageError } = await adminClient.storage.from('documents').remove([doc.storage_path]);
    if (storageError) return { status: 500, body: { error: storageError.message } };

    const { error: deleteError } = await adminClient.from('documents').delete().eq('document_id', documentId);
    if (deleteError) return { status: 500, body: { error: deleteError.message } };

    return { status: 200, body: { success: true, reason } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewDocument } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// "Lihat tanpa mengunduh" (§3.2) -- signed URL berumur PENDEK, bukan URL permanen.
// Dicatat ke document_access_log HANYA untuk dokumen TERBATAS (audit trail dokumen
// sensitif per §4 MD-1 "log akses dokumen TERBATAS"; UMUM/DEPARTEMEN tidak perlu
// dicatat setiap buka, akan membanjiri log tanpa nilai audit).
const SIGNED_URL_EXPIRY_SECONDS = 120;

export async function getDocumentSignedUrl(request: NextRequest, documentId: number, action: 'view' | 'download'): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { data: doc, error: docError } = await adminClient.from('documents').select('*').eq('document_id', documentId).maybeSingle();
    if (docError) return { status: 500, body: { error: docError.message } };
    if (!doc || doc.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Dokumen tidak ditemukan di perusahaan Anda.' } };
    }
    if (!canViewDocument(appUser.role, doc.sensitivity, doc.department)) {
      return { status: 403, body: { error: 'Anda tidak berwenang membuka dokumen ini.' } };
    }

    const { data: signed, error: signError } = await adminClient.storage.from('documents').createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRY_SECONDS, {
      download: action === 'download'
    });
    if (signError) return { status: 500, body: { error: signError.message } };

    if (doc.sensitivity === 'TERBATAS') {
      await adminClient.from('document_access_log').insert([{ company_id: appUser.company_id, document_id: doc.document_id, accessed_by: appUser.user_id, action }]);
    }

    return { status: 200, body: { signed_url: signed.signedUrl, expires_in: SIGNED_URL_EXPIRY_SECONDS, mime_type: doc.mime_type, title: doc.title } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

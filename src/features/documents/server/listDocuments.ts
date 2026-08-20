import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewDocument } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Halaman Master Dokumen (MD-1, §4) -- daftar + filter (jenis, departemen, entitas,
// tanggal, status). Pakai admin client (pola sama listKamusTerms.ts dkk), jadi
// visibilitas TERBATAS/DEPARTEMEN WAJIB disaring di sini lewat canViewDocument --
// RLS di database cuma jaring pengaman untuk akses PostgREST/storage langsung,
// bukan satu-satunya gerbang untuk endpoint aplikasi ini.
export async function listDocuments(
  request: NextRequest,
  filters: { docType?: string; department?: string; status?: string; entityType?: string; entityId?: number; issuedFrom?: string; issuedTo?: string }
): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    let documentIdsForEntity: number[] | null = null;
    if (filters.entityType && filters.entityId) {
      const { data: links, error: linksError } = await adminClient
        .from('document_links')
        .select('document_id')
        .eq('company_id', appUser.company_id)
        .eq('entity_type', filters.entityType)
        .eq('entity_id', filters.entityId);
      if (linksError) return { status: 500, body: { error: linksError.message } };
      documentIdsForEntity = (links ?? []).map((l) => l.document_id);
      if (documentIdsForEntity.length === 0) {
        return { status: 200, body: { documents: [] } };
      }
    }

    let query = adminClient.from('documents').select('*').eq('company_id', appUser.company_id);
    if (filters.docType) query = query.eq('doc_type', filters.docType);
    if (filters.department) query = query.eq('department', filters.department);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.issuedFrom) query = query.gte('issued_date', filters.issuedFrom);
    if (filters.issuedTo) query = query.lte('issued_date', filters.issuedTo);
    if (documentIdsForEntity) query = query.in('document_id', documentIdsForEntity);
    query = query.order('uploaded_at', { ascending: false });

    const { data: documents, error } = await query;
    if (error) return { status: 500, body: { error: error.message } };

    const visible = (documents ?? []).filter((d) => canViewDocument(appUser.role, d.sensitivity, d.department));

    return { status: 200, body: { documents: visible } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

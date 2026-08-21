import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { detectDocumentExtFromBytes, EXT_TO_DOCUMENT_MIME, isContentLengthTooLarge } from '@/lib/imageUpload';
import { uploadFileWithMetadata } from '@/lib/fileUpload';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const DEPARTMENTS = ['production', 'ppic', 'finance', 'purchasing', 'warehouse', 'hr', 'management', 'fat', 'rnd'];
const SENSITIVITIES = ['UMUM', 'DEPARTEMEN', 'TERBATAS'];

// Layanan unggah TERPUSAT Master Dokumen (MD-1, §2/§4) -- semua titik upload BARU
// di sistem dipanggil lewat sini (bukan storage.upload langsung), supaya SETIAP
// berkas otomatis tercatat di registry `documents`. Memakai uploadFileWithMetadata
// (aturan CLAUDE.md "Aturan Unggah Berkas") untuk checksum, LALU tambah baris
// registry di atasnya -- bukan menggantikannya.
export async function uploadDocument(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    if (isContentLengthTooLarge(request, MAX_SIZE_BYTES)) {
      return { status: 413, body: { error: 'Ukuran file maksimal 20MB.' } };
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return { status: 400, body: { error: 'File wajib diunggah.' } };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { status: 400, body: { error: 'Ukuran file maksimal 20MB.' } };
    }

    const docType = String(formData.get('doc_type') ?? '').trim();
    const title = String(formData.get('title') ?? '').trim();
    if (!docType || !title) {
      return { status: 400, body: { error: 'Jenis dokumen dan judul wajib diisi.' } };
    }

    const sensitivity = String(formData.get('sensitivity') ?? 'UMUM').trim();
    if (!SENSITIVITIES.includes(sensitivity)) {
      return { status: 400, body: { error: 'sensitivity tidak valid.' } };
    }
    const department = formData.get('department') ? String(formData.get('department')).trim() : null;
    if (sensitivity !== 'UMUM' && (!department || !DEPARTMENTS.includes(department))) {
      return { status: 400, body: { error: 'department wajib diisi dan valid untuk sensitivity DEPARTEMEN/TERBATAS.' } };
    }

    const adminClient = getAdminClient();

    const { data: docTypeRow, error: docTypeError } = await adminClient.from('document_types').select('code').eq('company_id', appUser.company_id).eq('code', docType).maybeSingle();
    if (docTypeError) return { status: 500, body: { error: docTypeError.message } };
    if (!docTypeRow) {
      return { status: 400, body: { error: `doc_type "${docType}" tidak dikenal -- belum ada di document_types perusahaan Anda.` } };
    }

    const claimedName = file.name || '';
    const claimedExt = claimedName.includes('.') ? claimedName.split('.').pop()!.toLowerCase() : undefined;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const sniffedExt = detectDocumentExtFromBytes(fileBuffer, claimedExt);
    if (!sniffedExt) {
      return { status: 400, body: { error: 'Format file tidak didukung atau isi file tidak cocok dengan ekstensinya. Gunakan PDF, PNG, JPG, WEBP, XLSX, atau DOCX.' } };
    }

    const path = `${appUser.company_id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${sniffedExt}`;

    const uploadResult = await uploadFileWithMetadata({
      adminClient,
      bucket: 'documents',
      path,
      fileBuffer,
      mimeType: EXT_TO_DOCUMENT_MIME[sniffedExt],
      uploaderUserId: appUser.user_id,
      entityType: 'documents',
      entityId: path,
      upsert: false
    });

    const { data: created, error: insertError } = await adminClient
      .from('documents')
      .insert([
        {
          company_id: appUser.company_id,
          doc_type: docType,
          title,
          doc_number: formData.get('doc_number') ? String(formData.get('doc_number')) : null,
          description: formData.get('description') ? String(formData.get('description')) : null,
          storage_path: path,
          mime_type: uploadResult.metadata.mimeType,
          size_bytes: uploadResult.metadata.sizeBytes,
          checksum_sha256: uploadResult.metadata.checksumSha256,
          issued_by: formData.get('issued_by') ? String(formData.get('issued_by')) : null,
          issued_date: formData.get('issued_date') ? String(formData.get('issued_date')) : null,
          effective_date: formData.get('effective_date') ? String(formData.get('effective_date')) : null,
          expiry_date: formData.get('expiry_date') ? String(formData.get('expiry_date')) : null,
          sensitivity,
          department,
          uploaded_by: appUser.user_id
        }
      ])
      .select('*')
      .single();
    if (insertError) return { status: 500, body: { error: insertError.message } };

    const entityType = formData.get('entity_type') ? String(formData.get('entity_type')) : null;
    const entityId = formData.get('entity_id') ? Number(formData.get('entity_id')) : null;
    const linkRole = formData.get('link_role') ? String(formData.get('link_role')) : null;
    if (entityType && entityId && linkRole) {
      const { error: linkError } = await adminClient
        .from('document_links')
        .insert([{ company_id: appUser.company_id, document_id: created.document_id, entity_type: entityType, entity_id: entityId, link_role: linkRole }]);
      if (linkError) return { status: 500, body: { error: linkError.message } };
    }

    return { status: 201, body: { document: created } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

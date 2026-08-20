import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface UploadMetadata {
  uploaderUserId: number;
  entityType: string;
  entityId: number | string;
  mimeType: string;
  checksumSha256: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface UploadFileParams {
  adminClient: SupabaseClient;
  bucket: string;
  path: string;
  fileBuffer: Buffer;
  mimeType: string;
  uploaderUserId: number;
  entityType: string;
  entityId: number | string;
  upsert?: boolean;
}

export interface UploadFileResult {
  publicUrl: string;
  metadata: UploadMetadata;
}

// Titik unggah TUNGGAL untuk semua fitur BARU (aturan CLAUDE.md "Aturan Unggah Berkas",
// rencana Master Dokumen §5) -- menyiapkan metadata minimum (uploader/entitas/mime/checksum)
// supaya backfill registry dokumen terpusat nanti kecil. Titik unggah LAMA (uploadAvatar,
// uploadSignature, uploadCompanyLogo, dst) sengaja TIDAK diretrofit ke fungsi ini.
export async function uploadFileWithMetadata(params: UploadFileParams): Promise<UploadFileResult> {
  const { adminClient, bucket, path, fileBuffer, mimeType, uploaderUserId, entityType, entityId, upsert } = params;

  const checksumSha256 = createHash('sha256').update(fileBuffer).digest('hex');

  const { error: uploadError } = await adminClient.storage
    .from(bucket)
    .upload(path, fileBuffer, { contentType: mimeType, upsert: upsert ?? false });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = adminClient.storage.from(bucket).getPublicUrl(path);

  return {
    publicUrl: publicUrlData.publicUrl,
    metadata: {
      uploaderUserId,
      entityType,
      entityId,
      mimeType,
      checksumSha256,
      sizeBytes: fileBuffer.byteLength,
      uploadedAt: new Date().toISOString()
    }
  };
}

import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { ALLOWED_IMAGE_MIME_TO_EXT, EXT_TO_IMAGE_MIME, detectImageExtFromBytes, isContentLengthTooLarge } from '@/lib/imageUpload';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

// Nama file di storage SENGAJA tetap ("logo.<ext>", upsert), bukan timestamped —
// supaya cuma 1 file per company yang tersimpan (tidak menumpuk). Cache-busting
// dilakukan lewat query string ?v=<timestamp> yang disimpan ke logo_url, bukan
// lewat nama file baru, supaya <img src> browser tidak menampilkan logo lama
// yang sudah di-cache.
export async function uploadCompanyLogo(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (appUser.role !== 'company_admin') {
      return { status: 403, body: { error: 'Hanya company_admin yang dapat mengubah logo perusahaan.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    if (isContentLengthTooLarge(request, MAX_SIZE_BYTES)) {
      return { status: 413, body: { error: 'Ukuran file maksimal 2MB.' } };
    }

    const formData = await request.formData();
    const file = formData.get('logo');

    if (!(file instanceof File)) {
      return { status: 400, body: { error: 'File logo wajib diunggah.' } };
    }

    if (file.size > MAX_SIZE_BYTES) {
      return { status: 400, body: { error: 'Ukuran file maksimal 2MB.' } };
    }
    if (!(file.type in ALLOWED_IMAGE_MIME_TO_EXT)) {
      return { status: 400, body: { error: 'Format file tidak didukung. Gunakan PNG, JPG, atau WEBP.' } };
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    // Content-Type yang diklaim client bisa dipalsukan — cek isi file sebenarnya
    // (magic bytes) sebelum disimpan, bukan cuma percaya header.
    const sniffedExt = detectImageExtFromBytes(fileBuffer);
    if (!sniffedExt) {
      return { status: 400, body: { error: 'Format file tidak didukung. Gunakan PNG, JPG, atau WEBP.' } };
    }

    const adminClient = getAdminClient();
    const path = `${appUser.company_id}/logo.${sniffedExt}`;

    const { error: uploadError } = await adminClient.storage
      .from('company-logos')
      .upload(path, fileBuffer, { contentType: EXT_TO_IMAGE_MIME[sniffedExt], upsert: true });

    if (uploadError) {
      return { status: 500, body: { error: uploadError.message } };
    }

    const { data: publicUrlData } = adminClient.storage.from('company-logos').getPublicUrl(path);
    const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await adminClient.from('companies').update({ logo_url: logoUrl }).eq('company_id', appUser.company_id);

    if (updateError) {
      return { status: 500, body: { error: updateError.message } };
    }

    return { status: 200, body: { success: true, logo_url: logoUrl } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

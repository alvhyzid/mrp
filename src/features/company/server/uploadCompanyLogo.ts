import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};
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

    const formData = await request.formData();
    const file = formData.get('logo');

    if (!(file instanceof File)) {
      return { status: 400, body: { error: 'File logo wajib diunggah.' } };
    }

    const ext = ALLOWED_MIME_TO_EXT[file.type];
    if (!ext) {
      return { status: 400, body: { error: 'Format file tidak didukung. Gunakan PNG, JPG, atau WEBP.' } };
    }

    if (file.size > MAX_SIZE_BYTES) {
      return { status: 400, body: { error: 'Ukuran file maksimal 2MB.' } };
    }

    const adminClient = getAdminClient();
    const path = `${appUser.company_id}/logo.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await adminClient.storage
      .from('company-logos')
      .upload(path, Buffer.from(arrayBuffer), { contentType: file.type, upsert: true });

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

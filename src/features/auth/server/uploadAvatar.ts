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

// Sama seperti uploadCompanyLogo: nama file tetap ("avatar.<ext>", upsert) di
// folder milik auth_uid user itu sendiri, cache-busting lewat query string.
export async function uploadAvatar(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser, authUser } = await getCurrentUser(request);

    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!(file instanceof File)) {
      return { status: 400, body: { error: 'File foto wajib diunggah.' } };
    }

    const ext = ALLOWED_MIME_TO_EXT[file.type];
    if (!ext) {
      return { status: 400, body: { error: 'Format file tidak didukung. Gunakan PNG, JPG, atau WEBP.' } };
    }

    if (file.size > MAX_SIZE_BYTES) {
      return { status: 400, body: { error: 'Ukuran file maksimal 2MB.' } };
    }

    const adminClient = getAdminClient();
    const path = `${authUser.id}/avatar.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await adminClient.storage
      .from('user-avatars')
      .upload(path, Buffer.from(arrayBuffer), { contentType: file.type, upsert: true });

    if (uploadError) {
      return { status: 500, body: { error: uploadError.message } };
    }

    const { data: publicUrlData } = adminClient.storage.from('user-avatars').getPublicUrl(path);
    const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await adminClient.from('users').update({ avatar_url: avatarUrl }).eq('auth_uid', authUser.id);

    if (updateError) {
      return { status: 500, body: { error: updateError.message } };
    }

    return { status: 200, body: { success: true, avatar_url: avatarUrl, user: { ...appUser, avatar_url: avatarUrl } } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

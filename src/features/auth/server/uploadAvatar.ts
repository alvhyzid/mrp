import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { ALLOWED_IMAGE_MIME_TO_EXT, EXT_TO_IMAGE_MIME, detectImageExtFromBytes, isContentLengthTooLarge } from '@/lib/imageUpload';
import { appUserUntukClient, ambilPathStorage } from '@/lib/storageSignedUrl';
import { hapusBerkasStorage } from '@/lib/storageCleanup';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

// Sama seperti uploadCompanyLogo: nama file tetap ("avatar.<ext>", upsert) di
// folder milik auth_uid user itu sendiri, cache-busting lewat query string.
export async function uploadAvatar(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser, authUser } = await getCurrentUser(request);

    if (isContentLengthTooLarge(request, MAX_SIZE_BYTES)) {
      return { status: 413, body: { error: 'Ukuran file maksimal 2MB.' } };
    }

    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!(file instanceof File)) {
      return { status: 400, body: { error: 'File foto wajib diunggah.' } };
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
    const path = `${authUser.id}/avatar.${sniffedExt}`;

    const { error: uploadError } = await adminClient.storage
      .from('user-avatars')
      .upload(path, fileBuffer, { contentType: EXT_TO_IMAGE_MIME[sniffedExt], upsert: true });

    if (uploadError) {
      return { status: 500, body: { error: uploadError.message } };
    }

    const { data: publicUrlData } = adminClient.storage.from('user-avatars').getPublicUrl(path);
    const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await adminClient.from('users').update({ avatar_url: avatarUrl }).eq('auth_uid', authUser.id);

    if (updateError) {
      return { status: 500, body: { error: updateError.message } };
    }

    // Nama berkas ikut EKSTENSI (avatar.png / avatar.jpg), dan upsert hanya menimpa nama
    // yang sama persis. Jadi mengganti foto PNG dengan JPG meninggalkan avatar.png yatim
    // selamanya. Berkas lama dengan ekstensi berbeda dibereskan di sini (INF-22 / JJ.1.3).
    if (appUser.avatar_url) {
      const pathLama = ambilPathStorage(appUser.avatar_url, 'user-avatars');
      if (pathLama && pathLama !== path) {
        await hapusBerkasStorage(adminClient, 'user-avatars', [appUser.avatar_url]);
      }
    }

    return {
      status: 200,
      body: { success: true, avatar_url: avatarUrl, user: await appUserUntukClient(adminClient, { ...appUser, avatar_url: avatarUrl }) }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

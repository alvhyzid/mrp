import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { ALLOWED_IMAGE_MIME_TO_EXT, EXT_TO_IMAGE_MIME, detectImageExtFromBytes, isContentLengthTooLarge } from '@/lib/imageUpload';
import { appUserUntukClient } from '@/lib/storageSignedUrl';
import { randomBytes } from 'node:crypto';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

// NAMA BERKAS UNIK — DIUBAH 25 Agu 2026 (MM.1c), dan ini bukan perapian.
//
// Versi lama memakai nama TETAP `avatar.<ext>` dengan upsert. Akibatnya mengganti foto PNG
// dengan PNG lain MENIMPA yang lama TANPA JEJAK — dan begitulah foto pemilik produk hilang
// permanen. Komentar lama di berkas ini hanya menyadari kasus PNG -> JPG (yang meninggalkan
// berkas yatim), dan DIAM soal PNG -> PNG yang justru menghapus. Setengah sadar lebih
// berbahaya daripada tidak sadar: pembaca berikutnya mengira masalahnya sudah dipikirkan.
//
// Sekarang tiap unggahan lahir dengan nama sendiri, jadi TIDAK ADA berkas yang pernah
// tertimpa. Konsekuensinya disebut terbuka: berkas lama TIDAK dihapus di sini dan akan
// menumpuk. Itu DISENGAJA — pembersihannya menyusul lewat INF-23, yang mengumpulkan daftar
// berkas dari baris induknya SELAGI masih ada, bukan menyapu yang "tidak dirujuk siapa pun".
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
    // Waktu + acak. Waktu saja tidak cukup: dua unggahan dalam milidetik yang sama akan
    // bertabrakan, dan tabrakan itu persis hal yang nama unik ini dimaksudkan mencegah.
    const penanda = `${Date.now()}-${randomBytes(4).toString('hex')}`;
    const path = `${authUser.id}/avatar-${penanda}.${sniffedExt}`;

    const { error: uploadError } = await adminClient.storage
      .from('user-avatars')
      // upsert: false DISENGAJA. Nama sudah unik, jadi menimpa TIDAK PERNAH benar di sini —
      // bila namanya kebetulan sudah ada, itu tanda ada yang salah dan wajib berbunyi.
      .upload(path, fileBuffer, { contentType: EXT_TO_IMAGE_MIME[sniffedExt], upsert: false });

    if (uploadError) {
      return { status: 500, body: { error: uploadError.message } };
    }

    const { data: publicUrlData } = adminClient.storage.from('user-avatars').getPublicUrl(path);
    const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await adminClient.from('users').update({ avatar_url: avatarUrl }).eq('auth_uid', authUser.id);

    if (updateError) {
      return { status: 500, body: { error: updateError.message } };
    }

    // FOTO LAMA SENGAJA TIDAK DIHAPUS DI SINI (keputusan pemilik produk, MM.1c).
    // Penghapusan langsung adalah persis mekanisme yang menghilangkan foto sebelumnya secara
    // permanen. Pembersihan menyusul lewat INF-23, yang bertolak dari baris induk yang
    // diketahui — bukan dari menyapu berkas yang "tidak dirujuk siapa pun", karena ketiadaan
    // rujukan hanya membuktikan tidak ada yang menunjuknya SAAT DIPERIKSA.

    return {
      status: 200,
      body: { success: true, avatar_url: avatarUrl, user: await appUserUntukClient(adminClient, { ...appUser, avatar_url: avatarUrl }) }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

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

// MENYIMPANG SENGAJA dari uploadAvatar.ts/uploadCompanyLogo.ts: kedua pola itu pakai
// path TETAP ("<id>/avatar.<ext>") + upsert:true, jadi file lama TERTIMPA di storage.
// Untuk tanda tangan itu SALAH — dokumen yang SUDAH ditandatangani harus tetap
// menunjukkan gambar tanda tangan yang berlaku SAAT ditandatangani, bukan ikut
// berubah kalau user ganti tanda tangan belakangan (lihat document_signatures.
// signature_url_snapshot). Jadi path di sini SELALU unik per upload (timestamp +
// nama asli file), tidak pernah upsert ke path yang sama, dan bucket user-signatures
// (migration 20260817160000) sengaja TIDAK PUNYA policy delete sama sekali.
export async function uploadSignature(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser, authUser } = await getCurrentUser(request);

    const formData = await request.formData();
    const file = formData.get('signature');

    if (!(file instanceof File)) {
      return { status: 400, body: { error: 'File tanda tangan wajib diunggah.' } };
    }

    const ext = ALLOWED_MIME_TO_EXT[file.type];
    if (!ext) {
      return { status: 400, body: { error: 'Format file tidak didukung. Gunakan PNG, JPG, atau WEBP.' } };
    }

    if (file.size > MAX_SIZE_BYTES) {
      return { status: 400, body: { error: 'Ukuran file maksimal 2MB.' } };
    }

    const adminClient = getAdminClient();
    const path = `${authUser.id}/signature-${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await adminClient.storage
      .from('user-signatures')
      .upload(path, Buffer.from(arrayBuffer), { contentType: file.type, upsert: false });

    if (uploadError) {
      return { status: 500, body: { error: uploadError.message } };
    }

    const { data: publicUrlData } = adminClient.storage.from('user-signatures').getPublicUrl(path);
    const signatureUrl = publicUrlData.publicUrl;

    const { error: updateError } = await adminClient.from('users').update({ signature_url: signatureUrl }).eq('auth_uid', authUser.id);

    if (updateError) {
      return { status: 500, body: { error: updateError.message } };
    }

    return { status: 200, body: { success: true, signature_url: signatureUrl, user: { ...appUser, signature_url: signatureUrl } } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

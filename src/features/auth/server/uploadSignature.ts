import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { ALLOWED_IMAGE_MIME_TO_EXT, EXT_TO_IMAGE_MIME, detectImageExtFromBytes, isContentLengthTooLarge } from '@/lib/imageUpload';
import { buatSignedUrl, ambilPathStorage, BUCKET_TANDA_TANGAN } from '@/lib/storageSignedUrl';
import { hapusBerkasStorage } from '@/lib/storageCleanup';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

// MENYIMPANG SENGAJA dari uploadAvatar.ts/uploadCompanyLogo.ts: kedua pola itu pakai
// path TETAP ("<id>/avatar.<ext>") + upsert:true, jadi file lama TERTIMPA di storage.
// Untuk tanda tangan itu SALAH — dokumen yang SUDAH ditandatangani harus tetap
// menunjukkan gambar tanda tangan yang berlaku SAAT ditandatangani, bukan ikut
// berubah kalau user ganti tanda tangan belakangan (lihat document_signatures.
// signature_url_snapshot). Jadi path di sini SELALU unik per upload (timestamp +
// nama asli file), tidak pernah upsert ke path yang sama, dan bucket user-signatures
// (migration 20260817160000) sengaja TIDAK PUNYA policy delete sama sekali.
//
// TAMBAHAN 24 Agu 2026 (INF-22 / JJ.1.3) — path unik itu punya sisi buruk yang baru
// ketahuan: setiap penggantian tanda tangan meninggalkan berkas lama yang tidak dirujuk
// siapa pun, selamanya. Sejak sekarang berkas lama DIHAPUS, TAPI hanya bila tidak satu
// pun baris document_signatures merujuknya — jadi maksud asli di atas (dokumen terbit
// tetap menunjukkan tanda tangan saat itu) tetap utuh. Penghapusan dilakukan admin client
// (service_role) yang melewati RLS, jadi ketiadaan policy delete di atas tidak berubah.
export async function uploadSignature(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser, authUser } = await getCurrentUser(request);

    if (isContentLengthTooLarge(request, MAX_SIZE_BYTES)) {
      return { status: 413, body: { error: 'Ukuran file maksimal 2MB.' } };
    }

    const formData = await request.formData();
    const file = formData.get('signature');

    if (!(file instanceof File)) {
      return { status: 400, body: { error: 'File tanda tangan wajib diunggah.' } };
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
    const path = `${authUser.id}/signature-${Date.now()}.${sniffedExt}`;

    const { error: uploadError } = await adminClient.storage
      .from('user-signatures')
      .upload(path, fileBuffer, { contentType: EXT_TO_IMAGE_MIME[sniffedExt], upsert: false });

    if (uploadError) {
      return { status: 500, body: { error: uploadError.message } };
    }

    const { data: publicUrlData } = adminClient.storage.from('user-signatures').getPublicUrl(path);
    const signatureUrl = publicUrlData.publicUrl;

    const { error: updateError } = await adminClient.from('users').update({ signature_url: signatureUrl }).eq('auth_uid', authUser.id);

    if (updateError) {
      return { status: 500, body: { error: updateError.message } };
    }

    // BERKAS LAMA DIBERESKAN DI SINI (INF-22 / JJ.1.3). Setiap unggahan memakai nama baru
    // ber-timestamp, jadi tanpa langkah ini setiap penggantian tanda tangan meninggalkan satu
    // berkas yatim selamanya — persis asal-usul 4 berkas yatim yang ditemukan 24 Agu 2026.
    //
    // TAPI TIDAK SEMUA YANG LAMA BOLEH DIHAPUS. `document_signatures.signature_url_snapshot`
    // menunjuk berkas tanda tangan PERSIS seperti saat dokumen itu ditandatangani. Menghapusnya
    // berarti surat jalan yang sudah terbit kehilangan gambar tanda tangannya — memutus
    // ketertelusuran dokumen, hal yang justru dijaga sistem ini. Jadi yang lama hanya dihapus
    // bila TIDAK SATU PUN dokumen terbit merujuknya.
    if (appUser.signature_url && appUser.signature_url !== signatureUrl) {
      const pathLama = ambilPathStorage(appUser.signature_url, BUCKET_TANDA_TANGAN);
      if (pathLama) {
        const { data: dipakaiDokumen } = await adminClient
          .from('document_signatures')
          .select('document_signature_id')
          .like('signature_url_snapshot', `%${pathLama}%`)
          .limit(1);

        if (!dipakaiDokumen || dipakaiDokumen.length === 0) {
          await hapusBerkasStorage(adminClient, BUCKET_TANDA_TANGAN, [appUser.signature_url]);
        }
      }
    }

    // Yang DISIMPAN tetap bentuk URL seperti sedia kala; yang DIKIRIM ke peramban adalah
    // signed URL berumur pendek, karena bucket ini privat sejak JJ.1 (24 Agu 2026).
    const signatureUrlTampil = await buatSignedUrl(adminClient, BUCKET_TANDA_TANGAN, signatureUrl);
    return {
      status: 200,
      body: { success: true, signature_url: signatureUrlTampil, user: { ...appUser, signature_url: signatureUrlTampil } }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

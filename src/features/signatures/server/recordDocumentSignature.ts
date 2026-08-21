import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Endpoint GENERIK berdiri sendiri — dipakai untuk jenis dokumen mana pun yang TIDAK
// butuh transisi status bersamaan (mis. pengujian Sesi 1 dengan data dummy). Untuk
// kasus seperti Surat Jalan (Sesi 2) yang butuh "tanda tangan + transisi status dalam
// 1 transaksi", document_type itu TIDAK lewat endpoint ini — dia punya endpoint sendiri
// yang menggabungkan insert document_signatures DENGAN update status dalam satu
// pemanggilan RPC/transaksi, supaya keduanya benar-benar atomik (lihat ConfirmAndSignModal:
// prop onConfirm sepenuhnya dikendalikan pemanggil, bukan di-hardcode ke endpoint ini).
//
// signature_url_snapshot & signer_role_at_signing SELALU dibaca dari appUser (query
// database SAAT REQUEST INI, lewat getCurrentUser) — TIDAK PERNAH dipercaya dari body
// request client, supaya tidak bisa dipalsukan dan selalu mencerminkan kondisi user
// PERSIS di momen "Process" diklik, bukan data basi dari saat modal dibuka.
export async function recordDocumentSignature(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }
    if (!appUser.signature_url) {
      return { status: 400, body: { error: 'Anda belum mengunggah tanda tangan digital. Unggah dulu lewat halaman Profil.' } };
    }

    const body = await request.json();
    const documentType = String(body.document_type ?? '').trim();
    const documentId = Number(body.document_id);
    const confirmationText = String(body.confirmation_text ?? '').trim();

    if (!documentType) {
      return { status: 400, body: { error: 'Jenis dokumen wajib diisi.' } };
    }
    if (!documentId) {
      return { status: 400, body: { error: 'Dokumen wajib diisi.' } };
    }
    if (!confirmationText) {
      return { status: 400, body: { error: 'Teks konfirmasi wajib diisi.' } };
    }

    const adminClient = getAdminClient();

    const { data: signature, error: insertError } = await adminClient
      .from('document_signatures')
      .insert([
        {
          company_id: appUser.company_id,
          document_type: documentType,
          document_id: documentId,
          signed_by: appUser.user_id,
          signer_role_at_signing: appUser.role,
          signature_url_snapshot: appUser.signature_url,
          confirmation_text: confirmationText
        }
      ])
      .select('document_signature_id, document_type, document_id, signed_by, signer_role_at_signing, signature_url_snapshot, confirmation_text, signed_at')
      .single();

    if (insertError) {
      return { status: 500, body: { error: insertError.message } };
    }

    return { status: 201, body: { signature } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

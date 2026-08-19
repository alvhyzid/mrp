import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Jawab/lewati/tugaskan 1 baris kamus_terms -- SIAPA PUN staf internal
// perusahaan boleh (prinsip inti modul: distribusikan ke siapa saja yang
// tahu, badge departemen di UI cuma SARAN bukan gerbang keras). Konfirmasi
// (dua-mata) ada di fungsi TERPISAH (confirmKamusTerm.ts) yang gerbangnya
// leadership-only.
export async function answerKamusTerm(request: NextRequest, kamusTermId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const action = String(body.action ?? '').trim();
    if (!['answer', 'assign', 'skip'].includes(action)) {
      return { status: 400, body: { error: 'Aksi tidak valid (harus answer/assign/skip).' } };
    }

    const adminClient = getAdminClient();
    const { data: existing, error: existingError } = await adminClient
      .from('kamus_terms')
      .select('kamus_term_id, company_id, status')
      .eq('kamus_term_id', kamusTermId)
      .maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };
    if (!existing || existing.company_id !== appUser.company_id) return { status: 404, body: { error: 'Istilah tidak ditemukan.' } };
    if (existing.status === 'DIKONFIRMASI') {
      return { status: 400, body: { error: 'Istilah ini sudah dikonfirmasi -- tidak bisa diubah lewat jalur ini (jawaban manusia tidak boleh ditimpa).' } };
    }

    let updatePayload: Record<string, unknown>;

    if (action === 'answer') {
      const answerPlain = String(body.answer_plain ?? '').trim();
      const answerPitfall = String(body.answer_pitfall ?? '').trim();
      const answerRange = String(body.answer_range ?? '').trim();
      if (!answerPlain) {
        return { status: 400, body: { error: 'Penjelasan (answer_plain) wajib diisi.' } };
      }
      updatePayload = {
        answer_plain: answerPlain,
        answer_pitfall: answerPitfall || null,
        answer_range: answerRange || null,
        status: 'DIJAWAB',
        answered_by: appUser.user_id
      };
    } else if (action === 'assign') {
      const assignedToRole = String(body.assigned_to_role ?? '').trim();
      if (!assignedToRole) {
        return { status: 400, body: { error: 'Departemen tujuan (assigned_to_role) wajib diisi.' } };
      }
      updatePayload = {
        assigned_to_role: assignedToRole,
        assigned_note: String(body.assigned_note ?? '').trim() || null
      };
    } else {
      // skip: tandai TIDAK_RELEVAN -- tetap tercatat siapa yang memutuskan (answered_by),
      // supaya ada jejak, bukan cuma menghilang dari antrean tanpa alasan.
      updatePayload = { status: 'TIDAK_RELEVAN', answered_by: appUser.user_id };
    }

    const { error: updateError } = await adminClient.from('kamus_terms').update(updatePayload).eq('kamus_term_id', kamusTermId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

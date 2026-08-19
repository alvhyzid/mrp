import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Tombol "jawaban ini salah" (§3.6) -- disiapkan sekarang, BELUM ada pemanggil
// nyata (tidak ada fitur AI yang menjawab apa pun saat ini). Menyimpan
// readiness_snapshot supaya nanti bisa dibedakan "belum siap" vs "rusak"
// (§1.7) saat pemilik produk meninjau laporan.
export async function submitAnswerFeedback(
  request: NextRequest,
  input: { capabilityCode?: string; question: string; answer: string; feedbackReason?: string; readinessSnapshot?: unknown }
): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }
    if (!input.question?.trim() || !input.answer?.trim()) {
      return { status: 400, body: { error: 'Pertanyaan dan jawaban wajib diisi.' } };
    }

    const adminClient = getAdminClient();
    let capabilityId: number | null = null;
    if (input.capabilityCode) {
      const { data: capability } = await adminClient.from('ai_capabilities').select('ai_capability_id').eq('code', input.capabilityCode).maybeSingle();
      capabilityId = capability?.ai_capability_id ?? null;
    }

    const { error: insertError } = await adminClient.from('ai_answer_feedback').insert([
      {
        company_id: appUser.company_id,
        capability_id: capabilityId,
        user_id: appUser.user_id,
        question: input.question,
        answer: input.answer,
        feedback_reason: input.feedbackReason ?? null,
        readiness_snapshot: input.readinessSnapshot ?? null
      }
    ]);
    if (insertError) return { status: 500, body: { error: insertError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

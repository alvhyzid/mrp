import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// HANYA utk tugas progress_source=MANUAL_PERCENT -- tugas AUTO_QUERY/CHECKLIST
// SELALU ditolak di sini (docs/instruksi-dashboard-proyek-ai.md §4: "sekali
// [progres AUTO_QUERY] dibuka [utk diisi manual], angkanya berhenti bermakna").
// Saat ini TIDAK ADA tugas ber-progress_source=MANUAL_PERCENT yang di-seed
// (semua Fase 0-4 memakai AUTO_QUERY atau CHECKLIST) -- fungsi ini tetap
// dibangun supaya jalur MANUAL_PERCENT siap kalau nanti dibutuhkan, DAN supaya
// gerbang penolakannya bisa diuji (skenario negatif 1 yang diminta dokumen).
export async function setAiProjectTaskManualPercent(request: NextRequest, taskId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Dashboard Proyek AI khusus Admin Perusahaan atau General Manager (tim inti).' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const percent = Number(body.manual_percent);
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      return { status: 400, body: { error: 'Persentase manual harus berupa angka 0-100.' } };
    }

    const adminClient = getAdminClient();
    const { data: task, error: taskError } = await adminClient
      .from('ai_project_tasks')
      .select('ai_project_task_id, company_id, progress_source')
      .eq('ai_project_task_id', taskId)
      .maybeSingle();
    if (taskError) return { status: 500, body: { error: taskError.message } };
    if (!task || task.company_id !== appUser.company_id) return { status: 404, body: { error: 'Tugas tidak ditemukan.' } };

    if (task.progress_source !== 'MANUAL_PERCENT') {
      return {
        status: 400,
        body: { error: `Tugas ini progress_source=${task.progress_source}, BUKAN MANUAL_PERCENT -- progresnya wajib dihitung otomatis, tidak boleh diisi manual.` }
      };
    }

    const { error: updateError } = await adminClient
      .from('ai_project_tasks')
      .update({ manual_percent: percent, manual_percent_set_by: appUser.user_id, manual_percent_set_at: new Date().toISOString() })
      .eq('ai_project_task_id', taskId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

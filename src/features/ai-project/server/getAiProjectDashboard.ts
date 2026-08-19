import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';
import { computeAllProgress } from './computeAiProjectProgress';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Dashboard Proyek AI -- INTERNAL, leadership-only (docs/instruksi-dashboard-
// proyek-ai.md §4: "Jangan menampilkan dashboard ini ke role di luar tim
// inti"). Progres dihitung LIVE setiap panggilan (tanpa cache -- versi
// sederhana, spesifikasi mengizinkan cache <=5 menit tapi live lebih
// sederhana & masih cukup cepat utk 29 tugas).
export async function getAiProjectDashboard(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Dashboard Proyek AI khusus company_admin atau general_manager (tim inti).' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { overallPercent, phaseProgress, taskProgressById, tasks, phases } = await computeAllProgress(adminClient, appUser.company_id);

    const { data: checklists } = await adminClient.from('ai_project_checklist_items').select('*').in('ai_project_task_id', tasks.map((t) => t.ai_project_task_id));
    const checklistByTask = new Map<number, typeof checklists>();
    for (const item of checklists ?? []) {
      if (!checklistByTask.has(item.ai_project_task_id)) checklistByTask.set(item.ai_project_task_id, []);
      checklistByTask.get(item.ai_project_task_id)!.push(item);
    }

    const { data: latestSnapshot } = await adminClient
      .from('ai_project_progress_snapshots')
      .select('overall_percent, taken_at')
      .eq('company_id', appUser.company_id)
      .order('taken_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const tasksOut = tasks.map((t) => {
      const progress = taskProgressById.get(t.ai_project_task_id)!;
      const phase = phases.find((p) => p.ai_project_phase_id === t.ai_project_phase_id);
      const contributionToTotal = phase ? (progress.progress_percent * Number(t.weight_percent) * Number(phase.weight_percent)) / 10000 : 0;
      return {
        ...t,
        progress_percent: progress.progress_percent,
        progress_detail: progress.detail,
        contribution_to_total_if_complete: ((100 - progress.progress_percent) * Number(t.weight_percent) * (phase ? Number(phase.weight_percent) : 0)) / 10000,
        contribution_to_total_now: contributionToTotal,
        checklist_items: checklistByTask.get(t.ai_project_task_id) ?? []
      };
    });

    // "Bisa dikerjakan sekarang": belum 100%, tidak terblokir, diurutkan
    // dampak-per-menit (bobot sisa / perkiraan sisa pekerjaan -- proksi: bobot
    // dikali persentase BELUM selesai, karena tidak ada estimasi waktu nyata).
    const blockedIds = new Set<number>();
    for (const t of tasksOut) {
      if (t.blocked_by && Array.isArray(t.blocked_by) && t.blocked_by.length > 0) {
        const blockers = tasksOut.filter((bt) => t.blocked_by!.includes(bt.ai_project_task_id));
        if (blockers.some((b) => b.progress_percent < 100)) blockedIds.add(t.ai_project_task_id);
      }
    }
    const actionable = tasksOut
      .filter((t) => t.progress_percent < 100 && !blockedIds.has(t.ai_project_task_id))
      .sort((a, b) => b.contribution_to_total_if_complete - a.contribution_to_total_if_complete)
      .slice(0, 5);

    return {
      status: 200,
      body: {
        overall_percent: overallPercent,
        phases: phaseProgress,
        tasks: tasksOut,
        actionable_now: actionable,
        latest_snapshot: latestSnapshot ?? null
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

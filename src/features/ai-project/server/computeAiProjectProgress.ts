import type { SupabaseClient } from '@supabase/supabase-js';

// Progres tugas AUTO_QUERY dihitung LIVE dari data nyata setiap dipanggil
// (docs/instruksi-dashboard-proyek-ai.md §3.2: "Dilarang ada kolom persen
// yang diketik manusia utk tugas ber-AUTO_QUERY"). HANYA 3 kunci computable
// saat ini (lihat seedAiProjectStructure.ts utk penjelasan lengkap kenapa 4
// lainnya direklasifikasi CHECKLIST).
async function computeAutoQueryProgress(adminClient: SupabaseClient, companyId: number, progressKey: string): Promise<number> {
  if (progressKey === 'kamus.p12') {
    const { count: total } = await adminClient.from('kamus_terms').select('kamus_term_id', { count: 'exact', head: true }).eq('company_id', companyId).lte('priority', 2);
    const { count: done } = await adminClient.from('kamus_terms').select('kamus_term_id', { count: 'exact', head: true }).eq('company_id', companyId).lte('priority', 2).eq('status', 'DIKONFIRMASI');
    return total && total > 0 ? ((done ?? 0) / total) * 100 : 0;
  }
  if (progressKey === 'kamus.p3') {
    const { count: total } = await adminClient.from('kamus_terms').select('kamus_term_id', { count: 'exact', head: true }).eq('company_id', companyId).eq('priority', 3);
    const { count: done } = await adminClient.from('kamus_terms').select('kamus_term_id', { count: 'exact', head: true }).eq('company_id', companyId).eq('priority', 3).eq('status', 'DIKONFIRMASI');
    return total && total > 0 ? ((done ?? 0) / total) * 100 : 0;
  }
  if (progressKey === 'kamus.metrik') {
    const { count: total } = await adminClient.from('kamus_terms').select('kamus_term_id', { count: 'exact', head: true }).eq('company_id', companyId).eq('scope', 'METRIC');
    const { count: done } = await adminClient.from('kamus_terms').select('kamus_term_id', { count: 'exact', head: true }).eq('company_id', companyId).eq('scope', 'METRIC').eq('status', 'DIKONFIRMASI');
    return total && total > 0 ? ((done ?? 0) / total) * 100 : 0;
  }
  return 0;
}

export interface TaskProgress {
  ai_project_task_id: number;
  progress_percent: number;
  detail: string;
}

export async function computeTaskProgress(
  adminClient: SupabaseClient,
  companyId: number,
  task: { ai_project_task_id: number; progress_source: string; progress_key: string | null; manual_percent: number | null }
): Promise<TaskProgress> {
  if (task.progress_source === 'AUTO_QUERY' && task.progress_key) {
    const percent = await computeAutoQueryProgress(adminClient, companyId, task.progress_key);
    return { ai_project_task_id: task.ai_project_task_id, progress_percent: percent, detail: `Dihitung otomatis dari data nyata (${task.progress_key}).` };
  }
  if (task.progress_source === 'CHECKLIST') {
    const { data: items } = await adminClient.from('ai_project_checklist_items').select('done').eq('ai_project_task_id', task.ai_project_task_id);
    const total = items?.length ?? 0;
    const done = items?.filter((i) => i.done).length ?? 0;
    return { ai_project_task_id: task.ai_project_task_id, progress_percent: total > 0 ? (done / total) * 100 : 0, detail: `${done} dari ${total} item checklist selesai.` };
  }
  // MANUAL_PERCENT
  return { ai_project_task_id: task.ai_project_task_id, progress_percent: task.manual_percent ?? 0, detail: 'Diisi manual (progress_source=MANUAL_PERCENT).' };
}

export interface PhaseProgress {
  ai_project_phase_id: number;
  code: string;
  name: string;
  weight_percent: number;
  progress_percent: number;
  contribution_to_total: number;
}

export async function computeAllProgress(adminClient: SupabaseClient, companyId: number) {
  const { data: phases } = await adminClient.from('ai_project_phases').select('*').eq('company_id', companyId).order('sort_order');
  const { data: tasks } = await adminClient.from('ai_project_tasks').select('*').eq('company_id', companyId).order('sort_order');

  const tasksByPhase = new Map<number, typeof tasks>();
  for (const t of tasks ?? []) {
    if (!tasksByPhase.has(t.ai_project_phase_id)) tasksByPhase.set(t.ai_project_phase_id, []);
    tasksByPhase.get(t.ai_project_phase_id)!.push(t);
  }

  const taskProgressById = new Map<number, TaskProgress>();
  for (const t of tasks ?? []) {
    const progress = await computeTaskProgress(adminClient, companyId, t);
    taskProgressById.set(t.ai_project_task_id, progress);
  }

  const phaseProgress: PhaseProgress[] = [];
  let overallPercent = 0;
  for (const phase of phases ?? []) {
    const phaseTasks = tasksByPhase.get(phase.ai_project_phase_id) ?? [];
    let phasePercent = 0;
    for (const t of phaseTasks) {
      const tp = taskProgressById.get(t.ai_project_task_id)!;
      phasePercent += (tp.progress_percent * Number(t.weight_percent)) / 100;
    }
    const contribution = (phasePercent * Number(phase.weight_percent)) / 100;
    overallPercent += contribution;
    phaseProgress.push({
      ai_project_phase_id: phase.ai_project_phase_id,
      code: phase.code,
      name: phase.name,
      weight_percent: Number(phase.weight_percent),
      progress_percent: phasePercent,
      contribution_to_total: contribution
    });
  }

  return { overallPercent, phaseProgress, taskProgressById, tasks: tasks ?? [], phases: phases ?? [] };
}

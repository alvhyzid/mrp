import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function toggleAiProjectChecklistItem(request: NextRequest, checklistItemId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Dashboard Proyek AI khusus company_admin atau general_manager (tim inti).' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const done = Boolean(body.done);

    const adminClient = getAdminClient();
    const { data: item, error: itemError } = await adminClient
      .from('ai_project_checklist_items')
      .select('ai_project_checklist_item_id, ai_project_task_id, ai_project_tasks!inner(company_id)')
      .eq('ai_project_checklist_item_id', checklistItemId)
      .maybeSingle();
    if (itemError) return { status: 500, body: { error: itemError.message } };
    if (!item || (item as any).ai_project_tasks.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Item checklist tidak ditemukan.' } };
    }

    const { error: updateError } = await adminClient
      .from('ai_project_checklist_items')
      .update({ done, done_by: done ? appUser.user_id : null, done_at: done ? new Date().toISOString() : null })
      .eq('ai_project_checklist_item_id', checklistItemId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

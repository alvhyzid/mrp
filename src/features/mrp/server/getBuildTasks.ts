import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Halaman Daftar Tugas Pembangunan (21 Agu 2026) — HANYA BACA (A.2). Tidak ada
// endpoint tulis untuk build_tasks yang bisa dipanggil dari aplikasi sama
// sekali (bukan cuma tombol disembunyikan) — satu-satunya cara mengubah data
// tabel ini adalah migrasi/skrip service-role, ditegakkan lewat TIDAK ADANYA
// insert/update/delete policy RLS untuk authenticated/anon (lihat migrasi
// 20260827330000).
//
// Pengelompokan per modul, penghitungan persentase, dan penyaringan SENGAJA
// dilakukan di client (dataset kecil, ~90 baris) — bukan di sini — supaya
// filter berubah instan tanpa panggilan API berulang (F.2).
export async function getBuildTasks(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('build_tasks')
      .select(
        'build_task_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, created_at, started_at, completed_at, approved_at, super_urgent_since, approval_review_steps, approval_location, approval_example_case, approval_if_approved, approval_if_rejected, approval_options'
      )
      .eq('company_id', appUser.company_id)
      .order('task_code', { ascending: true });

    if (error) return { status: 500, body: { error: error.message } };

    // C.3: penanda aman-paralel DITURUNKAN dari tag, bukan diisi manual --
    // task TANPA tag Visual dan TANPA Teks/Bahasa aman dikerjakan paralel.
    const tasks = (data ?? []).map((t) => ({
      ...t,
      aman_paralel: !t.tags.includes('Visual') && !t.tags.includes('Teks/Bahasa')
    }));

    return { status: 200, body: { tasks } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

// Riwayat urgensi & persetujuan dimuat TERPISAH (lazy, hanya saat detail task
// dibuka) supaya panggilan daftar utama tetap ringan.
export async function getBuildTaskHistory(request: NextRequest, buildTaskId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { data: task, error: taskError } = await adminClient.from('build_tasks').select('build_task_id, company_id').eq('build_task_id', buildTaskId).maybeSingle();
    if (taskError) return { status: 500, body: { error: taskError.message } };
    if (!task || task.company_id !== appUser.company_id) return { status: 404, body: { error: 'Task tidak ditemukan.' } };

    const [urgencyRes, approvalRes] = await Promise.all([
      adminClient.from('build_task_urgency_history').select('old_urgency, new_urgency, changed_at, requested_by').eq('build_task_id', buildTaskId).order('changed_at', { ascending: false }),
      adminClient.from('build_task_approval_history').select('action, note, at, by_whom').eq('build_task_id', buildTaskId).order('at', { ascending: false })
    ]);
    if (urgencyRes.error) return { status: 500, body: { error: urgencyRes.error.message } };
    if (approvalRes.error) return { status: 500, body: { error: approvalRes.error.message } };

    return { status: 200, body: { urgencyHistory: urgencyRes.data ?? [], approvalHistory: approvalRes.data ?? [] } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

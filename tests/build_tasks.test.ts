import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getBuildTasks, getBuildTaskHistory } from '../src/features/mrp/server/getBuildTasks';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// Halaman Daftar Tugas Pembangunan (21 Agu 2026) — HANYA BACA (A.2). Bukti
// yang diuji di sini: (b)/(d) tidak ada jalur tulis yang bisa dipanggil
// aplikasi sama sekali — ditegakkan dengan MEMBUKTIKAN RLS menolak INSERT/
// UPDATE/DELETE langsung memakai kunci anon (bukan cuma "endpoint tidak
// ada", tapi genuinely ditolak server kalau seseorang mencoba lewat jalur
// lain); (n) CHECK constraint menolak status menunggu_persetujuan tanpa
// kolom E.3 lengkap, di DATABASE, bukan cuma validasi UI.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeGetRequest(url: string, token: string): NextRequest {
  return new NextRequest(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
}

describe('Halaman Daftar Tugas Pembangunan (hanya baca, riwayat, gerbang E.3)', () => {
  let companyId: number;
  let adminAuthUid: string;
  let adminToken: string;
  let anonSessionClient: SupabaseClient;
  let taskAId: number; // task biasa, dipakai uji riwayat
  let taskBId: number;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'BuildTasksTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

        adminAuthUid = await ensureAuthUser(adminClient, 'admin.buildtaskstest@debug.mrp', roleTestPassword);
    await adminClient.from('users').insert([{ auth_uid: adminAuthUid, company_id: companyId, name: 'Admin BuildTasksTest', email: 'admin.buildtaskstest@debug.mrp', role: 'company_admin', status: 'active' }]);
    adminToken = await loginToken('admin.buildtaskstest@debug.mrp');

    const { data: taskA } = await adminClient
      .from('build_tasks')
      .insert([
        {
          company_id: companyId, task_code: 'TST-01', name: 'Task Uji A', module_code: 'TST', module_name: 'Modul Uji',
          description: 'Deskripsi uji.', effect_description: 'Efek uji.', urgency: 'penting', tags: ['Visual', 'Fungsi'],
          pic: 'Claude Code', status: 'menunggu', origin: 'perencanaan_awal', detail_pekerjaan: 'Detail uji.'
        }
      ])
      .select('build_task_id')
      .single();
    taskAId = taskA!.build_task_id;

    const { data: taskB } = await adminClient
      .from('build_tasks')
      .insert([
        {
          company_id: companyId, task_code: 'TST-02', name: 'Task Uji B (aman paralel)', module_code: 'TST', module_name: 'Modul Uji',
          description: 'Deskripsi uji B.', effect_description: 'Efek uji B.', urgency: 'mendesak', tags: ['Database'],
          pic: 'Pemilik Produk', status: 'sedang_dikerjakan', origin: 'temuan_claude', detail_pekerjaan: 'Detail uji B.'
        }
      ])
      .select('build_task_id')
      .single();
    taskBId = taskB!.build_task_id;

    await adminClient.from('build_task_urgency_history').insert([{ build_task_id: taskAId, old_urgency: 'bisa_menunggu', new_urgency: 'penting', requested_by: 'Arsitek (uji)' }]);
    await adminClient.from('build_task_approval_history').insert([{ build_task_id: taskBId, action: 'rejected', note: 'Alasan uji penolakan.', by_whom: 'Arsitek (uji)' }]);
  });

  afterAll(async () => {
    if (anonSessionClient) {
      await anonSessionClient.auth.signOut().catch(() => {});
    }
    const cleanupSteps: Array<[string, () => any]> = [
      ['build_task_urgency_history', () => adminClient.from('build_task_urgency_history').delete().in('build_task_id', [taskAId, taskBId])],
      ['build_task_approval_history', () => adminClient.from('build_task_approval_history').delete().in('build_task_id', [taskAId, taskBId])],
      ['build_tasks', () => adminClient.from('build_tasks').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['auth:admin', () => adminClient.auth.admin.deleteUser(adminAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('daftar task memuat field turunan aman_paralel dengan benar (C.3)', async () => {
    const result = await getBuildTasks(makeGetRequest('http://localhost/api/build-tasks', adminToken));
    expect(result.status).toBe(200);
    const tasks = (result.body as any).tasks as any[];
    const taskA = tasks.find((t) => t.build_task_id === taskAId);
    const taskB = tasks.find((t) => t.build_task_id === taskBId);
    // Task A bertag Visual -> TIDAK aman paralel (menunggu cetakan UX).
    expect(taskA.aman_paralel).toBe(false);
    // Task B hanya bertag Database -> aman paralel.
    expect(taskB.aman_paralel).toBe(true);
  });

  it('riwayat urgensi & persetujuan termuat lengkap lewat endpoint riwayat', async () => {
    const historyA = await getBuildTaskHistory(makeGetRequest(`http://localhost/api/build-tasks/${taskAId}/history`, adminToken), taskAId);
    expect(historyA.status).toBe(200);
    expect((historyA.body as any).urgencyHistory).toHaveLength(1);
    expect((historyA.body as any).urgencyHistory[0].requested_by).toBe('Arsitek (uji)');

    const historyB = await getBuildTaskHistory(makeGetRequest(`http://localhost/api/build-tasks/${taskBId}/history`, adminToken), taskBId);
    expect(historyB.status).toBe(200);
    expect((historyB.body as any).approvalHistory).toHaveLength(1);
    expect((historyB.body as any).approvalHistory[0].action).toBe('rejected');
  });

  it('(n) CHECK constraint database MENOLAK status menunggu_persetujuan tanpa kolom E.3 lengkap', async () => {
    const { error } = await adminClient.from('build_tasks').insert([
      {
        company_id: companyId, task_code: 'TST-03', name: 'Task Tanpa E3', module_code: 'TST', module_name: 'Modul Uji',
        description: 'x', effect_description: 'x', urgency: 'penting', tags: [], pic: 'Claude Code',
        status: 'menunggu_persetujuan', origin: 'temuan_claude', detail_pekerjaan: 'x'
        // SENGAJA tidak mengisi approval_review_steps dkk.
      }
    ]);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('build_tasks_approval_fields_required');
  });

  it('(n-lanjutan) status menunggu_persetujuan DENGAN kolom E.3 lengkap -> diterima', async () => {
    const { data, error } = await adminClient
      .from('build_tasks')
      .insert([
        {
          company_id: companyId, task_code: 'TST-04', name: 'Task Dengan E3', module_code: 'TST', module_name: 'Modul Uji',
          description: 'x', effect_description: 'x', urgency: 'penting', tags: [], pic: 'Claude Code',
          status: 'menunggu_persetujuan', origin: 'temuan_claude', detail_pekerjaan: 'x',
          approval_review_steps: 'x', approval_location: 'x', approval_example_case: 'x', approval_if_approved: 'x', approval_if_rejected: 'x'
        }
      ])
      .select('build_task_id')
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    await adminClient.from('build_tasks').delete().eq('build_task_id', data!.build_task_id);
  });

  it('(b)/(d) HALAMAN HANYA BACA — INSERT/UPDATE/DELETE langsung dengan kunci anon (bukan service-role) DITOLAK RLS', async () => {
    anonSessionClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { error: signInError } = await anonSessionClient.auth.signInWithPassword({ email: 'admin.buildtaskstest@debug.mrp', password: roleTestPassword! });
    expect(signInError).toBeNull();

    const insertResult = await anonSessionClient.from('build_tasks').insert([
      { company_id: companyId, task_code: 'TST-99', name: 'Coba Tulis', module_code: 'TST', module_name: 'Modul Uji', description: 'x', effect_description: 'x', urgency: 'penting', tags: [], pic: 'Claude Code', status: 'menunggu', origin: 'temuan_claude', detail_pekerjaan: 'x' }
    ]);
    expect(insertResult.error).not.toBeNull();

    // Postgres RLS: UPDATE/DELETE tanpa policy yang mengizinkan tidak selalu
    // melempar error eksplisit -- perilaku sebenarnya adalah "0 baris cocok"
    // (silent no-op), BEDA dari INSERT yang melempar error WITH CHECK di atas.
    // Bukti sebenarnya bahwa RLS menolak: baris di database TIDAK BERUBAH
    // sama sekali setelah percobaan ini.
    const updateResult = await anonSessionClient.from('build_tasks').update({ status: 'selesai' }).eq('build_task_id', taskAId).select();
    expect(updateResult.data ?? []).toHaveLength(0);

    const deleteResult = await anonSessionClient.from('build_tasks').delete().eq('build_task_id', taskAId).select();
    expect(deleteResult.data ?? []).toHaveLength(0);

    // Baris asli TETAP utuh, tidak berubah oleh percobaan di atas.
    const { data: stillThere } = await adminClient.from('build_tasks').select('status').eq('build_task_id', taskAId).single();
    expect(stillThere!.status).toBe('menunggu');
  });
});

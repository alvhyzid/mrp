import type { SupabaseClient } from '@supabase/supabase-js';

// Seed struktur Fase 0-4 (docs/instruksi-dashboard-proyek-ai.md §3.4, bobot
// USULAN -- pemilik produk boleh ubah lewat UI). Idempoten (upsert by code).
//
// PENYIMPANGAN JUJUR dari spesifikasi §3.3 -- 4 dari 7 progress_key AUTO_QUERY
// TIDAK BISA dihitung dari data nyata saat ini (STOP CONDITION §7 dokumen:
// "laporkan dan usulkan menjadikannya CHECKLIST sementara -- jangan
// memalsukan angka"):
//   - provenance.komponen: butuh pemindaian kode otomatis, BELUM ADA.
//   - baseline.hari: tabel pencatatan KPI baseline harian BELUM DIBANGUN.
//   - processmining.pertanyaan: dashboard process mining (Bagian E antrean
//     ini) BELUM DIKERJAKAN.
//   - panel.uji: panel asal-usul GENERIK (Bagian D) BELUM DIBANGUN -- baru
//     ada 1 PROTOTIPE konkret (BOM standard_yield_basis_note/source).
// Keempatnya diseed sebagai CHECKLIST (bukan AUTO_QUERY) dengan item yang
// jujur mencerminkan status nyata -- termasuk MENCENTANG item yang SUDAH
// benar-benar selesai (mis. "Provenance dipasang di 1 komponen baru: BOM").
// HANYA kamus.p12/kamus.p3/kamus.metrik yang tetap AUTO_QUERY (kamus_terms
// sudah ada & terisi dari Bagian B sesi ini).
export async function seedAiProjectStructure(adminClient: SupabaseClient, companyId: number): Promise<{ phasesInserted: number; tasksInserted: number; totalTasks: number }> {
  const phases = [
    { code: 'fase0', name: 'Fase 0 — Fondasi', description: 'Menyiapkan tanah sebelum satu pun panggilan model LLM.', weight_percent: 25, sort_order: 0 },
    { code: 'fase1', name: 'Fase 1 — Keputusan & kontrak', description: 'Murni pekerjaan pemilik produk, tidak bisa dimulai Claude Code.', weight_percent: 10, sort_order: 1 },
    { code: 'fase2', name: 'Fase 2 — Infrastruktur AI', description: 'Mulai memakai model.', weight_percent: 25, sort_order: 2 },
    { code: 'fase3', name: 'Fase 3 — Fitur pengguna', description: 'Fitur berhadapan pengguna, murah & sulit ditiru lebih dulu.', weight_percent: 35, sort_order: 3 },
    { code: 'fase4', name: 'Fase 4 — Komersialisasi', description: 'Harga, materi jualan, kebijakan, uji keamanan eksternal.', weight_percent: 5, sort_order: 4 }
  ];

  const { data: insertedPhases, error: phaseError } = await adminClient
    .from('ai_project_phases')
    .upsert(
      phases.map((p) => ({ company_id: companyId, ...p })),
      { onConflict: 'company_id,code', ignoreDuplicates: true }
    )
    .select('ai_project_phase_id, code');
  if (phaseError) throw new Error(`Gagal seed ai_project_phases: ${phaseError.message}`);

  const { data: allPhases } = await adminClient.from('ai_project_phases').select('ai_project_phase_id, code').eq('company_id', companyId);
  const phaseIdByCode = new Map((allPhases ?? []).map((p) => [p.code, p.ai_project_phase_id]));

  type TaskSeed = {
    code: string;
    phaseCode: string;
    name: string;
    description: string;
    weight_percent: number;
    owner_type: string;
    suggested_role: string | null;
    progress_source: string;
    progress_key: string | null;
    action_type: string;
    action_target: string | null;
    sort_order: number;
    checklist?: { label: string; done?: boolean }[];
  };

  const tasks: TaskSeed[] = [
    // Fase 0 -- persis §3.4, kecuali 4 AUTO_QUERY yang direklasifikasi CHECKLIST (lihat catatan di atas file).
    { code: 'f0-kamus-p12', phaseCode: 'fase0', name: 'Kamus prioritas 1-2', description: 'Baris kamus_terms prioritas 1-2 berstatus DIKONFIRMASI.', weight_percent: 30, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'AUTO_QUERY', progress_key: 'kamus.p12', action_type: 'BUKA_KAMUS', action_target: 'priority=1,2', sort_order: 0 },
    { code: 'f0-kamus-metrik', phaseCode: 'fase0', name: 'Kamus metrik', description: 'Baris kamus_terms scope METRIC berstatus DIKONFIRMASI.', weight_percent: 10, owner_type: 'TIM', suggested_role: 'finance', progress_source: 'AUTO_QUERY', progress_key: 'kamus.metrik', action_type: 'BUKA_KAMUS', action_target: 'scope=METRIC', sort_order: 1 },
    { code: 'f0-kamus-p3', phaseCode: 'fase0', name: 'Kamus prioritas 3', description: 'Baris kamus_terms prioritas 3 berstatus DIKONFIRMASI.', weight_percent: 10, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'AUTO_QUERY', progress_key: 'kamus.p3', action_type: 'BUKA_KAMUS', action_target: 'priority=3', sort_order: 2 },
    {
      code: 'f0-provenance-komponen',
      phaseCode: 'fase0',
      name: 'Provenance di komponen',
      description: '[Direklasifikasi dari AUTO_QUERY ke CHECKLIST 21 Agu 2026 -- pemindaian kode otomatis belum ada, lihat catatan di atas file seeder.]',
      weight_percent: 15,
      owner_type: 'CLAUDE_CODE',
      suggested_role: null,
      progress_source: 'CHECKLIST',
      progress_key: null,
      action_type: 'BUKA_CHECKLIST',
      action_target: null,
      sort_order: 3,
      checklist: [
        { label: 'Audit komponen penampil angka yang sudah ada', done: true },
        { label: 'Tipe ProvenanceEnvelope generik dirancang (src/lib/provenance.ts)', done: true },
        { label: 'Implementasi + pasang di komponen BARU (BOM standard_yield_qty)', done: true },
        { label: 'Dipasang di Margin Watch (margin baseline + biaya SDM standar)', done: true },
        { label: 'Keputusan retrofit komponen lama: sekarang atau bertahap', done: false }
      ]
    },
    {
      code: 'f0-panel-asal-usul',
      phaseCode: 'fase0',
      name: 'Panel asal-usul',
      description: '[Direklasifikasi dari AUTO_QUERY ke CHECKLIST 21 Agu 2026. Tipe ProvenanceEnvelope + komponen ProvenanceInfoButton generik SUDAH dibangun (src/lib/provenance.ts, src/components/ui/provenance-info-button.tsx) -- checklist di bawah = target uji "20 angka lintas modul bisa dijelaskan" dari dokumen sumber.]',
      weight_percent: 15,
      owner_type: 'CLAUDE_CODE',
      suggested_role: null,
      progress_source: 'CHECKLIST',
      progress_key: null,
      action_type: 'BUKA_CHECKLIST',
      action_target: null,
      sort_order: 4,
      checklist: [
        { label: 'BOM: hasil standar per batch (standard_yield_qty)', done: true },
        { label: 'Margin Watch: margin rencana (baseline)', done: true },
        { label: 'Margin Watch: biaya SDM standar per unit', done: true },
        { label: 'Margin Watch: biaya bahan standar per unit', done: true },
        { label: 'Margin Watch: biaya kemasan standar per unit', done: true },
        { label: 'Margin Watch: selisih harga bahan/kemasan (Lapis 2)' },
        { label: 'Margin Watch: selisih pemakaian bahan (Lapis 2)' },
        { label: 'Margin Watch: selisih reject (Lapis 2)' },
        { label: 'K8: unit_per_batch (production_standards)', done: true },
        { label: 'K8: batches_per_day (production_standards)', done: true },
        { label: 'Kelayakan jadwal: kekurangan bahan per item', done: true },
        { label: 'Kelayakan jadwal: tanggal selesai proyeksi' },
        { label: 'BOM: biaya standar per komponen' },
        { label: 'Item: standard_cost' },
        { label: 'Laba Operasional: margin kontribusi bulanan' },
        { label: 'Laba Operasional: overhead SDM bulanan', done: true },
        { label: 'Work Order: kebutuhan bahan per batch (buffer_percentage)' },
        { label: 'Batch produksi: yield aktual vs rencana' },
        { label: 'Employee: biaya pemberi kerja per bulan (BPJS uplift)' },
        { label: 'Routing: kapasitas kerja/hari (work_centers)', done: true }
      ]
    },
    {
      code: 'f0-process-mining',
      phaseCode: 'fase0',
      name: 'Process mining',
      description: '[Direklasifikasi dari AUTO_QUERY ke CHECKLIST 21 Agu 2026 -- Bagian E antrean ini belum dikerjakan.]',
      weight_percent: 10,
      owner_type: 'CAMPURAN',
      suggested_role: null,
      progress_source: 'CHECKLIST',
      progress_key: null,
      action_type: 'BUKA_CHECKLIST',
      action_target: null,
      sort_order: 5,
      checklist: [{ label: 'Query & agregasi atas status_transition_log dibangun', done: false }, { label: '6 pertanyaan bisnis ditentukan', done: false }, { label: 'Dashboard hasil dibangun', done: false }]
    },
    {
      code: 'f0-kpi-baseline',
      phaseCode: 'fase0',
      name: 'KPI baseline',
      description: '[Direklasifikasi dari AUTO_QUERY ke CHECKLIST 21 Agu 2026 -- tabel pencatatan KPI harian belum dibangun.]',
      weight_percent: 10,
      owner_type: 'PEMILIK_PRODUK',
      suggested_role: null,
      progress_source: 'CHECKLIST',
      progress_key: null,
      action_type: 'BUKA_CHECKLIST',
      action_target: null,
      sort_order: 6,
      checklist: [{ label: 'KPI yang mewakili nilai bisnis dipilih pemilik produk', done: false }, { label: '14 hari pencatatan baseline terkumpul', done: false }]
    },

    // Fase 1 -- 100% pekerjaan pemilik produk (langkah-membangun-fitur-ai.md §Fase 1).
    { code: 'f1-pilih-model', phaseCode: 'fase1', name: 'Pilih penyedia model & buka akun', description: 'Pilih 2-3 kandidat, baca ketentuan data, tetapkan batas anggaran.', weight_percent: 20, owner_type: 'PEMILIK_PRODUK', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 0, checklist: [{ label: 'Akun 2-3 kandidat penyedia model dibuat' }, { label: 'Ketentuan data dibaca & disimpan' }, { label: 'Batas anggaran bulanan ditetapkan' }] },
    { code: 'f1-eval-questions', phaseCode: 'fase1', name: 'Susun 30-50 pertanyaan eval', description: 'Pertanyaan nyata + jawaban benar dari pemilik produk. Kalau AI menilai dirinya sendiri, eval tidak menguji apa pun.', weight_percent: 35, owner_type: 'PEMILIK_PRODUK', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 1, checklist: [{ label: 'Pertanyaan faktual disusun' }, { label: 'Pertanyaan asal-usul disusun' }, { label: 'Pertanyaan analitis disusun' }, { label: 'Pertanyaan prosedural disusun' }, { label: 'Pertanyaan jebakan (jawaban tidak ada di data) disusun' }, { label: 'Pertanyaan izin (harus gagal utk role tertentu) disusun' }] },
    { code: 'f1-kebijakan-data', phaseCode: 'fase1', name: 'Putuskan kebijakan data tenant', description: 'Opt-in/default, data apa yang boleh keluar ke penyedia model.', weight_percent: 20, owner_type: 'PEMILIK_PRODUK', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 2, checklist: [{ label: 'Opt-in vs default diputuskan' }, { label: 'Data yang boleh keluar ke penyedia model ditentukan' }] },
    { code: 'f1-kurasi-korpus', phaseCode: 'fase1', name: 'Kurasi Rak 2 (korpus otoritatif)', description: 'Regulasi BPOM/CPOB, SJPH, SOP internal, referensi manufaktur, ADR proyek -- bisa dimulai kapan saja.', weight_percent: 25, owner_type: 'PEMILIK_PRODUK', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 3, checklist: [{ label: 'Regulasi BPOM/CPOB relevan dikumpulkan' }, { label: 'Dokumen SJPH dikumpulkan' }, { label: 'SOP internal dikumpulkan' }] },

    // Fase 2.
    { code: 'f2-llm-client', phaseCode: 'fase2', name: 'llmClient (lapisan abstraksi penyedia)', description: 'Pencatatan token per tenant/fitur, timeout, retry, batas biaya, routing 2 model.', weight_percent: 20, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 0, checklist: [{ label: 'Antarmuka dirancang' }, { label: 'Implementasi + pencatatan token' }] },
    { code: 'f2-tools-mcp', phaseCode: 'fase2', name: 'Definisi tools + MCP', description: 'jelaskanAngka, cariStok, hitungFeasibility, analisisProses.', weight_percent: 20, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 1, checklist: [{ label: 'Daftar tools pertama ditentukan' }, { label: 'Skema input/output dirancang' }, { label: 'Implementasi + uji izin RLS user (bukan service_role)' }] },
    { code: 'f2-orchestrator', phaseCode: 'fase2', name: 'Orchestrator', description: 'Batas langkah, tool per peran, timeout, audit tiap langkah.', weight_percent: 20, owner_type: 'CLAUDE_CODE', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 2, checklist: [{ label: 'Pagar dirancang' }, { label: 'Implementasi + pencatatan audit' }] },
    { code: 'f2-harness-eval', phaseCode: 'fase2', name: 'Harness eval', description: 'Jalankan 30-50 soal (Fase 1) ke 2-3 penyedia, pilih pemenang.', weight_percent: 20, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 3, checklist: [{ label: 'Runner dibangun' }, { label: 'Dijalankan ke 2-3 kandidat penyedia' }, { label: 'Pemenang diputuskan' }] },
    { code: 'f2-konsol-tata-kelola', phaseCode: 'fase2', name: 'Konsol tata kelola agen', description: 'Daftar kemampuan, saklar per peran, riwayat usulan, batas anggaran token.', weight_percent: 20, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 4, checklist: [{ label: 'Kebijakan default ditentukan pemilik produk' }, { label: 'Implementasi konsol' }] },

    // Fase 3 -- 8 fitur, urutan sengaja: murah & sulit ditiru dulu.
    { code: 'f3-narasi-otomatis', phaseCode: 'fase3', name: 'Narasi & laporan otomatis', description: 'Briefing pagi, serah terima shift.', weight_percent: 15, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 0, checklist: [{ label: 'Template awal per peran disusun pemilik produk' }, { label: 'Implementasi' }, { label: 'Dinilai benar & berguna' }] },
    { code: 'f3-drop-ai-jelaskan', phaseCode: 'fase3', name: 'Drop-AI tahap JELASKAN (D3)', description: 'Uji jalan kaki, koreksi jawaban salah arti.', weight_percent: 13, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 1, checklist: [{ label: 'Implementasi' }, { label: 'Uji jalan kaki' }] },
    { code: 'f3-order-promising', phaseCode: 'fase3', name: 'Order promising menjelaskan diri (F1)', description: 'Validasi alasan & opsi masuk akal bisnis.', weight_percent: 12, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 2, checklist: [{ label: 'Implementasi' }, { label: 'Validasi bisnis' }] },
    { code: 'f3-copilot-alur-kerja', phaseCode: 'fase3', name: 'Copilot dalam alur kerja (F5)', description: 'Uji per peran, terutama uji izin.', weight_percent: 13, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 3, checklist: [{ label: 'Implementasi' }, { label: 'Uji izin per peran' }] },
    { code: 'f3-utas-pin', phaseCode: 'fase3', name: 'Utas pin kolaborasi (D2)', description: '', weight_percent: 10, owner_type: 'CLAUDE_CODE', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 4, checklist: [{ label: 'Implementasi' }] },
    { code: 'f3-anomaly-detection', phaseCode: 'fase3', name: 'Anomaly detection (F4)', description: 'Butuh >=2-3 bulan data.', weight_percent: 12, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 5, checklist: [{ label: 'Data historis cukup (>=2-3 bulan) terkumpul' }, { label: 'Implementasi' }, { label: 'Anomali nyata vs derau dinilai pemilik produk' }] },
    { code: 'f3-drop-ai-sarankan', phaseCode: 'fase3', name: 'Drop-AI SARANKAN (D4) + scenario planning (F6)', description: 'Paling rawan salah arah -- validasi rekomendasi.', weight_percent: 13, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 6, checklist: [{ label: 'Implementasi' }, { label: 'Validasi rekomendasi oleh pemilik produk' }] },
    { code: 'f3-agen-sempit', phaseCode: 'fase3', name: 'Agen sempit: parser PO, auditor cerewet (F7-F8)', description: 'Menyetujui/menolak usulan agen selama masa uji.', weight_percent: 12, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 7, checklist: [{ label: 'Implementasi' }, { label: 'Masa uji usulan agen' }] },

    // Fase 4.
    { code: 'f4-biaya-token', phaseCode: 'fase4', name: 'Hitung biaya token nyata per tenant/bulan', description: '', weight_percent: 20, owner_type: 'CLAUDE_CODE', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 0, checklist: [{ label: 'Data biaya token dihitung' }] },
    { code: 'f4-harga-tier', phaseCode: 'fase4', name: 'Tetapkan harga tier Insight & Copilot', description: '', weight_percent: 20, owner_type: 'PEMILIK_PRODUK', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 1, checklist: [{ label: 'Harga tier ditetapkan' }] },
    { code: 'f4-materi-jualan', phaseCode: 'fase4', name: 'Susun materi jualan (before/after pabrik sendiri)', description: '', weight_percent: 20, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 2, checklist: [{ label: 'Materi jualan disusun' }] },
    { code: 'f4-halaman-kebijakan', phaseCode: 'fase4', name: 'Halaman kebijakan AI utk calon tenant', description: 'Apa yang AI tidak boleh lakukan.', weight_percent: 20, owner_type: 'CAMPURAN', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 3, checklist: [{ label: 'Halaman kebijakan dibuat' }] },
    { code: 'f4-uji-keamanan', phaseCode: 'fase4', name: 'Uji keamanan eksternal', description: 'Sewa pihak ketiga sebelum tenant berbayar kedua.', weight_percent: 20, owner_type: 'PEMILIK_PRODUK', suggested_role: null, progress_source: 'CHECKLIST', progress_key: null, action_type: 'BUKA_CHECKLIST', action_target: null, sort_order: 4, checklist: [{ label: 'Pihak ketiga disewa & uji dilakukan' }] }
  ];

  const { data: insertedTasks, error: taskError } = await adminClient
    .from('ai_project_tasks')
    .upsert(
      tasks.map((t) => ({
        company_id: companyId,
        ai_project_phase_id: phaseIdByCode.get(t.phaseCode),
        code: t.code,
        name: t.name,
        description: t.description,
        weight_percent: t.weight_percent,
        owner_type: t.owner_type,
        suggested_role: t.suggested_role,
        progress_source: t.progress_source,
        progress_key: t.progress_key,
        action_type: t.action_type,
        action_target: t.action_target,
        sort_order: t.sort_order
      })),
      { onConflict: 'company_id,code', ignoreDuplicates: true }
    )
    .select('ai_project_task_id, code');
  if (taskError) throw new Error(`Gagal seed ai_project_tasks: ${taskError.message}`);

  const { data: allTasks } = await adminClient.from('ai_project_tasks').select('ai_project_task_id, code').eq('company_id', companyId);
  const taskIdByCode = new Map((allTasks ?? []).map((t) => [t.code, t.ai_project_task_id]));

  const checklistRows: Record<string, unknown>[] = [];
  for (const t of tasks) {
    if (!t.checklist) continue;
    const taskId = taskIdByCode.get(t.code);
    if (!taskId) continue;
    const { count } = await adminClient.from('ai_project_checklist_items').select('ai_project_checklist_item_id', { count: 'exact', head: true }).eq('ai_project_task_id', taskId);
    if (count && count > 0) continue; // idempoten -- sudah pernah diisi, jangan duplikat
    t.checklist.forEach((item, idx) => {
      checklistRows.push({ ai_project_task_id: taskId, label: item.label, done: item.done ?? false, sort_order: idx });
    });
  }
  if (checklistRows.length > 0) {
    const { error: checklistError } = await adminClient.from('ai_project_checklist_items').insert(checklistRows);
    if (checklistError) throw new Error(`Gagal seed ai_project_checklist_items: ${checklistError.message}`);
  }

  return {
    phasesInserted: insertedPhases?.length ?? 0,
    tasksInserted: insertedTasks?.length ?? 0,
    totalTasks: tasks.length
  };
}

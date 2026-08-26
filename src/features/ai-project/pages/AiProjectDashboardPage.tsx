'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Breadcrumb, BreadcrumbItem, Button, Checkbox, InlineNotification, SkeletonText, Tag, Tile } from '@carbon/react';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { formatNumberId } from '@/lib/currency';

type ChecklistItem = { ai_project_checklist_item_id: number; label: string; done: boolean };
type Task = {
  ai_project_task_id: number;
  ai_project_phase_id: number;
  name: string;
  weight_percent: number;
  owner_type: string;
  suggested_role: string | null;
  progress_source: string;
  progress_percent: number;
  progress_detail: string;
  contribution_to_total_if_complete: number;
  checklist_items: ChecklistItem[];
};
type Phase = { ai_project_phase_id: number; code: string; name: string; weight_percent: number; progress_percent: number; contribution_to_total: number };

const ownerLabels: Record<string, string> = { PEMILIK_PRODUK: 'Anda', TIM: 'Tim', CLAUDE_CODE: 'Claude Code', CAMPURAN: 'Campuran' };

export default function AiProjectDashboardPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [overallPercent, setOverallPercent] = useState(0);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [actionable, setActionable] = useState<Task[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<{ overall_percent: number; taken_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadDashboard = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setLoading(true);
    const response = await fetch('/api/ai-project', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Gagal memuat dashboard.');
      setLoading(false);
      return;
    }
    setOverallPercent(data.overall_percent);
    setPhases(data.phases);
    setTasks(data.tasks);
    setActionable(data.actionable_now);
    setLatestSnapshot(data.latest_snapshot);
    setError('');
    setLoading(false);
  }, [getAccessToken]);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/ai-project');
        return;
      }
      await loadDashboard();
      setCheckingAccess(false);
    };
    checkAccessAndLoad();
  }, [router, loadDashboard]);

  const handleSeed = async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setStatus('Menjalankan seed...');
    const response = await fetch('/api/ai-project/seed', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || 'Gagal seed.');
      setAccessDenied(response.status === 403);
      return;
    }
    setStatus(`Selesai. ${data.phasesInserted} fase + ${data.tasksInserted} tugas baru (total ${data.totalTasks} tugas).`);
    await loadDashboard();
  };

  const handleSnapshot = async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const response = await fetch('/api/ai-project/snapshot', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (response.ok) {
      setStatus(`Snapshot tersimpan: ${formatNumberId(data.overall_percent, 1)}%.`);
      await loadDashboard();
    }
  };

  const handleToggleChecklist = async (itemId: number, currentDone: boolean) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    await fetch(`/api/ai-project/checklist-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ done: !currentDone })
    });
    await loadDashboard();
  };

  if (checkingAccess) {
    return (
      <div className="halaman">
        <SkeletonText heading width="18rem" />
        <SkeletonText paragraph lineCount={4} />
      </div>
    );
  }

  const ditolak = accessDenied || error === 'Dashboard Proyek AI khusus company_admin atau general_manager (tim inti).';
  if (ditolak) {
    return (
      <div className="halaman">
        <h1 className="halaman__judul">Dashboard proyek AI</h1>
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="Halaman internal ini khusus pimpinan perusahaan"
          subtitle="Akun Anda tidak punya izin membukanya."
        />
      </div>
    );
  }

  return (
    <div className="halaman">
      <Breadcrumb noTrailingSlash className="halaman__remah">
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <span className="cds--link halaman__remah-mati">AI</span>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>AI Project</BreadcrumbItem>
      </Breadcrumb>

      <div>
        <h1 className="halaman__judul">Dashboard proyek AI</h1>
        <p className="halaman__pengantar">
          Progres dihitung berjenjang dari data nyata — tugas ke fase, fase ke total — bukan diisi tangan.
        </p>
      </div>

      {phases.length === 0 && !loading ? (
        <div className="proyek-kosong">
          <InlineNotification kind="info" lowContrast hideCloseButton title="Struktur fase & tugas belum dibuat" />
          <Button size="sm" kind="tertiary" onClick={handleSeed}>
            Buat struktur fase 0–4
          </Button>
        </div>
      ) : (
        <>
          <Tile className="proyek-total">
            <span className="metrik__label proyek-label">
              Progres total proyek AI
              <ProvenanceInfoButton
                label="Progres Total Proyek AI"
                envelope={{
                  formula:
                    'Σ (progres % tiap fase × bobot fase ÷ 100). Progres per fase sendiri = Σ (progres % tiap tugas × bobot tugas ÷ 100). Berjenjang: tugas → fase → total, masing-masing tertimbang.',
                  inputs: phases.map((p) => ({
                    label: p.name,
                    value: `${formatNumberId(p.progress_percent, 1)}% × bobot ${formatNumberId(p.weight_percent, 2)}%`
                  })),
                  sourceDocument: 'computeAiProjectProgress.ts'
                }}
              />
            </span>
            <span className="proyek-angka-besar">{formatNumberId(overallPercent, 1)}%</span>
            {latestSnapshot ? (
              <span className="halaman__redup">
                Snapshot terakhir: {formatNumberId(latestSnapshot.overall_percent, 1)}% (
                {new Date(latestSnapshot.taken_at).toLocaleDateString('id-ID')})
              </span>
            ) : null}
            <div className="proyek-aksi">
              <Button size="sm" kind="tertiary" onClick={handleSeed}>
                Buat ulang struktur (aman diulang)
              </Button>
              {/* PEMICU SNAPSHOT yang terlihat. Penyimpanannya sengaja TIDAK menumpang
                  pemuatan halaman — riwayat yang lahir dari kunjungan halaman merekam
                  kebiasaan menjelajah, bukan bagaimana angkanya bergerak. */}
              <Button size="sm" kind="tertiary" onClick={handleSnapshot}>
                Rekam angka hari ini
              </Button>
            </div>
            {status ? <span className="halaman__redup">{status}</span> : null}
          </Tile>

          <div className="kisi-metrik proyek-fase">
            {phases.map((phase) => (
              <Tile key={phase.ai_project_phase_id}>
                <span className="metrik__label proyek-label">
                  {phase.name}
                  <ProvenanceInfoButton
                    label={phase.name}
                    envelope={{
                      formula:
                        'Σ (progres % tiap tugas di fase ini × bobot tugas ÷ 100). Kontribusinya ke total proyek = progres fase ini × bobot fase ini ÷ 100.',
                      inputs: [
                        { label: 'Progres fase', value: `${formatNumberId(phase.progress_percent, 1)}%` },
                        { label: 'Bobot fase', value: `${formatNumberId(phase.weight_percent, 2)}%` },
                        { label: 'Kontribusi ke total', value: `${formatNumberId(phase.contribution_to_total, 2)}%` }
                      ]
                    }}
                  />
                </span>
                <span className="metrik__angka">{formatNumberId(phase.progress_percent, 0)}%</span>
                <span className="halaman__redup">Bobot {formatNumberId(phase.weight_percent, 2)}% dari total</span>
              </Tile>
            ))}
          </div>

          <Tile className="proyek-kartu">
            <h2 className="halaman__subjudul">Bisa dikerjakan sekarang, dampak terbesar di atas</h2>
            <div className="proyek-daftar">
              {actionable.map((task) => (
                <div key={task.ai_project_task_id} className="proyek-baris">
                  <div className="proyek-baris__atas">
                    <span className="proyek-baris__judul">{task.name}</span>
                    <Tag type="cool-gray">{ownerLabels[task.owner_type] ?? task.owner_type}</Tag>
                  </div>
                  <span className="proyek-baris__rincian">
                    {formatNumberId(task.progress_percent, 0)}% selesai · {task.progress_detail} · +
                    {formatNumberId(task.contribution_to_total_if_complete, 2)}% total bila selesai
                    <ProvenanceInfoButton
                      label="Dampak per Menit"
                      envelope={{
                        formula:
                          'Kontribusi bila selesai = (100 − progres% tugas ini) × bobot tugas% × bobot fase% ÷ 10000 — yaitu SISA potensi kenaikan progres total kalau tugas ini dituntaskan sekarang. Daftar ini diurutkan dari kontribusi terbesar (proksi "dampak per menit", BUKAN estimasi waktu literal — sistem belum punya data durasi tugas nyata).',
                        inputs: [
                          { label: 'Progres tugas saat ini', value: `${formatNumberId(task.progress_percent, 1)}%` },
                          { label: 'Bobot tugas (dalam fase)', value: `${formatNumberId(task.weight_percent, 2)}%` }
                        ],
                        sourceDocument: 'getAiProjectDashboard.ts'
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </Tile>

          {tasks.map((task) => (
            <Tile key={task.ai_project_task_id} className="proyek-kartu">
              <div className="proyek-baris__atas">
                <h2 className="proyek-tugas__judul">{task.name}</h2>
                <div className="proyek-tugas__kanan">
                  <Tag type="cool-gray">{ownerLabels[task.owner_type] ?? task.owner_type}</Tag>
                  <Tag type={task.progress_percent >= 100 ? 'green' : 'gray'}>
                    {formatNumberId(task.progress_percent, 0)}%
                  </Tag>
                  <ProvenanceInfoButton
                    label={`Progres — ${task.name}`}
                    envelope={{
                      formula:
                        task.progress_source === 'AUTO_QUERY'
                          ? 'Dihitung LIVE dari query data nyata (progress_key terkait) — bukan diisi manual.'
                          : 'Dihitung dari checklist: jumlah item tercentang ÷ total item checklist × 100%.',
                      inputs: [
                        { label: 'Sumber progres', value: task.progress_source },
                        { label: 'Detail', value: task.progress_detail }
                      ]
                    }}
                  />
                </div>
              </div>
              <p className="halaman__redup">
                {task.progress_detail} · bobot {formatNumberId(task.weight_percent, 2)}% fase · +
                {formatNumberId(task.contribution_to_total_if_complete, 2)}% total bila selesai
              </p>
              {task.checklist_items.length > 0 ? (
                <div className="proyek-centang">
                  {task.checklist_items.map((item) => (
                    <Checkbox
                      key={item.ai_project_checklist_item_id}
                      id={`centang-${item.ai_project_checklist_item_id}`}
                      labelText={item.label}
                      checked={item.done}
                      onChange={() => handleToggleChecklist(item.ai_project_checklist_item_id, item.done)}
                    />
                  ))}
                </div>
              ) : null}
            </Tile>
          ))}
        </>
      )}

      {error && !ditolak ? (
        <InlineNotification kind="error" lowContrast title="Gagal" subtitle={error} hideCloseButton />
      ) : null}
    </div>
  );
}

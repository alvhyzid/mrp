'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
      setStatus(`Snapshot tersimpan: ${data.overall_percent.toFixed(1)}%.`);
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
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="px-6 text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  if (accessDenied || error === 'Dashboard Proyek AI khusus company_admin atau general_manager (tim inti).') {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="max-w-3xl px-6">
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em] text-destructive">Akses Ditolak</CardDescription>
              <CardTitle className="text-2xl">Dashboard Proyek AI</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Halaman internal ini khusus company_admin atau general_manager.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="flex w-full flex-col gap-6 px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Internal — Tim Inti</p>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard Proyek AI</h1>
        </div>

        {phases.length === 0 && !loading ? (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <p className="text-sm text-muted-foreground">Struktur fase & tugas belum di-seed.</p>
              <Button size="sm" className="w-fit" onClick={handleSeed}>
                Seed Struktur Fase 0-4
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-col gap-2 pt-6">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Progres Total Proyek AI</span>
                <span className="text-4xl font-semibold text-foreground">{overallPercent.toFixed(1)}%</span>
                {latestSnapshot ? (
                  <span className="text-xs text-muted-foreground">
                    Snapshot terakhir: {latestSnapshot.overall_percent.toFixed(1)}% ({new Date(latestSnapshot.taken_at).toLocaleDateString('id-ID')})
                  </span>
                ) : null}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleSeed}>
                    Seed Ulang (idempoten)
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleSnapshot}>
                    Ambil Snapshot Sekarang
                  </Button>
                </div>
                {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-5">
              {phases.map((phase) => (
                <Card key={phase.ai_project_phase_id}>
                  <CardContent className="flex flex-col gap-1 pt-6">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{phase.name}</span>
                    <span className="text-xl font-semibold text-foreground">{phase.progress_percent.toFixed(0)}%</span>
                    <span className="text-xs text-muted-foreground">Bobot {phase.weight_percent}% dari total</span>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardDescription className="uppercase tracking-[0.2em]">Prioritas</CardDescription>
                <CardTitle className="text-lg">Bisa Dikerjakan Sekarang (dampak per menit)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {actionable.map((task) => (
                  <div key={task.ai_project_task_id} className="rounded-md border p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{task.name}</span>
                      <Badge variant="secondary">{ownerLabels[task.owner_type] ?? task.owner_type}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {task.progress_percent.toFixed(0)}% selesai · {task.progress_detail} · +{task.contribution_to_total_if_complete.toFixed(2)}% total bila selesai
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              {tasks.map((task) => (
                <Card key={task.ai_project_task_id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">{task.name}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{ownerLabels[task.owner_type] ?? task.owner_type}</Badge>
                        <Badge variant={task.progress_percent >= 100 ? 'success' : 'secondary'}>{task.progress_percent.toFixed(0)}%</Badge>
                      </div>
                    </div>
                    <CardDescription>
                      {task.progress_detail} · bobot {task.weight_percent}% fase · +{task.contribution_to_total_if_complete.toFixed(2)}% total bila selesai
                    </CardDescription>
                  </CardHeader>
                  {task.checklist_items.length > 0 ? (
                    <CardContent className="flex flex-col gap-1">
                      {task.checklist_items.map((item) => (
                        <label key={item.ai_project_checklist_item_id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={item.done} onChange={() => handleToggleChecklist(item.ai_project_checklist_item_id, item.done)} />
                          <span className={item.done ? 'text-muted-foreground line-through' : ''}>{item.label}</span>
                        </label>
                      ))}
                    </CardContent>
                  ) : null}
                </Card>
              ))}
            </div>
          </>
        )}

        {error && error !== 'Dashboard Proyek AI khusus company_admin atau general_manager (tim inti).' ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </main>
  );
}

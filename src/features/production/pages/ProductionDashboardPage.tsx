'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { canAccessProductionDashboard } from '@/lib/roles';

const statusLabels: Record<string, string> = { planned: 'Direncanakan', in_progress: 'Berjalan', paused: 'Dijeda', completed: 'Selesai', cancelled: 'Batal' };
const statusBadgeVariant: Record<string, 'info' | 'warning' | 'success' | 'critical' | 'secondary'> = {
  planned: 'info',
  in_progress: 'warning',
  paused: 'secondary',
  completed: 'success',
  cancelled: 'critical'
};
const readinessLabels: Record<string, string> = { ready: 'Siap Mulai', blocked: 'Terhambat' };
const readinessBadgeVariant: Record<string, 'success' | 'critical'> = { ready: 'success', blocked: 'critical' };
const stepStatusLabels: Record<string, string> = { pending: 'Belum Mulai', in_progress: 'Berjalan', completed: 'Selesai' };
const stepStatuses = ['pending', 'in_progress', 'completed'];

type WorkOrder = { work_order_id: number; item_code: string | null; item_name: string | null; item_base_uom: string | null; routing_id: number | null; planned_qty: number; status: string; readiness: string; open_alert_count: number; so_number: string | null };
type RoutingStep = { routing_step_id: number; sequence_no: number; step_name: string; active_duration_minutes: number; wait_duration_minutes: number };
type StepProgress = { work_order_step_progress_id: number; production_batch_id: number | null; routing_step_id: number; status: string; qty_recorded: number | null; uom: string | null; started_at: string | null; completed_at: string | null };
type ProductionBatch = { production_batch_id: number; batch_number: string; planned_qty: number; uom: string; status: string };

const batchStatusLabels: Record<string, string> = { planned: 'Direncanakan', in_progress: 'Berjalan', completed: 'Selesai', cancelled: 'Batal' };
const batchStatusBadgeVariant: Record<string, 'info' | 'warning' | 'success' | 'critical'> = { planned: 'info', in_progress: 'warning', completed: 'success', cancelled: 'critical' };

export default function ProductionDashboardPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [woError, setWoError] = useState('');
  const [woLoading, setWoLoading] = useState(true);

  const [expandedWoId, setExpandedWoId] = useState<number | null>(null);
  const [routingSteps, setRoutingSteps] = useState<RoutingStep[]>([]);
  const [stepProgress, setStepProgress] = useState<StepProgress[]>([]);
  const [stepForm, setStepForm] = useState<Record<number, { status: string; qty_recorded: string }>>({});
  const [stepMessage, setStepMessage] = useState<Record<number, string>>({});
  const [batchesForExpanded, setBatchesForExpanded] = useState<ProductionBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const authedFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Sesi tidak valid.');
      const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) } });
      return { ok: response.ok, body: await response.json() };
    },
    [getAccessToken]
  );

  const loadWorkOrders = useCallback(async () => {
    setWoLoading(true);
    const { ok, body } = await authedFetch('/api/work-orders');
    if (!ok) {
      setWoError(body.error || 'Gagal memuat Work Order.');
      setWoLoading(false);
      return;
    }
    setWorkOrders(body.workOrders || []);
    setWoError('');
    setWoLoading(false);
  }, [authedFetch]);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/production');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      if (!meResponse.ok || !canAccessProductionDashboard(meData?.user?.role)) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }
      setCheckingAccess(false);
      await loadWorkOrders();
    };
    checkAccessAndLoad();
  }, [router, loadWorkOrders]);

  const toggleExpand = async (wo: WorkOrder) => {
    if (expandedWoId === wo.work_order_id) {
      setExpandedWoId(null);
      return;
    }
    setExpandedWoId(wo.work_order_id);
    setSelectedBatchId('');
    setStepProgress([]);
    const [stepsRes, batchesRes] = await Promise.all([
      wo.routing_id ? authedFetch(`/api/routing-steps?routing_id=${wo.routing_id}`) : Promise.resolve({ ok: true, body: { routingSteps: [] } }),
      authedFetch(`/api/production-batches?work_order_id=${wo.work_order_id}`)
    ]);
    setRoutingSteps(stepsRes.ok ? stepsRes.body.routingSteps || [] : []);
    setBatchesForExpanded(batchesRes.ok ? batchesRes.body.batches || [] : []);
  };

  const handleSelectBatch = async (batchId: string) => {
    setSelectedBatchId(batchId);
    if (!expandedWoId || !batchId) {
      setStepProgress([]);
      return;
    }
    const progressRes = await authedFetch(`/api/work-order-step-progress?work_order_id=${expandedWoId}&production_batch_id=${batchId}`);
    setStepProgress(progressRes.ok ? progressRes.body.stepProgress || [] : []);
  };

  const handleSaveStep = async (wo: WorkOrder, step: RoutingStep) => {
    if (!selectedBatchId) {
      setStepMessage((prev) => ({ ...prev, [step.routing_step_id]: 'Pilih batch produksi dulu.' }));
      return;
    }
    const entry = stepForm[step.routing_step_id];
    if (!entry?.status) {
      setStepMessage((prev) => ({ ...prev, [step.routing_step_id]: 'Pilih status dulu.' }));
      return;
    }
    const { ok, body } = await authedFetch('/api/work-order-step-progress', {
      method: 'POST',
      body: JSON.stringify({
        work_order_id: wo.work_order_id,
        production_batch_id: Number(selectedBatchId),
        routing_step_id: step.routing_step_id,
        status: entry.status,
        qty_recorded: entry.qty_recorded || null
      })
    });
    if (!ok) {
      setStepMessage((prev) => ({ ...prev, [step.routing_step_id]: body.error || 'Gagal menyimpan progres.' }));
      return;
    }
    setStepMessage((prev) => ({ ...prev, [step.routing_step_id]: 'Tersimpan.' }));
    const progressRes = await authedFetch(`/api/work-order-step-progress?work_order_id=${wo.work_order_id}&production_batch_id=${selectedBatchId}`);
    if (progressRes.ok) setStepProgress(progressRes.body.stepProgress || []);
  };

  const columns = useMemo<ColumnDef<WorkOrder>[]>(
    () => [
      { id: 'item', header: 'Item', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.item_code}</span> },
      { id: 'so', header: 'SO', cell: ({ row }) => row.original.so_number ?? '-' },
      { id: 'qty', header: 'Planned Qty', cell: ({ row }) => `${row.original.planned_qty} ${row.original.item_base_uom ?? ''}` },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={statusBadgeVariant[row.original.status] ?? 'secondary'}>{statusLabels[row.original.status] ?? row.original.status}</Badge> },
      {
        id: 'readiness',
        header: 'Kesiapan',
        cell: ({ row }) =>
          readinessLabels[row.original.readiness] ? (
            <Badge variant={readinessBadgeVariant[row.original.readiness]}>
              {readinessLabels[row.original.readiness]}
              {row.original.open_alert_count > 0 ? ` (${row.original.open_alert_count})` : ''}
            </Badge>
          ) : (
            '-'
          )
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => toggleExpand(row.original)}>
            {expandedWoId === row.original.work_order_id ? 'Tutup' : 'Catat Progres'}
          </Button>
        )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedWoId]
  );

  const expandedWo = workOrders.find((wo) => wo.work_order_id === expandedWoId) ?? null;

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="container max-w-5xl text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="container max-w-3xl">
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em] text-destructive">Akses Ditolak</CardDescription>
              <CardTitle className="text-2xl">Dashboard Produksi</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Halaman ini khusus company_admin, general_manager, production_manager, atau production_staff.</p>
              <Button onClick={() => router.push('/dashboard')} className="w-fit">
                Kembali ke Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="container flex max-w-5xl flex-col gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Dashboard Department</p>
          <h1 className="text-2xl font-semibold text-foreground">Production</h1>
        </div>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Produksi</CardDescription>
            <CardTitle className="text-xl">Work Order</CardTitle>
          </CardHeader>
          <CardContent>
            {woError ? <p className="text-sm text-destructive">{woError}</p> : null}
            {woLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : <DataTable columns={columns} data={workOrders} emptyMessage="Belum ada Work Order." />}
          </CardContent>
        </Card>

        {expandedWo ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Progres Tahap</CardDescription>
              <CardTitle className="text-xl">
                {expandedWo.item_code} — {expandedWo.planned_qty} {expandedWo.item_base_uom}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <label className="mb-3 flex max-w-xs flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Batch Produksi</span>
                <Select value={selectedBatchId} onValueChange={handleSelectBatch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih batch..." />
                  </SelectTrigger>
                  <SelectContent>
                    {batchesForExpanded.map((batch) => (
                      <SelectItem key={batch.production_batch_id} value={String(batch.production_batch_id)}>
                        {batch.batch_number} ({batch.planned_qty} {batch.uom}) — {batchStatusLabels[batch.status] ?? batch.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              {batchesForExpanded.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada batch untuk Work Order ini — buat batch dulu di halaman Work Order sebelum mencatat progres tahap.</p>
              ) : !selectedBatchId ? (
                <p className="text-sm text-muted-foreground">Pilih batch produksi dulu di atas — tiap batch bisa berada di tahap berbeda, jadi progres dicatat per batch.</p>
              ) : !expandedWo.routing_id ? (
                <p className="text-sm text-muted-foreground">Work Order ini belum punya routing (urutan tahap produksi), jadi progres tahap belum bisa dicatat.</p>
              ) : routingSteps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Routing untuk item ini belum punya tahap.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {(() => {
                    const selectedBatch = batchesForExpanded.find((b) => String(b.production_batch_id) === selectedBatchId);
                    return selectedBatch ? (
                      <p className="text-xs text-muted-foreground">
                        Mencatat progres untuk batch <span className="font-medium text-foreground">{selectedBatch.batch_number}</span> ({selectedBatch.planned_qty} {selectedBatch.uom})
                      </p>
                    ) : null;
                  })()}
                  {routingSteps.map((step) => {
                    const existing = stepProgress.find((p) => p.routing_step_id === step.routing_step_id);
                    const entry = stepForm[step.routing_step_id] ?? { status: existing?.status ?? 'pending', qty_recorded: existing?.qty_recorded !== null && existing?.qty_recorded !== undefined ? String(existing.qty_recorded) : '' };
                    return (
                      <div key={step.routing_step_id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">
                            {step.sequence_no}. {step.step_name}
                          </p>
                          {existing ? <Badge variant={existing.status === 'completed' ? 'success' : existing.status === 'in_progress' ? 'warning' : 'secondary'}>{stepStatusLabels[existing.status]}</Badge> : null}
                        </div>
                        <p className="mb-2 text-xs text-muted-foreground">
                          Durasi aktif {step.active_duration_minutes} menit, tunggu {step.wait_duration_minutes} menit
                        </p>
                        <div className="grid grid-cols-[160px_140px_auto] items-end gap-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">Status</span>
                            <Select value={entry.status} onValueChange={(value) => setStepForm((prev) => ({ ...prev, [step.routing_step_id]: { ...entry, status: value } }))}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {stepStatuses.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {stepStatusLabels[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">Jumlah Tercatat</span>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={entry.qty_recorded}
                              onChange={(event) => setStepForm((prev) => ({ ...prev, [step.routing_step_id]: { ...entry, qty_recorded: event.target.value } }))}
                            />
                          </label>
                          <Button size="sm" onClick={() => handleSaveStep(expandedWo, step)}>
                            Simpan
                          </Button>
                        </div>
                        {stepMessage[step.routing_step_id] ? <p className="mt-1 text-xs text-muted-foreground">{stepMessage[step.routing_step_id]}</p> : null}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-3">
                <Link href="/work-orders" className="text-sm text-muted-foreground underline">
                  Buka halaman Work Order lengkap (termasuk catat pemakaian bahan)
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

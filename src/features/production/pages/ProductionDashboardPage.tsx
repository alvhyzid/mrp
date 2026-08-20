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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { canAccessProductionDashboard, canManageProductionDisruptions, canRecordStepProgress } from '@/lib/roles';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { formatNumberId } from '@/lib/currency';

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
const outputTypeLabels: Record<string, string> = { main_output: 'Produk Utama', reprocessable_waste: 'Sisa Bisa Diproses Ulang', disposed_waste: 'Sisa Dibuang' };
const stepStatuses = ['pending', 'in_progress', 'completed'];

type WorkOrder = { work_order_id: number; item_code: string | null; item_name: string | null; item_base_uom: string | null; routing_id: number | null; planned_qty: number; status: string; readiness: string; open_alert_count: number; so_number: string | null; total_output_qty: number };
type RoutingStep = { routing_step_id: number; sequence_no: number; step_name: string; active_duration_minutes: number; wait_duration_minutes: number };
type StepProgress = { work_order_step_progress_id: number; production_batch_id: number | null; routing_step_id: number; status: string; qty_recorded: number | null; uom: string | null; started_at: string | null; completed_at: string | null };
type ProductionBatch = { production_batch_id: number; batch_number: string; planned_qty: number; uom: string; status: string };

const batchStatusLabels: Record<string, string> = { planned: 'Direncanakan', in_progress: 'Berjalan', completed: 'Selesai', cancelled: 'Batal' };
const batchStatusBadgeVariant: Record<string, 'info' | 'warning' | 'success' | 'critical'> = { planned: 'info', in_progress: 'warning', completed: 'success', cancelled: 'critical' };

const disruptionTypeLabels: Record<string, string> = { equipment_breakdown: 'Mesin Rusak', utility_outage: 'Listrik/Utilitas Padam', external_factor: 'Faktor Eksternal', reprioritized: 'Dialihkan ke Pekerjaan Lain', changeover: 'Ganti Produk (Changeover)', other: 'Lainnya' };
type ProductionPlant = { production_plant_id: number; name: string };
type TodayBatch = {
  production_batch_id: number;
  batch_number: string;
  planned_qty: number;
  uom: string;
  status: string;
  planned_date: string | null;
  work_order_id: number;
  routing_id: number | null;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  production_plant_id: number | null;
  production_plant_name: string | null;
};
type WorkCenterOption = { work_center_id: number; name: string; code: string | null; production_plant_id: number };
type Disruption = {
  production_disruption_id: number;
  disruption_type: string;
  production_plant_id: number;
  production_plant_name: string | null;
  work_center_id: number | null;
  work_center_name: string | null;
  work_order_id: number | null;
  work_order_item_code: string | null;
  started_at: string;
  resolved_at: string | null;
  description: string | null;
};

function formatDateTimeShort(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ProductionDashboardPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const [plants, setPlants] = useState<ProductionPlant[]>([]);
  const [workCenterOptions, setWorkCenterOptions] = useState<WorkCenterOption[]>([]);
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [disruptionsLoading, setDisruptionsLoading] = useState(true);
  const [disruptionsError, setDisruptionsError] = useState('');
  const emptyDisruptionForm = { disruption_type: 'equipment_breakdown', production_plant_id: '', work_center_id: '', description: '' };
  const [disruptionForm, setDisruptionForm] = useState(emptyDisruptionForm);
  const [disruptionFormStatus, setDisruptionFormStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [disruptionFormMessage, setDisruptionFormMessage] = useState('');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  // FASE 3 (Carbon "DataTable with toolbar") — form "Catat Gangguan" pindah ke modal
  // toolbar; daftar gangguan (sebelumnya list <div> manual) dikonversi ke DataTable
  // sejalan dengan konversi serupa di PurchasingPage. handleCreateDisruption TIDAK
  // diubah, cuma tambah penutupan modal saat sukses.
  const [isDisruptionModalOpen, setIsDisruptionModalOpen] = useState(false);

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [woError, setWoError] = useState('');
  const [woLoading, setWoLoading] = useState(true);

  const [expandedWoId, setExpandedWoId] = useState<number | null>(null);
  const [routingSteps, setRoutingSteps] = useState<RoutingStep[]>([]);
  const [stepProgress, setStepProgress] = useState<StepProgress[]>([]);
  const [stepForm, setStepForm] = useState<Record<number, { status: string; qty_recorded: string; record_date: string; qty_reject: string }>>({});
  const [stepMessage, setStepMessage] = useState<Record<number, string>>({});
  const [batchesForExpanded, setBatchesForExpanded] = useState<ProductionBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [batchTransitionBusyId, setBatchTransitionBusyId] = useState<number | null>(null);
  const [batchTransitionMessage, setBatchTransitionMessage] = useState('');
  const [reworkBatchIds, setReworkBatchIds] = useState<Set<number>>(new Set());

  const [todaysBatches, setTodaysBatches] = useState<TodayBatch[]>([]);
  const [todaysBatchesLoading, setTodaysBatchesLoading] = useState(true);
  const [todaysBatchesError, setTodaysBatchesError] = useState('');
  const [myPlantId, setMyPlantId] = useState<number | null>(null);

  const emptyOutputLine = { qty: '', output_type: 'main_output', lot_number: '', expiry_date: '' };
  const [outputLines, setOutputLines] = useState([{ ...emptyOutputLine }]);
  const [outputStatus, setOutputStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [outputMessage, setOutputMessage] = useState('');

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

  const loadDisruptions = useCallback(async () => {
    setDisruptionsLoading(true);
    const { ok, body } = await authedFetch('/api/production-disruptions');
    if (!ok) {
      setDisruptionsError(body.error || 'Gagal memuat gangguan produksi.');
      setDisruptionsLoading(false);
      return;
    }
    setDisruptions(body.disruptions || []);
    setDisruptionsError('');
    setDisruptionsLoading(false);
  }, [authedFetch]);

  // "Jadwal Hari Ini" (Fase Produksi Nyata P3) — daftar batch dijadwalkan hari
  // ini ATAU sudah berjalan, di-filter ke plant milik user (kalau ter-link ke
  // employee) supaya operator Karanglo tidak melihat batch Ruko Dieng.
  const loadTodaysBatches = useCallback(async () => {
    setTodaysBatchesLoading(true);
    const { ok, body } = await authedFetch('/api/production-batches/today');
    if (!ok) {
      setTodaysBatchesError(body.error || 'Gagal memuat jadwal hari ini.');
      setTodaysBatchesLoading(false);
      return;
    }
    setTodaysBatches(body.batches || []);
    setMyPlantId(body.my_plant_id ?? null);
    setTodaysBatchesError('');
    setTodaysBatchesLoading(false);
  }, [authedFetch]);

  const loadPlantsAndWorkCenters = useCallback(async () => {
    const [plantsRes, wcRes] = await Promise.all([authedFetch('/api/production-plants'), authedFetch('/api/work-centers')]);
    if (plantsRes.ok) setPlants(plantsRes.body.plants || []);
    if (wcRes.ok) setWorkCenterOptions(wcRes.body.workCenters || []);
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
      setRole(meData?.user?.role ?? null);
      setCheckingAccess(false);
      await Promise.all([loadWorkOrders(), loadDisruptions(), loadPlantsAndWorkCenters(), loadTodaysBatches()]);
    };
    checkAccessAndLoad();
  }, [router, loadWorkOrders, loadDisruptions, loadPlantsAndWorkCenters, loadTodaysBatches]);

  const handleCreateDisruption = async () => {
    if (!disruptionForm.production_plant_id) {
      setDisruptionFormStatus('error');
      setDisruptionFormMessage('Lokasi pabrik wajib dipilih.');
      return;
    }
    setDisruptionFormStatus('saving');
    setDisruptionFormMessage('');
    const { ok, body } = await authedFetch('/api/production-disruptions', {
      method: 'POST',
      body: JSON.stringify({
        disruption_type: disruptionForm.disruption_type,
        production_plant_id: Number(disruptionForm.production_plant_id),
        work_center_id: disruptionForm.work_center_id ? Number(disruptionForm.work_center_id) : null,
        description: disruptionForm.description || null
      })
    });
    if (!ok) {
      setDisruptionFormStatus('error');
      setDisruptionFormMessage(body.error || 'Gagal mencatat gangguan.');
      return;
    }
    setDisruptionFormStatus('idle');
    setDisruptionFormMessage('');
    setDisruptionForm(emptyDisruptionForm);
    setIsDisruptionModalOpen(false);
    await Promise.all([loadDisruptions(), loadWorkOrders()]);
  };

  const handleResolveDisruption = async (id: number) => {
    setResolvingId(id);
    const { ok, body } = await authedFetch('/api/production-disruptions', { method: 'PATCH', body: JSON.stringify({ production_disruption_id: id }) });
    setResolvingId(null);
    if (!ok) {
      setDisruptionsError(body.error || 'Gagal menandai gangguan selesai.');
      return;
    }
    await Promise.all([loadDisruptions(), loadWorkOrders()]);
  };

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

  const reloadBatchesForExpanded = useCallback(async () => {
    if (!expandedWoId) return;
    const batchesRes = await authedFetch(`/api/production-batches?work_order_id=${expandedWoId}`);
    setBatchesForExpanded(batchesRes.ok ? batchesRes.body.batches || [] : []);
  }, [authedFetch, expandedWoId]);

  // "Mulai Batch"/"Selesaikan Batch" (Fase Produksi Nyata P1) — state machine
  // yang SUDAH ADA (status_transition_rules + trigger enforce_status_transition),
  // bukan langkah baru yang dibuat di sini. Menyelesaikan batch otomatis
  // mengajukannya sebagai sampel K8 (server yang urus, lihat completeProductionBatch.ts) —
  // hasilnya (diajukan / dikecualikan karena log belum lengkap) ditampilkan supaya
  // operator/SPV tahu, bukan cuma "berhasil" generik.
  const handleStartBatch = async (batchId: number) => {
    setBatchTransitionBusyId(batchId);
    setBatchTransitionMessage('');
    const { ok, body } = await authedFetch('/api/production-batches/start', { method: 'POST', body: JSON.stringify({ production_batch_id: batchId }) });
    setBatchTransitionBusyId(null);
    if (!ok) {
      setBatchTransitionMessage(body.error || 'Gagal memulai batch.');
      return;
    }
    setBatchTransitionMessage('Batch ditandai Berjalan.');
    await Promise.all([reloadBatchesForExpanded(), loadWorkOrders(), loadTodaysBatches()]);
  };

  const handleCompleteBatch = async (batchId: number) => {
    setBatchTransitionBusyId(batchId);
    setBatchTransitionMessage('');
    const { ok, body } = await authedFetch('/api/production-batches/complete', { method: 'POST', body: JSON.stringify({ production_batch_id: batchId, rework: reworkBatchIds.has(batchId) }) });
    setBatchTransitionBusyId(null);
    if (!ok) {
      setBatchTransitionMessage(body.error || 'Gagal menyelesaikan batch.');
      return;
    }
    const k8Sample = body.k8_sample as { excluded?: boolean; samples_submitted?: unknown[] } | undefined;
    if (k8Sample?.excluded) {
      setBatchTransitionMessage('Batch ditandai Selesai. TAPI log tahapnya belum lengkap — TIDAK dijadikan sampel standar K8 (tercatat sebagai pengecualian).');
    } else if (k8Sample?.samples_submitted?.length) {
      setBatchTransitionMessage(`Batch ditandai Selesai. ${k8Sample.samples_submitted.length} sampel standar produksi (K8) berhasil diajukan.`);
    } else {
      setBatchTransitionMessage('Batch ditandai Selesai.');
    }
    await Promise.all([reloadBatchesForExpanded(), loadWorkOrders(), loadTodaysBatches()]);
  };

  // Buka batch langsung dari kartu "Jadwal Hari Ini" -- expand WO yang sama +
  // pilih batch-nya, supaya operator tidak perlu cari sendiri di tabel Work Order.
  const handleOpenFromToday = async (batch: TodayBatch) => {
    setExpandedWoId(batch.work_order_id);
    setSelectedBatchId('');
    setStepProgress([]);
    const [stepsRes, batchesRes] = await Promise.all([
      batch.routing_id ? authedFetch(`/api/routing-steps?routing_id=${batch.routing_id}`) : Promise.resolve({ ok: true, body: { routingSteps: [] } }),
      authedFetch(`/api/production-batches?work_order_id=${batch.work_order_id}`)
    ]);
    setRoutingSteps(stepsRes.ok ? stepsRes.body.routingSteps || [] : []);
    setBatchesForExpanded(batchesRes.ok ? batchesRes.body.batches || [] : []);
    await handleSelectBatch(String(batch.production_batch_id));
  };

  const handleSelectBatch = async (batchId: string) => {
    setSelectedBatchId(batchId);
    setOutputLines([{ ...emptyOutputLine }]);
    setOutputStatus('idle');
    setOutputMessage('');
    if (!expandedWoId || !batchId) {
      setStepProgress([]);
      return;
    }
    const progressRes = await authedFetch(`/api/work-order-step-progress?work_order_id=${expandedWoId}&production_batch_id=${batchId}`);
    setStepProgress(progressRes.ok ? progressRes.body.stepProgress || [] : []);
  };

  const addOutputLine = () => setOutputLines((prev) => [...prev, { ...emptyOutputLine }]);
  const removeOutputLine = (index: number) => setOutputLines((prev) => prev.filter((_, i) => i !== index));
  const updateOutputLine = (index: number, field: keyof typeof emptyOutputLine, value: string) =>
    setOutputLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));

  const handleRecordOutput = async (wo: WorkOrder) => {
    if (!selectedBatchId) return;
    const payloadLines = outputLines.filter((l) => l.qty && Number(l.qty) > 0);
    if (payloadLines.length === 0) {
      setOutputStatus('error');
      setOutputMessage('Jumlah hasil produksi harus lebih besar dari 0 di minimal 1 baris.');
      return;
    }
    setOutputStatus('saving');
    setOutputMessage('');
    const { ok, body } = await authedFetch('/api/work-order-outputs', {
      method: 'POST',
      body: JSON.stringify({
        work_order_id: wo.work_order_id,
        production_batch_id: Number(selectedBatchId),
        outputs: payloadLines.map((l) => ({ qty: Number(l.qty), output_type: l.output_type, lot_number: l.lot_number || null, expiry_date: l.expiry_date || null }))
      })
    });
    if (!ok) {
      setOutputStatus('error');
      setOutputMessage(body.error || 'Gagal mencatat hasil produksi.');
      return;
    }
    setOutputStatus('success');
    const outputsCreated = body.outputs as { lot_number: string; qty: number; output_type: string; genealogy_rows_created: number }[];
    setOutputMessage(
      outputsCreated
        .map((o) => `Lot "${o.lot_number}" (${outputTypeLabels[o.output_type] ?? o.output_type}, ${formatNumberId(o.qty, 2)} ${wo.item_base_uom ?? ''}) — genealogy dari ${formatNumberId(o.genealogy_rows_created, 0)} lot bahan.`)
        .join(' ')
    );
    setOutputLines([{ ...emptyOutputLine }]);
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
        qty_recorded: entry.qty_recorded || null,
        record_date: entry.record_date || undefined,
        qty_reject: entry.qty_reject || null
      })
    });
    if (!ok) {
      setStepMessage((prev) => ({ ...prev, [step.routing_step_id]: body.error || 'Gagal menyimpan progres.' }));
      return;
    }
    setStepMessage((prev) => ({ ...prev, [step.routing_step_id]: body.warning ? `Tersimpan. ${body.warning}` : 'Tersimpan.' }));
    const progressRes = await authedFetch(`/api/work-order-step-progress?work_order_id=${wo.work_order_id}&production_batch_id=${selectedBatchId}`);
    if (progressRes.ok) setStepProgress(progressRes.body.stepProgress || []);
  };

  const columns = useMemo<ColumnDef<WorkOrder>[]>(
    () => [
      { id: 'item', header: 'Item', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.item_code}</span> },
      { id: 'so', header: 'SO', cell: ({ row }) => row.original.so_number ?? '-' },
      { id: 'qty', header: 'Planned Qty', cell: ({ row }) => `${formatNumberId(row.original.planned_qty, 2)} ${row.original.item_base_uom ?? ''}` },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={statusBadgeVariant[row.original.status] ?? 'secondary'}>{statusLabels[row.original.status] ?? row.original.status}</Badge> },
      {
        id: 'readiness',
        header: 'Kesiapan',
        cell: ({ row }) =>
          readinessLabels[row.original.readiness] ? (
            <Badge variant={readinessBadgeVariant[row.original.readiness]}>
              {readinessLabels[row.original.readiness]}
              {row.original.open_alert_count > 0 ? ` (${formatNumberId(row.original.open_alert_count, 0)})` : ''}
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

  const disruptionColumns = useMemo<ColumnDef<Disruption>[]>(
    () => [
      { id: 'type', header: 'Jenis', cell: ({ row }) => <span className="font-medium text-foreground">{disruptionTypeLabels[row.original.disruption_type] ?? row.original.disruption_type}</span> },
      {
        id: 'scope',
        header: 'Cakupan',
        cell: ({ row }) => (
          <Badge variant={row.original.work_center_id ? 'warning' : 'critical'}>{row.original.work_center_id ? (row.original.work_center_name ?? 'Work Center') : 'Menyeluruh 1 Plant'}</Badge>
        )
      },
      { id: 'plant', header: 'Lokasi', cell: ({ row }) => row.original.production_plant_name ?? '-' },
      { id: 'started_at', header: 'Mulai', cell: ({ row }) => formatDateTimeShort(row.original.started_at) },
      {
        id: 'context',
        header: 'Keterangan',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.work_order_item_code ? `WO ${row.original.work_order_item_code}` : ''}
            {row.original.work_order_item_code && row.original.description ? ' · ' : ''}
            {row.original.description ?? ''}
          </span>
        )
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) =>
          canManageProductionDisruptions(role) ? (
            <Button size="sm" variant="outline" disabled={resolvingId === row.original.production_disruption_id} onClick={() => handleResolveDisruption(row.original.production_disruption_id)}>
              {resolvingId === row.original.production_disruption_id ? '...' : 'Tandai Selesai'}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, resolvingId]
  );

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="px-6 text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="max-w-3xl px-6">
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
      <div className="flex w-full flex-col gap-6 px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Dashboard Department</p>
          <h1 className="text-2xl font-semibold text-foreground">Production</h1>
        </div>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Produksi</CardDescription>
            <CardTitle className="text-xl">Jadwal Hari Ini{myPlantId === null ? '' : ' — Plant Saya'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Batch yang dijadwalkan hari ini atau sudah berjalan — bukan Gantt penuh, cukup daftar yang bisa langsung ditindaklanjuti.</p>
            {todaysBatchesError ? <p className="text-sm text-destructive">{todaysBatchesError}</p> : null}
            {todaysBatchesLoading ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : todaysBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada batch dijadwalkan hari ini{myPlantId !== null ? ' di plant Anda' : ''}.</p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-data">
                  <thead>
                    <tr className="border-b">
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Batch</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Qty</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Plant</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaysBatches.map((b) => (
                      <tr key={b.production_batch_id} className="border-b last:border-0">
                        <td className="px-3 py-1.5 font-medium text-foreground">{b.batch_number}</td>
                        <td className="px-3 py-1.5">
                          {b.item_code} — {b.item_name}
                        </td>
                        <td className="px-3 py-1.5">
                          {formatNumberId(b.planned_qty, 2)} {b.uom}
                        </td>
                        <td className="px-3 py-1.5">{b.production_plant_name ?? '-'}</td>
                        <td className="px-3 py-1.5">
                          <Badge variant={batchStatusBadgeVariant[b.status] ?? 'secondary'}>{batchStatusLabels[b.status] ?? b.status}</Badge>
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex gap-2">
                            {canRecordStepProgress(role) && b.status === 'planned' ? (
                              <Button size="sm" disabled={batchTransitionBusyId === b.production_batch_id} onClick={() => handleStartBatch(b.production_batch_id)}>
                                {batchTransitionBusyId === b.production_batch_id ? '...' : 'Mulai'}
                              </Button>
                            ) : null}
                            {canRecordStepProgress(role) && b.status === 'in_progress' ? (
                              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={reworkBatchIds.has(b.production_batch_id)}
                                  onChange={(e) =>
                                    setReworkBatchIds((prev) => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(b.production_batch_id);
                                      else next.delete(b.production_batch_id);
                                      return next;
                                    })
                                  }
                                />
                                Rework
                              </label>
                            ) : null}
                            {canRecordStepProgress(role) && b.status === 'in_progress' ? (
                              <Button size="sm" disabled={batchTransitionBusyId === b.production_batch_id} onClick={() => handleCompleteBatch(b.production_batch_id)}>
                                {batchTransitionBusyId === b.production_batch_id ? '...' : 'Selesaikan'}
                              </Button>
                            ) : null}
                            <Button size="sm" variant="outline" onClick={() => handleOpenFromToday(b)}>
                              Catat Tahap
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {batchTransitionMessage ? <p className="text-sm text-muted-foreground">{batchTransitionMessage}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Produksi</CardDescription>
            <CardTitle className="text-xl">Gangguan Produksi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Kosongkan &quot;Work Center&quot; untuk gangguan MENYELURUH 1 lokasi pabrik (mis. listrik padam se-pabrik) — semua Work Order aktif di lokasi itu otomatis ter-flag &quot;Terhambat&quot;, dan otomatis kembali &quot;Siap&quot;/&quot;Berjalan&quot; begitu ditandai selesai.
            </p>

            {disruptionsError ? <p className="text-sm text-destructive">{disruptionsError}</p> : null}
            {disruptionsLoading ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : (
              <DataTable
                columns={disruptionColumns}
                data={disruptions}
                emptyMessage="Tidak ada gangguan produksi yang sedang terbuka."
                primaryAction={canManageProductionDisruptions(role) ? { label: 'Catat Gangguan', onClick: () => setIsDisruptionModalOpen(true) } : undefined}
              />
            )}
          </CardContent>
        </Card>

        <Dialog open={isDisruptionModalOpen} onOpenChange={setIsDisruptionModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Catat Gangguan Produksi</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Jenis Gangguan</label>
                <Select value={disruptionForm.disruption_type} onValueChange={(v) => setDisruptionForm((prev) => ({ ...prev, disruption_type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(disruptionTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Lokasi Pabrik</label>
                <Select value={disruptionForm.production_plant_id} onValueChange={(v) => setDisruptionForm((prev) => ({ ...prev, production_plant_id: v, work_center_id: '' }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih lokasi..." />
                  </SelectTrigger>
                  <SelectContent>
                    {plants.map((p) => (
                      <SelectItem key={p.production_plant_id} value={String(p.production_plant_id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Work Center (opsional)</label>
                <Select value={disruptionForm.work_center_id || '__none__'} onValueChange={(v) => setDisruptionForm((prev) => ({ ...prev, work_center_id: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="(Menyeluruh)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(Menyeluruh — semua Work Center)</SelectItem>
                    {workCenterOptions
                      .filter((wc) => !disruptionForm.production_plant_id || String(wc.production_plant_id) === disruptionForm.production_plant_id)
                      .map((wc) => (
                        <SelectItem key={wc.work_center_id} value={String(wc.work_center_id)}>
                          {wc.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Keterangan (opsional)</label>
                <Input value={disruptionForm.description} onChange={(e) => setDisruptionForm((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
            </div>
            {disruptionFormMessage ? <p className="text-sm text-destructive">{disruptionFormMessage}</p> : null}
            <div className="flex items-center gap-3">
              <Button disabled={disruptionFormStatus === 'saving'} onClick={handleCreateDisruption}>
                {disruptionFormStatus === 'saving' ? 'Menyimpan...' : 'Catat Gangguan'}
              </Button>
              <Button variant="outline" onClick={() => setIsDisruptionModalOpen(false)}>
                Batal
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
                {expandedWo.item_code} — {formatNumberId(expandedWo.planned_qty, 2)} {expandedWo.item_base_uom}
              </CardTitle>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                Yield aktual vs rencana: <span className="font-medium text-foreground">{formatNumberId(expandedWo.total_output_qty, 2)}</span> / {formatNumberId(expandedWo.planned_qty, 2)} {expandedWo.item_base_uom}
                {expandedWo.planned_qty > 0 ? ` (${Math.round((expandedWo.total_output_qty / expandedWo.planned_qty) * 10000) / 100}%)` : ''}
                <ProvenanceInfoButton
                  label="Yield Aktual vs Rencana"
                  envelope={{
                    formula:
                      'Aktual = Σ qty di work_order_outputs untuk Work Order ini dengan output_type=main_output (SEMUA batch, akumulatif — belum tentu WO ini sudah selesai). Rencana = planned_qty Work Order. Persentase = aktual ÷ rencana × 100. Hasil produksi TIDAK PERNAH diasumsikan sama dengan rencana (prinsip inti sistem ini) — angka ini mencatat selisihnya apa adanya.',
                    inputs: [
                      { label: 'Rencana (planned_qty)', value: `${formatNumberId(expandedWo.planned_qty, 2)} ${expandedWo.item_base_uom ?? ''}` },
                      { label: 'Aktual (Σ work_order_outputs main_output)', value: `${formatNumberId(expandedWo.total_output_qty, 2)} ${expandedWo.item_base_uom ?? ''}` }
                    ]
                  }}
                />
              </p>
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
                        {batch.batch_number} ({formatNumberId(batch.planned_qty, 2)} {batch.uom}) — {batchStatusLabels[batch.status] ?? batch.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              {selectedBatchId && canRecordStepProgress(role)
                ? (() => {
                    const selectedBatch = batchesForExpanded.find((b) => String(b.production_batch_id) === selectedBatchId);
                    if (!selectedBatch) return null;
                    const batchId = selectedBatch.production_batch_id;
                    return (
                      <div className="mb-3 flex items-center gap-2 rounded-md border p-2">
                        <span className="text-xs text-muted-foreground">Status batch:</span>
                        <Badge variant={batchStatusBadgeVariant[selectedBatch.status] ?? 'secondary'}>{batchStatusLabels[selectedBatch.status] ?? selectedBatch.status}</Badge>
                        {selectedBatch.status === 'planned' ? (
                          <Button size="sm" disabled={batchTransitionBusyId === batchId} onClick={() => handleStartBatch(batchId)}>
                            {batchTransitionBusyId === batchId ? 'Memproses...' : 'Mulai Batch'}
                          </Button>
                        ) : selectedBatch.status === 'in_progress' ? (
                          <>
                            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={reworkBatchIds.has(batchId)}
                                onChange={(e) =>
                                  setReworkBatchIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(batchId);
                                    else next.delete(batchId);
                                    return next;
                                  })
                                }
                              />
                              Rework
                            </label>
                            <Button size="sm" disabled={batchTransitionBusyId === batchId} onClick={() => handleCompleteBatch(batchId)}>
                              {batchTransitionBusyId === batchId ? 'Memproses...' : 'Selesaikan Batch'}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    );
                  })()
                : null}
              {batchTransitionMessage ? <p className="mb-3 text-sm text-muted-foreground">{batchTransitionMessage}</p> : null}

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
                        Mencatat progres untuk batch <span className="font-medium text-foreground">{selectedBatch.batch_number}</span> ({formatNumberId(selectedBatch.planned_qty, 2)} {selectedBatch.uom})
                      </p>
                    ) : null;
                  })()}
                  {routingSteps.map((step) => {
                    const existing = stepProgress.find((p) => p.routing_step_id === step.routing_step_id);
                    const entry = stepForm[step.routing_step_id] ?? {
                      status: existing?.status ?? 'pending',
                      qty_recorded: existing?.qty_recorded !== null && existing?.qty_recorded !== undefined ? String(existing.qty_recorded) : '',
                      record_date: new Date().toISOString().slice(0, 10),
                      qty_reject: ''
                    };
                    return (
                      <div key={step.routing_step_id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">
                            {step.sequence_no}. {step.step_name}
                          </p>
                          {existing ? <Badge variant={existing.status === 'completed' ? 'success' : existing.status === 'in_progress' ? 'warning' : 'secondary'}>{stepStatusLabels[existing.status]}</Badge> : null}
                        </div>
                        <p className="mb-2 text-xs text-muted-foreground">
                          Durasi aktif {formatNumberId(step.active_duration_minutes, 2)} menit, tunggu {formatNumberId(step.wait_duration_minutes, 2)} menit
                        </p>
                        <div className="grid grid-cols-[160px_140px_140px_140px_auto] items-end gap-2">
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
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">Tanggal Kejadian</span>
                            <Input
                              type="date"
                              value={entry.record_date}
                              onChange={(event) => setStepForm((prev) => ({ ...prev, [step.routing_step_id]: { ...entry, record_date: event.target.value } }))}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">Reject (opsional)</span>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={entry.qty_reject}
                              onChange={(event) => setStepForm((prev) => ({ ...prev, [step.routing_step_id]: { ...entry, qty_reject: event.target.value } }))}
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
              {selectedBatchId ? (
                <div className="mt-4 border-t pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Catat Hasil Produksi (Output)</p>
                    <Button size="sm" variant="outline" onClick={addOutputLine}>
                      + Tambah Baris Output
                    </Button>
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Bisa lebih dari 1 baris sekaligus (mis. produk utama + sisa reprocessable) — semua baris dari batch yang sama mewarisi genealogy yang sama, dari lot bahan yang tercatat dipakai (Catat Pemakaian Bahan di halaman Work Order).
                  </p>
                  <div className="flex flex-col gap-2">
                    {outputLines.map((line, index) => (
                      <div key={index} className="grid grid-cols-2 gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">Jumlah Hasil ({expandedWo.item_base_uom})</span>
                          <Input type="number" min="0" step="any" value={line.qty} onChange={(e) => updateOutputLine(index, 'qty', e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">Jenis Output</span>
                          <Select value={line.output_type} onValueChange={(v) => updateOutputLine(index, 'output_type', v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(outputTypeLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">Nomor Lot (opsional)</span>
                          <Input value={line.lot_number} onChange={(e) => updateOutputLine(index, 'lot_number', e.target.value)} placeholder="auto kalau kosong" />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">Tanggal Kadaluarsa (opsional)</span>
                          <Input type="date" value={line.expiry_date} onChange={(e) => updateOutputLine(index, 'expiry_date', e.target.value)} />
                        </label>
                        <Button size="sm" variant="destructive" disabled={outputLines.length === 1} onClick={() => removeOutputLine(index)}>
                          Hapus
                        </Button>
                      </div>
                    ))}
                  </div>
                  {outputMessage ? <p className={`mt-2 text-sm ${outputStatus === 'error' ? 'text-destructive' : 'text-success'}`}>{outputMessage}</p> : null}
                  <Button size="sm" className="mt-2" disabled={outputStatus === 'saving'} onClick={() => handleRecordOutput(expandedWo)}>
                    {outputStatus === 'saving' ? 'Menyimpan...' : 'Catat Hasil Produksi'}
                  </Button>
                </div>
              ) : null}

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

'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import {
  Button,
  Checkbox,
  ComposedModal,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NumberInput,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandHeader,
  TableExpandRow,
  TableExpandedRow,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  TextInput
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { canAccessProductionDashboard, canManageProductionDisruptions, canRecordStepProgress } from '@/lib/roles';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { formatNumberId } from '@/lib/currency';

const statusLabels: Record<string, string> = { planned: 'Direncanakan', in_progress: 'Berjalan', paused: 'Dijeda', completed: 'Selesai', cancelled: 'Batal' };
/// Warna Tag mengikuti ARTI. "Berjalan" ungu, bukan kuning: pekerjaan yang sedang jalan
/// bukan peringatan. Hanya "dibatalkan" dan "terhambat" yang merah.
const statusWarnaTag: Record<string, 'blue' | 'purple' | 'gray' | 'green' | 'red'> = {
  planned: 'blue',
  in_progress: 'purple',
  paused: 'gray',
  completed: 'green',
  cancelled: 'red'
};
const readinessLabels: Record<string, string> = { ready: 'Siap mulai', blocked: 'Terhambat' };
const readinessWarnaTag: Record<string, 'green' | 'red'> = { ready: 'green', blocked: 'red' };
const stepStatusWarnaTag: Record<string, 'gray' | 'purple' | 'green'> = { pending: 'gray', in_progress: 'purple', completed: 'green' };
const stepStatusLabels: Record<string, string> = { pending: 'Belum mulai', in_progress: 'Berjalan', completed: 'Selesai' };
const outputTypeLabels: Record<string, string> = { main_output: 'Produk utama', reprocessable_waste: 'Sisa bisa diproses ulang', disposed_waste: 'Sisa dibuang' };
const stepStatuses = ['pending', 'in_progress', 'completed'];

type WorkOrder = { work_order_id: number; item_code: string | null; item_name: string | null; item_base_uom: string | null; routing_id: number | null; planned_qty: number; status: string; readiness: string; open_alert_count: number; kekurangan_bahan?: boolean; so_number: string | null; total_output_qty: number };
type RoutingStep = { routing_step_id: number; sequence_no: number; step_name: string; active_duration_minutes: number; wait_duration_minutes: number };
type StepProgress = { work_order_step_progress_id: number; production_batch_id: number | null; routing_step_id: number; status: string; qty_recorded: number | null; uom: string | null; started_at: string | null; completed_at: string | null };
type ProductionBatch = { production_batch_id: number; batch_number: string; planned_qty: number; uom: string; status: string };

const batchStatusLabels: Record<string, string> = { planned: 'Direncanakan', in_progress: 'Berjalan', completed: 'Selesai', cancelled: 'Batal' };
const batchStatusWarnaTag: Record<string, 'blue' | 'purple' | 'green' | 'red'> = { planned: 'blue', in_progress: 'purple', completed: 'green', cancelled: 'red' };

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

  // Pencarian, saringan, dan pembagian halaman: Carbon DataTable tidak membawanya.
  const [cari, setCari] = useState('');
  const [saringStatus, setSaringStatus] = useState<string>('semua');
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(15);
  const adaSaringan = cari.trim() !== '' || saringStatus !== 'semua';

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


  // ==========================================================================
  // TABEL WORK ORDER — cetakan Master Item
  // ==========================================================================
  const kolomWo = [
    { key: 'item', header: 'Item' },
    { key: 'so', header: 'SO' },
    { key: 'qty', header: 'Qty rencana' },
    { key: 'status', header: 'Status' },
    { key: 'readiness', header: 'Kesiapan' }
  ];

  const woTersaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return workOrders.filter((wo) => {
      if (saringStatus !== 'semua' && wo.status !== saringStatus) return false;
      if (!kata) return true;
      return `${wo.item_code ?? ''} ${wo.so_number ?? ''}`.toLowerCase().includes(kata);
    });
  }, [workOrders, cari, saringStatus]);

  const woHalamanIni = useMemo(() => woTersaring.slice((halaman - 1) * perHalaman, halaman * perHalaman), [woTersaring, halaman, perHalaman]);
  const woById = useMemo(() => new Map(workOrders.map((wo) => [String(wo.work_order_id), wo])), [workOrders]);

  const barisWo = useMemo(
    () =>
      woHalamanIni.map((wo) => ({
        id: String(wo.work_order_id),
        item: wo.item_code ?? '',
        so: wo.so_number ?? '',
        qty: wo.planned_qty,
        status: statusLabels[wo.status] ?? wo.status,
        readiness: readinessLabels[wo.readiness] ?? ''
      })),
    [woHalamanIni]
  );

  const isiSelWo = (wo: WorkOrder, kunci: string) => {
    switch (kunci) {
      case 'item':
        return wo.item_code;
      case 'so':
        return wo.so_number ?? <span className="halaman__redup">—</span>;
      case 'qty':
        return `${formatNumberId(wo.planned_qty, 2)} ${wo.item_base_uom ?? ''}`;
      case 'status':
        return <Tag type={statusWarnaTag[wo.status] ?? 'gray'}>{statusLabels[wo.status] ?? wo.status}</Tag>;
      case 'readiness':
        return readinessLabels[wo.readiness] ? (
          <Tag type={readinessWarnaTag[wo.readiness] ?? 'gray'}>
            {readinessLabels[wo.readiness]}
            {wo.open_alert_count > 0 ? ` (${formatNumberId(wo.open_alert_count, 0)})` : ''}
          </Tag>
        ) : (
          <span className="halaman__redup">—</span>
        );
      default:
        return null;
    }
  };

  const expandedWo = workOrders.find((wo) => wo.work_order_id === expandedWoId) ?? null;

  // ==========================================================================
  // PANEL PROGRES TAHAP (isi baris Work Order yang dimekarkan)
  // ==========================================================================
  const renderProgresWo = (wo: WorkOrder) => {
    const selectedBatch = batchesForExpanded.find((b) => String(b.production_batch_id) === selectedBatchId);
    return (
      <div className="produksi-progres">
        <p className="halaman__redup">
          Yield aktual vs rencana: {formatNumberId(wo.total_output_qty, 2)} / {formatNumberId(wo.planned_qty, 2)} {wo.item_base_uom}
          {wo.planned_qty > 0 ? ` (${Math.round((wo.total_output_qty / wo.planned_qty) * 10000) / 100}%)` : ''}
          <ProvenanceInfoButton
            label="Yield aktual vs rencana"
            envelope={{
              formula:
                'Aktual = Σ qty di work_order_outputs untuk Work Order ini dengan output_type=main_output (SEMUA batch, akumulatif — belum tentu WO ini sudah selesai). Rencana = planned_qty Work Order. Persentase = aktual ÷ rencana × 100. Hasil produksi TIDAK PERNAH diasumsikan sama dengan rencana (prinsip inti sistem ini) — angka ini mencatat selisihnya apa adanya.',
              inputs: [
                { label: 'Rencana (planned_qty)', value: `${formatNumberId(wo.planned_qty, 2)} ${wo.item_base_uom ?? ''}` },
                { label: 'Aktual (Σ work_order_outputs main_output)', value: `${formatNumberId(wo.total_output_qty, 2)} ${wo.item_base_uom ?? ''}` }
              ]
            }}
          />
        </p>

        <Dropdown
          id={`produksi-batch-${wo.work_order_id}`}
          size="lg"
          className="halaman__saring"
          titleText="Batch produksi"
          label="Pilih batch..."
          items={batchesForExpanded}
          itemToString={(b: any) => (b ? `${b.batch_number} (${formatNumberId(b.planned_qty, 2)} ${b.uom}) — ${batchStatusLabels[b.status] ?? b.status}` : '')}
          selectedItem={batchesForExpanded.find((b) => String(b.production_batch_id) === selectedBatchId) ?? null}
          onChange={({ selectedItem }: { selectedItem: any }) => handleSelectBatch(selectedItem ? String(selectedItem.production_batch_id) : '')}
        />

        {selectedBatch && canRecordStepProgress(role) ? (
          <div className="produksi-batch-aksi">
            <span className="halaman__redup">Status batch:</span>
            <Tag type={batchStatusWarnaTag[selectedBatch.status] ?? 'gray'}>{batchStatusLabels[selectedBatch.status] ?? selectedBatch.status}</Tag>
            {selectedBatch.status === 'planned' ? (
              <Button size="sm" disabled={batchTransitionBusyId === selectedBatch.production_batch_id} onClick={() => handleStartBatch(selectedBatch.production_batch_id)}>
                {batchTransitionBusyId === selectedBatch.production_batch_id ? 'Memproses...' : 'Mulai batch'}
              </Button>
            ) : null}
            {selectedBatch.status === 'in_progress' ? (
              <>
                <Checkbox
                  id={`produksi-rework-${selectedBatch.production_batch_id}`}
                  labelText="Rework"
                  checked={reworkBatchIds.has(selectedBatch.production_batch_id)}
                  onChange={(_e: unknown, { checked }: { checked: boolean }) =>
                    setReworkBatchIds((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(selectedBatch.production_batch_id);
                      else next.delete(selectedBatch.production_batch_id);
                      return next;
                    })
                  }
                />
                <Button size="sm" disabled={batchTransitionBusyId === selectedBatch.production_batch_id} onClick={() => handleCompleteBatch(selectedBatch.production_batch_id)}>
                  {batchTransitionBusyId === selectedBatch.production_batch_id ? 'Memproses...' : 'Selesaikan batch'}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {batchTransitionMessage ? <InlineNotification kind="info" lowContrast hideCloseButton title="Status batch" subtitle={batchTransitionMessage} /> : null}

        {batchesForExpanded.length === 0 ? (
          <p className="halaman__redup">Belum ada batch untuk Work Order ini — buat batch dulu di halaman Work Order sebelum mencatat progres tahap.</p>
        ) : !selectedBatchId ? (
          <p className="halaman__redup">Pilih batch produksi dulu di atas — tiap batch bisa berada di tahap berbeda, jadi progres dicatat per batch.</p>
        ) : !wo.routing_id ? (
          <p className="halaman__redup">Work Order ini belum punya routing (urutan tahap produksi), jadi progres tahap belum bisa dicatat.</p>
        ) : routingSteps.length === 0 ? (
          <p className="halaman__redup">Routing untuk item ini belum punya tahap.</p>
        ) : (
          <>
            {selectedBatch ? (
              <p className="halaman__redup">
                Mencatat progres untuk batch {selectedBatch.batch_number} ({formatNumberId(selectedBatch.planned_qty, 2)} {selectedBatch.uom})
              </p>
            ) : null}
            {routingSteps.map((step) => {
              const existing = stepProgress.find((p) => p.routing_step_id === step.routing_step_id);
              const entry = stepForm[step.routing_step_id] ?? {
                status: existing?.status ?? 'pending',
                qty_recorded: existing?.qty_recorded !== null && existing?.qty_recorded !== undefined ? String(existing.qty_recorded) : '',
                record_date: new Date().toISOString().slice(0, 10),
                qty_reject: ''
              };
              const warnaTahap = existing ? stepStatusWarnaTag[existing.status] ?? 'gray' : 'gray';
              return (
                <div key={step.routing_step_id} className="produksi-tahap">
                  <div className="produksi-tahap__kepala">
                    <span className="produksi-tahap__nama">
                      {step.sequence_no}. {step.step_name}
                    </span>
                    {existing ? <Tag type={warnaTahap}>{stepStatusLabels[existing.status]}</Tag> : null}
                  </div>
                  <p className="halaman__redup">
                    Durasi aktif {formatNumberId(step.active_duration_minutes, 2)} menit, tunggu {formatNumberId(step.wait_duration_minutes, 2)} menit
                  </p>
                  <div className="produksi-tahap__isi">
                    <Dropdown
                      id={`produksi-status-${step.routing_step_id}`}
                      size="lg"
                      titleText="Status"
                      label="Pilih status"
                      items={stepStatuses as unknown as string[]}
                      itemToString={(v: string) => stepStatusLabels[v] ?? v}
                      selectedItem={entry.status}
                      onChange={({ selectedItem }: { selectedItem: string | null }) =>
                        setStepForm((prev) => ({ ...prev, [step.routing_step_id]: { ...entry, status: selectedItem ?? 'pending' } }))
                      }
                    />
                    <NumberInput
                      id={`produksi-qty-${step.routing_step_id}`}
                      label="Jumlah tercatat"
                      min={0}
                      allowEmpty
                      hideSteppers
                      value={entry.qty_recorded === '' ? '' : Number(entry.qty_recorded)}
                      onChange={(_e: unknown, { value }: { value: number | string }) =>
                        setStepForm((prev) => ({ ...prev, [step.routing_step_id]: { ...entry, qty_recorded: String(value ?? '') } }))
                      }
                    />
                    <TextInput
                      id={`produksi-tanggal-${step.routing_step_id}`}
                      size="lg"
                      type="date"
                      labelText="Tanggal kejadian"
                      value={entry.record_date}
                      onChange={(event) => setStepForm((prev) => ({ ...prev, [step.routing_step_id]: { ...entry, record_date: event.target.value } }))}
                    />
                    <NumberInput
                      id={`produksi-reject-${step.routing_step_id}`}
                      label="Reject (opsional)"
                      min={0}
                      allowEmpty
                      hideSteppers
                      value={entry.qty_reject === '' ? '' : Number(entry.qty_reject)}
                      onChange={(_e: unknown, { value }: { value: number | string }) =>
                        setStepForm((prev) => ({ ...prev, [step.routing_step_id]: { ...entry, qty_reject: String(value ?? '') } }))
                      }
                    />
                    <Button size="md" onClick={() => handleSaveStep(wo, step)}>
                      Simpan tahap
                    </Button>
                  </div>
                  {stepMessage[step.routing_step_id] ? (
                    <InlineNotification kind="info" lowContrast hideCloseButton title="Hasil" subtitle={stepMessage[step.routing_step_id]} />
                  ) : null}
                </div>
              );
            })}
          </>
        )}

        {selectedBatchId ? (
          <div className="produksi-output">
            <div className="produksi-output__kepala">
              <h4 className="halaman__subjudul halaman__subjudul--rapat">Catat hasil produksi</h4>
              <Button kind="tertiary" size="sm" renderIcon={Add} onClick={addOutputLine}>
                Tambah baris hasil
              </Button>
            </div>
            <p className="halaman__redup">
              Bisa lebih dari satu baris sekaligus (mis. produk utama + sisa yang bisa diproses ulang) — semua baris dari batch yang sama mewarisi genealogy yang sama, dari lot
              bahan yang tercatat dipakai.
            </p>
            {outputLines.map((line, index) => (
              <div key={index} className="produksi-output__baris">
                <NumberInput
                  id={`produksi-hasil-qty-${index}`}
                  label={`Jumlah hasil (${wo.item_base_uom})`}
                  min={0}
                  allowEmpty
                  hideSteppers
                  value={line.qty === '' ? '' : Number(line.qty)}
                  onChange={(_e: unknown, { value }: { value: number | string }) => updateOutputLine(index, 'qty', String(value ?? ''))}
                />
                <Dropdown
                  id={`produksi-hasil-jenis-${index}`}
                  size="lg"
                  titleText="Jenis hasil"
                  label="Pilih jenis"
                  items={Object.keys(outputTypeLabels)}
                  itemToString={(v: string) => outputTypeLabels[v] ?? v}
                  selectedItem={line.output_type}
                  onChange={({ selectedItem }: { selectedItem: string | null }) => updateOutputLine(index, 'output_type', selectedItem ?? 'main_output')}
                />
                <TextInput
                  id={`produksi-hasil-lot-${index}`}
                  size="lg"
                  labelText="Nomor lot (opsional)"
                  placeholder="Kosongkan untuk dibuatkan otomatis"
                  value={line.lot_number}
                  onChange={(e) => updateOutputLine(index, 'lot_number', e.target.value)}
                />
                <TextInput
                  id={`produksi-hasil-kadaluarsa-${index}`}
                  size="lg"
                  type="date"
                  labelText="Tanggal kedaluwarsa (opsional)"
                  value={line.expiry_date}
                  onChange={(e) => updateOutputLine(index, 'expiry_date', e.target.value)}
                />
                <Button kind="danger--tertiary" size="sm" renderIcon={TrashCan} disabled={outputLines.length === 1} onClick={() => removeOutputLine(index)}>
                  Hapus baris
                </Button>
              </div>
            ))}
            {outputMessage ? (
              <InlineNotification
                kind={outputStatus === 'error' ? 'error' : 'success'}
                lowContrast
                hideCloseButton
                title={outputStatus === 'error' ? 'Gagal' : 'Berhasil'}
                subtitle={outputMessage}
              />
            ) : null}
            <Button size="md" disabled={outputStatus === 'saving'} onClick={() => handleRecordOutput(wo)}>
              {outputStatus === 'saving' ? 'Menyimpan...' : 'Catat hasil produksi'}
            </Button>
          </div>
        ) : null}

        <Link href="/work-orders" className="cds--link">
          Buka halaman Work Order lengkap (termasuk catat pemakaian bahan)
        </Link>
      </div>
    );
  };

  if (checkingAccess) {
    return (
      <div className="halaman">
        <DataTableSkeleton columnCount={5} rowCount={6} showHeader showToolbar />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <KepalaHalaman remah={[]} judul="Produksi" />
        <InlineNotification kind="error" lowContrast hideCloseButton title="Akses ditolak" subtitle="Halaman ini khusus peran yang berwenang atas produksi." />
        <Button className="produksi-tombol-kembali" onClick={() => router.push('/dashboard')}>
          Kembali ke ringkasan
        </Button>
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Manufacturing' }, { label: 'Production' }]}
        judul="Produksi"
        pengantar={`${todaysBatches.length} batch dijadwalkan hari ini${myPlantId === null ? '' : ' di lokasi Anda'}, ${disruptions.length} gangguan terbuka, ${woTersaring.length} Work Order${adaSaringan ? ' sesuai saringan' : ''}.`}
      />

      <h2 className="halaman__subjudul">Jadwal hari ini{myPlantId === null ? '' : ' — lokasi saya'}</h2>
      <p className="halaman__redup">Batch yang dijadwalkan hari ini atau sudah berjalan — bukan Gantt penuh, cukup daftar yang bisa langsung ditindaklanjuti.</p>
      {todaysBatchesError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat jadwal" subtitle={todaysBatchesError} /> : null}
      {todaysBatchesLoading ? (
        <DataTableSkeleton columnCount={6} rowCount={3} showHeader={false} showToolbar={false} />
      ) : (
        <Table size="lg" className="tabel-responsif">
          <TableHead>
            <TableRow>
              <TableHeader>Batch</TableHeader>
              <TableHeader>Item</TableHeader>
              <TableHeader>Qty</TableHeader>
              <TableHeader>Lokasi</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Aksi</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {todaysBatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>Tidak ada batch dijadwalkan hari ini{myPlantId !== null ? ' di lokasi Anda' : ''}.</TableCell>
              </TableRow>
            ) : (
              todaysBatches.map((b) => (
                <TableRow key={b.production_batch_id}>
                  <TableCell data-label="Batch">{b.batch_number}</TableCell>
                  <TableCell data-label="Item">
                    {b.item_code} — {b.item_name}
                  </TableCell>
                  <TableCell data-label="Qty">
                    {formatNumberId(b.planned_qty, 2)} {b.uom}
                  </TableCell>
                  <TableCell data-label="Lokasi">{b.production_plant_name ?? '—'}</TableCell>
                  <TableCell data-label="Status">
                    <Tag type={batchStatusWarnaTag[b.status] ?? 'gray'}>{batchStatusLabels[b.status] ?? b.status}</Tag>
                  </TableCell>
                  <TableCell data-label="Aksi">
                    <div className="produksi-aksi-sel">
                      {canRecordStepProgress(role) && b.status === 'planned' ? (
                        <Button size="sm" disabled={batchTransitionBusyId === b.production_batch_id} onClick={() => handleStartBatch(b.production_batch_id)}>
                          {batchTransitionBusyId === b.production_batch_id ? '...' : 'Mulai'}
                        </Button>
                      ) : null}
                      {canRecordStepProgress(role) && b.status === 'in_progress' ? (
                        <Checkbox
                          id={`produksi-rework-jadwal-${b.production_batch_id}`}
                          labelText="Rework"
                          checked={reworkBatchIds.has(b.production_batch_id)}
                          onChange={(_e: unknown, { checked }: { checked: boolean }) =>
                            setReworkBatchIds((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(b.production_batch_id);
                              else next.delete(b.production_batch_id);
                              return next;
                            })
                          }
                        />
                      ) : null}
                      {canRecordStepProgress(role) && b.status === 'in_progress' ? (
                        <Button size="sm" disabled={batchTransitionBusyId === b.production_batch_id} onClick={() => handleCompleteBatch(b.production_batch_id)}>
                          {batchTransitionBusyId === b.production_batch_id ? '...' : 'Selesaikan'}
                        </Button>
                      ) : null}
                      <Button kind="ghost" size="sm" onClick={() => handleOpenFromToday(b)}>
                        Catat tahap
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <h2 className="halaman__subjudul">Gangguan produksi</h2>
      <p className="halaman__redup">
        Kosongkan &quot;work center&quot; untuk gangguan MENYELURUH satu lokasi pabrik (mis. listrik padam se-pabrik) — semua Work Order aktif di lokasi itu otomatis ditandai
        &quot;terhambat&quot;, dan kembali normal begitu gangguannya ditandai selesai.
      </p>
      {disruptionsError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat gangguan" subtitle={disruptionsError} /> : null}
      {disruptionsLoading ? (
        <DataTableSkeleton columnCount={6} rowCount={3} showHeader={false} showToolbar />
      ) : (
        <Table size="lg" className="tabel-responsif">
          <TableHead>
            <TableRow>
              <TableHeader>Jenis</TableHeader>
              <TableHeader>Cakupan</TableHeader>
              <TableHeader>Lokasi</TableHeader>
              <TableHeader>Mulai</TableHeader>
              <TableHeader>Keterangan</TableHeader>
              <TableHeader>Aksi</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {disruptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>Tidak ada gangguan produksi yang sedang terbuka.</TableCell>
              </TableRow>
            ) : (
              disruptions.map((d) => (
                <TableRow key={d.production_disruption_id}>
                  <TableCell data-label="Jenis">{disruptionTypeLabels[d.disruption_type] ?? d.disruption_type}</TableCell>
                  <TableCell data-label="Cakupan">
                    {/* Gangguan MENYELURUH merah karena ia menghentikan seluruh lokasi; gangguan
                        satu work center magenta — mengganggu, tapi tidak menghentikan semuanya. */}
                    <Tag type={d.work_center_id ? 'magenta' : 'red'}>{d.work_center_id ? d.work_center_name ?? 'Work center' : 'Menyeluruh satu lokasi'}</Tag>
                  </TableCell>
                  <TableCell data-label="Lokasi">{d.production_plant_name ?? '—'}</TableCell>
                  <TableCell data-label="Mulai">{formatDateTimeShort(d.started_at)}</TableCell>
                  <TableCell data-label="Keterangan">
                    {d.work_order_item_code ? `WO ${d.work_order_item_code}` : ''}
                    {d.work_order_item_code && d.description ? ' · ' : ''}
                    {d.description ?? ''}
                  </TableCell>
                  <TableCell data-label="Aksi">
                    {canManageProductionDisruptions(role) ? (
                      <Button
                        kind="ghost"
                        size="sm"
                        disabled={resolvingId === d.production_disruption_id}
                        onClick={() => handleResolveDisruption(d.production_disruption_id)}
                      >
                        {resolvingId === d.production_disruption_id ? '...' : 'Tandai selesai'}
                      </Button>
                    ) : (
                      <span className="halaman__redup">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
      {canManageProductionDisruptions(role) ? (
        <Button size="lg" renderIcon={Add} className="produksi-tombol-gangguan" onClick={() => setIsDisruptionModalOpen(true)}>
          Catat gangguan
        </Button>
      ) : null}

      <h2 className="halaman__subjudul">Work Order</h2>
      {woError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat Work Order" subtitle={woError} /> : null}
      {woLoading ? (
        <DataTableSkeleton columnCount={5} rowCount={6} showHeader showToolbar />
      ) : (
        <>
          <DataTable rows={barisWo} headers={kolomWo} isSortable size="lg">
            {(rp: any) => (
              <TableContainer {...rp.getTableContainerProps()}>
                <TableToolbar>
                  <TableToolbarContent>
                    {/* MELIPAT, bukan selalu terbuka — bawaan Carbon, `persistent` tidak dipakai. */}
                    <TableToolbarSearch
                      placeholder="Cari kode item atau nomor SO…"
                      labelText="Cari Work Order"
                      onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => {
                        setCari(typeof e === 'string' ? '' : e.target.value);
                        setHalaman(1);
                      }}
                    />
                    <Dropdown
                      id="produksi-saring-status"
                      size="lg"
                      className="halaman__saring"
                      label="Status"
                      titleText="Status"
                      hideLabel
                      items={['semua', ...Object.keys(statusLabels)]}
                      itemToString={(v: string) => (v === 'semua' ? 'Semua status' : statusLabels[v] ?? v)}
                      selectedItem={saringStatus}
                      onChange={({ selectedItem }: { selectedItem: string | null }) => {
                        setSaringStatus(selectedItem ?? 'semua');
                        setHalaman(1);
                      }}
                    />
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...rp.getTableProps()} className="tabel-responsif">
                  <TableHead>
                    <TableRow>
                      <TableExpandHeader aria-label="Buka pencatatan progres" />
                      {rp.headers.map((h: any) => {
                        const { key, ...sisa } = rp.getHeaderProps({ header: h }) as { key?: string };
                        void key;
                        return (
                          <TableHeader key={h.key} {...sisa} isSortable>
                            {h.header}
                          </TableHeader>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rp.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={kolomWo.length + 1}>
                          {adaSaringan ? 'Tidak ada Work Order yang cocok dengan pencarian atau saringan.' : 'Belum ada Work Order.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rp.rows.map((row: any) => {
                        const wo = woById.get(row.id);
                        if (!wo) return null;
                        const { key, ...sisaBaris } = rp.getRowProps({ row }) as { key?: string };
                        void key;
                        return (
                          <React.Fragment key={row.id}>
                            <TableExpandRow
                              {...sisaBaris}
                              isExpanded={expandedWoId === wo.work_order_id}
                              onExpand={() => toggleExpand(wo)}
                              aria-label={`Progres ${wo.item_code}`}
                            >
                              {kolomWo.map((h) => (
                                <TableCell key={h.key} data-label={h.header}>
                                  {isiSelWo(wo, h.key)}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow colSpan={kolomWo.length + 1}>
                              {expandedWoId === wo.work_order_id && expandedWo ? renderProgresWo(expandedWo) : null}
                            </TableExpandedRow>
                          </React.Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>

          <Pagination
            page={halaman}
            pageSize={perHalaman}
            pageSizes={[15, 30, 50]}
            totalItems={woTersaring.length}
            onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
              setHalaman(page);
              setPerHalaman(pageSize);
            }}
            backwardText="Halaman sebelumnya"
            forwardText="Halaman berikutnya"
            itemsPerPageText="Baris per halaman"
            itemRangeText={(mulai: number, akhir: number, total: number) => `${mulai}–${akhir} dari ${total} Work Order`}
            pageRangeText={(_kini: number, total: number) => `dari ${total} halaman`}
            pageNumberText="Nomor halaman"
          />
        </>
      )}

      {/* MODAL TRANSAKSIONAL: empat isian, satu keputusan — catat gangguan. */}
      <ComposedModal open={isDisruptionModalOpen} size="md" onClose={() => { setIsDisruptionModalOpen(false); return true; }}>
        <ModalHeader label="Produksi" title="Catat gangguan produksi" closeModal={() => setIsDisruptionModalOpen(false)} />
        <ModalBody hasForm>
          <div className="produksi-form">
            <Dropdown
              id="gangguan-jenis"
              size="lg"
              titleText="Jenis gangguan"
              label="Pilih jenis"
              items={Object.keys(disruptionTypeLabels)}
              itemToString={(v: string) => disruptionTypeLabels[v] ?? v}
              selectedItem={disruptionForm.disruption_type}
              onChange={({ selectedItem }: { selectedItem: string | null }) => setDisruptionForm((prev) => ({ ...prev, disruption_type: selectedItem ?? '' }))}
            />
            <Dropdown
              id="gangguan-lokasi"
              size="lg"
              titleText="Lokasi pabrik"
              label="Pilih lokasi..."
              items={plants}
              itemToString={(p: any) => p?.name ?? ''}
              selectedItem={plants.find((p) => String(p.production_plant_id) === disruptionForm.production_plant_id) ?? null}
              onChange={({ selectedItem }: { selectedItem: any }) =>
                setDisruptionForm((prev) => ({ ...prev, production_plant_id: selectedItem ? String(selectedItem.production_plant_id) : '', work_center_id: '' }))
              }
            />
            <Dropdown
              id="gangguan-work-center"
              size="lg"
              titleText="Work center"
              label="(Menyeluruh — semua work center)"
              helperText="Dikosongkan berarti seluruh lokasi pabrik terdampak."
              items={['', ...workCenterOptions.filter((wc) => !disruptionForm.production_plant_id || String(wc.production_plant_id) === disruptionForm.production_plant_id).map((wc) => String(wc.work_center_id))]}
              itemToString={(v: string) => (v === '' ? '(Menyeluruh — semua work center)' : workCenterOptions.find((wc) => String(wc.work_center_id) === v)?.name ?? v)}
              selectedItem={disruptionForm.work_center_id || ''}
              onChange={({ selectedItem }: { selectedItem: string | null }) => setDisruptionForm((prev) => ({ ...prev, work_center_id: selectedItem ?? '' }))}
            />
            <TextInput
              id="gangguan-keterangan"
              size="lg"
              labelText="Keterangan (opsional)"
              value={disruptionForm.description}
              onChange={(e) => setDisruptionForm((prev) => ({ ...prev, description: e.target.value }))}
            />
            {disruptionFormMessage ? (
              <div className="produksi-form__lebar-penuh">
                <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal" subtitle={disruptionFormMessage} />
              </div>
            ) : null}
          </div>
        </ModalBody>
        {/* `children` WAJIB pada ModalFooter di @carbon/react 1.114. */}
        <ModalFooter>
          <Button kind="secondary" onClick={() => setIsDisruptionModalOpen(false)}>
            Batal
          </Button>
          <Button kind="primary" disabled={disruptionFormStatus === 'saving'} onClick={handleCreateDisruption}>
            {disruptionFormStatus === 'saving' ? 'Menyimpan...' : 'Catat gangguan'}
          </Button>
        </ModalFooter>
      </ComposedModal>
    </div>
  );
}

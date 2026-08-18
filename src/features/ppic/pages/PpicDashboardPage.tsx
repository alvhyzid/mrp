'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { DndContext, DragOverlay, useDraggable, useDroppable, useSensor, useSensors, PointerSensor, pointerWithin } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { canAccessPpicDashboard, canManageWorkCenterCapacity, canManageWorkOrder, canRecordStepProgress, canProposeProductionStandard, canDecideProductionStandardProposal } from '@/lib/roles';

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
const bomStatusLabels: Record<string, string> = { draft: 'Draft', active: 'Aktif', archived: 'Diarsipkan' };
const bomStatusBadgeVariant: Record<string, 'warning' | 'success' | 'secondary'> = { draft: 'warning', active: 'success', archived: 'secondary' };

type PendingApproval = { customer_po_approval_id: number; customer_purchase_order_id: number; po_number: string; po_date: string | null; requested_ship_date: string | null; customer_name: string | null };
type WorkOrder = { work_order_id: number; item_code: string | null; planned_qty: number; item_base_uom: string | null; status: string; readiness: string; open_alert_count: number; so_number: string | null };
type Bom = { bom_id: number; parent_item_code: string | null; parent_item_name: string | null; version: number; status: string; standard_yield_qty: number; standard_yield_uom: string; lines: unknown[] };
type WorkCenterCapacity = {
  work_center_id: number;
  name: string;
  code: string | null;
  production_plant_name: string | null;
  capacity_hours_per_day: number | null;
  scheduled_hours: number;
  total_capacity_hours: number | null;
  utilization_pct: number | null;
};

function utilizationBadgeVariant(pct: number): 'success' | 'warning' | 'critical' {
  if (pct > 100) return 'critical';
  if (pct >= 80) return 'warning';
  return 'success';
}

type GanttWorkCenter = { work_center_id: number; name: string; code: string | null; capacity_hours_per_day: number | null };
type GanttBlock = {
  work_center_id: number;
  date: string;
  production_batch_id: number;
  batch_number: string;
  batch_status: string;
  item_code: string | null;
  item_name: string | null;
  routing_step_id: number;
  step_name: string;
  sequence_no: number;
  duration_minutes: number;
  day_offset: number;
  minute_of_day: number;
};
type MonthlySummaryEntry = { work_center_id: number; date: string; batch_count: number; active_minutes: number };
type GanttView = 'weekly' | 'daily' | 'monthly';

type BlockDetailAssignment = {
  work_order_assignment_id: number;
  employee_name: string | null;
  employee_position: string | null;
  status: string;
  scheduled_hours: number | null;
  actual_hours: number | null;
  qty_produced: number | null;
};
type BlockDetailProgress = {
  work_order_step_progress_id: number;
  status: string;
  qty_input: number | null;
  uom_input: string | null;
  qty_recorded: number | null;
  uom: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  shrinkage_pct: number | null;
};
type BlockDetail = {
  batch: { production_batch_id: number; work_order_id: number; batch_number: string; planned_qty: number; uom: string; planned_date: string | null; status: string; started_at: string | null; completed_at: string | null };
  item: { item_code: string | null; item_name: string | null } | null;
  step: { routing_step_id: number; step_name: string; sequence_no: number; active_duration_minutes: number; wait_duration_minutes: number };
  workCenter: { name: string; code: string | null } | null;
  shift: { name: string; start_time: string; end_time: string } | null;
  assignments: BlockDetailAssignment[];
  progress: BlockDetailProgress[];
};
type YieldStep = { routing_step_id: number; sequence_no: number; step_name: string; status: string | null; qty_input: number | null; uom_input: string | null; qty_recorded: number | null; uom: string | null; shrinkage_pct: number | null };
type YieldSummary = { batch_number: string; steps: YieldStep[]; total_yield_pct: number | null };

// K8 (Fase Produksi Nyata, bagian D) — usulan standar produksi menunggu keputusan planner.
type StandardProposal = {
  production_standard_proposal_id: number;
  item_code: string | null;
  item_name: string | null;
  routing_step_name: string | null;
  metric_key: string;
  old_value: number | null;
  old_source: string | null;
  proposed_value: number;
  calculation_method: string;
  sample_count: number;
  change_pct: number | null;
  will_flip_to_dipelajari: boolean;
};
const metricKeyLabels: Record<string, string> = {
  yield_percentage: 'Yield (%)',
  unit_per_batch: 'Unit per Batch',
  active_duration_minutes: 'Durasi Aktif (menit)',
  batches_per_day: 'Kapasitas (batch/hari)'
};

const assignmentStatusLabels: Record<string, string> = { planned: 'Direncanakan', confirmed: 'Dikonfirmasi', absent: 'Tidak Hadir', replaced: 'Digantikan', completed: 'Selesai', unplanned_addition: 'Tambahan Dadakan' };
const progressStatusLabels: Record<string, string> = { pending: 'Belum Mulai', in_progress: 'Berjalan', completed: 'Selesai' };

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
type UnscheduledBatch = {
  production_batch_id: number;
  batch_number: string;
  batch_status: string;
  item_code: string | null;
  item_name: string | null;
  planned_qty: number;
  uom: string;
  primary_work_center_id: number | null;
};

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTH_LABELS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function formatDayLabel(dateStr: string, index: number): string {
  const [, m, d] = dateStr.split('-');
  return `${DAY_LABELS[index]} ${d}/${m}`;
}

// Format YYYY-MM-DD dari waktu LOKAL — duplikat sengaja dari weekRange.ts
// (server-only) supaya komponen client ini tidak import kode server.
function dateToDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatHourLabel(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Geser tanggal (string YYYY-MM-DD) sejumlah hari — dipakai buat hitung
// planned_date baru dari sel yang di-drop + day_offset blok yang diseret,
// murni aritmetika lokal (bukan UTC) supaya konsisten dengan weekRange.ts.
function addDaysToDateString(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + deltaDays);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

type DragData =
  | { type: 'block'; production_batch_id: number; batch_number: string; work_center_id: number; day_offset: number }
  | { type: 'unscheduled'; production_batch_id: number; batch_number: string; primary_work_center_id: number | null };

function DraggableBlock({ block, canDrag, onOpenDetail }: { block: GanttBlock; canDrag: boolean; onOpenDetail: (block: GanttBlock) => void }) {
  const draggable = canDrag && block.batch_status === 'planned';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${block.production_batch_id}-${block.sequence_no}-${block.date}`,
    data: { type: 'block', production_batch_id: block.production_batch_id, batch_number: block.batch_number, work_center_id: block.work_center_id, day_offset: block.day_offset } satisfies DragData,
    disabled: !draggable
  });
  return (
    <div
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      onClick={() => onOpenDetail(block)}
      title={draggable ? 'Klik untuk detail, seret untuk jadwalkan ulang' : 'Klik untuk lihat detail tahap ini'}
      style={draggable ? { touchAction: 'none' } : undefined}
      className={`select-none border-l-2 border-info bg-info-subtle px-1.5 py-1 text-xs text-info-subtle-foreground ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer opacity-70'
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="font-medium">{block.batch_number}</div>
      <div className="truncate">{block.item_code ?? block.item_name}</div>
      <div className="text-[10px] text-muted-foreground">
        {block.step_name} · {block.duration_minutes} mnt
      </div>
    </div>
  );
}

function DraggableUnscheduled({ batch, canDrag }: { batch: UnscheduledBatch; canDrag: boolean }) {
  const draggable = canDrag && batch.batch_status === 'planned';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unscheduled-${batch.production_batch_id}`,
    data: { type: 'unscheduled', production_batch_id: batch.production_batch_id, batch_number: batch.batch_number, primary_work_center_id: batch.primary_work_center_id } satisfies DragData,
    disabled: !draggable
  });
  return (
    <div
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      title={draggable ? 'Seret ke grid untuk atur tanggal rencana' : 'Batch ini tidak bisa dijadwalkan lewat drag'}
      style={draggable ? { touchAction: 'none' } : undefined}
      className={`select-none flex items-center justify-between rounded-md border p-2 text-sm ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-60'} ${isDragging ? 'opacity-30' : ''}`}
    >
      <span className="font-medium text-foreground">{batch.batch_number}</span>
      <span className="text-muted-foreground">{batch.item_code ?? batch.item_name}</span>
      <span className="text-data text-muted-foreground">
        {batch.planned_qty} {batch.uom}
      </span>
    </div>
  );
}

function DroppableCell({
  workCenterId,
  date,
  restrictedRow,
  children
}: {
  workCenterId: number;
  date: string;
  restrictedRow: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${workCenterId}-${date}`, data: { work_center_id: workCenterId, date }, disabled: restrictedRow });
  return (
    <td
      ref={setNodeRef}
      className={`px-1.5 py-1.5 align-top transition-colors ${isOver && !restrictedRow ? 'bg-info-subtle/60' : ''} ${restrictedRow ? 'cursor-not-allowed' : ''}`}
    >
      <div className="flex flex-col gap-1">{children}</div>
    </td>
  );
}

export default function PpicDashboardPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [approvalsError, setApprovalsError] = useState('');
  const [approvalsLoading, setApprovalsLoading] = useState(true);
  const [approvalBusyId, setApprovalBusyId] = useState<number | null>(null);
  const [approvalMessage, setApprovalMessage] = useState('');

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [woError, setWoError] = useState('');
  const [woLoading, setWoLoading] = useState(true);

  const [boms, setBoms] = useState<Bom[]>([]);
  const [bomsError, setBomsError] = useState('');
  const [bomsLoading, setBomsLoading] = useState(true);

  const [role, setRole] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<WorkCenterCapacity[]>([]);
  const [capacityError, setCapacityError] = useState('');
  const [capacityLoading, setCapacityLoading] = useState(true);
  const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState(6);
  const [capacityEdits, setCapacityEdits] = useState<Record<number, string>>({});
  const [capacitySavingId, setCapacitySavingId] = useState<number | null>(null);
  const [capacityMessage, setCapacityMessage] = useState('');

  const [ganttView, setGanttView] = useState<GanttView>('weekly');
  const [ganttWeekOffset, setGanttWeekOffset] = useState(0);
  const [ganttDailyDate, setGanttDailyDate] = useState(() => dateToDateString(new Date()));
  const [ganttMonth, setGanttMonth] = useState(() => { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() + 1 }; });
  const [ganttDays, setGanttDays] = useState<string[]>([]);
  const [ganttWorkCenters, setGanttWorkCenters] = useState<GanttWorkCenter[]>([]);
  const [ganttBlocks, setGanttBlocks] = useState<GanttBlock[]>([]);
  const [ganttMonthlySummary, setGanttMonthlySummary] = useState<MonthlySummaryEntry[]>([]);
  const [ganttUnscheduled, setGanttUnscheduled] = useState<UnscheduledBatch[]>([]);
  const [ganttError, setGanttError] = useState('');
  const [ganttLoading, setGanttLoading] = useState(true);
  const [activeDragWorkCenterId, setActiveDragWorkCenterId] = useState<number | null>(null);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const [dragMessage, setDragMessage] = useState('');
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const [detailOpen, setDetailOpen] = useState(false);
  const [blockDetail, setBlockDetail] = useState<BlockDetail | null>(null);
  const [blockDetailLoading, setBlockDetailLoading] = useState(false);
  const [blockDetailError, setBlockDetailError] = useState('');

  const emptyProgressForm = { status: 'in_progress', qty_input: '', uom_input: '', qty_recorded: '', uom: '', notes: '' };
  const [progressForm, setProgressForm] = useState(emptyProgressForm);
  const [progressSuggestion, setProgressSuggestion] = useState<{ qty: number; uom: string | null; source: 'previous_step' | 'planned_qty' } | null>(null);
  const [progressFormStatus, setProgressFormStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [progressFormMessage, setProgressFormMessage] = useState('');

  const [yieldOpen, setYieldOpen] = useState(false);
  const [yieldSummary, setYieldSummary] = useState<YieldSummary | null>(null);
  const [yieldLoading, setYieldLoading] = useState(false);
  const [yieldError, setYieldError] = useState('');
  const [learnStatus, setLearnStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [learnMessage, setLearnMessage] = useState('');

  const [proposals, setProposals] = useState<StandardProposal[]>([]);
  const [proposalsError, setProposalsError] = useState('');
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [proposalBusyId, setProposalBusyId] = useState<number | null>(null);
  const [proposalMessage, setProposalMessage] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const authedFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Sesi tidak valid.');
      let response: Response;
      try {
        response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) } });
      } catch {
        // Gagal terkoneksi sama sekali (mis. Supabase/jaringan sedang gangguan sesaat) —
        // jangan biarkan exception ini lolos tanpa pesan ke pemanggil.
        return { ok: false, body: { error: 'Tidak bisa terhubung ke server. Coba lagi dalam beberapa saat.' } };
      }
      // Kalau respons BUKAN JSON valid (mis. halaman error dari Cloudflare/Supabase saat
      // gangguan), response.json() akan throw — tangkap di sini supaya pemanggil selalu
      // dapat pesan yang jelas, bukan promise rejection yang tidak tertangani.
      try {
        const body = await response.json();
        return { ok: response.ok, body };
      } catch {
        return { ok: false, body: { error: 'Server memberi respons yang tidak dikenali (kemungkinan gangguan sesaat di layanan database). Coba lagi dalam beberapa saat.' } };
      }
    },
    [getAccessToken]
  );

  const loadApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    const { ok, body } = await authedFetch('/api/customer-po-approvals-pending');
    if (!ok) {
      setApprovalsError(body.error || 'Gagal memuat approval menunggu.');
      setApprovalsLoading(false);
      return;
    }
    setApprovals(body.approvals || []);
    setApprovalsError('');
    setApprovalsLoading(false);
  }, [authedFetch]);

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

  const loadBoms = useCallback(async () => {
    setBomsLoading(true);
    const { ok, body } = await authedFetch('/api/boms');
    if (!ok) {
      setBomsError(body.error || 'Gagal memuat BOM.');
      setBomsLoading(false);
      return;
    }
    setBoms(body.boms || []);
    setBomsError('');
    setBomsLoading(false);
  }, [authedFetch]);

  const loadProposals = useCallback(async () => {
    setProposalsLoading(true);
    const { ok, body } = await authedFetch('/api/production-standards/proposals');
    if (!ok) {
      setProposalsError(body.error || 'Gagal memuat usulan standar produksi.');
      setProposalsLoading(false);
      return;
    }
    setProposals(body.proposals || []);
    setProposalsError('');
    setProposalsLoading(false);
  }, [authedFetch]);

  const handleDecideProposal = async (proposalId: number, decision: 'approved' | 'rejected') => {
    setProposalBusyId(proposalId);
    setProposalMessage('');
    const { ok, body } = await authedFetch('/api/production-standards/proposals/decide', {
      method: 'POST',
      body: JSON.stringify({ production_standard_proposal_id: proposalId, decision })
    });
    setProposalBusyId(null);
    if (!ok) {
      setProposalMessage(body.error || 'Gagal memproses usulan.');
      return;
    }
    await loadProposals();
  };

  const handleLearnFromBatch = async () => {
    if (!blockDetail) return;
    setLearnStatus('pending');
    setLearnMessage('');
    const { ok, body } = await authedFetch('/api/production-batches/learn-standard-sample', {
      method: 'POST',
      body: JSON.stringify({ production_batch_id: blockDetail.batch.production_batch_id })
    });
    if (!ok) {
      setLearnStatus('error');
      setLearnMessage(body.error || 'Gagal mengajukan sampel standar.');
      return;
    }
    setLearnStatus('done');
    if (body.excluded) {
      setLearnMessage(`Batch ini TIDAK dijadikan sampel — log tahap belum lengkap (${(body.missing_routing_step_ids as number[]).length} tahap belum selesai).`);
    } else {
      const count = (body.samples_submitted as unknown[]).length;
      setLearnMessage(count > 0 ? `${count} sampel standar berhasil diajukan dari batch ini.` : 'Tidak ada sampel yang bisa dihitung dari batch ini (belum ada output/durasi tercatat).');
    }
    await loadProposals();
  };

  const loadCapacity = useCallback(async () => {
    setCapacityLoading(true);
    const { ok, body } = await authedFetch('/api/work-centers/capacity');
    if (!ok) {
      setCapacityError(body.error || 'Gagal memuat kapasitas Work Center.');
      setCapacityLoading(false);
      return;
    }
    setCapacity(body.workCenters || []);
    setWorkingDaysPerWeek(body.workingDaysPerWeek ?? 6);
    setCapacityError('');
    setCapacityLoading(false);
  }, [authedFetch]);

  const loadGantt = useCallback(
    async (view: GanttView, weekOffset: number, dailyDate: string, month: { year: number; month: number }) => {
      setGanttLoading(true);
      const query =
        view === 'daily'
          ? `view=daily&date=${dailyDate}`
          : view === 'monthly'
            ? `view=monthly&year=${month.year}&month=${month.month}`
            : `view=weekly&week_offset=${weekOffset}`;
      const { ok, body } = await authedFetch(`/api/work-centers/gantt?${query}`);
      if (!ok) {
        setGanttError(body.error || 'Gagal memuat Gantt produksi.');
        setGanttLoading(false);
        return;
      }
      setGanttDays(body.days || []);
      setGanttWorkCenters(body.workCenters || []);
      setGanttBlocks(body.blocks || []);
      setGanttMonthlySummary(body.monthlySummary || []);
      setGanttUnscheduled(body.unscheduled || []);
      setGanttError('');
      setGanttLoading(false);
    },
    [authedFetch]
  );

  const handleOpenBlockDetail = useCallback(
    async (block: GanttBlock) => {
      setDetailOpen(true);
      setBlockDetail(null);
      setBlockDetailError('');
      setBlockDetailLoading(true);
      setProgressFormStatus('idle');
      setProgressFormMessage('');
      setProgressSuggestion(null);
      const [detailRes, suggestRes] = await Promise.all([
        authedFetch(`/api/production-batches/step-detail?production_batch_id=${block.production_batch_id}&routing_step_id=${block.routing_step_id}`),
        authedFetch(`/api/work-order-step-progress/suggest-input?production_batch_id=${block.production_batch_id}&routing_step_id=${block.routing_step_id}`)
      ]);
      setBlockDetailLoading(false);
      if (!detailRes.ok) {
        setBlockDetailError(detailRes.body.error || 'Gagal memuat detail tahap ini.');
        return;
      }
      const detail = detailRes.body as BlockDetail;
      setBlockDetail(detail);

      const latestProgress = detail.progress[0] ?? null;
      if (latestProgress && latestProgress.status !== 'completed') {
        // Tahap ini sudah pernah dicatat (belum selesai) — edit baris yang ada,
        // BUKAN timpa dengan saran baru.
        setProgressForm({
          status: latestProgress.status,
          qty_input: latestProgress.qty_input !== null ? String(latestProgress.qty_input) : '',
          uom_input: latestProgress.uom_input ?? '',
          qty_recorded: latestProgress.qty_recorded !== null ? String(latestProgress.qty_recorded) : '',
          uom: latestProgress.uom ?? '',
          notes: latestProgress.notes ?? ''
        });
      } else if (suggestRes.ok) {
        const suggestion = suggestRes.body as { suggested_qty: number | null; suggested_uom: string | null; source: 'previous_step' | 'planned_qty' };
        if (suggestion.suggested_qty !== null) {
          setProgressSuggestion({ qty: suggestion.suggested_qty, uom: suggestion.suggested_uom, source: suggestion.source });
        }
        setProgressForm({ ...emptyProgressForm, qty_input: suggestion.suggested_qty !== null ? String(suggestion.suggested_qty) : '', uom_input: suggestion.suggested_uom ?? '' });
      } else {
        setProgressForm(emptyProgressForm);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authedFetch]
  );

  const handleSubmitProgress = async () => {
    if (!blockDetail) return;
    setProgressFormStatus('saving');
    setProgressFormMessage('');
    const { ok, body } = await authedFetch('/api/work-order-step-progress', {
      method: 'POST',
      body: JSON.stringify({
        work_order_id: blockDetail.batch.work_order_id,
        production_batch_id: blockDetail.batch.production_batch_id,
        routing_step_id: blockDetail.step.routing_step_id,
        status: progressForm.status,
        qty_input: progressForm.qty_input === '' ? null : Number(progressForm.qty_input),
        uom_input: progressForm.uom_input || null,
        qty_recorded: progressForm.qty_recorded === '' ? null : Number(progressForm.qty_recorded),
        uom: progressForm.uom || null,
        notes: progressForm.notes || null
      })
    });
    if (!ok) {
      setProgressFormStatus('error');
      setProgressFormMessage(body.error || 'Gagal menyimpan progres.');
      return;
    }
    setProgressFormStatus('success');
    setProgressFormMessage('Progres tahap berhasil disimpan.');
    const { ok: detailOk, body: detailBody } = await authedFetch(
      `/api/production-batches/step-detail?production_batch_id=${blockDetail.batch.production_batch_id}&routing_step_id=${blockDetail.step.routing_step_id}`
    );
    if (detailOk) setBlockDetail(detailBody as BlockDetail);
    await loadGantt(ganttView, ganttWeekOffset, ganttDailyDate, ganttMonth);
  };

  const handleOpenYieldSummary = async () => {
    if (!blockDetail) return;
    setYieldOpen(true);
    setYieldSummary(null);
    setYieldError('');
    setYieldLoading(true);
    setLearnStatus('idle');
    setLearnMessage('');
    const { ok, body } = await authedFetch(`/api/production-batches/yield-summary?production_batch_id=${blockDetail.batch.production_batch_id}`);
    setYieldLoading(false);
    if (!ok) {
      setYieldError(body.error || 'Gagal memuat ringkasan yield.');
      return;
    }
    setYieldSummary(body as YieldSummary);
  };

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/ppic');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      if (!meResponse.ok || !canAccessPpicDashboard(meData?.user?.role)) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }
      setRole(meData?.user?.role ?? null);
      setCheckingAccess(false);
      await Promise.all([loadApprovals(), loadWorkOrders(), loadBoms(), loadCapacity(), loadProposals()]);
    };
    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadApprovals, loadWorkOrders, loadBoms, loadCapacity, loadProposals]);

  // Terpisah dari effect di atas supaya navigasi minggu/hari/bulan (ganttView,
  // ganttWeekOffset, dst berubah) cukup reload Gantt-nya saja, tidak mengulang
  // approval/WO/BOM/capacity.
  useEffect(() => {
    if (checkingAccess || accessDenied) return;
    loadGantt(ganttView, ganttWeekOffset, ganttDailyDate, ganttMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganttView, ganttWeekOffset, ganttDailyDate, ganttMonth, checkingAccess, accessDenied]);

  const handleSaveCapacity = async (workCenterId: number) => {
    const raw = capacityEdits[workCenterId];
    const capacityValue = raw === undefined || raw.trim() === '' ? null : Number(raw);
    if (capacityValue !== null && (!Number.isFinite(capacityValue) || capacityValue < 0)) {
      setCapacityMessage('Kapasitas jam/hari harus angka positif.');
      return;
    }
    setCapacitySavingId(workCenterId);
    setCapacityMessage('');
    const { ok, body } = await authedFetch('/api/work-centers/capacity', {
      method: 'PATCH',
      body: JSON.stringify({ work_center_id: workCenterId, capacity_hours_per_day: capacityValue })
    });
    setCapacitySavingId(null);
    if (!ok) {
      setCapacityMessage(body.error || 'Gagal menyimpan kapasitas.');
      return;
    }
    await loadCapacity();
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (!data) return;
    setActiveDragLabel(data.batch_number);
    setActiveDragWorkCenterId(data.type === 'block' ? data.work_center_id : data.primary_work_center_id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragWorkCenterId(null);
    setActiveDragLabel(null);
    const data = event.active.data.current as DragData | undefined;
    const overData = event.over?.data.current as { work_center_id: number; date: string } | undefined;
    if (!data || !overData) return;

    if (overData.work_center_id !== (data.type === 'block' ? data.work_center_id : (data.primary_work_center_id ?? overData.work_center_id))) {
      setDragMessage('Batch cuma bisa dijadwalkan ulang di Work Center yang sama.');
      return;
    }

    const newPlannedDate = data.type === 'block' ? addDaysToDateString(overData.date, -data.day_offset) : overData.date;

    setDragMessage('');
    const { ok, body } = await authedFetch('/api/production-batches', {
      method: 'PATCH',
      body: JSON.stringify({ production_batch_id: data.production_batch_id, planned_date: newPlannedDate })
    });
    if (!ok) {
      setDragMessage(body.error || 'Gagal menjadwalkan ulang batch.');
      return;
    }
    await Promise.all([loadGantt(ganttView, ganttWeekOffset, ganttDailyDate, ganttMonth), loadCapacity()]);
  };

  const handleApprove = async (approvalId: number, status: 'approved' | 'rejected') => {
    setApprovalBusyId(approvalId);
    const { ok, body } = await authedFetch('/api/customer-purchase-orders/approve', { method: 'PATCH', body: JSON.stringify({ customer_po_approval_id: approvalId, status }) });
    setApprovalBusyId(null);
    if (!ok) {
      setApprovalMessage(body.error || 'Gagal memproses approval.');
      return;
    }
    setApprovalMessage('');
    await loadApprovals();
  };

  const approvalColumns = useMemo<ColumnDef<PendingApproval>[]>(
    () => [
      { accessorKey: 'po_number', header: 'No. PO Client' },
      { accessorKey: 'customer_name', header: 'Client' },
      { accessorKey: 'requested_ship_date', header: 'Kirim Diminta', cell: ({ row }) => row.original.requested_ship_date ?? '-' },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button size="sm" disabled={approvalBusyId === row.original.customer_po_approval_id} onClick={() => handleApprove(row.original.customer_po_approval_id, 'approved')}>
              Approve
            </Button>
            <Button size="sm" variant="destructive" disabled={approvalBusyId === row.original.customer_po_approval_id} onClick={() => handleApprove(row.original.customer_po_approval_id, 'rejected')}>
              Reject
            </Button>
          </div>
        )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approvalBusyId]
  );

  const woColumns = useMemo<ColumnDef<WorkOrder>[]>(
    () => [
      { accessorKey: 'item_code', header: 'Item' },
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
      }
    ],
    []
  );

  const ganttBlocksByCell = useMemo(() => {
    const map = new Map<string, GanttBlock[]>();
    for (const block of ganttBlocks) {
      const key = `${block.work_center_id}_${block.date}`;
      const list = map.get(key) ?? [];
      list.push(block);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sequence_no - b.sequence_no);
    return map;
  }, [ganttBlocks]);

  // Tampilan Harian: sel = (Work Center, JAM), bukan (Work Center, tanggal) —
  // blok dikelompokkan pakai jam dari minute_of_day (jangkar shift.start_time
  // + offset kumulatif yang sama dengan Mingguan). Kalau beberapa blok jatuh
  // di jam yang sama, ditumpuk berurutan (diurutkan jam lalu sequence_no) —
  // BUKAN dijadwalkan ulang otomatis, cuma ditampilkan berurutan.
  const ganttBlocksByHourCell = useMemo(() => {
    const map = new Map<string, GanttBlock[]>();
    for (const block of ganttBlocks) {
      const hour = Math.floor(block.minute_of_day / 60);
      const key = `${block.work_center_id}_${hour}`;
      const list = map.get(key) ?? [];
      list.push(block);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.minute_of_day - b.minute_of_day || a.sequence_no - b.sequence_no);
    return map;
  }, [ganttBlocks]);

  const ganttMonthlySummaryByCell = useMemo(() => {
    const map = new Map<string, MonthlySummaryEntry>();
    for (const entry of ganttMonthlySummary) {
      map.set(`${entry.work_center_id}_${entry.date}`, entry);
    }
    return map;
  }, [ganttMonthlySummary]);

  const handleShiftDailyDate = (deltaDays: number) => setGanttDailyDate((prev) => addDaysToDateString(prev, deltaDays));
  const handleShiftMonth = (deltaMonths: number) => {
    setGanttMonth((prev) => {
      let newMonth = prev.month + deltaMonths;
      let newYear = prev.year;
      if (newMonth < 1) { newMonth = 12; newYear -= 1; }
      if (newMonth > 12) { newMonth = 1; newYear += 1; }
      return { year: newYear, month: newMonth };
    });
  };
  const handleGoToDaily = (date: string) => {
    setGanttDailyDate(date);
    setGanttView('daily');
  };

  const bomColumns = useMemo<ColumnDef<Bom>[]>(
    () => [
      { accessorKey: 'parent_item_code', header: 'Item' },
      { accessorKey: 'version', header: 'Versi', cell: ({ row }) => `v${row.original.version}` },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={bomStatusBadgeVariant[row.original.status] ?? 'secondary'}>{bomStatusLabels[row.original.status] ?? row.original.status}</Badge> },
      { id: 'yield', header: 'Hasil Standar', cell: ({ row }) => `${row.original.standard_yield_qty} ${row.original.standard_yield_uom}` },
      { id: 'lines', header: 'Jumlah Komponen', cell: ({ row }) => row.original.lines.length }
    ],
    []
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
              <CardTitle className="text-2xl">Dashboard PPIC</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Halaman ini khusus company_admin, general_manager, ppic_manager, atau ppic_staff.</p>
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
          <h1 className="text-2xl font-semibold text-foreground">PPIC</h1>
        </div>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Approval</CardDescription>
            <CardTitle className="text-xl">PO Client Menunggu Approval PPIC</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {approvalsError ? <p className="text-sm text-destructive">{approvalsError}</p> : null}
            {approvalMessage ? <p className="text-sm text-destructive">{approvalMessage}</p> : null}
            {approvalsLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : <DataTable columns={approvalColumns} data={approvals} emptyMessage="Tidak ada PO client menunggu approval PPIC." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Produksi</CardDescription>
            <CardTitle className="text-xl">Work Order & Status Kesiapan</CardTitle>
          </CardHeader>
          <CardContent>
            {woError ? <p className="text-sm text-destructive">{woError}</p> : null}
            {woLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : <DataTable columns={woColumns} data={workOrders} emptyMessage="Belum ada Work Order." />}
            <div className="mt-3">
              <Link href="/work-orders" className="text-sm text-muted-foreground underline">
                Buka halaman Work Order lengkap
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">K8 — Standar Ber-Asal-Usul</CardDescription>
            <CardTitle className="text-xl">Usulan Standar Produksi Menunggu Keputusan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Sistem mengusulkan pembaruan standar dari sampel batch nyata — TIDAK PERNAH diterapkan otomatis. Sahkan atau tolak di sini; nilai lama tetap dipakai sampai Anda memutuskan.
            </p>
            {proposalsError ? <p className="text-sm text-destructive">{proposalsError}</p> : null}
            {proposalMessage ? <p className="text-sm text-destructive">{proposalMessage}</p> : null}
            {proposalsLoading ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : proposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada usulan menunggu keputusan saat ini.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-data">
                  <thead>
                    <tr className="border-b">
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Metrik</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Nilai Lama</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Nilai Usulan</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Dampak</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Metode / n</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposals.map((p) => (
                      <tr key={p.production_standard_proposal_id} className="border-b last:border-0">
                        <td className="px-3 py-1.5">
                          {p.item_code ?? p.item_name}
                          {p.routing_step_name ? <span className="text-xs text-muted-foreground"> · {p.routing_step_name}</span> : null}
                        </td>
                        <td className="px-3 py-1.5">{metricKeyLabels[p.metric_key] ?? p.metric_key}</td>
                        <td className="px-3 py-1.5">
                          {p.old_value ?? '-'} <span className="text-xs text-muted-foreground">({p.old_source ?? 'belum ada'})</span>
                        </td>
                        <td className="px-3 py-1.5 font-medium text-foreground">
                          {p.proposed_value}
                          {p.will_flip_to_dipelajari ? <Badge variant="warning" className="ml-2">akan jadi DIPELAJARI</Badge> : null}
                        </td>
                        <td className="px-3 py-1.5">{p.change_pct === null ? '-' : `${p.change_pct > 0 ? '+' : ''}${p.change_pct}%`}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          {p.calculation_method === 'median' ? 'Median' : 'Rata-rata (buang outlier)'} · n={p.sample_count}
                        </td>
                        <td className="px-3 py-1.5">
                          {canDecideProductionStandardProposal(role) ? (
                            <div className="flex gap-2">
                              <Button size="sm" disabled={proposalBusyId === p.production_standard_proposal_id} onClick={() => handleDecideProposal(p.production_standard_proposal_id, 'approved')}>
                                Sahkan
                              </Button>
                              <Button size="sm" variant="destructive" disabled={proposalBusyId === p.production_standard_proposal_id} onClick={() => handleDecideProposal(p.production_standard_proposal_id, 'rejected')}>
                                Tolak
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Hanya planner</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Perencanaan Kapasitas</CardDescription>
            <CardTitle className="text-xl">Kapasitas per Work Center — Minggu Ini</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Jam terjadwal dihitung dari batch produksi aktif minggu ini (Senin–Minggu). Kapasitas tersedia = kapasitas per hari × {workingDaysPerWeek} hari kerja/minggu.
            </p>
            {capacityError ? <p className="text-sm text-destructive">{capacityError}</p> : null}
            {capacityMessage ? <p className="text-sm text-destructive">{capacityMessage}</p> : null}
            {capacityLoading ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : capacity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada Work Center aktif.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-data">
                  <thead>
                    <tr className="border-b">
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Work Center</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Lokasi</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Kapasitas/Hari</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Kapasitas Minggu Ini</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Jam Terjadwal</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Utilisasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capacity.map((wc) => (
                      <tr key={wc.work_center_id} className="border-b last:border-0">
                        <td className="px-3 py-1.5">
                          {wc.name}
                          {wc.code ? <span className="text-xs text-muted-foreground"> ({wc.code})</span> : null}
                        </td>
                        <td className="px-3 py-1.5">{wc.production_plant_name ?? '-'}</td>
                        <td className="px-3 py-1.5">
                          {canManageWorkCenterCapacity(role) ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                step="0.5"
                                placeholder="jam"
                                className="h-8 w-20"
                                value={capacityEdits[wc.work_center_id] ?? (wc.capacity_hours_per_day !== null ? String(wc.capacity_hours_per_day) : '')}
                                onChange={(event) => setCapacityEdits((prev) => ({ ...prev, [wc.work_center_id]: event.target.value }))}
                              />
                              <Button size="sm" variant="outline" disabled={capacitySavingId === wc.work_center_id} onClick={() => handleSaveCapacity(wc.work_center_id)}>
                                {capacitySavingId === wc.work_center_id ? '...' : 'Simpan'}
                              </Button>
                            </div>
                          ) : wc.capacity_hours_per_day !== null ? (
                            `${wc.capacity_hours_per_day} jam`
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        {wc.capacity_hours_per_day === null ? (
                          <td className="px-3 py-1.5 text-muted-foreground" colSpan={3}>
                            Kapasitas belum diatur
                          </td>
                        ) : (
                          <>
                            <td className="px-3 py-1.5">{wc.total_capacity_hours} jam</td>
                            <td className="px-3 py-1.5">{wc.scheduled_hours} jam</td>
                            <td className="px-3 py-1.5">
                              <Badge variant={utilizationBadgeVariant(wc.utilization_pct ?? 0)}>{wc.utilization_pct}%</Badge>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Perencanaan Kapasitas</CardDescription>
            <CardTitle className="text-xl">Gantt Produksi per Work Center</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Blok = 1 tahap routing per batch. Posisi tanggal dihitung dari waktu aktif + waktu tunggu tahap-tahap sebelumnya (mis. tahap sesudah curing 48 jam baru muncul 2 hari kemudian); lebar blok cuma durasi aktif mesin (waktu tunggu tidak menyibukkan mesin, beda dari posisinya). Klik blok untuk lihat detail.
                {ganttView === 'weekly' ? ' Seret batch berstatus Direncanakan untuk jadwalkan ulang (tetap di Work Center yang sama) — batch yang sudah berjalan/selesai tidak bisa diseret.' : ''}
              </p>
              <div className="flex items-center gap-1 border">
                <Button size="sm" variant={ganttView === 'daily' ? 'default' : 'ghost'} className="rounded-none" onClick={() => setGanttView('daily')}>
                  Harian
                </Button>
                <Button size="sm" variant={ganttView === 'weekly' ? 'default' : 'ghost'} className="rounded-none" onClick={() => setGanttView('weekly')}>
                  Mingguan
                </Button>
                <Button size="sm" variant={ganttView === 'monthly' ? 'default' : 'ghost'} className="rounded-none" onClick={() => setGanttView('monthly')}>
                  Bulanan
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {ganttView === 'weekly' ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setGanttWeekOffset((prev) => prev - 1)}>
                    ← Minggu Sebelumnya
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setGanttWeekOffset(0)} disabled={ganttWeekOffset === 0}>
                    Minggu Ini
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setGanttWeekOffset((prev) => prev + 1)}>
                    Minggu Berikutnya →
                  </Button>
                </div>
              ) : ganttView === 'daily' ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleShiftDailyDate(-1)}>
                    ← Hari Sebelumnya
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setGanttDailyDate(dateToDateString(new Date()))} disabled={ganttDailyDate === dateToDateString(new Date())}>
                    Hari Ini
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleShiftDailyDate(1)}>
                    Hari Berikutnya →
                  </Button>
                  <span className="text-sm font-medium text-foreground">{ganttDailyDate}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleShiftMonth(-1)}>
                    ← Bulan Sebelumnya
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { const now = new Date(); setGanttMonth({ year: now.getFullYear(), month: now.getMonth() + 1 }); }}
                    disabled={(() => { const now = new Date(); return ganttMonth.year === now.getFullYear() && ganttMonth.month === now.getMonth() + 1; })()}
                  >
                    Bulan Ini
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleShiftMonth(1)}>
                    Bulan Berikutnya →
                  </Button>
                  <span className="text-sm font-medium text-foreground">
                    {MONTH_LABELS[ganttMonth.month - 1]} {ganttMonth.year}
                  </span>
                </div>
              )}
            </div>

            {ganttError ? <p className="text-sm text-destructive">{ganttError}</p> : null}
            {dragMessage ? <p className="text-sm text-destructive">{dragMessage}</p> : null}
            {ganttLoading ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : ganttWorkCenters.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada Work Center aktif.</p>
            ) : ganttView === 'weekly' ? (
              // pointerWithin (bukan default rectIntersection) — target drop ditentukan dari
              // posisi KURSOR, bukan dari area tumpang-tindih rect elemen yang diseret. Penting
              // untuk baris "Belum Dijadwalkan" yang jauh lebih lebar dari 1 kolom hari: dengan
              // rectIntersection, rect elemen lebar itu bisa "nyerempet" kolom tetangga dan
              // drop mendarat di kolom yang salah walau kursor sudah tepat di kolom yang dituju.
              <DndContext
                sensors={dndSensors}
                collisionDetection={pointerWithin}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => { setActiveDragWorkCenterId(null); setActiveDragLabel(null); }}
              >
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full table-fixed text-data">
                    <thead>
                      <tr className="border-b">
                        <th className="h-8 w-36 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Work Center</th>
                        {ganttDays.map((day, index) => (
                          <th key={day} className="h-8 w-32 px-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {formatDayLabel(day, index)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ganttWorkCenters.map((wc) => {
                        const restrictedRow = activeDragWorkCenterId !== null && activeDragWorkCenterId !== wc.work_center_id;
                        return (
                          <tr key={wc.work_center_id} className={`border-b align-top last:border-0 transition-opacity ${restrictedRow ? 'opacity-40' : ''}`}>
                            <td className="px-3 py-2 font-medium text-foreground">
                              {wc.name}
                              {wc.code ? <span className="text-xs font-normal text-muted-foreground"> ({wc.code})</span> : null}
                            </td>
                            {ganttDays.map((day) => {
                              const cellBlocks = ganttBlocksByCell.get(`${wc.work_center_id}_${day}`) ?? [];
                              return (
                                <DroppableCell key={day} workCenterId={wc.work_center_id} date={day} restrictedRow={restrictedRow}>
                                  {cellBlocks.map((block, i) => (
                                    <DraggableBlock key={`${block.production_batch_id}_${block.sequence_no}_${i}`} block={block} canDrag={canManageWorkOrder(role)} onOpenDetail={handleOpenBlockDetail} />
                                  ))}
                                </DroppableCell>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div>
                  <p className="mb-2 mt-3 text-sm font-medium text-foreground">Belum Dijadwalkan (planned_date kosong)</p>
                  {ganttUnscheduled.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Semua batch aktif sudah punya tanggal rencana.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {ganttUnscheduled.map((b) => (
                        <DraggableUnscheduled key={b.production_batch_id} batch={b} canDrag={canManageWorkOrder(role)} />
                      ))}
                    </div>
                  )}
                </div>

                <DragOverlay>{activeDragLabel ? <div className="border-l-2 border-info bg-info-subtle px-2 py-1 text-xs font-medium text-info-subtle-foreground shadow">{activeDragLabel}</div> : null}</DragOverlay>
              </DndContext>
            ) : ganttView === 'daily' ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Tampilan Harian cuma untuk lihat jadwal (tidak bisa diseret) — jangkar jam pakai jam mulai shift batch (kalau ada), pakai offset kumulatif yang sama dengan tampilan Mingguan.
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full table-fixed text-data">
                    <thead>
                      <tr className="border-b">
                        <th className="h-8 w-36 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Work Center</th>
                        {Array.from({ length: 24 }, (_, h) => h).map((hour) => (
                          <th key={hour} className="h-8 w-20 px-1 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {String(hour).padStart(2, '0')}:00
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ganttWorkCenters.map((wc) => (
                        <tr key={wc.work_center_id} className="border-b align-top last:border-0">
                          <td className="px-3 py-2 font-medium text-foreground">
                            {wc.name}
                            {wc.code ? <span className="text-xs font-normal text-muted-foreground"> ({wc.code})</span> : null}
                          </td>
                          {Array.from({ length: 24 }, (_, h) => h).map((hour) => {
                            const cellBlocks = ganttBlocksByHourCell.get(`${wc.work_center_id}_${hour}`) ?? [];
                            return (
                              <td key={hour} className="px-1 py-1.5 align-top">
                                <div className="flex flex-col gap-1">
                                  {cellBlocks.map((block, i) => (
                                    <div
                                      key={`${block.production_batch_id}_${block.sequence_no}_${i}`}
                                      onClick={() => handleOpenBlockDetail(block)}
                                      title="Klik untuk lihat detail"
                                      className="cursor-pointer select-none border-l-2 border-info bg-info-subtle px-1 py-1 text-[10px] text-info-subtle-foreground"
                                    >
                                      <div className="font-medium">{formatHourLabel(block.minute_of_day)} · {block.batch_number}</div>
                                      <div className="truncate">{block.item_code ?? block.item_name}</div>
                                      <div className="text-muted-foreground">{block.step_name}</div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Angka = jumlah batch yang punya tahap pada hari itu di Work Center tersebut. Klik tanggal untuk lihat detail Harian.</p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full table-fixed text-data">
                    <thead>
                      <tr className="border-b">
                        <th className="h-8 w-36 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Work Center</th>
                        {ganttDays.map((day) => (
                          <th key={day} className="h-8 w-12 px-0 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <button type="button" onClick={() => handleGoToDaily(day)} className="w-full hover:underline" title={`Lihat tampilan Harian untuk ${day}`}>
                              {day.slice(-2)}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ganttWorkCenters.map((wc) => (
                        <tr key={wc.work_center_id} className="border-b align-top last:border-0">
                          <td className="px-3 py-2 font-medium text-foreground">
                            {wc.name}
                            {wc.code ? <span className="text-xs font-normal text-muted-foreground"> ({wc.code})</span> : null}
                          </td>
                          {ganttDays.map((day) => {
                            const entry = ganttMonthlySummaryByCell.get(`${wc.work_center_id}_${day}`);
                            if (!entry) {
                              return (
                                <td key={day} className="px-1 py-2 text-center text-muted-foreground">
                                  ·
                                </td>
                              );
                            }
                            const capacityMinutes = wc.capacity_hours_per_day ? wc.capacity_hours_per_day * 60 : null;
                            const variant = capacityMinutes ? utilizationBadgeVariant((entry.active_minutes / capacityMinutes) * 100) : 'secondary';
                            return (
                              <td key={day} className="px-1 py-2 text-center">
                                <button type="button" onClick={() => handleGoToDaily(day)} title={`${entry.batch_count} batch · ${Math.round(entry.active_minutes)} mnt aktif — klik untuk detail Harian`}>
                                  <Badge variant={variant}>{entry.batch_count}</Badge>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Resep</CardDescription>
            <CardTitle className="text-xl">BOM</CardTitle>
          </CardHeader>
          <CardContent>
            {bomsError ? <p className="text-sm text-destructive">{bomsError}</p> : null}
            {bomsLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : <DataTable columns={bomColumns} data={boms} emptyMessage="Belum ada BOM." />}
            <div className="mt-3">
              <Link href="/boms" className="text-sm text-muted-foreground underline">
                Buka halaman BOM lengkap
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{blockDetail ? `${blockDetail.batch.batch_number} — ${blockDetail.step.step_name}` : 'Detail Tahap Produksi'}</DialogTitle>
            <DialogDescription>{blockDetail?.item ? (blockDetail.item.item_code ?? blockDetail.item.item_name) : ''}</DialogDescription>
          </DialogHeader>

          {blockDetailLoading ? <p className="text-sm text-muted-foreground">Memuat detail...</p> : null}
          {blockDetailError ? <p className="text-sm text-destructive">{blockDetailError}</p> : null}

          {blockDetail && !blockDetailLoading ? (
            <div className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-none border p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">No. Batch</div>
                <div className="text-right font-medium">{blockDetail.batch.batch_number}</div>

                <div className="text-xs uppercase tracking-wide text-muted-foreground">Item</div>
                <div className="text-right">{blockDetail.item?.item_code ?? blockDetail.item?.item_name ?? '-'}</div>

                <div className="text-xs uppercase tracking-wide text-muted-foreground">Nama Tahap</div>
                <div className="text-right">{blockDetail.step.step_name}</div>

                <div className="text-xs uppercase tracking-wide text-muted-foreground">Work Center</div>
                <div className="text-right">{blockDetail.workCenter ? `${blockDetail.workCenter.name}${blockDetail.workCenter.code ? ` (${blockDetail.workCenter.code})` : ''}` : '-'}</div>

                <div className="text-xs uppercase tracking-wide text-muted-foreground">Tanggal Rencana</div>
                <div className="text-right">{blockDetail.batch.planned_date ?? '-'}</div>

                <div className="text-xs uppercase tracking-wide text-muted-foreground">Durasi Aktif</div>
                <div className="text-right">{blockDetail.step.active_duration_minutes} mnt</div>

                <div className="text-xs uppercase tracking-wide text-muted-foreground">Durasi Tunggu</div>
                <div className="text-right">{blockDetail.step.wait_duration_minutes} mnt</div>

                {blockDetail.shift ? (
                  <>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Shift</div>
                    <div className="text-right">
                      {blockDetail.shift.name} ({blockDetail.shift.start_time}–{blockDetail.shift.end_time})
                    </div>
                  </>
                ) : null}

                <div className="text-xs uppercase tracking-wide text-muted-foreground">Status Batch</div>
                <div className="text-right">
                  <Badge variant={statusBadgeVariant[blockDetail.batch.status] ?? 'secondary'}>{statusLabels[blockDetail.batch.status] ?? blockDetail.batch.status}</Badge>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Pekerja Ditugaskan</p>
                {blockDetail.assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada pekerja yang ditugaskan ke tahap ini.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {blockDetail.assignments.map((a) => (
                      <div key={a.work_order_assignment_id} className="flex items-center justify-between border-b py-1 last:border-0">
                        <div>
                          <span className="font-medium text-foreground">{a.employee_name ?? '-'}</span>
                          {a.employee_position ? <span className="text-xs text-muted-foreground"> · {a.employee_position}</span> : null}
                        </div>
                        <span className="text-xs text-muted-foreground">{assignmentStatusLabels[a.status] ?? a.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Progres Tercatat</p>
                  <Button size="sm" variant="outline" onClick={handleOpenYieldSummary}>
                    Ringkasan Yield Batch
                  </Button>
                </div>
                {blockDetail.progress.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada progres tercatat untuk tahap ini.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {blockDetail.progress.map((p) => (
                      <div key={p.work_order_step_progress_id} className="border-b py-1 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{progressStatusLabels[p.status] ?? p.status}</span>
                          <span className="text-xs text-muted-foreground">
                            Input: {p.qty_input !== null ? `${p.qty_input} ${p.uom_input ?? ''}` : '-'} → Output: {p.qty_recorded !== null ? `${p.qty_recorded} ${p.uom ?? ''}` : '-'}
                            {p.shrinkage_pct !== null ? ` · Susut ${p.shrinkage_pct}%` : ''}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Mulai: {formatDateTime(p.started_at)} · Selesai: {formatDateTime(p.completed_at)}
                        </div>
                        {p.notes ? <div className="text-xs text-muted-foreground">Catatan: {p.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canRecordStepProgress(role) ? (
                <div className="border-t pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Catat Progres Tahap Ini</p>
                  {progressSuggestion ? (
                    <p className="mb-2 text-xs text-muted-foreground">
                      Jumlah masuk disarankan: <span className="font-medium text-foreground">{progressSuggestion.qty} {progressSuggestion.uom ?? ''}</span>{' '}
                      ({progressSuggestion.source === 'previous_step' ? 'dari output tahap sebelumnya' : 'dari planned_qty batch — tahap pertama/belum ada data sebelumnya'}) — bisa diubah.
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs text-muted-foreground">Status</label>
                      <Select value={progressForm.status} onValueChange={(v) => setProgressForm((prev) => ({ ...prev, status: v }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Belum Mulai</SelectItem>
                          <SelectItem value="in_progress">Berjalan</SelectItem>
                          <SelectItem value="completed">Selesai</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Jumlah Masuk (Input)</label>
                      <Input type="number" step="any" value={progressForm.qty_input} onChange={(e) => setProgressForm((prev) => ({ ...prev, qty_input: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Satuan Masuk</label>
                      <Input value={progressForm.uom_input} onChange={(e) => setProgressForm((prev) => ({ ...prev, uom_input: e.target.value }))} placeholder="mis. kg" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Jumlah Keluar (Output)</label>
                      <Input type="number" step="any" value={progressForm.qty_recorded} onChange={(e) => setProgressForm((prev) => ({ ...prev, qty_recorded: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Satuan Keluar</label>
                      <Input value={progressForm.uom} onChange={(e) => setProgressForm((prev) => ({ ...prev, uom: e.target.value }))} placeholder="mis. kg" />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs text-muted-foreground">Catatan (opsional)</label>
                      <Input value={progressForm.notes} onChange={(e) => setProgressForm((prev) => ({ ...prev, notes: e.target.value }))} />
                    </div>
                  </div>
                  {progressFormMessage ? <p className={`mt-2 text-sm ${progressFormStatus === 'error' ? 'text-destructive' : 'text-success'}`}>{progressFormMessage}</p> : null}
                  <Button size="sm" className="mt-2" disabled={progressFormStatus === 'saving'} onClick={handleSubmitProgress}>
                    {progressFormStatus === 'saving' ? 'Menyimpan...' : 'Simpan Progres'}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={yieldOpen} onOpenChange={setYieldOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Ringkasan Yield {yieldSummary ? `— ${yieldSummary.batch_number}` : 'Batch'}</DialogTitle>
            <DialogDescription>Input → output → % susut tiap tahap, dan total yield keseluruhan batch.</DialogDescription>
          </DialogHeader>
          {yieldLoading ? <p className="text-sm text-muted-foreground">Memuat ringkasan yield...</p> : null}
          {yieldError ? <p className="text-sm text-destructive">{yieldError}</p> : null}
          {yieldSummary && !yieldLoading ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="overflow-x-auto rounded-none border">
                <table className="w-full text-data">
                  <thead>
                    <tr className="border-b">
                      <th className="h-8 px-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tahap</th>
                      <th className="h-8 px-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Input</th>
                      <th className="h-8 px-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Output</th>
                      <th className="h-8 px-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Susut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yieldSummary.steps.map((s) => (
                      <tr key={s.routing_step_id} className="border-b last:border-0">
                        <td className="px-2 py-1.5">
                          {s.sequence_no}. {s.step_name}
                        </td>
                        <td className="px-2 py-1.5">{s.qty_input !== null ? `${s.qty_input} ${s.uom_input ?? ''}` : '-'}</td>
                        <td className="px-2 py-1.5">{s.qty_recorded !== null ? `${s.qty_recorded} ${s.uom ?? ''}` : '-'}</td>
                        <td className="px-2 py-1.5">{s.shrinkage_pct !== null ? `${s.shrinkage_pct}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm font-medium text-foreground">Total Yield Batch</span>
                <span className="text-lg font-semibold text-foreground">{yieldSummary.total_yield_pct !== null ? `${yieldSummary.total_yield_pct}%` : 'Belum bisa dihitung'}</span>
              </div>
              <p className="text-xs text-muted-foreground">Total Yield = Output tahap terakhir ÷ Input tahap pertama × 100%.</p>

              {canProposeProductionStandard(role) ? (
                <div className="border-t pt-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    K8 — kalau batch ini SUDAH selesai semua tahapnya, ajukan datanya sebagai sampel belajar standar produksi (yield, unit/batch, durasi tiap tahap). Batch dengan log tahap belum lengkap otomatis DIKECUALIKAN (dilaporkan, bukan dilewati diam-diam).
                  </p>
                  <Button size="sm" variant="outline" disabled={learnStatus === 'pending'} onClick={handleLearnFromBatch}>
                    {learnStatus === 'pending' ? 'Memproses...' : 'Ajukan sebagai Sampel Standar'}
                  </Button>
                  {learnMessage ? <p className={`mt-2 text-sm ${learnStatus === 'error' ? 'text-destructive' : 'text-foreground'}`}>{learnMessage}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

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
import { canAccessPpicDashboard, canManageWorkCenterCapacity, canManageWorkOrder } from '@/lib/roles';

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

type GanttWorkCenter = { work_center_id: number; name: string; code: string | null };
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
};

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
  qty_recorded: number | null;
  uom: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
};
type BlockDetail = {
  batch: { production_batch_id: number; batch_number: string; planned_qty: number; uom: string; planned_date: string | null; status: string; started_at: string | null; completed_at: string | null };
  item: { item_code: string | null; item_name: string | null } | null;
  step: { step_name: string; sequence_no: number; active_duration_minutes: number; wait_duration_minutes: number };
  workCenter: { name: string; code: string | null } | null;
  shift: { name: string; start_time: string; end_time: string } | null;
  assignments: BlockDetailAssignment[];
  progress: BlockDetailProgress[];
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

function formatDayLabel(dateStr: string, index: number): string {
  const [, m, d] = dateStr.split('-');
  return `${DAY_LABELS[index]} ${d}/${m}`;
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

  const [ganttWeekOffset, setGanttWeekOffset] = useState(0);
  const [ganttDays, setGanttDays] = useState<string[]>([]);
  const [ganttWorkCenters, setGanttWorkCenters] = useState<GanttWorkCenter[]>([]);
  const [ganttBlocks, setGanttBlocks] = useState<GanttBlock[]>([]);
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
    async (offset: number) => {
      setGanttLoading(true);
      const { ok, body } = await authedFetch(`/api/work-centers/gantt?week_offset=${offset}`);
      if (!ok) {
        setGanttError(body.error || 'Gagal memuat Gantt produksi.');
        setGanttLoading(false);
        return;
      }
      setGanttDays(body.days || []);
      setGanttWorkCenters(body.workCenters || []);
      setGanttBlocks(body.blocks || []);
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
      const { ok, body } = await authedFetch(`/api/production-batches/step-detail?production_batch_id=${block.production_batch_id}&routing_step_id=${block.routing_step_id}`);
      setBlockDetailLoading(false);
      if (!ok) {
        setBlockDetailError(body.error || 'Gagal memuat detail tahap ini.');
        return;
      }
      setBlockDetail(body as BlockDetail);
    },
    [authedFetch]
  );

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
      await Promise.all([loadApprovals(), loadWorkOrders(), loadBoms(), loadCapacity()]);
    };
    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadApprovals, loadWorkOrders, loadBoms, loadCapacity]);

  // Terpisah dari effect di atas supaya navigasi minggu (ganttWeekOffset berubah)
  // cukup reload Gantt-nya saja, tidak mengulang approval/WO/BOM/capacity.
  useEffect(() => {
    if (checkingAccess || accessDenied) return;
    loadGantt(ganttWeekOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganttWeekOffset, checkingAccess, accessDenied]);

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
    await Promise.all([loadGantt(ganttWeekOffset), loadCapacity()]);
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
                Blok = 1 tahap routing per batch. Posisi tanggal dihitung dari waktu aktif + waktu tunggu tahap-tahap sebelumnya (mis. tahap sesudah curing 48 jam baru muncul 2 hari kemudian); lebar blok cuma durasi aktif mesin (waktu tunggu tidak menyibukkan mesin, beda dari posisinya). Klik blok untuk lihat detail. Seret batch berstatus Direncanakan untuk jadwalkan ulang (tetap di Work Center yang sama) — batch yang sudah berjalan/selesai tidak bisa diseret.
              </p>
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
            </div>
            {ganttError ? <p className="text-sm text-destructive">{ganttError}</p> : null}
            {dragMessage ? <p className="text-sm text-destructive">{dragMessage}</p> : null}
            {ganttLoading ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : ganttWorkCenters.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada Work Center aktif.</p>
            ) : (
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
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Progres Tercatat</p>
                {blockDetail.progress.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada progres tercatat untuk tahap ini.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {blockDetail.progress.map((p) => (
                      <div key={p.work_order_step_progress_id} className="border-b py-1 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{progressStatusLabels[p.status] ?? p.status}</span>
                          <span className="text-xs text-muted-foreground">{p.qty_recorded !== null ? `${p.qty_recorded} ${p.uom ?? ''}` : '-'}</span>
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
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { canManageWorkOrder } from '@/lib/roles';
import { workOrderPriorities } from '../server/workOrderValidation';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { formatNumberId } from '@/lib/currency';

const priorityLabels: Record<string, string> = { low: 'Rendah', normal: 'Normal', high: 'Tinggi', urgent: 'Mendesak' };
const priorityBadgeVariant: Record<string, 'secondary' | 'info' | 'warning' | 'critical'> = { low: 'secondary', normal: 'info', high: 'warning', urgent: 'critical' };

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

type WorkOrder = {
  work_order_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  bom_id: number;
  routing_id: number | null;
  production_plant_id: number;
  production_plant_name: string | null;
  sales_order_line_id: number | null;
  so_number: string | null;
  customer_id: number | null;
  planned_qty: number;
  status: string;
  priority: string;
  readiness: string;
  open_alert_count: number;
};

type SoLine = {
  sales_order_line_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  qty_ordered: number;
  unit_price: number | null;
  qty_already_planned_in_wo: number;
};
type SalesOrder = { sales_order_id: number; so_number: string; customer_id: number; customer_name: string | null; production_plant_id: number; status: string; lines: SoLine[] };

type Bom = {
  bom_id: number;
  parent_item_id: number;
  parent_item_code: string | null;
  parent_item_name: string | null;
  version: number;
  status: string;
  standard_yield_qty: number;
  standard_yield_uom: string;
  buffer_percentage: number | null;
  lines: { component_item_id: number; component_item_code: string | null; component_item_name: string | null; qty_per_unit_output: number; uom: string }[];
};
type PlantOption = { production_plant_id: number; name: string; is_active: boolean };
type RoutingStep = { routing_step_id: number; sequence_no: number; step_name: string };
type RoutingOption = { routing_id: number; item_id: number; version: number; steps: RoutingStep[] };
type EmployeeOption = { employee_id: number; name: string; position: string | null; is_active: boolean };

type ProductionBatch = {
  production_batch_id: number;
  batch_number: string;
  planned_qty: number;
  planned_date: string | null;
  uom: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

const batchStatusLabels: Record<string, string> = { planned: 'Direncanakan', in_progress: 'Berjalan', completed: 'Selesai', cancelled: 'Batal' };
const batchStatusBadgeVariant: Record<string, 'info' | 'warning' | 'success' | 'critical'> = { planned: 'info', in_progress: 'warning', completed: 'success', cancelled: 'critical' };

type Lot = {
  lot_id: number;
  item_id: number;
  lot_number: string;
  expiry_date: string | null;
  quantity_on_hand: number;
  source_type: string;
  unit_cost: number | null;
  source_customer_id: number | null;
};

export default function WorkOrdersPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const canManage = canManageWorkOrder(role);

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [woError, setWoError] = useState('');
  const [woLoading, setWoLoading] = useState(true);

  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [routings, setRoutings] = useState<RoutingOption[]>([]);
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  const [expandedWoId, setExpandedWoId] = useState<number | null>(null);
  const [lotsForExpanded, setLotsForExpanded] = useState<Lot[]>([]);
  const [consumptionForm, setConsumptionForm] = useState<Record<number, { lot_id: string; qty: string }>>({});
  const [consumptionMessage, setConsumptionMessage] = useState<Record<number, string>>({});

  const [batchesForExpanded, setBatchesForExpanded] = useState<ProductionBatch[]>([]);
  const [batchPlannedQty, setBatchPlannedQty] = useState('');
  const [batchPlannedDate, setBatchPlannedDate] = useState(todayDateString());
  const [batchNumberOverride, setBatchNumberOverride] = useState('');
  const [batchFormStatus, setBatchFormStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [batchFormMessage, setBatchFormMessage] = useState('');
  const [consumptionBatchId, setConsumptionBatchId] = useState('');
  // Sesi 6A (21 Agu 2026) — "Kebutuhan Bahan" utk batch yang SUDAH DIMULAI wajib
  // pakai baris BOM BEKU milik batch itu (snapshot), bukan bom_lines hidup --
  // null berarti belum di-fetch/batch belum dimulai (jatuh balik ke expandedBom
  // hidup seperti sebelumnya).
  const [batchBomSnapshot, setBatchBomSnapshot] = useState<{
    has_snapshot: boolean;
    buffer_percentage: number | null;
    lines: { component_item_id: number; component_item_code: string | null; component_item_name: string | null; qty_per_unit_output: number; uom: string }[];
  } | null>(null);

  const [laborForm, setLaborForm] = useState({ employee_id: '', routing_step_id: '', hours: '', work_date: todayDateString(), is_overtime: false });
  const [laborStatus, setLaborStatus] = useState<'idle' | 'pending' | 'success' | 'warning' | 'error'>('idle');
  const [laborMessage, setLaborMessage] = useState('');

  const [form, setForm] = useState({
    sales_order_id: '',
    sales_order_line_id: '',
    bom_id: '',
    routing_id: '',
    production_plant_id: '',
    planned_qty: '',
    priority: 'normal',
    scheduled_start: '',
    scheduled_end: ''
  });
  const [formStatus, setFormStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [formMessage, setFormMessage] = useState('');
  // FASE 3 (Carbon "DataTable with toolbar") — form "Buat Work Order" pindah dari
  // Card inline di bawah tabel ke modal, dipicu tombol di toolbar DataTable. Field,
  // validasi, dan handleSubmit di bawah TIDAK diubah sama sekali, cuma wadahnya.
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
      const body = await response.json();
      return { ok: response.ok, status: response.status, body };
    },
    [getAccessToken]
  );

  const loadWorkOrders = useCallback(async () => {
    setWoLoading(true);
    const { ok, body } = await authedFetch('/api/work-orders');
    if (!ok) {
      setWoError(body.error || 'Gagal memuat daftar Work Order.');
      setWoLoading(false);
      return;
    }
    setWorkOrders(body.workOrders || []);
    setWoError('');
    setWoLoading(false);
  }, [authedFetch]);

  const loadSalesOrders = useCallback(async () => {
    const { ok, body } = await authedFetch('/api/sales-orders');
    if (ok) setSalesOrders(body.salesOrders || []);
  }, [authedFetch]);

  const loadBoms = useCallback(async () => {
    const { ok, body } = await authedFetch('/api/boms');
    if (ok) setBoms(body.boms || []);
  }, [authedFetch]);

  const loadRoutings = useCallback(async () => {
    const { ok, body } = await authedFetch('/api/routings');
    if (ok) setRoutings(body.routings || []);
  }, [authedFetch]);

  const loadPlants = useCallback(async () => {
    const { ok, body } = await authedFetch('/api/production-plants');
    if (ok) setPlants((body.plants || []).filter((p: PlantOption) => p.is_active));
  }, [authedFetch]);

  const loadEmployees = useCallback(async () => {
    const { ok, body } = await authedFetch('/api/employees');
    if (ok) setEmployees((body.employees || []).filter((e: EmployeeOption) => e.is_active));
  }, [authedFetch]);

  useEffect(() => {
    if (!consumptionBatchId) {
      setBatchBomSnapshot(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await authedFetch(`/api/production-batches/${consumptionBatchId}/bom-snapshot`);
        if (!cancelled && result.ok) {
          setBatchBomSnapshot(
            result.body as {
              has_snapshot: boolean;
              buffer_percentage: number | null;
              lines: { component_item_id: number; component_item_code: string | null; component_item_name: string | null; qty_per_unit_output: number; uom: string }[];
            }
          );
        }
      } catch {
        // gagal diam-diam -- panel jatuh balik ke BOM hidup (perilaku lama), tidak menghalangi pencatatan konsumsi.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consumptionBatchId, authedFetch]);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/work-orders');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      if (!meResponse.ok) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }
      setRole(meData?.user?.role ?? null);
      // setCheckingAccess(false) SENGAJA menunggu Promise.all ini selesai dulu
      // (bukan sebelum, seperti pola di halaman lain) — toggleExpand() langsung
      // butuh `boms` sudah terisi begitu tabel WO jadi interaktif, supaya klik
      // "Detail" tidak pernah mencocokkan bom_id ke array yang masih kosong
      // (yang bikin komponen lot gagal ke-fetch sama sekali, tampak seolah lot
      // belum tersedia padahal datanya ada).
      await Promise.all([loadWorkOrders(), loadSalesOrders(), loadBoms(), loadRoutings(), loadPlants(), loadEmployees()]);
      setCheckingAccess(false);
    };
    checkAccessAndLoad();
  }, [router, loadWorkOrders, loadSalesOrders, loadBoms, loadRoutings, loadPlants, loadEmployees]);

  const selectedSo = salesOrders.find((so) => String(so.sales_order_id) === form.sales_order_id) ?? null;
  const selectedSoLine = selectedSo?.lines.find((line) => String(line.sales_order_line_id) === form.sales_order_line_id) ?? null;
  const selectedBom = boms.find((bom) => String(bom.bom_id) === form.bom_id) ?? null;
  // Kalau SO line dipilih, item WO ikut SO line itu. Kalau tidak (WO WIP di muka, belum
  // terikat SO), item ditentukan dari BOM yang dipilih langsung — PPIC yang putuskan.
  const effectiveItemId = selectedSoLine?.item_id ?? selectedBom?.parent_item_id ?? null;
  const availableBoms = selectedSoLine ? boms.filter((bom) => bom.parent_item_id === selectedSoLine.item_id) : boms;
  const availableRoutingsForItem = effectiveItemId ? routings.filter((r) => r.item_id === effectiveItemId) : [];

  const handleSelectSo = (soId: string) => {
    const so = salesOrders.find((s) => String(s.sales_order_id) === soId);
    setForm((prev) => ({
      ...prev,
      sales_order_id: soId,
      sales_order_line_id: '',
      bom_id: '',
      routing_id: '',
      production_plant_id: so ? String(so.production_plant_id) : prev.production_plant_id
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormStatus('pending');
    setFormMessage('');

    const payload = {
      production_plant_id: Number(form.production_plant_id),
      sales_order_line_id: form.sales_order_line_id ? Number(form.sales_order_line_id) : null,
      bom_id: Number(form.bom_id),
      routing_id: form.routing_id ? Number(form.routing_id) : null,
      planned_qty: Number(form.planned_qty),
      priority: form.priority,
      scheduled_start: form.scheduled_start || null,
      scheduled_end: form.scheduled_end || null
    };

    const { ok, body } = await authedFetch('/api/work-orders', { method: 'POST', body: JSON.stringify(payload) });
    if (!ok) {
      setFormStatus('error');
      setFormMessage(body.error || 'Gagal membuat Work Order.');
      return;
    }

    setFormStatus('success');
    setFormMessage('Work Order berhasil dibuat.');
    setForm({ sales_order_id: '', sales_order_line_id: '', bom_id: '', routing_id: '', production_plant_id: '', planned_qty: '', priority: 'normal', scheduled_start: '', scheduled_end: '' });
    setIsCreateModalOpen(false);
    await loadWorkOrders();
  };

  const loadBatchesForWo = useCallback(
    async (workOrderId: number) => {
      const { ok, body } = await authedFetch(`/api/production-batches?work_order_id=${workOrderId}`);
      if (ok) setBatchesForExpanded(body.batches || []);
    },
    [authedFetch]
  );

  const toggleExpand = async (wo: WorkOrder) => {
    if (expandedWoId === wo.work_order_id) {
      setExpandedWoId(null);
      return;
    }
    setExpandedWoId(wo.work_order_id);
    setBatchPlannedQty('');
    setBatchFormStatus('idle');
    setBatchFormMessage('');
    setConsumptionBatchId('');
    const bom = boms.find((b) => b.bom_id === wo.bom_id);
    const componentItemIds = bom ? bom.lines.map((line) => line.component_item_id) : [];
    if (componentItemIds.length > 0) {
      const { ok, body } = await authedFetch(`/api/lots?item_ids=${componentItemIds.join(',')}`);
      if (ok) setLotsForExpanded(body.lots || []);
    } else {
      setLotsForExpanded([]);
    }
    await loadBatchesForWo(wo.work_order_id);
  };

  const handleCreateBatch = async (wo: WorkOrder) => {
    const plannedQty = Number(batchPlannedQty);
    if (!plannedQty || plannedQty <= 0) {
      setBatchFormStatus('error');
      setBatchFormMessage('Planned qty batch harus lebih besar dari 0.');
      return;
    }
    setBatchFormStatus('pending');
    setBatchFormMessage('');
    const { ok, body } = await authedFetch('/api/production-batches', {
      method: 'POST',
      body: JSON.stringify({
        work_order_id: wo.work_order_id,
        planned_qty: plannedQty,
        planned_date: batchPlannedDate || undefined,
        batch_number: batchNumberOverride.trim() || undefined
      })
    });
    if (!ok) {
      setBatchFormStatus('error');
      setBatchFormMessage(body.error || 'Gagal membuat batch produksi.');
      return;
    }
    setBatchFormStatus('success');
    setBatchFormMessage(`Batch ${body.batch.batch_number} berhasil dibuat (rencana ${body.batch.planned_date}).`);
    setBatchPlannedQty('');
    setBatchPlannedDate(todayDateString());
    setBatchNumberOverride('');
    await loadBatchesForWo(wo.work_order_id);
  };

  const handleRecordConsumption = async (wo: WorkOrder, componentItemId: number) => {
    if (!consumptionBatchId) {
      setConsumptionMessage((prev) => ({ ...prev, [componentItemId]: 'Pilih batch produksi dulu di atas.' }));
      return;
    }
    const entry = consumptionForm[componentItemId];
    if (!entry?.lot_id || !entry?.qty) {
      setConsumptionMessage((prev) => ({ ...prev, [componentItemId]: 'Pilih lot dan isi jumlah pemakaian dulu.' }));
      return;
    }
    const { ok, body } = await authedFetch('/api/work-orders/consumption', {
      method: 'POST',
      body: JSON.stringify({ work_order_id: wo.work_order_id, production_batch_id: Number(consumptionBatchId), component_lot_id: Number(entry.lot_id), qty_consumed: Number(entry.qty) })
    });
    if (!ok) {
      setConsumptionMessage((prev) => ({ ...prev, [componentItemId]: body.error || 'Gagal mencatat pemakaian.' }));
      return;
    }
    setConsumptionMessage((prev) => ({ ...prev, [componentItemId]: 'Pemakaian tercatat, stok lot ini otomatis berkurang.' }));
    setConsumptionForm((prev) => ({ ...prev, [componentItemId]: { lot_id: '', qty: '' } }));
    const { ok: lotsOk, body: lotsBody } = await authedFetch(`/api/lots?item_ids=${Array.from(new Set(lotsForExpanded.map((l) => l.item_id))).join(',')}`);
    if (lotsOk) setLotsForExpanded(lotsBody.lots || []);
    await loadWorkOrders();
  };

  // Labor log — tim produksi = pool bergilir (klarifikasi pemilik produk), jadi
  // SENGAJA tidak ada validasi "orang ini sudah ditugaskan di tempat lain hari ini";
  // 1 orang wajar dicatat di banyak tahap/batch berbeda hari yang sama. Server
  // mengirim `warning` (bukan error) kalau total jamnya hari itu melebihi jam kerja
  // efektif — tetap tersimpan, cuma ditampilkan supaya bisa dicek ulang.
  const handleRecordLabor = async (wo: WorkOrder) => {
    if (!consumptionBatchId) {
      setLaborStatus('error');
      setLaborMessage('Pilih batch produksi dulu di bagian Catat Pemakaian Bahan di atas.');
      return;
    }
    if (!laborForm.employee_id || !laborForm.hours) {
      setLaborStatus('error');
      setLaborMessage('Pilih karyawan dan isi jam kerja dulu.');
      return;
    }
    setLaborStatus('pending');
    setLaborMessage('');
    const { ok, body } = await authedFetch('/api/work-orders/labor-log', {
      method: 'POST',
      body: JSON.stringify({
        work_order_id: wo.work_order_id,
        production_batch_id: Number(consumptionBatchId),
        employee_id: Number(laborForm.employee_id),
        routing_step_id: laborForm.routing_step_id ? Number(laborForm.routing_step_id) : null,
        actual_hours: Number(laborForm.hours),
        work_date: laborForm.work_date,
        is_overtime: laborForm.is_overtime
      })
    });
    if (!ok) {
      setLaborStatus('error');
      setLaborMessage(body.error || 'Gagal mencatat jam kerja.');
      return;
    }
    setLaborStatus(body.warning ? 'warning' : 'success');
    setLaborMessage(body.warning || 'Jam kerja tercatat.');
    setLaborForm((prev) => ({ ...prev, employee_id: '', routing_step_id: '', hours: '' }));
  };

  const columns = useMemo<ColumnDef<WorkOrder>[]>(
    () => [
      {
        id: 'item',
        header: 'Item Diproduksi',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.item_code}</span>
            <span className="text-xs text-muted-foreground">{row.original.so_number ? `SO ${row.original.so_number}` : '-'}</span>
          </div>
        )
      },
      { id: 'plant', header: 'Lokasi', cell: ({ row }) => row.original.production_plant_name },
      {
        id: 'planned_qty',
        header: 'Planned Qty',
        cell: ({ row }) => (
          <span className="text-data">
            {formatNumberId(row.original.planned_qty, 2)} {row.original.item_base_uom}
          </span>
        )
      },
      {
        accessorKey: 'priority',
        header: 'Prioritas',
        cell: ({ row }) => <Badge variant={priorityBadgeVariant[row.original.priority] ?? 'secondary'}>{priorityLabels[row.original.priority] ?? row.original.priority}</Badge>
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <Badge variant={statusBadgeVariant[row.original.status] ?? 'secondary'}>{statusLabels[row.original.status] ?? row.original.status}</Badge>
      },
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
            <span className="text-xs text-muted-foreground">-</span>
          )
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => toggleExpand(row.original)}>
            {expandedWoId === row.original.work_order_id ? 'Tutup' : 'Detail'}
          </Button>
        )
      }
    ],
    // boms WAJIB ada di sini — tombol "Detail" ini menutup (closure) atas
    // toggleExpand, yang membaca `boms` untuk cari komponen BOM & fetch lot-nya.
    // Tanpa `boms` di deps, useMemo cuma menghitung ulang saat expandedWoId
    // berubah — closure "Detail" yang pertama kali dirender KE-STUCK dengan
    // boms=[] dari render pertama (sebelum /api/boms selesai), jadi klik
    // "Detail" pertama kali SELALU gagal menemukan lot walau datanya ada di DB
    // (baru "sembuh sendiri" di klik kedua, setelah expandedWoId berubah memicu
    // recompute). Bug nyata ini ketemu & diperbaiki saat verifikasi FASE
    // Purchasing/Goods Receipt/Lot Genealogy, 16 Agu 2026.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedWoId, boms]
  );

  const expandedWo = workOrders.find((wo) => wo.work_order_id === expandedWoId) ?? null;
  const expandedBom = expandedWo ? boms.find((b) => b.bom_id === expandedWo.bom_id) : null;
  const expandedRouting = expandedWo?.routing_id ? routings.find((r) => r.routing_id === expandedWo.routing_id) : null;

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
              <CardTitle className="text-2xl">Sesi tidak valid</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Silakan login ulang untuk mengakses Work Order.</p>
              <Button onClick={() => router.push('/login?redirectTo=/work-orders')} className="w-fit">
                Ke Halaman Login
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
        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Produksi</CardDescription>
            <CardTitle className="text-2xl">Work Order</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {woError ? <p className="text-sm text-destructive">{woError}</p> : null}
            {woLoading ? (
              <p className="text-sm text-muted-foreground">Memuat Work Order...</p>
            ) : (
              <DataTable
                columns={columns}
                data={workOrders}
                emptyMessage="Belum ada Work Order."
                searchPlaceholder="Cari item atau No. SO..."
                getSearchText={(wo) => `${wo.item_code ?? ''} ${wo.item_name ?? ''} ${wo.so_number ?? ''}`}
                paginated
                pageSize={15}
                primaryAction={canManage ? { label: 'Buat Work Order', onClick: () => setIsCreateModalOpen(true) } : undefined}
              />
            )}
          </CardContent>
        </Card>

        {expandedWo ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Detail Work Order</CardDescription>
              <CardTitle className="text-xl">
                {expandedWo.item_code} — {formatNumberId(expandedWo.planned_qty, 2)} {expandedWo.item_base_uom}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {expandedWo.readiness === 'blocked' ? (
                <p className="rounded-md border border-destructive/40 bg-destructive-subtle p-2 text-sm text-destructive-subtle-foreground">
                  WO ini masih terhambat — ada {formatNumberId(expandedWo.open_alert_count, 0)} peringatan sistem terbuka yang harus diselesaikan dulu.
                </p>
              ) : null}

              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Catat Pemakaian Bahan (komponen BOM) — per Batch</p>
                <label className="mb-3 flex max-w-xs flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Batch Produksi</span>
                  <Select value={consumptionBatchId} onValueChange={setConsumptionBatchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih batch..." />
                    </SelectTrigger>
                    <SelectContent>
                      {batchesForExpanded.map((batch) => (
                        <SelectItem key={batch.production_batch_id} value={String(batch.production_batch_id)}>
                          {batch.batch_number} ({batch.planned_qty} {batch.uom})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                {batchesForExpanded.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada batch — buat batch dulu di bagian &quot;Batch Produksi&quot; di bawah sebelum mencatat pemakaian bahan.</p>
                ) : !consumptionBatchId ? (
                  <p className="text-sm text-muted-foreground">Pilih batch produksi dulu di atas untuk mencatat pemakaian bahan batch itu.</p>
                ) : (() => {
                    // Sesi 6A: batch yang SUDAH DIMULAI (batchBomSnapshot.has_snapshot)
                    // memakai baris BOM BEKU miliknya sendiri -- BUKAN expandedBom hidup
                    // -- supaya "Kebutuhan" di bawah tidak diam-diam berubah kalau BOM
                    // diedit setelah batch ini jalan. Batch yang belum dimulai (belum
                    // ada snapshot) tetap jatuh balik ke expandedBom hidup seperti biasa.
                    const consumptionBom = batchBomSnapshot?.has_snapshot
                      ? { lines: batchBomSnapshot.lines, buffer_percentage: batchBomSnapshot.buffer_percentage }
                      : expandedBom;
                    if (!consumptionBom || consumptionBom.lines.length === 0) {
                      return <p className="text-sm text-muted-foreground">BOM untuk item ini belum punya komponen.</p>;
                    }
                    const selectedBatch = batchesForExpanded.find((b) => String(b.production_batch_id) === consumptionBatchId);
                    const batchQty = selectedBatch?.planned_qty ?? 0;
                    return (
                      <div className="flex flex-col gap-3">
                        {batchBomSnapshot?.has_snapshot ? (
                          <p className="rounded-md border border-info/40 bg-info-subtle p-2 text-xs text-info-subtle-foreground">
                            Kebutuhan di bawah dibekukan sejak batch ini dimulai — tidak ikut berubah walau BOM diedit sesudahnya.
                          </p>
                        ) : null}
                        {consumptionBom.lines.map((line) => {
                          const lotsForComponent = lotsForExpanded.filter((lot) => lot.item_id === line.component_item_id);
                          const entry = consumptionForm[line.component_item_id] ?? { lot_id: '', qty: '' };
                          const selectedLot = lotsForComponent.find((lot) => String(lot.lot_id) === entry.lot_id);
                          const crossCustomerWarning =
                            selectedLot && selectedLot.source_type === 'customer_supplied' && expandedWo.customer_id && selectedLot.source_customer_id !== expandedWo.customer_id;
                          const bufferedQty = line.qty_per_unit_output * batchQty * (1 + (consumptionBom.buffer_percentage ?? 0) / 100);

                          return (
                            <div key={line.component_item_id} className="rounded-md border p-2">
                              <p className="text-sm font-medium text-foreground">
                                {line.component_item_code} — {line.component_item_name}
                              </p>
                              <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                                Kebutuhan: {bufferedQty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} {line.uom} untuk batch {selectedBatch?.batch_number} ({batchQty} {selectedBatch?.uom})
                                {consumptionBom.buffer_percentage ? ` — sudah + buffer ${formatNumberId(consumptionBom.buffer_percentage, 2)}%` : ''}
                                <ProvenanceInfoButton
                                  label="Kebutuhan Bahan per Batch"
                                  envelope={{
                                    formula: 'Kebutuhan = qty_per_unit_output (BOM) × qty batch × (1 + buffer_percentage BOM ÷ 100). Buffer mengantisipasi susut/reject saat proses — dikonfigurasi per BOM, bukan nilai tetap sistem.',
                                    inputs: [
                                      { label: 'Qty per unit output (BOM)', value: line.qty_per_unit_output.toLocaleString('id-ID', { maximumFractionDigits: 6 }) },
                                      { label: 'Qty batch', value: `${batchQty} ${selectedBatch?.uom ?? ''}` },
                                      { label: 'Buffer BOM', value: `${consumptionBom.buffer_percentage ?? 0}%` },
                                      { label: 'Kebutuhan (dengan buffer)', value: `${bufferedQty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} ${line.uom}` }
                                    ]
                                  }}
                                />
                              </p>
                              {lotsForComponent.length === 0 ? (
                                <p className="text-sm text-destructive">Belum ada stok lot tersedia untuk item ini.</p>
                              ) : (
                                <div className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-muted-foreground">Pilih Lot</span>
                                    <Select value={entry.lot_id} onValueChange={(value) => setConsumptionForm((prev) => ({ ...prev, [line.component_item_id]: { ...entry, lot_id: value } }))}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Pilih lot..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {lotsForComponent.map((lot) => (
                                          <SelectItem key={lot.lot_id} value={String(lot.lot_id)}>
                                            {lot.lot_number} — {formatNumberId(lot.quantity_on_hand, 2)} tersedia {lot.source_type === 'customer_supplied' ? '(kiriman client)' : ''}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-muted-foreground">Jumlah Dipakai</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={entry.qty}
                                      onChange={(event) => setConsumptionForm((prev) => ({ ...prev, [line.component_item_id]: { ...entry, qty: event.target.value } }))}
                                    />
                                  </label>
                                  <Button size="sm" onClick={() => handleRecordConsumption(expandedWo, line.component_item_id)}>
                                    Catat
                                  </Button>
                                </div>
                              )}
                              {crossCustomerWarning ? (
                                <p className="mt-2 rounded-md border border-warning/40 bg-warning-subtle p-2 text-xs text-warning-subtle-foreground">
                                  Peringatan: lot ini kiriman client lain (bukan client pada SO Work Order ini) — pastikan tidak salah pakai bahan milik client berbeda.
                                </p>
                              ) : null}
                              {consumptionMessage[line.component_item_id] ? <p className="mt-1 text-xs text-muted-foreground">{consumptionMessage[line.component_item_id]}</p> : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {expandedWo ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Biaya SDM</CardDescription>
              <CardTitle className="text-xl">Catat Jam Kerja (Labor Log) — per Batch</CardTitle>
              <CardDescription>
                Tim produksi berpindah tahap sepanjang hari — 1 orang wajar dicatat berkali-kali di tahap/batch berbeda hari yang sama. Pilih batch di bagian &quot;Catat Pemakaian
                Bahan&quot; di atas dulu.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!consumptionBatchId ? (
                <p className="text-sm text-muted-foreground">Pilih batch produksi dulu di bagian &quot;Catat Pemakaian Bahan&quot; di atas.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-foreground">Karyawan</span>
                      <Select value={laborForm.employee_id} onValueChange={(value) => setLaborForm((prev) => ({ ...prev, employee_id: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih karyawan..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.employee_id} value={String(emp.employee_id)}>
                              {emp.name} {emp.position ? `— ${emp.position}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-foreground">Tahap (opsional)</span>
                      <Select value={laborForm.routing_step_id} onValueChange={(value) => setLaborForm((prev) => ({ ...prev, routing_step_id: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih tahap..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(expandedRouting?.steps ?? []).map((step) => (
                            <SelectItem key={step.routing_step_id} value={String(step.routing_step_id)}>
                              {step.sequence_no}. {step.step_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-foreground">Jam Kerja</span>
                      <Input type="number" step="any" min="0" placeholder="mis. 4" value={laborForm.hours} onChange={(event) => setLaborForm((prev) => ({ ...prev, hours: event.target.value }))} />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-foreground">Tanggal</span>
                      <Input type="date" value={laborForm.work_date} onChange={(event) => setLaborForm((prev) => ({ ...prev, work_date: event.target.value }))} />
                    </label>
                  </div>
                  <label className="flex w-fit items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={laborForm.is_overtime}
                      onChange={(event) => setLaborForm((prev) => ({ ...prev, is_overtime: event.target.checked }))}
                    />
                    Ini jam lembur (orang yang seharusnya sudah pulang, lanjut bekerja) — tarif normal tetap dipakai, cuma ditandai untuk dikoreksi nanti
                  </label>
                  <Button className="w-fit" size="sm" disabled={laborStatus === 'pending'} onClick={() => handleRecordLabor(expandedWo)}>
                    {laborStatus === 'pending' ? 'Menyimpan...' : 'Catat Jam Kerja'}
                  </Button>
                  {laborMessage ? (
                    <p className={`text-sm ${laborStatus === 'error' ? 'text-destructive' : laborStatus === 'warning' ? 'text-warning-subtle-foreground' : 'text-success-subtle-foreground'}`}>
                      {laborMessage}
                    </p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {expandedWo ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Eksekusi</CardDescription>
              <CardTitle className="text-xl">Batch Produksi</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Batch yang sudah dibuat</p>
                {batchesForExpanded.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada batch untuk Work Order ini.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {batchesForExpanded.map((batch) => (
                      <div key={batch.production_batch_id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <span className="font-medium text-foreground">{batch.batch_number}</span>
                        <span className="text-data text-muted-foreground">
                          {batch.planned_qty} {batch.uom}
                        </span>
                        <span className="text-data text-muted-foreground">Rencana: {batch.planned_date ?? '-'}</span>
                        <Badge variant={batchStatusBadgeVariant[batch.status] ?? 'secondary'}>{batchStatusLabels[batch.status] ?? batch.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium text-foreground">Buat Batch Baru</p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex max-w-xs flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Planned Qty Batch Ini</span>
                    <Input type="number" min="0" step="any" value={batchPlannedQty} onChange={(event) => setBatchPlannedQty(event.target.value)} placeholder={`mis. 500 ${expandedWo.item_base_uom ?? ''}`} />
                    <span className="text-xs text-muted-foreground">Bebas ditentukan — tidak harus sama dengan standard_yield_qty di BOM.</span>
                  </label>
                  <label className="flex max-w-xs flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Tanggal Rencana</span>
                    <Input type="date" value={batchPlannedDate} onChange={(event) => setBatchPlannedDate(event.target.value)} />
                    <span className="text-xs text-muted-foreground">Kapan batch ini SEHARUSNYA dikerjakan — default hari ini, jadi acuan Dashboard Kapasitas.</span>
                  </label>
                  <label className="flex max-w-xs flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Nomor Batch (opsional)</span>
                    <Input
                      value={batchNumberOverride}
                      onChange={(event) => setBatchNumberOverride(event.target.value)}
                      placeholder="kosongkan utk nomor otomatis, atau isi mis. 3TM13082601"
                    />
                    <span className="text-xs text-muted-foreground">Kosongkan untuk nomor otomatis (WO-xxxx-Bxxx), atau isi format pabrik sendiri — harus unik se-perusahaan.</span>
                  </label>
                </div>

                {expandedBom && Number(batchPlannedQty) > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Kalkulasi Kebutuhan Bahan{expandedBom.buffer_percentage ? ` (sudah + buffer ${formatNumberId(expandedBom.buffer_percentage, 2)}%)` : ' (BOM ini belum punya buffer_percentage)'}
                      <ProvenanceInfoButton
                        label="Kebutuhan Bahan per Batch"
                        envelope={{
                          formula:
                            'Tanpa Buffer = qty_per_unit_output (BOM) × qty batch direncanakan. Dibutuhkan (+buffer) = Tanpa Buffer × (1 + buffer_percentage BOM ÷ 100). Buffer mengantisipasi susut/reject saat proses — dikonfigurasi per BOM.',
                          inputs: [
                            { label: 'Qty batch direncanakan', value: String(batchPlannedQty) },
                            { label: 'Buffer BOM', value: `${expandedBom.buffer_percentage ?? 0}%` }
                          ]
                        }}
                      />
                    </p>
                    {expandedBom.lines.length === 0 ? (
                      <p className="text-sm text-muted-foreground">BOM untuk item ini belum punya komponen.</p>
                    ) : (
                      <div className="overflow-hidden rounded-md border">
                        <table className="w-full text-data">
                          <thead>
                            <tr className="border-b">
                              <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Komponen</th>
                              <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tanpa Buffer</th>
                              <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Dibutuhkan (+buffer)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expandedBom.lines.map((line) => {
                              const baseQty = line.qty_per_unit_output * Number(batchPlannedQty);
                              const bufferedQty = baseQty * (1 + (expandedBom.buffer_percentage ?? 0) / 100);
                              return (
                                <tr key={line.component_item_id} className="border-b last:border-0">
                                  <td className="px-3 py-1.5">
                                    {line.component_item_code} — {line.component_item_name}
                                  </td>
                                  <td className="px-3 py-1.5 text-muted-foreground">
                                    {baseQty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} {line.uom}
                                  </td>
                                  <td className="px-3 py-1.5 font-medium text-foreground">
                                    {bufferedQty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} {line.uom}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : null}

                <Button className="mt-3 w-fit" disabled={batchFormStatus === 'pending'} onClick={() => handleCreateBatch(expandedWo)}>
                  {batchFormStatus === 'pending' ? 'Menyimpan...' : 'Buat Batch'}
                </Button>
                {batchFormMessage ? <p className={`mt-2 text-sm ${batchFormStatus === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>{batchFormMessage}</p> : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {canManage ? (
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Buat Work Order</DialogTitle>
                <DialogDescription>SO opsional — kosongkan untuk WO produksi WIP di muka yang belum terikat pesanan customer (mis. Base Gelatin).</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Sales Order (opsional)</span>
                    <Select value={form.sales_order_id} onValueChange={handleSelectSo}>
                      <SelectTrigger>
                        <SelectValue placeholder="(Tanpa SO — WO WIP di muka)" />
                      </SelectTrigger>
                      <SelectContent>
                        {salesOrders.map((so) => (
                          <SelectItem key={so.sales_order_id} value={String(so.sales_order_id)}>
                            {so.so_number} — {so.customer_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">SO Line (item)</span>
                    <Select
                      value={form.sales_order_line_id}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, sales_order_line_id: value, bom_id: '', routing_id: '' }))}
                      disabled={!selectedSo}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih baris SO..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(selectedSo?.lines ?? []).map((line) => (
                          <SelectItem key={line.sales_order_line_id} value={String(line.sales_order_line_id)}>
                            {line.item_code} — {formatNumberId(line.qty_ordered, 2)} {line.item_base_uom} (sudah direncanakan: {formatNumberId(line.qty_already_planned_in_wo, 2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">BOM</span>
                    <Select value={form.bom_id} onValueChange={(value) => setForm((prev) => ({ ...prev, bom_id: value, routing_id: '' }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih BOM..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBoms.map((bom) => (
                          <SelectItem key={bom.bom_id} value={String(bom.bom_id)}>
                            {selectedSoLine ? '' : `${bom.parent_item_code} — `}v{bom.version} ({bom.status}) — yield {formatNumberId(bom.standard_yield_qty, 2)} {bom.standard_yield_uom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSoLine && availableBoms.length === 0 ? <span className="text-xs text-destructive">Belum ada BOM untuk item ini — buat dulu di halaman BOM.</span> : null}
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Routing (opsional)</span>
                    <Select value={form.routing_id} onValueChange={(value) => setForm((prev) => ({ ...prev, routing_id: value }))} disabled={!effectiveItemId}>
                      <SelectTrigger>
                        <SelectValue placeholder={effectiveItemId ? '(Tidak ada)' : 'Pilih BOM dulu'} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoutingsForItem.map((r) => (
                          <SelectItem key={r.routing_id} value={String(r.routing_id)}>
                            v{r.version} — {r.steps.length} tahap
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {effectiveItemId && availableRoutingsForItem.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Belum ada Routing untuk item ini — WO tetap bisa dibuat, tapi tidak akan muncul di Gantt Produksi.</span>
                    ) : null}
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Lokasi Pabrik</span>
                    <Select value={form.production_plant_id} onValueChange={(value) => setForm((prev) => ({ ...prev, production_plant_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih plant..." />
                      </SelectTrigger>
                      <SelectContent>
                        {plants.map((plant) => (
                          <SelectItem key={plant.production_plant_id} value={String(plant.production_plant_id)}>
                            {plant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Planned Qty</span>
                    <Input type="number" min="0" step="any" value={form.planned_qty} onChange={(event) => setForm((prev) => ({ ...prev, planned_qty: event.target.value }))} required />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Prioritas</span>
                    <Select value={form.priority} onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {workOrderPriorities.map((p) => (
                          <SelectItem key={p} value={p}>
                            {priorityLabels[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Jadwal Mulai</span>
                    <Input type="date" value={form.scheduled_start} onChange={(event) => setForm((prev) => ({ ...prev, scheduled_start: event.target.value }))} />
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={formStatus === 'pending'} className="w-fit">
                    {formStatus === 'pending' ? 'Menyimpan...' : 'Buat Work Order'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Batal
                  </Button>
                </div>

                {formMessage ? <p className={`text-sm ${formStatus === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>{formMessage}</p> : null}
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </main>
  );
}

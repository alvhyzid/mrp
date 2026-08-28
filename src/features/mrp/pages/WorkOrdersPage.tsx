'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { Add } from '@carbon/icons-react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { canManageWorkOrder } from '@/lib/roles';
import { workOrderPriorities } from '../server/workOrderValidation';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { formatNumberId } from '@/lib/currency';

const priorityLabels: Record<string, string> = { low: 'Rendah', normal: 'Normal', high: 'Tinggi', urgent: 'Mendesak' };
/// Warna Tag mengikuti ARTI. Hanya "mendesak" yang merah — kalau semua prioritas berwarna
/// mencolok, tidak ada yang benar-benar menonjol.
const priorityWarnaTag: Record<string, 'gray' | 'blue' | 'magenta' | 'red'> = { low: 'gray', normal: 'blue', high: 'magenta', urgent: 'red' };

const statusLabels: Record<string, string> = { planned: 'Direncanakan', in_progress: 'Berjalan', paused: 'Dijeda', completed: 'Selesai', cancelled: 'Batal' };
const bomStatusLabels: Record<string, string> = { draft: 'Draf', active: 'Aktif', archived: 'Diarsipkan' };
/// Warna Tag mengikuti ARTI. "Berjalan" ungu, bukan kuning: pekerjaan yang sedang jalan
/// bukan peringatan.
const statusWarnaTag: Record<string, 'blue' | 'purple' | 'gray' | 'green' | 'red'> = {
  planned: 'blue',
  in_progress: 'purple',
  paused: 'gray',
  completed: 'green',
  cancelled: 'red'
};

const readinessLabels: Record<string, string> = { ready: 'Siap mulai', blocked: 'Terhambat' };
const readinessWarnaTag: Record<string, 'green' | 'red'> = { ready: 'green', blocked: 'red' };

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
  open_alert_count: number; kekurangan_bahan?: boolean;
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
const batchStatusWarnaTag: Record<string, 'blue' | 'purple' | 'green' | 'red'> = { planned: 'blue', in_progress: 'purple', completed: 'green', cancelled: 'red' };

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

  // Pencarian, saringan, dan pembagian halaman: Carbon DataTable tidak membawanya.
  const [cari, setCari] = useState('');
  const [saringStatus, setSaringStatus] = useState<string>('semua');
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(15);
  const adaSaringan = cari.trim() !== '' || saringStatus !== 'semua';

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

  // Dipanggil dari ModalFooter Carbon, bukan dari <form onSubmit>.
  const handleSubmit = async () => {
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
      setBatchFormMessage('Jumlah rencana batch harus lebih besar dari 0.');
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


  // ==========================================================================
  // TABEL WORK ORDER — cetakan Master Item
  // ==========================================================================
  const kolom = [
    { key: 'item', header: 'Item diproduksi' },
    { key: 'plant', header: 'Lokasi' },
    { key: 'planned_qty', header: 'Qty rencana' },
    { key: 'priority', header: 'Prioritas' },
    { key: 'status', header: 'Status' },
    { key: 'readiness', header: 'Kesiapan' }
  ];

  const woTersaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return workOrders.filter((wo) => {
      if (saringStatus !== 'semua' && wo.status !== saringStatus) return false;
      if (!kata) return true;
      return `${wo.item_code ?? ''} ${wo.item_name ?? ''} ${wo.so_number ?? ''}`.toLowerCase().includes(kata);
    });
  }, [workOrders, cari, saringStatus]);

  const woHalamanIni = useMemo(() => woTersaring.slice((halaman - 1) * perHalaman, halaman * perHalaman), [woTersaring, halaman, perHalaman]);
  const woById = useMemo(() => new Map(workOrders.map((wo) => [String(wo.work_order_id), wo])), [workOrders]);

  const baris = useMemo(
    () =>
      woHalamanIni.map((wo) => ({
        id: String(wo.work_order_id),
        item: wo.item_code ?? '',
        plant: wo.production_plant_name ?? '',
        planned_qty: wo.planned_qty,
        priority: priorityLabels[wo.priority] ?? wo.priority,
        status: statusLabels[wo.status] ?? wo.status,
        readiness: readinessLabels[wo.readiness] ?? ''
      })),
    [woHalamanIni]
  );

  const isiSel = (wo: WorkOrder, kunci: string) => {
    switch (kunci) {
      case 'item':
        return (
          <div className="wo-sel-item">
            <span className="wo-sel-item__kode">{wo.item_code}</span>
            <span className="wo-sel-item__so">{wo.so_number ? `SO ${wo.so_number}` : 'Tanpa SO'}</span>
          </div>
        );
      case 'plant':
        return wo.production_plant_name;
      case 'planned_qty':
        return `${formatNumberId(wo.planned_qty, 2)} ${wo.item_base_uom}`;
      case 'priority':
        return <Tag type={priorityWarnaTag[wo.priority] ?? 'gray'}>{priorityLabels[wo.priority] ?? wo.priority}</Tag>;
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
  const expandedBom = expandedWo ? boms.find((b) => b.bom_id === expandedWo.bom_id) : null;
  const expandedRouting = expandedWo?.routing_id ? routings.find((r) => r.routing_id === expandedWo.routing_id) : null;

  // ==========================================================================
  // PANEL DETAIL (isi baris yang dimekarkan) — pemakaian bahan, jam kerja, batch
  // ==========================================================================
  const renderDetailWo = (wo: WorkOrder) => {
    const selectedBatch = batchesForExpanded.find((b) => String(b.production_batch_id) === consumptionBatchId);
    const batchQty = selectedBatch?.planned_qty ?? 0;
    // Batch yang SUDAH DIMULAI memakai baris BOM BEKU miliknya sendiri — BUKAN BOM hidup —
    // supaya "kebutuhan" tidak diam-diam berubah kalau BOM diedit setelah batch ini jalan.
    const consumptionBom = batchBomSnapshot?.has_snapshot
      ? { lines: batchBomSnapshot.lines, buffer_percentage: batchBomSnapshot.buffer_percentage }
      : expandedBom;

    return (
      <div className="wo-detail">
        {wo.readiness === 'blocked' ? (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title="Work Order ini masih terhambat"
            subtitle={
              wo.kekurangan_bahan
                ? 'Bahannya belum cukup di pabrik ini. Rinciannya ada di peringatan bahan yang bersangkutan.'
                : `Ada ${formatNumberId(wo.open_alert_count, 0)} peringatan sistem terbuka yang harus diselesaikan dulu.`
            }
          />
        ) : null}

        <h2 className="halaman__subjudul halaman__subjudul--rapat">Catat pemakaian bahan — per batch</h2>
        <Dropdown
          id={`wo-batch-${wo.work_order_id}`}
          size="lg"
          className="halaman__saring"
          titleText="Batch produksi"
          label="Pilih batch..."
          items={batchesForExpanded}
          itemToString={(b: any) => (b ? `${b.batch_number} (${b.planned_qty} ${b.uom})` : '')}
          selectedItem={batchesForExpanded.find((b) => String(b.production_batch_id) === consumptionBatchId) ?? null}
          onChange={({ selectedItem }: { selectedItem: any }) => setConsumptionBatchId(selectedItem ? String(selectedItem.production_batch_id) : '')}
        />

        {batchesForExpanded.length === 0 ? (
          <p className="halaman__redup">Belum ada batch — buat batch dulu di bagian &quot;Batch produksi&quot; di bawah sebelum mencatat pemakaian bahan.</p>
        ) : !consumptionBatchId ? (
          <p className="halaman__redup">Pilih batch produksi dulu di atas untuk mencatat pemakaian bahan batch itu.</p>
        ) : !consumptionBom || consumptionBom.lines.length === 0 ? (
          <p className="halaman__redup">BOM untuk item ini belum punya komponen.</p>
        ) : (
          <>
            {batchBomSnapshot?.has_snapshot ? (
              <InlineNotification
                kind="info"
                lowContrast
                hideCloseButton
                title="Kebutuhan sudah dibekukan"
                subtitle="Angka di bawah dibekukan sejak batch ini dimulai — tidak ikut berubah walau BOM diedit sesudahnya."
              />
            ) : null}
            {consumptionBom.lines.map((line) => {
              const lotsForComponent = lotsForExpanded.filter((lot) => lot.item_id === line.component_item_id);
              const entry = consumptionForm[line.component_item_id] ?? { lot_id: '', qty: '' };
              const selectedLot = lotsForComponent.find((lot) => String(lot.lot_id) === entry.lot_id);
              const bedaKlien = selectedLot && selectedLot.source_type === 'customer_supplied' && wo.customer_id && selectedLot.source_customer_id !== wo.customer_id;
              const bufferedQty = line.qty_per_unit_output * batchQty * (1 + (consumptionBom.buffer_percentage ?? 0) / 100);

              return (
                <div key={line.component_item_id} className="wo-komponen">
                  <p className="wo-komponen__nama">
                    {line.component_item_code} — {line.component_item_name}
                  </p>
                  <p className="halaman__redup">
                    Kebutuhan: {bufferedQty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} {line.uom} untuk batch {selectedBatch?.batch_number} ({batchQty}{' '}
                    {selectedBatch?.uom})
                    {consumptionBom.buffer_percentage ? ` — sudah + buffer ${formatNumberId(consumptionBom.buffer_percentage, 2)}%` : ''}
                    <ProvenanceInfoButton
                      label="Kebutuhan bahan per batch"
                      envelope={{
                        formula:
                          'Kebutuhan = qty_per_unit_output (BOM) × qty batch × (1 + buffer_percentage BOM ÷ 100). Buffer mengantisipasi susut/reject saat proses — dikonfigurasi per BOM, bukan nilai tetap sistem.',
                        inputs: [
                          { label: 'Rasio bahan per unit hasil (BOM)', value: line.qty_per_unit_output.toLocaleString('id-ID', { maximumFractionDigits: 6 }) },
                          { label: 'Kuantitas batch', value: `${batchQty} ${selectedBatch?.uom ?? ''}` },
                          { label: 'Buffer BOM', value: `${consumptionBom.buffer_percentage ?? 0}%` },
                          { label: 'Kebutuhan (dengan buffer)', value: `${bufferedQty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} ${line.uom}` }
                        ]
                      }}
                    />
                  </p>
                  {lotsForComponent.length === 0 ? (
                    <InlineNotification kind="error" lowContrast hideCloseButton title="Belum ada stok" subtitle="Tidak ada lot tersedia untuk item ini." />
                  ) : (
                    <div className="wo-komponen__isi">
                      <Dropdown
                        id={`wo-lot-${line.component_item_id}`}
                        size="lg"
                        titleText="Pilih lot"
                        label="Pilih lot..."
                        items={lotsForComponent}
                        itemToString={(lot: any) =>
                          lot ? `${lot.lot_number} — ${formatNumberId(lot.quantity_on_hand, 2)} tersedia${lot.source_type === 'customer_supplied' ? ' (kiriman klien)' : ''}` : ''
                        }
                        selectedItem={lotsForComponent.find((l) => String(l.lot_id) === entry.lot_id) ?? null}
                        onChange={({ selectedItem }: { selectedItem: any }) =>
                          setConsumptionForm((prev) => ({ ...prev, [line.component_item_id]: { ...entry, lot_id: selectedItem ? String(selectedItem.lot_id) : '' } }))
                        }
                      />
                      <NumberInput
                        id={`wo-qty-${line.component_item_id}`}
                        label="Jumlah dipakai"
                        min={0}
                        allowEmpty
                        hideSteppers
                        value={entry.qty === '' ? '' : Number(entry.qty)}
                        onChange={(_e: unknown, { value }: { value: number | string }) =>
                          setConsumptionForm((prev) => ({ ...prev, [line.component_item_id]: { ...entry, qty: String(value ?? '') } }))
                        }
                      />
                      <Button size="md" onClick={() => handleRecordConsumption(wo, line.component_item_id)}>
                        Catat pemakaian
                      </Button>
                    </div>
                  )}
                  {bedaKlien ? (
                    <InlineNotification
                      kind="warning"
                      lowContrast
                      hideCloseButton
                      title="Lot ini kiriman klien lain"
                      subtitle="Bukan klien pada SO Work Order ini — pastikan tidak salah pakai bahan milik klien berbeda."
                    />
                  ) : null}
                  {consumptionMessage[line.component_item_id] ? (
                    <InlineNotification kind="info" lowContrast hideCloseButton title="Hasil" subtitle={consumptionMessage[line.component_item_id]} />
                  ) : null}
                </div>
              );
            })}
          </>
        )}

        <h2 className="halaman__subjudul halaman__subjudul--rapat">Catat jam kerja — per batch</h2>
        <p className="halaman__redup">
          Tim produksi berpindah tahap sepanjang hari — satu orang wajar dicatat berkali-kali di tahap atau batch berbeda pada hari yang sama.
        </p>
        {!consumptionBatchId ? (
          <p className="halaman__redup">Pilih batch produksi dulu di bagian pemakaian bahan di atas.</p>
        ) : (
          <div className="wo-jam">
            <div className="wo-jam__kisi">
              <Dropdown
                id="wo-karyawan"
                size="lg"
                titleText="Karyawan"
                label="Pilih karyawan..."
                items={employees}
                itemToString={(e: any) => (e ? `${e.name}${e.position ? ` — ${e.position}` : ''}` : '')}
                selectedItem={employees.find((e) => String(e.employee_id) === laborForm.employee_id) ?? null}
                onChange={({ selectedItem }: { selectedItem: any }) => setLaborForm((prev) => ({ ...prev, employee_id: selectedItem ? String(selectedItem.employee_id) : '' }))}
              />
              <Dropdown
                id="wo-tahap"
                size="lg"
                titleText="Tahap"
                label="Pilih tahap..."
                items={expandedRouting?.steps ?? []}
                itemToString={(s: any) => (s ? `${s.sequence_no}. ${s.step_name}` : '')}
                selectedItem={(expandedRouting?.steps ?? []).find((s: any) => String(s.routing_step_id) === laborForm.routing_step_id) ?? null}
                onChange={({ selectedItem }: { selectedItem: any }) => setLaborForm((prev) => ({ ...prev, routing_step_id: selectedItem ? String(selectedItem.routing_step_id) : '' }))}
              />
              <NumberInput
                id="wo-jam-kerja"
                label="Jam kerja"
                min={0}
                allowEmpty
                hideSteppers
                value={laborForm.hours === '' ? '' : Number(laborForm.hours)}
                onChange={(_e: unknown, { value }: { value: number | string }) => setLaborForm((prev) => ({ ...prev, hours: String(value ?? '') }))}
              />
              <TextInput
                id="wo-tanggal-kerja"
                size="lg"
                type="date"
                labelText="Tanggal"
                value={laborForm.work_date}
                onChange={(event) => setLaborForm((prev) => ({ ...prev, work_date: event.target.value }))}
              />
            </div>
            <Checkbox
              id="wo-lembur"
              labelText="Ini jam lembur — orang yang seharusnya sudah pulang lanjut bekerja. Tarif normal tetap dipakai, cuma ditandai untuk dikoreksi nanti."
              checked={laborForm.is_overtime}
              onChange={(_e: unknown, { checked }: { checked: boolean }) => setLaborForm((prev) => ({ ...prev, is_overtime: checked }))}
            />
            {laborMessage ? (
              <InlineNotification
                kind={laborStatus === 'error' ? 'error' : laborStatus === 'warning' ? 'warning' : 'success'}
                lowContrast
                hideCloseButton
                title={laborStatus === 'error' ? 'Gagal' : laborStatus === 'warning' ? 'Perlu diperhatikan' : 'Berhasil'}
                subtitle={laborMessage}
              />
            ) : null}
            <Button size="md" disabled={laborStatus === 'pending'} onClick={() => handleRecordLabor(wo)}>
              {laborStatus === 'pending' ? 'Menyimpan...' : 'Catat jam kerja'}
            </Button>
          </div>
        )}

        <h2 className="halaman__subjudul halaman__subjudul--rapat">Batch produksi</h2>
        {batchesForExpanded.length === 0 ? (
          <p className="halaman__redup">Belum ada batch untuk Work Order ini.</p>
        ) : (
          <Table size="lg" className="tabel-responsif">
            <TableHead>
              <TableRow>
                <TableHeader>Batch</TableHeader>
                <TableHeader>Qty</TableHeader>
                <TableHeader>Rencana</TableHeader>
                <TableHeader>Status</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {batchesForExpanded.map((batch) => (
                <TableRow key={batch.production_batch_id}>
                  <TableCell data-label="Batch">{batch.batch_number}</TableCell>
                  <TableCell data-label="Qty">
                    {batch.planned_qty} {batch.uom}
                  </TableCell>
                  <TableCell data-label="Rencana">{batch.planned_date ?? '—'}</TableCell>
                  <TableCell data-label="Status">
                    <Tag type={batchStatusWarnaTag[batch.status] ?? 'gray'}>{batchStatusLabels[batch.status] ?? batch.status}</Tag>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="wo-batch-baru">
          <h2 className="halaman__subjudul halaman__subjudul--rapat">Buat batch baru</h2>
          <div className="wo-batch-baru__kisi">
            <NumberInput
              id="wo-batch-qty"
              label="Qty rencana batch ini"
              min={0}
              allowEmpty
              hideSteppers
              helperText="Bebas ditentukan — tidak harus sama dengan hasil standar di BOM."
              value={batchPlannedQty === '' ? '' : Number(batchPlannedQty)}
              onChange={(_e: unknown, { value }: { value: number | string }) => setBatchPlannedQty(String(value ?? ''))}
            />
            <TextInput
              id="wo-batch-tanggal"
              size="lg"
              type="date"
              labelText="Tanggal rencana"
              helperText="Kapan batch ini SEHARUSNYA dikerjakan — jadi acuan dashboard kapasitas."
              value={batchPlannedDate}
              onChange={(event) => setBatchPlannedDate(event.target.value)}
            />
            <TextInput
              id="wo-batch-nomor"
              size="lg"
              labelText="Nomor batch (opsional)"
              placeholder="mis. 3TM13082601"
              helperText="Kosongkan untuk nomor otomatis, atau isi format pabrik sendiri — harus unik se-perusahaan."
              value={batchNumberOverride}
              onChange={(event) => setBatchNumberOverride(event.target.value)}
            />
          </div>

          {expandedBom && Number(batchPlannedQty) > 0 ? (
            <>
              <p className="halaman__redup">
                Kalkulasi kebutuhan bahan
                {expandedBom.buffer_percentage ? ` (sudah + buffer ${formatNumberId(expandedBom.buffer_percentage, 2)}%)` : ' (BOM ini belum punya buffer)'}
                <ProvenanceInfoButton
                  label="Kebutuhan bahan per batch"
                  envelope={{
                    formula:
                      'Tanpa Buffer = qty_per_unit_output (BOM) × qty batch direncanakan. Dibutuhkan (+buffer) = Tanpa Buffer × (1 + buffer_percentage BOM ÷ 100). Buffer mengantisipasi susut/reject saat proses — dikonfigurasi per BOM.',
                    inputs: [
                      { label: 'Kuantitas batch direncanakan', value: String(batchPlannedQty) },
                      { label: 'Buffer BOM', value: `${expandedBom.buffer_percentage ?? 0}%` }
                    ]
                  }}
                />
              </p>
              {expandedBom.lines.length === 0 ? (
                <p className="halaman__redup">BOM untuk item ini belum punya komponen.</p>
              ) : (
                <Table size="lg" className="tabel-responsif">
                  <TableHead>
                    <TableRow>
                      <TableHeader>Komponen</TableHeader>
                      <TableHeader>Tanpa buffer</TableHeader>
                      <TableHeader>Dibutuhkan (+buffer)</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {expandedBom.lines.map((line) => {
                      const baseQty = line.qty_per_unit_output * Number(batchPlannedQty);
                      const bufferedQty = baseQty * (1 + (expandedBom.buffer_percentage ?? 0) / 100);
                      return (
                        <TableRow key={line.component_item_id}>
                          <TableCell data-label="Komponen">
                            {line.component_item_code} — {line.component_item_name}
                          </TableCell>
                          <TableCell data-label="Tanpa buffer">
                            {baseQty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} {line.uom}
                          </TableCell>
                          <TableCell data-label="Dibutuhkan (+buffer)">
                            {bufferedQty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} {line.uom}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </>
          ) : null}

          {batchFormMessage ? (
            <InlineNotification
              kind={batchFormStatus === 'success' ? 'success' : 'error'}
              lowContrast
              hideCloseButton
              title={batchFormStatus === 'success' ? 'Berhasil' : 'Gagal'}
              subtitle={batchFormMessage}
            />
          ) : null}
          <Button size="md" disabled={batchFormStatus === 'pending'} onClick={() => handleCreateBatch(wo)}>
            {batchFormStatus === 'pending' ? 'Menyimpan...' : 'Buat batch'}
          </Button>
        </div>
      </div>
    );
  };

  if (checkingAccess) {
    return (
      <div className="halaman">
        <DataTableSkeleton columnCount={6} rowCount={6} showHeader showToolbar />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <KepalaHalaman remah={[]} judul="Work Order" />
        <InlineNotification kind="error" lowContrast hideCloseButton title="Sesi tidak valid" subtitle="Silakan masuk ulang untuk membuka Work Order." />
        <Button className="wo-tombol-masuk" onClick={() => router.push('/login?redirectTo=/work-orders')}>
          Ke halaman masuk
        </Button>
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Manufacturing' }, { label: 'Work Orders' }]}
        judul="Work Order"
        pengantar={`${woTersaring.length} Work Order${adaSaringan ? ` dari ${workOrders.length} yang tercatat` : ' tercatat'} — perintah produksi per item, tempat batch, pemakaian bahan, dan jam kerja dicatat.`}
      />

      {woError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat Work Order" subtitle={woError} /> : null}

      {woLoading ? (
        <DataTableSkeleton columnCount={6} rowCount={6} showHeader showToolbar />
      ) : (
        <>
          <DataTable rows={baris} headers={kolom} isSortable size="lg">
            {(rp: any) => (
              <TableContainer {...rp.getTableContainerProps()}>
                <TableToolbar>
                  <TableToolbarContent>
                    {/* MELIPAT, bukan selalu terbuka — bawaan Carbon, `persistent` tidak dipakai. */}
                    <TableToolbarSearch
                      placeholder="Cari item atau nomor SO…"
                      labelText="Cari Work Order"
                      onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => {
                        setCari(typeof e === 'string' ? '' : e.target.value);
                        setHalaman(1);
                      }}
                    />
                    <Dropdown
                      id="wo-saring-status"
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
                    {canManage ? (
                      <Button size="lg" renderIcon={Add} onClick={() => setIsCreateModalOpen(true)}>
                        Buat Work Order
                      </Button>
                    ) : null}
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...rp.getTableProps()} className="tabel-responsif">
                  <TableHead>
                    <TableRow>
                      <TableExpandHeader aria-label="Buka rincian Work Order" />
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
                        <TableCell colSpan={kolom.length + 1}>
                          {/* DUA MACAM KOSONG, dan bedanya penting: yang satu berarti
                              "mulailah", yang satu berarti "longgarkan saringanmu".
                              Cetakan §4 mewajibkan masing-masing menawarkan jalan
                              keluarnya sendiri -- teks mati membuat pengguna berhenti
                              di layar yang tidak memberi tahu apa yang harus dilakukan. */}
                          {adaSaringan ? (
                            <div className="wo-kosong">
                              <p>Tidak ada Work Order yang cocok dengan pencarian atau saringan.</p>
                              <Button
                                kind="ghost"
                                size="sm"
                                onClick={() => {
                                  setCari('');
                                  setSaringStatus('semua');
                                  setHalaman(1);
                                }}
                              >
                                Hapus saringan
                              </Button>
                            </div>
                          ) : (
                            <div className="wo-kosong">
                              <p>Belum ada Work Order.</p>
                              {canManage ? (
                                <Button kind="ghost" size="sm" renderIcon={Add} onClick={() => setIsCreateModalOpen(true)}>
                                  Buat Work Order pertama
                                </Button>
                              ) : null}
                            </div>
                          )}
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
                              aria-label={`Rincian ${wo.item_code}`}
                            >
                              {kolom.map((h) => (
                                <TableCell key={h.key} data-label={h.header}>
                                  {isiSel(wo, h.key)}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow colSpan={kolom.length + 1}>
                              {expandedWoId === wo.work_order_id && expandedWo ? renderDetailWo(expandedWo) : null}
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

      {canManage ? (
        // MODAL TRANSAKSIONAL: field-nya beberapa, tapi keputusannya SATU — buat Work Order.
        <ComposedModal open={isCreateModalOpen} size="md" onClose={() => { setIsCreateModalOpen(false); return true; }}>
          <ModalHeader label="Produksi" title="Buat Work Order" closeModal={() => setIsCreateModalOpen(false)} />
          <ModalBody hasForm>
            <p className="halaman__pengantar">
              SO opsional — kosongkan untuk Work Order produksi setengah jadi di muka yang belum terikat pesanan pelanggan.
            </p>
            <div className="wo-form">
              <Dropdown
                id="wo-so"
                size="lg"
                titleText="Sales Order"
                label="(Tanpa SO — produksi di muka)"
                items={['', ...salesOrders.map((so) => String(so.sales_order_id))]}
                itemToString={(v: string) => {
                  if (!v) return '(Tanpa SO — produksi di muka)';
                  const so = salesOrders.find((s) => String(s.sales_order_id) === v);
                  return so ? `${so.so_number} — ${so.customer_name ?? ''}` : v;
                }}
                selectedItem={form.sales_order_id || ''}
                onChange={({ selectedItem }: { selectedItem: string | null }) => handleSelectSo(selectedItem ?? '')}
              />
              <Dropdown
                id="wo-baris-so"
                size="lg"
                titleText="Baris SO"
                label="Pilih baris SO..."
                disabled={!form.sales_order_id}
                items={(selectedSo?.lines ?? []).map((l) => String(l.sales_order_line_id))}
                itemToString={(v: string) => {
                  const line = (selectedSo?.lines ?? []).find((l) => String(l.sales_order_line_id) === v);
                  return line ? `${line.item_code} — ${formatNumberId(line.qty_ordered, 2)} ${line.item_base_uom}` : v;
                }}
                selectedItem={form.sales_order_line_id || ''}
                onChange={({ selectedItem }: { selectedItem: string | null }) =>
                  setForm((prev) => ({ ...prev, sales_order_line_id: selectedItem ?? '', bom_id: '', routing_id: '' }))
                }
              />
              <Dropdown
                id="wo-bom"
                size="lg"
                titleText="BOM"
                label="Pilih BOM..."
                items={availableBoms}
                itemToString={(b: any) => (b ? `${b.parent_item_code} v${b.version}` : '')}
                selectedItem={boms.find((b) => String(b.bom_id) === form.bom_id) ?? null}
                onChange={({ selectedItem }: { selectedItem: any }) => setForm((prev) => ({ ...prev, bom_id: selectedItem ? String(selectedItem.bom_id) : '', routing_id: '' }))}
              />
              <Dropdown
                id="wo-routing"
                size="lg"
                titleText="Routing"
                label={effectiveItemId ? '(Tidak ada)' : 'Pilih BOM dulu'}
                disabled={!effectiveItemId}
                items={availableRoutingsForItem}
                itemToString={(r: any) => (r ? `v${r.version} — ${r.steps.length} tahap` : '')}
                selectedItem={availableRoutingsForItem.find((r: any) => String(r.routing_id) === form.routing_id) ?? null}
                onChange={({ selectedItem }: { selectedItem: any }) => setForm((prev) => ({ ...prev, routing_id: selectedItem ? String(selectedItem.routing_id) : '' }))}
                helperText={
                  effectiveItemId && availableRoutingsForItem.length === 0
                    ? 'Belum ada Routing untuk item ini — Work Order tetap bisa dibuat, tapi tidak akan muncul di Gantt produksi.'
                    : undefined
                }
              />
              <Dropdown
                id="wo-lokasi"
                size="lg"
                titleText="Lokasi pabrik"
                label="Pilih lokasi..."
                items={plants}
                itemToString={(p: any) => p?.name ?? ''}
                selectedItem={plants.find((p) => String(p.production_plant_id) === form.production_plant_id) ?? null}
                onChange={({ selectedItem }: { selectedItem: any }) =>
                  setForm((prev) => ({ ...prev, production_plant_id: selectedItem ? String(selectedItem.production_plant_id) : '' }))
                }
              />
              <NumberInput
                id="wo-planned-qty"
                label="Qty rencana"
                min={0}
                allowEmpty
                hideSteppers
                value={form.planned_qty === '' ? '' : Number(form.planned_qty)}
                onChange={(_e: unknown, { value }: { value: number | string }) => setForm((prev) => ({ ...prev, planned_qty: String(value ?? '') }))}
              />
              <Dropdown
                id="wo-prioritas"
                size="lg"
                titleText="Prioritas"
                label="Pilih prioritas"
                items={workOrderPriorities as unknown as string[]}
                itemToString={(p: string) => priorityLabels[p] ?? p}
                selectedItem={form.priority}
                onChange={({ selectedItem }: { selectedItem: string | null }) => setForm((prev) => ({ ...prev, priority: selectedItem ?? 'normal' }))}
              />
              <TextInput
                id="wo-jadwal"
                size="lg"
                type="date"
                labelText="Jadwal mulai"
                value={form.scheduled_start}
                onChange={(event) => setForm((prev) => ({ ...prev, scheduled_start: event.target.value }))}
              />
              {formMessage ? (
                <div className="wo-form__lebar-penuh">
                  <InlineNotification
                    kind={formStatus === 'success' ? 'success' : 'error'}
                    lowContrast
                    hideCloseButton
                    title={formStatus === 'success' ? 'Berhasil' : 'Gagal menyimpan'}
                    subtitle={formMessage}
                  />
                </div>
              ) : null}
            </div>
          </ModalBody>
          {/* `children` WAJIB pada ModalFooter di @carbon/react 1.114. */}
          <ModalFooter>
            <Button kind="secondary" onClick={() => setIsCreateModalOpen(false)}>
              Batal
            </Button>
            <Button kind="primary" disabled={formStatus === 'pending'} onClick={handleSubmit}>
              {formStatus === 'pending' ? 'Menyimpan...' : 'Buat Work Order'}
            </Button>
          </ModalFooter>
        </ComposedModal>
      ) : null}
    </div>
  );
}

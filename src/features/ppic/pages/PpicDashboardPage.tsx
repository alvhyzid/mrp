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
import { canAccessPpicDashboard, canManageWorkCenterCapacity } from '@/lib/roles';

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
  }, [router, loadApprovals, loadWorkOrders, loadBoms, loadCapacity]);

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
    </main>
  );
}

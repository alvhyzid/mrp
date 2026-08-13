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
import { canAccessPpicDashboard } from '@/lib/roles';

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
      setCheckingAccess(false);
      await Promise.all([loadApprovals(), loadWorkOrders(), loadBoms()]);
    };
    checkAccessAndLoad();
  }, [router, loadApprovals, loadWorkOrders, loadBoms]);

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
      <div className="container flex max-w-5xl flex-col gap-6">
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

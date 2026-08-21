'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { canManageBom } from '@/lib/roles';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { formatNumberId } from '@/lib/currency';

type RoutingStep = {
  routing_step_id: number;
  sequence_no: number;
  step_name: string;
  active_duration_minutes: number;
  duration_per_unit_minutes: number | null;
  wait_duration_minutes: number;
  work_center_id: number | null;
  work_center_name: string | null;
  work_center_code: string | null;
};

type Routing = {
  routing_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  version: number;
  steps: RoutingStep[];
  running_batch_count: number;
  referenced_work_order_count: number;
  can_delete: boolean;
  archived_at: string | null;
  archived_by_name: string | null;
};

type ItemOption = { item_id: number; item_code: string; name: string; base_uom: string };
type WorkCenterOption = { work_center_id: number; name: string; code: string | null; is_active: boolean };

type FormStep = {
  sequence_no: string;
  step_name: string;
  active_duration_minutes: string;
  duration_per_unit_minutes: string;
  wait_duration_minutes: string;
  work_center_id: string;
};

const emptyFormStep: FormStep = { sequence_no: '', step_name: '', active_duration_minutes: '', duration_per_unit_minutes: '', wait_duration_minutes: '0', work_center_id: '' };

const emptyForm = {
  item_id: '',
  steps: [{ ...emptyFormStep, sequence_no: '1' }] as FormStep[]
};

export default function RoutingsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const [routings, setRoutings] = useState<Routing[]>([]);
  const [routingsError, setRoutingsError] = useState('');
  const [routingsLoading, setRoutingsLoading] = useState(true);
  // Sesi 7 (7.4) — "Tampilkan yang diarsipkan", default TIDAK dicentang.
  const [showArchived, setShowArchived] = useState(false);
  const [archiveActionStatus, setArchiveActionStatus] = useState<{ routingId: number; message: string; kind: 'error' | 'success' } | null>(null);

  const [items, setItems] = useState<ItemOption[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenterOption[]>([]);

  const [viewingRoutingId, setViewingRoutingId] = useState<number | null>(null);
  const [editingRoutingId, setEditingRoutingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formStatus, setFormStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [formMessage, setFormMessage] = useState('');
  // FASE 3 (Carbon "DataTable with toolbar") — form tambah/edit Routing pindah ke
  // modal. TIDAK auto-close saat sukses, sama alasannya dengan BomsPage: handleSubmit
  // sengaja tidak memanggil resetForm() supaya pesan sukses tetap terlihat; modal
  // ditutup manual oleh user.
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadRoutings = useCallback(
    async (includeArchived: boolean) => {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      setRoutingsLoading(true);
      const response = await fetch(`/api/routings${includeArchived ? '?includeArchived=true' : ''}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json();

      if (!response.ok) {
        setRoutingsError(data.error || 'Gagal memuat daftar Routing.');
        setRoutingsLoading(false);
        return;
      }

      setRoutings(data.routings || []);
      setRoutingsError('');
      setRoutingsLoading(false);
    },
    [getAccessToken]
  );

  const loadItems = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const response = await fetch('/api/items', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (response.ok) setItems(data.items || []);
  }, [getAccessToken]);

  const loadWorkCenters = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const response = await fetch('/api/work-centers', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (response.ok) setWorkCenters(data.workCenters || []);
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
        router.replace('/login?redirectTo=/routing');
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

      setCanManage(canManageBom(meData?.user?.role));
      setCheckingAccess(false);
      await Promise.all([loadRoutings(showArchived), loadItems(), loadWorkCenters()]);
    };

    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadItems, loadWorkCenters]);

  // Muat ulang saat filter "Tampilkan yang diarsipkan" diubah (bukan saat
  // pertama kali mount -- itu sudah ditangani effect di atas).
  const isFirstArchivedFilterRender = useRef(true);
  useEffect(() => {
    if (isFirstArchivedFilterRender.current) {
      isFirstArchivedFilterRender.current = false;
      return;
    }
    loadRoutings(showArchived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const itemsById = useMemo(() => new Map(items.map((item) => [item.item_id, item])), [items]);

  const resetForm = () => {
    setEditingRoutingId(null);
    setForm(emptyForm);
    setFormStatus('idle');
    setFormMessage('');
  };

  const startCreate = () => {
    setViewingRoutingId(null);
    resetForm();
    setIsFormModalOpen(true);
  };

  const startEdit = (routing: Routing) => {
    setIsFormModalOpen(true);
    setEditingRoutingId(routing.routing_id);
    setViewingRoutingId(null);
    setForm({
      item_id: String(routing.item_id),
      steps: routing.steps.map((step) => ({
        sequence_no: String(step.sequence_no),
        step_name: step.step_name,
        active_duration_minutes: String(step.active_duration_minutes),
        duration_per_unit_minutes: step.duration_per_unit_minutes !== null ? String(step.duration_per_unit_minutes) : '',
        wait_duration_minutes: String(step.wait_duration_minutes),
        work_center_id: step.work_center_id ? String(step.work_center_id) : ''
      }))
    });
    setFormStatus('idle');
    setFormMessage('');
  };

  const updateStep = (index: number, patch: Partial<FormStep>) => {
    setForm((prev) => ({ ...prev, steps: prev.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) }));
  };

  const addStep = () => {
    setForm((prev) => {
      const nextSequence = prev.steps.length ? Math.max(...prev.steps.map((s) => Number(s.sequence_no) || 0)) + 1 : 1;
      return { ...prev, steps: [...prev.steps, { ...emptyFormStep, sequence_no: String(nextSequence) }] };
    });
  };

  const removeStep = (index: number) => {
    setForm((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormStatus('pending');
    setFormMessage('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setFormStatus('error');
      setFormMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }

    const stepsPayload = form.steps.map((step) => ({
      sequence_no: Number(step.sequence_no),
      step_name: step.step_name,
      active_duration_minutes: Number(step.active_duration_minutes),
      duration_per_unit_minutes: step.duration_per_unit_minutes === '' ? null : Number(step.duration_per_unit_minutes),
      wait_duration_minutes: step.wait_duration_minutes === '' ? 0 : Number(step.wait_duration_minutes),
      work_center_id: step.work_center_id === '' ? null : Number(step.work_center_id)
    }));

    const payload = {
      ...(editingRoutingId ? { routing_id: editingRoutingId } : {}),
      item_id: Number(form.item_id),
      steps: stepsPayload
    };

    const response = await fetch('/api/routings', {
      method: editingRoutingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      setFormStatus('error');
      setFormMessage(data.error || 'Gagal menyimpan Routing.');
      return;
    }

    // SENGAJA tidak panggil resetForm() di sini — resetForm() juga membersihkan
    // formStatus/formMessage, jadi kalau dipanggil tepat setelah set 'success' di
    // atas, pesan konfirmasi akan langsung ketimpa 'idle'/kosong sebelum sempat
    // dirender (React 18 membatch semua setState di handler yang sama). Reset
    // field form saja di sini, biarkan pesan sukses tetap tampil.
    setFormStatus('success');
    setFormMessage(editingRoutingId ? 'Routing berhasil diperbarui.' : `Routing baru berhasil dibuat (v${data.version}).`);
    setEditingRoutingId(null);
    setForm(emptyForm);
    await loadRoutings(showArchived);
  };

  // Sesi 7 (7.3/7.4) — server yang MEMUTUSKAN hapus vs tolak (deleteRouting)
  // dan hapus vs tolak arsip (archiveRouting), layar hanya menampilkan tombol
  // sesuai can_delete/archived_at yang sudah dihitung server (listRoutings).
  const handleDeleteRouting = async (routing: Routing) => {
    const confirmed = window.confirm(`Hapus permanen Routing "${routing.item_code} v${routing.version}"? Tindakan ini tidak bisa dibatalkan.`);
    if (!confirmed) return;

    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch(`/api/routings/${routing.routing_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();

    if (!response.ok) {
      setArchiveActionStatus({ routingId: routing.routing_id, message: data.error || 'Gagal menghapus Routing.', kind: 'error' });
      return;
    }

    setArchiveActionStatus(null);
    await loadRoutings(showArchived);
  };

  const handleArchiveRouting = async (routing: Routing) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch(`/api/routings/${routing.routing_id}/archive`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();

    if (!response.ok) {
      setArchiveActionStatus({ routingId: routing.routing_id, message: data.error || 'Gagal mengarsipkan Routing.', kind: 'error' });
      return;
    }

    setArchiveActionStatus({ routingId: routing.routing_id, message: 'Routing berhasil diarsipkan.', kind: 'success' });
    await loadRoutings(showArchived);
  };

  const handleRestoreRouting = async (routing: Routing) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch(`/api/routings/${routing.routing_id}/restore`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();

    if (!response.ok) {
      setArchiveActionStatus({ routingId: routing.routing_id, message: data.error || 'Gagal memulihkan Routing.', kind: 'error' });
      return;
    }

    setArchiveActionStatus({ routingId: routing.routing_id, message: 'Routing berhasil dipulihkan.', kind: 'success' });
    await loadRoutings(showArchived);
  };

  const viewingRouting = routings.find((r) => r.routing_id === viewingRoutingId) ?? null;

  const columns = useMemo<ColumnDef<Routing>[]>(
    () => [
      {
        id: 'item',
        header: 'Item',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.item_code}</span>
            <span className="text-xs text-muted-foreground">{row.original.item_name}</span>
          </div>
        )
      },
      { accessorKey: 'version', header: 'Versi', cell: ({ row }) => <span className="text-data">v{row.original.version}</span> },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.archived_at ? (
            <span className="text-data text-xs text-muted-foreground">
              Diarsipkan
              {row.original.archived_by_name ? ` oleh ${row.original.archived_by_name}` : ''}
              <br />
              {new Date(row.original.archived_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          ) : (
            <span className="text-data text-success-subtle-foreground">Aktif</span>
          )
      },
      { id: 'step_count', header: 'Jumlah Tahap', cell: ({ row }) => <span className="text-data">{row.original.steps.length}</span> },
      {
        id: 'running_batch_count',
        header: 'Batch Berjalan',
        cell: ({ row }) =>
          row.original.running_batch_count > 0 ? (
            <span className="text-data font-medium text-warning-subtle-foreground">⚠ {row.original.running_batch_count}</span>
          ) : (
            <span className="text-data text-muted-foreground">0</span>
          )
      },
      {
        id: 'total_active',
        header: () => (
          <span className="flex items-center gap-1">
            Total Durasi Aktif
            <ProvenanceInfoButton
              label="Total Durasi Aktif"
              envelope={{
                formula: 'Jumlah active_duration_minutes semua tahap SOP routing ini (tidak termasuk wait_duration_minutes/waktu tunggu antar tahap) — angka standar dipakai untuk hitung kapasitas & jadwal, bukan durasi aktual tercatat per batch.',
                inputs: [{ label: 'Jumlah tahap dijumlah', value: 'Semua tahap di routing ini' }]
              }}
            />
          </span>
        ),
        cell: ({ row }) => <span className="text-data">{row.original.steps.reduce((sum, s) => sum + s.active_duration_minutes, 0)} mnt</span>
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setViewingRoutingId((current) => (current === row.original.routing_id ? null : row.original.routing_id));
                setEditingRoutingId(null);
              }}
            >
              {viewingRoutingId === row.original.routing_id ? 'Tutup' : 'Detail'}
            </Button>
            {canManage && !row.original.archived_at ? (
              <Button size="sm" variant="outline" onClick={() => startEdit(row.original)}>
                Edit
              </Button>
            ) : null}
            {canManage && row.original.archived_at ? (
              <Button size="sm" variant="outline" onClick={() => handleRestoreRouting(row.original)}>
                Pulihkan
              </Button>
            ) : null}
            {canManage && !row.original.archived_at && row.original.can_delete ? (
              <Button size="sm" variant="destructive" onClick={() => handleDeleteRouting(row.original)}>
                Hapus
              </Button>
            ) : null}
            {canManage && !row.original.archived_at && !row.original.can_delete ? (
              <Button size="sm" variant="destructive" onClick={() => handleArchiveRouting(row.original)}>
                Arsipkan
              </Button>
            ) : null}
          </div>
        )
      }
    ],
    [canManage, viewingRoutingId]
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
              <CardTitle className="text-2xl">Sesi tidak valid</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Silakan login ulang untuk mengakses daftar Routing.</p>
              <Button onClick={() => router.push('/login?redirectTo=/routing')} className="w-fit">
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
            <CardDescription className="uppercase tracking-[0.2em]">Master Data</CardDescription>
            <CardTitle className="text-2xl">Routing (Alur Produksi)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Routing = urutan tahap produksi per item. Ini yang jadi sumber data untuk Gantt Produksi & Dashboard Kapasitas di Dashboard PPIC — bukan sistem terpisah.
            </p>
            {routingsError ? <p className="text-sm text-destructive">{routingsError}</p> : null}
            {archiveActionStatus ? (
              <p className={`text-sm ${archiveActionStatus.kind === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>{archiveActionStatus.message}</p>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
              Tampilkan yang diarsipkan
            </label>
            {routingsLoading ? (
              <p className="text-sm text-muted-foreground">Memuat Routing...</p>
            ) : (
              <DataTable
                columns={columns}
                data={routings}
                emptyMessage="Belum ada Routing."
                searchPlaceholder="Cari kode atau nama item..."
                getSearchText={(routing) => `${routing.item_code ?? ''} ${routing.item_name ?? ''}`}
                paginated
                pageSize={15}
                primaryAction={canManage ? { label: 'Tambah Routing', onClick: startCreate } : undefined}
              />
            )}
          </CardContent>
        </Card>

        {viewingRouting ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Detail Tahap</CardDescription>
              <CardTitle className="text-xl">
                {viewingRouting.item_code} — v{viewingRouting.version}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewingRouting.running_batch_count > 0 ? (
                <p className="mb-3 rounded-md border border-warning/40 bg-warning-subtle p-2 text-sm text-warning-subtle-foreground">
                  ⚠ Dipakai {viewingRouting.running_batch_count} batch berjalan — perubahan tidak akan mengubah batch tersebut (angkanya sudah dibekukan sejak batch itu dimulai).
                </p>
              ) : null}
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-data">
                  <thead>
                    <tr className="border-b">
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Urutan</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Nama Tahap</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Work Center</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Durasi Aktif / Laju</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Durasi Tunggu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingRouting.steps.map((step) => (
                      <tr key={step.routing_step_id} className="border-b last:border-0">
                        <td className="px-3 py-1.5">{step.sequence_no}</td>
                        <td className="px-3 py-1.5 font-medium text-foreground">{step.step_name}</td>
                        <td className="px-3 py-1.5">
                          {step.work_center_name ? (
                            <>
                              {step.work_center_name}
                              {step.work_center_code ? <span className="text-xs text-muted-foreground"> ({step.work_center_code})</span> : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {step.duration_per_unit_minutes !== null ? (
                            <span>
                              {formatNumberId(step.duration_per_unit_minutes, 6)} mnt/unit <span className="text-xs text-muted-foreground">(laju)</span>
                            </span>
                          ) : (
                            `${formatNumberId(step.active_duration_minutes, 2)} mnt`
                          )}
                        </td>
                        <td className="px-3 py-1.5">{formatNumberId(step.wait_duration_minutes, 2)} mnt</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {canManage ? (
          <Dialog
            open={isFormModalOpen}
            onOpenChange={(open) => {
              if (!open) {
                resetForm();
                setIsFormModalOpen(false);
              }
            }}
          >
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{editingRoutingId ? `Edit: ${form.item_id ? itemsById.get(Number(form.item_id))?.item_code : ''}` : 'Buat Routing baru'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="flex max-w-sm flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Item</span>
                  <Select value={form.item_id} onValueChange={(value) => setForm((prev) => ({ ...prev, item_id: value }))} disabled={editingRoutingId !== null}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.item_id} value={String(item.item_id)}>
                          {item.item_code} — {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editingRoutingId ? <span className="text-xs text-muted-foreground">Item tidak bisa diubah lewat edit — bikin Routing baru kalau perlu item lain.</span> : null}
                </label>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Tahap Produksi</span>
                    <Button type="button" size="sm" variant="outline" onClick={addStep}>
                      + Tambah Tahap
                    </Button>
                  </div>

                  {form.steps.map((step, index) => (
                    <div key={index} className="grid grid-cols-[70px_1.3fr_1fr_100px_120px_100px_auto] items-end gap-2 rounded-md border p-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">Urutan</span>
                        <Input type="number" min="1" step="1" value={step.sequence_no} onChange={(event) => updateStep(index, { sequence_no: event.target.value })} required />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">Nama Tahap</span>
                        <Input placeholder="mis. Mixing Adonan" value={step.step_name} onChange={(event) => updateStep(index, { step_name: event.target.value })} required />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">Work Center</span>
                        <Select value={step.work_center_id} onValueChange={(value) => updateStep(index, { work_center_id: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="(Tidak ada)" />
                          </SelectTrigger>
                          <SelectContent>
                            {workCenters.map((wc) => (
                              <SelectItem key={wc.work_center_id} value={String(wc.work_center_id)}>
                                {wc.name}
                                {wc.code ? ` (${wc.code})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">Durasi Aktif (mnt)</span>
                        <Input type="number" min="0" step="1" value={step.active_duration_minutes} onChange={(event) => updateStep(index, { active_duration_minutes: event.target.value })} required />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">Laju (mnt/unit, opsional)</span>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="kosongkan kalau tetap"
                          value={step.duration_per_unit_minutes}
                          onChange={(event) => updateStep(index, { duration_per_unit_minutes: event.target.value })}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">Durasi Tunggu (mnt)</span>
                        <Input type="number" min="0" step="1" value={step.wait_duration_minutes} onChange={(event) => updateStep(index, { wait_duration_minutes: event.target.value })} />
                      </label>

                      <Button type="button" size="sm" variant="destructive" disabled={form.steps.length <= 1} onClick={() => removeStep(index)}>
                        Hapus
                      </Button>
                    </div>
                  ))}
                  <span className="text-xs text-muted-foreground">
                    Durasi Aktif = waktu mesin/Work Center benar-benar sibuk (dipakai apa adanya kalau Laju kosong). Laju = durasi PER UNIT qty batch (mis. tahap dengan mesin
                    berkecepatan tetap) — kalau diisi, ini yang dipakai untuk Gantt/Kapasitas/kelayakan, bukan Durasi Aktif. Durasi Tunggu = waktu jeda (mis. curing) — tidak
                    menyibukkan mesin, tapi menunda tahap berikutnya.
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={formStatus === 'pending'}>
                    {formStatus === 'pending' ? 'Menyimpan...' : editingRoutingId ? 'Simpan Perubahan' : 'Buat Routing'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setIsFormModalOpen(false);
                    }}
                  >
                    {formStatus === 'success' ? 'Tutup' : 'Batal'}
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

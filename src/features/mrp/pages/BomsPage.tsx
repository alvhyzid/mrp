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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { canManageBom, canViewFinancialData } from '@/lib/roles';
import { typeLabels, typeBadgeVariant } from '../itemTypeLabels';
import { formatCurrency } from '@/lib/currency';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';

const bomStatuses = ['draft', 'active', 'archived'];

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  active: 'Aktif',
  archived: 'Diarsipkan'
};

const statusBadgeVariant: Record<string, 'warning' | 'success' | 'secondary'> = {
  draft: 'warning',
  active: 'success',
  archived: 'secondary'
};

type BomLine = {
  bom_line_id: number;
  component_item_id: number;
  component_item_code: string | null;
  component_item_name: string | null;
  component_item_type: string | null;
  component_standard_cost: number | null;
  qty_per_unit_output: number;
  uom: string;
  routing_step_id: number | null;
};

type RoutingStepOption = { routing_step_id: number; sequence_no: number; step_name: string };
type RoutingOption = { routing_id: number; item_id: number; steps: RoutingStepOption[] };

type Bom = {
  bom_id: number;
  parent_item_id: number;
  parent_item_code: string | null;
  parent_item_name: string | null;
  parent_item_base_uom: string | null;
  version: number;
  standard_yield_qty: number;
  standard_yield_uom: string;
  standard_yield_basis_note: string | null;
  standard_yield_source: string | null;
  status: string;
  buffer_percentage: number | null;
  lines: BomLine[];
};

type ItemOption = {
  item_id: number;
  item_code: string;
  name: string;
  type: string;
  base_uom: string;
};

type FormLine = {
  component_item_id: string;
  qty_per_batch: string;
  uom: string;
  routing_step_id: string;
};

const emptyFormLine: FormLine = { component_item_id: '', qty_per_batch: '', uom: '', routing_step_id: '' };

const yieldSourceLabels: Record<string, string> = {
  ESTIMASI_MANUAL: 'Estimasi Manual',
  DIPELAJARI: 'Dipelajari dari Batch Nyata'
};

const emptyForm = {
  parent_item_id: '',
  standard_yield_qty: '',
  standard_yield_uom: '',
  standard_yield_basis_note: '',
  standard_yield_source: '',
  status: 'draft',
  buffer_percentage: '',
  lines: [{ ...emptyFormLine }] as FormLine[]
};

export default function BomsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [canViewCost, setCanViewCost] = useState(false);

  const [boms, setBoms] = useState<Bom[]>([]);
  const [bomsError, setBomsError] = useState('');
  const [bomsLoading, setBomsLoading] = useState(true);

  const [items, setItems] = useState<ItemOption[]>([]);
  const [routings, setRoutings] = useState<RoutingOption[]>([]);

  const [viewingBomId, setViewingBomId] = useState<number | null>(null);
  const [editingBomId, setEditingBomId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formStatus, setFormStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [formMessage, setFormMessage] = useState('');
  // FASE 3 (Carbon "DataTable with toolbar") — form tambah/edit BOM pindah ke modal.
  // TIDAK auto-close saat sukses (beda dari halaman lain) — sengaja mempertahankan
  // perilaku asli di atas (pesan sukses tetap harus terlihat, resetForm() TIDAK
  // dipanggil di handleSubmit supaya formMessage tidak ikut ke-reset); modal ditutup
  // manual oleh user (Batal/X/klik luar), yang barulah memanggil resetForm().
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadBoms = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    setBomsLoading(true);
    const response = await fetch('/api/boms', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();

    if (!response.ok) {
      setBomsError(data.error || 'Gagal memuat daftar BOM.');
      setBomsLoading(false);
      return;
    }

    setBoms(data.boms || []);
    setBomsError('');
    setBomsLoading(false);
  }, [getAccessToken]);

  const loadItems = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch('/api/items', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    if (response.ok) {
      setItems(data.items || []);
    }
  }, [getAccessToken]);

  const loadRoutings = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch('/api/routings', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    if (response.ok) {
      setRoutings(data.routings || []);
    }
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
        router.replace('/login?redirectTo=/boms');
        return;
      }

      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const meData = await meResponse.json();

      if (!meResponse.ok) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }

      setCanManage(canManageBom(meData?.user?.role));
      setCanViewCost(canViewFinancialData(meData?.user?.role));
      setCheckingAccess(false);
      await Promise.all([loadBoms(), loadItems(), loadRoutings()]);
    };

    checkAccessAndLoad();
  }, [router, loadBoms, loadItems, loadRoutings]);

  const itemsById = useMemo(() => new Map(items.map((item) => [item.item_id, item])), [items]);
  const routingByItemId = useMemo(() => new Map(routings.map((r) => [r.item_id, r])), [routings]);
  const routingStepById = useMemo(() => {
    const map = new Map<number, RoutingStepOption>();
    for (const routing of routings) {
      for (const step of routing.steps) map.set(step.routing_step_id, step);
    }
    return map;
  }, [routings]);
  const selectedParentRouting = routingByItemId.get(Number(form.parent_item_id));

  const resetForm = () => {
    setEditingBomId(null);
    setForm(emptyForm);
    setFormStatus('idle');
    setFormMessage('');
  };

  const startCreate = () => {
    setViewingBomId(null);
    resetForm();
    setIsFormModalOpen(true);
  };

  const startEdit = (bom: Bom) => {
    setIsFormModalOpen(true);
    setEditingBomId(bom.bom_id);
    setViewingBomId(null);
    setForm({
      parent_item_id: String(bom.parent_item_id),
      standard_yield_qty: String(bom.standard_yield_qty),
      standard_yield_uom: bom.standard_yield_uom,
      standard_yield_basis_note: bom.standard_yield_basis_note ?? '',
      standard_yield_source: bom.standard_yield_source ?? '',
      status: bom.status,
      buffer_percentage: bom.buffer_percentage !== null && bom.buffer_percentage !== undefined ? String(bom.buffer_percentage) : '',
      lines: bom.lines.map((line) => ({
        component_item_id: String(line.component_item_id),
        // Ditampilkan sebagai "jumlah per batch standar" supaya intuitif diisi orang
        // produksi — disimpan di database sebagai qty_per_unit_output (per 1 unit
        // hasil), dikonversi bolak-balik dengan standard_yield_qty.
        qty_per_batch: String(line.qty_per_unit_output * bom.standard_yield_qty),
        uom: line.uom,
        routing_step_id: line.routing_step_id ? String(line.routing_step_id) : ''
      }))
    });
    setFormStatus('idle');
    setFormMessage('');
  };

  const updateLine = (index: number, patch: Partial<FormLine>) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line))
    }));
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, { ...emptyFormLine }] }));
  };

  const removeLine = (index: number) => {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  };

  const handleParentItemChange = (value: string) => {
    setForm((prev) => {
      const selected = itemsById.get(Number(value));
      return {
        ...prev,
        parent_item_id: value,
        standard_yield_uom: prev.standard_yield_uom || selected?.base_uom || ''
      };
    });
  };

  const handleComponentChange = (index: number, value: string) => {
    const selected = itemsById.get(Number(value));
    updateLine(index, {
      component_item_id: value,
      uom: form.lines[index].uom || selected?.base_uom || ''
    });
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

    const standardYieldQty = Number(form.standard_yield_qty);
    if (!standardYieldQty || standardYieldQty <= 0) {
      setFormStatus('error');
      setFormMessage('Jumlah hasil standar harus lebih besar dari 0.');
      return;
    }

    const linesPayload = form.lines.map((line) => ({
      component_item_id: Number(line.component_item_id),
      // Konversi dari "per batch standar" (yang diisi user) ke "per unit output"
      // (yang disimpan di database) — prinsip BOM per-unit-output di CLAUDE.md.
      qty_per_unit_output: Number(line.qty_per_batch) / standardYieldQty,
      uom: line.uom,
      routing_step_id: line.routing_step_id ? Number(line.routing_step_id) : null
    }));

    const payload = {
      ...(editingBomId ? { bom_id: editingBomId } : {}),
      parent_item_id: Number(form.parent_item_id),
      standard_yield_qty: standardYieldQty,
      standard_yield_uom: form.standard_yield_uom,
      standard_yield_basis_note: form.standard_yield_basis_note,
      standard_yield_source: form.standard_yield_source,
      status: form.status,
      buffer_percentage: form.buffer_percentage === '' ? null : Number(form.buffer_percentage),
      lines: linesPayload
    };

    const response = await fetch('/api/boms', {
      method: editingBomId ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      setFormStatus('error');
      setFormMessage(data.error || 'Gagal menyimpan BOM.');
      return;
    }

    // SENGAJA tidak panggil resetForm() di sini — resetForm() juga membersihkan
    // formStatus/formMessage, jadi kalau dipanggil tepat setelah set 'success' di
    // atas, pesan konfirmasi akan langsung ketimpa 'idle'/kosong sebelum sempat
    // dirender (React 18 membatch semua setState di handler yang sama). Reset
    // field form saja di sini, biarkan pesan sukses tetap tampil.
    setFormStatus('success');
    setFormMessage(editingBomId ? 'BOM berhasil diperbarui.' : 'BOM baru berhasil dibuat.');
    setEditingBomId(null);
    setForm(emptyForm);
    await loadBoms();
  };

  const viewingBom = boms.find((bom) => bom.bom_id === viewingBomId) ?? null;

  const columns = useMemo<ColumnDef<Bom>[]>(
    () => [
      {
        id: 'parent_item',
        header: 'Item (Hasil)',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.parent_item_code}</span>
            <span className="text-xs text-muted-foreground">{row.original.parent_item_name}</span>
          </div>
        )
      },
      {
        accessorKey: 'version',
        header: 'Versi',
        cell: ({ row }) => <span className="text-data">v{row.original.version}</span>
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant[row.original.status] ?? 'secondary'}>
            {statusLabels[row.original.status] ?? row.original.status}
          </Badge>
        )
      },
      {
        id: 'yield',
        header: 'Hasil Standar',
        cell: ({ row }) => (
          <span className="text-data" title={`Angka presisi penuh: ${row.original.standard_yield_qty}`}>
            ±{Math.round(row.original.standard_yield_qty)} {row.original.parent_item_base_uom ?? row.original.standard_yield_uom}
          </span>
        )
      },
      {
        id: 'line_count',
        header: 'Jumlah Komponen',
        cell: ({ row }) => <span className="text-data">{row.original.lines.length}</span>
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
                setViewingBomId((current) => (current === row.original.bom_id ? null : row.original.bom_id));
                setEditingBomId(null);
              }}
            >
              {viewingBomId === row.original.bom_id ? 'Tutup' : 'Detail'}
            </Button>
            {canManage ? (
              <Button size="sm" variant="outline" onClick={() => startEdit(row.original)}>
                Edit
              </Button>
            ) : null}
          </div>
        )
      }
    ],
    [canManage, viewingBomId]
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
              <p className="text-sm text-muted-foreground">Silakan login ulang untuk mengakses daftar BOM.</p>
              <Button onClick={() => router.push('/login?redirectTo=/boms')} className="w-fit">
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
            <CardTitle className="text-2xl">BOM (Resep/Komposisi)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {bomsError ? <p className="text-sm text-destructive">{bomsError}</p> : null}
            {bomsLoading ? (
              <p className="text-sm text-muted-foreground">Memuat BOM...</p>
            ) : (
              <DataTable
                columns={columns}
                data={boms}
                emptyMessage="Belum ada BOM."
                searchPlaceholder="Cari kode atau nama item hasil..."
                getSearchText={(bom) => `${bom.parent_item_code ?? ''} ${bom.parent_item_name ?? ''}`}
                paginated
                pageSize={15}
                primaryAction={canManage ? { label: 'Tambah BOM', onClick: startCreate } : undefined}
              />
            )}
          </CardContent>
        </Card>

        {viewingBom ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Detail Komponen</CardDescription>
              <CardTitle className="flex items-center gap-2 text-xl">
                {viewingBom.parent_item_code} — v{viewingBom.version} (±{Math.round(viewingBom.standard_yield_qty)} {viewingBom.parent_item_base_uom ?? viewingBom.standard_yield_uom})
                <ProvenanceInfoButton
                  label="Hasil Standar per Batch"
                  envelope={{
                    formula: viewingBom.standard_yield_basis_note ?? 'Belum ada keterangan asal angka — isi lewat form edit BOM.',
                    inputs: [{ label: 'Angka presisi penuh dipakai perhitungan', value: `${viewingBom.standard_yield_qty} ${viewingBom.parent_item_base_uom ?? viewingBom.standard_yield_uom} per batch` }],
                    standardStatus: viewingBom.standard_yield_source as 'ESTIMASI_MANUAL' | 'DIPELAJARI' | null
                  }}
                />
              </CardTitle>
              {viewingBom.buffer_percentage !== null && viewingBom.buffer_percentage !== undefined ? (
                <CardDescription>Buffer {viewingBom.buffer_percentage}% — kebutuhan bahan per batch dihitung dengan tambahan ini.</CardDescription>
              ) : null}
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-data">
                  <thead>
                    <tr className="border-b">
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Komponen</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipe</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Jumlah per {viewingBom.standard_yield_qty} {viewingBom.parent_item_base_uom ?? viewingBom.standard_yield_uom}
                      </th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Per Unit Output</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tahap SOP</th>
                      {canViewCost ? (
                        <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <span className="flex items-center gap-1">
                            Biaya Standar
                            <ProvenanceInfoButton
                              label="Biaya Standar Komponen"
                              envelope={{
                                formula: 'Diambil langsung dari items.standard_cost milik item komponen ini — data master (input manual di halaman Item), bukan hasil kalkulasi BOM.',
                                inputs: [{ label: 'Sumber', value: 'Master Item → Biaya Standar' }]
                              }}
                            />
                          </span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {viewingBom.lines.map((line) => (
                      <tr key={line.bom_line_id} className="border-b last:border-0">
                        <td className="px-3 py-1.5">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{line.component_item_code}</span>
                            <span className="text-xs text-muted-foreground">{line.component_item_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          {line.component_item_type ? (
                            <Badge variant={typeBadgeVariant[line.component_item_type] ?? 'secondary'}>
                              {typeLabels[line.component_item_type] ?? line.component_item_type}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-3 py-1.5">
                          {(line.qty_per_unit_output * viewingBom.standard_yield_qty).toLocaleString('id-ID', { maximumFractionDigits: 4 })} {line.uom}
                        </td>
                        <td className="px-3 py-1.5">
                          {line.qty_per_unit_output.toLocaleString('id-ID', { maximumFractionDigits: 6 })} {line.uom}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {line.routing_step_id && routingStepById.get(line.routing_step_id) ? (
                            <span>
                              {routingStepById.get(line.routing_step_id)!.sequence_no}. {routingStepById.get(line.routing_step_id)!.step_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Sejak tahap 1</span>
                          )}
                        </td>
                        {canViewCost ? <td className="px-3 py-1.5">{formatCurrency(line.component_standard_cost)}</td> : null}
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
                <DialogTitle>{editingBomId ? `Edit: ${form.parent_item_id ? itemsById.get(Number(form.parent_item_id))?.item_code : ''}` : 'Buat BOM baru'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-foreground">Item Hasil (Induk)</span>
                      <Select
                        value={form.parent_item_id}
                        onValueChange={handleParentItemChange}
                        disabled={editingBomId !== null}
                      >
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
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-foreground">Jumlah Hasil Standar</span>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={form.standard_yield_qty}
                        onChange={(event) => setForm((prev) => ({ ...prev, standard_yield_qty: event.target.value }))}
                        required
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-foreground">Satuan Hasil</span>
                      <Input
                        value={form.standard_yield_uom}
                        onChange={(event) => setForm((prev) => ({ ...prev, standard_yield_uom: event.target.value }))}
                        required
                      />
                    </label>
                  </div>

                  <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-foreground">Sumber Angka Hasil Standar (opsional)</span>
                      <Select
                        value={form.standard_yield_source || undefined}
                        onValueChange={(value) => setForm((prev) => ({ ...prev, standard_yield_source: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Belum ditentukan" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(yieldSourceLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>

                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="text-sm font-medium text-foreground">Keterangan Asal Angka Hasil Standar (opsional)</span>
                      <Input
                        placeholder='mis. "10.000 g adonan × yield 85% ÷ 2,5 g/gummy ÷ 60 gummy/botol"'
                        value={form.standard_yield_basis_note}
                        onChange={(event) => setForm((prev) => ({ ...prev, standard_yield_basis_note: event.target.value }))}
                      />
                    </label>
                  </div>

                  <div className="grid max-w-md gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-foreground">Status</span>
                      <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {bomStatuses.map((statusOption) => (
                            <SelectItem key={statusOption} value={statusOption}>
                              {statusLabels[statusOption]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-foreground">Buffer % (opsional)</span>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        placeholder="mis. 5"
                        value={form.buffer_percentage}
                        onChange={(event) => setForm((prev) => ({ ...prev, buffer_percentage: event.target.value }))}
                      />
                      <span className="text-xs text-muted-foreground">Kompensasi kehilangan produksi — dipakai saat hitung kebutuhan bahan per batch.</span>
                    </label>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        Komponen (per {form.standard_yield_qty || '?'} {form.standard_yield_uom || 'satuan hasil'})
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={addLine}>
                        + Tambah Komponen
                      </Button>
                    </div>

                    {form.lines.map((line, index) => (
                      <div key={index} className="grid grid-cols-[1fr_120px_90px_170px_auto] items-end gap-2 rounded-md border p-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">Item Komponen</span>
                          <Select value={line.component_item_id} onValueChange={(value) => handleComponentChange(index, value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih item..." />
                            </SelectTrigger>
                            <SelectContent>
                              {items
                                .filter((item) => String(item.item_id) !== form.parent_item_id)
                                .map((item) => (
                                  <SelectItem key={item.item_id} value={String(item.item_id)}>
                                    {item.item_code} — {item.name} ({typeLabels[item.type] ?? item.type})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">Jumlah per Batch</span>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={line.qty_per_batch}
                            onChange={(event) => updateLine(index, { qty_per_batch: event.target.value })}
                            required
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">Satuan</span>
                          <Input value={line.uom} onChange={(event) => updateLine(index, { uom: event.target.value })} required />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">Tahap SOP (opsional)</span>
                          {selectedParentRouting ? (
                            <Select
                              value={line.routing_step_id}
                              onValueChange={(value) => updateLine(index, { routing_step_id: value === '__none__' ? '' : value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sejak tahap 1 (default)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sejak tahap 1 (default)</SelectItem>
                                {[...selectedParentRouting.steps]
                                  .sort((a, b) => a.sequence_no - b.sequence_no)
                                  .map((step) => (
                                    <SelectItem key={step.routing_step_id} value={String(step.routing_step_id)}>
                                      {step.sequence_no}. {step.step_name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
                              Item induk belum punya Routing
                            </span>
                          )}
                        </label>

                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={form.lines.length <= 1}
                          onClick={() => removeLine(index)}
                        >
                          Hapus
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={formStatus === 'pending'}>
                      {formStatus === 'pending' ? 'Menyimpan...' : editingBomId ? 'Simpan Perubahan' : 'Buat BOM'}
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

                  {formMessage ? (
                    <p className={`text-sm ${formStatus === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>{formMessage}</p>
                  ) : null}
                </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </main>
  );
}

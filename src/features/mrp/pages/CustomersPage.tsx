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
import { canManageCustomerPo } from '@/lib/roles';

type Customer = {
  customer_id: number;
  name: string;
  customer_type: string;
  contact_info: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  npwp: string | null;
  pic_name: string | null;
  pic_phone: string | null;
  pic_email: string | null;
  payment_terms: string | null;
  archived_at: string | null;
  archived_by_name: string | null;
  purchase_order_count: number;
  can_delete: boolean;
};

const customerTypeLabels: Record<string, string> = { company: 'Perusahaan', individual: 'Perorangan' };

const emptyCustomerForm = {
  name: '',
  customer_type: 'company',
  contact_info: '',
  billing_address: '',
  shipping_address: '',
  npwp: '',
  pic_name: '',
  pic_phone: '',
  pic_email: '',
  payment_terms: ''
};

// Alur 1 (Sesi 21 Agu 2026) — Pelanggan SEBELUMNYA tidak punya halaman master
// sama sekali (hanya dropdown di layar PO Client). Pola CRUD+jalan keluar
// PERSIS meniru Routing (Sesi 7 bagian 1) dan Supplier (halaman ini dibangun
// bersamaan) — lihat glossary.ts utk seluruh label.
export default function CustomersPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const canManage = canManageCustomerPo(role);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyCustomerForm);
  const [formStatus, setFormStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [formMessage, setFormMessage] = useState('');
  const [actionMessage, setActionMessage] = useState<{ customerId: number; message: string; kind: 'error' | 'success' } | null>(null);

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

  const loadCustomers = useCallback(
    async (includeArchived: boolean) => {
      setCustomersLoading(true);
      const { ok, body } = await authedFetch(`/api/customers${includeArchived ? '?includeArchived=true' : ''}`);
      if (ok) setCustomers(body.customers || []);
      setCustomersLoading(false);
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
        router.replace('/login?redirectTo=/customers');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      setRole(meData?.user?.role ?? null);
      setCheckingAccess(false);
      await loadCustomers(showArchived);
    };
    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const isFirstArchivedFilterRender = useRef(true);
  useEffect(() => {
    if (isFirstArchivedFilterRender.current) {
      isFirstArchivedFilterRender.current = false;
      return;
    }
    loadCustomers(showArchived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const resetForm = () => {
    setEditingCustomerId(null);
    setForm(emptyCustomerForm);
  };

  const startCreate = () => {
    resetForm();
    setFormStatus('idle');
    setFormMessage('');
    setIsModalOpen(true);
  };

  const startEdit = (customer: Customer) => {
    setEditingCustomerId(customer.customer_id);
    setForm({
      name: customer.name,
      customer_type: customer.customer_type,
      contact_info: customer.contact_info ?? '',
      billing_address: customer.billing_address ?? '',
      shipping_address: customer.shipping_address ?? '',
      npwp: customer.npwp ?? '',
      pic_name: customer.pic_name ?? '',
      pic_phone: customer.pic_phone ?? '',
      pic_email: customer.pic_email ?? '',
      payment_terms: customer.payment_terms ?? ''
    });
    setFormStatus('idle');
    setFormMessage('');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormStatus('error');
      setFormMessage('Nama client wajib diisi.');
      return;
    }
    setFormStatus('saving');
    setFormMessage('');
    const payload = {
      name: form.name,
      customer_type: form.customer_type,
      contact_info: form.contact_info || null,
      billing_address: form.billing_address || null,
      shipping_address: form.shipping_address || null,
      npwp: form.npwp || null,
      pic_name: form.pic_name || null,
      pic_phone: form.pic_phone || null,
      pic_email: form.pic_email || null,
      payment_terms: form.payment_terms || null
    };
    const { ok, body } = editingCustomerId
      ? await authedFetch('/api/customers', { method: 'PATCH', body: JSON.stringify({ customer_id: editingCustomerId, ...payload }) })
      : await authedFetch('/api/customers', { method: 'POST', body: JSON.stringify(payload) });
    if (!ok) {
      setFormStatus('error');
      setFormMessage(body.error || 'Gagal menyimpan client.');
      return;
    }
    setFormStatus('success');
    setFormMessage(editingCustomerId ? 'Client berhasil diperbarui.' : 'Client baru berhasil ditambahkan.');
    resetForm();
    await loadCustomers(showArchived);
  };

  const handleDelete = async (customer: Customer) => {
    const confirmed = window.confirm(`Hapus permanen client "${customer.name}"? Tindakan ini tidak bisa dibatalkan.`);
    if (!confirmed) return;
    const { ok, body } = await authedFetch(`/api/customers/${customer.customer_id}`, { method: 'DELETE' });
    if (!ok) {
      setActionMessage({ customerId: customer.customer_id, message: body.error || 'Gagal menghapus client.', kind: 'error' });
      return;
    }
    setActionMessage(null);
    await loadCustomers(showArchived);
  };

  const handleArchive = async (customer: Customer) => {
    const { ok, body } = await authedFetch(`/api/customers/${customer.customer_id}/archive`, { method: 'POST' });
    if (!ok) {
      setActionMessage({ customerId: customer.customer_id, message: body.error || 'Gagal mengarsipkan client.', kind: 'error' });
      return;
    }
    setActionMessage({ customerId: customer.customer_id, message: 'Client berhasil diarsipkan.', kind: 'success' });
    await loadCustomers(showArchived);
  };

  const handleRestore = async (customer: Customer) => {
    const { ok, body } = await authedFetch(`/api/customers/${customer.customer_id}/restore`, { method: 'POST' });
    if (!ok) {
      setActionMessage({ customerId: customer.customer_id, message: body.error || 'Gagal memulihkan client.', kind: 'error' });
      return;
    }
    setActionMessage({ customerId: customer.customer_id, message: 'Client berhasil dipulihkan.', kind: 'success' });
    await loadCustomers(showArchived);
  };

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      { id: 'name', header: 'Nama', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
      { id: 'type', header: 'Jenis', cell: ({ row }) => customerTypeLabels[row.original.customer_type] ?? row.original.customer_type },
      { id: 'pic', header: 'PIC', cell: ({ row }) => row.original.pic_name ?? '-' },
      { id: 'payment_terms', header: 'Termin Pembayaran', cell: ({ row }) => row.original.payment_terms ?? '-' },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.archived_at ? (
            <span className="text-data text-xs text-muted-foreground">Diarsipkan{row.original.archived_by_name ? ` oleh ${row.original.archived_by_name}` : ''}</span>
          ) : (
            <span className="text-data text-success-subtle-foreground">Aktif</span>
          )
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            {canManage && !row.original.archived_at ? (
              <Button size="sm" variant="outline" onClick={() => startEdit(row.original)}>
                Edit
              </Button>
            ) : null}
            {canManage && row.original.archived_at ? (
              <Button size="sm" variant="outline" onClick={() => handleRestore(row.original)}>
                Pulihkan
              </Button>
            ) : null}
            {canManage && !row.original.archived_at && row.original.can_delete ? (
              <Button size="sm" variant="destructive" onClick={() => handleDelete(row.original)}>
                Hapus
              </Button>
            ) : null}
            {canManage && !row.original.archived_at && !row.original.can_delete ? (
              <Button size="sm" variant="destructive" onClick={() => handleArchive(row.original)}>
                Arsipkan
              </Button>
            ) : null}
          </div>
        )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage]
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
              <CardTitle className="text-2xl">Pelanggan</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Sesi tidak valid — silakan login ulang.</p>
              <Button onClick={() => router.push('/login')} className="w-fit">
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
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Master Data</p>
          <h1 className="text-2xl font-semibold text-foreground">Pelanggan</h1>
        </div>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Master Data</CardDescription>
            <CardTitle className="text-xl">Daftar Pelanggan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Tampilkan yang diarsipkan
            </label>
            {actionMessage ? (
              <p className={`text-sm ${actionMessage.kind === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>{actionMessage.message}</p>
            ) : null}
            {customersLoading ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : (
              <DataTable
                columns={columns}
                data={customers}
                emptyMessage="Belum ada pelanggan."
                searchPlaceholder="Cari nama pelanggan..."
                getSearchText={(c) => c.name}
                paginated
                pageSize={15}
                primaryAction={canManage ? { label: 'Tambah Pelanggan', onClick: startCreate } : undefined}
              />
            )}
          </CardContent>
        </Card>

        {canManage ? (
          <Dialog
            open={isModalOpen}
            onOpenChange={(open) => {
              setIsModalOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingCustomerId ? `Ubah Pelanggan — ${form.name}` : 'Tambah Pelanggan Baru'}</DialogTitle>
              </DialogHeader>
              <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Nama Pelanggan</span>
                  <Input placeholder="mis. PT Sastro Utama Media Grup" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Alamat Penagihan</span>
                  <Input placeholder="Alamat untuk keperluan penagihan/faktur" value={form.billing_address} onChange={(e) => setForm((prev) => ({ ...prev, billing_address: e.target.value }))} />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Alamat Pengiriman</span>
                  <Input
                    placeholder="Kosongkan kalau sama dengan alamat penagihan"
                    value={form.shipping_address}
                    onChange={(e) => setForm((prev) => ({ ...prev, shipping_address: e.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">NPWP</span>
                  <Input placeholder="01.234.567.8-901.000" value={form.npwp} onChange={(e) => setForm((prev) => ({ ...prev, npwp: e.target.value }))} />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Termin Pembayaran</span>
                  <Input placeholder="mis. 30 hari setelah invoice terbit" value={form.payment_terms} onChange={(e) => setForm((prev) => ({ ...prev, payment_terms: e.target.value }))} />
                </label>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">Kontak Person (PIC)</span>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input placeholder="Nama PIC" value={form.pic_name} onChange={(e) => setForm((prev) => ({ ...prev, pic_name: e.target.value }))} />
                    <Input placeholder="Telepon PIC" value={form.pic_phone} onChange={(e) => setForm((prev) => ({ ...prev, pic_phone: e.target.value }))} />
                    <Input placeholder="Email PIC" value={form.pic_email} onChange={(e) => setForm((prev) => ({ ...prev, pic_email: e.target.value }))} />
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Jenis Pelanggan</span>
                  <Select value={form.customer_type} onValueChange={(v) => setForm((prev) => ({ ...prev, customer_type: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Perusahaan</SelectItem>
                      <SelectItem value="individual">Perorangan</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Kontak Lain (opsional)</span>
                  <Input placeholder="Catatan kontak tambahan" value={form.contact_info} onChange={(e) => setForm((prev) => ({ ...prev, contact_info: e.target.value }))} />
                </label>
              </div>
              {formMessage ? <p className={`text-sm ${formStatus === 'error' ? 'text-destructive' : 'text-success'}`}>{formMessage}</p> : null}
              <div className="flex items-center gap-3">
                <Button disabled={formStatus === 'saving'} onClick={handleSave}>
                  {formStatus === 'saving' ? 'Menyimpan...' : editingCustomerId ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
                </Button>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                  Batal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </main>
  );
}

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
import { canManageCustomerPo, canApproveDepartment, isCompanyLeadership } from '@/lib/roles';
import { formatCurrency, formatNumberId } from '@/lib/currency';

const paymentTermsOptions = ['full', 'tempo'];
const customerTypes = ['company', 'individual'];

const statusLabels: Record<string, string> = {
  new: 'Baru',
  on_hold: 'Ditunda',
  cancelled: 'Dibatalkan',
  processed: 'Diproses'
};
const statusBadgeVariant: Record<string, 'info' | 'warning' | 'critical' | 'success'> = {
  new: 'info',
  on_hold: 'warning',
  cancelled: 'critical',
  processed: 'success'
};

const approvalStatusBadgeVariant: Record<string, 'warning' | 'success' | 'critical'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'critical'
};
const departmentLabels: Record<string, string> = { finance: 'Finance', ppic: 'PPIC', manager: 'Manager' };

type PoLine = {
  customer_purchase_order_line_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  qty_ordered: number;
  unit_price: number | null;
};

type Approval = {
  customer_po_approval_id: number;
  department: string;
  status: string;
  approved_by: number | null;
  approved_at: string | null;
  notes: string | null;
};

type PurchaseOrder = {
  customer_purchase_order_id: number;
  customer_id: number;
  customer_name: string | null;
  customer_type: string | null;
  po_number: string;
  po_date: string | null;
  requested_ship_date: string | null;
  pic_name: string | null;
  pic_position: string | null;
  pic_phone: string | null;
  pic_email: string | null;
  status: string;
  payment_terms: string | null;
  payment_status: string;
  lines: PoLine[];
  approvals: Approval[];
  sales_order: { sales_order_id: number; so_number: string; status: string; production_plant_id: number } | null;
};

type Customer = { customer_id: number; name: string; customer_type: string; contact_info: string | null };
type ItemOption = { item_id: number; item_code: string; name: string; base_uom: string };
type PlantOption = { production_plant_id: number; name: string };

type FormLine = { item_id: string; qty_ordered: string; unit_price: string };
const emptyFormLine: FormLine = { item_id: '', qty_ordered: '', unit_price: '' };

const emptyForm = {
  customer_id: '',
  po_number: '',
  po_date: '',
  requested_ship_date: '',
  pic_name: '',
  pic_position: '',
  pic_phone: '',
  pic_email: '',
  payment_terms: 'full',
  lines: [{ ...emptyFormLine }] as FormLine[]
};

export default function CustomerPurchaseOrdersPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const canManagePo = canManageCustomerPo(role);

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poError, setPoError] = useState('');
  const [poLoading, setPoLoading] = useState(true);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [plants, setPlants] = useState<PlantOption[]>([]);

  const [expandedPoId, setExpandedPoId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<Record<number, string>>({});
  const [processPlantChoice, setProcessPlantChoice] = useState<Record<number, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [formStatus, setFormStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [formMessage, setFormMessage] = useState('');
  // Stabil untuk 1 percobaan submit (dipakai server buat cegah dokumen duplikat kalau
  // tombol submit ke-double-click/request keulang) — baru diganti begitu submit SUKSES,
  // supaya double-click tetap kirim key yang SAMA persis.
  const [formIdempotencyKey, setFormIdempotencyKey] = useState(() => crypto.randomUUID());

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', customer_type: 'company', contact_info: '' });
  const [newCustomerStatus, setNewCustomerStatus] = useState<'idle' | 'pending' | 'error'>('idle');
  const [newCustomerMessage, setNewCustomerMessage] = useState('');

  // FASE 3 (Carbon "DataTable with toolbar") — form "Buat PO client baru" pindah ke
  // modal toolbar. Customer TETAP sebagai section expand INLINE di dalam modal yang
  // SAMA (showNewCustomer, sudah begitu sejak awal) — BUKAN modal terpisah/modal-di-
  // dalam-modal, sesuai keputusan eksplisit. Validasi/handleSubmit TIDAK diubah.
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const authedFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Sesi tidak valid.');
      const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) }
      });
      const body = await response.json();
      return { ok: response.ok, status: response.status, body };
    },
    [getAccessToken]
  );

  const loadPurchaseOrders = useCallback(async () => {
    setPoLoading(true);
    const { ok, body } = await authedFetch('/api/customer-purchase-orders');
    if (!ok) {
      setPoError(body.error || 'Gagal memuat daftar PO client.');
      setPoLoading(false);
      return;
    }
    setPurchaseOrders(body.purchaseOrders || []);
    setPoError('');
    setPoLoading(false);
  }, [authedFetch]);

  const loadCustomers = useCallback(async () => {
    const { ok, body } = await authedFetch('/api/customers');
    if (ok) setCustomers(body.customers || []);
  }, [authedFetch]);

  const loadItems = useCallback(async () => {
    const { ok, body } = await authedFetch('/api/items');
    if (ok) setItems(body.items || []);
  }, [authedFetch]);

  const loadPlants = useCallback(async () => {
    const { ok, body } = await authedFetch('/api/production-plants');
    if (ok) setPlants(body.plants || []);
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
        router.replace('/login?redirectTo=/customer-purchase-orders');
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
      setCheckingAccess(false);
      await Promise.all([loadPurchaseOrders(), loadCustomers(), loadItems(), loadPlants()]);
    };
    checkAccessAndLoad();
  }, [router, loadPurchaseOrders, loadCustomers, loadItems, loadPlants]);

  const resetForm = () => {
    setForm(emptyForm);
    setFormStatus('idle');
    setFormMessage('');
  };

  const updateLine = (index: number, patch: Partial<FormLine>) => {
    setForm((prev) => ({ ...prev, lines: prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) }));
  };
  const addLine = () => setForm((prev) => ({ ...prev, lines: [...prev.lines, { ...emptyFormLine }] }));
  const removeLine = (index: number) => setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));

  const handleCreateCustomer = async () => {
    setNewCustomerStatus('pending');
    setNewCustomerMessage('');
    const { ok, body } = await authedFetch('/api/customers', { method: 'POST', body: JSON.stringify(newCustomer) });
    if (!ok) {
      setNewCustomerStatus('error');
      setNewCustomerMessage(body.error || 'Gagal menambah client.');
      return;
    }
    setNewCustomerStatus('idle');
    setNewCustomerMessage('');
    setShowNewCustomer(false);
    setNewCustomer({ name: '', customer_type: 'company', contact_info: '' });
    await loadCustomers();
    setForm((prev) => ({ ...prev, customer_id: String(body.customer.customer_id) }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormStatus('pending');
    setFormMessage('');

    const payload = {
      ...form,
      customer_id: Number(form.customer_id),
      lines: form.lines.map((line) => ({ item_id: Number(line.item_id), qty_ordered: Number(line.qty_ordered), unit_price: Number(line.unit_price) })),
      idempotency_key: formIdempotencyKey
    };

    const { ok, body } = await authedFetch('/api/customer-purchase-orders', { method: 'POST', body: JSON.stringify(payload) });
    if (!ok) {
      setFormStatus('error');
      setFormMessage(body.error || 'Gagal membuat PO client.');
      return;
    }

    setFormStatus('success');
    setFormMessage('PO client berhasil dibuat. 3 approval department otomatis dibuat (status pending).');
    resetForm();
    setFormIdempotencyKey(crypto.randomUUID());
    setIsFormModalOpen(false);
    await loadPurchaseOrders();
  };

  const handleApprove = async (approvalId: number, status: 'approved' | 'rejected') => {
    setBusyKey(`approval-${approvalId}`);
    const { ok, body } = await authedFetch('/api/customer-purchase-orders/approve', {
      method: 'PATCH',
      body: JSON.stringify({ customer_po_approval_id: approvalId, status })
    });
    setBusyKey(null);
    if (!ok) {
      setActionMessage((prev) => ({ ...prev, [approvalId]: body.error || 'Gagal memproses approval.' }));
      return;
    }
    setActionMessage({});
    await loadPurchaseOrders();
  };

  const handleProcess = async (po: PurchaseOrder) => {
    const plantId = processPlantChoice[po.customer_purchase_order_id];
    if (!plantId) {
      setActionMessage((prev) => ({ ...prev, [po.customer_purchase_order_id]: 'Pilih lokasi pabrik dulu sebelum memproses.' }));
      return;
    }
    setBusyKey(`process-${po.customer_purchase_order_id}`);
    const { ok, body } = await authedFetch('/api/customer-purchase-orders/process', {
      method: 'POST',
      body: JSON.stringify({ customer_purchase_order_id: po.customer_purchase_order_id, production_plant_id: Number(plantId) })
    });
    setBusyKey(null);
    if (!ok) {
      setActionMessage((prev) => ({ ...prev, [po.customer_purchase_order_id]: body.error || 'Gagal memproses PO.' }));
      return;
    }
    setActionMessage((prev) => ({ ...prev, [po.customer_purchase_order_id]: `Berhasil diproses -> Sales Order ${body.so_number}` }));
    await loadPurchaseOrders();
  };

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      {
        id: 'po_number',
        header: 'No. PO Client',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.po_number}</span>
            <span className="text-xs text-muted-foreground">{row.original.customer_name}</span>
          </div>
        )
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <Badge variant={statusBadgeVariant[row.original.status] ?? 'secondary'}>{statusLabels[row.original.status] ?? row.original.status}</Badge>
      },
      {
        id: 'approvals',
        header: 'Approval',
        cell: ({ row }) => (
          <div className="flex gap-1">
            {row.original.approvals.map((a) => (
              <Badge key={a.customer_po_approval_id} variant={approvalStatusBadgeVariant[a.status] ?? 'secondary'} title={departmentLabels[a.department]}>
                {departmentLabels[a.department]?.[0] ?? a.department[0]}
              </Badge>
            ))}
          </div>
        )
      },
      {
        id: 'so',
        header: 'Sales Order',
        cell: ({ row }) => (row.original.sales_order ? <span className="text-data font-medium">{row.original.sales_order.so_number}</span> : <span className="text-muted-foreground">-</span>)
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => setExpandedPoId((current) => (current === row.original.customer_purchase_order_id ? null : row.original.customer_purchase_order_id))}>
            {expandedPoId === row.original.customer_purchase_order_id ? 'Tutup' : 'Detail'}
          </Button>
        )
      }
    ],
    [expandedPoId]
  );

  const expandedPo = purchaseOrders.find((po) => po.customer_purchase_order_id === expandedPoId) ?? null;
  // Server sudah masking unit_price jadi null untuk role yang tidak berhak (sama
  // seperti Items/BOM) — kolom harga cuma dirender kalau setidaknya satu baris
  // punya nilai. th dan td di tabel di bawah WAJIB pakai variabel yang sama supaya
  // jumlah kolom keduanya tidak pernah beda.
  const showPriceColumn = expandedPo ? expandedPo.lines.some((line) => line.unit_price !== null) : false;

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
              <p className="text-sm text-muted-foreground">Silakan login ulang untuk mengakses PO client.</p>
              <Button onClick={() => router.push('/login?redirectTo=/customer-purchase-orders')} className="w-fit">
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
            <CardDescription className="uppercase tracking-[0.2em]">Sales</CardDescription>
            <CardTitle className="text-2xl">PO Client</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {poError ? <p className="text-sm text-destructive">{poError}</p> : null}
            {poLoading ? (
              <p className="text-sm text-muted-foreground">Memuat PO client...</p>
            ) : (
              <DataTable
                columns={columns}
                data={purchaseOrders}
                emptyMessage="Belum ada PO client."
                searchPlaceholder="Cari No. PO atau client..."
                getSearchText={(po) => `${po.po_number} ${po.customer_name ?? ''}`}
                paginated
                pageSize={15}
                primaryAction={canManagePo ? { label: 'Buat PO Client', onClick: () => setIsFormModalOpen(true) } : undefined}
              />
            )}
          </CardContent>
        </Card>

        {expandedPo ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Detail PO</CardDescription>
              <CardTitle className="text-xl">
                {expandedPo.po_number} — {expandedPo.customer_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Tanggal PO:</span> {expandedPo.po_date ?? '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">Tanggal Kirim Diminta:</span> {expandedPo.requested_ship_date ?? '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">PIC:</span> {expandedPo.pic_name ?? '-'} {expandedPo.pic_position ? `(${expandedPo.pic_position})` : ''}
                </div>
                <div>
                  <span className="text-muted-foreground">Kontak PIC:</span> {expandedPo.pic_phone ?? '-'} / {expandedPo.pic_email ?? '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">Syarat Bayar:</span> {expandedPo.payment_terms ?? '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">Status Bayar:</span> {expandedPo.payment_status}
                </div>
              </div>

              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-data">
                  <thead>
                    <tr className="border-b">
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Qty</th>
                      {/* Server sudah masking unit_price jadi null untuk role yang tidak
                          berhak (sama seperti Items/BOM) — kolom ini cuma dirender kalau
                          setidaknya satu baris punya nilai, dan th/td harus konsisten
                          pakai kondisi yang sama supaya jumlah kolom tidak pernah beda. */}
                      {showPriceColumn ? <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Harga Satuan</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {expandedPo.lines.map((line) => (
                      <tr key={line.customer_purchase_order_line_id} className="border-b last:border-0">
                        <td className="px-3 py-1.5">
                          {line.item_code} — {line.item_name}
                        </td>
                        <td className="px-3 py-1.5">
                          {formatNumberId(line.qty_ordered, 2)} {line.item_base_uom}
                        </td>
                        {showPriceColumn ? (
                          <td className="px-3 py-1.5">{formatCurrency(line.unit_price, { maxDecimals: 0 })}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Approval 3 Department</p>
                <div className="flex flex-col gap-2">
                  {expandedPo.approvals.map((approval) => {
                    const canAct = canApproveDepartment(role, approval.department) && approval.status === 'pending';
                    return (
                      <div key={approval.customer_po_approval_id} className="flex items-center justify-between rounded-md border p-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={approvalStatusBadgeVariant[approval.status] ?? 'secondary'}>{departmentLabels[approval.department]}</Badge>
                          <span className="text-xs text-muted-foreground">{approval.status}</span>
                        </div>
                        {canAct ? (
                          <div className="flex gap-2">
                            <Button size="sm" disabled={busyKey === `approval-${approval.customer_po_approval_id}`} onClick={() => handleApprove(approval.customer_po_approval_id, 'approved')}>
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busyKey === `approval-${approval.customer_po_approval_id}`}
                              onClick={() => handleApprove(approval.customer_po_approval_id, 'rejected')}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {expandedPo.status === 'new' && expandedPo.approvals.every((a) => a.status === 'approved') ? (
                isCompanyLeadership(role) ? (
                  <div className="flex items-end gap-3 rounded-md border p-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-foreground">Lokasi Pabrik (untuk Process)</span>
                      <Select
                        value={processPlantChoice[expandedPo.customer_purchase_order_id] ?? ''}
                        onValueChange={(value) => setProcessPlantChoice((prev) => ({ ...prev, [expandedPo.customer_purchase_order_id]: value }))}
                      >
                        <SelectTrigger className="w-56">
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
                    <Button disabled={busyKey === `process-${expandedPo.customer_purchase_order_id}`} onClick={() => handleProcess(expandedPo)}>
                      Process -&gt; Buat Sales Order
                    </Button>
                  </div>
                ) : (
                  // Ketiga approval sudah selesai (termasuk ppic_manager, salah satu dari
                  // 3 approver) tapi Process sengaja tetap terkunci untuk role selain
                  // leadership — ditampilkan disabled + alasan, bukan disembunyikan total,
                  // supaya jelas kenapa (bukan kelihatan seperti bug/hilang).
                  <div className="flex items-center gap-3 rounded-md border border-dashed p-3">
                    <Button disabled className="pointer-events-none">
                      Process -&gt; Buat Sales Order
                    </Button>
                    <p className="text-sm text-muted-foreground">Semua approval sudah selesai, tapi hanya company_admin atau general_manager yang bisa memproses PO ini menjadi Sales Order.</p>
                  </div>
                )
              ) : null}

              {actionMessage[expandedPo.customer_purchase_order_id] ? <p className="text-sm text-foreground">{actionMessage[expandedPo.customer_purchase_order_id]}</p> : null}
            </CardContent>
          </Card>
        ) : null}

        {canManagePo ? (
          <Dialog
            open={isFormModalOpen}
            onOpenChange={(open) => {
              setIsFormModalOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Buat PO client baru</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Client</span>
                    <div className="flex gap-2">
                      <Select value={form.customer_id} onValueChange={(value) => setForm((prev) => ({ ...prev, customer_id: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih client..." />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.customer_id} value={String(customer.customer_id)}>
                              {customer.name} ({customer.customer_type === 'individual' ? 'Perorangan' : 'Perusahaan'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" onClick={() => setShowNewCustomer((v) => !v)}>
                        + Baru
                      </Button>
                    </div>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Nomor PO Client</span>
                    <Input value={form.po_number} onChange={(event) => setForm((prev) => ({ ...prev, po_number: event.target.value }))} required />
                  </label>
                </div>

                {showNewCustomer ? (
                  <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-3">
                    <Input placeholder="Nama client" value={newCustomer.name} onChange={(event) => setNewCustomer((prev) => ({ ...prev, name: event.target.value }))} />
                    <Select value={newCustomer.customer_type} onValueChange={(value) => setNewCustomer((prev) => ({ ...prev, customer_type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {customerTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t === 'individual' ? 'Perorangan' : 'Perusahaan'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Input placeholder="Kontak" value={newCustomer.contact_info} onChange={(event) => setNewCustomer((prev) => ({ ...prev, contact_info: event.target.value }))} />
                      <Button type="button" size="sm" disabled={newCustomerStatus === 'pending'} onClick={handleCreateCustomer}>
                        Simpan
                      </Button>
                    </div>
                    {newCustomerMessage ? <p className="text-sm text-destructive sm:col-span-3">{newCustomerMessage}</p> : null}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Tanggal PO</span>
                    <Input type="date" value={form.po_date} onChange={(event) => setForm((prev) => ({ ...prev, po_date: event.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Tanggal Kirim Diminta</span>
                    <Input type="date" value={form.requested_ship_date} onChange={(event) => setForm((prev) => ({ ...prev, requested_ship_date: event.target.value }))} />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Nama PIC</span>
                    <Input value={form.pic_name} onChange={(event) => setForm((prev) => ({ ...prev, pic_name: event.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Jabatan PIC</span>
                    <Input value={form.pic_position} onChange={(event) => setForm((prev) => ({ ...prev, pic_position: event.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">No. HP PIC</span>
                    <Input value={form.pic_phone} onChange={(event) => setForm((prev) => ({ ...prev, pic_phone: event.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Email PIC</span>
                    <Input type="email" value={form.pic_email} onChange={(event) => setForm((prev) => ({ ...prev, pic_email: event.target.value }))} />
                  </label>
                </div>

                <label className="flex max-w-xs flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Syarat Pembayaran</span>
                  <Select value={form.payment_terms} onValueChange={(value) => setForm((prev) => ({ ...prev, payment_terms: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTermsOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option === 'full' ? 'Lunas di Muka' : 'Tempo'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Baris Item</span>
                    <Button type="button" size="sm" variant="outline" onClick={addLine}>
                      + Tambah Baris
                    </Button>
                  </div>
                  {form.lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-[1fr_120px_140px_auto] items-end gap-2 rounded-md border p-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">Item</span>
                        <Select value={line.item_id} onValueChange={(value) => updateLine(index, { item_id: value })}>
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
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">Qty</span>
                        <Input type="number" min="0" step="any" value={line.qty_ordered} onChange={(event) => updateLine(index, { qty_ordered: event.target.value })} required />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">Harga Satuan</span>
                        <Input type="number" min="0" step="any" value={line.unit_price} onChange={(event) => updateLine(index, { unit_price: event.target.value })} required />
                      </label>
                      <Button type="button" size="sm" variant="destructive" disabled={form.lines.length <= 1} onClick={() => removeLine(index)}>
                        Hapus
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={formStatus === 'pending'}>
                    {formStatus === 'pending' ? 'Menyimpan...' : 'Buat PO Client'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsFormModalOpen(false)}>
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

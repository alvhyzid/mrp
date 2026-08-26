'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  ComposedModal,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Pagination,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  TextInput
} from '@carbon/react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { Add } from '@carbon/icons-react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
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
  // Pencarian & pembagian halaman dulu diurus komponen DataTable lama. Carbon DataTable
  // TIDAK mengurus keduanya, jadi keadaannya pindah ke halaman ini -- disebut supaya sesi
  // berikutnya tidak mengira Carbon kehilangan kemampuan.
  const [cari, setCari] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(15);
  // SARINGAN STATUS, bukan kotak centang — bentuknya sama dengan Master Item, dan sekarang
  // bisa menjawab "khusus yang diarsipkan" yang dengan kotak centang mustahil.
  const [saringStatus, setSaringStatus] = useState<'aktif' | 'diarsipkan' | 'semua'>('aktif');
  const showArchived = saringStatus !== 'aktif';

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
  }, [saringStatus]);

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

  if (checkingAccess) {
    return (
      <div className="halaman">
        <SkeletonText heading width="16rem" />
        <DataTableSkeleton columnCount={6} rowCount={6} showHeader={false} showToolbar={false} />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <KepalaHalaman remah={[]} judul="Pelanggan" />
        <InlineNotification kind="error" lowContrast title="Sesi tidak valid" subtitle="Silakan masuk lagi." hideCloseButton />
        <Button kind="tertiary" className="w-fit" onClick={() => router.push('/login')}>
          Ke halaman masuk
        </Button>
      </div>
    );
  }

  const terlihat = customers.filter((c) => {
    // Server hanya mengenal "termasuk arsip atau tidak"; pilihan "khusus yang diarsipkan"
    // disaring di sini. Disebut terbuka supaya tidak dikira server yang menyaringnya.
    if (saringStatus === 'diarsipkan' && !c.archived_at) return false;
    if (saringStatus === 'aktif' && c.archived_at) return false;
    return cari.trim() ? c.name.toLowerCase().includes(cari.trim().toLowerCase()) : true;
  });
  const mulai = (halaman - 1) * perHalaman;
  const barisHalamanIni = terlihat.slice(mulai, mulai + perHalaman);
  // Baris memuat NILAI YANG DITAMPILKAN, bukan objek mentah. Carbon mengurutkan berdasarkan
  // nilai di baris — baris berisi enum mentah akan mengurut "wholesale" padahal layar
  // menampilkan "Grosir".
  const barisTabel = barisHalamanIni.map((c) => ({
    id: String(c.customer_id),
    name: c.name,
    type: customerTypeLabels[c.customer_type] ?? c.customer_type,
    pic: c.pic_name ?? '',
    payment_terms: c.payment_terms ?? '',
    status: c.archived_at ? 'Diarsipkan' : 'Aktif',
    aksi: ''
  }));
  const kolom = [
    { key: 'name', header: 'Nama' },
    { key: 'type', header: 'Jenis' },
    { key: 'pic', header: 'PIC' },
    { key: 'payment_terms', header: 'Termin pembayaran' },
    { key: 'status', header: 'Status' },
    { key: 'aksi', header: 'Aksi' }
  ];

  const isiSel = (c: Customer, key: string) => {
    if (key === 'name') return <span className="pelanggan-nama">{c.name}</span>;
    if (key === 'type') return customerTypeLabels[c.customer_type] ?? c.customer_type;
    if (key === 'pic') return c.pic_name ?? <span className="halaman__redup">—</span>;
    if (key === 'payment_terms') return c.payment_terms ?? <span className="halaman__redup">—</span>;
    if (key === 'status')
      return c.archived_at ? (
        <Tag type="gray">Diarsipkan{c.archived_by_name ? ` oleh ${c.archived_by_name}` : ''}</Tag>
      ) : (
        <Tag type="green">Aktif</Tag>
      );

    if (!canManage) return <span className="halaman__redup">—</span>;
    // AKSI MERUSAK DIPISAH DAN DIDORONG KE KANAN (aturan modal butir 9): di layar sentuh
    // jari jauh lebih besar daripada kursor, dan aksi yang tidak bisa dibatalkan tidak boleh
    // berjarak satu jari dari aksi sehari-hari.
    return (
      <div className="pelanggan-aksi">
        {!c.archived_at ? (
          <Button size="sm" kind="tertiary" onClick={() => startEdit(c)}>
            Ubah
          </Button>
        ) : (
          <Button size="sm" kind="tertiary" onClick={() => handleRestore(c)}>
            Pulihkan
          </Button>
        )}
        {!c.archived_at ? (
          <Button
            size="sm"
            kind="danger--tertiary"
            className="pelanggan-aksi__merusak"
            onClick={() => (c.can_delete ? handleDelete(c) : handleArchive(c))}
          >
            {/* HAPUS-vs-ARSIPKAN DIHITUNG SERVER, bukan ditawarkan sebagai pilihan: pengguna
                tidak bisa tahu dari layar apakah pelanggan ini pernah punya PO. `can_delete`
                datang dari server, dan tombolnya menyesuaikan. */}
            {c.can_delete ? 'Hapus' : 'Arsipkan'}
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sales & CRM' }, { label: 'Customers' }]}
        judul="Pelanggan"
        pengantar={
          customersLoading
            ? 'Memuat…'
            : `${terlihat.length} pelanggan${cari.trim() ? ` cocok dengan pencarian "${cari.trim()}"` : ''}${
                saringStatus !== 'aktif' ? ', termasuk yang diarsipkan' : ''
              }.`
        }
      />

      {actionMessage ? (
        <InlineNotification
          kind={actionMessage.kind === 'success' ? 'success' : 'error'}
          lowContrast
          title={actionMessage.message}
          onClose={() => {
            setActionMessage(null);
            return true;
          }}
        />
      ) : null}

      {customersLoading ? (
        <DataTableSkeleton columnCount={6} rowCount={6} showHeader={false} />
      ) : (
        <DataTable rows={barisTabel} headers={kolom}>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
            <TableContainer>
              <TableToolbar>
                <TableToolbarContent>
                  <TableToolbarSearch
                    placeholder="Cari nama pelanggan"
                    labelText="Cari pelanggan"
                    onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => {
                      setCari(typeof e === 'string' ? '' : e.target.value);
                      setHalaman(1);
                    }}
                  />
                  <Dropdown
                    id="pelanggan-saring-status"
                    size="lg"
                    className="halaman__saring"
                    label="Status"
                    titleText="Status"
                    hideLabel
                    items={['aktif', 'diarsipkan', 'semua']}
                    itemToString={(v: string) => (v === 'aktif' ? 'Aktif' : v === 'diarsipkan' ? 'Diarsipkan' : 'Semua status')}
                    selectedItem={saringStatus}
                    onChange={({ selectedItem }: { selectedItem: 'aktif' | 'diarsipkan' | 'semua' }) => {
                      setSaringStatus(selectedItem ?? 'aktif');
                      setHalaman(1);
                    }}
                  />
                  {canManage ? (
                    <Button renderIcon={Add} onClick={startCreate}>
                      Tambah pelanggan
                    </Button>
                  ) : null}
                </TableToolbarContent>
              </TableToolbar>
              <Table {...getTableProps()} size="lg" className="tabel-responsif">
                <TableHead>
                  <TableRow>
                    {headers.map((header: any) => {
                      const { key, ...sisa } = getHeaderProps({ header });
                      return (
                        <TableHeader key={key} {...sisa} isSortable={header.key !== 'aksi'}>
                          {header.header}
                        </TableHeader>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={headers.length}>
                        {cari.trim() ? `Tidak ada pelanggan yang cocok dengan "${cari.trim()}".` : 'Belum ada pelanggan.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row: any) => {
                      const c = customers.find((x) => String(x.customer_id) === row.id)!;
                      const { key, ...sisa } = getRowProps({ row });
                      return (
                        <TableRow key={key} {...sisa}>
                          {row.cells.map((cell: any) => (
                            <TableCell key={cell.id} data-label={cell.info.header}>{isiSel(c, cell.info.header)}</TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {/* PEMBAGIAN HALAMAN SELALU TAMPIL, termasuk saat daftarnya kosong — sama seperti
                  cetakan Master Item. Sebelum 26 Agu 2026 ia DISEMBUNYIKAN saat kosong dan
                  pesan kosongnya ditaruh DI LUAR tabel sebagai <p>, dan itulah yang membuat
                  halaman ini terlihat berbeda dari halaman bertabel lain di layar yang sama.
                  Pemilik produk menemukannya dengan membandingkan dua halaman berdampingan. */}
              <Pagination
                page={halaman}
                pageSize={perHalaman}
                pageSizes={[15, 30, 50]}
                totalItems={terlihat.length}
                onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
                  setHalaman(page);
                  setPerHalaman(pageSize);
                }}
                itemsPerPageText="Baris per halaman"
                backwardText="Halaman sebelumnya"
                forwardText="Halaman berikutnya"
                itemRangeText={(mulai: number, akhir: number, total: number) => `${mulai}–${akhir} dari ${total} pelanggan`}
                pageRangeText={(_kini: number, total: number) => `dari ${total} halaman`}
                pageNumberText="Nomor halaman"
              />
            </TableContainer>
          )}
        </DataTable>
      )}

      {canManage ? (
        <ComposedModal
          open={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            resetForm();
            return true;
          }}
          size="md"
        >
          <ModalHeader title={editingCustomerId ? `Ubah pelanggan — ${form.name}` : 'Tambah pelanggan baru'} label="Sales & CRM" />
          <ModalBody hasForm>
            <div className="pelanggan-form">
              <TextInput id="pel-nama" size="lg" labelText="Nama pelanggan" helperText="Contoh: PT Sastro Utama Media Grup" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              <Dropdown
                id="pel-jenis"
                size="lg"
                titleText="Jenis pelanggan"
                label="Pilih jenis"
                items={['company', 'individual']}
                selectedItem={form.customer_type}
                itemToString={(item: string) => customerTypeLabels[item] ?? item}
                onChange={({ selectedItem }: { selectedItem: string | null }) => selectedItem && setForm((prev) => ({ ...prev, customer_type: selectedItem }))}
              />
              <TextInput id="pel-tagih" size="lg" labelText="Alamat penagihan" helperText="Dipakai di faktur." value={form.billing_address} onChange={(e) => setForm((prev) => ({ ...prev, billing_address: e.target.value }))} />
              <TextInput id="pel-kirim" size="lg" labelText="Alamat pengiriman" helperText="Kosongkan bila sama dengan alamat penagihan." value={form.shipping_address} onChange={(e) => setForm((prev) => ({ ...prev, shipping_address: e.target.value }))} />
              <TextInput id="pel-npwp" size="lg" labelText="NPWP" helperText="Contoh: 01.234.567.8-901.000" value={form.npwp} onChange={(e) => setForm((prev) => ({ ...prev, npwp: e.target.value }))} />
              <TextInput id="pel-termin" size="lg" labelText="Termin pembayaran" helperText="Contoh: 30 hari setelah faktur terbit." value={form.payment_terms} onChange={(e) => setForm((prev) => ({ ...prev, payment_terms: e.target.value }))} />
              {/* PIC adalah SATU HAL dengan tiga bagian, jadi SATU label kelompok — bukan tiga
                  label terpisah yang terbaca sebagai tiga isian berbeda. */}
              <fieldset className="pelanggan-pic">
                <legend className="pelanggan-pic__label">Kontak person (PIC)</legend>
                <div className="pelanggan-pic__isi">
                  <TextInput id="pel-pic-nama" size="lg" labelText="Nama" value={form.pic_name} onChange={(e) => setForm((prev) => ({ ...prev, pic_name: e.target.value }))} />
                  <TextInput id="pel-pic-telp" size="lg" labelText="Telepon" value={form.pic_phone} onChange={(e) => setForm((prev) => ({ ...prev, pic_phone: e.target.value }))} />
                  <TextInput id="pel-pic-email" size="lg" labelText="Email" value={form.pic_email} onChange={(e) => setForm((prev) => ({ ...prev, pic_email: e.target.value }))} />
                </div>
              </fieldset>
              <TextInput id="pel-kontak" size="lg" labelText="Kontak lain (opsional)" helperText="Catatan kontak tambahan." value={form.contact_info} onChange={(e) => setForm((prev) => ({ ...prev, contact_info: e.target.value }))} />
              {formMessage ? <InlineNotification kind={formStatus === 'error' ? 'error' : 'success'} lowContrast title={formMessage} hideCloseButton /> : null}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button kind="secondary" onClick={() => { setIsModalOpen(false); resetForm(); }}>
              Batal
            </Button>
            <Button kind="primary" disabled={formStatus === 'saving'} onClick={handleSave}>
              {formStatus === 'saving' ? 'Menyimpan…' : editingCustomerId ? 'Simpan perubahan' : 'Tambah pelanggan'}
            </Button>
          </ModalFooter>
        </ComposedModal>
      ) : null}
    </div>
  );
}

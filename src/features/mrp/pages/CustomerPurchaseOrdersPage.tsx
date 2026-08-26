'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import {
  Button,
  ComposedModal,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineNotification,
  ModalBody,
  ModalHeader,
  NumberInput,
  Pagination,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
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
import { Add, TrashCan } from '@carbon/icons-react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { AreaNotifikasi, type Notifikasi } from '@/components/ui/notifikasi';
import { FooterBertahap, PenandaLangkah, type LangkahModal } from '@/components/ui/modal-bertahap';

// PO KLIEN — dimigrasikan ke Carbon 26 Agu 2026 (DS-09), cetakan Master Item.
import { canManageCustomerPo, canApproveDepartment, isCompanyLeadership } from '@/lib/roles';
import { formatCurrency, formatNumberId } from '@/lib/currency';

const paymentTermsOptions = ['full', 'tempo'];
const customerTypes = ['company', 'individual'];

// Tipe item — disalin nilainya dari itemValidation.ts di sisi server, yang jadi penentu sah
// atau tidaknya. Labelnya Bahasa Indonesia karena ini yang dibaca orang, bukan kodenya.
const TIPE_ITEM: { kode: string; label: string }[] = [
  { kode: 'raw_material', label: 'Bahan baku' },
  { kode: 'wip', label: 'Setengah jadi' },
  { kode: 'finished_good', label: 'Produk jadi' },
  { kode: 'packaging', label: 'Kemasan' }
];
const itemBaruKosong = { item_code: '', name: '', type: 'finished_good', base_uom: '' };

const statusLabels: Record<string, string> = {
  new: 'Baru',
  on_hold: 'Ditunda',
  cancelled: 'Dibatalkan',
  processed: 'Diproses'
};
/// Warna Tag mengikuti ARTI, bukan selera. "Dibatalkan" merah karena ia satu-satunya yang
/// berarti PO tidak akan berlanjut; "ditunda" abu karena ia keadaan sementara, bukan masalah.
const statusWarnaTag: Record<string, 'blue' | 'gray' | 'red' | 'green'> = {
  new: 'blue',
  on_hold: 'gray',
  cancelled: 'red',
  processed: 'green'
};

const approvalWarnaTag: Record<string, 'gray' | 'green' | 'red'> = {
  pending: 'gray',
  approved: 'green',
  rejected: 'red'
};
const approvalStatusLabels: Record<string, string> = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' };
const paymentStatusLabels: Record<string, string> = { pending: 'Menunggu', partial: 'Sebagian', confirmed: 'Lunas' };
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
  identity_predates_snapshot: boolean;
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

// LANGKAH FORMULIR PO KLIEN (DS-18, 26 Agu 2026).
//
// Formulir ini 15 field — terlalu panjang untuk satu modal. Carbon menyediakan Progress modal
// untuk itu, DENGAN SYARAT yang disebut di kalimat berikutnya di halaman Usage-nya:
//   "A progress modal is not a solution for excess modal content. It should only be used to
//    present information in more consumable and focused chunks."
//
// Jadi pemecahan ini BUKAN memuatkan isi yang kebanyakan. Uji yang dipakai, dan yang wajib
// dipakai lagi untuk tiga modal panjang berikutnya: SETIAP BAGIAN BISA DIBERI JUDUL YANG
// MENYEBUT SATU HAL, dan setiap field di dalamnya menjawab hal itu. Bila judulnya terpaksa
// berbunyi "Lanjutan" atau "Bagian 2", pemecahannya salah.
//
// Keempat judul di bawah lulus uji itu: siapa yang memesan · siapa yang dihubungi · kapan dan
// bagaimana dibayar · apa yang dipesan.
//
// JUDUL SENGAJA PENDEK, keterangannya di baris kedua. Diukur lebih dulu: dengan judul panjang
// keempatnya TERPOTONG jadi "Orang yang dihub..." di modal 691px — penanda langkah yang
// terpotong tidak memberi tahu apa pun. Yang dipendekkan judulnya; ARTINYA tetap utuh karena
// pindah ke baris kedua yang memang disediakan Carbon (secondaryLabel).
const LANGKAH_PO: LangkahModal[] = [
  { judul: 'Klien', ringkas: 'Siapa yang memesan' },
  { judul: 'PIC', ringkas: 'Orang yang dihubungi' },
  { judul: 'Tanggal & bayar', ringkas: 'Kapan dan bagaimana' },
  { judul: 'Barang', ringkas: 'Item dan jumlahnya' }
] as const;

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
  const [langkah, setLangkah] = useState(0);
  // HASIL YANG BERHASIL LEWAT NOTIFIKASI, bukan lewat pesan di dalam modal.
  // Sebelum ini pesan "PO berhasil dibuat" disetel ke formMessage TEPAT SEBELUM modalnya
  // ditutup — jadi ia tidak pernah sempat terbaca siapa pun. Yang tersisa di layar hanya
  // daftar yang berubah sendiri tanpa penjelasan.
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const beriTahu = useCallback((jenis: Notifikasi['jenis'], judul: string, rincian?: string) => {
    setNotifikasi((lama) => [...lama, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, jenis, judul, rincian }]);
  }, []);
  const tutupNotifikasi = useCallback((id: string) => setNotifikasi((lama) => lama.filter((n) => n.id !== id)), []);
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
  // PRODUK BARU DARI DALAM MODAL PO — pola yang sama dengan "Klien baru" di langkah 1.
  // Tanpa ini, orang yang menerima PO berisi produk yang belum terdaftar harus membatalkan
  // seluruh isian, pergi ke Master Item, lalu mengulang PO-nya dari nol.
  const [showItemBaru, setShowItemBaru] = useState(false);
  const [itemBaru, setItemBaru] = useState(itemBaruKosong);
  const [itemBaruStatus, setItemBaruStatus] = useState<'idle' | 'pending' | 'error'>('idle');
  const [itemBaruMessage, setItemBaruMessage] = useState('');

  // FASE 3 (Carbon "DataTable with toolbar") — form "Buat PO client baru" pindah ke
  // modal toolbar. Customer TETAP sebagai section expand INLINE di dalam modal yang
  // SAMA (showNewCustomer, sudah begitu sejak awal) — BUKAN modal terpisah/modal-di-
  // dalam-modal, sesuai keputusan eksplisit. Validasi/handleSubmit TIDAK diubah.
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

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
    setLangkah(0);
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

  const handleCreateItem = async () => {
    setItemBaruStatus('pending');
    setItemBaruMessage('');
    // purchase_uom sengaja tidak diminta di sini: server menyamakannya dengan satuan dasar
    // bila kosong. Meminta empat field, bukan enam, karena ini jalan pintas — rinciannya
    // (faktor konversi, masa simpan, biaya standar) dilengkapi nanti di Master Item.
    const { ok, body } = await authedFetch('/api/items', {
      method: 'POST',
      body: JSON.stringify({ ...itemBaru, purchase_uom: itemBaru.base_uom })
    });
    if (!ok) {
      setItemBaruStatus('error');
      setItemBaruMessage(body.error || 'Gagal membuat produk.');
      return;
    }
    setItemBaruStatus('idle');
    setItemBaruMessage('');
    setShowItemBaru(false);

    // DAFTARNYA DIAMBIL ULANG DI SINI, bukan lewat loadItems(), karena id item barunya
    // dibutuhkan SEKARANG — dan `POST /api/items` TIDAK mengembalikannya. Ia hanya menjawab
    // { success: true }.
    //
    // Versi pertama fungsi ini membaca `body.item.item_id` dan memasangnya ke baris kosong.
    // Kodenya terbaca meyakinkan, typecheck lolos, dan ia TIDAK PERNAH BISA BEKERJA — nilai
    // itu tidak ada di jawaban server. Yang menemukannya bukan membaca ulang, melainkan
    // membuat satu PO dari ujung ke ujung dan melihat "Item tidak valid".
    const kodeBaru = itemBaru.item_code.trim();
    setItemBaru(itemBaruKosong);
    const segar = await authedFetch('/api/items');
    const daftar: ItemOption[] = segar.ok ? segar.body.items || [] : [];
    if (daftar.length > 0) setItems(daftar);
    const dibuat = daftar.find((i) => i.item_code === kodeBaru);
    if (dibuat) {
      // Dipasang ke baris pertama yang itemnya masih kosong — orang membuat produk baru
      // justru KARENA sedang mengisi baris itu.
      setForm((prev) => {
        const indeks = prev.lines.findIndex((l) => !l.item_id);
        if (indeks === -1) return prev;
        return { ...prev, lines: prev.lines.map((l, i) => (i === indeks ? { ...l, item_id: String(dibuat.item_id) } : l)) };
      });
    }
  };

  // Dipanggil dari ModalFooter Carbon, bukan dari <form onSubmit>.
  const handleSubmit = async () => {
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

    setFormStatus('idle');
    setFormMessage('');
    resetForm();
    setFormIdempotencyKey(crypto.randomUUID());
    setIsFormModalOpen(false);

    // KEGAGALAN TETAP DI DALAM MODAL, keberhasilan lewat notifikasi — dan bedanya bukan
    // selera: saat gagal, modalnya TETAP TERBUKA dan pesannya menyangkut field yang harus
    // diperbaiki, jadi ia harus berada di tempat field itu. Saat berhasil, modalnya sudah
    // tertutup dan tidak ada lagi tempat untuk menaruh pesannya.
    //
    // DIBERITAHU SEBELUM memuat ulang daftar, bukan sesudah. Versi pertama menaruhnya
    // sesudah `await loadPurchaseOrders()`, dan akibatnya konfirmasinya BARU MUNCUL setelah
    // tabelnya selesai dimuat — layar sempat menampilkan rangka pemuatan tanpa satu pun
    // penjelasan bahwa penyimpanannya berhasil. Pengguna sudah tahu hasilnya sebelum
    // tabelnya siap; menahannya tidak menambah kebenaran apa pun.
    beriTahu(
      'success',
      'PO klien berhasil dibuat',
      'Tiga persetujuan departemen otomatis dibuat dengan status menunggu.'
    );

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


  // ==========================================================================
  // TABEL PO KLIEN — cetakan Master Item
  // ==========================================================================
  const kolom = useMemo(
    () => [
      { key: 'po_number', header: 'No. PO klien' },
      { key: 'status', header: 'Status' },
      { key: 'approvals', header: 'Persetujuan' },
      { key: 'so', header: 'Sales Order' }
    ],
    []
  );

  const poTersaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      if (saringStatus !== 'semua' && po.status !== saringStatus) return false;
      if (!kata) return true;
      return `${po.po_number} ${po.customer_name ?? ''}`.toLowerCase().includes(kata);
    });
  }, [purchaseOrders, cari, saringStatus]);

  const poHalamanIni = useMemo(() => poTersaring.slice((halaman - 1) * perHalaman, halaman * perHalaman), [poTersaring, halaman, perHalaman]);
  const poById = useMemo(() => new Map(purchaseOrders.map((po) => [String(po.customer_purchase_order_id), po])), [purchaseOrders]);

  // Baris memuat NILAI YANG DITAMPILKAN — Carbon mengurutkan berdasarkan nilai di baris.
  const baris = useMemo(
    () =>
      poHalamanIni.map((po) => ({
        id: String(po.customer_purchase_order_id),
        po_number: po.po_number,
        status: statusLabels[po.status] ?? po.status,
        approvals: po.approvals.filter((a) => a.status === 'approved').length,
        so: po.sales_order?.so_number ?? ''
      })),
    [poHalamanIni]
  );

  const isiSel = (po: PurchaseOrder, kunci: string) => {
    switch (kunci) {
      case 'po_number':
        return (
          <div className="po-sel-nomor">
            <span className="po-sel-nomor__utama">{po.po_number}</span>
            <span className="po-sel-nomor__klien">{po.customer_name}</span>
            {po.identity_predates_snapshot ? <span className="po-sel-nomor__klien">Terbit sebelum pembekuan identitas berlaku</span> : null}
          </div>
        );
      case 'status':
        return <Tag type={statusWarnaTag[po.status] ?? 'gray'}>{statusLabels[po.status] ?? po.status}</Tag>;
      case 'approvals':
        // Nama departemen DITULIS PENUH, bukan huruf pertamanya. Satu huruf memaksa orang
        // menghafal singkatan yang tidak pernah dijelaskan di mana pun.
        return (
          <div className="po-sel-approval">
            {po.approvals.map((a) => {
              const warna = approvalWarnaTag[a.status] ?? 'gray';
              return (
                <Tag key={a.customer_po_approval_id} type={warna}>
                  {departmentLabels[a.department] ?? a.department}
                </Tag>
              );
            })}
          </div>
        );
      case 'so':
        return po.sales_order ? po.sales_order.so_number : <span className="halaman__redup">—</span>;
      default:
        return null;
    }
  };

  const detailPo = (po: PurchaseOrder) => {
    const adaKolomHarga = po.lines.some((line) => line.unit_price !== null);
    const semuaSetuju = po.approvals.every((a) => a.status === 'approved');
    return (
      <div className="po-detail">
        <StructuredListWrapper isCondensed aria-label={`Rincian PO ${po.po_number}`}>
          <StructuredListBody>
            {[
              ['Tanggal PO', po.po_date ?? '—'],
              ['Tanggal kirim diminta', po.requested_ship_date ?? '—'],
              ['PIC', `${po.pic_name ?? '—'}${po.pic_position ? ` (${po.pic_position})` : ''}`],
              ['Kontak PIC', `${po.pic_phone ?? '—'} / ${po.pic_email ?? '—'}`],
              ['Syarat bayar', po.payment_terms ?? '—'],
              ['Status bayar', paymentStatusLabels[po.payment_status] ?? po.payment_status]
            ].map(([label, nilai]) => (
              <StructuredListRow key={label}>
                <StructuredListCell noWrap>{label}</StructuredListCell>
                <StructuredListCell>{nilai}</StructuredListCell>
              </StructuredListRow>
            ))}
          </StructuredListBody>
        </StructuredListWrapper>

        <Table size="lg" className="tabel-responsif">
          <TableHead>
            <TableRow>
              <TableHeader>Item</TableHeader>
              <TableHeader>Qty</TableHeader>
              {/* Server sudah menyembunyikan unit_price (null) untuk peran yang tidak berhak.
                  Kepala dan isi tabel WAJIB memakai kondisi yang sama supaya jumlah kolomnya
                  tidak pernah berbeda. */}
              {adaKolomHarga ? <TableHeader>Harga satuan</TableHeader> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {po.lines.map((line) => (
              <TableRow key={line.customer_purchase_order_line_id}>
                <TableCell data-label="Item">
                  {line.item_code} — {line.item_name}
                </TableCell>
                <TableCell data-label="Qty">
                  {formatNumberId(line.qty_ordered, 2)} {line.item_base_uom}
                </TableCell>
                {adaKolomHarga ? <TableCell data-label="Harga satuan">{formatCurrency(line.unit_price, { maxDecimals: 0 })}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <h3 className="halaman__subjudul halaman__subjudul--rapat">Persetujuan tiga departemen</h3>
        <div className="po-approval">
          {po.approvals.map((approval) => {
            const bisaBertindak = canApproveDepartment(role, approval.department) && approval.status === 'pending';
            return (
              <div key={approval.customer_po_approval_id} className="po-approval__baris">
                <div className="po-approval__label">
                  <Tag type={approvalWarnaTag[approval.status] ?? 'gray'}>{departmentLabels[approval.department]}</Tag>
                  <span className="halaman__redup">{approvalStatusLabels[approval.status] ?? approval.status}</span>
                </div>
                {bisaBertindak ? (
                  <div className="po-approval__aksi">
                    <Button
                      size="sm"
                      disabled={busyKey === `approval-${approval.customer_po_approval_id}`}
                      onClick={() => handleApprove(approval.customer_po_approval_id, 'approved')}
                    >
                      Setujui
                    </Button>
                    {/* Aksi merusak DIPISAH: menolak persetujuan menghentikan PO, dan tombolnya
                        tidak boleh berjarak satu jari dari "Setujui" di layar sentuh. */}
                    <span className="po-approval__pemisah" />
                    <Button
                      kind="danger--tertiary"
                      size="sm"
                      disabled={busyKey === `approval-${approval.customer_po_approval_id}`}
                      onClick={() => handleApprove(approval.customer_po_approval_id, 'rejected')}
                    >
                      Tolak
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {po.status === 'new' && semuaSetuju ? (
          isCompanyLeadership(role) ? (
            <div className="po-proses">
              <Dropdown
                id={`po-plant-${po.customer_purchase_order_id}`}
                size="lg"
                className="halaman__saring"
                titleText="Lokasi pabrik (untuk diproses)"
                label="Pilih lokasi..."
                items={plants}
                itemToString={(p: PlantOption | null) => p?.name ?? ''}
                selectedItem={plants.find((p) => String(p.production_plant_id) === (processPlantChoice[po.customer_purchase_order_id] ?? '')) ?? null}
                onChange={({ selectedItem }: { selectedItem: PlantOption | null }) =>
                  setProcessPlantChoice((prev) => ({ ...prev, [po.customer_purchase_order_id]: selectedItem ? String(selectedItem.production_plant_id) : '' }))
                }
              />
              <Button disabled={busyKey === `process-${po.customer_purchase_order_id}`} onClick={() => handleProcess(po)}>
                Proses jadi Sales Order
              </Button>
            </div>
          ) : (
            // Semua persetujuan selesai, tapi Proses tetap terkunci untuk peran selain
            // pimpinan — ditampilkan beserta ALASANNYA, bukan disembunyikan, supaya tidak
            // terlihat seperti fitur yang hilang.
            <InlineNotification
              kind="info"
              lowContrast
              hideCloseButton
              title="Menunggu pimpinan"
              subtitle="Semua persetujuan sudah selesai, tapi hanya Admin Perusahaan atau General Manager yang bisa memproses PO ini menjadi Sales Order."
            />
          )
        ) : null}

        {actionMessage[po.customer_purchase_order_id] ? (
          <InlineNotification kind="info" lowContrast hideCloseButton title="Hasil tindakan" subtitle={actionMessage[po.customer_purchase_order_id]} />
        ) : null}
      </div>
    );
  };

  if (checkingAccess) {
    return (
      <div className="halaman">
        <DataTableSkeleton columnCount={4} rowCount={6} showHeader showToolbar />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <KepalaHalaman remah={[]} judul="PO klien" />
        <InlineNotification kind="error" lowContrast hideCloseButton title="Sesi tidak valid" subtitle="Silakan masuk ulang untuk membuka PO klien." />
        <Button className="po-tombol-masuk" onClick={() => router.push('/login?redirectTo=/customer-purchase-orders')}>
          Ke halaman masuk
        </Button>
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sales & CRM' }, { label: 'Customer POs' }]}
        judul="PO klien"
        pengantar={`${poTersaring.length} PO${adaSaringan ? ` dari ${purchaseOrders.length} yang tercatat` : ' tercatat'} — pesanan yang masuk dari pelanggan, sebelum jadi Sales Order.`}
      />

      {poError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat PO klien" subtitle={poError} /> : null}

      {poLoading ? (
        <DataTableSkeleton columnCount={4} rowCount={6} showHeader showToolbar />
      ) : (
        <>
          <DataTable rows={baris} headers={kolom} isSortable size="lg">
            {(rp: any) => (
              <TableContainer {...rp.getTableContainerProps()}>
                <TableToolbar>
                  <TableToolbarContent>
                    {/* MELIPAT, bukan selalu terbuka — bawaan Carbon, `persistent` tidak dipakai. */}
                    <TableToolbarSearch
                      placeholder="Cari nomor PO atau nama klien…"
                      labelText="Cari PO klien"
                      onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => {
                        setCari(typeof e === 'string' ? '' : e.target.value);
                        setHalaman(1);
                      }}
                    />
                    <Dropdown
                      id="po-saring-status"
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
                    {canManagePo ? (
                      <Button size="lg" renderIcon={Add} onClick={() => setIsFormModalOpen(true)}>
                        Buat PO klien
                      </Button>
                    ) : null}
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...rp.getTableProps()} className="tabel-responsif">
                  <TableHead>
                    <TableRow>
                      <TableExpandHeader aria-label="Buka rincian PO" />
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
                          {adaSaringan ? 'Tidak ada PO yang cocok dengan pencarian atau saringan.' : 'Belum ada PO klien.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rp.rows.map((row: any) => {
                        const po = poById.get(row.id);
                        if (!po) return null;
                        const { key, ...sisaBaris } = rp.getRowProps({ row }) as { key?: string };
                        void key;
                        return (
                          <React.Fragment key={row.id}>
                            {/* BARIS YANG BISA DIMEKARKAN — kemampuan bawaan DataTable, bukan
                                tombol "Detail" yang membuka kartu terpisah di bawah tabel. */}
                            <TableExpandRow
                              {...sisaBaris}
                              isExpanded={expandedPoId === po.customer_purchase_order_id}
                              onExpand={() => setExpandedPoId((kini) => (kini === po.customer_purchase_order_id ? null : po.customer_purchase_order_id))}
                              aria-label={`Rincian ${po.po_number}`}
                            >
                              {kolom.map((h) => (
                                <TableCell key={h.key} data-label={h.header}>
                                  {isiSel(po, h.key)}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow colSpan={kolom.length + 1}>
                              {expandedPoId === po.customer_purchase_order_id ? detailPo(po) : null}
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
            totalItems={poTersaring.length}
            onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
              setHalaman(page);
              setPerHalaman(pageSize);
            }}
            backwardText="Halaman sebelumnya"
            forwardText="Halaman berikutnya"
            itemsPerPageText="Baris per halaman"
            itemRangeText={(mulai: number, akhir: number, total: number) => `${mulai}–${akhir} dari ${total} PO`}
            pageRangeText={(_kini: number, total: number) => `dari ${total} halaman`}
            pageNumberText="Nomor halaman"
          />
        </>
      )}

      {canManagePo ? (
        // MODAL BERTAHAP: baris item ditambah dan dihapus sebelum disimpan.
        <ComposedModal
          open={isFormModalOpen}
          // UKURAN md, BUKAN lg (DS-18). Carbon memilih ukuran dari ISI: lg disediakan untuk
          // komponen kompleks seperti tabel, bukan untuk formulir yang kebetulan panjang.
          // Setelah dipecah jadi empat langkah, tiap langkah isinya sedikit — md sudah lega.
          size="md"
          onClose={() => {
            resetForm();
            setIsFormModalOpen(false);
            return true;
          }}
        >
          <ModalHeader
            label="Sales"
            title="Buat PO klien baru"
            closeModal={() => {
              resetForm();
              setIsFormModalOpen(false);
            }}
          />
          <ModalBody hasForm>
            <div className="po-form">
              {/* PENANDA LANGKAH — komponen Carbon, bukan rakitan sendiri. Ia juga jadi
                  navigasi: langkah yang sudah dilewati bisa diklik untuk kembali. */}
              <PenandaLangkah
                langkah={LANGKAH_PO}
                aktif={langkah}
                onPindah={setLangkah}
                className="po-form__langkah"
              />

              {/* LANGKAH 1 — Klien & nomor PO: siapa yang memesan. */}
              {langkah === 0 ? (
                <div className="po-form__bagian">
                  <div className="po-form__klien">
                    <Dropdown
                      id="po-klien"
                      size="lg"
                      titleText="Klien"
                      label="Pilih klien..."
                      items={customers}
                      itemToString={(c: Customer | null) => (c ? `${c.name} (${c.customer_type === 'individual' ? 'Perorangan' : 'Perusahaan'})` : '')}
                      selectedItem={customers.find((c) => String(c.customer_id) === form.customer_id) ?? null}
                      onChange={({ selectedItem }: { selectedItem: Customer | null }) =>
                        setForm((prev) => ({ ...prev, customer_id: selectedItem ? String(selectedItem.customer_id) : '' }))
                      }
                    />
                    <Button kind="tertiary" size="lg" onClick={() => setShowNewCustomer((v) => !v)}>
                      Klien baru
                    </Button>
                  </div>

                  <TextInput
                    id="po-nomor"
                    size="lg"
                    labelText="Nomor PO klien"
                    helperText="Nomor milik pelanggan — diketik apa adanya, bukan dibuat sistem."
                    value={form.po_number}
                    onChange={(event) => setForm((prev) => ({ ...prev, po_number: event.target.value }))}
                  />

                  {showNewCustomer ? (
                    <div className="po-klien-baru">
                      <TextInput
                        id="po-klien-nama"
                        size="lg"
                        labelText="Nama klien"
                        value={newCustomer.name}
                        onChange={(event) => setNewCustomer((prev) => ({ ...prev, name: event.target.value }))}
                      />
                      <Dropdown
                        id="po-klien-jenis"
                        size="lg"
                        titleText="Jenis klien"
                        label="Pilih jenis"
                        items={customerTypes}
                        itemToString={(t: string) => (t === 'individual' ? 'Perorangan' : 'Perusahaan')}
                        selectedItem={newCustomer.customer_type}
                        onChange={({ selectedItem }: { selectedItem: string | null }) => setNewCustomer((prev) => ({ ...prev, customer_type: selectedItem ?? 'company' }))}
                      />
                      <TextInput
                        id="po-klien-kontak"
                        size="lg"
                        labelText="Kontak"
                        value={newCustomer.contact_info}
                        onChange={(event) => setNewCustomer((prev) => ({ ...prev, contact_info: event.target.value }))}
                      />
                      <Button kind="tertiary" size="lg" disabled={newCustomerStatus === 'pending'} onClick={handleCreateCustomer}>
                        Simpan klien
                      </Button>
                      {newCustomerMessage ? (
                        <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal menyimpan klien" subtitle={newCustomerMessage} />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* LANGKAH 2 — Orang yang dihubungi: PIC di pihak klien. */}
              {langkah === 1 ? (
                <div className="po-form__bagian">
                  <TextInput
                    id="po-pic-nama"
                    size="lg"
                    labelText="Nama PIC"
                    value={form.pic_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, pic_name: event.target.value }))}
                  />
                  <TextInput
                    id="po-pic-jabatan"
                    size="lg"
                    labelText="Jabatan PIC"
                    value={form.pic_position}
                    onChange={(event) => setForm((prev) => ({ ...prev, pic_position: event.target.value }))}
                  />
                  <TextInput
                    id="po-pic-hp"
                    size="lg"
                    labelText="No. HP PIC"
                    value={form.pic_phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, pic_phone: event.target.value }))}
                  />
                  <TextInput
                    id="po-pic-email"
                    size="lg"
                    type="email"
                    labelText="Email PIC"
                    value={form.pic_email}
                    onChange={(event) => setForm((prev) => ({ ...prev, pic_email: event.target.value }))}
                  />
                </div>
              ) : null}

              {/* LANGKAH 3 — Tanggal & pembayaran: kapan dan bagaimana dibayar. */}
              {langkah === 2 ? (
                <div className="po-form__bagian">
                  <TextInput
                    id="po-tanggal"
                    size="lg"
                    type="date"
                    labelText="Tanggal PO"
                    value={form.po_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, po_date: event.target.value }))}
                  />
                  <TextInput
                    id="po-tanggal-kirim"
                    size="lg"
                    type="date"
                    labelText="Tanggal kirim diminta"
                    value={form.requested_ship_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, requested_ship_date: event.target.value }))}
                  />
                  <Dropdown
                    id="po-syarat-bayar"
                    size="lg"
                    titleText="Syarat pembayaran"
                    label="Pilih syarat"
                    items={paymentTermsOptions}
                    itemToString={(o: string) => (o === 'full' ? 'Lunas di muka' : 'Tempo')}
                    selectedItem={form.payment_terms}
                    onChange={({ selectedItem }: { selectedItem: string | null }) => setForm((prev) => ({ ...prev, payment_terms: selectedItem ?? 'full' }))}
                  />
                </div>
              ) : null}

              {/* LANGKAH 4 — Barang yang dipesan. */}
              {langkah === 3 ? (
                <div className="po-baris">
                  <div className="po-baris__kepala">
                    <h3 className="halaman__subjudul halaman__subjudul--rapat">Baris item</h3>
                    <div className="po-baris__aksi">
                      <Button kind="tertiary" size="sm" onClick={() => setShowItemBaru((v) => !v)}>
                        {showItemBaru ? 'Kembali ke baris item' : 'Produk baru'}
                      </Button>
                      {showItemBaru ? null : (
                        <Button kind="tertiary" size="sm" renderIcon={Add} onClick={addLine}>
                          Tambah baris
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* PRODUK BARU tanpa keluar dari modal — pola yang sama dengan "Klien baru".
                      SATU pintu untuk seluruh baris, bukan satu tombol per baris: yang jarang
                      terjadi adalah "produknya belum terdaftar", bukan "baris ini butuh produk
                      sendiri". Empat field saja; rinciannya dilengkapi nanti di Master Item. */}
                  {showItemBaru ? (
                    <div className="po-klien-baru">
                      <TextInput
                        id="po-item-baru-kode"
                        size="lg"
                        labelText="Kode item"
                        value={itemBaru.item_code}
                        onChange={(event) => setItemBaru((prev) => ({ ...prev, item_code: event.target.value }))}
                      />
                      <TextInput
                        id="po-item-baru-nama"
                        size="lg"
                        labelText="Nama item"
                        value={itemBaru.name}
                        onChange={(event) => setItemBaru((prev) => ({ ...prev, name: event.target.value }))}
                      />
                      <Dropdown
                        id="po-item-baru-tipe"
                        size="lg"
                        titleText="Tipe"
                        label="Pilih tipe"
                        items={TIPE_ITEM}
                        itemToString={(t: { kode: string; label: string } | null) => (t ? t.label : '')}
                        selectedItem={TIPE_ITEM.find((t) => t.kode === itemBaru.type) ?? null}
                        onChange={({ selectedItem }: { selectedItem: { kode: string; label: string } | null }) =>
                          setItemBaru((prev) => ({ ...prev, type: selectedItem ? selectedItem.kode : 'finished_good' }))
                        }
                      />
                      <TextInput
                        id="po-item-baru-satuan"
                        size="lg"
                        labelText="Satuan dasar"
                        helperText="Satuan yang dipakai saat dicatat stoknya. Contoh: g, ml, pcs."
                        value={itemBaru.base_uom}
                        onChange={(event) => setItemBaru((prev) => ({ ...prev, base_uom: event.target.value }))}
                      />
                      <Button kind="tertiary" size="lg" disabled={itemBaruStatus === 'pending'} onClick={handleCreateItem}>
                        {itemBaruStatus === 'pending' ? 'Menyimpan...' : 'Simpan produk'}
                      </Button>
                      {itemBaruMessage ? (
                        <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal membuat produk" subtitle={itemBaruMessage} />
                      ) : null}
                    </div>
                  ) : null}
                  {/* Baris item disembunyikan selagi panel "Produk baru" terbuka.
                      BUKAN kerapian: dengan keduanya tampil sekaligus, isi modal jadi lebih
                      tinggi daripada modalnya, dan tombol "Simpan produk" berakhir tepat di
                      batas gulir. Diukur 26 Agu 2026 — saat tombol itu ditekan, isi modal
                      MENGGULIR SENDIRI 84px karena tombolnya baru menerima fokus, sehingga
                      mouseup mendarat di tempat yang sudah bergeser dan peristiwa `click`
                      TIDAK PERNAH TERBENTUK. Gejalanya: klik pertama tidak melakukan apa-apa,
                      klik kedua baru bekerja.
                      Dengan panel berdiri sendiri, isinya muat dan gulirannya tidak terjadi. */}
                  {showItemBaru ? null : form.lines.map((line, index) => (
                    <div key={index} className="po-baris__isi">
                      <Dropdown
                        id={`po-item-${index}`}
                        size="lg"
                        titleText="Item"
                        label="Pilih item..."
                        items={items}
                        itemToString={(i: ItemOption | null) => (i ? `${i.item_code} — ${i.name}` : '')}
                        selectedItem={items.find((i) => String(i.item_id) === line.item_id) ?? null}
                        onChange={({ selectedItem }: { selectedItem: ItemOption | null }) => updateLine(index, { item_id: selectedItem ? String(selectedItem.item_id) : '' })}
                      />
                      <NumberInput
                        id={`po-qty-${index}`}
                        label="Qty"
                        min={0}
                        allowEmpty
                        hideSteppers
                        value={line.qty_ordered === '' ? '' : Number(line.qty_ordered)}
                        onChange={(_e: unknown, { value }: { value: number | string }) => updateLine(index, { qty_ordered: String(value ?? '') })}
                      />
                      <NumberInput
                        id={`po-harga-${index}`}
                        label="Harga satuan"
                        min={0}
                        allowEmpty
                        hideSteppers
                        value={line.unit_price === '' ? '' : Number(line.unit_price)}
                        onChange={(_e: unknown, { value }: { value: number | string }) => updateLine(index, { unit_price: String(value ?? '') })}
                      />
                      <Button kind="danger--tertiary" size="sm" renderIcon={TrashCan} disabled={form.lines.length <= 1} onClick={() => removeLine(index)}>
                        Hapus baris
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Pesan hasil TIDAK ikut dilangkahkan: ia menyangkut seluruh formulir, dan
                  menyembunyikannya di langkah lain berarti pengguna bisa kehilangan alasan
                  kegagalan hanya karena berpindah langkah. */}
              {formMessage ? (
                <InlineNotification
                  kind={formStatus === 'success' ? 'success' : 'error'}
                  lowContrast
                  hideCloseButton
                  title={formStatus === 'success' ? 'Berhasil' : 'Gagal menyimpan'}
                  subtitle={formMessage}
                />
              ) : null}
            </div>
          </ModalBody>
          <FooterBertahap
            langkah={LANGKAH_PO}
            aktif={langkah}
            onPindah={setLangkah}
            onBatal={() => {
              resetForm();
              setIsFormModalOpen(false);
            }}
            labelAksiAkhir="Buat PO klien"
            onSimpan={() => void handleSubmit()}
            sedangMenyimpan={formStatus === 'pending'}
          />
        </ComposedModal>
      ) : null}

      {/* Ditempatkan SEKALI di kaki halaman; posisinya (kanan atas, di bawah header) diatur
          komponennya sendiri. Aturan proyek: jangan menempatkan notifikasi per halaman. */}
      <AreaNotifikasi daftar={notifikasi} onTutup={tutupNotifikasi} />
    </div>
  );
}

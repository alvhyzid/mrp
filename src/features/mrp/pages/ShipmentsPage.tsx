'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import {
  Button,
  ComposedModal,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  FileUploaderButton,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NumberInput,
  Pagination,
  Select,
  SelectItem,
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
import { Camera } from '@carbon/icons-react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { canManageShipments } from '@/lib/roles';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { ConfirmAndSignModal } from '@/features/signatures';
import SuratJalanPreview from '../components/SuratJalanPreview';
import { formatNumberId } from '@/lib/currency';

const SHIPMENT_SIGN_CONFIRMATION_TEXT = 'Sudah di cek dan tambahkan tanda tangan saya';

// Nilai penanda "ketik alamat sekali pakai". BUKAN string kosong: Carbon Select
// memperlakukan nilai kosong sebagai "belum dipilih", dan di sini "sekali pakai"
// adalah pilihan yang SAH, bukan ketiadaan pilihan.
const ALAMAT_SEKALI_PAKAI = 'sekali-pakai';

type AlamatKirim = {
  customer_delivery_address_id: number;
  label: string | null;
  address: string;
  pic_name: string | null;
  pic_phone: string | null;
  archived_at: string | null;
};

// Label kolom Status di "Daftar Pengiriman" SENGAJA beda istilah dari nama status
// database (`shipments.status`, tidak diubah): shipped ("barang sudah keluar gudang,
// dalam perjalanan") ditampilkan "Di Proses" bukan "Terkirim" — "Terkirim" dipakai
// untuk delivered ("barang sudah sampai ke penerima"), lebih sesuai arti kata
// sehari-hari yang diminta user (17 Agu 2026).
const statusLabels: Record<string, string> = { draft: 'Draft', shipped: 'Di Proses', delivered: 'Terkirim', cancelled: 'Batal' };
/// Warna Tag mengikuti ARTI. "Terkirim" ungu, bukan kuning: barang sudah jalan — itu
/// kemajuan, bukan peringatan. Hanya "dibatalkan" yang merah.
const statusWarnaTag: Record<string, 'gray' | 'purple' | 'green' | 'red'> = {
  draft: 'gray',
  shipped: 'purple',
  delivered: 'green',
  cancelled: 'red'
};

type SoLine = {
  sales_order_line_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  qty_ordered: number;
  qty_shipped: number;
  qty_remaining_to_ship: number;
};

type SoShipmentSummary = {
  shipment_id: number;
  shipment_number: string;
  status: string;
  shipment_date: string;
  delivery_address: string;
  created_at: string;
};

type SalesOrder = {
  sales_order_id: number;
  so_number: string;
  customer_id: number;
  customer_name: string | null;
  production_plant_id: number;
  production_plant_name: string | null;
  status: string;
  lines: SoLine[];
  shipments: SoShipmentSummary[];
};

type ShipmentLine = {
  shipment_line_id: number;
  sales_order_line_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  qty_shipped: number;
  lot_id: number;
  lot_number: string | null;
  lot_expiry_date: string | null;
  lot_quantity_on_hand: number | null;
  so_line_qty_ordered: number | null;
  so_line_qty_shipped: number | null;
};

type Shipment = {
  shipment_id: number;
  shipment_number: string;
  shipment_date: string;
  status: string;
  delivery_address: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  dispatch_photo_url: string | null;
  created_at: string;
  sales_order_id: number;
  so_number: string | null;
  customer_id: number | null;
  customer_name: string | null;
  lines: ShipmentLine[];
};

type LotOption = { lot_id: number; item_id: number; lot_number: string; expiry_date: string | null; quantity_on_hand: number };

type LineFormState = { qty_shipped: string; lot_id: string };

export default function ShipmentsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string | null; role: string | null; signature_url: string | null } | null>(null);
  const [companyInfo, setCompanyInfo] = useState<{ name: string; logo_url: string | null } | null>(null);

  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [soError, setSoError] = useState('');
  const [soLoading, setSoLoading] = useState(true);

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipmentsError, setShipmentsError] = useState('');
  const [shipmentsLoading, setShipmentsLoading] = useState(true);

  const [creatingForSoId, setCreatingForSoId] = useState<number | null>(null);
  const [createStep, setCreateStep] = useState<'form' | 'preview'>('form');
  const [lotsByItemId, setLotsByItemId] = useState<Record<number, LotOption[]>>({});
  const [lotsLoaded, setLotsLoaded] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  // WO-S05 (SC-05b) -- alamat yang sudah didaftarkan di halaman Pelanggan dapat DIPILIH
  // di sini. Server SUDAH menerima & memvalidasi `delivery_address_id` sejak PMB-07b
  // (createShipmentWithSignature.ts: milik company yang sama, tidak terarsip, alamatnya
  // DISALIN jadi teks beku); yang belum ada hanyalah pintunya di layar.
  //
  // SUMBER KEBENARAN TIDAK BERUBAH SEDIKIT PUN oleh perubahan ini: yang tercetak di
  // surat jalan tetap `shipments.delivery_address` (teks beku saat pengiriman dibuat),
  // dan `delivery_address_id` tetap sekadar jejak referensi. Memilih dari daftar hanya
  // MENGISI teks itu, bukan menggantikannya dengan rujukan hidup -- jadi mengubah alamat
  // master kelak TIDAK mengubah pengiriman yang sudah terbit.
  //
  // YANG TIDAK DICAKUP: ini TIDAK menyentuh `customers.shipping_address` (kolom lama yang
  // tidak pernah dibaca saat mengirim -- nasibnya menunggu keputusan BL-04/WO-S05b), dan
  // TIDAK menambahkan alamat di tingkat Sales Order (menunggu BD-08).
  const [alamatTersimpan, setAlamatTersimpan] = useState<AlamatKirim[]>([]);
  const [alamatDipilih, setAlamatDipilih] = useState<string>(ALAMAT_SEKALI_PAKAI);
  const [alamatMemuat, setAlamatMemuat] = useState(false);
  const [alamatGalat, setAlamatGalat] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [lineInputs, setLineInputs] = useState<Record<number, LineFormState>>({});
  const [createStatus, setCreateStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [createMessage, setCreateMessage] = useState('');

  const [detailShipmentId, setDetailShipmentId] = useState<number | null>(null);

  // Pencarian, saringan, dan pembagian halaman: Carbon DataTable tidak membawanya.
  const [cari, setCari] = useState('');
  const [saringStatus, setSaringStatus] = useState<string>('semua');
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(15);
  const adaSaringan = cari.trim() !== '' || saringStatus !== 'semua';
  const [statusActionState, setStatusActionState] = useState<Record<number, 'idle' | 'saving'>>({});
  const [statusMessage, setStatusMessage] = useState<Record<number, { text: string; error: boolean }>>({});

  const [dispatchingShipmentId, setDispatchingShipmentId] = useState<number | null>(null);
  const [dispatchPhotoFile, setDispatchPhotoFile] = useState<File | null>(null);
  const [dispatchPhotoPreviewUrl, setDispatchPhotoPreviewUrl] = useState<string | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [dispatchError, setDispatchError] = useState('');

  // Object URL foto preview di modal "Proses Pengiriman" — dibuat/direvoke di sini
  // (bukan dipanggil langsung di JSX) supaya tidak membuat URL baru tiap render dan
  // tidak membocorkan memori saat file diganti/modal ditutup.
  useEffect(() => {
    if (!dispatchPhotoFile) {
      setDispatchPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(dispatchPhotoFile);
    setDispatchPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [dispatchPhotoFile]);

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

  const loadSalesOrders = useCallback(async () => {
    setSoLoading(true);
    const { ok, body } = await authedFetch('/api/sales-orders');
    if (!ok) {
      setSoError(body.error || 'Gagal memuat daftar Sales Order.');
      setSoLoading(false);
      return;
    }
    setSalesOrders(body.salesOrders || []);
    setSoError('');
    setSoLoading(false);
  }, [authedFetch]);

  const loadShipments = useCallback(async () => {
    setShipmentsLoading(true);
    const { ok, body } = await authedFetch('/api/shipments');
    if (!ok) {
      setShipmentsError(body.error || 'Gagal memuat daftar pengiriman.');
      setShipmentsLoading(false);
      return;
    }
    setShipments(body.shipments || []);
    setShipmentsError('');
    setShipmentsLoading(false);
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
        router.replace('/login?redirectTo=/shipments');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      if (!meResponse.ok || !canManageShipments(meData?.user?.role)) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }
      setCurrentUser({ name: meData.user?.name ?? null, role: meData.user?.role ?? null, signature_url: meData.user?.signature_url ?? null });
      if (meData.company) setCompanyInfo({ name: meData.company.name, logo_url: meData.company.logo_url ?? null });
      setCheckingAccess(false);
      await Promise.all([loadSalesOrders(), loadShipments()]);
    };
    checkAccessAndLoad();
  }, [router, loadSalesOrders, loadShipments]);

  const soWithRemaining = useMemo(() => salesOrders.filter((so) => so.lines.some((line) => line.qty_remaining_to_ship > 0)), [salesOrders]);

  // Alamat pengiriman TERAKHIR untuk customer yang sama (SO manapun) — starting point
  // yang bisa diedit, BUKAN auto-terisi permanen. shipments di sini sudah lintas-SO
  // (state company-wide), jadi cakupannya "customer yang sama", bukan cuma "SO yang sama".
  const lastAddressForCustomer = useCallback(
    (customerId: number): string => {
      const candidates = shipments.filter((s) => s.customer_id === customerId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return candidates[0]?.delivery_address ?? '';
    },
    [shipments]
  );

  const muatAlamatTersimpan = useCallback(
    async (customerId: number) => {
      setAlamatMemuat(true);
      setAlamatGalat(null);
      const { ok, body } = await authedFetch(`/api/customer-delivery-addresses?customer_id=${customerId}`);
      setAlamatMemuat(false);
      if (!ok) {
        // Kegagalan memuat daftar TIDAK boleh menghentikan pembuatan pengiriman --
        // mengetik alamat sekali pakai tetap jalan. Tetapi ia juga TIDAK BOLEH DIAM:
        // daftar yang gagal dimuat terlihat sama persis dengan pelanggan yang memang
        // belum punya alamat, dan orang akan mengetik ulang tanpa tahu bedanya.
        setAlamatTersimpan([]);
        setAlamatGalat(typeof (body as { error?: unknown })?.error === 'string' ? String((body as { error: string }).error) : 'Daftar alamat tersimpan gagal dimuat.');
        return;
      }
      const semua = ((body as { addresses?: AlamatKirim[] }).addresses ?? []).filter((a) => !a.archived_at);
      setAlamatTersimpan(semua);
    },
    [authedFetch]
  );

  const openCreateForm = useCallback(
    async (so: SalesOrder) => {
      setCreatingForSoId(so.sales_order_id);
      setCreateStep('form');
      setCreateStatus('idle');
      setCreateMessage('');
      setAlamatTersimpan([]);
      setAlamatDipilih(ALAMAT_SEKALI_PAKAI);
      setAlamatGalat(null);
      void muatAlamatTersimpan(so.customer_id);
      setDeliveryAddress(lastAddressForCustomer(so.customer_id));
      setRecipientName('');
      setRecipientPhone('');
      setVehicleNumber('');
      setDriverName('');

      const remainingLines = so.lines.filter((line) => line.qty_remaining_to_ship > 0);
      setLineInputs(Object.fromEntries(remainingLines.map((line) => [line.sales_order_line_id, { qty_shipped: '', lot_id: '' }])));
      setLotsByItemId({});
      setLotsLoaded(false);

      const itemIds = Array.from(new Set(remainingLines.map((line) => line.item_id)));
      if (itemIds.length === 0) {
        setLotsLoaded(true);
        return;
      }
      const { ok, body } = await authedFetch(`/api/lots?item_ids=${itemIds.join(',')}&production_plant_id=${so.production_plant_id}`);
      if (!ok) {
        setLotsLoaded(true);
        return;
      }
      const lots = (body.lots || []) as LotOption[];
      const byItem: Record<number, LotOption[]> = {};
      for (const lot of lots) {
        byItem[lot.item_id] = byItem[lot.item_id] ?? [];
        byItem[lot.item_id].push(lot);
      }
      setLotsByItemId(byItem);
      setLotsLoaded(true);
      // /api/lots sudah terurut expiry_date terdekat dulu (FEFO) — saran otomatis
      // adalah lot PERTAMA per item, staf bisa ganti manual lewat dropdown.
      setLineInputs((prev) => {
        const next = { ...prev };
        for (const line of remainingLines) {
          const suggested = byItem[line.item_id]?.[0];
          if (suggested) next[line.sales_order_line_id] = { ...next[line.sales_order_line_id], lot_id: String(suggested.lot_id) };
        }
        return next;
      });
    },
    [authedFetch, lastAddressForCustomer, muatAlamatTersimpan]
  );

  const closeCreateForm = () => {
    setCreatingForSoId(null);
    setCreateStep('form');
    setLotsByItemId({});
    setLotsLoaded(false);
    setLineInputs({});
  };

  // Baris valid (qty + lot terisi) untuk SO yang sedang dibuatkan pengiriman — dipakai
  // BERSAMA oleh Langkah 1 ("Lanjut") dan submit final Langkah 2, supaya validasinya
  // konsisten satu sumber, bukan diduplikasi beda-beda di 2 tempat.
  const computeValidLines = (so: SalesOrder) =>
    so.lines
      .filter((line) => line.qty_remaining_to_ship > 0)
      .map((line) => {
        const input = lineInputs[line.sales_order_line_id];
        return { sales_order_line_id: line.sales_order_line_id, item_id: line.item_id, qty_shipped: Number(input?.qty_shipped), lot_id: Number(input?.lot_id) };
      })
      .filter((line) => Number.isFinite(line.qty_shipped) && line.qty_shipped > 0 && line.lot_id > 0);

  // Langkah 1 -> Langkah 2 — MURNI validasi lokal, TIDAK ADA panggilan API sama sekali
  // di sini (sesuai kriteria: menutup wizard sebelum submit final = nol data tercatat,
  // trivial dipenuhi karena memang belum ada request apa pun sampai titik ini).
  const handleGoToPreview = (so: SalesOrder) => {
    if (!deliveryAddress.trim()) {
      setCreateStatus('error');
      setCreateMessage('Alamat tujuan wajib diisi.');
      return;
    }
    if (computeValidLines(so).length === 0) {
      setCreateStatus('error');
      setCreateMessage('Isi jumlah dan pilih lot untuk minimal 1 baris item.');
      return;
    }
    setCreateStatus('idle');
    setCreateMessage('');
    setCreateStep('preview');
  };

  // Dipanggil ConfirmAndSignModal (Langkah 2) HANYA setelah checkbox dicentang & tombol
  // "Buat Pengiriman" diklik. shipments + shipment_lines + document_signatures ditulis
  // dalam 1 transaksi lewat RPC create_shipment_with_signature() (migration 20260817180000)
  // — status SELALU tetap 'draft', stok TIDAK berkurang di sini. Melempar (throw) kalau
  // gagal -> ConfirmAndSignModal menangkap & menampilkan pesannya, modal TIDAK tertutup.
  const handleFinalSubmit = async (so: SalesOrder) => {
    const lines = computeValidLines(so);
    const { ok, body } = await authedFetch('/api/shipments', {
      method: 'POST',
      body: JSON.stringify({
        sales_order_id: so.sales_order_id,
        // Teks tetap dikirim apa pun pilihannya -- server yang memutuskan mana yang
        // dibekukan. Bila id dikirim, server MENIMPA teks ini dengan alamat dari
        // daftar (createShipmentWithSignature.ts:107), jadi keduanya tidak bisa
        // berbeda diam-diam.
        delivery_address: deliveryAddress.trim(),
        ...(alamatDipilih !== ALAMAT_SEKALI_PAKAI ? { delivery_address_id: Number(alamatDipilih) } : {}),
        recipient_name: recipientName.trim() || null,
        recipient_phone: recipientPhone.trim() || null,
        vehicle_number: vehicleNumber.trim() || null,
        driver_name: driverName.trim() || null,
        confirmation_text: SHIPMENT_SIGN_CONFIRMATION_TEXT,
        lines
      })
    });
    if (!ok) {
      throw new Error(body.error || 'Gagal membuat pengiriman.');
    }
    setCreateStatus('success');
    setCreateMessage(`Pengiriman ${body.shipment_number} dibuat & ditandatangani (status draft) — belum mengurangi stok sampai ditandai "Dikirim".`);
    closeCreateForm();
    await Promise.all([loadSalesOrders(), loadShipments()]);
  };

  const handleTransition = async (shipment: Shipment, targetStatus: 'delivered') => {
    setStatusActionState((prev) => ({ ...prev, [shipment.shipment_id]: 'saving' }));
    setStatusMessage((prev) => ({ ...prev, [shipment.shipment_id]: { text: '', error: false } }));
    const { ok, body } = await authedFetch('/api/shipments/status', { method: 'PATCH', body: JSON.stringify({ shipment_id: shipment.shipment_id, status: targetStatus }) });
    setStatusActionState((prev) => ({ ...prev, [shipment.shipment_id]: 'idle' }));
    if (!ok) {
      setStatusMessage((prev) => ({ ...prev, [shipment.shipment_id]: { text: body.error || 'Gagal mengubah status.', error: true } }));
      return;
    }
    setStatusMessage((prev) => ({ ...prev, [shipment.shipment_id]: { text: 'Ditandai diterima.', error: false } }));
    await Promise.all([loadSalesOrders(), loadShipments()]);
  };

  // "Proses Pengiriman" (draft->shipped) — WAJIB foto bukti pengiriman, lihat
  // processShipmentDispatch.ts. FormData, TIDAK lewat authedFetch (helper itu selalu
  // set Content-Type: application/json yang akan merusak boundary multipart).
  const openDispatchModal = (shipmentId: number) => {
    setDetailShipmentId(null);
    setDispatchingShipmentId(shipmentId);
    setDispatchPhotoFile(null);
    setDispatchStatus('idle');
    setDispatchError('');
  };

  const closeDispatchModal = () => {
    setDispatchingShipmentId(null);
    setDispatchPhotoFile(null);
    setDispatchStatus('idle');
    setDispatchError('');
  };

  const handleDispatchSubmit = async () => {
    if (!dispatchingShipmentId || !dispatchPhotoFile) return;
    setDispatchStatus('uploading');
    setDispatchError('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setDispatchStatus('error');
      setDispatchError('Sesi tidak valid.');
      return;
    }

    const formData = new FormData();
    formData.append('shipment_id', String(dispatchingShipmentId));
    formData.append('photo', dispatchPhotoFile);

    const response = await fetch('/api/shipments/dispatch', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: formData });
    const body = await response.json();

    if (!response.ok) {
      setDispatchStatus('error');
      setDispatchError(body.error || 'Gagal memproses pengiriman.');
      return;
    }

    setStatusMessage((prev) => ({ ...prev, [dispatchingShipmentId]: { text: 'Sedang diproses — stok telah berkurang.', error: false } }));
    closeDispatchModal();
    await Promise.all([loadSalesOrders(), loadShipments()]);
  };


  // ==========================================================================
  // TABEL — cetakan Master Item
  // ==========================================================================
  const kolomSo = [
    { key: 'so_number', header: 'No. SO' },
    { key: 'customer', header: 'Klien' },
    { key: 'plant', header: 'Lokasi' },
    { key: 'remaining', header: 'Sisa qty belum terkirim' },
    { key: 'aksi', header: 'Aksi' }
  ];

  const kolomKirim = [
    { key: 'shipment_number', header: 'No. surat jalan' },
    { key: 'customer', header: 'Klien' },
    { key: 'status', header: 'Status' },
    { key: 'delivery_address', header: 'Alamat tujuan' },
    { key: 'created_at', header: 'Dibuat' }
  ];

  const kirimTersaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return shipments.filter((s) => {
      if (saringStatus !== 'semua' && s.status !== saringStatus) return false;
      if (!kata) return true;
      return `${s.shipment_number} ${s.customer_name ?? ''} ${s.so_number ?? ''}`.toLowerCase().includes(kata);
    });
  }, [shipments, cari, saringStatus]);

  const kirimHalamanIni = useMemo(() => kirimTersaring.slice((halaman - 1) * perHalaman, halaman * perHalaman), [kirimTersaring, halaman, perHalaman]);
  const kirimById = useMemo(() => new Map(shipments.map((s) => [String(s.shipment_id), s])), [shipments]);

  const barisKirim = useMemo(
    () =>
      kirimHalamanIni.map((s) => ({
        id: String(s.shipment_id),
        shipment_number: s.shipment_number,
        customer: s.customer_name ?? '',
        status: statusLabels[s.status] ?? s.status,
        delivery_address: s.delivery_address,
        created_at: s.created_at
      })),
    [kirimHalamanIni]
  );

  const isiSelKirim = (s: Shipment, kunci: string) => {
    switch (kunci) {
      case 'shipment_number':
        return (
          <div className="kirim-sel-nomor">
            <span className="kirim-sel-nomor__utama">{s.shipment_number}</span>
            <span className="kirim-sel-nomor__so">{s.so_number}</span>
          </div>
        );
      case 'customer':
        return s.customer_name ?? <span className="halaman__redup">—</span>;
      case 'status':
        return <Tag type={statusWarnaTag[s.status] ?? 'gray'}>{statusLabels[s.status] ?? s.status}</Tag>;
      case 'delivery_address':
        return s.delivery_address;
      case 'created_at':
        return new Date(s.created_at).toLocaleDateString('id-ID');
      default:
        return null;
    }
  };

  const renderShipmentDetail = (shipment: Shipment) => {
    const saving = statusActionState[shipment.shipment_id] === 'saving';
    return (
      <div className="kirim-detail">
        <StructuredListWrapper isCondensed aria-label={`Rincian ${shipment.shipment_number}`}>
          <StructuredListBody>
            {[
              ['No. Sales Order', shipment.so_number],
              ['Klien', shipment.customer_name],
              ['Tanggal', new Date(shipment.shipment_date).toLocaleDateString('id-ID')],
              ['Alamat tujuan', shipment.delivery_address],
              ['Penerima', `${shipment.recipient_name || '—'}${shipment.recipient_phone ? ` (${shipment.recipient_phone})` : ''}`],
              ['Kendaraan', shipment.vehicle_number || '—'],
              ['Sopir', shipment.driver_name || '—']
            ].map(([label, nilai]) => (
              <StructuredListRow key={String(label)}>
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
              <TableHeader>Qty dikirim</TableHeader>
              <TableHeader>Lot</TableHeader>
              {/* Dua kolom terakhir hanya ada setelah pengiriman diproses — sebelum itu
                  angkanya belum berarti apa-apa. Kepala dan isi memakai kondisi yang SAMA
                  supaya jumlah kolomnya tidak pernah berbeda. */}
              {shipment.status !== 'draft' ? <TableHeader>Stok lot saat ini</TableHeader> : null}
              {shipment.status !== 'draft' ? <TableHeader>Total sudah dikirim (SO ini)</TableHeader> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {shipment.lines.map((line) => (
              <TableRow key={line.shipment_line_id}>
                <TableCell data-label="Item">
                  {line.item_code} — {line.item_name}
                </TableCell>
                <TableCell data-label="Qty dikirim">
                  {formatNumberId(line.qty_shipped, 2)} {line.item_base_uom}
                </TableCell>
                <TableCell data-label="Lot">
                  {line.lot_number}
                  {line.lot_expiry_date ? ` (kedaluwarsa ${new Date(line.lot_expiry_date).toLocaleDateString('id-ID')})` : ''}
                </TableCell>
                {shipment.status !== 'draft' ? (
                  <TableCell data-label="Stok lot saat ini">
                    {line.lot_quantity_on_hand ?? '—'} {line.item_base_uom}
                  </TableCell>
                ) : null}
                {shipment.status !== 'draft' ? (
                  <TableCell data-label="Total sudah dikirim (SO ini)">
                    {line.so_line_qty_shipped ?? '—'} / {line.so_line_qty_ordered ?? '—'} {line.item_base_uom}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {shipment.status !== 'draft' && shipment.dispatch_photo_url ? (
          <div className="kirim-foto">
            <span className="cds--label">Foto bukti pengiriman</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shipment.dispatch_photo_url} alt="Foto bukti pengiriman" className="kirim-foto__gambar" />
          </div>
        ) : null}

        {statusMessage[shipment.shipment_id]?.text ? (
          <InlineNotification
            kind={statusMessage[shipment.shipment_id].error ? 'error' : 'success'}
            lowContrast
            hideCloseButton
            title={statusMessage[shipment.shipment_id].error ? 'Gagal' : 'Berhasil'}
            subtitle={statusMessage[shipment.shipment_id].text}
          />
        ) : null}

        <div className="kirim-detail__aksi">
          <Link href={`/shipments/${shipment.shipment_id}/surat-jalan`} target="_blank" rel="noopener noreferrer" className="cds--link">
            Lihat / cetak surat jalan
          </Link>
          {shipment.status === 'draft' ? (
            <Button size="sm" onClick={() => openDispatchModal(shipment.shipment_id)}>
              Proses pengiriman
            </Button>
          ) : null}
          {shipment.status === 'shipped' ? (
            <Button size="sm" disabled={saving} onClick={() => handleTransition(shipment, 'delivered')}>
              {saving ? 'Memproses...' : 'Tandai diterima'}
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  const creatingForSo = salesOrders.find((so) => so.sales_order_id === creatingForSoId) ?? null;
  const dispatchingShipment = shipments.find((s) => s.shipment_id === dispatchingShipmentId) ?? null;

  if (checkingAccess) {
    return (
      <div className="halaman">
        <DataTableSkeleton columnCount={5} rowCount={6} showHeader showToolbar />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <KepalaHalaman remah={[]} judul="Pengiriman" />
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="Akses ditolak"
          subtitle="Halaman Pengiriman hanya untuk Manajer/Staf Gudang, Manajer PPIC, dan pimpinan."
        />
        <Button className="kirim-tombol-masuk" onClick={() => router.push('/login?redirectTo=/shipments')}>
          Ke halaman masuk
        </Button>
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Supply Chain' }, { label: 'Shipments' }]}
        judul="Pengiriman"
        pengantar={`${kirimTersaring.length} surat jalan${adaSaringan ? ` dari ${shipments.length} yang tercatat` : ' tercatat'} — ${soWithRemaining.length} Sales Order masih punya sisa yang belum terkirim.`}
      />

      <h2 className="halaman__subjudul">Sales Order dengan sisa belum terkirim</h2>
      {soError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat Sales Order" subtitle={soError} /> : null}
      {soLoading ? (
        <DataTableSkeleton columnCount={5} rowCount={4} showHeader={false} showToolbar={false} />
      ) : (
        <Table size="lg" className="tabel-responsif">
          <TableHead>
            <TableRow>
              {kolomSo.map((k) => (
                <TableHeader key={k.key}>
                  {k.header}
                  {k.key === 'remaining' ? (
                    <ProvenanceInfoButton
                      label="Sisa qty belum terkirim"
                      envelope={{
                        formula:
                          'qty_ordered (baris Sales Order) − qty_shipped (total sudah dikirim lewat surat jalan berstatus terkirim/diterima). Dihitung server-side per baris SO, bukan diperkirakan.',
                        inputs: [{ label: 'Sumber', value: 'listSalesOrders / listShipments' }]
                      }}
                    />
                  ) : null}
                </TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {soWithRemaining.length === 0 ? (
              <TableRow>
                <TableCell colSpan={kolomSo.length}>Tidak ada Sales Order dengan sisa qty belum terkirim.</TableCell>
              </TableRow>
            ) : (
              soWithRemaining.map((so) => (
                <TableRow key={so.sales_order_id}>
                  <TableCell data-label="No. SO">{so.so_number}</TableCell>
                  <TableCell data-label="Klien">{so.customer_name ?? '—'}</TableCell>
                  <TableCell data-label="Lokasi">{so.production_plant_name ?? '—'}</TableCell>
                  <TableCell data-label="Sisa qty belum terkirim">
                    <div className="kirim-sisa">
                      {so.lines
                        .filter((line) => line.qty_remaining_to_ship > 0)
                        .map((line) => (
                          <span key={line.sales_order_line_id}>
                            {line.item_code}: {formatNumberId(line.qty_remaining_to_ship, 2)} {line.item_base_uom} (dari {formatNumberId(line.qty_ordered, 2)})
                          </span>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell data-label="Aksi">
                    <Button size="sm" onClick={() => (creatingForSoId === so.sales_order_id ? closeCreateForm() : openCreateForm(so))}>
                      {creatingForSoId === so.sales_order_id ? 'Tutup formulir' : 'Buat pengiriman'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <h2 className="halaman__subjudul">Daftar pengiriman</h2>
      {shipmentsError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat pengiriman" subtitle={shipmentsError} /> : null}
      {shipmentsLoading ? (
        <DataTableSkeleton columnCount={5} rowCount={6} showHeader showToolbar />
      ) : (
        <>
          <DataTable rows={barisKirim} headers={kolomKirim} isSortable size="lg">
            {(rp: any) => (
              <TableContainer {...rp.getTableContainerProps()}>
                <TableToolbar>
                  <TableToolbarContent>
                    {/* MELIPAT, bukan selalu terbuka — bawaan Carbon, `persistent` tidak dipakai. */}
                    <TableToolbarSearch
                      placeholder="Cari nomor surat jalan, klien, atau SO…"
                      labelText="Cari pengiriman"
                      onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => {
                        setCari(typeof e === 'string' ? '' : e.target.value);
                        setHalaman(1);
                      }}
                    />
                    <Dropdown
                      id="kirim-saring-status"
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
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...rp.getTableProps()} className="tabel-responsif">
                  <TableHead>
                    <TableRow>
                      <TableExpandHeader aria-label="Buka rincian pengiriman" />
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
                        <TableCell colSpan={kolomKirim.length + 1}>
                          {adaSaringan ? 'Tidak ada pengiriman yang cocok dengan pencarian atau saringan.' : 'Belum ada pengiriman tercatat.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rp.rows.map((row: any) => {
                        const s = kirimById.get(row.id);
                        if (!s) return null;
                        const { key, ...sisaBaris } = rp.getRowProps({ row }) as { key?: string };
                        void key;
                        return (
                          <React.Fragment key={row.id}>
                            <TableExpandRow
                              {...sisaBaris}
                              isExpanded={detailShipmentId === s.shipment_id}
                              onExpand={() => setDetailShipmentId((kini) => (kini === s.shipment_id ? null : s.shipment_id))}
                              aria-label={`Rincian ${s.shipment_number}`}
                            >
                              {kolomKirim.map((h) => (
                                <TableCell key={h.key} data-label={h.header}>
                                  {isiSelKirim(s, h.key)}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow colSpan={kolomKirim.length + 1}>
                              {detailShipmentId === s.shipment_id ? renderShipmentDetail(s) : null}
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
            totalItems={kirimTersaring.length}
            onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
              setHalaman(page);
              setPerHalaman(pageSize);
            }}
            backwardText="Halaman sebelumnya"
            forwardText="Halaman berikutnya"
            itemsPerPageText="Baris per halaman"
            itemRangeText={(mulai: number, akhir: number, total: number) => `${mulai}–${akhir} dari ${total} pengiriman`}
            pageRangeText={(_kini: number, total: number) => `dari ${total} halaman`}
            pageNumberText="Nomor halaman"
          />
        </>
      )}

      {/* LANGKAH 1 dari 2 — modal BERTAHAP: baris item dan detail pengiriman diisi dulu,
          konfirmasinya di langkah berikutnya. */}
      {creatingForSo ? (
        <ComposedModal open={createStep === 'form'} size="md" onClose={() => { closeCreateForm(); return true; }}>
          <ModalHeader
            label="Langkah 1 dari 2"
            title={`Buat pengiriman — ${creatingForSo.so_number} (${creatingForSo.customer_name})`}
            closeModal={closeCreateForm}
          />
          <ModalBody hasForm>
            <div className="kirim-form">
              <h3 className="halaman__subjudul halaman__subjudul--rapat">Rincian Sales Order</h3>
              <StructuredListWrapper isCondensed aria-label="Rincian Sales Order">
                <StructuredListBody>
                  <StructuredListRow>
                    <StructuredListCell noWrap>No. SO</StructuredListCell>
                    <StructuredListCell>{creatingForSo.so_number}</StructuredListCell>
                  </StructuredListRow>
                  <StructuredListRow>
                    <StructuredListCell noWrap>Klien</StructuredListCell>
                    <StructuredListCell>{creatingForSo.customer_name}</StructuredListCell>
                  </StructuredListRow>
                  <StructuredListRow>
                    <StructuredListCell noWrap>Lokasi produksi</StructuredListCell>
                    <StructuredListCell>{creatingForSo.production_plant_name}</StructuredListCell>
                  </StructuredListRow>
                  {creatingForSo.lines.map((line) => (
                    <StructuredListRow key={line.sales_order_line_id}>
                      <StructuredListCell noWrap>
                        {line.item_code} — {line.item_name}
                      </StructuredListCell>
                      <StructuredListCell>
                        Sudah dikirim {formatNumberId(line.qty_shipped, 2)} / {formatNumberId(line.qty_ordered, 2)} {line.item_base_uom}
                        {line.qty_remaining_to_ship > 0 ? ` (sisa ${formatNumberId(line.qty_remaining_to_ship, 2)})` : ' (selesai)'}
                      </StructuredListCell>
                    </StructuredListRow>
                  ))}
                </StructuredListBody>
              </StructuredListWrapper>

              <h3 className="halaman__subjudul halaman__subjudul--rapat">Produk yang dikirim</h3>
              {creatingForSo.lines
                .filter((line) => line.qty_remaining_to_ship > 0)
                .map((line) => {
                  const lotKosong = lotsLoaded && (lotsByItemId[line.item_id] ?? []).length === 0;
                  return (
                    <div key={line.sales_order_line_id} className="kirim-baris">
                      <p className="kirim-baris__judul">
                        {line.item_code} — {line.item_name} · sisa {formatNumberId(line.qty_remaining_to_ship, 2)} {line.item_base_uom}
                      </p>
                      {lotKosong ? (
                        <InlineNotification
                          kind="error"
                          lowContrast
                          hideCloseButton
                          title="Stok fisiknya kosong"
                          subtitle={`Sisa ${formatNumberId(line.qty_remaining_to_ship, 2)} ${line.item_base_uom} ini masih BELUM DIKIRIM dari pesanan, tapi tidak ada satu pun lot tersedia — tidak bisa dikirim sampai ada barang masuk untuk item ini di lokasi pabrik SO ini.`}
                        />
                      ) : (
                        <div className="kirim-baris__isi">
                          <Dropdown
                            id={`kirim-lot-${line.sales_order_line_id}`}
                            size="lg"
                            titleText="Lot"
                            helperText="Saran FEFO — boleh diganti."
                            label={lotsLoaded ? 'Pilih lot...' : 'Memuat lot...'}
                            disabled={!lotsLoaded}
                            items={lotsByItemId[line.item_id] ?? []}
                            itemToString={(lot: any) =>
                              lot
                                ? `${lot.lot_number} — stok ${formatNumberId(lot.quantity_on_hand, 2)} ${line.item_base_uom}${
                                    lot.expiry_date ? ` — kedaluwarsa ${new Date(lot.expiry_date).toLocaleDateString('id-ID')}` : ''
                                  }`
                                : ''
                            }
                            selectedItem={(lotsByItemId[line.item_id] ?? []).find((l: any) => String(l.lot_id) === (lineInputs[line.sales_order_line_id]?.lot_id ?? '')) ?? null}
                            onChange={({ selectedItem }: { selectedItem: any }) =>
                              setLineInputs((prev) => ({
                                ...prev,
                                [line.sales_order_line_id]: { ...prev[line.sales_order_line_id], lot_id: selectedItem ? String(selectedItem.lot_id) : '' }
                              }))
                            }
                          />
                          <NumberInput
                            id={`kirim-qty-${line.sales_order_line_id}`}
                            label="Jumlah kirim"
                            min={0}
                            allowEmpty
                            hideSteppers
                            value={
                              lineInputs[line.sales_order_line_id]?.qty_shipped === undefined || lineInputs[line.sales_order_line_id]?.qty_shipped === ''
                                ? ''
                                : Number(lineInputs[line.sales_order_line_id]?.qty_shipped)
                            }
                            onChange={(_e: unknown, { value }: { value: number | string }) =>
                              setLineInputs((prev) => ({ ...prev, [line.sales_order_line_id]: { ...prev[line.sales_order_line_id], qty_shipped: String(value ?? '') } }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

              <h3 className="halaman__subjudul halaman__subjudul--rapat">Detail pengiriman</h3>
              <div className="kirim-form__kisi">
                {/* SATU label untuk SATU isian. Pemilih dan kotak ketik di bawahnya
                    secara makna adalah hal yang sama -- "ke mana barang ini dikirim" --
                    jadi keduanya berada di bawah label "Alamat tujuan", bukan punya
                    label sendiri-sendiri. */}
                {alamatTersimpan.length > 0 ? (
                  <Select
                    id="kirim-alamat-pilih"
                    size="lg"
                    labelText="Alamat tujuan"
                    helperText="Pilih alamat yang sudah terdaftar, atau ketik alamat sekali pakai."
                    value={alamatDipilih}
                    onChange={(e) => {
                      const nilai = e.target.value;
                      setAlamatDipilih(nilai);
                      if (nilai === ALAMAT_SEKALI_PAKAI) {
                        setDeliveryAddress('');
                        return;
                      }
                      const dipilih = alamatTersimpan.find((a) => String(a.customer_delivery_address_id) === nilai);
                      setDeliveryAddress(dipilih ? dipilih.address : '');
                    }}
                  >
                    {alamatTersimpan.map((a) => (
                      <SelectItem
                        key={a.customer_delivery_address_id}
                        value={String(a.customer_delivery_address_id)}
                        text={a.label ? `${a.label} — ${a.address}` : a.address}
                      />
                    ))}
                    <SelectItem value={ALAMAT_SEKALI_PAKAI} text="Ketik alamat sekali pakai…" />
                  </Select>
                ) : null}

                {alamatMemuat ? <p className="kirim-form__keterangan">Memuat alamat tersimpan…</p> : null}

                {alamatGalat ? (
                  <p className="kirim-form__keterangan kirim-form__keterangan--galat">
                    {alamatGalat} Alamat masih bisa diketik langsung di bawah.
                  </p>
                ) : null}

                {!alamatMemuat && !alamatGalat && alamatTersimpan.length === 0 ? (
                  <p className="kirim-form__keterangan">
                    Pelanggan ini belum punya alamat tersimpan. Alamat bisa didaftarkan di halaman Pelanggan supaya
                    tidak perlu diketik ulang setiap kali mengirim.
                  </p>
                ) : null}

                <TextInput
                  id="kirim-alamat"
                  size="lg"
                  labelText={alamatTersimpan.length > 0 ? 'Alamat tujuan yang akan tercetak' : 'Alamat tujuan'}
                  hideLabel={alamatTersimpan.length > 0}
                  placeholder="Alamat lengkap tujuan pengiriman"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  readOnly={alamatDipilih !== ALAMAT_SEKALI_PAKAI}
                  invalid={deliveryAddress.trim() === ''}
                  invalidText="Alamat tujuan wajib diisi — ia tercetak di surat jalan."
                />
                <TextInput id="kirim-penerima" size="lg" labelText="Nama penerima (opsional)" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                <TextInput id="kirim-hp" size="lg" labelText="No. HP penerima (opsional)" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
                <TextInput
                  id="kirim-kendaraan"
                  size="lg"
                  labelText="Nomor kendaraan (opsional)"
                  placeholder="mis. B 1234 XYZ"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                />
                <TextInput id="kirim-sopir" size="lg" labelText="Nama sopir (opsional)" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
              </div>

              {createMessage ? (
                <InlineNotification
                  kind={createStatus === 'error' ? 'error' : 'success'}
                  lowContrast
                  hideCloseButton
                  title={createStatus === 'error' ? 'Gagal' : 'Berhasil'}
                  subtitle={createMessage}
                />
              ) : null}
            </div>
          </ModalBody>
          {/* `children` WAJIB pada ModalFooter di @carbon/react 1.114. */}
          <ModalFooter>
            <Button kind="secondary" onClick={closeCreateForm}>
              Batal
            </Button>
            <Button kind="primary" onClick={() => handleGoToPreview(creatingForSo)}>
              Lanjut ke pratinjau
            </Button>
          </ModalFooter>
        </ComposedModal>
      ) : null}

      {/* LANGKAH 2 — pratinjau surat jalan + tanda tangan. Dibangun MURNI dari state
          formulir lokal (belum ada pengiriman nyata sampai penyimpanan akhir berhasil). */}
      {creatingForSo ? (
        <ConfirmAndSignModal
          open={createStep === 'preview'}
          onOpenChange={(open) => {
            if (!open) setCreateStep('form');
          }}
          title="Pratinjau surat jalan & tanda tangan"
          confirmationText={SHIPMENT_SIGN_CONFIRMATION_TEXT}
          cancelLabel="Kembali"
          confirmLabel="Buat pengiriman"
          onConfirm={() => handleFinalSubmit(creatingForSo)}
        >
          <SuratJalanPreview
            companyName={companyInfo?.name ?? 'Perusahaan Anda'}
            companyLogoUrl={companyInfo?.logo_url ?? null}
            shipmentNumber={null}
            shipmentDate={new Date().toISOString()}
            soNumber={creatingForSo.so_number}
            customerName={creatingForSo.customer_name ?? '-'}
            deliveryAddress={deliveryAddress || '-'}
            recipientName={recipientName || null}
            vehicleNumber={vehicleNumber || null}
            driverName={driverName || null}
            signerName={currentUser?.name ?? null}
            // penjaga-kebocoran:mulai signerRole diteruskan sebagai PROP; SuratJalanPreview
            // punya peta roleLabels sendiri di dalam komponennya.
            signerRole={currentUser?.role ?? null}
            // penjaga-kebocoran:selesai
            lines={computeValidLines(creatingForSo).map((line) => {
              const soLine = creatingForSo.lines.find((l) => l.sales_order_line_id === line.sales_order_line_id);
              const lot = (lotsByItemId[line.item_id] ?? []).find((l) => l.lot_id === line.lot_id);
              return {
                itemCode: soLine?.item_code ?? null,
                itemName: soLine?.item_name ?? null,
                qty: line.qty_shipped,
                uom: soLine?.item_base_uom ?? null,
                lotNumber: lot?.lot_number ?? String(line.lot_id)
              };
            })}
          />
          <p className="halaman__redup kirim-catatan-draf">
            Status pengiriman ini tetap &quot;Draf&quot; setelah dibuat — stok baru berkurang saat &quot;Proses pengiriman&quot; dilakukan di daftar pengiriman, terpisah.
          </p>
        </ConfirmAndSignModal>
      ) : null}

      {/* "Proses pengiriman" (draf → terkirim) WAJIB berfoto bukti sebelum stok berkurang. */}
      {dispatchingShipment ? (
        <ComposedModal open size="sm" onClose={() => { closeDispatchModal(); return true; }}>
          <ModalHeader label="Kurangi stok" title={`Proses pengiriman — ${dispatchingShipment.shipment_number}`} closeModal={closeDispatchModal} />
          <ModalBody>
            <p className="halaman__pengantar">Unggah foto bukti barang dimuat atau dikirim. Stok berkurang setelah diproses.</p>
            {/* GAMBARNYA SENDIRI ADALAH TOMBOLNYA, mengikuti pola unggah yang berlaku untuk
                seluruh unggahan: diklik → jendela pilih berkas, lalu langsung jadi pratinjau
                dengan keterangan "belum tersimpan". */}
            <div className="kirim-unggah">
              <FileUploaderButton
                accept={['image/png', 'image/jpeg', 'image/webp']}
                buttonKind="ghost"
                disableLabelChanges
                size="lg"
                multiple={false}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDispatchPhotoFile(event.target.files?.[0] ?? null)}
                labelText={
                  <span className="kirim-unggah__kotak">
                    {dispatchPhotoPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={dispatchPhotoPreviewUrl} alt="Pratinjau foto pengiriman" className="kirim-unggah__gambar" />
                    ) : (
                      <Camera size={40} aria-label="Belum ada foto" />
                    )}
                  </span>
                }
              />
              <span className="halaman__redup">
                {dispatchPhotoPreviewUrl ? 'Foto dipilih — belum tersimpan' : 'Klik untuk memilih foto. PNG, JPG, atau WEBP, maksimal 5MB.'}
              </span>
            </div>
            {dispatchError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal" subtitle={dispatchError} /> : null}
          </ModalBody>
          <ModalFooter>
            <Button kind="secondary" onClick={closeDispatchModal}>
              Batal
            </Button>
            <Button kind="primary" disabled={!dispatchPhotoFile || dispatchStatus === 'uploading'} onClick={handleDispatchSubmit}>
              {dispatchStatus === 'uploading' ? 'Memproses...' : 'Proses & kurangi stok'}
            </Button>
          </ModalFooter>
        </ComposedModal>
      ) : null}
    </div>
  );
}

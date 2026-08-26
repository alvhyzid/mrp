'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import {
  Button,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineNotification,
  NumberInput,
  Pagination,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
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
  Tabs,
  Tag,
  TextInput,
  Tile
} from '@carbon/react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { canAccessWarehouseDashboard, canAdjustStock } from '@/lib/roles';
import { typeLabels } from '@/features/mrp';

// GUDANG — dimigrasikan ke Carbon 26 Agu 2026 (DS-09), cetakan Master Item.
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { formatNumberId } from '@/lib/currency';

// `material_shortage` TETAP di daftar ini SENGAJA, meski tidak ada lagi kode yang membuatnya
// (GDG-10, 25 Agu 2026). Alasannya: baris LAMA yang sudah tercatat masih perlu punya label
// saat dilihat. Yang penting dijaga adalah sebaliknya — jangan menambah jenis peringatan yang
// tidak pernah dipicu kode mana pun.
const STOCK_ALERT_TYPES = ['stock_depletion_forecast', 'expiry_risk_low_usage', 'low_stock', 'material_shortage'];

const adjustmentReasonLabels: Record<string, string> = {
  stock_opname_variance: 'Selisih Stok Opname',
  damaged: 'Kerusakan',
  other: 'Lainnya'
};

const severityWarnaTag: Record<string, 'blue' | 'magenta' | 'red'> = { info: 'blue', warning: 'magenta', critical: 'red' };
const severityLabels: Record<string, string> = { info: 'Info', warning: 'Peringatan', critical: 'Kritis' };
// GDG-10 (25 Agu 2026): `low_stock` TIDAK LAGI berarti "stok rendah" saja. Peringatannya
// kini menggabungkan sisa stok DAN kekurangan untuk produksi yang sedang berjalan, jadi ia
// bisa menyala untuk bahan yang stoknya justru masih di atas ambang. Label lama "Stok Rendah"
// akan MENYESATKAN di kasus itu. Labelnya kini mengikuti KEPUTUSAN yang diwakilinya, sama
// seperti kalimat peringatannya sendiri.
//
// Huruf kapital hanya di awal kalimat, mengikuti aturan 25 Agu 2026. Keempatnya dirapikan
// sekalian karena mereka satu daftar — aturan pramuka: yang disentuh, dirapikan.
const alertTypeLabels: Record<string, string> = {
  stock_depletion_forecast: 'Proyeksi stok habis',
  expiry_risk_low_usage: 'Risiko kedaluwarsa (pemakaian lambat)',
  low_stock: 'Perlu dipesan',
  material_shortage: 'Kekurangan bahan (catatan lama)'
};

type StockRow = {
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_type: string | null;
  base_uom: string | null;
  min_stock_level: number | null;
  production_plant_name: string | null;
  total_qty: number;
  lot_count: number;
  is_below_min_stock: boolean;
};

type AlertRow = {
  system_alert_id: number;
  alert_type: string;
  message: string;
  severity: string;
  related_item_code: string | null;
  related_item_name: string | null;
  created_at: string;
};

type PoPendingLine = {
  purchase_order_line_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  purchase_uom: string | null;
  qty_ordered: number;
  qty_received: number;
};
type PoPendingRow = {
  purchase_order_id: number;
  supplier_name: string | null;
  production_plant_name: string | null;
  status: string;
  order_date: string | null;
  expected_date: string | null;
  line_count: number;
  lines: PoPendingLine[];
};

const poStatusLabels: Record<string, string> = { draft: 'Draft', ordered: 'Dipesan', partially_received: 'Sebagian Diterima' };

type LotOption = {
  lot_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  lot_number: string;
  quantity_on_hand: number;
};

type ItemOption = { item_id: number; item_code: string; name: string; base_uom: string; is_active: boolean };
type PlantOption = { production_plant_id: number; name: string };

export default function WarehouseDashboardPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const [stock, setStock] = useState<StockRow[]>([]);
  const [stockError, setStockError] = useState('');
  const [stockLoading, setStockLoading] = useState(true);

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [alertsError, setAlertsError] = useState('');
  const [alertsLoading, setAlertsLoading] = useState(true);

  const [pendingPos, setPendingPos] = useState<PoPendingRow[]>([]);
  const [pendingPosError, setPendingPosError] = useState('');
  const [pendingPosLoading, setPendingPosLoading] = useState(true);

  const [expandedPoId, setExpandedPoId] = useState<number | null>(null);

  // Pencarian, saringan, dan pembagian halaman: Carbon DataTable tidak membawanya.
  const [cari, setCari] = useState('');
  const [saringStok, setSaringStok] = useState<string>('semua');
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(15);
  const adaSaringan = cari.trim() !== '' || saringStok !== 'semua';
  const [receiptQty, setReceiptQty] = useState<Record<number, string>>({});
  const [receiptStatus, setReceiptStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [receiptMessage, setReceiptMessage] = useState('');

  const [lots, setLots] = useState<LotOption[]>([]);
  const [adjustmentForm, setAdjustmentForm] = useState({ lot_id: '', qty_delta: '', reason_code: '', notes: '' });
  const [adjustmentStatus, setAdjustmentStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [adjustmentMessage, setAdjustmentMessage] = useState('');

  const [adjustmentMode, setAdjustmentMode] = useState<'adjust_existing' | 'opening_balance'>('adjust_existing');
  const [items, setItems] = useState<ItemOption[]>([]);
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [openingBalanceForm, setOpeningBalanceForm] = useState({ item_id: '', production_plant_id: '', qty: '', unit_cost: '', lot_number: '', expiry_date: '', notes: '' });
  const [openingBalanceStatus, setOpeningBalanceStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [openingBalanceMessage, setOpeningBalanceMessage] = useState('');

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

  const loadStock = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setStockLoading(true);
    const response = await fetch('/api/stock-summary', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setStockError(data.error || 'Gagal memuat ringkasan stok.');
      setStockLoading(false);
      return;
    }
    setStock(data.stockSummary || []);
    setStockError('');
    setStockLoading(false);
  }, [getAccessToken]);

  const loadAlerts = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setAlertsLoading(true);
    const response = await fetch(`/api/system-alerts?alert_types=${STOCK_ALERT_TYPES.join(',')}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setAlertsError(data.error || 'Gagal memuat peringatan.');
      setAlertsLoading(false);
      return;
    }
    setAlerts(data.alerts || []);
    setAlertsError('');
    setAlertsLoading(false);
  }, [getAccessToken]);

  const loadPendingPos = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setPendingPosLoading(true);
    const response = await fetch('/api/purchase-orders-pending', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setPendingPosError(data.error || 'Gagal memuat PO menunggu.');
      setPendingPosLoading(false);
      return;
    }
    setPendingPos(data.purchaseOrders || []);
    setPendingPosError('');
    setPendingPosLoading(false);
  }, [getAccessToken]);

  const loadLots = useCallback(async () => {
    const { ok, body } = await authedFetch('/api/lots');
    if (ok) setLots(body.lots || []);
  }, [authedFetch]);

  const loadItemsAndPlants = useCallback(async () => {
    const [itemsRes, plantsRes] = await Promise.all([authedFetch('/api/items'), authedFetch('/api/production-plants')]);
    if (itemsRes.ok) setItems((itemsRes.body.items || []).filter((i: ItemOption) => i.is_active));
    if (plantsRes.ok) setPlants(plantsRes.body.plants || []);
  }, [authedFetch]);

  const handleSubmitAdjustment = async () => {
    const qtyDelta = Number(adjustmentForm.qty_delta);
    if (!adjustmentForm.lot_id) {
      setAdjustmentStatus('error');
      setAdjustmentMessage('Pilih lot dulu.');
      return;
    }
    if (!Number.isFinite(qtyDelta) || qtyDelta === 0) {
      setAdjustmentStatus('error');
      setAdjustmentMessage('Isi jumlah penyesuaian (boleh negatif untuk mengurangi), tidak boleh 0.');
      return;
    }
    if (!adjustmentForm.reason_code) {
      setAdjustmentStatus('error');
      setAdjustmentMessage('Pilih alasan penyesuaian.');
      return;
    }
    if (adjustmentForm.reason_code === 'other' && !adjustmentForm.notes.trim()) {
      setAdjustmentStatus('error');
      setAdjustmentMessage('Alasan "Lainnya" wajib diisi catatan bebasnya.');
      return;
    }

    setAdjustmentStatus('saving');
    setAdjustmentMessage('');
    const { ok, body } = await authedFetch('/api/stock-adjustments', {
      method: 'POST',
      body: JSON.stringify({
        lot_id: Number(adjustmentForm.lot_id),
        qty_delta: qtyDelta,
        reason_code: adjustmentForm.reason_code,
        notes: adjustmentForm.notes.trim() || null
      })
    });
    if (!ok) {
      setAdjustmentStatus('error');
      setAdjustmentMessage(body.error || 'Gagal mencatat penyesuaian stok.');
      return;
    }
    setAdjustmentStatus('success');
    setAdjustmentMessage(`Penyesuaian tercatat — stok lot ini sekarang ${formatNumberId(body.quantity_on_hand, 2)}.`);
    setAdjustmentForm({ lot_id: '', qty_delta: '', reason_code: '', notes: '' });
    await Promise.all([loadStock(), loadLots()]);
  };

  const handleSubmitOpeningBalance = async () => {
    const qty = Number(openingBalanceForm.qty);
    if (!openingBalanceForm.item_id) {
      setOpeningBalanceStatus('error');
      setOpeningBalanceMessage('Pilih item dulu.');
      return;
    }
    if (!openingBalanceForm.production_plant_id) {
      setOpeningBalanceStatus('error');
      setOpeningBalanceMessage('Pilih plant/gudang dulu.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setOpeningBalanceStatus('error');
      setOpeningBalanceMessage('Isi jumlah saldo awal, harus lebih besar dari 0.');
      return;
    }

    setOpeningBalanceStatus('saving');
    setOpeningBalanceMessage('');
    const { ok, body } = await authedFetch('/api/stock-adjustments/opening-balance', {
      method: 'POST',
      body: JSON.stringify({
        item_id: Number(openingBalanceForm.item_id),
        production_plant_id: Number(openingBalanceForm.production_plant_id),
        qty,
        unit_cost: openingBalanceForm.unit_cost.trim() ? Number(openingBalanceForm.unit_cost) : null,
        lot_number: openingBalanceForm.lot_number.trim() || null,
        expiry_date: openingBalanceForm.expiry_date || null,
        notes: openingBalanceForm.notes.trim() || null
      })
    });
    if (!ok) {
      setOpeningBalanceStatus('error');
      setOpeningBalanceMessage(body.error || 'Gagal membuat saldo awal stok.');
      return;
    }
    setOpeningBalanceStatus('success');
    setOpeningBalanceMessage(`Saldo awal tercatat — lot baru "${body.lot_number}" dengan stok ${formatNumberId(qty, 2)}.`);
    setOpeningBalanceForm({ item_id: '', production_plant_id: '', qty: '', unit_cost: '', lot_number: '', expiry_date: '', notes: '' });
    await Promise.all([loadStock(), loadLots()]);
  };

  const handleToggleExpand = (po: PoPendingRow) => {
    if (expandedPoId === po.purchase_order_id) {
      setExpandedPoId(null);
      return;
    }
    setExpandedPoId(po.purchase_order_id);
    setReceiptQty({});
    setReceiptStatus('idle');
    setReceiptMessage('');
  };

  const handleSubmitReceipt = async (po: PoPendingRow) => {
    const lines = po.lines
      .filter((l) => receiptQty[l.purchase_order_line_id] && Number(receiptQty[l.purchase_order_line_id]) > 0)
      .map((l) => ({ purchase_order_line_id: l.purchase_order_line_id, qty_received: Number(receiptQty[l.purchase_order_line_id]) }));
    if (lines.length === 0) {
      setReceiptStatus('error');
      setReceiptMessage('Isi jumlah diterima minimal 1 baris.');
      return;
    }
    setReceiptStatus('saving');
    setReceiptMessage('');
    const { ok, body } = await authedFetch('/api/goods-receipts', { method: 'POST', body: JSON.stringify({ purchase_order_id: po.purchase_order_id, lines }) });
    if (!ok) {
      setReceiptStatus('error');
      setReceiptMessage(body.error || 'Gagal mencatat penerimaan barang.');
      return;
    }
    setReceiptStatus('success');
    setReceiptMessage('Barang diterima — lot baru otomatis dibuat dan stok bertambah.');
    setReceiptQty({});
    await Promise.all([loadPendingPos(), loadStock(), loadAlerts()]);
  };

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/warehouse');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      if (!meResponse.ok || !canAccessWarehouseDashboard(meData?.user?.role)) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }
      setRole(meData?.user?.role ?? null);
      setCheckingAccess(false);
      await Promise.all([loadStock(), loadAlerts(), loadPendingPos(), loadLots(), loadItemsAndPlants()]);
    };
    checkAccessAndLoad();
  }, [router, loadStock, loadAlerts, loadPendingPos, loadLots, loadItemsAndPlants]);


  // ==========================================================================
  // TABEL STOK — cetakan Master Item
  // ==========================================================================
  const kolomStok = useMemo(
    () => [
      { key: 'item', header: 'Item' },
      { key: 'type', header: 'Tipe' },
      { key: 'plant', header: 'Lokasi' },
      { key: 'qty', header: 'Total stok' },
      { key: 'status', header: 'Status' }
    ],
    []
  );

  const stokTersaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return stock.filter((r) => {
      if (saringStok === 'bawah-minimum' && !r.is_below_min_stock) return false;
      if (!kata) return true;
      return `${r.item_code ?? ''} ${r.item_name ?? ''}`.toLowerCase().includes(kata);
    });
  }, [stock, cari, saringStok]);

  const stokHalamanIni = useMemo(() => stokTersaring.slice((halaman - 1) * perHalaman, halaman * perHalaman), [stokTersaring, halaman, perHalaman]);

  // Kunci baris memakai gabungan item + NAMA lokasi: satu item bisa muncul di beberapa
  // lokasi, jadi item_id saja akan menabrakkan dua baris yang berbeda. Dipakai nama karena
  // StockRow memang tidak membawa id lokasinya — diperiksa, bukan diasumsikan.
  const kunciStok = (r: StockRow) => `${r.item_id}-${r.production_plant_name ?? ''}`;
  const stokByKunci = useMemo(() => new Map(stock.map((r) => [kunciStok(r), r])), [stock]);

  const barisStok = useMemo(
    () =>
      stokHalamanIni.map((r) => ({
        id: kunciStok(r),
        item: r.item_code ?? '',
        type: r.item_type ? typeLabels[r.item_type] ?? r.item_type : '',
        plant: r.production_plant_name ?? '',
        qty: r.total_qty,
        status: r.is_below_min_stock ? 'Di bawah minimum' : 'Aman'
      })),
    [stokHalamanIni]
  );

  const isiSelStok = (r: StockRow, kunci: string) => {
    switch (kunci) {
      case 'item':
        return (
          <div className="gudang-sel-item">
            <span className="gudang-sel-item__kode">{r.item_code}</span>
            <span className="gudang-sel-item__nama">{r.item_name}</span>
          </div>
        );
      case 'type':
        return r.item_type ? <Tag type="outline">{typeLabels[r.item_type] ?? r.item_type}</Tag> : null;
      case 'plant':
        return r.production_plant_name;
      case 'qty':
        return `${formatNumberId(r.total_qty, 2)} ${r.base_uom} (${formatNumberId(r.lot_count, 0)} lot)`;
      case 'status':
        return r.is_below_min_stock ? <Tag type="red">Di bawah minimum</Tag> : <Tag type="green">Aman</Tag>;
      default:
        return null;
    }
  };

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
        <KepalaHalaman remah={[]} judul="Gudang" />
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="Akses ditolak"
          subtitle="Halaman ini khusus peran yang berwenang atas gudang."
        />
        <Button className="gudang-tombol-kembali" onClick={() => router.push('/dashboard')}>
          Kembali ke ringkasan
        </Button>
      </div>
    );
  }

  const poTerbuka = expandedPoId ? pendingPos.find((p) => p.purchase_order_id === expandedPoId) ?? null : null;

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Supply Chain' }, { label: 'Warehouse' }]}
        judul="Gudang"
        pengantar={`${stokTersaring.length} baris stok${adaSaringan ? ` dari ${stock.length} yang tercatat` : ''} — ${alerts.length} peringatan terbuka, ${pendingPos.length} PO menunggu barang datang.`}
      />

      <h2 className="halaman__subjudul">Stok saat ini per lokasi</h2>
      {stockError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat stok" subtitle={stockError} /> : null}
      {stockLoading ? (
        <DataTableSkeleton columnCount={5} rowCount={6} showHeader showToolbar />
      ) : (
        <>
          <DataTable rows={barisStok} headers={kolomStok} isSortable size="lg">
            {(rp: any) => (
              <TableContainer {...rp.getTableContainerProps()}>
                <TableToolbar>
                  <TableToolbarContent>
                    {/* MELIPAT, bukan selalu terbuka — bawaan Carbon, `persistent` tidak dipakai. */}
                    <TableToolbarSearch
                      placeholder="Cari kode atau nama item…"
                      labelText="Cari stok"
                      onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => {
                        setCari(typeof e === 'string' ? '' : e.target.value);
                        setHalaman(1);
                      }}
                    />
                    <Dropdown
                      id="gudang-saring-stok"
                      size="lg"
                      className="halaman__saring"
                      label="Status"
                      titleText="Status"
                      hideLabel
                      items={['semua', 'bawah-minimum']}
                      itemToString={(v: string) => (v === 'semua' ? 'Semua stok' : 'Di bawah minimum')}
                      selectedItem={saringStok}
                      onChange={({ selectedItem }: { selectedItem: string | null }) => {
                        setSaringStok(selectedItem ?? 'semua');
                        setHalaman(1);
                      }}
                    />
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...rp.getTableProps()} className="tabel-responsif">
                  <TableHead>
                    <TableRow>
                      {rp.headers.map((h: any) => {
                        const { key, ...sisa } = rp.getHeaderProps({ header: h }) as { key?: string };
                        void key;
                        return (
                          // Kolom "Total stok" TIDAK bisa diurut: judulnya memuat tombol
                          // Asal-Usul, dan TableHeader yang bisa diurut adalah <button>.
                          <TableHeader key={h.key} {...sisa} isSortable={h.key !== 'qty'}>
                            {h.header}
                            {h.key === 'qty' ? (
                              <ProvenanceInfoButton
                                label="Total stok"
                                envelope={{
                                  formula:
                                    'Σ quantity_on_hand semua lot berstatus tersedia untuk item ini di lokasi ini, jumlah lot = COUNT lot yang dijumlah. Bukan proyeksi — angka fisik gudang saat ini.',
                                  inputs: [{ label: 'Sumber', value: 'lots (status=available)' }]
                                }}
                              />
                            ) : null}
                          </TableHeader>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rp.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={kolomStok.length}>
                          {adaSaringan ? 'Tidak ada stok yang cocok dengan pencarian atau saringan.' : 'Belum ada stok tercatat.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rp.rows.map((row: any) => {
                        const r = stokByKunci.get(row.id);
                        if (!r) return null;
                        const { key, ...sisaBaris } = rp.getRowProps({ row }) as { key?: string };
                        void key;
                        return (
                          <TableRow key={row.id} {...sisaBaris}>
                            {kolomStok.map((h) => (
                              <TableCell key={h.key} data-label={h.header}>
                                {isiSelStok(r, h.key)}
                              </TableCell>
                            ))}
                          </TableRow>
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
            totalItems={stokTersaring.length}
            onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
              setHalaman(page);
              setPerHalaman(pageSize);
            }}
            backwardText="Halaman sebelumnya"
            forwardText="Halaman berikutnya"
            itemsPerPageText="Baris per halaman"
            itemRangeText={(mulai: number, akhir: number, total: number) => `${mulai}–${akhir} dari ${total} baris stok`}
            pageRangeText={(_kini: number, total: number) => `dari ${total} halaman`}
            pageNumberText="Nomor halaman"
          />
        </>
      )}

      <h2 className="halaman__subjudul">Peringatan — stok mau habis / risiko kedaluwarsa</h2>
      {alertsError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat peringatan" subtitle={alertsError} /> : null}
      {alertsLoading ? (
        <DataTableSkeleton columnCount={4} rowCount={3} showHeader={false} showToolbar={false} />
      ) : (
        <Table size="lg" className="tabel-responsif">
          <TableHead>
            <TableRow>
              <TableHeader>Jenis</TableHeader>
              <TableHeader>Item</TableHeader>
              <TableHeader>
                Pesan
                <ProvenanceInfoButton
                  label="Proyeksi stok/kedaluwarsa"
                  envelope={{
                    formula:
                      'Pemakaian harian rata-rata = Σ qty_consumed 30 hari terakhir ÷ 30. Hari sampai habis = stok tersedia saat ini ÷ pemakaian harian rata-rata. Peringatan "kritis" muncul kalau hari sampai habis ≤ separuh lead time supplier item ini; peringatan kedaluwarsa muncul kalau proyeksi habisnya LEBIH LAMBAT dari tanggal kedaluwarsa lot tertua (bahan mengendap, bukan terpakai).',
                    inputs: [{ label: 'Sumber', value: 'recompute_stock_projection_for_item() — dihitung ulang tiap ada pemakaian bahan' }]
                  }}
                />
              </TableHeader>
              <TableHeader>Tingkat</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>Tidak ada peringatan terbuka saat ini.</TableCell>
              </TableRow>
            ) : (
              alerts.map((a) => (
                <TableRow key={a.system_alert_id}>
                  <TableCell data-label="Jenis">{alertTypeLabels[a.alert_type] ?? a.alert_type}</TableCell>
                  <TableCell data-label="Item">{a.related_item_code ? `${a.related_item_code} — ${a.related_item_name}` : '—'}</TableCell>
                  <TableCell data-label="Pesan">{a.message}</TableCell>
                  <TableCell data-label="Tingkat">
                    <Tag type={severityWarnaTag[a.severity] ?? 'gray'}>{severityLabels[a.severity] ?? a.severity}</Tag>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <h2 className="halaman__subjudul">PO supplier menunggu konfirmasi barang datang</h2>
      {pendingPosError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat PO" subtitle={pendingPosError} /> : null}
      {pendingPosLoading ? (
        <DataTableSkeleton columnCount={6} rowCount={3} showHeader={false} showToolbar={false} />
      ) : (
        <Table size="lg" className="tabel-responsif">
          <TableHead>
            <TableRow>
              <TableHeader>No. PO</TableHeader>
              <TableHeader>Supplier</TableHeader>
              <TableHeader>Tujuan lokasi</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Perkiraan datang</TableHeader>
              <TableHeader>Jumlah baris</TableHeader>
              <TableHeader>Aksi</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {pendingPos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>Tidak ada PO ke supplier yang masih menunggu barang datang.</TableCell>
              </TableRow>
            ) : (
              pendingPos.map((po) => (
                <TableRow key={po.purchase_order_id}>
                  <TableCell data-label="No. PO">PO-{String(po.purchase_order_id).padStart(4, '0')}</TableCell>
                  <TableCell data-label="Supplier">{po.supplier_name}</TableCell>
                  <TableCell data-label="Tujuan lokasi">{po.production_plant_name}</TableCell>
                  <TableCell data-label="Status">{poStatusLabels[po.status] ?? po.status}</TableCell>
                  <TableCell data-label="Perkiraan datang">{po.expected_date ?? '—'}</TableCell>
                  <TableCell data-label="Jumlah baris">{po.line_count}</TableCell>
                  <TableCell data-label="Aksi">
                    <Button kind="ghost" size="sm" onClick={() => handleToggleExpand(po)}>
                      {expandedPoId === po.purchase_order_id ? 'Tutup' : 'Terima barang'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {poTerbuka ? (
        <Tile className="gudang-terima">
          <h3 className="halaman__subjudul halaman__subjudul--rapat">
            Terima barang — PO-{String(poTerbuka.purchase_order_id).padStart(4, '0')} ({poTerbuka.supplier_name})
          </h3>
          {poTerbuka.lines.length === 0 ? (
            <p className="halaman__redup">Semua baris PO ini sudah diterima penuh.</p>
          ) : (
            <>
              {poTerbuka.lines.map((line) => (
                <div key={line.purchase_order_line_id} className="gudang-terima__baris">
                  <div className="gudang-sel-item">
                    <span className="gudang-sel-item__kode">{line.item_code}</span>
                    <span className="gudang-sel-item__nama">{line.item_name}</span>
                  </div>
                  <span className="halaman__redup">
                    Dipesan: {formatNumberId(line.qty_ordered, 2)} {line.purchase_uom}
                  </span>
                  <span className="halaman__redup">
                    Sudah diterima: {formatNumberId(line.qty_received, 2)} {line.purchase_uom}
                  </span>
                  <NumberInput
                    id={`terima-${line.purchase_order_line_id}`}
                    label={`Diterima sekarang (${line.purchase_uom})`}
                    min={0}
                    allowEmpty
                    hideSteppers
                    value={receiptQty[line.purchase_order_line_id] === undefined || receiptQty[line.purchase_order_line_id] === '' ? '' : Number(receiptQty[line.purchase_order_line_id])}
                    onChange={(_e: unknown, { value }: { value: number | string }) =>
                      setReceiptQty((prev) => ({ ...prev, [line.purchase_order_line_id]: String(value ?? '') }))
                    }
                  />
                </div>
              ))}
              {receiptMessage ? (
                <InlineNotification
                  kind={receiptStatus === 'error' ? 'error' : 'success'}
                  lowContrast
                  hideCloseButton
                  title={receiptStatus === 'error' ? 'Gagal' : 'Berhasil'}
                  subtitle={receiptMessage}
                />
              ) : null}
              <Button className="gudang-terima__tombol" disabled={receiptStatus === 'saving'} onClick={() => handleSubmitReceipt(poTerbuka)}>
                {receiptStatus === 'saving' ? 'Menyimpan...' : 'Konfirmasi barang diterima'}
              </Button>
            </>
          )}
        </Tile>
      ) : null}

      {canAdjustStock(role) ? (
        <>
          <h2 className="halaman__subjudul">Penyesuaian stok manual</h2>
          <p className="halaman__redup">
            Khusus stok opname, kerusakan, dan saldo awal — bukan pengganti alur penerimaan, produksi, atau pengiriman yang normal. Setiap penyesuaian tercatat di riwayat
            pergerakan stok beserta alasannya.
          </p>
          {/* TABS Carbon menggantikan dua tombol mentah yang saling menyalakan. Dua pilihan
              yang saling meniadakan dan mengganti ISI di bawahnya memang itulah tabs. */}
          <Tabs
            selectedIndex={adjustmentMode === 'adjust_existing' ? 0 : 1}
            onChange={({ selectedIndex }: { selectedIndex: number }) => setAdjustmentMode(selectedIndex === 0 ? 'adjust_existing' : 'opening_balance')}
          >
            <TabList aria-label="Jenis penyesuaian stok">
              <Tab>Sesuaikan lot yang ada</Tab>
              <Tab>Saldo awal (lot baru)</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <div className="gudang-form">
                  <Dropdown
                    id="gudang-lot"
                    size="lg"
                    titleText="Lot"
                    label="Pilih lot..."
                    items={lots}
                    itemToString={(l: LotOption | null) =>
                      l ? `${l.item_code} — ${l.item_name} — ${l.lot_number} (stok: ${formatNumberId(l.quantity_on_hand, 2)} ${l.item_base_uom})` : ''
                    }
                    selectedItem={lots.find((l) => String(l.lot_id) === adjustmentForm.lot_id) ?? null}
                    onChange={({ selectedItem }: { selectedItem: LotOption | null }) =>
                      setAdjustmentForm((prev) => ({ ...prev, lot_id: selectedItem ? String(selectedItem.lot_id) : '' }))
                    }
                  />
                  <NumberInput
                    id="gudang-delta"
                    label="Jumlah penyesuaian (+/−)"
                    allowEmpty
                    hideSteppers
                    helperText="Angka negatif mengurangi, positif menambah. mis. −5 atau 5."
                    value={adjustmentForm.qty_delta === '' ? '' : Number(adjustmentForm.qty_delta)}
                    onChange={(_e: unknown, { value }: { value: number | string }) => setAdjustmentForm((prev) => ({ ...prev, qty_delta: String(value ?? '') }))}
                  />
                  <Dropdown
                    id="gudang-alasan"
                    size="lg"
                    titleText="Alasan"
                    label="Pilih alasan..."
                    items={Object.keys(adjustmentReasonLabels)}
                    itemToString={(v: string) => adjustmentReasonLabels[v] ?? v}
                    selectedItem={adjustmentForm.reason_code || null}
                    onChange={({ selectedItem }: { selectedItem: string | null }) => setAdjustmentForm((prev) => ({ ...prev, reason_code: selectedItem ?? '' }))}
                  />
                  <TextInput
                    id="gudang-catatan"
                    size="lg"
                    labelText={`Catatan${adjustmentForm.reason_code === 'other' ? ' (wajib)' : ' (opsional)'}`}
                    placeholder="mis. hasil stok opname 15 Agustus, selisih −5 kg"
                    value={adjustmentForm.notes}
                    onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                  {adjustmentMessage ? (
                    <div className="gudang-form__lebar-penuh">
                      <InlineNotification
                        kind={adjustmentStatus === 'success' ? 'success' : 'error'}
                        lowContrast
                        hideCloseButton
                        title={adjustmentStatus === 'success' ? 'Berhasil' : 'Gagal'}
                        subtitle={adjustmentMessage}
                      />
                    </div>
                  ) : null}
                  <div className="gudang-form__lebar-penuh">
                    <Button disabled={adjustmentStatus === 'saving'} onClick={handleSubmitAdjustment}>
                      {adjustmentStatus === 'saving' ? 'Menyimpan...' : 'Catat penyesuaian'}
                    </Button>
                  </div>
                </div>
              </TabPanel>
              <TabPanel>
                <p className="halaman__redup gudang-catatan-saldo">
                  Membuat LOT BARU, bukan menyesuaikan lot yang sudah ada — dipakai untuk memasukkan stok yang sudah ada di gudang sebelum sistem ini dipakai, tanpa perlu ada
                  PO atau penerimaan barang.
                </p>
                <div className="gudang-form">
                  <Dropdown
                    id="gudang-saldo-item"
                    size="lg"
                    titleText="Item"
                    label="Pilih item..."
                    items={items}
                    itemToString={(i: ItemOption | null) => (i ? `${i.item_code} — ${i.name}` : '')}
                    selectedItem={items.find((i) => String(i.item_id) === openingBalanceForm.item_id) ?? null}
                    onChange={({ selectedItem }: { selectedItem: ItemOption | null }) =>
                      setOpeningBalanceForm((prev) => ({ ...prev, item_id: selectedItem ? String(selectedItem.item_id) : '' }))
                    }
                  />
                  <Dropdown
                    id="gudang-saldo-plant"
                    size="lg"
                    titleText="Lokasi/gudang"
                    label="Pilih lokasi..."
                    items={plants}
                    itemToString={(p: PlantOption | null) => p?.name ?? ''}
                    selectedItem={plants.find((p) => String(p.production_plant_id) === openingBalanceForm.production_plant_id) ?? null}
                    onChange={({ selectedItem }: { selectedItem: PlantOption | null }) =>
                      setOpeningBalanceForm((prev) => ({ ...prev, production_plant_id: selectedItem ? String(selectedItem.production_plant_id) : '' }))
                    }
                  />
                  <NumberInput
                    id="gudang-saldo-qty"
                    label="Jumlah"
                    min={0}
                    allowEmpty
                    hideSteppers
                    value={openingBalanceForm.qty === '' ? '' : Number(openingBalanceForm.qty)}
                    onChange={(_e: unknown, { value }: { value: number | string }) => setOpeningBalanceForm((prev) => ({ ...prev, qty: String(value ?? '') }))}
                  />
                  <TextInput
                    id="gudang-saldo-kadaluarsa"
                    size="lg"
                    type="date"
                    labelText="Tanggal kedaluwarsa (opsional)"
                    value={openingBalanceForm.expiry_date}
                    onChange={(event) => setOpeningBalanceForm((prev) => ({ ...prev, expiry_date: event.target.value }))}
                  />
                  <NumberInput
                    id="gudang-saldo-harga"
                    label="Harga per unit (opsional)"
                    min={0}
                    allowEmpty
                    hideSteppers
                    helperText="Kosongkan kalau belum tahu harganya."
                    value={openingBalanceForm.unit_cost === '' ? '' : Number(openingBalanceForm.unit_cost)}
                    onChange={(_e: unknown, { value }: { value: number | string }) => setOpeningBalanceForm((prev) => ({ ...prev, unit_cost: String(value ?? '') }))}
                  />
                  <TextInput
                    id="gudang-saldo-lot"
                    size="lg"
                    labelText="Nomor lot supplier (opsional)"
                    placeholder="Kosongkan untuk dibuatkan otomatis"
                    value={openingBalanceForm.lot_number}
                    onChange={(event) => setOpeningBalanceForm((prev) => ({ ...prev, lot_number: event.target.value }))}
                  />
                  <TextInput
                    id="gudang-saldo-catatan"
                    size="lg"
                    className="gudang-form__lebar-penuh"
                    labelText="Catatan (opsional)"
                    placeholder="mis. hasil stok opname pabrik 18 Agustus"
                    value={openingBalanceForm.notes}
                    onChange={(event) => setOpeningBalanceForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                  {openingBalanceMessage ? (
                    <div className="gudang-form__lebar-penuh">
                      <InlineNotification
                        kind={openingBalanceStatus === 'success' ? 'success' : 'error'}
                        lowContrast
                        hideCloseButton
                        title={openingBalanceStatus === 'success' ? 'Berhasil' : 'Gagal'}
                        subtitle={openingBalanceMessage}
                      />
                    </div>
                  ) : null}
                  <div className="gudang-form__lebar-penuh">
                    <Button disabled={openingBalanceStatus === 'saving'} onClick={handleSubmitOpeningBalance}>
                      {openingBalanceStatus === 'saving' ? 'Menyimpan...' : 'Catat saldo awal'}
                    </Button>
                  </div>
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

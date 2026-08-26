'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import {
  Button,
  Checkbox,
  ComposedModal,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineNotification,
  ModalBody,
  ModalHeader,
  NumberInput,
  Pagination,
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
  TextInput,
  Tile
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { FooterBertahap, PenandaLangkah, type LangkahModal } from '@/components/ui/modal-bertahap';
import { AreaNotifikasi, type Notifikasi } from '@/components/ui/notifikasi';
import { canAccessHrDashboard, canManageHr } from '@/lib/roles';

// DASHBOARD HRD — dimigrasikan ke Carbon 26 Agu 2026 (DS-09).
// Cetakannya mengikuti MASTER ITEM, layar yang sudah disetujui pemilik produk.
import { formatCurrency } from '@/lib/currency';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';

const wageTypeLabels: Record<string, string> = {
  hourly: 'Per Jam',
  daily: 'Harian',
  monthly: 'Bulanan',
  piece_rate: 'Per Unit (Piece Rate)'
};

type Plant = { production_plant_id: number; name: string };

const emptyEmployeeForm = {
  name: '',
  position: '',
  department: '',
  production_plant_id: '',
  wage_type: 'monthly',
  wage_rate: '',
  is_active: true,
  factory_employee_code: '',
  employment_status: '',
  ptkp_status: '',
  ter_category: '',
  ter_rate_percent: '',
  daily_meal_allowance: '',
  daily_transport_allowance: '',
  bpjs_kesehatan_enrolled: ''
};

const departmentLabels: Record<string, string> = {
  production: 'Produksi',
  ppic: 'PPIC',
  finance: 'Finance',
  purchasing: 'Purchasing',
  warehouse: 'Warehouse',
  hr: 'HRD',
  management: 'Manajemen',
  fat: 'FAT (Finance/Accounting/Tax)',
  rnd: 'RnD'
};

const employmentStatusLabels: Record<string, string> = {
  kontrak: 'Kontrak',
  phl: 'PHL',
  freelance: 'Freelance'
};

const attendanceStatusLabels: Record<string, string> = {
  present: 'Hadir',
  late: 'Terlambat',
  absent: 'Tidak hadir',
  on_leave: 'Cuti',
  sick: 'Sakit'
};
/// Warna Tag mengikuti ARTI. "Tidak hadir" merah karena ia satu-satunya yang berarti
/// KEHILANGAN jam kerja tanpa pemberitahuan; cuti dan sakit BUKAN merah — keduanya
/// ketidakhadiran yang sah, dan mewarnainya merah membuat hak karyawan terlihat seperti
/// pelanggaran.
const attendanceWarnaTag: Record<string, 'green' | 'magenta' | 'red' | 'blue' | 'gray'> = {
  present: 'green',
  late: 'magenta',
  absent: 'red',
  on_leave: 'blue',
  sick: 'blue'
};

type Employee = {
  employee_id: number;
  production_plant_id: number | null;
  production_plant_name: string | null;
  department: string | null;
  name: string;
  position: string | null;
  wage_type: string | null;
  wage_rate: number | null;
  is_active: boolean;
  factory_employee_code: string | null;
  employment_status: string | null;
  ptkp_status: string | null;
  ter_category: string | null;
  ter_rate_percent: number | null;
  daily_meal_allowance: number | null;
  daily_transport_allowance: number | null;
  bpjs_kesehatan_enrolled: boolean | null;
  bpjs_contribution_basis: number | null;
  employer_monthly_uplift: number | null;
  employer_monthly_uplift_note: string | null;
};

type AttendanceRow = {
  employee_attendance_id: number;
  employee_id: number;
  employee_name: string | null;
  employee_position: string | null;
  employee_department: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
};

// LANGKAH FORMULIR KARYAWAN (DS-18, 26 Agu 2026) — mengikuti cetakan PO klien.
//
// TIGA langkah, bukan empat. Rencana awal memuat langkah keempat "Penggolongan biaya", dan
// itu DIHAPUS setelah diperiksa: tabel `employees` tidak punya kolom penggolongan sama
// sekali, dan formulirnya tidak punya isiannya. Membuat field baru bukan pekerjaan UI.
//
// Ketiganya lulus uji pemecahan — judulnya menyebut SATU hal, dan tiap field menjawabnya:
// siapa dan di mana bekerja · upah dan tunjangan · potongan dan kepesertaan.
const LANGKAH_KARYAWAN: LangkahModal[] = [
  { judul: 'Identitas', ringkas: 'Siapa dan di mana bekerja' },
  { judul: 'Gaji', ringkas: 'Upah dan tunjangan harian' },
  { judul: 'Pajak & BPJS', ringkas: 'Potongan dan kepesertaan' }
];

export default function HrDashboardPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [canSeeWages, setCanSeeWages] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesError, setEmployeesError] = useState('');
  const [employeesLoading, setEmployeesLoading] = useState(true);

  const [plants, setPlants] = useState<Plant[]>([]);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);
  const [employeeFormStatus, setEmployeeFormStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [employeeFormMessage, setEmployeeFormMessage] = useState('');
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [langkah, setLangkah] = useState(0);
  // Hasil yang BERHASIL lewat notifikasi, bukan pesan di dalam modal yang keburu tertutup.
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const beriTahu = useCallback((jenis: Notifikasi['jenis'], judul: string, rincian?: string) => {
    setNotifikasi((lama) => [...lama, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, jenis, judul, rincian }]);
  }, []);
  const tutupNotifikasi = useCallback((id: string) => setNotifikasi((lama) => lama.filter((n) => n.id !== id)), []);


  // Pencarian, saringan, dan pembagian halaman dulu diurus komponen DataTable lama.
  // Carbon DataTable tidak membawa ketiganya, jadi keadaannya hidup di sini.
  const [cari, setCari] = useState('');
  const [saringStatus, setSaringStatus] = useState<'aktif' | 'nonaktif' | 'semua'>('aktif');
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(15);
  const adaSaringan = cari.trim() !== '' || saringStatus !== 'aktif';

  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadEmployees = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setEmployeesLoading(true);
    const response = await fetch('/api/employees', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setEmployeesError(data.error || 'Gagal memuat daftar karyawan.');
      setEmployeesLoading(false);
      return;
    }
    setEmployees(data.employees || []);
    setCanSeeWages((data.employees || []).some((e: Employee) => e.wage_rate !== null));
    setEmployeesError('');
    setEmployeesLoading(false);
  }, [getAccessToken]);

  const loadPlants = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const response = await fetch('/api/production-plants', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (response.ok) setPlants(data.plants || []);
  }, [getAccessToken]);

  const resetEmployeeForm = () => {
    setLangkah(0);
    setEditingEmployeeId(null);
    setEmployeeForm(emptyEmployeeForm);
    setEmployeeFormStatus('idle');
    setEmployeeFormMessage('');
  };

  const startEditEmployee = (employee: Employee) => {
    setIsEmployeeModalOpen(true);
    setEditingEmployeeId(employee.employee_id);
    setEmployeeForm({
      name: employee.name,
      position: employee.position ?? '',
      department: employee.department ?? '',
      production_plant_id: employee.production_plant_id ? String(employee.production_plant_id) : '',
      wage_type: employee.wage_type ?? 'monthly',
      wage_rate: employee.wage_rate === null ? '' : String(employee.wage_rate),
      is_active: employee.is_active,
      factory_employee_code: employee.factory_employee_code ?? '',
      employment_status: employee.employment_status ?? '',
      ptkp_status: employee.ptkp_status ?? '',
      ter_category: employee.ter_category ?? '',
      ter_rate_percent: employee.ter_rate_percent === null ? '' : String(employee.ter_rate_percent),
      daily_meal_allowance: employee.daily_meal_allowance === null ? '' : String(employee.daily_meal_allowance),
      daily_transport_allowance: employee.daily_transport_allowance === null ? '' : String(employee.daily_transport_allowance),
      bpjs_kesehatan_enrolled: employee.bpjs_kesehatan_enrolled === null ? '' : String(employee.bpjs_kesehatan_enrolled)
    });
    setEmployeeFormStatus('idle');
    setEmployeeFormMessage('');
  };

  // Dipanggil dari ModalFooter Carbon, bukan dari <form onSubmit>.
  const handleEmployeeSubmit = async () => {
    setEmployeeFormStatus('pending');
    setEmployeeFormMessage('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setEmployeeFormStatus('error');
      setEmployeeFormMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }

    const payload = {
      ...(editingEmployeeId ? { employee_id: editingEmployeeId } : {}),
      name: employeeForm.name,
      position: employeeForm.position,
      department: employeeForm.department,
      production_plant_id: employeeForm.production_plant_id,
      wage_type: employeeForm.wage_type,
      wage_rate: employeeForm.wage_rate,
      is_active: employeeForm.is_active,
      factory_employee_code: employeeForm.factory_employee_code,
      employment_status: employeeForm.employment_status,
      ptkp_status: employeeForm.ptkp_status,
      ter_category: employeeForm.ter_category,
      ter_rate_percent: employeeForm.ter_rate_percent,
      daily_meal_allowance: employeeForm.daily_meal_allowance,
      daily_transport_allowance: employeeForm.daily_transport_allowance,
      bpjs_kesehatan_enrolled: employeeForm.bpjs_kesehatan_enrolled === '' ? null : employeeForm.bpjs_kesehatan_enrolled === 'true'
    };

    const response = await fetch('/api/employees', {
      method: editingEmployeeId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      setEmployeeFormStatus('error');
      setEmployeeFormMessage(data.error || 'Gagal menyimpan data karyawan.');
      return;
    }

    const memperbarui = editingEmployeeId !== null;
    setEmployeeFormStatus('idle');
    setEmployeeFormMessage('');
    resetEmployeeForm();
    setIsEmployeeModalOpen(false);
    beriTahu(
      'success',
      memperbarui ? 'Data karyawan diperbarui' : 'Karyawan baru ditambahkan',
      memperbarui ? undefined : 'Sudah masuk daftar karyawan aktif.'
    );
    await loadEmployees();
  };

  const loadAttendance = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setAttendanceLoading(true);
    const response = await fetch('/api/employee-attendance', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setAttendanceError(data.error || 'Gagal memuat absensi.');
      setAttendanceLoading(false);
      return;
    }
    setAttendance(data.attendance || []);
    setAttendanceDate(data.date || '');
    setAttendanceError('');
    setAttendanceLoading(false);
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
        router.replace('/login?redirectTo=/hr');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      if (!meResponse.ok || !canAccessHrDashboard(meData?.user?.role)) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }
      setCanManage(canManageHr(meData?.user?.role));
      setCheckingAccess(false);
      await Promise.all([loadEmployees(), loadAttendance(), loadPlants()]);
    };
    checkAccessAndLoad();
  }, [router, loadEmployees, loadAttendance, loadPlants]);

  const activeCount = employees.filter((e) => e.is_active).length;
  const inactiveCount = employees.length - activeCount;
  const presentToday = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;


  // ==========================================================================
  // TABEL KARYAWAN — cetakan Master Item
  // ==========================================================================
  const kolomKaryawan = useMemo(() => {
    const k = [
      { key: 'name', header: 'Nama' },
      { key: 'code', header: 'Kode karyawan' },
      { key: 'position', header: 'Posisi' },
      { key: 'department', header: 'Department' },
      { key: 'plant', header: 'Lokasi' },
      { key: 'employment_status', header: 'Status kepegawaian' }
    ];
    if (canSeeWages) {
      k.push({ key: 'wage', header: 'Upah' });
      k.push({ key: 'employer_monthly_uplift', header: 'Biaya pemberi kerja/bulan' });
    }
    k.push({ key: 'is_active', header: 'Status' });
    if (canManage) k.push({ key: 'aksi', header: 'Aksi' });
    return k;
  }, [canSeeWages, canManage]);

  const karyawanTersaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return employees.filter((e) => {
      if (saringStatus === 'aktif' && !e.is_active) return false;
      if (saringStatus === 'nonaktif' && e.is_active) return false;
      if (!kata) return true;
      return `${e.name} ${e.position ?? ''} ${e.factory_employee_code ?? ''}`.toLowerCase().includes(kata);
    });
  }, [employees, cari, saringStatus]);

  const karyawanHalamanIni = useMemo(
    () => karyawanTersaring.slice((halaman - 1) * perHalaman, halaman * perHalaman),
    [karyawanTersaring, halaman, perHalaman]
  );

  const karyawanById = useMemo(() => new Map(employees.map((e) => [String(e.employee_id), e])), [employees]);

  // Baris memuat NILAI YANG DITAMPILKAN — Carbon mengurutkan berdasarkan nilai di baris,
  // jadi kolom Department harus mengurut "Produksi", bukan slug `production`.
  const barisKaryawan = useMemo(
    () =>
      karyawanHalamanIni.map((e) => ({
        id: String(e.employee_id),
        name: e.name,
        code: e.factory_employee_code ?? '',
        position: e.position ?? '',
        department: e.department ? departmentLabels[e.department] ?? e.department : '',
        plant: e.production_plant_name ?? '',
        employment_status: e.employment_status ? employmentStatusLabels[e.employment_status] ?? e.employment_status : '',
        ...(canSeeWages ? { wage: e.wage_rate ?? 0, employer_monthly_uplift: e.employer_monthly_uplift ?? 0 } : {}),
        is_active: e.is_active ? 'Aktif' : 'Nonaktif',
        ...(canManage ? { aksi: '' } : {})
      })),
    [karyawanHalamanIni, canSeeWages, canManage]
  );

  const isiSelKaryawan = (e: Employee, kunci: string) => {
    switch (kunci) {
      case 'name':
        return e.name;
      case 'code':
        return e.factory_employee_code ?? <span className="halaman__redup">—</span>;
      case 'position':
        return e.position ?? <span className="halaman__redup">—</span>;
      case 'department':
        return e.department ? <Tag type="cool-gray">{departmentLabels[e.department] ?? e.department}</Tag> : <span className="halaman__redup">—</span>;
      case 'plant':
        return e.production_plant_name ?? <span className="halaman__redup">—</span>;
      case 'employment_status':
        return e.employment_status ? <Tag type="outline">{employmentStatusLabels[e.employment_status] ?? e.employment_status}</Tag> : <span className="halaman__redup">—</span>;
      case 'wage':
        return e.wage_rate === null ? (
          <span className="halaman__redup">—</span>
        ) : (
          `${formatCurrency(e.wage_rate, { maxDecimals: 0 })} / ${(e.wage_type ? wageTypeLabels[e.wage_type] : null) ?? e.wage_type}`
        );
      case 'employer_monthly_uplift':
        return e.employer_monthly_uplift !== null ? (
          formatCurrency(e.employer_monthly_uplift, { maxDecimals: 0 })
        ) : (
          <span className="halaman__redup">{e.wage_type === 'monthly' ? '—' : 'N/A (non-bulanan)'}</span>
        );
      case 'is_active':
        return e.is_active ? <Tag type="green">Aktif</Tag> : <Tag type="cool-gray">Nonaktif</Tag>;
      case 'aksi':
        return (
          <Button kind="ghost" size="sm" onClick={() => startEditEmployee(e)}>
            Ubah
          </Button>
        );
      default:
        return null;
    }
  };

  // Absensi hari ini: tabel statis, tanpa toolbar. Ia potret satu hari, bukan daftar yang
  // dicari — memberinya pencarian dan pembagian halaman hanya menambah kontrol yang tidak
  // akan dipakai.
  const kolomAbsensi = [
    { key: 'employee_name', header: 'Nama' },
    { key: 'department', header: 'Department' },
    { key: 'status', header: 'Status' },
    { key: 'check_in', header: 'Jam masuk' },
    { key: 'check_out', header: 'Jam pulang' }
  ];

  const jam = (nilai: string | null) => (nilai ? new Date(nilai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—');

  if (checkingAccess) {
    return (
      <div className="halaman">
        <DataTableSkeleton columnCount={6} rowCount={6} showHeader showToolbar />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <KepalaHalaman remah={[]} judul="HRD" />
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="Akses ditolak"
          subtitle="Halaman ini khusus Admin Perusahaan, General Manager, Manajer HRD, atau Staf HRD."
        />
        <Button className="hr-tombol-kembali" onClick={() => router.push('/dashboard')}>
          Kembali ke ringkasan
        </Button>
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'People' }, { label: 'HR Dashboard' }]}
        judul="HRD"
        pengantar={`${karyawanTersaring.length} karyawan${adaSaringan ? ` dari ${employees.length} yang tercatat` : ' tercatat'} — ${presentToday} hadir hari ini (${attendanceDate}).`}
      />

      <div className="kisi-metrik">
        <Tile>
          <span className="metrik__label">Karyawan aktif</span>
          <span className="metrik__angka">{activeCount}</span>
        </Tile>
        <Tile>
          <span className="metrik__label">Karyawan nonaktif</span>
          <span className="metrik__angka">{inactiveCount}</span>
        </Tile>
        <Tile>
          <span className="metrik__label">Hadir hari ini ({attendanceDate})</span>
          <span className="metrik__angka">{presentToday}</span>
        </Tile>
      </div>

      <h2 className="halaman__subjudul">Absensi hari ini ({attendanceDate})</h2>
      {attendanceError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat absensi" subtitle={attendanceError} /> : null}
      {attendanceLoading ? (
        <DataTableSkeleton columnCount={5} rowCount={4} showHeader={false} showToolbar={false} />
      ) : (
        <Table size="lg" className="tabel-responsif">
          <TableHead>
            <TableRow>
              {kolomAbsensi.map((k) => (
                <TableHeader key={k.key}>{k.header}</TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {attendance.length === 0 ? (
              <TableRow>
                <TableCell colSpan={kolomAbsensi.length}>Belum ada absensi tercatat hari ini.</TableCell>
              </TableRow>
            ) : (
              attendance.map((a) => (
                <TableRow key={a.employee_attendance_id}>
                  <TableCell data-label={kolomAbsensi[0].header}>{a.employee_name}</TableCell>
                  <TableCell data-label={kolomAbsensi[1].header}>{a.employee_department ? departmentLabels[a.employee_department] ?? a.employee_department : '—'}</TableCell>
                  <TableCell data-label={kolomAbsensi[2].header}>
                    <Tag type={attendanceWarnaTag[a.status] ?? 'gray'}>{attendanceStatusLabels[a.status] ?? a.status}</Tag>
                  </TableCell>
                  <TableCell data-label={kolomAbsensi[3].header}>{jam(a.check_in_at)}</TableCell>
                  <TableCell data-label={kolomAbsensi[4].header}>{jam(a.check_out_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <h2 className="halaman__subjudul">Daftar karyawan</h2>
      {employeesError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat karyawan" subtitle={employeesError} /> : null}
      {employeesLoading ? (
        <DataTableSkeleton columnCount={kolomKaryawan.length} rowCount={6} showHeader showToolbar />
      ) : (
        <>
          <DataTable rows={barisKaryawan} headers={kolomKaryawan} isSortable size="lg">
            {(rp: any) => (
              <TableContainer {...rp.getTableContainerProps()}>
                <TableToolbar>
                  <TableToolbarContent>
                    {/* MELIPAT, bukan selalu terbuka — bawaan Carbon, `persistent` tidak dipakai. */}
                    <TableToolbarSearch
                      placeholder="Cari nama, posisi, atau kode…"
                      labelText="Cari karyawan"
                      onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => {
                        setCari(typeof e === 'string' ? '' : e.target.value);
                        setHalaman(1);
                      }}
                    />
                    <Dropdown
                      id="hr-saring-status"
                      size="lg"
                      className="halaman__saring"
                      label="Status"
                      titleText="Status"
                      hideLabel
                      items={['aktif', 'nonaktif', 'semua']}
                      itemToString={(v: string) => (v === 'aktif' ? 'Aktif' : v === 'nonaktif' ? 'Nonaktif' : 'Semua status')}
                      selectedItem={saringStatus}
                      onChange={({ selectedItem }: { selectedItem: 'aktif' | 'nonaktif' | 'semua' }) => {
                        setSaringStatus(selectedItem ?? 'aktif');
                        setHalaman(1);
                      }}
                    />
                    {canManage ? (
                      <Button
                        size="lg"
                        renderIcon={Add}
                        onClick={() => {
                          resetEmployeeForm();
                          setIsEmployeeModalOpen(true);
                        }}
                      >
                        Tambah karyawan
                      </Button>
                    ) : null}
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...rp.getTableProps()} className="tabel-responsif--lebar">
                  <TableHead>
                    <TableRow>
                      {rp.headers.map((h: any) => {
                        const { key, ...sisa } = rp.getHeaderProps({ header: h }) as { key?: string };
                        void key;
                        return (
                          // Kolom "Biaya pemberi kerja/bulan" TIDAK bisa diurut: judulnya memuat
                          // tombol Asal-Usul, dan TableHeader yang bisa diurut adalah <button>.
                          // Tombol di dalam tombol adalah HTML tidak sah.
                          <TableHeader key={h.key} {...sisa} isSortable={h.key !== 'employer_monthly_uplift' && h.key !== 'aksi'}>
                            {h.header}
                            {h.key === 'employer_monthly_uplift' ? (
                              <ProvenanceInfoButton
                                label="Biaya pemberi kerja per bulan"
                                envelope={{
                                  formula:
                                    'JKK + JKM + JHT (selalu dihitung) + BPJS Kesehatan (hanya kalau bpjs_kesehatan_enrolled=true eksplisit). Tiap komponen = basis iuran × rate tenant (company_settings). Basis iuran = bpjs_contribution_basis per orang kalau diisi, kalau tidak = clamp(gaji pokok, floor tenant, ceiling tenant). HANYA berlaku untuk karyawan wage_type=bulanan — PHL/harian tidak punya angka "per bulan" yang tetap.',
                                  inputs: [{ label: 'Rate & floor/ceiling', value: 'company_settings (bpjs_*_employer_rate_percent, bpjs_wage_basis_floor/ceiling)' }],
                                  sourceDocument: 'computeEmployerCostUplift.ts'
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
                        <TableCell colSpan={kolomKaryawan.length}>
                          {adaSaringan ? 'Tidak ada karyawan yang cocok dengan pencarian atau saringan.' : 'Belum ada data karyawan.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rp.rows.map((row: any) => {
                        const e = karyawanById.get(row.id);
                        if (!e) return null;
                        const { key, ...sisaBaris } = rp.getRowProps({ row }) as { key?: string };
                        void key;
                        return (
                          <TableRow key={row.id} {...sisaBaris}>
                            {kolomKaryawan.map((h) => (
                              <TableCell key={h.key} data-label={h.header}>
                                {isiSelKaryawan(e, h.key)}
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
            totalItems={karyawanTersaring.length}
            onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
              setHalaman(page);
              setPerHalaman(pageSize);
            }}
            backwardText="Halaman sebelumnya"
            forwardText="Halaman berikutnya"
            itemsPerPageText="Baris per halaman"
            itemRangeText={(mulai: number, akhir: number, total: number) => `${mulai}–${akhir} dari ${total} karyawan`}
            pageRangeText={(_kini: number, total: number) => `dari ${total} halaman`}
            pageNumberText="Nomor halaman"
          />
        </>
      )}

      {canManage ? (
        // MODAL TRANSAKSIONAL: field-nya banyak, tapi keputusannya SATU — simpan karyawan.
        <ComposedModal
          open={isEmployeeModalOpen}
          size="md"
          onClose={() => {
            resetEmployeeForm();
            setIsEmployeeModalOpen(false);
            return true;
          }}
        >
          <ModalHeader
            label="Karyawan"
            title={editingEmployeeId ? `Ubah karyawan: ${employeeForm.name}` : 'Tambah karyawan baru'}
            closeModal={() => {
              resetEmployeeForm();
              setIsEmployeeModalOpen(false);
            }}
          />
          <ModalBody hasForm>
            <div className="hr-form">
              <PenandaLangkah
                langkah={LANGKAH_KARYAWAN}
                aktif={langkah}
                onPindah={setLangkah}
                className="hr-form__langkah"
              />

              {/* LANGKAH 1 — Identitas: Siapa dan di mana bekerja. */}
              {langkah === 0 ? (
                <div className="hr-form__bagian">
                <TextInput
                  id="hr-nama"
                  size="lg"
                  labelText="Nama"
                  className="hr-form__lebar-penuh"
                  value={employeeForm.name}
                  onChange={(event) => setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))}
                  invalid={employeeForm.name.trim() === ''}
                  invalidText="Nama tidak boleh kosong."
                />
                <TextInput
                  id="hr-kode"
                  size="lg"
                  labelText="Kode karyawan pabrik"
                  placeholder="mis. 2508001"
                  helperText="Kosongkan untuk pekerja lepas."
                  value={employeeForm.factory_employee_code}
                  onChange={(event) => setEmployeeForm((prev) => ({ ...prev, factory_employee_code: event.target.value }))}
                />
                <Dropdown
                  id="hr-status-kepegawaian"
                  size="lg"
                  titleText="Status kepegawaian"
                  label="Pilih status"
                  items={Object.keys(employmentStatusLabels)}
                  itemToString={(v: string) => employmentStatusLabels[v] ?? v}
                  selectedItem={employeeForm.employment_status || null}
                  onChange={({ selectedItem }: { selectedItem: string | null }) => setEmployeeForm((prev) => ({ ...prev, employment_status: selectedItem ?? '' }))}
                />
                <TextInput
                  id="hr-posisi"
                  size="lg"
                  labelText="Posisi"
                  placeholder="mis. Operator produksi"
                  value={employeeForm.position}
                  onChange={(event) => setEmployeeForm((prev) => ({ ...prev, position: event.target.value }))}
                />
                <Dropdown
                  id="hr-department"
                  size="lg"
                  titleText="Department"
                  label="Pilih department"
                  items={Object.keys(departmentLabels)}
                  itemToString={(v: string) => departmentLabels[v] ?? v}
                  selectedItem={employeeForm.department || null}
                  onChange={({ selectedItem }: { selectedItem: string | null }) => setEmployeeForm((prev) => ({ ...prev, department: selectedItem ?? '' }))}
                />
                <Dropdown
                  id="hr-plant"
                  size="lg"
                  titleText="Lokasi kerja"
                  label="Pilih lokasi"
                  items={plants}
                  itemToString={(p: Plant | null) => p?.name ?? ''}
                  selectedItem={plants.find((p) => String(p.production_plant_id) === employeeForm.production_plant_id) ?? null}
                  onChange={({ selectedItem }: { selectedItem: Plant | null }) =>
                    setEmployeeForm((prev) => ({ ...prev, production_plant_id: selectedItem ? String(selectedItem.production_plant_id) : '' }))
                  }
                />
                <Checkbox
                  id="hr-aktif"
                  className="hr-form__lebar-penuh"
                  labelText="Aktif — nonaktifkan di sini, bukan hapus, supaya riwayat absensi dan labor log tetap utuh"
                  checked={employeeForm.is_active}
                  onChange={(_e: unknown, { checked }: { checked: boolean }) => setEmployeeForm((prev) => ({ ...prev, is_active: checked }))}
                />
                </div>
              ) : null}

              {/* LANGKAH 2 — Gaji: Upah dan tunjangan harian. */}
              {langkah === 1 ? (
                <div className="hr-form__bagian">
                <Dropdown
                  id="hr-skema-gaji"
                  size="lg"
                  titleText="Skema gaji"
                  label="Pilih skema"
                  items={Object.keys(wageTypeLabels)}
                  itemToString={(v: string) => wageTypeLabels[v] ?? v}
                  selectedItem={employeeForm.wage_type}
                  onChange={({ selectedItem }: { selectedItem: string | null }) => setEmployeeForm((prev) => ({ ...prev, wage_type: selectedItem ?? 'monthly' }))}
                />
                <NumberInput
                  id="hr-gaji"
                  label="Nilai gaji (Rp)"
                  min={0}
                  allowEmpty
                  hideSteppers
                  value={employeeForm.wage_rate === '' ? '' : Number(employeeForm.wage_rate)}
                  onChange={(_e: unknown, { value }: { value: number | string }) => setEmployeeForm((prev) => ({ ...prev, wage_rate: String(value ?? '') }))}
                />
                <NumberInput
                  id="hr-makan"
                  label="Tunjangan makan / hari hadir (Rp)"
                  min={0}
                  allowEmpty
                  hideSteppers
                  value={employeeForm.daily_meal_allowance === '' ? '' : Number(employeeForm.daily_meal_allowance)}
                  onChange={(_e: unknown, { value }: { value: number | string }) => setEmployeeForm((prev) => ({ ...prev, daily_meal_allowance: String(value ?? '') }))}
                />
                <NumberInput
                  id="hr-transport"
                  label="Tunjangan transport / hari hadir (Rp)"
                  min={0}
                  allowEmpty
                  hideSteppers
                  value={employeeForm.daily_transport_allowance === '' ? '' : Number(employeeForm.daily_transport_allowance)}
                  onChange={(_e: unknown, { value }: { value: number | string }) => setEmployeeForm((prev) => ({ ...prev, daily_transport_allowance: String(value ?? '') }))}
                />
                </div>
              ) : null}

              {/* LANGKAH 3 — Pajak & BPJS: Potongan dan kepesertaan. */}
              {langkah === 2 ? (
                <div className="hr-form__bagian">
                <TextInput
                  id="hr-ptkp"
                  size="lg"
                  labelText="Status PTKP"
                  placeholder="mis. K/2, TK/0"
                  helperText="Kosongkan kalau belum tahu."
                  value={employeeForm.ptkp_status}
                  onChange={(event) => setEmployeeForm((prev) => ({ ...prev, ptkp_status: event.target.value }))}
                />
                <TextInput
                  id="hr-ter"
                  size="lg"
                  labelText="Golongan TER"
                  placeholder="mis. TER A"
                  value={employeeForm.ter_category}
                  onChange={(event) => setEmployeeForm((prev) => ({ ...prev, ter_category: event.target.value }))}
                />
                <NumberInput
                  id="hr-ter-persen"
                  label="Tarif TER (%)"
                  min={0}
                  allowEmpty
                  hideSteppers
                  value={employeeForm.ter_rate_percent === '' ? '' : Number(employeeForm.ter_rate_percent)}
                  onChange={(_e: unknown, { value }: { value: number | string }) => setEmployeeForm((prev) => ({ ...prev, ter_rate_percent: String(value ?? '') }))}
                />
                <Dropdown
                  id="hr-bpjs"
                  size="lg"
                  titleText="Kepesertaan BPJS Kesehatan"
                  label="Belum dikonfirmasi"
                  items={['true', 'false']}
                  itemToString={(v: string) => (v === 'true' ? 'Ikut BPJS Kesehatan' : 'Tidak ikut BPJS Kesehatan')}
                  selectedItem={employeeForm.bpjs_kesehatan_enrolled || null}
                  onChange={({ selectedItem }: { selectedItem: string | null }) => setEmployeeForm((prev) => ({ ...prev, bpjs_kesehatan_enrolled: selectedItem ?? '' }))}
                />
                </div>
              ) : null}

              {employeeFormMessage ? (
                <div className="hr-form__lebar-penuh">
                  <InlineNotification
                    kind={employeeFormStatus === 'success' ? 'success' : 'error'}
                    lowContrast
                    hideCloseButton
                    title={employeeFormStatus === 'success' ? 'Berhasil' : 'Gagal menyimpan'}
                    subtitle={employeeFormMessage}
                  />
                </div>
              ) : null}
            </div>
          </ModalBody>
          <FooterBertahap
            langkah={LANGKAH_KARYAWAN}
            aktif={langkah}
            onPindah={setLangkah}
            onBatal={() => {
              resetEmployeeForm();
              setIsEmployeeModalOpen(false);
            }}
            labelAksiAkhir={editingEmployeeId ? 'Simpan perubahan' : 'Tambah karyawan'}
            onSimpan={() => void handleEmployeeSubmit()}
            sedangMenyimpan={employeeFormStatus === 'pending'}
          />
        </ComposedModal>
      ) : null}

      {/* Ditempatkan SEKALI di kaki halaman; posisinya (kanan atas, di bawah header)
          diatur komponennya sendiri. */}
      <AreaNotifikasi daftar={notifikasi} onTutup={tutupNotifikasi} />
    </div>
  );
}

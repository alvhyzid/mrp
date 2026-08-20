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
import { canAccessHrDashboard, canManageHr } from '@/lib/roles';
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
  absent: 'Tidak Hadir',
  on_leave: 'Cuti',
  sick: 'Sakit'
};
const attendanceStatusBadgeVariant: Record<string, 'success' | 'warning' | 'critical' | 'secondary'> = {
  present: 'success',
  late: 'warning',
  absent: 'critical',
  on_leave: 'secondary',
  sick: 'warning'
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

  const handleEmployeeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

    setEmployeeFormStatus('success');
    setEmployeeFormMessage(editingEmployeeId ? 'Data karyawan berhasil diperbarui.' : 'Karyawan baru berhasil ditambahkan.');
    resetEmployeeForm();
    setIsEmployeeModalOpen(false);
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

  const employeeColumns = useMemo<ColumnDef<Employee>[]>(() => {
    const columns: ColumnDef<Employee>[] = [
      { accessorKey: 'name', header: 'Nama', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
      { id: 'code', header: 'Kode Karyawan', cell: ({ row }) => row.original.factory_employee_code ?? <span className="text-muted-foreground">-</span> },
      { accessorKey: 'position', header: 'Posisi' },
      {
        accessorKey: 'department',
        header: 'Department',
        cell: ({ row }) => (row.original.department ? <Badge variant="secondary">{departmentLabels[row.original.department] ?? row.original.department}</Badge> : <span className="text-muted-foreground">-</span>)
      },
      { id: 'plant', header: 'Lokasi', cell: ({ row }) => row.original.production_plant_name ?? <span className="text-muted-foreground">-</span> },
      {
        id: 'employment_status',
        header: 'Status Kepegawaian',
        cell: ({ row }) =>
          row.original.employment_status ? (
            <Badge variant="outline">{employmentStatusLabels[row.original.employment_status] ?? row.original.employment_status}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )
      }
    ];

    if (canSeeWages) {
      columns.push({
        id: 'wage',
        header: 'Upah',
        cell: ({ row }) =>
          row.original.wage_rate === null ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            <span className="text-data">
              {formatCurrency(row.original.wage_rate, { maxDecimals: 0 })} / {row.original.wage_type}
            </span>
          )
      });
      columns.push({
        id: 'employer_monthly_uplift',
        header: () => (
          <span className="flex items-center gap-1">
            Biaya Pemberi Kerja/Bulan
            <ProvenanceInfoButton
              label="Biaya Pemberi Kerja per Bulan"
              envelope={{
                formula:
                  'JKK + JKM + JHT (selalu dihitung) + BPJS Kesehatan (hanya kalau bpjs_kesehatan_enrolled=true eksplisit). Tiap komponen = basis iuran × rate tenant (company_settings). Basis iuran = bpjs_contribution_basis per orang kalau diisi, kalau tidak = clamp(gaji pokok, floor tenant, ceiling tenant). HANYA berlaku untuk karyawan wage_type=bulanan — PHL/harian tidak punya angka "per bulan" yang tetap.',
                inputs: [{ label: 'Rate & floor/ceiling', value: 'company_settings (bpjs_*_employer_rate_percent, bpjs_wage_basis_floor/ceiling)' }],
                sourceDocument: 'computeEmployerCostUplift.ts'
              }}
            />
          </span>
        ),
        cell: ({ row }) =>
          row.original.employer_monthly_uplift !== null ? (
            <span className="text-data" title={row.original.employer_monthly_uplift_note ?? undefined}>
              {formatCurrency(row.original.employer_monthly_uplift, { maxDecimals: 0 })}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground" title={row.original.employer_monthly_uplift_note ?? undefined}>
              {row.original.wage_type === 'monthly' ? '-' : 'N/A (non-bulanan)'}
            </span>
          )
      });
    }

    columns.push({
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'critical'}>{row.original.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
    });

    if (canManage) {
      columns.push({
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => startEditEmployee(row.original)}>
            Edit
          </Button>
        )
      });
    }

    return columns;
  }, [canSeeWages, canManage]);

  const attendanceColumns = useMemo<ColumnDef<AttendanceRow>[]>(
    () => [
      { accessorKey: 'employee_name', header: 'Nama' },
      {
        id: 'department',
        header: 'Department',
        cell: ({ row }) => (row.original.employee_department ? departmentLabels[row.original.employee_department] ?? row.original.employee_department : '-')
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <Badge variant={attendanceStatusBadgeVariant[row.original.status] ?? 'secondary'}>{attendanceStatusLabels[row.original.status] ?? row.original.status}</Badge>
      },
      { id: 'check_in', header: 'Jam Masuk', cell: ({ row }) => (row.original.check_in_at ? new Date(row.original.check_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-') },
      { id: 'check_out', header: 'Jam Pulang', cell: ({ row }) => (row.original.check_out_at ? new Date(row.original.check_out_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-') }
    ],
    []
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
              <CardTitle className="text-2xl">Dashboard HRD</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Halaman ini khusus company_admin, general_manager, hr_manager, atau hr_staff.</p>
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
      <div className="flex w-full flex-col gap-6 px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Dashboard Department</p>
          <h1 className="text-2xl font-semibold text-foreground">HRD</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex flex-col gap-1 pt-6">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Karyawan Aktif</span>
              <span className="text-3xl font-semibold text-foreground">{activeCount}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 pt-6">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Karyawan Nonaktif</span>
              <span className="text-3xl font-semibold text-foreground">{inactiveCount}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 pt-6">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Hadir Hari Ini ({attendanceDate})</span>
              <span className="text-3xl font-semibold text-foreground">{presentToday}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Absensi</CardDescription>
            <CardTitle className="text-xl">Absensi Hari Ini ({attendanceDate})</CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceError ? <p className="text-sm text-destructive">{attendanceError}</p> : null}
            {attendanceLoading ? (
              <p className="text-sm text-muted-foreground">Memuat absensi...</p>
            ) : (
              <DataTable columns={attendanceColumns} data={attendance} emptyMessage="Belum ada absensi tercatat hari ini." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Karyawan</CardDescription>
            <CardTitle className="text-xl">Daftar Karyawan</CardTitle>
          </CardHeader>
          <CardContent>
            {employeesError ? <p className="text-sm text-destructive">{employeesError}</p> : null}
            {employeesLoading ? (
              <p className="text-sm text-muted-foreground">Memuat karyawan...</p>
            ) : (
              <DataTable
                columns={employeeColumns}
                data={employees}
                emptyMessage="Belum ada data karyawan."
                searchPlaceholder="Cari nama atau posisi..."
                getSearchText={(e) => `${e.name} ${e.position ?? ''}`}
                paginated
                pageSize={15}
                primaryAction={canManage ? { label: 'Tambah Karyawan', onClick: () => { resetEmployeeForm(); setIsEmployeeModalOpen(true); } } : undefined}
              />
            )}
          </CardContent>
        </Card>

        {canManage ? (
          <Dialog
            open={isEmployeeModalOpen}
            onOpenChange={(open) => {
              if (!open) {
                resetEmployeeForm();
                setIsEmployeeModalOpen(false);
              }
            }}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingEmployeeId ? `Edit: ${employeeForm.name}` : 'Tambah karyawan baru'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEmployeeSubmit} className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-sm font-medium text-foreground">Nama</span>
                  <Input value={employeeForm.name} onChange={(event) => setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))} required />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Kode Karyawan Pabrik</span>
                  <Input
                    placeholder="mis. 2508001 (kosongkan utk Freelance)"
                    value={employeeForm.factory_employee_code}
                    onChange={(event) => setEmployeeForm((prev) => ({ ...prev, factory_employee_code: event.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Status Kepegawaian</span>
                  <Select value={employeeForm.employment_status || undefined} onValueChange={(value) => setEmployeeForm((prev) => ({ ...prev, employment_status: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(employmentStatusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Posisi</span>
                  <Input
                    placeholder="mis. Operator Produksi"
                    value={employeeForm.position}
                    onChange={(event) => setEmployeeForm((prev) => ({ ...prev, position: event.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Department</span>
                  <Select value={employeeForm.department || undefined} onValueChange={(value) => setEmployeeForm((prev) => ({ ...prev, department: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih department" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(departmentLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Plant</span>
                  <Select
                    value={employeeForm.production_plant_id || undefined}
                    onValueChange={(value) => setEmployeeForm((prev) => ({ ...prev, production_plant_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih plant" />
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

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Skema Gaji</span>
                  <Select value={employeeForm.wage_type} onValueChange={(value) => setEmployeeForm((prev) => ({ ...prev, wage_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(wageTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Nilai Gaji (Rp)</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={employeeForm.wage_rate}
                    onChange={(event) => setEmployeeForm((prev) => ({ ...prev, wage_rate: event.target.value }))}
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Status PTKP</span>
                  <Input
                    placeholder="mis. K/2, TK/0 (kosongkan kalau belum tahu)"
                    value={employeeForm.ptkp_status}
                    onChange={(event) => setEmployeeForm((prev) => ({ ...prev, ptkp_status: event.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Golongan TER</span>
                  <Input
                    placeholder="mis. TER A, TER B"
                    value={employeeForm.ter_category}
                    onChange={(event) => setEmployeeForm((prev) => ({ ...prev, ter_category: event.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Tarif TER (%)</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={employeeForm.ter_rate_percent}
                    onChange={(event) => setEmployeeForm((prev) => ({ ...prev, ter_rate_percent: event.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Tunjangan Makan / Hari Hadir (Rp)</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={employeeForm.daily_meal_allowance}
                    onChange={(event) => setEmployeeForm((prev) => ({ ...prev, daily_meal_allowance: event.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Tunjangan Transport / Hari Hadir (Rp)</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={employeeForm.daily_transport_allowance}
                    onChange={(event) => setEmployeeForm((prev) => ({ ...prev, daily_transport_allowance: event.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Kepesertaan BPJS Kesehatan</span>
                  <Select
                    value={employeeForm.bpjs_kesehatan_enrolled || undefined}
                    onValueChange={(value) => setEmployeeForm((prev) => ({ ...prev, bpjs_kesehatan_enrolled: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Belum dikonfirmasi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Ikut BPJS Kesehatan</SelectItem>
                      <SelectItem value="false">Tidak Ikut BPJS Kesehatan</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <label className="flex items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={employeeForm.is_active}
                    onChange={(event) => setEmployeeForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <span className="text-sm font-medium text-foreground">Aktif (nonaktifkan di sini, bukan hapus — riwayat labor log/absensi tetap utuh)</span>
                </label>

                <div className="flex items-center gap-3 sm:col-span-2">
                  <Button type="submit" disabled={employeeFormStatus === 'pending'}>
                    {employeeFormStatus === 'pending' ? 'Menyimpan...' : editingEmployeeId ? 'Simpan Perubahan' : 'Tambah Karyawan'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetEmployeeForm();
                      setIsEmployeeModalOpen(false);
                    }}
                  >
                    Batal
                  </Button>
                </div>

                {employeeFormMessage ? (
                  <p className={`sm:col-span-2 text-sm ${employeeFormStatus === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>
                    {employeeFormMessage}
                  </p>
                ) : null}
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </main>
  );
}

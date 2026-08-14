'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { canAccessHrDashboard } from '@/lib/roles';

const departmentLabels: Record<string, string> = {
  production: 'Produksi',
  ppic: 'PPIC',
  finance: 'Finance',
  purchasing: 'Purchasing',
  warehouse: 'Warehouse',
  hr: 'HRD',
  management: 'Manajemen'
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
  production_plant_name: string | null;
  department: string | null;
  name: string;
  position: string | null;
  wage_type: string | null;
  wage_rate: number | null;
  is_active: boolean;
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

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesError, setEmployeesError] = useState('');
  const [employeesLoading, setEmployeesLoading] = useState(true);

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
      setCheckingAccess(false);
      await Promise.all([loadEmployees(), loadAttendance()]);
    };
    checkAccessAndLoad();
  }, [router, loadEmployees, loadAttendance]);

  const activeCount = employees.filter((e) => e.is_active).length;
  const inactiveCount = employees.length - activeCount;
  const presentToday = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;

  const employeeColumns = useMemo<ColumnDef<Employee>[]>(() => {
    const columns: ColumnDef<Employee>[] = [
      { accessorKey: 'name', header: 'Nama', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
      { accessorKey: 'position', header: 'Posisi' },
      {
        accessorKey: 'department',
        header: 'Department',
        cell: ({ row }) => (row.original.department ? <Badge variant="secondary">{departmentLabels[row.original.department] ?? row.original.department}</Badge> : <span className="text-muted-foreground">-</span>)
      },
      { id: 'plant', header: 'Lokasi', cell: ({ row }) => row.original.production_plant_name ?? <span className="text-muted-foreground">-</span> }
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
              {row.original.wage_rate} / {row.original.wage_type}
            </span>
          )
      });
    }

    columns.push({
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'critical'}>{row.original.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
    });

    return columns;
  }, [canSeeWages]);

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
              <DataTable columns={employeeColumns} data={employees} emptyMessage="Belum ada data karyawan." />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

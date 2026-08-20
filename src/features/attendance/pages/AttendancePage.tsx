'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';

type AttendanceRow = {
  employee_attendance_id: number;
  employee_id: number;
  employee_name: string | null;
  employee_department: string | null;
  attendance_date?: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  work_minutes: number | null;
  late_minutes: number | null;
  overtime_minutes: number | null;
  geofence_status: string | null;
  flags: Record<string, unknown>;
};

type CorrectionRow = { attendance_correction_id: number; employee_name: string | null; attendance_date: string; requested_event_type: string; requested_occurred_at: string; reason: string };
type LeaveRow = { leave_request_id: number; employee_name: string | null; leave_type: string; start_date: string; end_date: string; reason: string | null };
type Employee = { employee_id: number; name: string; is_active: boolean };

const statusLabels: Record<string, string> = {
  HADIR: 'Hadir',
  TERLAMBAT: 'Terlambat',
  PULANG: 'Pulang',
  DI_LUAR_AREA: 'Di Luar Area (perlu ditinjau)',
  ALPA: 'Alpa',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  CUTI: 'Cuti',
  present: 'Hadir',
  late: 'Terlambat',
  absent: 'Tidak Hadir',
  on_leave: 'Cuti',
  sick: 'Sakit'
};
const statusBadgeVariant: Record<string, 'success' | 'warning' | 'secondary' | 'critical' | 'info'> = {
  HADIR: 'success',
  TERLAMBAT: 'warning',
  PULANG: 'success',
  DI_LUAR_AREA: 'critical',
  ALPA: 'critical',
  IZIN: 'secondary',
  SAKIT: 'warning',
  CUTI: 'secondary'
};

export default function AttendancePage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isHr, setIsHr] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [reviewQueue, setReviewQueue] = useState<AttendanceRow[]>([]);
  const [pendingCorrections, setPendingCorrections] = useState<CorrectionRow[]>([]);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState<LeaveRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState('');
  const [manualForm, setManualForm] = useState({ employeeId: '', eventType: 'IN', occurredAt: '' });
  const [savingManual, setSavingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadDashboard = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const response = await fetch(`/api/attendance?date=${date}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Gagal memuat data absensi.');
      return;
    }
    setAttendance(data.attendance || []);
    setReviewQueue(data.reviewQueue || []);
    setPendingCorrections(data.pendingCorrections || []);
    setPendingLeaveRequests(data.pendingLeaveRequests || []);
    setError('');
  }, [getAccessToken, date]);

  useEffect(() => {
    const init = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/attendance');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      const hr = meData?.user?.role === 'company_admin' || meData?.user?.role === 'hr_manager' || meData?.user?.role === 'hr_staff';
      setIsHr(hr);
      if (hr) {
        const empResponse = await fetch('/api/employees', { headers: { Authorization: `Bearer ${accessToken}` } });
        const empData = await empResponse.json();
        setEmployees((empData.employees || []).filter((e: Employee) => e.is_active));
      }
      setCheckingAccess(false);
      await loadDashboard();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!checkingAccess) loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const submitManual = async () => {
    if (!manualForm.employeeId) return;
    setSavingManual(true);
    setManualMessage('');
    const accessToken = await getAccessToken();
    const response = await fetch('/api/attendance/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: Number(manualForm.employeeId),
        eventType: manualForm.eventType,
        method: 'MANUAL_HRD',
        occurredAt: manualForm.occurredAt ? new Date(manualForm.occurredAt).toISOString() : undefined
      })
    });
    const data = await response.json();
    setSavingManual(false);
    if (!response.ok) {
      setManualMessage(data.error || 'Gagal mencatat kehadiran.');
      return;
    }
    setManualMessage('Kehadiran tercatat.');
    await loadDashboard();
  };

  const decideCorrection = async (id: number, approve: boolean) => {
    const accessToken = await getAccessToken();
    await fetch(`/api/attendance/corrections/${id}/decide`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approve })
    });
    await loadDashboard();
  };

  const decideLeave = async (id: number, approve: boolean) => {
    const accessToken = await getAccessToken();
    await fetch(`/api/attendance/leave-requests/${id}/decide`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approve })
    });
    await loadDashboard();
  };

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="px-6 text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="flex w-full flex-col gap-6 px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Absensi</p>
            <h1 className="text-2xl font-semibold text-foreground">Kehadiran Harian</h1>
          </div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {isHr ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">HRD</CardDescription>
              <CardTitle className="text-lg">Catat Kehadiran Manual</CardTitle>
              <p className="text-sm text-muted-foreground">
                Belum ada tablet gerbang/aplikasi HP karyawan (Gelombang 2/3 — belum dikerjakan). Untuk sekarang, HRD mencatat kehadiran manual di sini.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <Select value={manualForm.employeeId || undefined} onValueChange={(value) => setManualForm((prev) => ({ ...prev, employeeId: value }))}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Pilih karyawan" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.employee_id} value={String(e.employee_id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={manualForm.eventType} onValueChange={(value) => setManualForm((prev) => ({ ...prev, eventType: value }))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">Masuk</SelectItem>
                  <SelectItem value="OUT">Pulang</SelectItem>
                </SelectContent>
              </Select>
              <Input type="datetime-local" value={manualForm.occurredAt} onChange={(e) => setManualForm((prev) => ({ ...prev, occurredAt: e.target.value }))} className="w-56" />
              <Button onClick={submitManual} disabled={savingManual || !manualForm.employeeId}>
                Catat
              </Button>
              {manualMessage ? <span className="text-sm text-muted-foreground">{manualMessage}</span> : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Rekap</CardDescription>
            <CardTitle className="text-lg">Kehadiran Tanggal {date}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {attendance.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data kehadiran untuk tanggal ini.</p>
            ) : (
              attendance.map((row) => (
                <div key={row.employee_attendance_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{row.employee_name ?? `#${row.employee_id}`}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {row.check_in_at ? new Date(row.check_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} —{' '}
                      {row.check_out_at ? new Date(row.check_out_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      {row.work_minutes != null ? ` · ${Math.round(row.work_minutes)} menit kerja` : ''}
                      {row.late_minutes ? ` · terlambat ${row.late_minutes} menit` : ''}
                      {row.overtime_minutes ? ` · lembur ${row.overtime_minutes} menit` : ''}
                      <ProvenanceInfoButton
                        label="Jam Kerja/Terlambat/Lembur"
                        envelope={{
                          formula:
                            'Terlambat = jam masuk − jam mulai shift (Senin-Jumat/Sabtu dari Pengaturan Perusahaan) − toleransi keterlambatan. Jam kerja = (jam pulang − jam masuk) − menit istirahat (dari koreksi eksplisit kalau ada, kalau tidak dari jadwal istirahat standar). Lembur = jam kerja − standar jam shift. Dihitung ULANG dari event scan (IN/OUT), tidak pernah diedit manual.',
                          inputs: [
                            { label: 'Jam kerja', value: row.work_minutes != null ? `${Math.round(row.work_minutes)} menit` : '-' },
                            { label: 'Terlambat', value: row.late_minutes ? `${row.late_minutes} menit` : '0 menit' },
                            { label: 'Lembur', value: row.overtime_minutes ? `${row.overtime_minutes} menit` : '0 menit' }
                          ],
                          sourceDocument: 'recomputeAttendanceDay.ts'
                        }}
                      />
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant[row.status] ?? 'secondary'}>{statusLabels[row.status] ?? row.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {isHr ? (
          <>
            <Card>
              <CardHeader>
                <CardDescription className="uppercase tracking-[0.2em]">Perlu Ditinjau</CardDescription>
                <CardTitle className="text-lg">Antrean Review (Di Luar Area / Auto-Close)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {reviewQueue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada yang perlu ditinjau.</p>
                ) : (
                  reviewQueue.map((row) => (
                    <div key={row.employee_attendance_id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span>
                        {row.employee_name} — {row.attendance_date ?? ''}
                      </span>
                      <Badge variant="warning">{(row.flags as any)?.auto_closed ? 'Lupa clock-out (auto-close)' : 'Di luar area'}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription className="uppercase tracking-[0.2em]">Persetujuan</CardDescription>
                <CardTitle className="text-lg">Koreksi Absensi Menunggu</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {pendingCorrections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada koreksi menunggu persetujuan.</p>
                ) : (
                  pendingCorrections.map((row) => (
                    <div key={row.attendance_correction_id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span>
                        {row.employee_name} — {row.attendance_date} — {row.requested_event_type} pukul{' '}
                        {new Date(row.requested_occurred_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ({row.reason})
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => decideCorrection(row.attendance_correction_id, true)}>
                          Setujui
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => decideCorrection(row.attendance_correction_id, false)}>
                          Tolak
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription className="uppercase tracking-[0.2em]">Persetujuan</CardDescription>
                <CardTitle className="text-lg">Izin/Sakit/Cuti Menunggu</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {pendingLeaveRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada pengajuan menunggu persetujuan.</p>
                ) : (
                  pendingLeaveRequests.map((row) => (
                    <div key={row.leave_request_id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span>
                        {row.employee_name} — {row.leave_type} — {row.start_date} s/d {row.end_date}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => decideLeave(row.leave_request_id, true)}>
                          Setujui
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => decideLeave(row.leave_request_id, false)}>
                          Tolak
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </main>
  );
}

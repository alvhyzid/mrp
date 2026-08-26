'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Button, Dropdown, InlineNotification, SkeletonText, Tag, TextInput, Tile } from '@carbon/react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { formatNumberId } from '@/lib/currency';
import { ATTENDANCE_EVENT_TYPE_LABELS } from '@/lib/glossary';

const leaveTypeLabels: Record<string, string> = { IZIN: 'Izin', SAKIT: 'Sakit', CUTI: 'Cuti' };

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
// Warna Tag mengikuti ARTI, bukan selera: hijau = hadir sesuai aturan, magenta = perlu
// diperiksa manusia, merah = tidak hadir tanpa keterangan, biru = tidak hadir DENGAN
// keterangan yang sah. Membedakan dua yang terakhir penting -- keduanya "tidak masuk", dan
// hanya satu yang jadi masalah.
const tagStatusAbsensi: Record<string, 'green' | 'magenta' | 'red' | 'blue' | 'gray'> = {
  HADIR: 'green',
  PULANG: 'green',
  TERLAMBAT: 'magenta',
  DI_LUAR_AREA: 'magenta',
  ALPA: 'red',
  IZIN: 'blue',
  SAKIT: 'blue',
  CUTI: 'blue'
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
      <div className="halaman">
        <SkeletonText heading width="16rem" />
        <SkeletonText paragraph lineCount={4} />
      </div>
    );
  }

  const jam = (nilai: string | null) =>
    nilai ? new Date(nilai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "People" },
          { label: "Attendance" }
        ]}
        judul="Kehadiran harian"
        pengantar={
          <>
            {attendance.length === 0 ? 'Belum ada data kehadiran' : `${attendance.length} karyawan tercatat`} untuk tanggal{' '}
          {date}. Jam kerja, keterlambatan, dan lembur dihitung ULANG dari catatan masuk-pulang — tidak pernah diketik.
          </>
        }
      />

      <TextInput
        id="absensi-tanggal"
        type="date"
        size="lg"
        labelText="Tanggal"
        className="halaman__saring"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {error ? <InlineNotification kind="error" lowContrast title="Gagal memuat" subtitle={error} hideCloseButton /> : null}

      {isHr ? (
        <Tile className="absensi-kartu">
          <h2 className="halaman__subjudul">Catat kehadiran manual</h2>
          <p className="halaman__redup">
            Belum ada tablet gerbang atau aplikasi HP karyawan (Gelombang 2 dan 3, belum dikerjakan).
            Untuk sekarang HRD mencatat kehadiran manual di sini.
          </p>
          <div className="absensi-form">
            <Dropdown
              id="absensi-karyawan"
              size="lg"
              titleText="Karyawan"
              label="Pilih karyawan"
              items={employees.map((e) => String(e.employee_id))}
              selectedItem={manualForm.employeeId || null}
              itemToString={(item: string) => employees.find((e) => String(e.employee_id) === item)?.name ?? item}
              onChange={({ selectedItem }: { selectedItem: string | null }) =>
                setManualForm((prev) => ({ ...prev, employeeId: selectedItem ?? '' }))
              }
            />
            <Dropdown
              id="absensi-jenis"
              size="lg"
              titleText="Jenis"
              label="Pilih jenis"
              items={['IN', 'OUT']}
              selectedItem={manualForm.eventType}
              itemToString={(item: string) => (item === 'IN' ? 'Masuk' : 'Pulang')}
              onChange={({ selectedItem }: { selectedItem: string | null }) =>
                selectedItem && setManualForm((prev) => ({ ...prev, eventType: selectedItem }))
              }
            />
            <TextInput
              id="absensi-waktu"
              type="datetime-local"
              size="lg"
              labelText="Waktu"
              value={manualForm.occurredAt}
              onChange={(e) => setManualForm((prev) => ({ ...prev, occurredAt: e.target.value }))}
            />
            <Button className="absensi-form__tombol" onClick={submitManual} disabled={savingManual || !manualForm.employeeId}>
              {savingManual ? 'Menyimpan…' : 'Catat'}
            </Button>
          </div>
          {manualMessage ? <p className="halaman__redup">{manualMessage}</p> : null}
        </Tile>
      ) : null}

      <Tile className="absensi-kartu">
        <h2 className="halaman__subjudul">Kehadiran tanggal {date}</h2>
        {attendance.length === 0 ? (
          <p className="halaman__redup">Belum ada data kehadiran untuk tanggal ini.</p>
        ) : (
          <div className="absensi-daftar">
            {attendance.map((row) => (
              <div key={row.employee_attendance_id} className="absensi-baris">
                <div>
                  <p className="absensi-baris__nama">{row.employee_name ?? `#${row.employee_id}`}</p>
                  <p className="absensi-baris__rincian">
                    {jam(row.check_in_at)} — {jam(row.check_out_at)}
                    {row.work_minutes != null ? ` · ${Math.round(row.work_minutes)} menit kerja` : ''}
                    {row.late_minutes ? ` · terlambat ${formatNumberId(row.late_minutes, 0)} menit` : ''}
                    {row.overtime_minutes ? ` · lembur ${formatNumberId(row.overtime_minutes, 0)} menit` : ''}
                    <ProvenanceInfoButton
                      label="Jam Kerja/Terlambat/Lembur"
                      envelope={{
                        formula:
                          'Terlambat = jam masuk − jam mulai shift (Senin-Jumat/Sabtu dari Pengaturan Perusahaan) − toleransi keterlambatan. Jam kerja = (jam pulang − jam masuk) − menit istirahat (dari koreksi eksplisit kalau ada, kalau tidak dari jadwal istirahat standar). Lembur = jam kerja − standar jam shift. Dihitung ULANG dari event scan (IN/OUT), tidak pernah diedit manual.',
                        inputs: [
                          { label: 'Jam kerja', value: row.work_minutes != null ? `${Math.round(row.work_minutes)} menit` : '-' },
                          { label: 'Terlambat', value: row.late_minutes ? `${formatNumberId(row.late_minutes, 0)} menit` : '0 menit' },
                          { label: 'Lembur', value: row.overtime_minutes ? `${formatNumberId(row.overtime_minutes, 0)} menit` : '0 menit' }
                        ],
                        sourceDocument: 'recomputeAttendanceDay.ts'
                      }}
                    />
                  </p>
                </div>
                <Tag type={tagStatusAbsensi[row.status] ?? 'gray'}>{statusLabels[row.status] ?? row.status}</Tag>
              </div>
            ))}
          </div>
        )}
      </Tile>

      {isHr ? (
        <>
          <Tile className="absensi-kartu">
            <h2 className="halaman__subjudul">Perlu ditinjau — di luar area atau lupa pulang</h2>
            {reviewQueue.length === 0 ? (
              <p className="halaman__redup">Tidak ada yang perlu ditinjau.</p>
            ) : (
              <div className="absensi-daftar">
                {reviewQueue.map((row) => (
                  <div key={row.employee_attendance_id} className="absensi-baris">
                    <span>
                      {row.employee_name} — {row.attendance_date ?? ''}
                    </span>
                    <Tag type="magenta">
                      {(row.flags as { auto_closed?: boolean } | null)?.auto_closed ? 'Lupa mencatat pulang (ditutup otomatis)' : 'Di luar area'}
                    </Tag>
                  </div>
                ))}
              </div>
            )}
          </Tile>

          <Tile className="absensi-kartu">
            <h2 className="halaman__subjudul">Koreksi absensi menunggu keputusan</h2>
            {pendingCorrections.length === 0 ? (
              <p className="halaman__redup">Tidak ada koreksi menunggu persetujuan.</p>
            ) : (
              <div className="absensi-daftar">
                {pendingCorrections.map((row) => (
                  <div key={row.attendance_correction_id} className="absensi-baris">
                    <span>
                      {row.employee_name} — {row.attendance_date} —{' '}
                      {ATTENDANCE_EVENT_TYPE_LABELS[row.requested_event_type] ?? row.requested_event_type} pukul{' '}
                      {jam(row.requested_occurred_at)} ({row.reason})
                    </span>
                    <div className="absensi-putusan">
                      <Button size="sm" kind="tertiary" onClick={() => decideCorrection(row.attendance_correction_id, true)}>
                        Setujui
                      </Button>
                      <Button size="sm" kind="danger--tertiary" onClick={() => decideCorrection(row.attendance_correction_id, false)}>
                        Tolak
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tile>

          <Tile className="absensi-kartu">
            <h2 className="halaman__subjudul">Izin, sakit, dan cuti menunggu keputusan</h2>
            {pendingLeaveRequests.length === 0 ? (
              <p className="halaman__redup">Tidak ada pengajuan menunggu persetujuan.</p>
            ) : (
              <div className="absensi-daftar">
                {pendingLeaveRequests.map((row) => (
                  <div key={row.leave_request_id} className="absensi-baris">
                    <span>
                      {row.employee_name} — {leaveTypeLabels[row.leave_type] ?? row.leave_type} — {row.start_date} s/d {row.end_date}
                    </span>
                    <div className="absensi-putusan">
                      <Button size="sm" kind="tertiary" onClick={() => decideLeave(row.leave_request_id, true)}>
                        Setujui
                      </Button>
                      <Button size="sm" kind="danger--tertiary" onClick={() => decideLeave(row.leave_request_id, false)}>
                        Tolak
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tile>
        </>
      ) : null}
    </div>
  );
}

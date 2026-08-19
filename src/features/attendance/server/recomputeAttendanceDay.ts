import type { SupabaseClient } from '@supabase/supabase-js';
import { getAttendanceCalendarConfig } from './attendanceCalendarConfig';

interface AttendanceEventRow {
  attendance_event_id: number;
  production_plant_id: number | null;
  event_type: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';
  occurred_at: string;
  geofence_status: 'DALAM' | 'LUAR' | 'TANPA_GPS';
  flags: Record<string, unknown>;
}

function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Sama seperti seluruh proyek ini (tidak ada konversi zona waktu di mana pun),
// tanggal kalender diambil langsung dari komponen UTC timestamptz -- BUKAN
// disesuaikan ke WIB. Konsisten dgn cara work_date/changed_at dipakai di
// modul lain.
function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}
function minutesOfDayUtc(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
function isSaturday(dateOnly: string): boolean {
  return new Date(`${dateOnly}T00:00:00Z`).getUTCDay() === 6;
}
function isSunday(dateOnly: string): boolean {
  return new Date(`${dateOnly}T00:00:00Z`).getUTCDay() === 0;
}

// Menghitung ULANG rekap harian (employee_attendance) dari attendance_events
// -- SATU-SATUNYA cara employee_attendance boleh berubah (docs §6: "rekap
// harian adalah agregat", tidak diedit manual field-per-field). Dipanggil
// setiap kali ada event baru (termasuk event hasil koreksi disetujui).
export async function recomputeAttendanceDay(adminClient: SupabaseClient, companyId: number, employeeId: number, dateOnly: string): Promise<void> {
  const { data: leave } = await adminClient
    .from('leave_requests')
    .select('leave_type')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .eq('status', 'APPROVED')
    .lte('start_date', dateOnly)
    .gte('end_date', dateOnly)
    .maybeSingle();

  if (leave) {
    await adminClient.from('employee_attendance').upsert(
      [
        {
          company_id: companyId,
          employee_id: employeeId,
          attendance_date: dateOnly,
          status: leave.leave_type,
          check_in_at: null,
          check_out_at: null,
          work_minutes: null,
          late_minutes: null,
          overtime_minutes: null,
          source_event_ids: [],
          geofence_status: null,
          flags: {}
        }
      ],
      { onConflict: 'employee_id,attendance_date' }
    );
    return;
  }

  const { data: events, error } = await adminClient
    .from('attendance_events')
    .select('attendance_event_id, production_plant_id, event_type, occurred_at, geofence_status, flags')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .gte('occurred_at', `${dateOnly}T00:00:00Z`)
    .lt('occurred_at', `${dateOnly}T23:59:59.999Z`)
    .order('occurred_at', { ascending: true });
  if (error) throw new Error(error.message);

  const today = new Date().toISOString().slice(0, 10);
  const isPastDate = dateOnly < today;

  if (!events || events.length === 0) {
    if (isSunday(dateOnly)) return; // hari libur mingguan default -- tidak ada baris (§4.6 versi minimal, belum ada kalender libur nasional)
    if (!isPastDate) return; // hari ini belum berakhir -- BELUM_HADIR, bukan ALPA, tidak perlu baris dulu
    await adminClient.from('employee_attendance').upsert(
      [
        {
          company_id: companyId,
          employee_id: employeeId,
          attendance_date: dateOnly,
          status: 'ALPA',
          check_in_at: null,
          check_out_at: null,
          work_minutes: null,
          late_minutes: null,
          overtime_minutes: null,
          source_event_ids: [],
          geofence_status: null,
          flags: {}
        }
      ],
      { onConflict: 'employee_id,attendance_date' }
    );
    return;
  }

  const typed = events as AttendanceEventRow[];
  const config = await getAttendanceCalendarConfig(adminClient, companyId);
  const saturday = isSaturday(dateOnly);

  const firstIn = typed.find((e) => e.event_type === 'IN');
  const outsEvents = typed.filter((e) => e.event_type === 'OUT');
  const lastOut = outsEvents.length > 0 ? outsEvents[outsEvents.length - 1] : undefined;
  const anyOutOfArea = typed.some((e) => e.geofence_status === 'LUAR');
  const anyAutoClosed = typed.some((e) => (e.flags as any)?.auto_closed === true);

  let workMinutes: number | null = null;
  let lateMinutes: number | null = null;
  let overtimeMinutes: number | null = null;

  if (firstIn) {
    const shiftStart = timeStringToMinutes(saturday ? config.saturdayStartTime : config.weekdayStartTime);
    const inMinutes = minutesOfDayUtc(firstIn.occurred_at);
    lateMinutes = Math.max(0, inMinutes - shiftStart - config.lateToleranceMinutes);
  }

  if (firstIn && lastOut) {
    const rawMinutes = Math.round((new Date(lastOut.occurred_at).getTime() - new Date(firstIn.occurred_at).getTime()) / 60000);
    const explicitBreakPairs = pairBreaks(typed);
    const breakMinutes = explicitBreakPairs > 0 ? explicitBreakPairs : saturday ? 0 : timeStringToMinutes(config.breakEndTime) - timeStringToMinutes(config.breakStartTime);
    workMinutes = Math.max(0, rawMinutes - breakMinutes);
    const standardShiftMinutes = saturday ? config.saturdayShiftMinutes : config.weekdayShiftMinutes;
    overtimeMinutes = Math.max(0, workMinutes - standardShiftMinutes);
  }

  let status: string;
  if (anyOutOfArea) status = 'DI_LUAR_AREA';
  else if (!lastOut) status = 'HADIR';
  else if (lateMinutes && lateMinutes > 0) status = 'TERLAMBAT';
  else status = 'PULANG';

  await adminClient.from('employee_attendance').upsert(
    [
      {
        company_id: companyId,
        employee_id: employeeId,
        production_plant_id: firstIn?.production_plant_id ?? null,
        attendance_date: dateOnly,
        status,
        check_in_at: firstIn?.occurred_at ?? null,
        check_out_at: lastOut?.occurred_at ?? null,
        work_minutes: workMinutes,
        late_minutes: lateMinutes,
        overtime_minutes: overtimeMinutes,
        source_event_ids: typed.map((e) => e.attendance_event_id),
        geofence_status: anyOutOfArea ? 'LUAR' : firstIn?.geofence_status ?? null,
        flags: anyAutoClosed ? { auto_closed: true } : {}
      }
    ],
    { onConflict: 'employee_id,attendance_date' }
  );
}

// Kalau ADA pasangan BREAK_START/BREAK_END nyata (tablet/PWA mencatatnya di
// W2/W3), pakai durasi NYATA itu -- bukan asumsi jam istirahat default.
function pairBreaks(events: AttendanceEventRow[]): number {
  let total = 0;
  let openStart: string | null = null;
  for (const e of events) {
    if (e.event_type === 'BREAK_START') openStart = e.occurred_at;
    if (e.event_type === 'BREAK_END' && openStart) {
      total += Math.round((new Date(e.occurred_at).getTime() - new Date(openStart).getTime()) / 60000);
      openStart = null;
    }
  }
  return total;
}

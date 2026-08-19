import type { SupabaseClient } from '@supabase/supabase-js';
import { getAttendanceCalendarConfig } from './attendanceCalendarConfig';
import { recomputeAttendanceDay } from './recomputeAttendanceDay';

function minutesToTimeString(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isSaturday(dateOnly: string): boolean {
  return new Date(`${dateOnly}T00:00:00Z`).getUTCDay() === 6;
}

// "Lupa clock-out -> auto-close di akhir hari + flag review" (docs §3, kriteria
// selesai W1). Belum ada cron di proyek ini (lihat catatan pola sama Bagian F)
// -- dipanggil dari getAttendanceDashboard() setiap dashboard dibuka (murah,
// hanya baris HADIR tanpa jam keluar di masa lalu).
export async function closeStaleOpenAttendanceDays(adminClient: SupabaseClient, companyId: number): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: openDays, error } = await adminClient
    .from('employee_attendance')
    .select('employee_id, attendance_date')
    .eq('company_id', companyId)
    .eq('status', 'HADIR')
    .lt('attendance_date', today);
  if (error) throw new Error(error.message);
  if (!openDays || openDays.length === 0) return 0;

  const config = await getAttendanceCalendarConfig(adminClient, companyId);

  for (const day of openDays) {
    const saturday = isSaturday(day.attendance_date);
    const startMinutes = timeStringToMinutes(saturday ? config.saturdayStartTime : config.weekdayStartTime);
    const breakMinutes = saturday ? 0 : timeStringToMinutes(config.breakEndTime) - timeStringToMinutes(config.breakStartTime);
    const shiftMinutes = saturday ? config.saturdayShiftMinutes : config.weekdayShiftMinutes;
    const endTimeString = minutesToTimeString(startMinutes + breakMinutes + shiftMinutes);

    await adminClient.from('attendance_events').insert([
      {
        company_id: companyId,
        employee_id: day.employee_id,
        event_type: 'OUT',
        occurred_at: `${day.attendance_date}T${endTimeString}:00Z`,
        method: 'MANUAL_HRD',
        geofence_status: 'TANPA_GPS',
        flags: { auto_closed: true },
        recorded_by: null
      }
    ]);
    await recomputeAttendanceDay(adminClient, companyId, day.employee_id, day.attendance_date);
  }

  return openDays.length;
}

function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

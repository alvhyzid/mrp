import type { SupabaseClient } from '@supabase/supabase-js';

export interface AttendanceCalendarConfig {
  weekdayStartTime: string; // 'HH:MM', Sen-Jum
  saturdayStartTime: string; // 'HH:MM'
  breakStartTime: string; // 'HH:MM', HANYA Sen-Jum (§4.6, Sabtu tanpa istirahat)
  breakEndTime: string;
  weekdayShiftMinutes: number; // dari company_settings work_calendar_weekday_hours (SUDAH ADA, Bagian D/E)
  saturdayShiftMinutes: number; // dari company_settings work_calendar_saturday_hours (SUDAH ADA)
  lateToleranceMinutes: number; // Q4 BELUM dijawab pemilik produk -- default 15, PERLU KONFIRMASI HRD
}

const KEYS = [
  'work_calendar_weekday_hours',
  'work_calendar_saturday_hours',
  'attendance_weekday_start_time',
  'attendance_saturday_start_time',
  'attendance_break_start_time',
  'attendance_break_end_time',
  'attendance_late_tolerance_minutes'
];

// Jadwal acuan = kalender kerja yang SUDAH ADA (docs §4.1: "jangan membuat
// master jam kerja kedua") -- work_calendar_weekday_hours/saturday_hours
// dipakai ULANG dari Bagian D/E (compute_production_batch_labor_cost), TIDAK
// diciptakan lagi di sini. Kunci attendance_* di bawah ini BARU (jam mulai
// shift & istirahat belum pernah disimpan sebagai konfigurasi sebelumnya).
export async function getAttendanceCalendarConfig(adminClient: SupabaseClient, companyId: number): Promise<AttendanceCalendarConfig> {
  const { data } = await adminClient.from('company_settings').select('setting_key, setting_value').eq('company_id', companyId).in('setting_key', KEYS);
  const map = new Map((data ?? []).map((row) => [row.setting_key, row.setting_value]));

  const numeric = (key: string, fallback: number): number => {
    const raw = map.get(key);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const text = (key: string, fallback: string): string => map.get(key) || fallback;

  return {
    weekdayStartTime: text('attendance_weekday_start_time', '08:00'),
    saturdayStartTime: text('attendance_saturday_start_time', '08:00'),
    breakStartTime: text('attendance_break_start_time', '12:00'),
    breakEndTime: text('attendance_break_end_time', '13:00'),
    weekdayShiftMinutes: numeric('work_calendar_weekday_hours', 7) * 60,
    saturdayShiftMinutes: numeric('work_calendar_saturday_hours', 5) * 60,
    lateToleranceMinutes: numeric('attendance_late_tolerance_minutes', 15)
  };
}

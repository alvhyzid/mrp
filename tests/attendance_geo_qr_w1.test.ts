import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { recordAttendanceEvent } from '../src/features/attendance/server/recordAttendanceEvent';
import { getAttendanceDashboard } from '../src/features/attendance/server/getAttendanceDashboard';
import { requestAttendanceCorrection, decideAttendanceCorrection } from '../src/features/attendance/server/attendanceCorrections';
import { createLeaveRequest, decideLeaveRequest } from '../src/features/attendance/server/leaveRequests';
import { closeStaleOpenAttendanceDays } from '../src/features/attendance/server/closeStaleOpenAttendanceDays';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// Absensi Geo-QR — GELOMBANG 1 (docs/rancangan-absensi-geo-qr.md). PRINSIP
// UTAMA yang diuji sesuai §8 kriteria selesai: (1) client_event_id sama 2x ->
// idempoten, satu event; (2) scan di luar geofence -> DI_LUAR_AREA, masuk
// antrean review, bukan hilang; (3) karyawan tidak bisa lihat riwayat
// karyawan lain; (4) koreksi TIDAK mengubah event asli (ledger append-only,
// diuji lewat trigger DB); (5) lupa clock-out -> auto-close + flag + antrean.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeRequest(url: string, token: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

describe('Absensi Geo-QR — Gelombang 1 (skema, RLS, state machine, geofence, ledger, rekap)', () => {
  let companyId: number;
  let plantId: number;
  let hrToken: string;
  let staffAToken: string;
  let staffBToken: string;
  let employeeAId: number;
  let employeeBId: number;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient
      .from('companies')
      .insert([{ name: 'AttendanceW1TestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant Uji', center_lat: -7.9, center_lng: 112.6, geofence_radius_meters: 150 }])
      .select('production_plant_id')
      .single();
    plantId = plant!.production_plant_id;

    for (const [email, role, fullName] of [
      ['hr.attendancew1test@debug.mrp', 'hr_manager', 'HR AttendanceW1Test'],
      ['staffa.attendancew1test@debug.mrp', 'production_staff', 'Staff A AttendanceW1Test'],
      ['staffb.attendancew1test@debug.mrp', 'production_staff', 'Staff B AttendanceW1Test']
    ] as const) {
      // AUD-21 (25 Agu 2026): pembuatan pengguna auth SELALU lewat ensureAuthUser.
      // Bentuk hasilnya sengaja dipertahankan supaya kode di bawahnya tidak ikut berubah;
      // `error` selalu null karena ensureAuthUser sudah menangani "sudah terdaftar" sendiri.
      const { data: authUser, error: authUserError } = {
        data: { user: { id: await ensureAuthUser(adminClient, email, roleTestPassword, { full_name: fullName }) } },
        error: null as { message: string } | null
      };
      let authUid: string;
      if (authUserError && !authUserError.message.includes('already been registered')) throw new Error(authUserError.message);
      if (authUser?.user) {
        authUid = authUser.user.id;
      } else {
        const { data } = await adminClient.auth.admin.listUsers({ perPage: 100, page: 1 });
        authUid = data!.users.find((u: any) => u.email === email)!.id;
      }
      await adminClient.from('users').upsert([{ auth_uid: authUid, company_id: companyId, name: fullName, email, role, status: 'active' }], { onConflict: 'auth_uid' });
    }
    hrToken = await loginToken('hr.attendancew1test@debug.mrp');
    staffAToken = await loginToken('staffa.attendancew1test@debug.mrp');
    staffBToken = await loginToken('staffb.attendancew1test@debug.mrp');

    const { data: userA } = await adminClient.from('users').select('user_id').eq('email', 'staffa.attendancew1test@debug.mrp').single();
    const { data: userB } = await adminClient.from('users').select('user_id').eq('email', 'staffb.attendancew1test@debug.mrp').single();

    const { data: empA } = await adminClient
      .from('employees')
      .insert([{ company_id: companyId, production_plant_id: plantId, name: 'Staff A', wage_type: 'monthly', wage_rate: 4000000, linked_user_id: userA!.user_id }])
      .select('employee_id')
      .single();
    employeeAId = empA!.employee_id;
    const { data: empB } = await adminClient
      .from('employees')
      .insert([{ company_id: companyId, production_plant_id: plantId, name: 'Staff B', wage_type: 'monthly', wage_rate: 4000000, linked_user_id: userB!.user_id }])
      .select('employee_id')
      .single();
    employeeBId = empB!.employee_id;
  });

  afterAll(async () => {
    const { data: users } = await adminClient.from('users').select('auth_uid').eq('company_id', companyId);
    // Append-only murni disiplin aplikasi (bukan trigger keras, lihat catatan
    // migration 20260823100000) -- service role tetap bisa membersihkan data test.
    const cleanupSteps: Array<[string, () => any]> = [
      ['attendance_corrections', () => adminClient.from('attendance_corrections').delete().eq('company_id', companyId)],
      ['leave_requests', () => adminClient.from('leave_requests').delete().eq('company_id', companyId)],
      ['attendance_devices', () => adminClient.from('attendance_devices').delete().eq('company_id', companyId)],
      ['attendance_events', () => adminClient.from('attendance_events').delete().eq('company_id', companyId)],
      ['employee_attendance', () => adminClient.from('employee_attendance').delete().eq('company_id', companyId)],
      ['employees', () => adminClient.from('employees').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ...(users ?? []).map((u): [string, () => any] => [`auth:${u.auth_uid}`, () => adminClient.auth.admin.deleteUser(u.auth_uid)]),
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('scan DALAM geofence -> tercatat DALAM, status HADIR setelah clock-in', async () => {
    // Sengaja pakai tanggal HARI INI (bukan tanggal tetap di masa lalu) --
    // closeStaleOpenAttendanceDays() (dipanggil tiap getAttendanceDashboard())
    // auto-close SETIAP hari HADIR yang terbuka di MASA LALU (perilaku yang
    // benar, diuji terpisah di test "lupa clock-out"), jadi kalau tanggal ini
    // di masa lalu, baris ini akan langsung ter-auto-close jadi PULANG.
    const today = new Date().toISOString().slice(0, 10);
    const req = makeRequest('http://localhost/api/attendance/events', hrToken, 'POST');
    const result = await recordAttendanceEvent(req, {
      employeeId: employeeAId,
      productionPlantId: plantId,
      eventType: 'IN',
      occurredAt: `${today}T01:00:00Z`,
      method: 'MANUAL_HRD',
      lat: -7.9001,
      lng: 112.6001
    });
    expect(result.status).toBe(200);
    const body = result.body as any;
    expect(body.event.geofence_status).toBe('DALAM');

    const dashReq = makeRequest(`http://localhost/api/attendance?date=${today}`, hrToken, 'GET');
    const dashResult = await getAttendanceDashboard(dashReq, today);
    const row = (dashResult.body as any).attendance.find((a: any) => a.employee_id === employeeAId);
    expect(row.status).toBe('HADIR');
  });

  it('(NEGATIF, BUKTI §8) scan DI LUAR geofence -> DI_LUAR_AREA, masuk antrean review, BUKAN hilang', async () => {
    const req = makeRequest('http://localhost/api/attendance/events', hrToken, 'POST');
    const result = await recordAttendanceEvent(req, {
      employeeId: employeeBId,
      productionPlantId: plantId,
      eventType: 'IN',
      occurredAt: '2026-08-10T01:00:00Z',
      method: 'MANUAL_HRD',
      lat: -8.5, // jauh dari pusat geofence (-7.9)
      lng: 113.5
    });
    expect(result.status).toBe(200);
    expect((result.body as any).event.geofence_status).toBe('LUAR');

    const dashReq = makeRequest('http://localhost/api/attendance?date=2026-08-10', hrToken, 'GET');
    const dashResult = await getAttendanceDashboard(dashReq, '2026-08-10');
    const body = dashResult.body as any;
    const row = body.attendance.find((a: any) => a.employee_id === employeeBId);
    expect(row.status).toBe('DI_LUAR_AREA');
    expect(body.reviewQueue.some((r: any) => r.employee_id === employeeBId)).toBe(true);
  });

  it('(BUKTI §8) client_event_id sama dikirim 2x -> idempoten, SATU event tersimpan', async () => {
    const clientEventId = 'test-idempotent-clock-in-001';
    const send = () =>
      recordAttendanceEvent(
        makeRequest('http://localhost/api/attendance/events', hrToken, 'POST'),
        { employeeId: employeeAId, productionPlantId: plantId, eventType: 'BREAK_START', occurredAt: '2026-08-10T05:00:00Z', method: 'MANUAL_HRD', clientEventId }
      );
    const first = await send();
    const second = await send();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((second.body as any).idempotentReplay).toBe(true);

    const { count } = await adminClient.from('attendance_events').select('attendance_event_id', { count: 'exact', head: true }).eq('company_id', companyId).eq('client_event_id', clientEventId);
    expect(count).toBe(1);
  });

  it('(NEGATIF, BUKTI §8) karyawan A TIDAK BISA melihat riwayat karyawan B', async () => {
    const req = makeRequest('http://localhost/api/attendance?date=2026-08-10', staffAToken, 'GET');
    const result = await getAttendanceDashboard(req, '2026-08-10');
    const body = result.body as any;
    expect(body.attendance.every((a: any) => a.employee_id === employeeAId)).toBe(true);
    expect(body.reviewQueue).toBeUndefined(); // hanya HR yang dapat antrean review
  });

  it('(NEGATIF) karyawan mencoba mencatat kehadiran atas nama karyawan lain -> ditolak', async () => {
    const req = makeRequest('http://localhost/api/attendance/events', staffAToken, 'POST');
    const result = await recordAttendanceEvent(req, { employeeId: employeeBId, productionPlantId: plantId, eventType: 'IN', method: 'GEO_PHONE', occurredAt: new Date().toISOString() });
    expect(result.status).toBe(403);
  });

  it('(NEGATIF) staf non-HR mencoba mencatat kehadiran manual (MANUAL_HRD) -> ditolak', async () => {
    const req = makeRequest('http://localhost/api/attendance/events', staffAToken, 'POST');
    const result = await recordAttendanceEvent(req, { employeeId: employeeAId, productionPlantId: plantId, eventType: 'OUT', method: 'MANUAL_HRD', occurredAt: new Date().toISOString() });
    expect(result.status).toBe(403);
  });

  it('(BUKTI §8) koreksi disetujui -> MENAMBAH event baru (bukan mengubah event asli), rekap terhitung ulang', async () => {
    const { data: beforeEvents } = await adminClient.from('attendance_events').select('attendance_event_id').eq('company_id', companyId).eq('employee_id', employeeAId);
    const beforeCount = beforeEvents!.length;

    const reqCreate = makeRequest('http://localhost/api/attendance/corrections', staffAToken, 'POST');
    const createResult = await requestAttendanceCorrection(reqCreate, {
      employeeId: employeeAId,
      attendanceDate: '2026-08-10',
      requestedEventType: 'OUT',
      requestedOccurredAt: '2026-08-10T09:00:00Z',
      reason: 'Lupa absen pulang'
    });
    expect(createResult.status).toBe(200);
    const correctionId = (createResult.body as any).correction.attendance_correction_id;

    const reqDecide = makeRequest(`http://localhost/api/attendance/corrections/${correctionId}/decide`, hrToken, 'PATCH');
    const decideResult = await decideAttendanceCorrection(reqDecide, correctionId, true);
    expect(decideResult.status).toBe(200);

    const { data: afterEvents } = await adminClient.from('attendance_events').select('attendance_event_id, event_type, flags').eq('company_id', companyId).eq('employee_id', employeeAId);
    expect(afterEvents!.length).toBe(beforeCount + 1); // MENAMBAH, bukan mengedit
    const newEvent = afterEvents!.find((e) => (e.flags as any)?.correction_id === correctionId);
    expect(newEvent).toBeDefined();
    expect(newEvent!.event_type).toBe('OUT');

    const { data: dayRow } = await adminClient.from('employee_attendance').select('status, check_out_at').eq('company_id', companyId).eq('employee_id', employeeAId).eq('attendance_date', '2026-08-10').single();
    expect(dayRow!.check_out_at).not.toBeNull(); // rekap terhitung ulang dari event, bukan diedit manual
  });

  it('(BUKTI §8) lupa clock-out di masa lalu -> auto-close + flag, muncul di antrean review', async () => {
    await recordAttendanceEvent(makeRequest('http://localhost/api/attendance/events', hrToken, 'POST'), {
      employeeId: employeeBId,
      productionPlantId: plantId,
      eventType: 'IN',
      occurredAt: '2026-08-05T01:00:00Z', // masa lalu, tidak pernah clock-out
      method: 'MANUAL_HRD',
      lat: -7.9001,
      lng: 112.6001
    });
    const closedCount = await closeStaleOpenAttendanceDays(adminClient, companyId);
    expect(closedCount).toBeGreaterThan(0);

    const { data: dayRow } = await adminClient.from('employee_attendance').select('status, check_out_at, flags').eq('company_id', companyId).eq('employee_id', employeeBId).eq('attendance_date', '2026-08-05').single();
    expect(dayRow!.check_out_at).not.toBeNull();
    expect((dayRow!.flags as any).auto_closed).toBe(true);

    const dashReq = makeRequest('http://localhost/api/attendance?date=2026-08-05', hrToken, 'GET');
    const dashResult = await getAttendanceDashboard(dashReq, '2026-08-05');
    expect((dashResult.body as any).reviewQueue.some((r: any) => r.employee_id === employeeBId)).toBe(true);
  });

  it('rekap bulanan cocok dgn perhitungan manual (angka acuan literal, BUKTI §8)', async () => {
    // Senin (2026-08-17 = Senin), masuk 08:10 (terlambat 10 menit dari toleransi
    // default 15 menit -> late_minutes 0), pulang 16:20 -> kerja kotor 8j10m
    // dikurangi istirahat 60 menit = 430 menit kerja, lembur 430-420=10 menit.
    await recordAttendanceEvent(makeRequest('http://localhost/api/attendance/events', hrToken, 'POST'), {
      employeeId: employeeAId,
      productionPlantId: plantId,
      eventType: 'IN',
      occurredAt: '2026-08-17T01:10:00Z',
      method: 'MANUAL_HRD',
      lat: -7.9001,
      lng: 112.6001
    });
    await recordAttendanceEvent(makeRequest('http://localhost/api/attendance/events', hrToken, 'POST'), {
      employeeId: employeeAId,
      productionPlantId: plantId,
      eventType: 'OUT',
      occurredAt: '2026-08-17T09:20:00Z',
      method: 'MANUAL_HRD',
      lat: -7.9001,
      lng: 112.6001
    });
    const { data: dayRow } = await adminClient
      .from('employee_attendance')
      .select('status, work_minutes, late_minutes, overtime_minutes')
      .eq('company_id', companyId)
      .eq('employee_id', employeeAId)
      .eq('attendance_date', '2026-08-17')
      .single();
    expect(dayRow!.late_minutes).toBe(0); // 10 menit < toleransi 15 menit
    expect(dayRow!.work_minutes).toBe(430); // (9:20-1:10=490 menit) - 60 menit istirahat
    expect(dayRow!.overtime_minutes).toBe(10); // 430 - standar 420 menit (7 jam)
    expect(dayRow!.status).toBe('PULANG');
  });

  it('(BUKTI §8) izin disetujui -> status hari itu IZIN, bukan ALPA', async () => {
    const reqCreate = makeRequest('http://localhost/api/attendance/leave-requests', staffBToken, 'POST');
    const createResult = await createLeaveRequest(reqCreate, { employeeId: employeeBId, leaveType: 'IZIN', startDate: '2026-08-06', endDate: '2026-08-06', reason: 'Urusan keluarga' });
    expect(createResult.status).toBe(200);
    const leaveId = (createResult.body as any).leaveRequest.leave_request_id;

    const reqDecide = makeRequest(`http://localhost/api/attendance/leave-requests/${leaveId}/decide`, hrToken, 'PATCH');
    const decideResult = await decideLeaveRequest(reqDecide, leaveId, true);
    expect(decideResult.status).toBe(200);

    const { data: dayRow } = await adminClient.from('employee_attendance').select('status').eq('company_id', companyId).eq('employee_id', employeeBId).eq('attendance_date', '2026-08-06').single();
    expect(dayRow!.status).toBe('IZIN');
  });

  it('(NEGATIF) staf non-HR mencoba memutuskan koreksi/izin -> ditolak', async () => {
    const reqCreate = makeRequest('http://localhost/api/attendance/leave-requests', staffAToken, 'POST');
    const createResult = await createLeaveRequest(reqCreate, { employeeId: employeeAId, leaveType: 'SAKIT', startDate: '2026-08-11', endDate: '2026-08-11' });
    const leaveId = (createResult.body as any).leaveRequest.leave_request_id;

    const reqDecide = makeRequest(`http://localhost/api/attendance/leave-requests/${leaveId}/decide`, staffAToken, 'PATCH');
    const decideResult = await decideLeaveRequest(reqDecide, leaveId, true);
    expect(decideResult.status).toBe(403);
  });
});

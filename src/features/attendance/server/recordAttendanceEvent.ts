import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageHr } from '@/lib/roles';
import { evaluateGeofence } from './geofence';
import { recomputeAttendanceDay } from './recomputeAttendanceDay';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export interface RecordAttendanceEventInput {
  employeeId: number;
  productionPlantId?: number | null;
  eventType: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';
  occurredAt?: string; // ISO -- default sekarang
  method: 'QR_TABLET' | 'GEO_PHONE' | 'MANUAL_HRD';
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  deviceId?: string | null;
  clientEventId?: string | null;
  photoUrl?: string | null;
}

const CLOCK_DRIFT_TOLERANCE_MINUTES = 5;

// Satu pintu masuk ledger (§6, §3 dokumen) -- QR_TABLET/GEO_PHONE dipakai W2/W3
// (belum ada UI yang memanggilnya, disiapkan agar tidak perlu migrasi ulang),
// MANUAL_HRD adalah SATU-SATUNYA jalur nyata di W1 (dipakai halaman /attendance).
export async function recordAttendanceEvent(request: NextRequest, input: RecordAttendanceEventInput): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }
    if (input.method === 'MANUAL_HRD' && !canManageHr(appUser.role)) {
      return { status: 403, body: { error: 'Hanya HRD/Admin Perusahaan yang dapat mencatat kehadiran manual.' } };
    }
    if (input.method !== 'MANUAL_HRD') {
      // QR_TABLET/GEO_PHONE: hanya karyawan yang bersangkutan boleh mengirim event miliknya sendiri.
      const { data: employee } = await getAdminClient().from('employees').select('linked_user_id').eq('employee_id', input.employeeId).maybeSingle();
      if (!employee || employee.linked_user_id !== appUser.user_id) {
        return { status: 403, body: { error: 'Tidak bisa mencatat kehadiran atas nama karyawan lain.' } };
      }
    }

    const adminClient = getAdminClient();
    const occurredAt = input.occurredAt ?? new Date().toISOString();

    if (input.clientEventId) {
      const { data: existing } = await adminClient
        .from('attendance_events')
        .select('*')
        .eq('company_id', appUser.company_id)
        .eq('client_event_id', input.clientEventId)
        .maybeSingle();
      if (existing) {
        return { status: 200, body: { event: existing, idempotentReplay: true } };
      }
    }

    let plant: { center_lat: number | null; center_lng: number | null; geofence_radius_meters: number } | null = null;
    if (input.productionPlantId) {
      const { data: plantRow } = await adminClient
        .from('production_plants')
        .select('center_lat, center_lng, geofence_radius_meters')
        .eq('production_plant_id', input.productionPlantId)
        .maybeSingle();
      plant = plantRow ?? null;
    }
    const geofenceStatus = evaluateGeofence(plant, input.lat ?? null, input.lng ?? null);

    const flags: Record<string, unknown> = {};
    if (input.method !== 'MANUAL_HRD') {
      const driftMinutes = Math.abs(Date.now() - new Date(occurredAt).getTime()) / 60000;
      if (driftMinutes > CLOCK_DRIFT_TOLERANCE_MINUTES) flags.clock_drift = true;
    }

    if (input.deviceId && input.method !== 'MANUAL_HRD') {
      const { data: activeDevice } = await adminClient
        .from('attendance_devices')
        .select('attendance_device_id, device_fingerprint, status')
        .eq('employee_id', input.employeeId)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (!activeDevice) {
        await adminClient.from('attendance_devices').insert([
          { company_id: appUser.company_id, employee_id: input.employeeId, device_fingerprint: input.deviceId, device_type: 'EMPLOYEE_PHONE', status: 'ACTIVE' }
        ]);
      } else if (activeDevice.device_fingerprint !== input.deviceId) {
        await adminClient.from('attendance_devices').upsert(
          [{ company_id: appUser.company_id, employee_id: input.employeeId, device_fingerprint: input.deviceId, device_type: 'EMPLOYEE_PHONE', status: 'PENDING_APPROVAL' }],
          { onConflict: 'employee_id,device_fingerprint' }
        );
        flags.device_pending_approval = true;
      }
    }

    const { data: inserted, error: insertError } = await adminClient
      .from('attendance_events')
      .insert([
        {
          company_id: appUser.company_id,
          employee_id: input.employeeId,
          production_plant_id: input.productionPlantId ?? null,
          event_type: input.eventType,
          occurred_at: occurredAt,
          method: input.method,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          accuracy_m: input.accuracyM ?? null,
          geofence_status: geofenceStatus,
          device_id: input.deviceId ?? null,
          client_event_id: input.clientEventId ?? null,
          photo_url: input.photoUrl ?? null,
          flags,
          recorded_by: input.method === 'MANUAL_HRD' ? appUser.user_id : null
        }
      ])
      .select('*')
      .single();
    if (insertError) return { status: 500, body: { error: insertError.message } };

    await recomputeAttendanceDay(adminClient, appUser.company_id, input.employeeId, occurredAt.slice(0, 10));

    return { status: 200, body: { event: inserted } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

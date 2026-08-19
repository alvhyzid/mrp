import { NextRequest, NextResponse } from 'next/server';
import { recordAttendanceEvent } from '@/features/attendance/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await recordAttendanceEvent(request, {
    employeeId: Number(body.employeeId),
    productionPlantId: body.productionPlantId ? Number(body.productionPlantId) : null,
    eventType: body.eventType,
    occurredAt: body.occurredAt,
    method: body.method,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    accuracyM: body.accuracyM ?? null,
    deviceId: body.deviceId ?? null,
    clientEventId: body.clientEventId ?? null,
    photoUrl: body.photoUrl ?? null
  });
  return NextResponse.json(result.body, { status: result.status });
}

import { NextRequest, NextResponse } from 'next/server';
import { requestAttendanceCorrection } from '@/features/attendance/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await requestAttendanceCorrection(request, {
    employeeId: Number(body.employeeId),
    attendanceDate: body.attendanceDate,
    requestedEventType: body.requestedEventType,
    requestedOccurredAt: body.requestedOccurredAt,
    reason: body.reason
  });
  return NextResponse.json(result.body, { status: result.status });
}

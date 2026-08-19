import { NextRequest, NextResponse } from 'next/server';
import { createLeaveRequest } from '@/features/attendance/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await createLeaveRequest(request, {
    employeeId: Number(body.employeeId),
    leaveType: body.leaveType,
    startDate: body.startDate,
    endDate: body.endDate,
    reason: body.reason
  });
  return NextResponse.json(result.body, { status: result.status });
}

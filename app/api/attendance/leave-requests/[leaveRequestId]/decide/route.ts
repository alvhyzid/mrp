import { NextRequest, NextResponse } from 'next/server';
import { decideLeaveRequest } from '@/features/attendance/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ leaveRequestId: string }> }) {
  const { leaveRequestId } = await params;
  const body = await request.json();
  const result = await decideLeaveRequest(request, Number(leaveRequestId), body.approve === true);
  return NextResponse.json(result.body, { status: result.status });
}

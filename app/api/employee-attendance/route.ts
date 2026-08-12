import { NextRequest, NextResponse } from 'next/server';
import { listAttendanceByDate } from '@/features/hr/server';

export async function GET(request: NextRequest) {
  const result = await listAttendanceByDate(request);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextRequest, NextResponse } from 'next/server';
import { getAttendanceDashboard } from '@/features/attendance/server';

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const result = await getAttendanceDashboard(request, date);
  return NextResponse.json(result.body, { status: result.status });
}

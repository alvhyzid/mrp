import { NextRequest, NextResponse } from 'next/server';
import { getMyKpi } from '@/features/kpi/server';

export async function GET(request: NextRequest) {
  const result = await getMyKpi(request);
  return NextResponse.json(result.body, { status: result.status });
}

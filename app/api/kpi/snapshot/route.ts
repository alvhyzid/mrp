import { NextRequest, NextResponse } from 'next/server';
import { takeKpiSnapshot } from '@/features/kpi/server';

export async function POST(request: NextRequest) {
  const result = await takeKpiSnapshot(request);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextRequest, NextResponse } from 'next/server';
import { runKpiSeed } from '@/features/kpi/server';

export async function POST(request: NextRequest) {
  const result = await runKpiSeed(request);
  return NextResponse.json(result.body, { status: result.status });
}

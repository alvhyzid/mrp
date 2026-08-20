import { NextRequest, NextResponse } from 'next/server';
import { listKpiCards } from '@/features/kpi/server';

export async function GET(request: NextRequest) {
  const result = await listKpiCards(request);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextRequest, NextResponse } from 'next/server';
import { listStockSummary } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listStockSummary(request);
  return NextResponse.json(result.body, { status: result.status });
}

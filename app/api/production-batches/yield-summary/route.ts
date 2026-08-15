import { NextRequest, NextResponse } from 'next/server';
import { getBatchYieldSummary } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await getBatchYieldSummary(request);
  return NextResponse.json(result.body, { status: result.status });
}

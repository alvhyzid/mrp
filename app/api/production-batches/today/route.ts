import { NextRequest, NextResponse } from 'next/server';
import { listTodaysProductionBatches } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listTodaysProductionBatches(request);
  return NextResponse.json(result.body, { status: result.status });
}

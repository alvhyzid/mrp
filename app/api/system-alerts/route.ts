import { NextRequest, NextResponse } from 'next/server';
import { listSystemAlerts } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listSystemAlerts(request);
  return NextResponse.json(result.body, { status: result.status });
}

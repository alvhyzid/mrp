import { NextRequest, NextResponse } from 'next/server';
import { listWorkCenters } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listWorkCenters(request);
  return NextResponse.json(result.body, { status: result.status });
}

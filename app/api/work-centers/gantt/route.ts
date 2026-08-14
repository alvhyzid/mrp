import { NextRequest, NextResponse } from 'next/server';
import { getWorkCenterGantt } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await getWorkCenterGantt(request);
  return NextResponse.json(result.body, { status: result.status });
}

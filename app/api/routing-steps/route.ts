import { NextRequest, NextResponse } from 'next/server';
import { listRoutingSteps } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listRoutingSteps(request);
  return NextResponse.json(result.body, { status: result.status });
}

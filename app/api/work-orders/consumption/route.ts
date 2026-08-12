import { NextRequest, NextResponse } from 'next/server';
import { recordWorkOrderConsumption } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await recordWorkOrderConsumption(request);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextRequest, NextResponse } from 'next/server';
import { completeProductionBatch } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await completeProductionBatch(request);
  return NextResponse.json(result.body, { status: result.status });
}

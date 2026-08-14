import { NextRequest, NextResponse } from 'next/server';
import { listProductionBatches, createProductionBatch } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listProductionBatches(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createProductionBatch(request);
  return NextResponse.json(result.body, { status: result.status });
}

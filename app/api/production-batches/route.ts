import { NextRequest, NextResponse } from 'next/server';
import { listProductionBatches, createProductionBatch, updateProductionBatchSchedule } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listProductionBatches(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createProductionBatch(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await updateProductionBatchSchedule(request);
  return NextResponse.json(result.body, { status: result.status });
}

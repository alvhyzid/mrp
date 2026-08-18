import { NextRequest, NextResponse } from 'next/server';
import { startProductionBatch } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await startProductionBatch(request);
  return NextResponse.json(result.body, { status: result.status });
}

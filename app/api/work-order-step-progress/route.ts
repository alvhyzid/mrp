import { NextRequest, NextResponse } from 'next/server';
import { listWorkOrderStepProgress, recordWorkOrderStepProgress } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listWorkOrderStepProgress(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await recordWorkOrderStepProgress(request);
  return NextResponse.json(result.body, { status: result.status });
}

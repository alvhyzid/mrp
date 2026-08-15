import { NextRequest, NextResponse } from 'next/server';
import { recordWorkOrderOutput } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await recordWorkOrderOutput(request);
  return NextResponse.json(result.body, { status: result.status });
}

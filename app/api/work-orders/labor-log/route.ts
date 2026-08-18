import { NextRequest, NextResponse } from 'next/server';
import { recordLaborLog } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await recordLaborLog(request);
  return NextResponse.json(result.body, { status: result.status });
}

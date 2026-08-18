import { NextRequest, NextResponse } from 'next/server';
import { learnFromBatch } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await learnFromBatch(request);
  return NextResponse.json(result.body, { status: result.status });
}

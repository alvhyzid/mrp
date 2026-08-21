import { NextRequest, NextResponse } from 'next/server';
import { lockFeasibilityBaseline } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await lockFeasibilityBaseline(request);
  return NextResponse.json(result.body, { status: result.status });
}

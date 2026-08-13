import { NextRequest, NextResponse } from 'next/server';
import { getDashboardSummary } from '@/features/auth';

export async function GET(request: NextRequest) {
  const result = await getDashboardSummary(request);
  return NextResponse.json(result.body, { status: result.status });
}

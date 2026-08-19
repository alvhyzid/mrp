import { NextRequest, NextResponse } from 'next/server';
import { getProcessMiningDashboard } from '@/features/process-mining/server';

export async function GET(request: NextRequest) {
  const result = await getProcessMiningDashboard(request);
  return NextResponse.json(result.body, { status: result.status });
}

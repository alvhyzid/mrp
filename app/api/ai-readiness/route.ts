import { NextRequest, NextResponse } from 'next/server';
import { getAiReadinessDashboard } from '@/features/ai-readiness/server';

export async function GET(request: NextRequest) {
  const result = await getAiReadinessDashboard(request);
  return NextResponse.json(result.body, { status: result.status });
}

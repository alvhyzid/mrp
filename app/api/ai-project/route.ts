import { NextRequest, NextResponse } from 'next/server';
import { getAiProjectDashboard } from '@/features/ai-project/server';

export async function GET(request: NextRequest) {
  const result = await getAiProjectDashboard(request);
  return NextResponse.json(result.body, { status: result.status });
}

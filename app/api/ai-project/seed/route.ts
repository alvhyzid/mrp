import { NextRequest, NextResponse } from 'next/server';
import { runAiProjectSeed } from '@/features/ai-project/server';

export async function POST(request: NextRequest) {
  const result = await runAiProjectSeed(request);
  return NextResponse.json(result.body, { status: result.status });
}

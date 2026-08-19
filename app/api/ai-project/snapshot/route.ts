import { NextRequest, NextResponse } from 'next/server';
import { takeAiProjectSnapshot } from '@/features/ai-project/server';

export async function POST(request: NextRequest) {
  const result = await takeAiProjectSnapshot(request);
  return NextResponse.json(result.body, { status: result.status });
}

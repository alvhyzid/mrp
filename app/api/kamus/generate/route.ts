import { NextRequest, NextResponse } from 'next/server';
import { runKamusGenerator } from '@/features/kamus/server';

export async function POST(request: NextRequest) {
  const result = await runKamusGenerator(request);
  return NextResponse.json(result.body, { status: result.status });
}

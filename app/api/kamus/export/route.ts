import { NextRequest, NextResponse } from 'next/server';
import { exportKamusMarkdown } from '@/features/kamus/server';

export async function GET(request: NextRequest) {
  const result = await exportKamusMarkdown(request);
  return NextResponse.json(result.body, { status: result.status });
}

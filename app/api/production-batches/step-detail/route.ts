import { NextRequest, NextResponse } from 'next/server';
import { getGanttBlockDetail } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await getGanttBlockDetail(request);
  return NextResponse.json(result.body, { status: result.status });
}

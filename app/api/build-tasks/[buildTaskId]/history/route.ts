import { NextRequest, NextResponse } from 'next/server';
import { getBuildTaskHistory } from '@/features/mrp/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ buildTaskId: string }> }) {
  const { buildTaskId } = await params;
  const result = await getBuildTaskHistory(request, Number(buildTaskId));
  return NextResponse.json(result.body, { status: result.status });
}

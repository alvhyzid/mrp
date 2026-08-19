import { NextRequest, NextResponse } from 'next/server';
import { setAiProjectTaskManualPercent } from '@/features/ai-project/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const result = await setAiProjectTaskManualPercent(request, Number(taskId));
  return NextResponse.json(result.body, { status: result.status });
}

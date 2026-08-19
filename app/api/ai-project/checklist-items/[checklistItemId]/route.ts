import { NextRequest, NextResponse } from 'next/server';
import { toggleAiProjectChecklistItem } from '@/features/ai-project/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ checklistItemId: string }> }) {
  const { checklistItemId } = await params;
  const result = await toggleAiProjectChecklistItem(request, Number(checklistItemId));
  return NextResponse.json(result.body, { status: result.status });
}

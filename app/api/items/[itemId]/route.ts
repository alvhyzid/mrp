import { NextRequest, NextResponse } from 'next/server';
import { deleteOrDeactivateItem } from '@/features/mrp/server';

export async function DELETE(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await context.params;
  const result = await deleteOrDeactivateItem(request, itemId);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextRequest, NextResponse } from 'next/server';
import { deleteOrArchiveBom } from '@/features/mrp/server';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ bomId: string }> }) {
  const { bomId } = await params;
  const result = await deleteOrArchiveBom(request, bomId);
  return NextResponse.json(result.body, { status: result.status });
}

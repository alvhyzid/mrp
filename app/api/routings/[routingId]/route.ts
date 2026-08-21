import { NextRequest, NextResponse } from 'next/server';
import { deleteRouting } from '@/features/mrp/server';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ routingId: string }> }) {
  const { routingId } = await params;
  const result = await deleteRouting(request, routingId);
  return NextResponse.json(result.body, { status: result.status });
}

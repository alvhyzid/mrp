import { NextRequest, NextResponse } from 'next/server';
import { archiveRouting } from '@/features/mrp/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ routingId: string }> }) {
  const { routingId } = await params;
  const result = await archiveRouting(request, routingId);
  return NextResponse.json(result.body, { status: result.status });
}

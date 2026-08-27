import { NextRequest, NextResponse } from 'next/server';
import { restoreBom } from '@/features/mrp/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ bomId: string }> }) {
  const { bomId } = await params;
  const result = await restoreBom(request, bomId);
  return NextResponse.json(result.body, { status: result.status });
}

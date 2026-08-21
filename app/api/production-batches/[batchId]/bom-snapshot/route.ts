import { NextRequest, NextResponse } from 'next/server';
import { getProductionBatchBomSnapshot } from '@/features/mrp/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const parsed = Number(batchId);
  if (!Number.isInteger(parsed)) {
    return NextResponse.json({ error: 'ID batch tidak valid.' }, { status: 400 });
  }
  const result = await getProductionBatchBomSnapshot(request, parsed);
  return NextResponse.json(result.body, { status: result.status });
}

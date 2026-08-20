import { NextRequest, NextResponse } from 'next/server';
import { hardDeleteOrphanDocument } from '@/features/documents/server';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const body = await request.json();
  const result = await hardDeleteOrphanDocument(request, Number(documentId), String(body.reason ?? ''));
  return NextResponse.json(result.body, { status: result.status });
}

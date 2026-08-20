import { NextRequest, NextResponse } from 'next/server';
import { getDocumentSignedUrl } from '@/features/documents/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') === 'download' ? 'download' : 'view';
  const result = await getDocumentSignedUrl(request, Number(documentId), action);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextRequest, NextResponse } from 'next/server';
import { listDocumentTypes } from '@/features/documents/server';

export async function GET(request: NextRequest) {
  const result = await listDocumentTypes(request);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextRequest, NextResponse } from 'next/server';
import { seedDocumentTypes } from '@/features/documents/server';

export async function POST(request: NextRequest) {
  const result = await seedDocumentTypes(request);
  return NextResponse.json(result.body, { status: result.status });
}

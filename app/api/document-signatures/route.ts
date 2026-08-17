import { NextRequest, NextResponse } from 'next/server';
import { recordDocumentSignature } from '@/features/signatures/server';

export async function POST(request: NextRequest) {
  const result = await recordDocumentSignature(request);
  return NextResponse.json(result.body, { status: result.status });
}

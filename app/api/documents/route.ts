import { NextRequest, NextResponse } from 'next/server';
import { listDocuments, uploadDocument } from '@/features/documents/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filters = {
    docType: searchParams.get('doc_type') ?? undefined,
    department: searchParams.get('department') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    entityType: searchParams.get('entity_type') ?? undefined,
    entityId: searchParams.get('entity_id') ? Number(searchParams.get('entity_id')) : undefined,
    issuedFrom: searchParams.get('issued_from') ?? undefined,
    issuedTo: searchParams.get('issued_to') ?? undefined
  };
  const result = await listDocuments(request, filters);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await uploadDocument(request);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextRequest, NextResponse } from 'next/server';
import { listItems, createItem, updateItem } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listItems(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createItem(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await updateItem(request);
  return NextResponse.json(result.body, { status: result.status });
}

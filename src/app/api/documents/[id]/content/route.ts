import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { documents } from '@/lib/database/schema';
import { apiError } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Extracted text of a document (for the reader view). */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.select().from(documents).where(eq(documents.id, id)).get();
    if (!row) return apiError('Document not found', 404);

    return NextResponse.json({
      id: row.id,
      status: row.status,
      text: row.extractedText ?? '',
      pageCount: row.pageCount,
      errorMessage: row.errorMessage,
    });
  } catch (err) {
    console.error('GET /api/documents/[id]/content failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to load document content', 500);
  }
}

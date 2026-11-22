import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { documents } from '@/lib/database/schema';
import { toDocumentDTO } from '@/lib/database/serialize';
import { apiError } from '@/lib/api/http';
import { extractDocument } from '@/lib/storage/extract';
import { resolveStoredPath } from '@/lib/storage/files';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Re-run text extraction for a document whose extraction failed. */
export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.select().from(documents).where(eq(documents.id, id)).get();
    if (!row) return apiError('Document not found', 404);

    const absPath = resolveStoredPath(row.storageName);
    if (!absPath) return apiError('Stored file is missing or invalid', 500);

    const extraction = await extractDocument(absPath, row.originalName);
    db.update(documents)
      .set({
        status: extraction.ok ? 'extracted' : 'failed',
        extractedText: extraction.ok ? extraction.text : null,
        pageCount: extraction.ok ? extraction.pageCount : null,
        errorMessage: extraction.ok ? null : extraction.error,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .run();

    const updated = db.select().from(documents).where(eq(documents.id, id)).get();
    if (!updated) return apiError('Document not found', 404);
    return NextResponse.json(toDocumentDTO(db, updated));
  } catch (err) {
    console.error('POST /api/documents/[id]/retry failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to retry extraction', 500);
  }
}

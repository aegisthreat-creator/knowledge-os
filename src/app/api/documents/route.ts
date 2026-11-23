import fs from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { documents } from '@/lib/database/schema';
import { resolveTagIds, setDocumentTags } from '@/lib/database/tags';
import { toDocumentDTO } from '@/lib/database/serialize';
import { apiError } from '@/lib/api/http';
import { extractDocument } from '@/lib/storage/extract';
import {
  ALLOWED_MIME_TYPES,
  getExtension,
  isAllowedFile,
  resolveStoredPath,
} from '@/lib/storage/files';
import { newId } from '@/lib/utils/id';

export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = (() => {
  const mb = Number(process.env.MAX_UPLOAD_MB ?? '25');
  const value = Number.isFinite(mb) && mb > 0 ? mb : 25;
  return Math.min(value, 200) * 1024 * 1024;
})();

export async function GET() {
  try {
    const db = getDb();
    const rows = db.select().from(documents).orderBy(desc(documents.createdAt)).all();
    return NextResponse.json(rows.map((row) => toDocumentDTO(db, row)));
  } catch (err) {
    console.error('GET /api/documents failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to load documents', 500);
  }
}

/**
 * Upload a document (multipart/form-data: file, optional title, optional tags).
 * Supported: .txt, .md, .markdown, .pdf. Extraction runs inline; failures are
 * recorded as status='failed' with an error message (never faked as success).
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => null);
    if (!form) return apiError('Expected multipart/form-data', 415);

    const file = form.get('file');
    if (!(file instanceof File)) return apiError('Missing "file" field', 400);
    if (file.size === 0) return apiError('The file is empty.', 400);
    if (file.size > MAX_UPLOAD_BYTES) {
      return apiError(
        `File is too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB).`,
        413,
      );
    }

    const originalName = file.name || 'upload';
    if (!isAllowedFile(originalName)) {
      const ext = getExtension(originalName) || 'unknown';
      return apiError(
        `Unsupported file type "${ext}". Supported formats: TXT, MD, PDF.`,
        415,
      );
    }
    const mime = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return apiError(`Unsupported MIME type "${mime}". Supported formats: TXT, MD, PDF.`, 415);
    }

    const storageName = `${newId(18)}${getExtension(originalName)}`;
    const absPath = resolveStoredPath(storageName);
    if (!absPath) return apiError('Failed to resolve storage path', 500);

    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absPath, bytes);

    const titleRaw =
      (typeof form.get('title') === 'string' ? String(form.get('title')) : '') ||
      originalName.replace(/\.[^.]+$/, '');
    const title = titleRaw.trim().slice(0, 300) || 'Untitled document';

    const tagsRaw = form.get('tags');
    let tagNames: string[] = [];
    if (typeof tagsRaw === 'string' && tagsRaw.trim()) {
      try {
        const parsed: unknown = JSON.parse(tagsRaw);
        if (Array.isArray(parsed)) {
          tagNames = parsed.filter((t): t is string => typeof t === 'string').slice(0, 30);
        }
      } catch {
        // ignore malformed tag payload — upload itself still succeeds
      }
    }

    const extraction = await extractDocument(absPath, originalName);
    const now = new Date();
    const id = newId();

    const db = getDb();
    db.insert(documents)
      .values({
        id,
        title,
        originalName,
        mimeType: mime,
        sizeBytes: file.size,
        storageName,
        status: extraction.ok ? 'extracted' : 'failed',
        extractedText: extraction.ok ? extraction.text : null,
        pageCount: extraction.ok ? extraction.pageCount : null,
        errorMessage: extraction.ok ? null : extraction.error,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    if (tagNames.length > 0) {
      setDocumentTags(db, id, resolveTagIds(db, tagNames));
    }

    const row = db.select().from(documents).where(eq(documents.id, id)).get();
    if (!row) return apiError('Failed to save document', 500);
    return NextResponse.json(toDocumentDTO(db, row), { status: 201 });
  } catch (err) {
    console.error('POST /api/documents failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to upload document', 500);
  }
}

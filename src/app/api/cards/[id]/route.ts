import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { flashcards } from '@/lib/database/schema';
import { apiError, parseJson } from '@/lib/api/http';
import { updateCardSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [body, err] = await parseJson(req, updateCardSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const existing = db.select().from(flashcards).where(eq(flashcards.id, id)).get();
    if (!existing) return apiError('Card not found', 404);

    const updates: Partial<typeof flashcards.$inferInsert> = { updatedAt: new Date() };
    if (body.question !== undefined) updates.question = body.question;
    if (body.answer !== undefined) updates.answer = body.answer;
    db.update(flashcards).set(updates).where(eq(flashcards.id, id)).run();

    const updated = db.select().from(flashcards).where(eq(flashcards.id, id)).get();
    if (!updated) return apiError('Card not found', 404);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/cards/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to update card', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const existing = db.select().from(flashcards).where(eq(flashcards.id, id)).get();
    if (!existing) return apiError('Card not found', 404);
    db.delete(flashcards).where(eq(flashcards.id, id)).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/cards/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to delete card', 500);
  }
}

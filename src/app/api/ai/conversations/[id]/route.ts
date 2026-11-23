import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { aiConversations, aiMessages } from '@/lib/database/schema';
import { apiError, parseJson } from '@/lib/api/http';
import { z } from 'zod';
import type { ConversationDTO, MessageDTO } from '@/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  model: z.string().trim().max(120).nullable().optional(),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const conversation = db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.id, id))
      .get();
    if (!conversation) return apiError('Conversation not found', 404);

    const messageRows = db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, id))
      .orderBy(asc(aiMessages.createdAt))
      .all();

    const messages: MessageDTO[] = messageRows.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));

    const dto: ConversationDTO = {
      id: conversation.id,
      title: conversation.title,
      model: conversation.model,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: messages.length,
    };
    return NextResponse.json({ conversation: dto, messages });
  } catch (err) {
    console.error('GET /api/ai/conversations/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to load conversation', 500);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [body, err] = await parseJson(req, updateSchema);
    if (err) return err;
    if (!body) return apiError('Invalid request body', 400);

    const db = getDb();
    const existing = db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.id, id))
      .get();
    if (!existing) return apiError('Conversation not found', 404);

    const updates: Partial<typeof aiConversations.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.title !== undefined) updates.title = body.title;
    if (body.model !== undefined) updates.model = body.model;
    db.update(aiConversations).set(updates).where(eq(aiConversations.id, id)).run();

    const updated = db.select().from(aiConversations).where(eq(aiConversations.id, id)).get();
    if (!updated) return apiError('Conversation not found', 404);
    const dto: ConversationDTO = {
      id: updated.id,
      title: updated.title,
      model: updated.model,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      messageCount: 0,
    };
    return NextResponse.json(dto);
  } catch (err) {
    console.error('PATCH /api/ai/conversations/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to update conversation', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const existing = db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.id, id))
      .get();
    if (!existing) return apiError('Conversation not found', 404);
    db.delete(aiConversations).where(eq(aiConversations.id, id)).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/ai/conversations/[id] failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to delete conversation', 500);
  }
}

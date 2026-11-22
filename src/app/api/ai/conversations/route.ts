import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/database/client';
import { aiConversations } from '@/lib/database/schema';
import { apiError, parseJson } from '@/lib/api/http';
import { z } from 'zod';
import { newId } from '@/lib/utils/id';
import type { ConversationDTO } from '@/types';

export const dynamic = 'force-dynamic';

const createConversationSchema = z.object({
  title: z.string().trim().max(200).optional(),
  model: z.string().trim().max(120).nullable().optional(),
});

export async function GET() {
  try {
    const db = getDb();
    const rows = db
      .select({
        id: aiConversations.id,
        title: aiConversations.title,
        model: aiConversations.model,
        createdAt: aiConversations.createdAt,
        updatedAt: aiConversations.updatedAt,
        messageCount: sql<number>`(SELECT COUNT(*) FROM ai_messages WHERE conversation_id = ${aiConversations}.id)`,
      })
      .from(aiConversations)
      .orderBy(desc(aiConversations.updatedAt))
      .all();

    const result: ConversationDTO[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      model: r.model,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      messageCount: r.messageCount,
    }));
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/ai/conversations failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to load conversations', 500);
  }
}

export async function POST(req: Request) {
  try {
    const [body, err] = await parseJson(req, createConversationSchema);
    if (err) return err;

    const db = getDb();
    const id = newId();
    db.insert(aiConversations)
      .values({
        id,
        title: body?.title?.trim() || 'New conversation',
        model: body?.model ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    const created = db.select().from(aiConversations).where(eq(aiConversations.id, id)).get();
    if (!created) return apiError('Failed to create conversation', 500);
    return NextResponse.json(
      {
        id: created.id,
        title: created.title,
        model: created.model,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        messageCount: 0,
      } satisfies ConversationDTO,
      { status: 201 },
    );
  } catch (err) {
    console.error('POST /api/ai/conversations failed:', err instanceof Error ? err.message : err);
    return apiError('Failed to create conversation', 500);
  }
}

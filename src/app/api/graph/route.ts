import { NextResponse } from 'next/server';
import { getDb, getSqlite } from '@/lib/database/client';
import { noteLinks, notes, tags } from '@/lib/database/schema';

export const dynamic = 'force-dynamic';

interface GraphNode {
  id: string;
  type: 'note' | 'tag';
  label: string;
  isPinned?: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'wikilink' | 'link' | 'tag';
}

interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g;

/** Extract [[Title]] targets from markdown content. */
function extractWikilinkTargets(content: string): string[] {
  const targets: string[] = [];
  let match: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const target = match[1].trim();
    if (target) targets.push(target);
  }
  return targets;
}

export async function GET() {
  try {
    const db = getDb();
    const sqlite = getSqlite();

    const noteRows = db
      .select({ id: notes.id, title: notes.title, isPinned: notes.isPinned, content: notes.content })
      .from(notes)
      .all();
    const tagRows = db.select({ id: tags.id, name: tags.name }).from(tags).all();

    const nodes: GraphNode[] = [
      ...noteRows.map((n) => ({
        id: n.id,
        type: 'note' as const,
        label: n.title || 'Untitled',
        isPinned: n.isPinned,
      })),
      ...tagRows.map((t) => ({ id: t.id, type: 'tag' as const, label: t.name })),
    ];

    const noteIds = new Set(noteRows.map((n) => n.id));
    const edges: GraphEdge[] = [];
    const seen = new Set<string>();

    const addNoteEdge = (source: string, target: string, type: GraphEdge['type']) => {
      if (!noteIds.has(source) || !noteIds.has(target) || source === target) return;
      const key = `${type}:${source}:${target}`;
      const reverse = `${type}:${target}:${source}`;
      if (seen.has(key) || (type !== 'tag' && seen.has(reverse))) return;
      seen.add(key);
      edges.push({ source, target, type });
    };

    // 1. Explicit links created in the note editor
    const manualLinks = db
      .select({ source: noteLinks.sourceNoteId, target: noteLinks.targetNoteId })
      .from(noteLinks)
      .all();
    for (const link of manualLinks) addNoteEdge(link.source, link.target, 'link');

    // 2. [[Wikilinks]] resolved by note title (case-insensitive)
    const titleToId = new Map<string, string>();
    for (const n of noteRows) {
      const key = (n.title || '').trim().toLowerCase();
      if (key && !titleToId.has(key)) titleToId.set(key, n.id);
    }
    for (const n of noteRows) {
      for (const target of extractWikilinkTargets(n.content)) {
        const targetId = titleToId.get(target.toLowerCase());
        if (targetId) addNoteEdge(n.id, targetId, 'wikilink');
      }
    }

    // 3. Tag membership (note ↔ tag) — tags act as relationship indicators
    const tagEdges = sqlite
      .prepare(
        `SELECT nt.note_id AS noteId, nt.tag_id AS tagId
         FROM note_tags nt
         JOIN notes n ON n.id = nt.note_id
         JOIN tags t ON t.id = nt.tag_id`,
      )
      .all() as { noteId: string; tagId: string }[];
    for (const row of tagEdges) {
      const key = `tag:${row.noteId}:${row.tagId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: row.noteId, target: row.tagId, type: 'tag' });
    }

    const MAX_EDGES = 4000;
    return NextResponse.json({
      nodes,
      edges: edges.slice(0, MAX_EDGES),
      truncated: edges.length > MAX_EDGES,
    } satisfies GraphResponse);
  } catch (err) {
    console.error('GET /api/graph failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to load graph' }, { status: 500 });
  }
}

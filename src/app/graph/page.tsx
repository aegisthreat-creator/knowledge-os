import type { Metadata } from 'next';
import { KnowledgeGraph } from '@/features/graph/knowledge-graph';

export const metadata: Metadata = { title: 'Knowledge Graph' };

export default function GraphPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          Knowledge graph
        </h1>
        <p className="text-sm text-muted-foreground">
          Notes connected by links, wikilinks, and shared tags. Click any node to open it.
        </p>
      </div>
      <KnowledgeGraph />
    </div>
  );
}

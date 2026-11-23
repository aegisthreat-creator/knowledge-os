'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Share2, Tag } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

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

interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
}

const WIDTH = 1200;
const HEIGHT = 760;

function initialPosition(id: string): { x: number; y: number } {
  // Deterministic pseudo-random placement so the graph looks stable across reloads.
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const angle = ((hash % 3600) / 3600) * Math.PI * 2;
  const radius = 180 + (Math.abs(hash >> 8) % 220);
  return {
    x: WIDTH / 2 + Math.cos(angle) * radius,
    y: HEIGHT / 2 + Math.sin(angle) * radius,
  };
}

/**
 * Interactive knowledge graph: notes and tags laid out with a small
 * force-directed simulation (no external graph library). Edges come from
 * manual links, [[wikilinks]], and shared tags.
 */
export function KnowledgeGraph() {
  const router = useRouter();
  const { data, loading, error, refresh } = useApi<GraphPayload>('/api/graph');

  const [showTags, setShowTags] = React.useState(true);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [view, setView] = React.useState({ x: 0, y: 0, w: WIDTH, h: HEIGHT });

  const nodesRef = React.useRef<SimNode[]>([]);
  const edgesRef = React.useRef<GraphEdge[]>([]);
  const rafRef = React.useRef<number | null>(null);
  const alphaRef = React.useRef(1);
  const dragRef = React.useRef<{ id: string | null; moved: boolean }>({ id: null, moved: false });
  const panRef = React.useRef<{
    startX: number;
    startY: number;
    viewX: number;
    viewY: number;
    viewW: number;
    viewH: number;
  } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [, setTick] = React.useState(0);

  // Build simulation state when data arrives.
  React.useEffect(() => {
    if (!data) return;
    const degree = new Map<string, number>();
    for (const e of data.edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    nodesRef.current = data.nodes.map((n) => {
      const { x, y } = initialPosition(n.id);
      return { ...n, x, y, vx: 0, vy: 0, degree: degree.get(n.id) ?? 0 };
    });
    edgesRef.current = data.edges;
    alphaRef.current = 1;
    setView({ x: 0, y: 0, w: WIDTH, h: HEIGHT });
    startSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const startSimulation = React.useCallback(() => {
    if (rafRef.current !== null) return;
    const step = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const alpha = alphaRef.current;

      if (alpha > 0.01 && nodes.length > 0) {
        // Repulsion (all pairs — fine for local-scale graphs)
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let distSq = dx * dx + dy * dy;
            if (distSq < 1) {
              dx = (Math.random() - 0.5) * 2;
              dy = (Math.random() - 0.5) * 2;
              distSq = dx * dx + dy * dy + 1;
            }
            const dist = Math.sqrt(distSq);
            const force = (1800 * alpha) / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }

        // Springs along edges
        for (const edge of edges) {
          const a = nodes.find((n) => n.id === edge.source);
          const b = nodes.find((n) => n.id === edge.target);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const rest = edge.type === 'tag' ? 90 : 130;
          const force = ((dist - rest) * 0.02 * alpha) / dist;
          const fx = dx * force;
          const fy = dy * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }

        // Centering + integration
        for (const n of nodes) {
          n.vx += ((WIDTH / 2 - n.x) * 0.002) * alpha * 10;
          n.vy += ((HEIGHT / 2 - n.y) * 0.002) * alpha * 10;
          n.vx *= 0.85;
          n.vy *= 0.85;
          if (dragRef.current.id === n.id) {
            n.vx = 0;
            n.vy = 0;
            continue;
          }
          n.x += n.vx;
          n.y += n.vy;
          n.x = Math.max(30, Math.min(WIDTH - 30, n.x));
          n.y = Math.max(30, Math.min(HEIGHT - 30, n.y));
        }

        alphaRef.current = alpha * 0.994;
        setTick((t) => t + 1);
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        setTick((t) => t + 1);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  // Screen → graph coordinates
  const toGraphCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: view.x + ((clientX - rect.left) / rect.width) * view.w,
      y: view.y + ((clientY - rect.top) / rect.height) * view.h,
    };
  };

  const handleNodePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { id, moved: false };
    alphaRef.current = Math.max(alphaRef.current, 0.3);
    startSimulation();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current.id) {
      const { x, y } = toGraphCoords(e.clientX, e.clientY);
      const node = nodesRef.current.find((n) => n.id === dragRef.current.id);
      if (node) {
        if (Math.abs(node.x - x) + Math.abs(node.y - y) > 3) dragRef.current.moved = true;
        node.x = x;
        node.y = y;
        setTick((t) => t + 1);
      }
    } else if (panRef.current) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = ((e.clientX - panRef.current.startX) / rect.width) * panRef.current.viewW;
      const dy = ((e.clientY - panRef.current.startY) / rect.height) * panRef.current.viewH;
      setView((v) => ({
        ...v,
        x: panRef.current!.viewX - dx,
        y: panRef.current!.viewY - dy,
      }));
    }
  };

  const handlePointerUp = () => {
    if (dragRef.current.id) {
      const { id, moved } = dragRef.current;
      dragRef.current = { id: null, moved: false };
      if (!moved) {
        const node = nodesRef.current.find((n) => n.id === id);
        if (node) {
          if (node.type === 'note') router.push(`/notes/${node.id}`);
          else router.push(`/search?q=${encodeURIComponent(node.label)}`);
        }
      }
    }
    panRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 0.9;
    setView((v) => {
      const newW = Math.min(WIDTH * 2, Math.max(300, v.w * factor));
      const newH = newW * (HEIGHT / WIDTH);
      // zoom toward cursor
      const { x: gx, y: gy } = toGraphCoords(e.clientX, e.clientY);
      const rx = (gx - v.x) / v.w;
      const ry = (gy - v.y) / v.h;
      return { x: gx - rx * newW, y: gy - ry * newH, w: newW, h: newH };
    });
  };

  const resetView = () => setView({ x: 0, y: 0, w: WIDTH, h: HEIGHT });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Could not load the graph"
        description={error ?? undefined}
        action={
          <Button variant="outline" onClick={refresh}>
            Try again
          </Button>
        }
      />
    );
  }

  const visibleNodes = showTags
    ? nodesRef.current
    : nodesRef.current.filter((n) => n.type === 'note');
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edgesRef.current.filter(
    (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
  );

  const neighborIds = new Set<string>();
  if (hoveredId) {
    neighborIds.add(hoveredId);
    for (const e of visibleEdges) {
      if (e.source === hoveredId) neighborIds.add(e.target);
      if (e.target === hoveredId) neighborIds.add(e.source);
    }
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Switch checked={showTags} onCheckedChange={setShowTags} id="show-tags" />
          <label htmlFor="show-tags" className="cursor-pointer text-muted-foreground">
            Show tags
          </label>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" /> note
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-chart-3" /> tag
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-primary/70" /> link
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t border-dashed border-muted-foreground/60" /> tag relation
          </span>
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {visibleNodes.length} nodes · {visibleEdges.length} edges
        </span>
        <Button variant="outline" size="sm" onClick={resetView}>
          Reset view
        </Button>
      </div>

      {data.truncated ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
          Large graph — showing a subset of connections.
        </p>
      ) : null}

      {visibleNodes.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="No notes to graph yet"
          description="Create notes, link them with [[wikilinks]] or the link tool, and tag them — relationships will appear here."
          action={
            <Button onClick={() => router.push('/notes/new')}>
              <Share2 className="h-4 w-4" /> Create a note
            </Button>
          }
        />
      ) : (
        <div className="relative overflow-hidden rounded-lg border bg-card shadow-sm">
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            className="h-[60vh] min-h-[420px] w-full cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={(e) => {
              if (e.target === svgRef.current) {
                panRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  viewX: view.x,
                  viewY: view.y,
                  viewW: view.w,
                  viewH: view.h,
                };
              }
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
            role="img"
            aria-label="Knowledge graph of notes and tags"
          >
            {/* edges */}
            <g>
              {visibleEdges.map((e, i) => {
                const a = nodesRef.current.find((n) => n.id === e.source);
                const b = nodesRef.current.find((n) => n.id === e.target);
                if (!a || !b) return null;
                const highlighted =
                  hoveredId !== null && (e.source === hoveredId || e.target === hoveredId);
                return (
                  <line
                    key={`${e.source}-${e.target}-${i}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={cn(
                      'transition-opacity',
                      e.type === 'tag'
                        ? 'stroke-muted-foreground/40'
                        : 'stroke-primary/50',
                      e.type === 'link' ? '' : 'stroke-dasharray-3',
                      hoveredId && !highlighted ? 'opacity-20' : 'opacity-100',
                    )}
                    strokeWidth={highlighted ? 1.8 : 1}
                  />
                );
              })}
            </g>

            {/* nodes */}
            {visibleNodes.map((n) => {
              const isTag = n.type === 'tag';
              const dimmed = hoveredId !== null && !neighborIds.has(n.id);
              const r = isTag ? 6 : Math.min(14, 7 + Math.min(n.degree, 6));
              return (
                <g
                  key={n.id}
                  className="graph-node"
                  transform={`translate(${n.x}, ${n.y})`}
                  opacity={dimmed ? 0.25 : 1}
                  onPointerDown={(e) => handleNodePointerDown(e, n.id)}
                  onPointerEnter={() => setHoveredId(n.id)}
                  onPointerLeave={() => setHoveredId((prev) => (prev === n.id ? null : prev))}
                >
                  {n.isPinned ? (
                    <circle r={r + 4} className="fill-primary/15" />
                  ) : null}
                  <circle
                    r={r}
                    className={cn(
                      'stroke-2',
                      isTag ? 'fill-chart-3 stroke-chart-3/40' : 'fill-primary stroke-primary/40',
                      n.isPinned && 'stroke-warning',
                    )}
                  />
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    className={cn(
                      'graph-node-label pointer-events-none select-none text-[11px]',
                      isTag ? 'fill-muted-foreground' : 'fill-foreground/80',
                    )}
                    fontSize={11}
                  >
                    {n.label.length > 24 ? `${n.label.slice(0, 23)}…` : n.label}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-background/80 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
            Drag nodes · scroll to zoom · drag background to pan · click to open
            {showTags ? null : (
              <span className="ml-1 inline-flex items-center gap-1">
                · <Tag className="h-3 w-3" /> hidden
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

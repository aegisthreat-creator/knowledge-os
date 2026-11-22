'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  FileText,
  FileWarning,
  LoaderCircle,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { MarkdownViewer } from '@/components/markdown/markdown-viewer';
import { formatBytes, formatRelativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import type { DocumentDTO } from '@/types';

interface ContentPayload {
  id: string;
  status: string;
  text: string;
  pageCount: number | null;
  errorMessage: string | null;
}

function ReaderDialog({
  documentId,
  onClose,
  onRetry,
}: {
  documentId: string | null;
  onClose: () => void;
  onRetry: (id: string) => void;
}) {
  const [content, setContent] = React.useState<ContentPayload | null>(null);
  const [meta, setMeta] = React.useState<DocumentDTO | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!documentId) {
      setContent(null);
      setMeta(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [contentRes, metaRes] = await Promise.all([
          fetch(`/api/documents/${documentId}/content`),
          fetch(`/api/documents/${documentId}`),
        ]);
        if (!contentRes.ok) throw new Error('Failed to load content');
        const data: ContentPayload = await contentRes.json();
        if (metaRes.ok) setMeta((await metaRes.json()) as DocumentDTO);
        if (!cancelled) setContent(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to open document');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const isMarkdown = meta?.originalName.toLowerCase().endsWith('.md') ||
    meta?.originalName.toLowerCase().endsWith('.markdown');

  return (
    <Dialog open={Boolean(documentId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
            {meta?.title ?? 'Document'}
          </DialogTitle>
          <DialogDescription>
            {meta ? `${meta.originalName} · ${formatBytes(meta.sizeBytes)}` : 'Loading…'}
            {meta?.pageCount ? ` · ${meta.pageCount} pages` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Spinner /> Loading content…
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : content?.status === 'failed' ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <div>
                <p className="font-medium">Text extraction failed</p>
                <p className="mt-1 text-muted-foreground">{content.errorMessage}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (documentId) onRetry(documentId);
              }}
            >
              <RefreshCw className="h-4 w-4" /> Retry extraction
            </Button>
          </div>
        ) : content ? (
          content.text.trim() ? (
            isMarkdown ? (
              <MarkdownViewer content={content.text} />
            ) : (
              <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-4 font-mono text-[13px] leading-6">
                {content.text}
              </pre>
            )
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No extractable text in this document.
            </p>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const openId = searchParams.get('open');

  const { data: documents, loading, error, refresh, setData } = useApi<DocumentDTO[]>('/api/documents');
  const [dragActive, setDragActive] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<DocumentDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    let succeeded = 0;
    for (const file of list) {
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/documents', { method: 'POST', body: form });
        const body = (await res.json().catch(() => null)) as (DocumentDTO & { error?: string }) | null;
        if (!res.ok || !body) {
          throw new Error(body?.error ?? `Could not upload ${file.name}`);
        }
        succeeded += 1;
        setData((prev) => [body, ...(prev ?? [])]);
        if (body.status === 'failed') {
          toast({
            title: `“${body.title}” uploaded — extraction failed`,
            description: body.errorMessage ?? undefined,
            variant: 'error',
          });
        } else {
          toast({ title: `Imported “${body.title}”`, variant: 'success' });
        }
      } catch (err) {
        toast({
          title: `Could not import “${file.name}”`,
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        });
      }
    }
    setUploading(false);
    if (succeeded > 0) refresh();
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${confirmDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setData((prev) => (prev ?? []).filter((d) => d.id !== confirmDelete.id));
      toast({ title: 'Document deleted', variant: 'success' });
      if (openId === confirmDelete.id) router.replace('/documents');
    } catch {
      toast({ title: 'Could not delete the document', variant: 'error' });
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const retry = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('retry failed');
      const updated: DocumentDTO = await res.json();
      setData((prev) => (prev ?? []).map((d) => (d.id === id ? updated : d)));
      toast({
        title: updated.status === 'extracted' ? 'Extraction succeeded' : 'Extraction failed again',
        description: updated.errorMessage ?? undefined,
        variant: updated.status === 'extracted' ? 'success' : 'error',
      });
    } catch {
      toast({ title: 'Could not retry extraction', variant: 'error' });
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Import TXT, Markdown, and PDF files — text is extracted locally and stays on your machine.
        </p>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          void upload(e.dataTransfer.files);
        }}
        className={cn(
          'mb-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragActive ? 'border-primary bg-primary/5' : 'border-border bg-card/50',
        )}
      >
        {uploading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            Importing…
          </div>
        ) : (
          <>
            <Upload className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Drag & drop files here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              TXT · Markdown · PDF — up to 25 MB each
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
              className="hidden"
              aria-label="Choose documents to upload"
              onChange={(e) => {
                if (e.target.files) void upload(e.target.files);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Could not load documents"
          description={error}
          action={
            <Button variant="outline" onClick={refresh}>
              Try again
            </Button>
          }
        />
      ) : !documents || documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Import lecture notes, papers, or ebooks as TXT, Markdown, or PDF. Extraction runs locally."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border bg-card shadow-sm">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => router.push(`/documents?open=${doc.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-ring"
              >
                {doc.status === 'failed' ? (
                  <FileWarning className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
                ) : (
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{doc.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {doc.originalName} · {formatBytes(doc.sizeBytes)} ·{' '}
                    {formatRelativeTime(doc.createdAt)}
                  </span>
                </span>
              </button>

              {doc.status === 'extracted' ? (
                <Badge variant="success">extracted</Badge>
              ) : doc.status === 'failed' ? (
                <Badge variant="destructive">extraction failed</Badge>
              ) : (
                <Badge variant="secondary">processing</Badge>
              )}

              <div className="flex items-center gap-1">
                {doc.status === 'failed' ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Retry extraction"
                    onClick={() => void retry(doc.id)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${doc.title}`}
                  onClick={() => setConfirmDelete(doc)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReaderDialog
        documentId={openId}
        onClose={() => router.replace('/documents')}
        onRetry={(id) => void retry(id)}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete this document?"
        description={`“${confirmDelete?.title}” and its extracted text will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={remove}
      />
    </div>
  );
}

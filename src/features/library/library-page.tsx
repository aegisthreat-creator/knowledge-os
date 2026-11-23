'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileText,
  Folder,
  FolderPlus,
  Hash,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NotesBrowser } from '@/features/notes/notes-browser';
import { formatBytes, formatRelativeTime } from '@/lib/utils/format';
import type { CollectionDTO, DocumentDTO, TagDTO } from '@/types';

type TabKey = 'notes' | 'documents' | 'tags' | 'collections';

function CollectionsTab() {
  const { toast } = useToast();
  const { data: collections, loading, setData } = useApi<CollectionDTO[]>('/api/collections');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CollectionDTO | null>(null);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<CollectionDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setDialogOpen(true);
  };

  const openEdit = (collection: CollectionDTO) => {
    setEditing(collection);
    setName(collection.name);
    setDescription(collection.description ?? '');
    setDialogOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/collections/${editing.id}` : '/api/collections', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) throw new Error('save failed');
      const saved: CollectionDTO = await res.json();
      setData((prev) => {
        const list = prev ?? [];
        return editing
          ? list.map((c) => (c.id === saved.id ? { ...c, ...saved } : c))
          : [...list, saved];
      });
      toast({ title: editing ? 'Collection updated' : 'Collection created', variant: 'success' });
      setDialogOpen(false);
    } catch {
      toast({ title: 'Could not save the collection', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/collections/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setData((prev) => (prev ?? []).filter((c) => c.id !== deleteTarget.id));
      toast({ title: 'Collection deleted (notes are kept)', variant: 'success' });
    } catch {
      toast({ title: 'Could not delete the collection', variant: 'error' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) return <Skeleton className="h-40" />;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {collections?.length ?? 0} collection{(collections?.length ?? 0) === 1 ? '' : 's'} —
          optional groupings for notes, no folder hierarchy required.
        </p>
        <Button size="sm" onClick={openCreate}>
          <FolderPlus className="h-4 w-4" /> New collection
        </Button>
      </div>

      {!collections || collections.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="No collections yet"
          description="Collections group related notes without locking them into folders."
          action={
            <Button onClick={openCreate}>
              <FolderPlus className="h-4 w-4" /> New collection
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {collections.map((c) => (
            <li key={c.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{c.name}</h3>
                  {c.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Edit collection" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete collection"
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Badge variant="secondary" className="mt-3">
                {c.noteCount ?? 0} note{(c.noteCount ?? 0) === 1 ? '' : 's'}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit collection' : 'New collection'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="col-name">Name</Label>
              <Input
                id="col-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Research"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="col-desc">Description</Label>
              <Input
                id="col-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} disabled={!name.trim()} onClick={() => void save()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this collection?"
        description={`“${deleteTarget?.name}” will be removed. Notes stay in your library.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={remove}
      />
    </div>
  );
}

function TagsTab() {
  const router = useRouter();
  const { data: tags, loading, error, refresh } = useApi<TagDTO[]>('/api/tags');
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = React.useState<TagDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tags/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      toast({ title: 'Tag removed (notes are kept)', variant: 'success' });
      refresh();
    } catch {
      toast({ title: 'Could not delete the tag', variant: 'error' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) return <Skeleton className="h-32" />;
  if (error) {
    return (
      <EmptyState
        title="Could not load tags"
        description={error}
        action={
          <Button variant="outline" onClick={refresh}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        {tags?.length ?? 0} tag{(tags?.length ?? 0) === 1 ? '' : 's'} — click to search notes with
        that tag.
      </p>
      {!tags || tags.length === 0 ? (
        <EmptyState
          icon={Hash}
          title="No tags yet"
          description="Add tags while editing notes to connect ideas across your library."
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="group inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm shadow-sm"
            >
              <button
                type="button"
                onClick={() => router.push(`/search?q=${encodeURIComponent(tag.name)}`)}
                className="font-medium text-primary hover:underline focus-ring rounded"
              >
                {tag.name}
              </button>
              <span className="text-xs text-muted-foreground">{tag.noteCount ?? 0}</span>
              <button
                type="button"
                aria-label={`Delete tag ${tag.name}`}
                onClick={() => setDeleteTarget(tag)}
                className="hidden rounded-full p-0.5 text-muted-foreground hover:text-destructive group-hover:block focus:block focus-ring"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this tag?"
        description={`#${deleteTarget?.name} will be removed from all notes.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={remove}
      />
    </div>
  );
}

function DocumentsTab() {
  const router = useRouter();
  const { data: documents, loading, error, refresh } = useApi<DocumentDTO[]>('/api/documents');

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        title="Could not load documents"
        description={error}
        action={
          <Button variant="outline" onClick={refresh}>
            Try again
          </Button>
        }
      />
    );
  }
  if (!documents || documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents yet"
        description="Import TXT, Markdown, or PDF files from the Documents page."
        action={
          <Button onClick={() => router.push('/documents')}>
            <Plus className="h-4 w-4" /> Import documents
          </Button>
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border bg-card shadow-sm">
      {documents.map((doc) => (
        <li key={doc.id}>
          <button
            type="button"
            onClick={() => router.push(`/documents?open=${doc.id}`)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-ring rounded-lg"
          >
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{doc.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {doc.originalName} · {formatBytes(doc.sizeBytes)} ·{' '}
                {formatRelativeTime(doc.createdAt)}
              </span>
            </span>
            {doc.status === 'extracted' ? (
              <Badge variant="success">ready</Badge>
            ) : doc.status === 'failed' ? (
              <Badge variant="destructive">failed</Badge>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function LibraryPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey | null) ?? 'notes';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Library</h1>
        <p className="text-sm text-muted-foreground">
          Everything you know in one place — notes, documents, tags, and collections.
        </p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-4">
          <div className="-mx-4 sm:-mx-6 lg:-mx-8">
            <NotesBrowser showHeader={false} />
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab />
        </TabsContent>

        <TabsContent value="tags" className="mt-4">
          <TagsTab />
        </TabsContent>

        <TabsContent value="collections" className="mt-4">
          <CollectionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

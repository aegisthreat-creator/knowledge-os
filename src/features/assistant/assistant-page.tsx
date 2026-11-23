'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bot,
  MessagesSquare,
  Plus,
  RefreshCw,
  Send,
  Square,
  Trash2,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useAiStatus } from '@/hooks/use-ai-status';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MarkdownViewer } from '@/components/markdown/markdown-viewer';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/format';
import type { ConversationDTO, MessageDTO } from '@/types';

interface ChatEvent {
  type: 'token' | 'done' | 'error';
  token?: string;
  conversationId?: string;
  title?: string;
  message?: string;
}

const STARTERS = [
  'Explain spaced repetition like I have 10 minutes.',
  'Summarize the key ideas in my notes about the brain.',
  'Give me 5 practice questions on photosynthesis.',
  'Help me brainstorm a study plan for next week.',
];

export function AssistantPage() {
  const router = useRouter();
  const { toast } = useToast();
  const aiStatus = useAiStatus();

  const { data: conversations, refresh: refreshConversations } = useApi<ConversationDTO[]>(
    '/api/ai/conversations',
  );

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<MessageDTO[]>([]);
  const [input, setInput] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const [streamError, setStreamError] = React.useState<string | null>(null);
  const [model, setModel] = React.useState('');
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const abortRef = React.useRef<AbortController | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Default model: saved setting → first installed.
  React.useEffect(() => {
    if (model) return;
    if (aiStatus.connected) {
      const preferred =
        (conversations ?? []).find((c) => c.model)?.model ??
        aiStatus.models[0];
      if (preferred) setModel(preferred);
    }
  }, [aiStatus, conversations, model]);

  // Load messages for the active conversation.
  React.useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    (async () => {
      try {
        const res = await fetch(`/api/ai/conversations/${activeId}`);
        if (!res.ok) throw new Error('load failed');
        const data: { messages: MessageDTO[] } = await res.json();
        if (!cancelled) setMessages(data.messages);
      } catch {
        if (!cancelled) toast({ title: 'Could not load the conversation', variant: 'error' });
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, toast]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streaming]);

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;
    if (!aiStatus.connected) {
      toast({
        title: 'Ollama is not connected',
        description: 'Open Settings to check your Ollama URL, then try again.',
        variant: 'error',
      });
      return;
    }
    if (!model) {
      toast({ title: 'Choose a model first', variant: 'error' });
      return;
    }

    const userMessage: MessageDTO = {
      id: `local-${Date.now()}`,
      conversationId: activeId ?? 'new',
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `local-${Date.now() + 1}`;
    const assistantMessage: MessageDTO = {
      id: assistantId,
      conversationId: userMessage.conversationId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setStreaming(true);
    setStreamError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeId, message: content, model }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      if (!res.body) throw new Error('Empty response from the server.');

      const conversationHeader = res.headers.get('x-conversation-id');
      if (conversationHeader && !activeId) {
        setActiveId(conversationHeader);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let finalConversationId = conversationHeader;
      let finalTitle: string | null = null;
      let errorMessage: string | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: ChatEvent;
          try {
            event = JSON.parse(line) as ChatEvent;
          } catch {
            continue;
          }
          if (event.type === 'token' && event.token) {
            fullText += event.token;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m)),
            );
          } else if (event.type === 'done') {
            finalConversationId = event.conversationId ?? finalConversationId;
            finalTitle = event.title ?? null;
          } else if (event.type === 'error') {
            errorMessage = event.message ?? 'Generation failed.';
          }
        }
      }

      if (errorMessage) {
        setStreamError(errorMessage);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: fullText || `⚠ ${errorMessage}` }
              : m,
          ),
        );
      } else if (!fullText.trim()) {
        // Drop the empty assistant placeholder.
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }

      if (finalConversationId && !activeId) {
        // Conversation was created server-side; mark local messages with the real id.
        setMessages((prev) =>
          prev.map((m) =>
            m.conversationId === 'new' ? { ...m, conversationId: finalConversationId! } : m,
          ),
        );
      }
      if (finalTitle || finalConversationId) {
        refreshConversations();
      }
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      if (aborted) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.content ? { ...m, content: '_(stopped)_' } : m,
          ),
        );
      } else {
        const message = err instanceof Error ? err.message : 'The request failed.';
        setStreamError(message);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: '' } : m)),
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  const startNew = () => {
    setActiveId(null);
    setMessages([]);
    setStreamError(null);
    setInput('');
  };

  const clearConversation = async () => {
    if (!activeId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/ai/conversations/${activeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      toast({ title: 'Conversation cleared', variant: 'success' });
      startNew();
      refreshConversations();
    } catch {
      toast({ title: 'Could not clear the conversation', variant: 'error' });
    } finally {
      setDeleting(false);
      setConfirmClear(false);
    }
  };

  const deleteConversation = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      if (activeId === id) startNew();
      refreshConversations();
      toast({ title: 'Conversation deleted', variant: 'success' });
    } catch {
      toast({ title: 'Could not delete the conversation', variant: 'error' });
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const canRetry =
    Boolean(streamError) && !streaming && lastMessage?.role === 'assistant';

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Conversation list */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
          <span className="text-sm font-semibold">Conversations</span>
          <Button variant="ghost" size="icon-sm" onClick={startNew} aria-label="New conversation">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {!conversations || conversations.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">No conversations yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((c) => (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      'w-full rounded-md px-2.5 py-2 pr-8 text-left text-sm transition-colors focus-ring',
                      activeId === c.id
                        ? 'bg-sidebar-accent font-medium'
                        : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                    )}
                  >
                    <span className="block truncate">{c.title}</span>
                    <span className="block text-[11px] opacity-70">
                      {formatRelativeTime(c.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(c.id)}
                    aria-label={`Delete ${c.title}`}
                    className="absolute right-1.5 top-1.5 hidden rounded p-1 text-muted-foreground hover:text-destructive group-hover:block focus:block focus-ring"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" aria-hidden />
            <h1 className="text-sm font-semibold">Assistant</h1>
            <Badge variant={aiStatus.connected ? 'success' : 'destructive'}>
              {aiStatus.loading ? 'checking…' : aiStatus.connected ? 'Ollama connected' : 'offline'}
            </Badge>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <NativeSelect
              value={model}
              onChange={(e) => setModel(e.target.value)}
              aria-label="Model"
              className="w-52"
              disabled={!aiStatus.connected}
            >
              {!aiStatus.connected ? <option value="">No models available</option> : null}
              {aiStatus.connected && aiStatus.models.length === 0 ? (
                <option value="">No models installed</option>
              ) : null}
              {aiStatus.models.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NativeSelect>
            {activeId ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear conversation"
                  onClick={() => setConfirmClear(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="New conversation"
                  onClick={startNew}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {!aiStatus.loading && !aiStatus.connected ? (
              <div className="rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
                <p className="font-medium">Ollama isn’t reachable</p>
                <p className="mt-1 text-muted-foreground">
                  {aiStatus.error ?? 'The local AI service is offline.'}
                </p>
                <p className="mt-2 text-muted-foreground">{aiStatus.hint}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>
                    Open Settings
                  </Button>
                </div>
              </div>
            ) : null}

            {messages.length === 0 && !loadingMessages ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Bot className="h-6 w-6 text-primary" aria-hidden />
                </div>
                <h2 className="mt-4 text-base font-semibold">Chat with your local AI</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Conversations stay on this machine. Pick a model and ask anything.
                </p>
                <div className="mt-6 grid w-full max-w-lg gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void sendMessage(s)}
                      className="rounded-lg border bg-card px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-ring"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {loadingMessages ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Spinner /> Loading conversation…
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-xl px-4 py-3 text-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'border bg-card shadow-sm',
                  )}
                >
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  ) : message.content ? (
                    <MarkdownViewer content={message.content} />
                  ) : streaming && message.id === lastMessage?.id ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Spinner className="h-3.5 w-3.5" /> Thinking…
                    </span>
                  ) : null}
                </div>
              </div>
            ))}

            {streamError ? (
              <div className="mx-auto flex max-w-xl items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                <div className="flex-1">
                  <p className="font-medium text-destructive">Something went wrong</p>
                  <p className="mt-0.5 text-muted-foreground">{streamError}</p>
                </div>
                {canRetry ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                      setMessages((prev) => {
                        const idx = prev.findIndex((m) => m.id === lastMessage?.id);
                        return idx >= 0 ? prev.slice(0, idx) : prev;
                      });
                      if (lastUser) void sendMessage(lastUser.content);
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="border-t px-4 py-3">
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
            <div className="relative flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(input);
                  }
                }}
                rows={Math.min(5, Math.max(1, Math.ceil(input.length / 60)))}
                placeholder={
                  aiStatus.connected
                    ? 'Ask anything — Enter to send, Shift+Enter for a new line'
                    : 'Connect Ollama to start chatting'
                }
                aria-label="Message"
                disabled={streaming}
                className="max-h-40 w-full resize-none rounded-lg border bg-card px-3.5 py-2.5 text-sm shadow-sm focus-ring disabled:opacity-60"
              />
            </div>
            {streaming ? (
              <Button variant="outline" size="icon" onClick={stopGeneration} aria-label="Stop generating">
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={() => void sendMessage(input)}
                disabled={!input.trim() || !aiStatus.connected}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-[11px] text-muted-foreground">
            Runs locally via Ollama — your conversations never leave this machine.{' '}
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => router.push('/settings')}
            >
              Settings
            </button>
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear this conversation?"
        description="All messages in this conversation will be deleted."
        confirmLabel="Clear"
        destructive
        loading={deleting}
        onConfirm={clearConversation}
      />
      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title="Delete this conversation?"
        description="The conversation and all of its messages will be permanently deleted."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={async () => {
          if (confirmDeleteId) await deleteConversation(confirmDeleteId);
        }}
      />

      {/* Mobile conversation switcher (list is hidden below lg) */}
      {(conversations ?? []).length > 1 ? (
        <div className="fixed bottom-24 right-4 z-30 lg:hidden">
          <Button
            variant="outline"
            size="sm"
            className="shadow-lg"
            onClick={() => {
              const list = conversations ?? [];
              const idx = activeId ? list.findIndex((c) => c.id === activeId) : -1;
              const next = list[(idx + 1) % list.length];
              setActiveId(next.id);
            }}
            aria-label="Switch to next conversation"
          >
            <MessagesSquare className="h-4 w-4" />
            Next conversation
          </Button>
        </div>
      ) : null}
    </div>
  );
}

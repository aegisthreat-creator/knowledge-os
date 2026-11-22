'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bot, Database, Info, Palette, Plug } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useAiStatus } from '@/hooks/use-ai-status';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/layout/theme-toggle';

const ollamaFormSchema = z.object({
  ollamaBaseUrl: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), {
      message: 'Enter a valid http(s) URL, e.g. http://127.0.0.1:11434',
    }),
  defaultModel: z.string().optional(),
});
type OllamaForm = z.infer<typeof ollamaFormSchema>;

interface SettingsPayload {
  settings: Record<string, unknown>;
  defaults: { ollamaBaseUrl: string; databasePath: string };
  env: { ollamaBaseUrl: string | null };
}

export function SettingsPage() {
  const { toast } = useToast();
  const aiStatus = useAiStatus();
  const { data, refresh } = useApi<SettingsPayload>('/api/settings');
  const [testing, setTesting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<OllamaForm>({
    resolver: zodResolver(ollamaFormSchema),
    defaultValues: { ollamaBaseUrl: '', defaultModel: '' },
  });

  // Populate the form once settings arrive.
  React.useEffect(() => {
    if (!data) return;
    reset({
      ollamaBaseUrl:
        (data.settings['ai.ollamaBaseUrl'] as string | null) ?? data.defaults.ollamaBaseUrl,
      defaultModel: (data.settings['ai.defaultModel'] as string | null) ?? '',
    });
  }, [data, reset]);

  const watchedModel = watch('defaultModel');

  const onSubmit = async (values: OllamaForm) => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ollamaBaseUrl: values.ollamaBaseUrl.trim(),
          defaultModel: values.defaultModel || null,
        }),
      });
      if (!res.ok) throw new Error('save failed');
      toast({ title: 'Settings saved', variant: 'success' });
      refresh();
    } catch {
      toast({ title: 'Could not save settings', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      // Persist the URL being tested first so the status check uses it.
      const url = watch('ollamaBaseUrl').trim();
      if (url) {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ollamaBaseUrl: url }),
        });
      }
      const res = await fetch('/api/ai/status');
      const status: {
        connected: boolean;
        models: { name: string }[];
        error: string | null;
        hint: string | null;
        baseUrl: string;
      } = await res.json();
      if (status.connected) {
        toast({
          title: `Connected to ${status.baseUrl}`,
          description: `${status.models.length} model${status.models.length === 1 ? '' : 's'} installed`,
          variant: 'success',
        });
        refresh();
      } else {
        toast({
          title: status.error ?? 'Connection failed',
          description: status.hint ?? undefined,
          variant: 'error',
        });
      }
    } catch {
      toast({ title: 'Connection test failed', variant: 'error' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Everything here stays on this machine — no accounts, no telemetry.
        </p>
      </div>

      {/* AI / Ollama */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" aria-hidden /> Local AI (Ollama)
          </CardTitle>
          <CardDescription>
            KnowledgeOS talks directly to your Ollama instance. No cloud API keys, ever.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={aiStatus.connected ? 'success' : 'destructive'}>
              {aiStatus.loading ? (
                <span className="flex items-center gap-1">
                  <Spinner className="h-3 w-3" /> checking…
                </span>
              ) : aiStatus.connected ? (
                'Connected'
              ) : (
                'Offline'
              )}
            </Badge>
            {aiStatus.connected ? (
              <span className="text-muted-foreground">
                {aiStatus.models.length} model{aiStatus.models.length === 1 ? '' : 's'} installed
              </span>
            ) : (
              <span className="text-muted-foreground">{aiStatus.error}</span>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ollama-url">Ollama base URL</Label>
              <div className="flex gap-2">
                <Input
                  id="ollama-url"
                  placeholder="http://127.0.0.1:11434"
                  {...register('ollamaBaseUrl')}
                />
                <Button
                  type="button"
                  variant="outline"
                  loading={testing}
                  onClick={() => void testConnection()}
                >
                  <Plug className="h-4 w-4" /> Test
                </Button>
              </div>
              {errors.ollamaBaseUrl ? (
                <p className="text-xs text-destructive">{errors.ollamaBaseUrl.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Default:{' '}
                  <code className="rounded bg-muted px-1">
                    {data?.env.ollamaBaseUrl ?? data?.defaults.ollamaBaseUrl ?? 'http://127.0.0.1:11434'}
                  </code>{' '}
                  — start Ollama with <code className="rounded bg-muted px-1">ollama serve</code>.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="default-model">Default model</Label>
              <NativeSelect id="default-model" {...register('defaultModel')}>
                <option value="">Auto (first installed model)</option>
                {aiStatus.models.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </NativeSelect>
              {!aiStatus.connected ? (
                <p className="text-xs text-muted-foreground">
                  {aiStatus.hint ?? 'Connect to Ollama to choose a model.'}
                </p>
              ) : watchedModel ? (
                <p className="text-xs text-muted-foreground">Using “{watchedModel}” by default.</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={!isDirty}
                onClick={() =>
                  reset({
                    ollamaBaseUrl:
                      (data?.settings['ai.ollamaBaseUrl'] as string | null) ??
                      data?.defaults.ollamaBaseUrl ??
                      '',
                    defaultModel: (data?.settings['ai.defaultModel'] as string | null) ?? '',
                  })
                }
              >
                Reset
              </Button>
              <Button type="submit" loading={saving} disabled={!isDirty && !saving}>
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" aria-hidden /> Appearance
          </CardTitle>
          <CardDescription>
            Light and dark mode. Your choice is remembered on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground">Toggle between light and dark.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Switch theme</span>
            <ThemeToggle className="h-9 w-9 border" />
          </div>
        </CardContent>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" aria-hidden /> Data & privacy
          </CardTitle>
          <CardDescription>Where your knowledge lives and how it’s protected.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Database</span>
            <code className="truncate text-xs">{data?.defaults.databasePath ?? 'data/knowledge.db'}</code>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Documents</span>
            <code className="text-xs">data/uploads/</code>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">AI requests</span>
            <span className="text-right text-xs">Sent only to your local Ollama URL above</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Telemetry</span>
            <span className="text-xs">None — the app makes no external requests</span>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" aria-hidden /> About
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">KnowledgeOS</span> v0.1.0 — your
            knowledge, your machine, your AI.
          </p>
          <p className="mt-1">
            Local-first knowledge management: notes, documents, flashcards, a knowledge graph, and
            an AI assistant powered by Ollama.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

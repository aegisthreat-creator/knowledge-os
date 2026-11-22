import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { checkOllama, streamChat, chatComplete, friendlyHttpError } from './client';

let server: http.Server;
let baseUrl: string;
let lastChatBody: unknown = null;
let mode: 'ok' | 'missing-model' | 'broken' = 'ok';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/tags') {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          models: [{ name: 'test-model', size: 123, details: { family: 'test' } }],
        }),
      );
      return;
    }
    if (req.method === 'POST' && req.url === '/api/chat') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        lastChatBody = JSON.parse(raw);
        const body = lastChatBody as { stream?: boolean; messages: { role: string; content: string }[] };
        if (mode === 'missing-model') {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'model "nope" not found' }));
          return;
        }
        if (mode === 'broken') {
          res.statusCode = 500;
          res.end('internal failure');
          return;
        }
        if (body.stream === false) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ message: { role: 'assistant', content: 'complete answer' }, done: true }));
          return;
        }
        res.setHeader('Content-Type', 'application/x-ndjson');
        for (const token of ['Hello', ' world']) {
          res.write(JSON.stringify({ message: { role: 'assistant', content: token }, done: false }) + '\n');
        }
        res.write(JSON.stringify({ message: { role: 'assistant', content: '' }, done: true }) + '\n');
        res.end();
      });
      return;
    }
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('checkOllama', () => {
  it('reports connected with installed models', async () => {
    const status = await checkOllama(baseUrl);
    expect(status.ok).toBe(true);
    expect(status.models.map((m) => m.name)).toEqual(['test-model']);
    expect(status.error).toBeUndefined();
  });

  it('returns a friendly error with a hint when unreachable', async () => {
    const status = await checkOllama('http://127.0.0.1:1');
    expect(status.ok).toBe(false);
    expect(status.error).toContain("Can't reach Ollama");
    expect(status.hint).toContain('ollama serve');
  });
});

describe('streamChat', () => {
  it('streams tokens and returns the full text', async () => {
    let received = '';
    const full = await streamChat({
      baseUrl,
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      onToken: (t) => {
        received += t;
      },
    });
    expect(received).toBe('Hello world');
    expect(full).toBe('Hello world');
    expect((lastChatBody as { stream: boolean }).stream).toBe(true);
  });

  it('maps model-not-found errors to an actionable message', async () => {
    mode = 'missing-model';
    await expect(
      streamChat({
        baseUrl,
        model: 'nope',
        messages: [{ role: 'user', content: 'hi' }],
        onToken: () => undefined,
      }),
    ).rejects.toThrow(/ollama pull nope/);
    mode = 'ok';
  });

  it('fails friendly when the server is unreachable', async () => {
    await expect(
      streamChat({
        baseUrl: 'http://127.0.0.1:1',
        model: 'x',
        messages: [{ role: 'user', content: 'hi' }],
        onToken: () => undefined,
      }),
    ).rejects.toThrow(/Can't reach Ollama/);
  });
});

describe('chatComplete', () => {
  it('returns the assistant text for non-streaming calls', async () => {
    const text = await chatComplete({
      baseUrl,
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(text).toBe('complete answer');
    expect((lastChatBody as { stream: boolean }).stream).toBe(false);
  });

  it('maps HTTP errors to friendly messages', async () => {
    mode = 'missing-model';
    await expect(
      chatComplete({ baseUrl, model: 'nope', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toThrow(/not found|pull/i);
    mode = 'ok';
  });
});

describe('friendlyHttpError', () => {
  it('suggests ollama pull for missing models', () => {
    expect(friendlyHttpError(404, '{"error":"model not found"}', 'mistral')).toContain(
      'ollama pull mistral',
    );
  });

  it('passes through other Ollama errors', () => {
    expect(friendlyHttpError(500, '{"error":"boom"}', 'm')).toContain('boom');
  });
});

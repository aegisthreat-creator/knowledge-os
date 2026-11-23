import { NextResponse } from 'next/server';
import { z, type ZodError } from 'zod';

/** JSON error response used by all route handlers. */
export function apiError(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function zodError(err: ZodError): NextResponse {
  const first = err.issues[0];
  const message = first ? `${first.path.join('.') || 'value'}: ${first.message}` : 'Invalid input';
  return apiError(message, 400, { issues: err.issues });
}

/** Parse a JSON body, returning [value, null] or [null, errorResponse]. */
export async function parseJson<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<[T | null, NextResponse | null]> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return [null, apiError('Invalid JSON body', 400)];
  }
  const result = schema.safeParse(body);
  if (!result.success) return [null, zodError(result.error)];
  return [result.data, null];
}

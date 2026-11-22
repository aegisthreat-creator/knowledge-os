import fs from 'node:fs';
import path from 'node:path';

/**
 * Upload storage — files live under UPLOAD_DIR (default data/uploads) with
 * server-generated names. User-supplied names are never used as paths, and
 * every resolved path is verified to stay inside the storage root.
 */

export const ALLOWED_EXTENSIONS = ['.txt', '.md', '.markdown', '.pdf'] as const;

export const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/pdf',
  'application/octet-stream', // browsers sometimes omit a precise type
]);

export function getUploadDir(): string {
  const configured = process.env.UPLOAD_DIR ?? 'data/uploads';
  const resolved = path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

export function getExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function isAllowedFile(filename: string): boolean {
  const ext = getExtension(filename);
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Resolve a stored filename to an absolute path, guaranteeing the result is
 * inside the upload directory (prevents path traversal).
 */
export function resolveStoredPath(storageName: string): string | null {
  if (storageName.includes('/') || storageName.includes('\\') || storageName.includes('..')) {
    return null;
  }
  const root = getUploadDir();
  const resolved = path.resolve(root, storageName);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) return null;
  return resolved;
}

export function removeStoredFile(storageName: string): void {
  const resolved = resolveStoredPath(storageName);
  if (!resolved) return;
  try {
    fs.unlinkSync(resolved);
  } catch {
    // Already gone — nothing to do.
  }
}

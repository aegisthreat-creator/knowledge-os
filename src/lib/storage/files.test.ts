import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isAllowedFile,
  resolveStoredPath,
  getExtension,
  ALLOWED_EXTENSIONS,
} from './files';

const tmpRoot = path.join(os.tmpdir(), `kos-files-test-${process.pid}`);
const originalUploadDir = process.env.UPLOAD_DIR;

process.env.UPLOAD_DIR = tmpRoot;

afterAll(() => {
  if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = originalUploadDir;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('file validation', () => {
  it('allows only txt/md/pdf', () => {
    expect(isAllowedFile('notes.txt')).toBe(true);
    expect(isAllowedFile('readme.MD')).toBe(true);
    expect(isAllowedFile('paper.markdown')).toBe(true);
    expect(isAllowedFile('paper.pdf')).toBe(true);
    expect(isAllowedFile('malware.exe')).toBe(false);
    expect(isAllowedFile('image.png')).toBe(false);
    expect(isAllowedFile('archive.zip')).toBe(false);
    expect(ALLOWED_EXTENSIONS).toContain('.pdf');
  });

  it('extracts lowercase extensions', () => {
    expect(getExtension('FILE.PDF')).toBe('.pdf');
    expect(getExtension('noext')).toBe('');
  });
});

describe('resolveStoredPath', () => {
  it('resolves a plain filename inside the upload dir', () => {
    const resolved = resolveStoredPath('abc123.pdf');
    expect(resolved).toBeTruthy();
    expect(resolved!.startsWith(fs.realpathSync(tmpRoot)) || resolved!.includes('kos-files-test')).toBe(true);
  });

  it('rejects path traversal attempts', () => {
    expect(resolveStoredPath('../secret.txt')).toBeNull();
    expect(resolveStoredPath('../../etc/passwd')).toBeNull();
    expect(resolveStoredPath('a/../../b')).toBeNull();
    expect(resolveStoredPath('sub/file.txt')).toBeNull();
    expect(resolveStoredPath('..\\windows\\system32')).toBeNull();
  });
});

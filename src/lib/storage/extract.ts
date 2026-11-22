import fs from 'node:fs/promises';
import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Text extraction for supported document formats.
 * Returns a discriminated result — callers must surface failures honestly
 * (no pretending a file was processed when extraction failed).
 */

export type ExtractionResult =
  | { ok: true; text: string; pageCount: number | null }
  | { ok: false; error: string };

const MAX_TEXT_LENGTH = 2_000_000; // cap stored extracted text (~2 MB)

function limitText(text: string): string {
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (trimmed.length <= MAX_TEXT_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_TEXT_LENGTH)}\n\n[Extracted text truncated at ${MAX_TEXT_LENGTH} characters]`;
}

export async function extractPdf(absPath: string): Promise<ExtractionResult> {
  try {
    const buffer = await fs.readFile(absPath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const limited = limitText(text ?? '');
    if (!limited) {
      return {
        ok: false,
        error:
          'No selectable text found — the PDF may be a scan. OCR is not supported yet.',
      };
    }
    return { ok: true, text: limited, pageCount: totalPages ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not read PDF: ${message.slice(0, 300)}` };
  }
}

export async function extractPlainText(absPath: string): Promise<ExtractionResult> {
  try {
    const buffer = await fs.readFile(absPath);
    const text = limitText(buffer.toString('utf8').replace(/^\uFEFF/, ''));
    if (!text) return { ok: false, error: 'The file is empty.' };
    return { ok: true, text, pageCount: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not read file: ${message.slice(0, 300)}` };
  }
}

export async function extractDocument(
  absPath: string,
  filename: string,
): Promise<ExtractionResult> {
  const ext = filename.toLowerCase().endsWith('.md')
    ? '.md'
    : filename.toLowerCase().endsWith('.markdown')
      ? '.markdown'
      : filename.toLowerCase().endsWith('.pdf')
        ? '.pdf'
        : '.txt';
  if (ext === '.pdf') return extractPdf(absPath);
  return extractPlainText(absPath);
}

/**
 * Turns raw user input into a safe FTS5 MATCH expression.
 *
 * FTS5 has its own query syntax (AND/OR/NOT, column filters, quoting); rather
 * than escaping it wholesale we reduce the input to alphanumeric tokens and
 * match each as a prefix, which is both injection-proof and what users expect
 * from incremental search ("kn" matches "knowledge").
 */
export function buildFtsQuery(raw: string): string | null {
  const tokens = tokenize(raw);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(' AND ');
}

/** Extract plain word tokens (letters + numbers, any script). */
export function tokenize(raw: string): string[] {
  const matches = raw.match(/[\p{L}\p{N}]+/gu);
  if (!matches) return [];
  // Deduplicate, keep order, cap length to keep queries cheap.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of matches) {
    const t = token.slice(0, 40);
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

/** Which terms actually appear in a result (for client-side highlighting). */
export function matchedTerms(raw: string): string[] {
  return tokenize(raw);
}

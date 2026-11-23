import { describe, it, expect } from 'vitest';
import { excerpt, formatBytes, formatRelativeTime, toPlainText, truncate } from './format';

describe('toPlainText', () => {
  it('strips markdown syntax', () => {
    const md = '# Title\n\nSome **bold** and *italic* with [a link](https://x.com).\n\n- item one\n- item two';
    const plain = toPlainText(md);
    expect(plain).not.toContain('#');
    expect(plain).not.toContain('**');
    expect(plain).toContain('bold');
    expect(plain).toContain('a link');
    expect(plain).toContain('• item one');
  });

  it('removes code blocks and images', () => {
    const md = 'Before ```code here``` after ![img](pic.png)';
    const plain = toPlainText(md);
    expect(plain).not.toContain('code here');
    expect(plain).not.toContain('pic.png');
    expect(plain).toContain('Before');
    expect(plain).toContain('after');
  });

  it('keeps wikilink text', () => {
    expect(toPlainText('See [[My Note]] for more.')).toContain('My Note');
  });
});

describe('excerpt', () => {
  it('truncates long text with an ellipsis', () => {
    const long = 'word '.repeat(100);
    const result = excerpt(long, 50);
    expect(result.length).toBeLessThanOrEqual(51);
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns short text unchanged', () => {
    expect(excerpt('short text', 100)).toBe('short text');
  });
});

describe('formatBytes', () => {
  it('formats common sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('formatRelativeTime', () => {
  it('describes recent times', () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 1000))).toBe('just now');
    expect(formatRelativeTime(new Date(now - 60_000))).toBe('1m ago');
    expect(formatRelativeTime(new Date(now - 3_600_000))).toBe('1h ago');
  });

  it('falls back to a date for older timestamps', () => {
    const old = new Date('2020-05-05T10:00:00Z');
    expect(formatRelativeTime(old)).toMatch(/2020/);
  });
});

describe('truncate', () => {
  it('cuts at the limit', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcde…');
    expect(truncate('abc', 10)).toBe('abc');
  });
});

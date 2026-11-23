import { describe, it, expect } from 'vitest';
import { buildFtsQuery, tokenize } from './query';

describe('tokenize', () => {
  it('extracts word tokens', () => {
    expect(tokenize('hello world 123')).toEqual(['hello', 'world', '123']);
  });

  it('supports unicode letters', () => {
    expect(tokenize('café naïve')).toEqual(['café', 'naïve']);
  });

  it('deduplicates case-insensitively, keeping the first casing', () => {
    expect(tokenize('Cell cell CELL')).toEqual(['Cell']);
  });

  it('returns empty for punctuation-only input', () => {
    expect(tokenize('!!! --- ???')).toEqual([]);
  });
});

describe('buildFtsQuery', () => {
  it('builds prefix-AND queries', () => {
    expect(buildFtsQuery('knowledge os')).toBe('"knowledge"* AND "os"*');
  });

  it('returns null when there is nothing to match', () => {
    expect(buildFtsQuery('   ')).toBeNull();
    expect(buildFtsQuery('---')).toBeNull();
  });

  it('never leaks FTS operators from user input', () => {
    // Raw operators are tokenized away — quotes/AND/OR cannot break out.
    const query = buildFtsQuery('" OR notes MATCH * NEAR(a b)');
    expect(query).toBe('"OR"* AND "notes"* AND "MATCH"* AND "NEAR"* AND "a"* AND "b"*');
    expect(query).not.toContain(' OR "');
  });

  it('caps the number of tokens', () => {
    const many = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');
    const query = buildFtsQuery(many);
    expect(query?.split(' AND ').length).toBeLessThanOrEqual(12);
  });
});

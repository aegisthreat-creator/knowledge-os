import { describe, it, expect } from 'vitest';
import { remarkWikiLinks } from './wiki-links';

interface Node {
  type: string;
  value?: string;
  url?: string;
  children?: Node[];
  __replacement?: Node[];
}

function run(value: string, resolver: (t: string) => string | null): Node {
  const tree: Node = {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value }] }],
  };
  remarkWikiLinks(resolver)(tree);
  return tree.children![0];
}

describe('remarkWikiLinks', () => {
  it('converts resolved wikilinks into kos-wiki links', () => {
    const para = run('See [[Other Note]] here', (t) => (t === 'Other Note' ? 'abc123' : null));
    const kids = para.children!;
    expect(kids[0].value).toBe('See ');
    expect(kids[1].type).toBe('link');
    expect(kids[1].url).toBe('kos-wiki:abc123');
    expect(kids[1].children![0].value).toBe('Other Note');
    expect(kids[2].value).toBe(' here');
  });

  it('marks unresolved wikilinks', () => {
    const para = run('[[Missing]]', () => null);
    expect(para.children![0].url).toBe('kos-unresolved:');
  });

  it('supports display labels', () => {
    const para = run('[[Target|Custom label]]', () => 'id1');
    expect(para.children![0].children![0].value).toBe('Custom label');
    expect(para.children![0].url).toBe('kos-wiki:id1');
  });

  it('resolves case-insensitively when the resolver does', () => {
    const resolver = (t: string) => (t.toLowerCase() === 'my note' ? 'n1' : null);
    const para = run('link [[MY NOTE]]', resolver);
    expect(para.children![1].url).toBe('kos-wiki:n1');
  });

  it('handles multiple links in one text node', () => {
    const para = run('[[A]] and [[B]]', (t) => (t === 'A' ? '1' : t === 'B' ? '2' : null));
    const links = para.children!.filter((c) => c.type === 'link');
    expect(links).toHaveLength(2);
    expect(links[0].url).toBe('kos-wiki:1');
    expect(links[1].url).toBe('kos-wiki:2');
  });

  it('leaves inline code untouched', () => {
    const tree: Node = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'inlineCode', value: '[[Not a link]]' }],
        },
      ],
    };
    remarkWikiLinks(() => 'x')(tree);
    const child = tree.children![0].children![0];
    expect(child.type).toBe('inlineCode');
    expect(child.url).toBeUndefined();
  });
});

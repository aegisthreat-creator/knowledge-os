/**
 * Remark plugin: converts [[Wiki Links]] into link nodes with custom URLs.
 *
 *  [[Target]]        → link  href="kos-wiki:<resolvedId>"   (resolved)
 *  [[Target]]        → link  href="kos-unresolved:"         (no match yet)
 *  [[Target|Label]]  → link with display text "Label"
 *
 * The markdown viewer maps these URLs to internal navigation or plain spans.
 * Implemented as a source-level mdast walk so no extra dependencies are needed
 * (and code blocks/inline code are left untouched).
 */

interface MdastNode {
  type: string;
  value?: string;
  url?: string;
  title?: string | null;
  children?: MdastNode[];
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;

function walk(node: MdastNode, resolve: (title: string) => string | null): void {
  if (node.type === 'inlineCode' || node.type === 'code') return;

  if (node.type === 'text' && node.value && node.value.includes('[[')) {
    const parts: MdastNode[] = [];
    let lastIndex = 0;
    WIKILINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WIKILINK_RE.exec(node.value)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: node.value.slice(lastIndex, match.index) });
      }
      const target = match[1].trim();
      const label = (match[2] ?? match[1]).trim();
      const id = resolve(target);
      parts.push({
        type: 'link',
        url: id ? `kos-wiki:${id}` : 'kos-unresolved:',
        children: [{ type: 'text', value: label }],
      });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < node.value.length) {
      parts.push({ type: 'text', value: node.value.slice(lastIndex) });
    }

    // Splice the replacement nodes into the parent's children.
    // The parent performs this walk; we signal via a marker on the node.
    (node as MdastNode & { __replacement?: MdastNode[] }).__replacement = parts;
    return;
  }

  if (node.children) {
    for (const child of node.children) walk(child, resolve);
    // Apply replacements bottom-up.
    const nextChildren: MdastNode[] = [];
    for (const child of node.children) {
      const replacement = (child as MdastNode & { __replacement?: MdastNode[] }).__replacement;
      if (replacement) nextChildren.push(...replacement);
      else nextChildren.push(child);
    }
    node.children = nextChildren;
  }
}

export type WikiLinkResolver = (title: string) => string | null;

export function remarkWikiLinks(resolve: WikiLinkResolver) {
  return (tree: unknown) => {
    walk(tree as MdastNode, resolve);
  };
}

/** Extensible search contracts — FTS5 today, semantic/embeddings tomorrow. */

export interface SearchHit {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
  /** Substrings of the query to highlight in the UI. */
  highlights: string[];
  score: number;
}

export interface DocumentSearchHit {
  id: string;
  title: string;
  name: string;
  excerpt: string;
  updatedAt: string;
  highlights: string[];
  score: number;
}

export interface TagSearchHit {
  id: string;
  name: string;
  count: number;
}

export interface SearchResponse {
  query: string;
  notes: SearchHit[];
  documents: DocumentSearchHit[];
  tags: TagSearchHit[];
}

export type SearchScope = 'all' | 'notes' | 'documents' | 'tags';

export interface SearchProvider {
  readonly id: string;
  search(params: { query: string; limit?: number; scope?: SearchScope }): Promise<SearchResponse>;
}

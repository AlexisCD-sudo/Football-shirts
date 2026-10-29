import type { ImageSource } from '../../types/shirt';

/** Candidata tal com la retorna una font, abans de desar-la. */
export interface ImageCandidate {
  imageUrl: string;
  thumbnailUrl: string | null;
  sourcePageUrl: string;
  source: ImageSource;
  title: string;
  author: string | null;
  license: string | null;
  licenseUrl: string | null;
  width: number | null;
  height: number | null;
  /** Text addicional (descripció, categories) que només s'usa per puntuar. */
  extraText?: string;
}

export interface ScoredCandidate extends ImageCandidate {
  matchScore: number;
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export interface SourceError {
  source: ImageSource;
  message: string;
}

export interface SearchOutcome {
  candidates: ScoredCandidate[];
  errors: SourceError[];
  queries: string[];
}

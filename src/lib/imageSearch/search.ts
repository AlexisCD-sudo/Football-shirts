import type { ImageSource, Shirt } from '../../types/shirt';
import { searchCommons } from './commons';
import { searchOpenverse } from './openverse';
import { buildQueries } from './query';
import { POSSIBLE, scoreCandidate } from './score';
import type { FetchLike, ImageCandidate, ScoredCandidate, SearchOutcome, SourceError } from './types';

export interface SearchOptions {
  fetchFn?: FetchLike;
  signal?: AbortSignal;
  /** Consultes personalitzades; si no, es generen a partir de la samarreta. */
  queries?: string[];
  sources?: ImageSource[];
  /** Descarta les candidates per sota d'aquesta puntuació (per defecte, «possible»). */
  minScore?: number;
  maxPerSource?: number;
}

const defaultFetch: FetchLike = (url, init) => fetch(url, init) as ReturnType<FetchLike>;

/** Ordena per puntuació i elimina imatges repetides (mateixa URL, també entre fonts). */
export function rankCandidates(shirt: Shirt, candidates: ImageCandidate[], minScore = POSSIBLE): ScoredCandidate[] {
  const seen = new Set<string>();
  const scored: ScoredCandidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.imageUrl)) continue;
    seen.add(c.imageUrl);
    scored.push({ ...c, matchScore: scoreCandidate(shirt, c) });
  }
  return scored.filter((c) => c.matchScore >= minScore).sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Cerca a Wikimedia Commons i Openverse (fonts amb llicència i API pública, sense clau). Si una font falla,
 * es retornen els resultats de l'altra i l'error queda registrat. Les consultes es fan en sèrie.
 */
export async function searchImages(shirt: Shirt, opts: SearchOptions = {}): Promise<SearchOutcome> {
  const fetchFn = opts.fetchFn ?? defaultFetch;
  const queries = opts.queries?.length ? opts.queries : buildQueries(shirt);
  const sources = opts.sources ?? ['wikimedia_commons', 'openverse'];
  const errors: SourceError[] = [];
  const all: ImageCandidate[] = [];

  for (const source of sources) {
    const run = source === 'wikimedia_commons' ? searchCommons : source === 'openverse' ? searchOpenverse : null;
    if (!run) continue;
    let failures = 0;
    for (const q of queries) {
      try {
        all.push(...(await run(q, fetchFn, opts.signal)));
      } catch (e) {
        if (opts.signal?.aborted) throw e;
        failures += 1;
        if (failures === 1) errors.push({ source, message: e instanceof Error ? e.message : 'Error desconegut' });
      }
    }
  }
  return {
    candidates: rankCandidates(shirt, all, opts.minScore).slice(0, opts.maxPerSource ? opts.maxPerSource * sources.length : 40),
    errors,
    queries,
  };
}

/** Si TOTES les fonts han fallat, la cerca no ha servit de res (no és el mateix que «sense resultats»). */
export function allSourcesFailed(outcome: SearchOutcome, sourceCount = 2): boolean {
  return outcome.errors.length >= sourceCount;
}

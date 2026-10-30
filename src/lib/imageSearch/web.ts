import { supabase } from '../supabase';
import { isFkaUrl } from '../fka';
import type { ImageCandidate } from './types';

/** El servidor no té la clau de cerca configurada: la font simplement no està disponible. */
export class WebSearchUnavailable extends Error {}

interface WebResult {
  imageUrl: string;
  thumbnailUrl: string | null;
  pageUrl: string;
  title: string;
  width: number | null;
  height: number | null;
}

export function parseWebResponse(json: unknown): ImageCandidate[] {
  const results = (json as { results?: WebResult[] })?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((r) => typeof r.imageUrl === 'string' && typeof r.pageUrl === 'string')
    .map((r) => ({
      imageUrl: r.imageUrl,
      thumbnailUrl: r.thumbnailUrl ?? null,
      sourcePageUrl: r.pageUrl,
      source: isFkaUrl(r.pageUrl) || isFkaUrl(r.imageUrl) ? ('footballkitarchive' as const) : ('web_search' as const),
      title: r.title ?? '',
      author: null,
      // No es coneix la llicència d'una imatge trobada al web: es deixa en blanc, mai s'inventa.
      license: null,
      licenseUrl: null,
      width: r.width ?? null,
      height: r.height ?? null,
    }));
}

export type WebSearchFn = (query: string, signal?: AbortSignal) => Promise<ImageCandidate[]>;

/** Cerca d'imatges al web a través de la funció de servidor `/api/image-search` (requereix sessió). */
export const searchWeb: WebSearchFn = async (query, signal) => {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (!token) throw new WebSearchUnavailable('Cal iniciar sessió');
  const res = await fetch(`/api/image-search?q=${encodeURIComponent(query)}`, { signal, headers: { authorization: `Bearer ${token}` } });
  if (res.status === 501 || res.status === 404) throw new WebSearchUnavailable('Cerca web no configurada');
  if (res.status === 429) throw new Error('La cerca web ha limitat les peticions. Torna-ho a provar d’aquí una estona.');
  if (!res.ok) throw new Error(`La cerca web ha respost amb l'error ${res.status}`);
  return parseWebResponse(await res.json());
};

/** Consulta pensada per trobar la fitxa de Football Kit Archive. */
export function fkaQuery(query: string): string {
  return `site:footballkitarchive.com ${query}`;
}

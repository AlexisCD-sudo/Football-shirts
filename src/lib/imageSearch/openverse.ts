import { stripHtml } from './commons';
import type { FetchLike, ImageCandidate } from './types';

const ENDPOINT = 'https://api.openverse.org/v1/images/';

export function openverseUrl(query: string, limit = 20): string {
  const params = new URLSearchParams({
    q: query,
    page_size: String(Math.min(limit, 20)), // sense clau, el màxim és 20 per pàgina
    mature: 'false',
    extension: 'jpg,jpeg,png,webp',
  });
  return `${ENDPOINT}?${params.toString()}`;
}

interface OpenverseResult {
  title?: string;
  url?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  width?: number;
  height?: number;
  tags?: { name?: string }[];
}

function licenseLabel(r: OpenverseResult): string | null {
  if (!r.license) return null;
  const l = r.license.toLowerCase();
  if (l === 'cc0') return 'CC0';
  if (l === 'pdm') return 'Domini públic';
  return `CC ${r.license.toUpperCase()}${r.license_version ? ` ${r.license_version}` : ''}`;
}

export function parseOpenverseResponse(json: unknown): ImageCandidate[] {
  const results = (json as { results?: OpenverseResult[] })?.results;
  if (!Array.isArray(results)) return [];
  const out: ImageCandidate[] = [];
  for (const r of results) {
    if (!r.url || !r.foreign_landing_url) continue;
    out.push({
      imageUrl: r.url,
      thumbnailUrl: r.thumbnail ?? null,
      sourcePageUrl: r.foreign_landing_url,
      source: 'openverse',
      title: stripHtml(r.title) ?? '',
      author: stripHtml(r.creator),
      license: licenseLabel(r),
      licenseUrl: r.license_url ?? null,
      width: r.width ?? null,
      height: r.height ?? null,
      extraText: (r.tags ?? []).map((t) => t.name).filter(Boolean).join(' '),
    });
  }
  return out;
}

export async function searchOpenverse(query: string, fetchFn: FetchLike, signal?: AbortSignal): Promise<ImageCandidate[]> {
  const res = await fetchFn(openverseUrl(query), { signal });
  if (res.status === 429) throw new Error('Openverse ha limitat les peticions (massa ràpid). Torna-ho a provar d’aquí una estona.');
  if (!res.ok) throw new Error(`Openverse ha respost amb l'error ${res.status}`);
  return parseOpenverseResponse(await res.json());
}

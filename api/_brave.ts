/** Lògica pura de la funció de servidor de cerca d'imatges (provada a tests/webSearch.test.ts). */

export interface WebImageResult {
  imageUrl: string;
  thumbnailUrl: string | null;
  pageUrl: string;
  title: string;
  width: number | null;
  height: number | null;
}

interface BraveImage {
  title?: unknown;
  url?: unknown;
  thumbnail?: { src?: unknown };
  properties?: { url?: unknown; width?: unknown; height?: unknown };
}

const httpUrl = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
};
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Converteix la resposta de Brave en resultats mínims i segurs (només URL http/https). */
export function parseBraveImages(json: unknown, limit: number): WebImageResult[] {
  const results = (json as { results?: BraveImage[] })?.results;
  if (!Array.isArray(results)) return [];
  const out: WebImageResult[] = [];
  for (const r of results) {
    const imageUrl = httpUrl(r.properties?.url) ?? httpUrl(r.thumbnail?.src);
    const pageUrl = httpUrl(r.url);
    if (!imageUrl || !pageUrl) continue;
    out.push({
      imageUrl,
      thumbnailUrl: httpUrl(r.thumbnail?.src),
      pageUrl,
      title: typeof r.title === 'string' ? r.title.slice(0, 200) : '',
      width: num(r.properties?.width),
      height: num(r.properties?.height),
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function cleanQuery(raw: string | null): string | null {
  const q = (raw ?? '').replace(/\s+/g, ' ').trim();
  return q.length >= 2 && q.length <= 200 ? q : null;
}

export function braveUrl(q: string, count: number): string {
  const p = new URLSearchParams({ q, count: String(count), safesearch: 'strict' });
  return `https://api.search.brave.com/res/v1/images/search?${p.toString()}`;
}

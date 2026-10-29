import type { FetchLike, ImageCandidate } from './types';

const ENDPOINT = 'https://commons.wikimedia.org/w/api.php';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function stripHtml(html: string | undefined | null): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

interface CommonsMeta {
  [key: string]: { value?: string } | undefined;
}

interface CommonsImageInfo {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  width?: number;
  height?: number;
  mime?: string;
  extmetadata?: CommonsMeta;
}

interface CommonsPage {
  title?: string;
  imageinfo?: CommonsImageInfo[];
}

export function commonsUrl(query: string, limit = 12): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*', // CORS: permet cridar l'API directament des del navegador, sense clau
    generator: 'search',
    gsrnamespace: '6', // fitxers
    gsrsearch: query,
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '480',
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ImageDescription|Credit',
  });
  return `${ENDPOINT}?${params.toString()}`;
}

/** Converteix la resposta de l'API de Wikimedia Commons en candidates. Defensiu: ignora el que no entén. */
export function parseCommonsResponse(json: unknown): ImageCandidate[] {
  const pages = (json as { query?: { pages?: Record<string, CommonsPage> } })?.query?.pages;
  if (!pages || typeof pages !== 'object') return [];
  const out: ImageCandidate[] = [];
  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    if (!info?.url || !info.descriptionurl) continue;
    if (info.mime && !ALLOWED_MIME.has(info.mime)) continue; // fora SVG (plantilles), PDF, àudio…
    const meta = info.extmetadata ?? {};
    out.push({
      imageUrl: info.url,
      thumbnailUrl: info.thumburl ?? null,
      sourcePageUrl: info.descriptionurl,
      source: 'wikimedia_commons',
      title: (page.title ?? '').replace(/^File:/i, '').replace(/\.[a-z0-9]+$/i, ''),
      author: stripHtml(meta.Artist?.value),
      license: stripHtml(meta.LicenseShortName?.value),
      licenseUrl: stripHtml(meta.LicenseUrl?.value),
      width: info.width ?? null,
      height: info.height ?? null,
      extraText: [stripHtml(meta.ImageDescription?.value), stripHtml(meta.Credit?.value)].filter(Boolean).join(' '),
    });
  }
  return out;
}

export async function searchCommons(query: string, fetchFn: FetchLike, signal?: AbortSignal): Promise<ImageCandidate[]> {
  const res = await fetchFn(commonsUrl(query), { signal });
  if (!res.ok) throw new Error(`Wikimedia Commons ha respost amb l'error ${res.status}`);
  return parseCommonsResponse(await res.json());
}

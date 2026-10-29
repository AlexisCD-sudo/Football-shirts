import type { KitType } from '../types/shirt';

/**
 * Football Kit Archive (FKA): NO té API oficial i els seus controls d'accés (Cloudflare) impedeixen l'accés
 * automàtic; aquesta aplicació no fa scraping ni crida cap endpoint no autoritzat. Aquí només hi ha utilitats
 * per al flux assistit: es llegeix el TEXT d'un enllaç que enganxa la persona i res més.
 */
export const FKA_HOME = 'https://www.footballkitarchive.com/es/';
export const FKA_LICENSE = 'Ús personal (permís assumit pel propietari)';
export const FKA_SOURCE = 'footballkitarchive' as const;

export function isFkaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const h = u.hostname.toLowerCase();
    return h === 'footballkitarchive.com' || h.endsWith('.footballkitarchive.com');
  } catch {
    return false;
  }
}

/** Només http(s); mai javascript:, data:, etc. */
export function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface FkaSuggestion {
  /** Tot són SUGGERIMENTS extrets del text de l'URL: s'han de revisar. `null` = no s'ha pogut deduir. */
  teamName: string | null;
  season: string | null;
  kitType: KitType | null;
  /** Segment de l'URL de què s'ha partit (per mostrar-lo a la persona). */
  slug: string | null;
}

const KIT_WORDS: [RegExp, KitType][] = [
  [/\b(goalkeeper|goalie|keeper|gk)\b/, 'goalkeeper'],
  [/\bthird\b/, 'third'],
  [/\baway\b/, 'away'],
  [/\bhome\b/, 'home'],
  [/\b(special|anniversary|commemorative|limited)\b/, 'special'],
  [/\b(training|pre-?match|warm-?up)\b/, 'training'],
];

const title = (w: string) => (w.length <= 3 && /^[a-z]+$/.test(w) && ['fc', 'cf', 'ac', 'as', 'sc', 'sv', 'fk', 'sk'].includes(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1));

/**
 * Dedueix equip, temporada i equipació del text de l'URL d'una fitxa (p. ex. `/es/ajax-2021-22-third-kit/`).
 * És heurístic i pot fallar: mai es presenta com a coincidència exacta.
 */
export function parseFkaKitUrl(url: string): FkaSuggestion {
  const none: FkaSuggestion = { teamName: null, season: null, kitType: null, slug: null };
  let path: string[];
  try {
    path = new URL(url.trim()).pathname.split('/').filter(Boolean);
  } catch {
    return none;
  }
  const slug = path[path.length - 1]?.toLowerCase().replace(/\.(html?|php)$/, '') ?? null;
  if (!slug) return none;
  const tokens = slug.split('-').filter(Boolean);

  let season: string | null = null;
  let seasonAt = -1;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/^\d{4}$/.test(tokens[i]) && /^\d{2}$/.test(tokens[i + 1])) {
      const start = Number(tokens[i]);
      if ((start + 1) % 100 === Number(tokens[i + 1])) {
        season = `${tokens[i]}-${tokens[i + 1]}`;
        seasonAt = i;
        break;
      }
    }
  }
  const before = seasonAt > 0 ? tokens.slice(0, seasonAt) : [];
  const after = seasonAt >= 0 ? tokens.slice(seasonAt + 2) : tokens;
  const tail = after.join(' ');
  const kitType = KIT_WORDS.find(([re]) => re.test(tail))?.[1] ?? null;
  const teamName = before.length ? before.map(title).join(' ') : null;
  return { teamName, season, kitType, slug };
}

/** Text per cercar a FKA a mà (equip + temporada + equipació). */
export function fkaSearchText(d: { teamName?: string | null; season?: string | null; kitType?: KitType | null }): string {
  const kit: Record<KitType, string> = {
    home: 'home',
    away: 'away',
    third: 'third',
    goalkeeper: 'goalkeeper',
    special: 'special',
    training: 'training',
    other: '',
  };
  return [d.teamName, d.season, d.kitType ? kit[d.kitType] : null].filter(Boolean).join(' ').trim();
}

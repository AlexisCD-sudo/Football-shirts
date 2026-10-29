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

const KIT_TOKEN: Record<string, KitType> = {
  home: 'home', local: 'home',
  away: 'away', visitante: 'away', visitant: 'away',
  third: 'third', tercera: 'third', tercer: 'third',
  gk: 'goalkeeper', goalkeeper: 'goalkeeper', goalie: 'goalkeeper', keeper: 'goalkeeper', portero: 'goalkeeper',
};
const FOURTH = new Set(['fourth', 'cuarta', 'cuarto']);
const GARMENT = new Set(['camiseta', 'camisa', 'maillot', 'trikot', 'shirt', 'jersey', 'kit', 'camisetas', 'kits']);
/** Paraules que indiquen una variant (no la samarreta «estàndard») i obliguen a revisar. */
const VARIANT = new Set([
  'champions', 'league', 'european', 'europa', 'pokal', 'cup', 'copa', 'final', 'long', 'sleeve', 'manga', 'larga',
  'anniversary', 'special', 'especial', 'limited', 'commemorative', 'pre', 'match', 'training', 'numbered', 'player', 'issue',
  'fourth', 'cuarta', 'cuarto',
]);
/** Peces que no són samarretes: s'ignoren del tot. */
const NOT_SHIRT = new Set(['track', 'jacket', 'jackets', 'shorts', 'short', 'pants', 'tracksuit', 'hoodie', 'vest', 'polo', 'socks', 'anthem', 'windbreaker', 'bib', 'cap', 'scarf']);

const SMALL_CAPS = new Set(['fc', 'cf', 'ac', 'as', 'sc', 'sv', 'fk', 'sk', 'cd', 'ud', 'sd']);
const titleWord = (w: string) => (SMALL_CAPS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1));

export interface ParsedSlug {
  /** Paraules de l'equip (en minúscula, tal com surten a l'URL). */
  teamTokens: string[];
  season: string | null;
  kitType: KitType | null;
  /** Hi ha paraules extra (competició, manga llarga, «gk-2»…): cal revisar, mai és coincidència exacta. */
  variant: boolean;
  /** És una peça que no és samarreta (jaqueta, pantalons…). */
  notShirt: boolean;
  /** Pàgina de llistat (col·lecció o equip), no una fitxa de samarreta. */
  isListing: boolean;
}

/**
 * Interpreta el nom d'una fitxa o d'una imatge de FKA. Accepta l'ordre de les fitxes
 * (`borussia-dortmund-2016-17-away-kit-110`) i el dels fitxers (`camiseta-local-borussia-dortmund-2016-17.jpg`).
 * Heurística: pot fallar i per això els resultats sempre es revisen o es marquen com a suggeriment.
 */
export function parseKitSlug(rawSlug: string): ParsedSlug {
  const slug = rawSlug.toLowerCase().replace(/\.(jpe?g|png|webp|html?|php)$/, '').replace(/-\d{2,4}x\d{2,4}$/, '');
  const isListing = /-[lt]\d+$/.test(slug);
  let tokens = slug.split('-').filter(Boolean);
  // Identificador numèric final de la fitxa (p. ex. «-110»); la temporada es busca abans.
  let seasonAt = -1;
  let season: string | null = null;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/^\d{4}$/.test(tokens[i]) && /^\d{2}$/.test(tokens[i + 1]) && (Number(tokens[i]) + 1) % 100 === Number(tokens[i + 1])) {
      season = `${tokens[i]}-${tokens[i + 1]}`;
      seasonAt = i;
      break;
    }
  }
  if (seasonAt < 0) return { teamTokens: [], season: null, kitType: null, variant: false, notShirt: false, isListing };
  const beforeRaw = tokens.slice(0, seasonAt);
  let after = tokens.slice(seasonAt + 2);
  // Ordre dels fitxers: «camiseta-local-<equip>-<temporada>» → les paraules de peça/equipació van abans.
  const kitHits: KitType[] = [];
  let variant = false;
  let notShirt = false;
  const teamTokens: string[] = [];
  for (const t of beforeRaw) {
    if (GARMENT.has(t)) continue;
    if (KIT_TOKEN[t]) {
      kitHits.push(KIT_TOKEN[t]);
      continue;
    }
    if (NOT_SHIRT.has(t)) notShirt = true;
    teamTokens.push(t);
  }
  // Ordre de les fitxes: «…-<temporada>-away-kit-110».
  tokens = after;
  after = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (GARMENT.has(t)) continue;
    if (KIT_TOKEN[t]) {
      kitHits.push(KIT_TOKEN[t]);
      if (t === 'gk' && /^\d$/.test(tokens[i + 1] ?? '')) variant = true; // «gk-2-kit»: n'hi ha diversos
      continue;
    }
    if (/^\d+$/.test(t)) {
      if (i === tokens.length - 1 && t.length >= 2) continue; // identificador final
      if (t.length === 1) {
        variant = true;
        continue;
      }
    }
    if (NOT_SHIRT.has(t)) notShirt = true;
    if (VARIANT.has(t) || FOURTH.has(t)) variant = true;
    else after.push(t);
  }
  if (after.length > 0) variant = true; // paraules desconegudes: no és una coincidència exacta
  const distinct = [...new Set(kitHits)];
  if (distinct.length > 1) variant = true;
  const hasFourth = beforeRaw.concat(tokens).some((t) => FOURTH.has(t));
  const kitType: KitType | null = distinct[0] ?? (hasFourth ? 'other' : null);
  return { teamTokens, season, kitType, variant, notShirt, isListing };
}

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
  const p = parseKitSlug(slug);
  return {
    teamName: p.season && p.teamTokens.length ? p.teamTokens.map(titleWord).join(' ') : null,
    season: p.season,
    kitType: p.kitType,
    slug,
  };
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

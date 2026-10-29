import type { KitType, Shirt } from '../types/shirt';
import { isFkaUrl, parseKitSlug, type ParsedSlug } from './fka';

/**
 * Enllaça en bloc enllaços de Football Kit Archive (imatges i fitxes que la persona ha enganxat) amb les
 * samarretes de la col·lecció, comparant el NOM dels fitxers/fitxes (equip, temporada, equipació).
 * No fa cap petició a FKA: només analitza text que ja tens. Mai assigna res per aproximació: només les
 * coincidències «exactes» sense ambigüitat es preseleccionen; la resta es revisen a mà.
 */

export interface FkaLink {
  url: string;
  kind: 'image' | 'page';
  parsed: ParsedSlug;
  /** Amplada indicada al nom (p. ex. `-300x300`), per preferir la imatge més gran. */
  width: number;
}

const URL_RE = /https?:\/\/[^\s"'<>)\]\\,]+/gi;

/** Troba tots els enllaços de FKA dins d'un text qualsevol (llista d'adreces, codi font d'una pàgina…). */
export function extractFkaLinks(text: string): FkaLink[] {
  const cleaned = text.replace(/\\\//g, '/').replace(/&amp;/g, '&');
  const seen = new Set<string>();
  const out: FkaLink[] = [];
  for (const raw of cleaned.match(URL_RE) ?? []) {
    const url = raw.replace(/[.;]+$/, '');
    if (seen.has(url) || !isFkaUrl(url)) continue;
    seen.add(url);
    let path: string;
    try {
      path = new URL(url).pathname;
    } catch {
      continue;
    }
    const last = decodeURIComponent(path.split('/').filter(Boolean).pop() ?? '');
    if (!last) continue;
    const isImage = /\.(jpe?g|png|webp)$/i.test(last);
    const parsed = parseKitSlug(last);
    if (!parsed.season || parsed.isListing || parsed.notShirt || parsed.teamTokens.length === 0) continue;
    if (!isImage && /\.[a-z0-9]{2,5}$/i.test(last)) continue; // css, js, etc.
    const size = /-(\d{2,4})x\d{2,4}\.[a-z]+$/i.exec(last);
    out.push({ url, kind: isImage ? 'image' : 'page', parsed, width: size ? Number(size[1]) : 100000 });
  }
  return out;
}

// ───────── Equips: normalització i sinònims (català/castellà/anglès) ─────────
const ALIASES: [string, string][] = [
  ['fc barcelona', 'barcelona'], ['barca', 'barcelona'], ['barça', 'barcelona'],
  ['reial madrid', 'real madrid'], ['real madrid cf', 'real madrid'],
  ['atletic de madrid', 'atletico madrid'], ['atletico de madrid', 'atletico madrid'], ['atl madrid', 'atletico madrid'],
  ['bayern munic', 'bayern munich'], ['bayern munchen', 'bayern munich'], ['fc bayern', 'bayern munich'],
  ['man united', 'manchester united'], ['man utd', 'manchester united'],
  ['man city', 'manchester city'], ['inter de mila', 'inter'], ['internazionale', 'inter'], ['inter milan', 'inter'],
  ['ac milan', 'milan'], ['paris saint germain', 'psg'], ['paris sg', 'psg'],
  ['dinamarca', 'denmark'], ['alemanya', 'germany'], ['espanya', 'spain'], ['franca', 'france'], ['italia', 'italy'],
  ['anglaterra', 'england'], ['holanda', 'netherlands'], ['paisos baixos', 'netherlands'], ['belgica', 'belgium'],
  ['brasil', 'brazil'], ['xile', 'chile'], ['ganha', 'ghana'], ['palestina', 'palestine'], ['croacia', 'croatia'],
  ['suecia', 'sweden'], ['noruega', 'norway'], ['suissa', 'switzerland'], ['turquia', 'turkey'], ['polonia', 'poland'],
  ['grecia', 'greece'], ['xina', 'china'], ['japo', 'japan'], ['mexic', 'mexico'], ['estats units', 'usa'],
  ['sant pauli', 'st pauli'], ['saint pauli', 'st pauli'], ['fenerbace', 'fenerbahce'], ['wisla crakovia', 'wisla krakow'],
  ['real societat', 'real sociedad'], ['sevilla fc', 'sevilla'], ['valencia cf', 'valencia'], ['nova zelanda', 'new zealand'],
  ['corea del sud', 'south korea'], ['arabia saudita', 'saudi arabia'], ['marroc', 'morocco'], ['egipte', 'egypt'],
  ['escocia', 'scotland'], ['irlanda', 'ireland'], ['austria', 'austria'], ['hongria', 'hungary'], ['txequia', 'czech republic'],
];
const STOP = new Set(['fc', 'cf', 'ac', 'afc', 'sc', 'cd', 'ud', 'sd', 'club', 'de', 'del', 'la', 'el', 'the', 'sv', 'fk', 'sk', 'bk', 'as', 'ss', 'us', 'ssc', 'rc', 'calcio', 'and', 'of']);

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, ' ').trim();

/** Conjunt de paraules significatives d'un nom d'equip, amb sinònims aplicats. */
export function teamKey(name: string): string[] {
  let t = ` ${fold(name)} `;
  for (const [from, to] of ALIASES) {
    const f = ` ${fold(from)} `;
    if (t.includes(f)) t = t.replace(f, ` ${to} `);
  }
  return t.split(' ').filter((w) => w && !STOP.has(w));
}

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export type TeamMatch = 'equal' | 'fuzzy' | 'none';

export function compareTeams(shirtTeam: string, slugTokens: string[]): TeamMatch {
  const a = teamKey(shirtTeam);
  const b = teamKey(slugTokens.join(' '));
  if (a.length === 0 || b.length === 0) return 'none';
  const sa = [...a].sort().join(' ');
  const sb = [...b].sort().join(' ');
  if (sa === sb) return 'equal';
  if (a.length !== b.length) return 'none';
  const pool = [...b];
  for (const w of a) {
    const i = pool.findIndex((x) => x === w || (w.length >= 5 && x.length >= 5 && lev(w, x) <= 1));
    if (i < 0) return 'none';
    pool.splice(i, 1);
  }
  return 'fuzzy';
}

// ───────── Coincidències ─────────
export type MatchLevel = 'exact' | 'probable';

export interface Group {
  key: string;
  teamTokens: string[];
  season: string;
  kitType: KitType | null;
  variant: boolean;
  imageUrl: string | null;
  pageUrl: string | null;
  label: string;
}

export interface ShirtMatch {
  shirt: Shirt;
  level: MatchLevel;
  group: Group;
  reason: string;
}

export interface MatchReport {
  totalLinks: number;
  images: number;
  pages: number;
  groups: number;
  matches: ShirtMatch[];
  /** Samarretes amb diverses candidates igual de bones: s'han de triar a mà. */
  conflicts: { shirt: Shirt; options: Group[] }[];
  /** Samarretes que ja tenen foto confirmada: no es toquen. */
  protectedCount: number;
  /** Samarretes sense cap coincidència. */
  withoutMatch: Shirt[];
  /** Grups d'enllaços que no encaixen amb cap samarreta. */
  unusedGroups: Group[];
}

export function groupLinks(links: FkaLink[]): Group[] {
  const map = new Map<string, Group>();
  const bestImage = new Map<string, FkaLink>();
  for (const l of links) {
    const p = l.parsed;
    if (!p.season) continue;
    const key = `${[...p.teamTokens].join('-')}|${p.season}|${p.kitType ?? '?'}|${p.variant ? 'v' : ''}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        teamTokens: p.teamTokens,
        season: p.season,
        kitType: p.kitType,
        variant: p.variant,
        imageUrl: null,
        pageUrl: null,
        label: `${p.teamTokens.join(' ')} ${p.season}${p.kitType ? ` ${p.kitType}` : ''}`,
      };
      map.set(key, g);
    }
    if (l.kind === 'page') g.pageUrl = g.pageUrl ?? l.url;
    else {
      const cur = bestImage.get(key);
      if (!cur || l.width > cur.width) bestImage.set(key, l);
    }
  }
  for (const [key, l] of bestImage) map.get(key)!.imageUrl = l.url;
  return [...map.values()];
}

export function matchLinksToShirts(links: FkaLink[], shirts: Shirt[]): MatchReport {
  const groups = groupLinks(links);
  const matches: ShirtMatch[] = [];
  const conflicts: MatchReport['conflicts'] = [];
  const withoutMatch: Shirt[] = [];
  const used = new Set<string>();
  let protectedCount = 0;
  const exactByGroup = new Map<string, Shirt[]>();

  type Cand = { group: Group; level: MatchLevel; reason: string };
  const perShirt = new Map<string, Cand[]>();

  for (const shirt of shirts) {
    if (shirt.photoUrl) {
      protectedCount += 1;
      continue;
    }
    const cands: Cand[] = [];
    for (const g of groups) {
      if (!g.imageUrl) continue; // sense imatge no es pot enllaçar res
      if (!shirt.season || shirt.season !== g.season) continue;
      const team = compareTeams(shirt.team.name, g.teamTokens);
      if (team === 'none') continue;
      const kitKnown = !!shirt.kitType && !!g.kitType;
      const kitEqual = kitKnown && shirt.kitType === g.kitType;
      if (kitKnown && !kitEqual) continue; // equipació diferent: mai
      const exact = team === 'equal' && kitEqual && !g.variant;
      const reasons = [
        team === 'fuzzy' ? 'nom d’equip semblant' : null,
        !kitKnown ? 'equipació no deduïda' : null,
        g.variant ? 'variant (competició, manga llarga, porter 2…)' : null,
      ].filter(Boolean);
      cands.push({ group: g, level: exact ? 'exact' : 'probable', reason: exact ? 'equip, temporada i equipació coincideixen' : `a revisar: ${reasons.join(', ')}` });
    }
    perShirt.set(shirt.id, cands);
    if (cands.length === 0) {
      withoutMatch.push(shirt);
      continue;
    }
    const exacts = cands.filter((c) => c.level === 'exact');
    for (const c of exacts) exactByGroup.set(c.group.key, [...(exactByGroup.get(c.group.key) ?? []), shirt]);
  }

  for (const shirt of shirts) {
    const cands = perShirt.get(shirt.id);
    if (!cands || cands.length === 0) continue;
    const exacts = cands.filter((c) => c.level === 'exact');
    const best = exacts.length ? exacts : cands;
    if (best.length > 1) {
      conflicts.push({ shirt, options: best.map((c) => c.group) });
      best.forEach((c) => used.add(c.group.key));
      continue;
    }
    const c = best[0];
    used.add(c.group.key);
    // Dues samarretes iguals que reclamen la mateixa imatge exacta: no es pot saber quina és quina.
    const sharing = exactByGroup.get(c.group.key) ?? [];
    if (c.level === 'exact' && sharing.length > 1) {
      matches.push({ shirt, level: 'probable', group: c.group, reason: 'a revisar: tens diverses samarretes iguals (equip, temporada i equipació)' });
    } else {
      matches.push({ shirt, level: c.level, group: c.group, reason: c.reason });
    }
  }

  return {
    totalLinks: links.length,
    images: links.filter((l) => l.kind === 'image').length,
    pages: links.filter((l) => l.kind === 'page').length,
    groups: groups.length,
    matches,
    conflicts,
    protectedCount,
    withoutMatch,
    unusedGroups: groups.filter((g) => !used.has(g.key)),
  };
}

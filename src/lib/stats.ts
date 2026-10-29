import { conditionLabels, kitTypeLabels, versionLabels } from './labels';
import type { Shirt } from '../types/shirt';

export interface Bucket {
  label: string;
  count: number;
}

export interface Completeness {
  key: string;
  label: string;
  have: number;
}

export interface CollectionStats {
  total: number;
  teams: number;
  countries: number;
  byTeam: Bucket[];
  byCountry: Bucket[];
  byBrand: Bucket[];
  byKit: Bucket[];
  byDecade: Bucket[];
  byCondition: Bucket[];
  byVersion: Bucket[];
  completeness: Completeness[];
  firstSeason: string | null;
  lastSeason: string | null;
}

export const UNSPECIFIED = 'Sense especificar';

/** Agrupa i ordena per quantitat (desc) i després per nom. «Sense especificar» sempre al final. */
export function tally(values: (string | null | undefined)[]): Bucket[] {
  const map = new Map<string, number>();
  for (const v of values) {
    const k = v && v.trim() ? v.trim() : UNSPECIFIED;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (a.label === UNSPECIFIED) return 1;
      if (b.label === UNSPECIFIED) return -1;
      return b.count - a.count || a.label.localeCompare(b.label, 'ca');
    });
}

/** Dècada a partir de l'any d'inici de la temporada (`2005-06` → `2000s`). */
export function decadeOf(season: string | null): string | null {
  const m = season ? /^(\d{4})-\d{2}$/.exec(season) : null;
  return m ? `${Math.floor(Number(m[1]) / 10) * 10}s` : null;
}

export function computeStats(shirts: Shirt[]): CollectionStats {
  const seasons = shirts.map((s) => s.season).filter((s): s is string => !!s && /^\d{4}-\d{2}$/.test(s)).sort();
  const decades = tally(shirts.map((s) => decadeOf(s.season)));
  // Dècades en ordre cronològic, no per quantitat.
  const byDecade = [...decades].sort((a, b) =>
    a.label === UNSPECIFIED ? 1 : b.label === UNSPECIFIED ? -1 : a.label.localeCompare(b.label),
  );
  const have = (pred: (s: Shirt) => boolean) => shirts.filter(pred).length;
  return {
    total: shirts.length,
    teams: new Set(shirts.map((s) => s.team.id)).size,
    countries: new Set(shirts.map((s) => s.team.country).filter(Boolean)).size,
    byTeam: tally(shirts.map((s) => s.team.name)),
    byCountry: tally(shirts.map((s) => s.team.country)),
    byBrand: tally(shirts.map((s) => s.brand)),
    byKit: tally(shirts.map((s) => (s.kitType ? kitTypeLabels[s.kitType] : null))),
    byDecade,
    byCondition: tally(shirts.map((s) => (s.condition ? conditionLabels[s.condition] : null))),
    byVersion: tally(shirts.map((s) => (s.version === 'unknown' ? null : versionLabels[s.version]))),
    completeness: [
      { key: 'photo', label: 'Foto', have: have((s) => !!s.photoUrl) },
      { key: 'season', label: 'Temporada', have: have((s) => !!s.season) },
      { key: 'brand', label: 'Marca', have: have((s) => !!s.brand) },
      { key: 'size', label: 'Talla', have: have((s) => !!s.size) },
      { key: 'condition', label: 'Estat', have: have((s) => !!s.condition) },
      { key: 'price', label: 'Preu', have: have((s) => s.price !== null) },
      { key: 'purchase', label: 'Data de compra', have: have((s) => !!s.purchaseDate) },
    ],
    firstSeason: seasons[0] ?? null,
    lastSeason: seasons[seasons.length - 1] ?? null,
  };
}

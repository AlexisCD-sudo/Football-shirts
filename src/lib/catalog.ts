import type { KitType, Shirt, ShirtVersion } from '../types/shirt';

export type SortKey = 'team' | 'season-desc' | 'season-asc' | 'recent';

export interface CatalogFilters {
  query: string;
  team: string;
  country: string;
  season: string;
  brand: string;
  kitType: KitType | '';
  version: ShirtVersion | '';
  photo: 'all' | 'with' | 'without';
}

export const emptyFilters: CatalogFilters = {
  query: '',
  team: '',
  country: '',
  season: '',
  brand: '',
  kitType: '',
  version: '',
  photo: 'all',
};

export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function searchText(s: Shirt): string {
  return normalize(
    [
      s.team.name,
      s.team.country,
      s.season,
      s.competition,
      s.brand,
      s.model,
      s.playerName,
      s.squadNumber,
      s.notes,
      s.curiosities,
    ]
      .filter((v) => v !== null && v !== undefined && v !== '')
      .join(' '),
  );
}

export function activeFilterCount(f: CatalogFilters): number {
  return (
    [f.team, f.country, f.season, f.brand, f.kitType, f.version].filter(Boolean).length +
    (f.photo !== 'all' ? 1 : 0) +
    (f.query.trim() ? 1 : 0)
  );
}

function compareNullable(a: string | null, b: string | null, dir: 1 | -1): number {
  if (a === b) return 0;
  if (a === null) return 1; // els valors desconeguts sempre al final
  if (b === null) return -1;
  return a < b ? -dir : dir;
}

const byTeam = (a: Shirt, b: Shirt) =>
  a.team.name.localeCompare(b.team.name, 'ca') || compareNullable(a.season, b.season, 1);

export function applyCatalog(shirts: Shirt[], f: CatalogFilters, sort: SortKey): Shirt[] {
  const terms = normalize(f.query).split(/\s+/).filter(Boolean);
  const result = shirts.filter((s) => {
    if (f.team && s.team.name !== f.team) return false;
    if (f.country && s.team.country !== f.country) return false;
    if (f.season && s.season !== f.season) return false;
    if (f.brand && s.brand !== f.brand) return false;
    if (f.kitType && s.kitType !== f.kitType) return false;
    if (f.version && s.version !== f.version) return false;
    if (f.photo === 'with' && !s.photoUrl) return false;
    if (f.photo === 'without' && s.photoUrl) return false;
    if (terms.length > 0) {
      const text = searchText(s);
      if (!terms.every((t) => text.includes(t))) return false;
    }
    return true;
  });

  const sorted = [...result];
  switch (sort) {
    case 'team':
      sorted.sort(byTeam);
      break;
    case 'season-desc':
      sorted.sort((a, b) => compareNullable(a.season, b.season, -1) || byTeam(a, b));
      break;
    case 'season-asc':
      sorted.sort((a, b) => compareNullable(a.season, b.season, 1) || byTeam(a, b));
      break;
    case 'recent':
      sorted.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      break;
  }
  return sorted;
}

export interface Facets {
  teams: string[];
  countries: string[];
  seasons: string[];
  brands: string[];
}

function distinct(values: (string | null)[], locale = false): string[] {
  const set = [...new Set(values.filter((v): v is string => !!v))];
  return locale ? set.sort((a, b) => a.localeCompare(b, 'ca')) : set.sort();
}

export function facetOptions(shirts: Shirt[]): Facets {
  return {
    teams: distinct(shirts.map((s) => s.team.name), true),
    countries: distinct(shirts.map((s) => s.team.country), true),
    seasons: distinct(shirts.map((s) => s.season)).reverse(),
    brands: distinct(shirts.map((s) => s.brand), true),
  };
}

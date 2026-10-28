import { normalize } from './catalog';
import { COLUMNS, columnByKey, matchHeader, normalizeHeader, type ColumnKey } from './columns';
import { authenticityLabels, conditionLabels, kitTypeLabels, teamKindLabels, versionLabels } from './labels';
import { emptyFormValues, parseShirtForm, type ShirtFormValues } from './shirtSchema';
import type { Table } from './spreadsheet';
import type { Shirt, ShirtInput } from '../types/shirt';

export type MappingTarget = ColumnKey | 'ignore';

export interface PreviewRow {
  /** Número de fila al fitxer original (la capçalera és la fila 1). */
  sourceRow: number;
  /** Totes les columnes originals, també les ignorades: es conserven a la base de dades. */
  original: Record<string, string>;
  input: ShirtInput | null;
  errors: string[];
  warnings: string[];
  duplicate: 'file' | 'collection' | null;
}

export interface ImportItem {
  input: ShirtInput;
  sourceRow: number;
  original: Record<string, string>;
}

export interface ImportSummary {
  total: number;
  valid: number;
  withWarnings: number;
  errors: number;
  duplicates: number;
  newTeams: string[];
}

export const SAMPLE_SIZE = 5;

/** Proposa un mapeig automàtic; cada camp s'assigna a una sola columna. */
export function suggestMapping(headers: string[]): MappingTarget[] {
  const used = new Set<ColumnKey>();
  return headers.map((h) => {
    const key = matchHeader(h);
    if (key && !used.has(key)) {
      used.add(key);
      return key;
    }
    return 'ignore';
  });
}

// ───────── Valors enumerats: accepten el valor intern, l'etiqueta en català i sinònims ─────────

function synonymMap<T extends string>(labels: Record<T, string>, extra: Partial<Record<T, string[]>> = {}) {
  const map = new Map<string, T>();
  (Object.keys(labels) as T[]).forEach((key) => {
    map.set(normalizeHeader(key), key);
    map.set(normalizeHeader(labels[key]), key);
    for (const s of extra[key] ?? []) map.set(normalizeHeader(s), key);
  });
  return map;
}

const KIT = synonymMap(kitTypeLabels, {
  home: ['home', 'casa', 'primera', '1a', 'titular'],
  away: ['away', 'fora', 'segona', '2a'],
  third: ['3a', 'tercera equipacio'],
  goalkeeper: ['gk', 'goalie', 'portero'],
  special: ['especial', 'special edition'],
  other: ['altre'],
});
const VERSION = synonymMap(versionLabels, {
  replica: ['replica', 'repliques'],
  fan: ['stadium', 'fan version'],
  player: ['authentic', 'match'],
  unknown: ['desconeguda', 'desconegut'],
});
const CONDITION = synonymMap(conditionLabels, { excellent: ['excellent'], good: ['bona'], poor: ['dolenta'] });
const AUTHENTICITY = synonymMap(authenticityLabels, { official: ['original'], unverified: ['desconeguda'] });
const KIND = synonymMap(teamKindLabels, { national: ['nacional', 'seleccio nacional', 'national team'], club: ['equip'] });

function mapEnum<T extends string>(
  raw: string,
  map: Map<string, T>,
  label: string,
  errors: string[],
): string {
  if (!raw.trim()) return '';
  const found = map.get(normalizeHeader(raw));
  if (!found) {
    errors.push(`${label}: valor no reconegut «${raw.trim()}»`);
    return '';
  }
  return found;
}

export function normalizeSeason(raw: string): { value: string; changed: boolean } {
  const v = raw.trim();
  const m = /^(\d{4})\s*[-/–]\s*(\d{4}|\d{2})$/.exec(v);
  if (!m) return { value: v, changed: false };
  const start = Number(m[1]);
  const endShort = m[2].slice(-2);
  const ok = m[2].length === 2 ? true : Number(m[2]) === start + 1;
  if (!ok) return { value: v, changed: false };
  const value = `${m[1]}-${endShort}`;
  return { value, changed: value !== v };
}

export function cleanNumber(raw: string): string {
  let s = raw.trim().replace(/[€\s]|eur(os)?/gi, '').replace(/^#/, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  return s;
}

export function normalizeDate(raw: string): string {
  const v = raw.trim();
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (!m) return v;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function duplicateKey(teamName: string, season: string | null, kitType: string | null): string {
  return [normalize(teamName), season ?? '', kitType ?? ''].join('|');
}

export function existingKey(s: Shirt): string {
  return duplicateKey(s.team.name, s.season, s.kitType);
}

/** Converteix una fila en dades validades. No inventa res: els buits queden a `null`. */
function convertRow(
  row: string[],
  mapping: MappingTarget[],
): { input: ShirtInput | null; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const v: ShirtFormValues = { ...emptyFormValues };
  const text = new Map<ColumnKey, string>();
  mapping.forEach((target, idx) => {
    if (target !== 'ignore') text.set(target, row[idx] ?? '');
  });
  const get = (k: ColumnKey) => (text.get(k) ?? '').trim();
  const label = (k: ColumnKey) => columnByKey(k).header;

  const rawTeam = text.get('teamName') ?? '';
  v.teamName = rawTeam.trim();
  if (rawTeam !== rawTeam.trim() && rawTeam.trim()) warnings.push('S’han eliminat espais sobrants del nom de l’equip');
  const kind = mapEnum(get('teamKind'), KIND, label('teamKind'), errors);
  if (kind) v.teamKind = kind as ShirtFormValues['teamKind'];
  v.country = get('country');

  const season = normalizeSeason(get('season'));
  v.season = season.value;
  if (season.changed) warnings.push(`Temporada «${get('season')}» normalitzada a ${season.value}`);

  v.competition = get('competition');
  v.kitType = mapEnum(get('kitType'), KIT, label('kitType'), errors);
  v.brand = get('brand');
  v.model = get('model');
  v.version = mapEnum(get('version'), VERSION, label('version'), errors) || 'unknown';
  v.playerName = get('playerName');
  v.squadNumber = cleanNumber(get('squadNumber'));
  v.size = get('size');
  v.manufactureYear = get('manufactureYear');
  v.condition = mapEnum(get('condition'), CONDITION, label('condition'), errors);
  v.authenticity = mapEnum(get('authenticity'), AUTHENTICITY, label('authenticity'), errors) || 'unverified';
  if (v.version === 'replica' && v.authenticity === 'unverified') v.authenticity = 'replica';
  v.provenance = get('provenance');
  v.purchaseDate = normalizeDate(get('purchaseDate'));
  v.price = cleanNumber(get('price'));
  v.shippingCost = cleanNumber(get('shippingCost'));
  v.seller = get('seller');
  v.estimatedValue = cleanNumber(get('estimatedValue'));
  v.location = get('location');
  v.notes = get('notes');
  v.curiosities = get('curiosities');

  const parsed = parseShirtForm(v);
  if (!parsed.ok) {
    for (const [field, message] of Object.entries(parsed.errors)) {
      const header = COLUMNS.find((c) => c.key === field)?.header ?? field;
      errors.push(message.startsWith(header) ? message : `${header}: ${message}`);
    }
  }
  return { input: errors.length === 0 && parsed.ok ? parsed.data : null, errors, warnings };
}

/** Genera la vista prèvia: validació, avisos i detecció de duplicats (sense eliminar ni fusionar res). */
export function buildPreview(table: Table, mapping: MappingTarget[], existing: Shirt[]): PreviewRow[] {
  const existingKeys = new Set(existing.map(existingKey));
  const seen = new Set<string>();
  const out: PreviewRow[] = [];
  table.rows.forEach((row, i) => {
    if (row.every((c) => c.trim() === '')) return;
    const original: Record<string, string> = {};
    table.headers.forEach((h, idx) => {
      original[h] = row[idx] ?? '';
    });
    const { input, errors, warnings } = convertRow(row, mapping);
    let duplicate: PreviewRow['duplicate'] = null;
    if (input) {
      const key = duplicateKey(input.teamName, input.season, input.kitType);
      if (existingKeys.has(key)) duplicate = 'collection';
      else if (seen.has(key)) duplicate = 'file';
      seen.add(key);
    }
    out.push({ sourceRow: i + 2, original, input, errors, warnings, duplicate });
  });
  return out;
}

export function isTeamMapped(mapping: MappingTarget[]): boolean {
  return mapping.includes('teamName');
}

/** Files que s'importaran: les vàlides, i entre elles les que la persona ha deixat marcades. */
export function selectForImport(
  rows: PreviewRow[],
  included: (row: PreviewRow) => boolean,
  scope: 'sample' | 'all',
): PreviewRow[] {
  const selected = rows.filter((r) => r.input && included(r));
  return scope === 'sample' ? selected.slice(0, SAMPLE_SIZE) : selected;
}

export function toImportItems(rows: PreviewRow[]): ImportItem[] {
  return rows.flatMap((r) => (r.input ? [{ input: r.input, sourceRow: r.sourceRow, original: r.original }] : []));
}

export function summarize(rows: PreviewRow[], knownTeamNames: string[]): ImportSummary {
  const known = new Set(knownTeamNames.map(normalize));
  const newTeams = new Map<string, string>();
  for (const r of rows) {
    if (r.input && !known.has(normalize(r.input.teamName))) newTeams.set(normalize(r.input.teamName), r.input.teamName);
  }
  return {
    total: rows.length,
    valid: rows.filter((r) => r.input).length,
    withWarnings: rows.filter((r) => r.input && r.warnings.length > 0).length,
    errors: rows.filter((r) => !r.input).length,
    duplicates: rows.filter((r) => r.duplicate).length,
    newTeams: [...newTeams.values()].sort((a, b) => a.localeCompare(b, 'ca')),
  };
}

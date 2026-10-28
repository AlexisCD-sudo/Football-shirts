import { COLUMNS, type ColumnKey } from './columns';
import { toCsv } from './csv';
import { authenticityLabels, conditionLabels, kitTypeLabels, teamKindLabels, versionLabels } from './labels';
import { xlsxBlob } from './spreadsheet';
import type { Shirt } from '../types/shirt';

type Cell = string | number | null;

/** Columnes que només s'exporten (en importar s'ignoren). */
const EXTRA_HEADERS = ['Identificador', 'Foto (URL)', "Data d'alta", 'Última modificació'];

export const EXPORT_HEADERS: string[] = ['Identificador', ...COLUMNS.map((c) => c.header), ...EXTRA_HEADERS.slice(1)];

function value(s: Shirt, key: ColumnKey): Cell {
  switch (key) {
    case 'teamName':
      return s.team.name;
    case 'teamKind':
      return teamKindLabels[s.team.kind];
    case 'country':
      return s.team.country;
    case 'kitType':
      return s.kitType ? kitTypeLabels[s.kitType] : null;
    case 'version':
      return s.version === 'unknown' ? null : versionLabels[s.version];
    case 'condition':
      return s.condition ? conditionLabels[s.condition] : null;
    case 'authenticity':
      return s.authenticity === 'unverified' ? null : authenticityLabels[s.authenticity];
    default:
      return s[key] as Cell;
  }
}

/** Una fila per samarreta, amb les mateixes capçaleres que reconeix l'importador (ida i tornada). */
export function shirtsToRows(shirts: Shirt[]): Cell[][] {
  return shirts.map((s) => [
    s.id,
    ...COLUMNS.map((c) => value(s, c.key)),
    s.photoUrl,
    s.createdAt,
    s.updatedAt,
  ]);
}

export const CSV_MIME = 'text/csv;charset=utf-8';

/** CSV en UTF-8 amb BOM perquè Excel en reconegui els accents. */
export function shirtsToCsv(shirts: Shirt[]): string {
  return '﻿' + toCsv([EXPORT_HEADERS, ...shirtsToRows(shirts)]);
}

export function shirtsToXlsx(shirts: Shirt[]): Promise<Blob> {
  return xlsxBlob(EXPORT_HEADERS, shirtsToRows(shirts));
}

/** Còpia completa: inclou l'equip, les dades d'importació originals i les referències de les fotos. */
export function shirtsToJson(shirts: Shirt[], now = new Date()): string {
  return JSON.stringify({ format: 'football-shirts-export', version: 1, exportedAt: now.toISOString(), count: shirts.length, shirts }, null, 2);
}

export function exportFilename(ext: 'csv' | 'xlsx' | 'json', now = new Date()): string {
  return `colleccio-samarretes-${now.toISOString().slice(0, 10)}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

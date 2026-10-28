import { describe, expect, it } from 'vitest';
import { parseCsv } from '../src/lib/csv';
import { EXPORT_HEADERS, shirtsToCsv, shirtsToJson, shirtsToRows } from '../src/lib/export';
import { buildPreview, suggestMapping } from '../src/lib/importer';
import { tableFromMatrix } from '../src/lib/spreadsheet';
import { makeShirt } from './helpers';

const shirts = [
  makeShirt({
    teamName: 'Barça',
    country: 'Espanya',
    season: '2010-11',
    brand: 'Nike',
    kitType: 'home',
    playerName: 'Messi',
    squadNumber: 10,
    price: 59.9,
    notes: 'Amb "cometes", comes i\nsalt de línia',
    version: 'replica',
    authenticity: 'replica',
    condition: 'excellent',
    purchaseDate: '2021-03-05',
  }),
  makeShirt({ teamName: 'Girona' }),
];

describe('exportació', () => {
  it('té una fila per samarreta i les mateixes columnes que la capçalera', () => {
    const rows = shirtsToRows(shirts);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.length === EXPORT_HEADERS.length)).toBe(true);
  });

  it('el CSV porta BOM i es pot tornar a llegir', () => {
    const csv = shirtsToCsv(shirts);
    expect(csv.startsWith('﻿')).toBe(true);
    const matrix = parseCsv(csv);
    expect(matrix[0]).toEqual(EXPORT_HEADERS);
    expect(matrix).toHaveLength(3);
  });

  it('el JSON és complet i conté totes les samarretes', () => {
    const json = JSON.parse(shirtsToJson(shirts, new Date('2026-10-28T10:00:00Z')));
    expect(json.format).toBe('football-shirts-export');
    expect(json.count).toBe(2);
    expect(json.exportedAt).toBe('2026-10-28T10:00:00.000Z');
    expect(json.shirts[0].team.name).toBe('Barça');
  });

  it('anada i tornada: exportar i tornar a importar dona les mateixes dades', () => {
    const table = tableFromMatrix(parseCsv(shirtsToCsv(shirts)));
    const preview = buildPreview(table, suggestMapping(table.headers), []);
    expect(preview.every((r) => r.errors.length === 0 && r.input)).toBe(true);
    const first = preview[0].input!;
    expect(first).toMatchObject({
      teamName: 'Barça',
      teamKind: 'club',
      country: 'Espanya',
      season: '2010-11',
      brand: 'Nike',
      kitType: 'home',
      playerName: 'Messi',
      squadNumber: 10,
      price: 59.9,
      version: 'replica',
      authenticity: 'replica',
      condition: 'excellent',
      purchaseDate: '2021-03-05',
      notes: 'Amb "cometes", comes i\nsalt de línia',
    });
    expect(preview[1].input).toMatchObject({ teamName: 'Girona', season: null, version: 'unknown', authenticity: 'unverified' });
  });
});

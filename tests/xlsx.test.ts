// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { tableFromXlsx, xlsxBuffer } from '../src/lib/spreadsheet';

describe('Excel (.xlsx)', () => {
  it('escriu i torna a llegir un fitxer amb accents, números i cel·les buides', async () => {
    const buffer = await xlsxBuffer(
      ['Equip', 'Temporada', 'Preu'],
      [
        ['Barça', '2010-11', 59.9],
        ['Girona', null, null],
      ],
    );
    const table = await tableFromXlsx(new Uint8Array(buffer as ArrayBuffer));
    expect(table.headers).toEqual(['Equip', 'Temporada', 'Preu']);
    expect(table.rows[0]).toEqual(['Barça', '2010-11', '59.9']);
    expect(table.rows[1]).toEqual(['Girona', '', '']);
  });
});

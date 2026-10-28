import { describe, expect, it } from 'vitest';
import {
  SAMPLE_SIZE,
  buildPreview,
  cleanNumber,
  normalizeDate,
  normalizeSeason,
  selectForImport,
  suggestMapping,
  summarize,
  toImportItems,
} from '../src/lib/importer';
import { tableFromMatrix } from '../src/lib/spreadsheet';
import { makeShirt } from './helpers';

// Capçaleres EXACTES del fitxer original de Numbers.
const original = tableFromMatrix([
  ['Equip', 'Any', 'Nom', 'Home/away', 'Rèpliques', 'Curiositats'],
  ['Barça', '2010-11', '', 'Home', '', 'Any Triplet'],
  ['Argentina', '2005-2006', 'Messi', 'Away', '', ''],
  ['Dinamarca ', '2021-22', '', 'Home', '', 'Maillot misteriós'],
  ['Manchester United', '1993-94', 'Cantona', 'Away', 'Rèplica', 'Kung Fu'],
]);

describe('suggestMapping', () => {
  it('reconeix les capçaleres del fitxer original', () => {
    expect(suggestMapping(original.headers)).toEqual([
      'teamName',
      'season',
      'playerName',
      'kitType',
      'version',
      'curiosities',
    ]);
  });
  it('no assigna dues columnes al mateix camp i ignora les desconegudes', () => {
    expect(suggestMapping(['Equip', 'Club', 'Raro'])).toEqual(['teamName', 'ignore', 'ignore']);
  });
  it('distingeix «Any» (temporada) d’«Any de fabricació»', () => {
    expect(suggestMapping(['Any', 'Any de fabricació'])).toEqual(['season', 'manufactureYear']);
  });
});

describe('normalitzacions', () => {
  it('normalitza temporades', () => {
    expect(normalizeSeason('2005-2006')).toEqual({ value: '2005-06', changed: true });
    expect(normalizeSeason('2010/11')).toEqual({ value: '2010-11', changed: true });
    expect(normalizeSeason('2010-11')).toEqual({ value: '2010-11', changed: false });
    expect(normalizeSeason('2005-2007').changed).toBe(false);
  });
  it('neteja números', () => {
    expect(cleanNumber('59,90 €')).toBe('59.90');
    expect(cleanNumber('1.234,50')).toBe('1234.50');
    expect(cleanNumber('#7')).toBe('7');
  });
  it('converteix dates dd/mm/aaaa', () => {
    expect(normalizeDate('5/3/2021')).toBe('2021-03-05');
    expect(normalizeDate('2021-03-05')).toBe('2021-03-05');
  });
});

describe('buildPreview amb el fitxer original', () => {
  const rows = buildPreview(original, suggestMapping(original.headers), []);

  it('converteix totes les files sense errors', () => {
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.input && r.errors.length === 0)).toBe(true);
  });
  it('normalitza i avisa, sense inventar dades', () => {
    expect(rows[1].input?.season).toBe('2005-06');
    expect(rows[1].warnings.join(' ')).toMatch(/2005-2006/);
    expect(rows[2].input?.teamName).toBe('Dinamarca');
    expect(rows[2].warnings.join(' ')).toMatch(/espais/);
    expect(rows[0].input?.brand).toBeNull();
    expect(rows[0].input?.price).toBeNull();
  });
  it('tradueix equipació i rèplica', () => {
    expect(rows[0].input?.kitType).toBe('home');
    expect(rows[1].input?.kitType).toBe('away');
    expect(rows[3].input?.version).toBe('replica');
    expect(rows[3].input?.authenticity).toBe('replica');
    expect(rows[0].input?.version).toBe('unknown');
    expect(rows[0].input?.authenticity).toBe('unverified');
  });
  it('conserva la fila original sencera i el número de fila', () => {
    expect(rows[0].sourceRow).toBe(2);
    expect(rows[3].original).toEqual({
      Equip: 'Manchester United',
      Any: '1993-94',
      Nom: 'Cantona',
      'Home/away': 'Away',
      Rèpliques: 'Rèplica',
      Curiositats: 'Kung Fu',
    });
  });
});

describe('validació i duplicats', () => {
  it('marca errors i no deixa importar-los', () => {
    const t = tableFromMatrix([
      ['Equip', 'Temporada', 'Dorsal', 'Preu', 'Equipació'],
      ['Roma', '2001', '100', '-3', 'Marciana'],
      ['', '2001-02', '', '', ''],
    ]);
    const rows = buildPreview(t, suggestMapping(t.headers), []);
    expect(rows[0].input).toBeNull();
    expect(rows[0].errors.length).toBeGreaterThanOrEqual(3);
    expect(rows[1].input).toBeNull();
    expect(selectForImport(rows, () => true, 'all')).toHaveLength(0);
  });

  it('detecta duplicats amb la col·lecció i dins del fitxer, sense eliminar res', () => {
    const t = tableFromMatrix([
      ['Equip', 'Temporada', 'Equipació'],
      ['barca', '2010-11', 'Home'],
      ['Roma', '2001-02', 'Home'],
      ['Roma', '2001-02', 'Home'],
    ]);
    const existing = [makeShirt({ teamName: 'Barça', season: '2010-11', kitType: 'home' })];
    const rows = buildPreview(t, suggestMapping(t.headers), existing);
    expect(rows.map((r) => r.duplicate)).toEqual(['collection', null, 'file']);
    expect(rows.every((r) => r.input)).toBe(true);
  });

  it('ignora les files totalment buides', () => {
    const t = tableFromMatrix([['Equip'], ['Roma'], [''], ['Lazio']]);
    expect(buildPreview(t, ['teamName'], [])).toHaveLength(2);
  });
});

describe('selecció i resum', () => {
  const t = tableFromMatrix([['Equip', 'Temporada'], ...Array.from({ length: 8 }, (_, i) => [`Equip ${i}`, '2010-11'])]);
  const rows = buildPreview(t, ['teamName', 'season'], []);

  it('la mostra se limita a les primeres files marcades', () => {
    expect(selectForImport(rows, () => true, 'sample')).toHaveLength(SAMPLE_SIZE);
    expect(selectForImport(rows, () => true, 'all')).toHaveLength(8);
    expect(selectForImport(rows, (r) => r.sourceRow > 5, 'all')).toHaveLength(4);
  });
  it('genera elements d’importació amb la fila original', () => {
    const items = toImportItems(selectForImport(rows, () => true, 'sample'));
    expect(items[0].sourceRow).toBe(2);
    expect(items[0].original).toEqual({ Equip: 'Equip 0', Temporada: '2010-11' });
  });
  it('resumeix i llista els equips nous', () => {
    const s = summarize(rows, ['Equip 0']);
    expect(s.total).toBe(8);
    expect(s.valid).toBe(8);
    expect(s.newTeams).toHaveLength(7);
    expect(s.newTeams).not.toContain('Equip 0');
  });
});

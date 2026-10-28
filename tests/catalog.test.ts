import { describe, expect, it } from 'vitest';
import { applyCatalog, emptyFilters, facetOptions, normalize } from '../src/lib/catalog';
import { makeShirt } from './helpers';

const shirts = [
  makeShirt({ teamName: 'Barça', country: 'Espanya', season: '2010-11', brand: 'Nike', playerName: 'Messi', kitType: 'home' }),
  makeShirt({ teamName: 'Barça', country: 'Espanya', season: '1996-97', brand: 'Kappa', kitType: 'home' }),
  makeShirt({ teamName: 'Manchester United', country: 'Anglaterra', season: '1993-94', kitType: 'away', playerName: 'Cantona' }),
  makeShirt({ teamName: 'Girona', country: 'Espanya', season: null }),
];

describe('normalize', () => {
  it('ignora accents i majúscules', () => {
    expect(normalize('  Barça ')).toBe('barca');
    expect(normalize('Milà')).toBe('mila');
  });
});

describe('applyCatalog', () => {
  it('cerca sense distingir accents ni majúscules', () => {
    const r = applyCatalog(shirts, { ...emptyFilters, query: 'barca' }, 'team');
    expect(r).toHaveLength(2);
  });

  it('exigeix totes les paraules de la cerca', () => {
    const r = applyCatalog(shirts, { ...emptyFilters, query: 'barca messi' }, 'team');
    expect(r.map((s) => s.playerName)).toEqual(['Messi']);
  });

  it('combina filtres', () => {
    const r = applyCatalog(shirts, { ...emptyFilters, country: 'Espanya', kitType: 'home' }, 'team');
    expect(r).toHaveLength(2);
    const none = applyCatalog(shirts, { ...emptyFilters, country: 'Anglaterra', kitType: 'home' }, 'team');
    expect(none).toHaveLength(0);
  });

  it('filtra per foto', () => {
    expect(applyCatalog(shirts, { ...emptyFilters, photo: 'with' }, 'team')).toHaveLength(0);
    expect(applyCatalog(shirts, { ...emptyFilters, photo: 'without' }, 'team')).toHaveLength(4);
  });

  it('ordena per temporada deixant les desconegudes al final', () => {
    const desc = applyCatalog(shirts, emptyFilters, 'season-desc').map((s) => s.season);
    expect(desc).toEqual(['2010-11', '1996-97', '1993-94', null]);
    const asc = applyCatalog(shirts, emptyFilters, 'season-asc').map((s) => s.season);
    expect(asc).toEqual(['1993-94', '1996-97', '2010-11', null]);
  });

  it('ordena per equip i temporada', () => {
    const r = applyCatalog(shirts, emptyFilters, 'team').map((s) => `${s.team.name} ${s.season}`);
    expect(r[0]).toBe('Barça 1996-97');
    expect(r[1]).toBe('Barça 2010-11');
  });

  it('no modifica la llista original', () => {
    const copy = [...shirts];
    applyCatalog(shirts, emptyFilters, 'season-desc');
    expect(shirts).toEqual(copy);
  });
});

describe('facetOptions', () => {
  it('retorna valors únics i exclou els buits', () => {
    const f = facetOptions(shirts);
    expect(f.teams).toEqual(['Barça', 'Girona', 'Manchester United']);
    expect(f.countries).toEqual(['Anglaterra', 'Espanya']);
    expect(f.seasons).toEqual(['2010-11', '1996-97', '1993-94']);
    expect(f.brands).toEqual(['Kappa', 'Nike']);
  });
});

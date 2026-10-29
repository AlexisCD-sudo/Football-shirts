import { describe, expect, it } from 'vitest';
import { parseCommonsResponse, commonsUrl } from '../src/lib/imageSearch/commons';
import { parseOpenverseResponse, openverseUrl } from '../src/lib/imageSearch/openverse';
import { buildQueries } from '../src/lib/imageSearch/query';
import { POSSIBLE, PROBABLE, scoreCandidate } from '../src/lib/imageSearch/score';
import { allSourcesFailed, searchImages } from '../src/lib/imageSearch/search';
import type { FetchLike, ImageCandidate } from '../src/lib/imageSearch/types';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import { makeInput } from './helpers';

async function shirt(over = {}) {
  const repo = new MemoryShirtRepository();
  await repo.createShirt(makeInput({ teamName: 'Barça', season: '2010-11', kitType: 'home', ...over }));
  return (await repo.listShirts())[0];
}

const cand = (over: Partial<ImageCandidate> = {}): ImageCandidate => ({
  imageUrl: 'https://x/a.jpg',
  thumbnailUrl: null,
  sourcePageUrl: 'https://x/page',
  source: 'openverse',
  title: '',
  author: null,
  license: null,
  licenseUrl: null,
  width: null,
  height: null,
  ...over,
});

describe('parsers', () => {
  it('Commons: extreu metadades, neteja l’HTML i descarta SVG', () => {
    const json = {
      query: {
        pages: {
          '1': {
            title: 'File:Barcelona 2010-11 home shirt.jpg',
            imageinfo: [
              {
                url: 'https://upload.wikimedia.org/a.jpg',
                thumburl: 'https://upload.wikimedia.org/t.jpg',
                descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
                mime: 'image/jpeg',
                extmetadata: {
                  Artist: { value: '<a href="x">Jane &amp; Co</a>' },
                  LicenseShortName: { value: 'CC BY-SA 4.0' },
                },
              },
            ],
          },
          '2': {
            title: 'File:Kit.svg',
            imageinfo: [{ url: 'https://u/k.svg', descriptionurl: 'https://c/k', mime: 'image/svg+xml' }],
          },
          '3': { title: 'File:Sense info.jpg' },
        },
      },
    };
    const out = parseCommonsResponse(json);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ author: 'Jane & Co', license: 'CC BY-SA 4.0', source: 'wikimedia_commons', title: 'Barcelona 2010-11 home shirt' });
    expect(parseCommonsResponse(null)).toEqual([]);
    expect(parseCommonsResponse({ query: {} })).toEqual([]);
  });

  it('Openverse: mapeja la llicència i ignora resultats sense URL', () => {
    const out = parseOpenverseResponse({
      results: [
        { url: 'https://o/1.jpg', foreign_landing_url: 'https://o/p1', title: 'Shirt', creator: 'Ann', license: 'by-sa', license_version: '2.0' },
        { title: 'sense url' },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].license).toBe('CC BY-SA 2.0');
    expect(parseOpenverseResponse({})).toEqual([]);
  });

  it('les URL porten la consulta codificada', () => {
    expect(commonsUrl('Barça 2010')).toContain(encodeURIComponent('Barça 2010'));
    expect(openverseUrl('Barça 2010')).toContain(encodeURIComponent('Barça 2010'));
  });
});

describe('consultes i puntuació', () => {
  it('construeix consultes amb equip, temporada i jugador', async () => {
    const s = await shirt({ playerName: 'Xavi' });
    const qs = buildQueries(s);
    expect(qs[0]).toContain('Barça');
    expect(qs[0]).toContain('2010-11');
    expect(qs.some((q) => q.includes('Xavi'))).toBe(true);
  });

  it('puntua alt una coincidència clara i baix la d’un altre equip', async () => {
    const s = await shirt();
    const good = scoreCandidate(s, cand({ title: 'Barça 2010-11 home shirt' }));
    const other = scoreCandidate(s, cand({ title: 'Madrid 2010-11 home shirt' }));
    expect(good).toBeGreaterThanOrEqual(PROBABLE);
    expect(other).toBeLessThan(POSSIBLE);
  });

  it('penalitza escuts i estadis', async () => {
    const s = await shirt();
    const shirtScore = scoreCandidate(s, cand({ title: 'Barça 2010-11 shirt' }));
    const crest = scoreCandidate(s, cand({ title: 'Barça 2010-11 crest logo' }));
    expect(crest).toBeLessThan(shirtScore);
  });
});

describe('searchImages', () => {
  const okOpenverse = {
    results: [{ url: 'https://o/1.jpg', foreign_landing_url: 'https://o/p', title: 'Barça 2010-11 home shirt', license: 'by', license_version: '4.0' }],
  };

  it('retorna resultats parcials si una font falla i registra l’error', async () => {
    const s = await shirt();
    const fetchFn: FetchLike = async (url) =>
      url.includes('wikimedia') ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => okOpenverse };
    const out = await searchImages(s, { fetchFn });
    expect(out.candidates).toHaveLength(1);
    expect(out.errors.some((e) => e.source === 'wikimedia_commons')).toBe(true);
    expect(allSourcesFailed(out)).toBe(false);
  });

  it('detecta que totes les fonts han fallat', async () => {
    const s = await shirt();
    const fetchFn: FetchLike = async () => ({ ok: false, status: 429, json: async () => ({}) });
    const out = await searchImages(s, { fetchFn });
    expect(out.candidates).toEqual([]);
    expect(allSourcesFailed(out)).toBe(true);
  });

  it('descarta les candidates per sota del llindar', async () => {
    const s = await shirt();
    const fetchFn: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ url: 'https://o/9.jpg', foreign_landing_url: 'https://o/p9', title: 'Paisatge de muntanya' }] }),
    });
    const out = await searchImages(s, { fetchFn, sources: ['openverse'] });
    expect(out.candidates).toEqual([]);
  });
});

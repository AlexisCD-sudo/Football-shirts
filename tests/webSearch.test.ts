import { describe, expect, it } from 'vitest';
import { braveUrl, cleanQuery, parseBraveImages } from '../api/_brave';
import { searchImages } from '../src/lib/imageSearch/search';
import { WebSearchUnavailable, parseWebResponse } from '../src/lib/imageSearch/web';
import type { Shirt } from '../src/types/shirt';

const shirt = { id: 's', team: { name: 'Ajax' }, season: '2021-22', kitType: 'third', playerName: null, photoUrl: null } as unknown as Shirt;
const failing = async () => ({ ok: false, status: 500, json: async () => ({}) });

describe('servidor: resposta de Brave', () => {
  it('només conserva URL http(s) i respecta el límit', () => {
    const json = {
      results: [
        { title: 'Ajax 2021-22 third shirt', url: 'https://a.test/p', thumbnail: { src: 'https://t.test/1.jpg' }, properties: { url: 'https://a.test/1.jpg', width: 800, height: 900 } },
        { title: 'mal', url: 'javascript:alert(1)', properties: { url: 'https://a.test/2.jpg' } },
        { title: 'sense imatge', url: 'https://a.test/x' },
        { title: 'b', url: 'https://b.test/p', properties: { url: 'https://b.test/2.jpg' } },
      ],
    };
    const out = parseBraveImages(json, 5);
    expect(out.map((r) => r.imageUrl)).toEqual(['https://a.test/1.jpg', 'https://b.test/2.jpg']);
    expect(parseBraveImages(json, 1)).toHaveLength(1);
    expect(parseBraveImages(null, 5)).toEqual([]);
  });
  it('valida la consulta', () => {
    expect(cleanQuery('  Ajax   2021 ')).toBe('Ajax 2021');
    expect(cleanQuery('a')).toBeNull();
    expect(cleanQuery('x'.repeat(201))).toBeNull();
    expect(braveUrl('a b', 20)).toContain('q=a+b');
  });
});

describe('cerca web com a font de candidates', () => {
  it('marca FKA, no inventa llicència', () => {
    const [a, b] = parseWebResponse({
      results: [
        { imageUrl: 'https://www.footballkitarchive.com/cdn/x/ajax.jpg', thumbnailUrl: null, pageUrl: 'https://www.footballkitarchive.com/ajax-2021-22-third-kit/', title: 'Ajax', width: null, height: null },
        { imageUrl: 'https://s.test/a.jpg', thumbnailUrl: null, pageUrl: 'https://s.test/a', title: 'Ajax', width: null, height: null },
      ],
    });
    expect(a.source).toBe('footballkitarchive');
    expect(b.source).toBe('web_search');
    expect(b.license).toBeNull();
  });

  it('afegeix com a màxim 4 candidates web i les altres fonts poden fallar', async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      imageUrl: `https://s.test/${i}.jpg`, thumbnailUrl: null, sourcePageUrl: `https://s.test/p${i}`, source: 'web_search' as const,
      title: i === 0 ? 'Ajax 2021-22 third shirt' : 'cosa', author: null, license: null, licenseUrl: null, width: null, height: null,
    }));
    const out = await searchImages(shirt, { fetchFn: failing, queries: ['ajax'], webSearch: async () => many });
    expect(out.candidates.length).toBe(4);
    expect(out.candidates[0].imageUrl).toBe('https://s.test/0.jpg');
    expect(out.errors.map((e) => e.source)).toEqual(['wikimedia_commons', 'openverse']);
  });

  it('si la cerca web no està configurada, no compta com a font ni com a error', async () => {
    const out = await searchImages(shirt, {
      fetchFn: failing, queries: ['ajax'],
      webSearch: async () => { throw new WebSearchUnavailable('no'); },
    });
    expect(out.sourcesTried).toBe(2);
    expect(out.errors).toHaveLength(2);
  });
});

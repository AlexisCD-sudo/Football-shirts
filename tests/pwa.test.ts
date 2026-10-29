import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url));

function pngSize(buf: Buffer): [number, number] {
  expect(buf.subarray(1, 4).toString()).toBe('PNG');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

describe('manifest i icones', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest').toString());

  it('és instal·lable: nom, arrel, mode independent i colors', () => {
    expect(manifest).toMatchObject({ lang: 'ca', start_url: '/', scope: '/', display: 'standalone' });
    expect(manifest.name).toBeTruthy();
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('declara icones 192 i 512 (i una maskable) que existeixen amb la mida indicada', () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons as { src: string; sizes: string }[]) {
      const [w, h] = pngSize(read(`public${icon.src}`) as Buffer);
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
    expect(pngSize(read('public/icons/apple-touch-icon.png') as Buffer)).toEqual([180, 180]);
  });

  it('index.html enllaça el manifest i les metadades d’instal·lació', () => {
    const html = read('index.html').toString();
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('apple-touch-icon');
  });
});

describe('service worker', () => {
  type Handler = (e: unknown) => void;
  function load() {
    const handlers: Record<string, Handler> = {};
    const store = new Map<string, Response>();
    const self = {
      location: { origin: 'https://app.test' },
      addEventListener: (type: string, h: Handler) => (handlers[type] = h),
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
    };
    const caches = {
      open: async () => ({ addAll: async () => {}, put: async (k: unknown, v: Response) => void store.set(String(k), v) }),
      match: async () => undefined,
      keys: async () => [],
      delete: async () => true,
    };
    runInNewContext(read('public/sw.js').toString(), { self, caches, URL, Response, fetch: async () => new Response('ok') });
    return handlers;
  }
  function fetchEvent(url: string, init: { method?: string; mode?: string } = {}) {
    let responded = false;
    return {
      event: {
        request: { url, method: init.method ?? 'GET', mode: init.mode ?? 'cors' },
        respondWith: () => {
          responded = true;
        },
      },
      get responded() {
        return responded;
      },
    };
  }

  it('MAI intercepta peticions a altres dominis (Supabase, fotos, tipografies)', () => {
    const h = load().fetch;
    for (const url of [
      'https://xyz.supabase.co/rest/v1/shirts?select=*',
      'https://xyz.supabase.co/auth/v1/token?grant_type=password',
      'https://xyz.supabase.co/storage/v1/object/sign/shirt-photos/a.jpg',
      'https://upload.wikimedia.org/a.jpg',
      'https://fonts.gstatic.com/x.woff2',
    ]) {
      const f = fetchEvent(url);
      h(f.event);
      expect(f.responded, url).toBe(false);
    }
  });

  it('no intercepta peticions que no siguin GET', () => {
    const f = fetchEvent('https://app.test/assets/a.js', { method: 'POST' });
    load().fetch(f.event);
    expect(f.responded).toBe(false);
  });

  it('gestiona la navegació i els fitxers amb hash del mateix domini, però no la resta', () => {
    const h = load().fetch;
    const nav = fetchEvent('https://app.test/', { mode: 'navigate' });
    h(nav.event);
    expect(nav.responded).toBe(true);
    const asset = fetchEvent('https://app.test/assets/index-abc123.js');
    h(asset.event);
    expect(asset.responded).toBe(true);
    const other = fetchEvent('https://app.test/api/whatever');
    h(other.event);
    expect(other.responded).toBe(false);
  });

  it('està registrat només en producció', () => {
    const main = read('src/main.tsx').toString();
    expect(main).toContain('import.meta.env.PROD');
    expect(main).toContain("register('/sw.js')");
  });
});

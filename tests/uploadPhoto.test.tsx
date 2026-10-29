import type { SupabaseClient } from '@supabase/supabase-js';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { fitWithin, validatePhotoFile } from '../src/lib/photoUpload';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import { SupabaseShirtRepository } from '../src/services/supabaseShirtRepository';
import { makeInput } from './helpers';

describe('validació i mida', () => {
  it('accepta JPG/PNG/WebP i rebutja la resta o fitxers massa grans', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validatePhotoFile({ type: 'image/webp', size: 1000 })).toBeNull();
    expect(validatePhotoFile({ type: 'image/gif', size: 1000 })).toMatch(/Format/);
    expect(validatePhotoFile({ type: 'application/pdf', size: 1000 })).toMatch(/Format/);
    expect(validatePhotoFile({ type: 'image/png', size: 0 })).toMatch(/buit/);
    expect(validatePhotoFile({ type: 'image/png', size: 16 * 1024 * 1024 })).toMatch(/15 MB/);
  });

  it('redueix mantenint la proporció i no amplia mai', () => {
    expect(fitWithin(3200, 1600)).toEqual({ width: 1600, height: 800 });
    expect(fitWithin(1000, 800)).toEqual({ width: 1000, height: 800 });
  });
});

describe('uploadPhoto (memòria)', () => {
  it('desa i confirma la foto pròpia; la nova substitueix l’anterior sense perdre-la', async () => {
    const repo = new MemoryShirtRepository();
    const s = await repo.createShirt(makeInput());
    await repo.uploadPhoto(s.id, new Blob(['a'], { type: 'image/jpeg' }), 'image/jpeg');
    const first = (await repo.listImages())[0];
    expect(first).toMatchObject({ origin: 'stored', status: 'confirmed', isPrimary: true });
    expect((await repo.listShirts())[0].photoUrl).toBe(first.imageUrl);
    await repo.uploadPhoto(s.id, new Blob(['b'], { type: 'image/png' }), 'image/png');
    const imgs = await repo.listImages();
    expect(imgs.filter((i) => i.isPrimary)).toHaveLength(1);
    expect(imgs).toHaveLength(2);
    await expect(repo.uploadPhoto(s.id, new Blob(['x']), 'image/gif')).rejects.toThrow(/Format/);
  });
});

/** Client fals amb builder, auth i storage, que registra què es puja i s'insereix. */
function fakeCloud(opts: { insertError?: boolean } = {}) {
  const uploaded: string[] = [];
  const removed: string[][] = [];
  const inserts: Record<string, unknown>[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          expect(bucket).toBe('shirt-photos');
          uploaded.push(path);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({ path, signedUrl: `https://signed.test/${path}?t=1` })),
          error: null,
        }),
      }),
    },
    from(table: string) {
      let action = 'select';
      const q = {
        select: () => q,
        eq: () => q,
        not: () => q,
        insert: (p: Record<string, unknown>) => {
          action = 'insert';
          if (table === 'shirt_images') inserts.push(p);
          return q;
        },
        update: () => {
          action = 'update';
          return q;
        },
        then: (res: (r: unknown) => unknown, rej: (e: unknown) => unknown) =>
          Promise.resolve(
            action === 'insert' && opts.insertError
              ? { data: null, error: { code: '42501', message: 'row-level security' } }
              : { data: [], error: null },
          ).then(res, rej),
      };
      return q;
    },
  };
  return { client: client as unknown as SupabaseClient, uploaded, removed, inserts };
}

describe('uploadPhoto (Supabase simulat)', () => {
  it('puja a la carpeta de l’usuari i la samarreta i desa una fila «stored» sense owner_id', async () => {
    const { client, uploaded, inserts } = fakeCloud();
    await new SupabaseShirtRepository(client).uploadPhoto('shirt1', new Blob(['a']), 'image/jpeg');
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]).toMatch(/^u1\/shirt1\/[0-9a-f-]+\.jpg$/);
    expect(inserts[0]).toMatchObject({ origin: 'stored', status: 'confirmed', is_primary: true, storage_path: uploaded[0] });
    expect(inserts[0]).not.toHaveProperty('owner_id');
  });

  it('desa l’origen (font, fitxa i permís) quan es puja des de Football Kit Archive', async () => {
    const { client, inserts } = fakeCloud();
    await new SupabaseShirtRepository(client).uploadPhoto('shirt1', new Blob(['a']), 'image/jpeg', {
      source: 'footballkitarchive',
      sourcePageUrl: 'https://www.footballkitarchive.com/es/x/',
      license: 'Ús personal',
    });
    expect(inserts[0]).toMatchObject({
      source: 'footballkitarchive', source_page_url: 'https://www.footballkitarchive.com/es/x/', license: 'Ús personal', origin: 'stored',
    });
  });

  it('si falla desar la fila, elimina el fitxer pujat (no deixa orfes)', async () => {
    const { client, uploaded, removed } = fakeCloud({ insertError: true });
    await expect(new SupabaseShirtRepository(client).uploadPhoto('shirt1', new Blob(['a']), 'image/png')).rejects.toThrow();
    expect(removed).toEqual([uploaded]);
  });

  it('rebutja formats no admesos abans de pujar res', async () => {
    const { client, uploaded } = fakeCloud();
    await expect(new SupabaseShirtRepository(client).uploadPhoto('s', new Blob(['a']), 'text/html')).rejects.toThrow(/Format/);
    expect(uploaded).toEqual([]);
  });
});

describe('interfície de pujada', () => {
  it('puja una foto i queda confirmada; permet eliminar-la', async () => {
    const user = userEvent.setup();
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Girona', season: '2017-18' }));
    render(<App repository={repo} />);
    await user.click(await screen.findByRole('button', { name: /Girona/ }));
    await user.click(within(await screen.findByRole('dialog', { name: /Girona/ })).getByRole('button', { name: 'Cerca fotos' }));
    const dialog = await screen.findByRole('dialog', { name: /Fotos/ });
    const file = new File(['abc'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(within(dialog).getByLabelText('Puja una foto'), file);
    await waitFor(async () => expect((await repo.listImages())[0]?.origin).toBe('stored'));
    expect(await within(dialog).findByRole('button', { name: 'Elimina la foto' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Elimina la foto' }));
    await waitFor(async () => expect(await repo.listImages()).toEqual([]));
  });

  it('mostra un error si el fitxer no és una imatge admesa', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Girona' }));
    render(<App repository={repo} />);
    await user.click(await screen.findByRole('button', { name: /Girona/ }));
    await user.click(within(await screen.findByRole('dialog', { name: /Girona/ })).getByRole('button', { name: 'Cerca fotos' }));
    const dialog = await screen.findByRole('dialog', { name: /Fotos/ });
    await user.upload(within(dialog).getByLabelText('Puja una foto'), new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Format no admès/);
    expect(await repo.listImages()).toEqual([]);
  });
});

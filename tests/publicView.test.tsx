import type { SupabaseClient } from '@supabase/supabase-js';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { PublicShirtRepository } from '../src/services/publicShirtRepository';

const row = (over: Record<string, unknown> = {}) => ({
  id: 's1', team_name: 'Girona', team_kind: 'club', country: null, season: '2020-21', competition: null, brand: 'Puma', model: null,
  kit_type: 'home', version: 'unknown', player_name: null, squad_number: null, size: 'M', manufacture_year: null, condition: null,
  authenticity: 'unverified', notes: null, curiosities: null, created_at: '2026-01-01', updated_at: '2026-01-01',
  image_id: null, image_origin: null, image_url: null, thumbnail_url: null, source_page_url: null, image_source: null,
  author: null, license: null, license_url: null, storage_path: null, ...over,
});

function fakeClient(rows: unknown[], opts: { error?: boolean } = {}): SupabaseClient {
  return {
    rpc: async () => (opts.error ? { data: null, error: { message: 'x' } } : { data: rows, error: null }),
    storage: { from: () => ({ createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed.test/${p}` })), error: null }) }) },
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ error: null }),
    },
  } as unknown as SupabaseClient;
}

describe('PublicShirtRepository', () => {
  it('llegeix només camps públics, firma les fotos pròpies i no té dades privades', async () => {
    const repo = new PublicShirtRepository(
      fakeClient([row({ image_id: 'i1', image_origin: 'stored', storage_path: 'u/s1/a.jpg' })]),
    );
    const [s] = await repo.listShirts();
    expect(s).toMatchObject({ price: null, seller: null, estimatedValue: null, location: null, provenance: null, photoUrl: 'https://signed.test/u/s1/a.jpg' });
    expect((await repo.listTeams()).map((t) => t.name)).toEqual(['Girona']);
    expect(await repo.listWishlist()).toEqual([]);
  });
  it('rebutja qualsevol escriptura', async () => {
    const repo = new PublicShirtRepository(fakeClient([]));
    await expect(repo.deleteShirt('s1')).rejects.toThrow(/només lectura/);
    await expect(repo.uploadPhoto('s1', new Blob(), 'image/jpeg')).rejects.toThrow(/només lectura/);
    await expect(repo.createShirt({} as never)).rejects.toThrow(/només lectura/);
  });
});

describe('app sense sessió', () => {
  it('mostra la col·lecció en només lectura, sense botons d’edició ni formulari de correu', async () => {
    const user = userEvent.setup();
    render(<App client={fakeClient([row()])} />);
    expect(await screen.findByRole('button', { name: /Girona/ })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/només lectura/);
    for (const name of ['Afegeix samarreta', 'Importa', 'Exporta']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Correu electrònic')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desitjos' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Girona/ }));
    const d = await screen.findByRole('dialog', { name: /Girona/ });
    expect(within(d).queryByRole('button', { name: 'Edita' })).not.toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: 'Elimina' })).not.toBeInTheDocument();
  });

  it('mostra les estadístiques sense la secció de dades per completar ni preus', async () => {
    const user = userEvent.setup();
    render(<App client={fakeClient([row(), row({ id: 's2', team_name: 'Ajax', brand: 'Adidas' })])} />);
    await user.click(await screen.findByRole('button', { name: 'Estadístiques' }));
    expect(await screen.findByText('Per equip')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Dades per completar' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Preu/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finances' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Col·lecció' }));
    expect(await screen.findByRole('button', { name: /Girona/ })).toBeInTheDocument();
  });

  it('«Entra per editar» mostra el correu i la contrasenya, i es pot tornar', async () => {
    const user = userEvent.setup();
    render(<App client={fakeClient([row()])} />);
    await user.click(await screen.findByRole('button', { name: 'Entra per editar' }));
    expect(screen.getByLabelText('Correu electrònic')).toBeInTheDocument();
    expect(screen.getByLabelText('Contrasenya')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Torna a la col·lecció' }));
    expect(await screen.findByRole('button', { name: /Girona/ })).toBeInTheDocument();
  });

  it('si la col·lecció no és pública, ho diu i deixa entrar', async () => {
    render(<App client={fakeClient([], { error: true })} />);
    expect(await screen.findByText(/No s’ha pogut carregar la col·lecció pública/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entra per editar' })).toBeInTheDocument();
  });
});

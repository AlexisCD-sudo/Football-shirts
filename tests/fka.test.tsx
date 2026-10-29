import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { fkaSearchText, isFkaUrl, isHttpUrl, parseFkaKitUrl } from '../src/lib/fka';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import { makeInput } from './helpers';

describe('utilitats de Football Kit Archive', () => {
  it('reconeix només enllaços http(s) del seu domini', () => {
    expect(isFkaUrl('https://www.footballkitarchive.com/es/ajax-2021-22-third-kit/')).toBe(true);
    expect(isFkaUrl('https://footballkitarchive.com/x')).toBe(true);
    expect(isFkaUrl('https://evil-footballkitarchive.com/x')).toBe(false);
    expect(isFkaUrl('https://footballkitarchive.com.evil.com/x')).toBe(false);
    expect(isFkaUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('ftp://x')).toBe(false);
    expect(isHttpUrl('https://x.test/a')).toBe(true);
  });

  it('dedueix equip, temporada i equipació del text de l’URL (només com a suggeriment)', () => {
    expect(parseFkaKitUrl('https://www.footballkitarchive.com/es/ajax-2021-22-third-kit/')).toMatchObject({
      teamName: 'Ajax', season: '2021-22', kitType: 'third',
    });
    expect(parseFkaKitUrl('https://www.footballkitarchive.com/real-madrid-2005-06-home-kit')).toMatchObject({
      teamName: 'Real Madrid', season: '2005-06', kitType: 'home',
    });
    expect(parseFkaKitUrl('https://www.footballkitarchive.com/fc-barcelona-2008-09-goalkeeper-kit/')).toMatchObject({
      teamName: 'FC Barcelona', kitType: 'goalkeeper',
    });
  });

  it('no inventa res quan no pot deduir-ho', () => {
    expect(parseFkaKitUrl('https://www.footballkitarchive.com/es/')).toEqual({ teamName: null, season: null, kitType: null, slug: 'es' });
    // Temporada no consecutiva: no es dedueix.
    expect(parseFkaKitUrl('https://x.test/ajax-2021-25-home-kit').season).toBeNull();
    expect(parseFkaKitUrl('no és una url')).toEqual({ teamName: null, season: null, kitType: null, slug: null });
    expect(fkaSearchText({ teamName: 'Ajax', season: '2021-22', kitType: 'third' })).toBe('Ajax 2021-22 third');
  });
});

describe('flux «Des de Football Kit Archive»', () => {
  async function openFlow(user: ReturnType<typeof userEvent.setup>, repo: MemoryShirtRepository) {
    render(<App repository={repo} />);
    await user.click(await screen.findByRole('button', { name: 'Des de Football Kit Archive' }));
    await user.click(await screen.findByRole('button', { name: 'Una sola samarreta (pas a pas)' }));
    return screen.findByRole('dialog', { name: 'Afegeix des de Football Kit Archive' });
  }

  it('proposa dades, deixa corregir-les i desa la samarreta amb la imatge i la font', async () => {
    const user = userEvent.setup();
    const repo = new MemoryShirtRepository();
    const dialog = await openFlow(user, repo);
    expect(within(dialog).getByRole('link', { name: /Obre Football Kit Archive/ })).toHaveAttribute('rel', expect.stringContaining('noopener'));
    await user.type(within(dialog).getByPlaceholderText(/footballkitarchive/), 'https://www.footballkitarchive.com/es/ajax-2021-22-third-kit/');
    expect(within(dialog).getByRole('note')).toHaveTextContent(/Ajax · 2021-22 · Tercera/);
    expect(within(dialog).getByRole('note')).toHaveTextContent(/no és una coincidència verificada/);
    await user.type(within(dialog).getByLabelText('Adreça de la imatge'), 'https://img.test/ajax.jpg');
    await user.type(within(dialog).getByLabelText('Patrocinador (opcional)'), 'Ziggo');
    await user.click(within(dialog).getByRole('button', { name: 'Continua: revisa les dades' }));

    const form = await screen.findByRole('dialog', { name: 'Revisa les dades' });
    expect(within(form).getByLabelText('Equip o selecció')).toHaveValue('Ajax');
    expect(within(form).getByLabelText('Temporada')).toHaveValue('2021-22');
    expect(within(form).getByLabelText('Procedència')).toHaveValue('Football Kit Archive: https://www.footballkitarchive.com/es/ajax-2021-22-third-kit/');
    expect(within(form).getByLabelText('Observacions')).toHaveValue('Patrocinador: Ziggo');
    // Es poden corregir les dades abans de desar.
    await user.type(within(form).getByLabelText('Marca'), 'Adidas');
    await user.click(within(form).getByRole('button', { name: 'Desa' }));

    await waitFor(async () => expect(await repo.listShirts()).toHaveLength(1));
    const [shirt] = await repo.listShirts();
    expect(shirt).toMatchObject({ season: '2021-22', kitType: 'third', brand: 'Adidas', photoUrl: 'https://img.test/ajax.jpg' });
    const [img] = await repo.listImages();
    expect(img).toMatchObject({
      origin: 'external', status: 'confirmed', source: 'footballkitarchive',
      sourcePageUrl: 'https://www.footballkitarchive.com/es/ajax-2021-22-third-kit/',
      license: 'Ús personal (permís assumit pel propietari)',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/s’ha afegit a la col·lecció/);
  });

  it('pujant un fitxer, la còpia queda privada i conserva l’enllaç de la fitxa', async () => {
    const user = userEvent.setup();
    const repo = new MemoryShirtRepository();
    const dialog = await openFlow(user, repo);
    await user.type(within(dialog).getByPlaceholderText(/footballkitarchive/), 'https://www.footballkitarchive.com/es/ajax-2021-22-home-kit/');
    await user.upload(within(dialog).getByLabelText('Puja la imatge'), new File(['abc'], 'a.jpg', { type: 'image/jpeg' }));
    await user.click(within(dialog).getByRole('button', { name: 'Continua: revisa les dades' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Revisa les dades' })).getByRole('button', { name: 'Desa' }));
    await waitFor(async () => expect(await repo.listImages()).toHaveLength(1));
    expect((await repo.listImages())[0]).toMatchObject({
      origin: 'stored', source: 'footballkitarchive',
      sourcePageUrl: 'https://www.footballkitarchive.com/es/ajax-2021-22-home-kit/',
    });
  });

  it('exigeix un enllaç vàlid de la fitxa i rebutja javascript:', async () => {
    const user = userEvent.setup();
    const repo = new MemoryShirtRepository();
    const dialog = await openFlow(user, repo);
    await user.click(within(dialog).getByRole('button', { name: 'Continua: revisa les dades' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Enganxa l’enllaç de la fitxa/);
    await user.type(within(dialog).getByPlaceholderText(/footballkitarchive/), 'https://www.footballkitarchive.com/x');
    await user.type(within(dialog).getByLabelText('Adreça de la imatge'), 'javascript:alert(1)');
    await user.click(within(dialog).getByRole('button', { name: 'Continua: revisa les dades' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/http/);
    expect(await repo.listShirts()).toEqual([]);
  });

  it('avisa (sense bloquejar) si ja tens una samarreta igual', async () => {
    const user = userEvent.setup();
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Ajax', season: '2021-22', kitType: 'third' }));
    const dialog = await openFlow(user, repo);
    await user.type(within(dialog).getByPlaceholderText(/footballkitarchive/), 'https://www.footballkitarchive.com/es/ajax-2021-22-third-kit/');
    await user.click(within(dialog).getByRole('button', { name: 'Continua: revisa les dades' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Revisa les dades' })).getByRole('button', { name: 'Desa' }));
    await waitFor(async () => expect(await repo.listShirts()).toHaveLength(2));
    expect(await screen.findByRole('status')).toHaveTextContent(/ja tenies una samarreta/);
  });
});

describe('enllaç manual a una samarreta existent', () => {
  it('marca la font com a Football Kit Archive quan l’enllaç és del seu domini', async () => {
    const user = userEvent.setup();
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Girona', season: '2017-18' }));
    render(<App repository={repo} />);
    await user.click(await screen.findByRole('button', { name: /Girona/ }));
    await user.click(within(await screen.findByRole('dialog', { name: /Girona/ })).getByRole('button', { name: 'Cerca fotos' }));
    const dialog = await screen.findByRole('dialog', { name: /Fotos/ });
    expect(within(dialog).getByText(/Girona 2017-18/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('URL de la imatge'), 'https://img.test/g.jpg');
    await user.type(within(dialog).getByLabelText("Pàgina d'origen"), 'https://www.footballkitarchive.com/es/girona-2017-18-home-kit/');
    await user.click(within(dialog).getByRole('button', { name: 'Afegeix i confirma' }));
    await waitFor(async () => expect((await repo.listImages())[0]?.source).toBe('footballkitarchive'));
  });
});

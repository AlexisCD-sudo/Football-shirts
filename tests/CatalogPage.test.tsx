import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import { makeInput } from './helpers';

describe('Catàleg', () => {
  it('mostra l’estat buit quan no hi ha samarretes', async () => {
    render(<App repository={new MemoryShirtRepository()} />);
    expect(await screen.findByText('Encara no tens cap samarreta')).toBeInTheDocument();
  });

  it('crea una samarreta des del formulari', async () => {
    const user = userEvent.setup();
    render(<App repository={new MemoryShirtRepository()} />);
    await user.click(await screen.findByRole('button', { name: 'Afegeix samarreta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova samarreta' });
    await user.type(within(dialog).getByLabelText('Equip o selecció'), 'Girona');
    await user.type(within(dialog).getByLabelText('Temporada'), '2017-18');
    await user.click(within(dialog).getByRole('button', { name: 'Desa' }));
    expect(await screen.findByRole('button', { name: /Girona/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mostra errors de validació i no desa', async () => {
    const user = userEvent.setup();
    render(<App repository={new MemoryShirtRepository()} />);
    await user.click(await screen.findByRole('button', { name: 'Afegeix samarreta' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Equip o selecció'), 'Girona');
    await user.type(within(dialog).getByLabelText('Temporada'), '2017');
    await user.click(within(dialog).getByRole('button', { name: 'Desa' }));
    expect(await within(dialog).findByText('Format AAAA-AA (p. ex. 2010-11)')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('cerca i filtra', async () => {
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Barça', season: '2010-11' }));
    await repo.createShirt(makeInput({ teamName: 'Girona', season: '2017-18' }));
    const user = userEvent.setup();
    render(<App repository={repo} />);
    expect(await screen.findByText('2 de 2 samarretes')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Cerca' }), 'giro');
    expect(await screen.findByText('1 de 2 samarretes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Neteja filtres' }));
    expect(await screen.findByText('2 de 2 samarretes')).toBeInTheDocument();
  });

  it('elimina una samarreta després de confirmar', async () => {
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Barça' }));
    const user = userEvent.setup();
    render(<App repository={repo} />);
    await user.click(await screen.findByRole('button', { name: /Barça/ }));
    await user.click(await screen.findByRole('button', { name: 'Elimina' }));
    const confirm = await screen.findByRole('dialog', { name: 'Eliminar samarreta' });
    await user.click(within(confirm).getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(screen.getByText('Encara no tens cap samarreta')).toBeInTheDocument());
    expect(await repo.listShirts()).toHaveLength(0);
  });

  it('mostra un error amb opció de reintentar si la càrrega falla', async () => {
    const repo = new MemoryShirtRepository();
    repo.listShirts = () => Promise.reject(new Error('Sense connexió'));
    render(<App repository={repo} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sense connexió');
    expect(screen.getByRole('button', { name: 'Torna-ho a provar' })).toBeInTheDocument();
  });
});

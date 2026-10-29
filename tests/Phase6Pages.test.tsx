import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import { makeInput } from './helpers';

async function goTo(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name }));
}

describe('Navegació', () => {
  it('comença a la col·lecció i canvia de secció', async () => {
    const user = userEvent.setup();
    render(<App repository={new MemoryShirtRepository()} />);
    expect(await screen.findByText('Encara no tens cap samarreta')).toBeInTheDocument();
    await goTo(user, 'Desitjos');
    expect(await screen.findByText(/Encara no tens cap desig/)).toBeInTheDocument();
    await goTo(user, 'Estadístiques');
    expect(await screen.findByText(/Encara no hi ha samarretes/)).toBeInTheDocument();
  });
});

describe('Desitjos', () => {
  it('afegeix un desig, el valida i el converteix en samarreta amb «Ja la tinc»', async () => {
    const user = userEvent.setup();
    const repo = new MemoryShirtRepository();
    render(<App repository={repo} />);
    await goTo(user, 'Desitjos');
    await user.click(await screen.findByRole('button', { name: 'Afegeix un desig' }));
    let dialog = await screen.findByRole('dialog', { name: 'Nou desig' });
    await user.click(within(dialog).getByRole('button', { name: 'Desa' }));
    expect(await within(dialog).findByText('Escriu l’equip o la selecció.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Equip o selecció'), 'Girona');
    await user.type(within(dialog).getByLabelText('Temporada'), '2017-18');
    await user.type(within(dialog).getByLabelText('Preu màxim (€)'), '45,50');
    await user.click(within(dialog).getByRole('button', { name: 'Desa' }));
    expect(await screen.findByText('Girona')).toBeInTheDocument();
    expect((await repo.listWishlist())[0]).toMatchObject({ maxPrice: 45.5, season: '2017-18' });

    await user.click(screen.getByRole('button', { name: 'Ja la tinc' }));
    dialog = await screen.findByRole('dialog', { name: 'Nova samarreta' });
    expect(within(dialog).getByLabelText('Equip o selecció')).toHaveValue('Girona');
    expect(within(dialog).getByLabelText('Temporada')).toHaveValue('2017-18');
    await user.click(within(dialog).getByRole('button', { name: 'Desa' }));
    await waitFor(async () => expect((await repo.listShirts())).toHaveLength(1));
    const [w] = await repo.listWishlist();
    expect(w.status).toBe('acquired');
    expect(w.acquiredShirtId).toBe((await repo.listShirts())[0].id);
    expect(await screen.findByRole('status')).toHaveTextContent(/afegit a la col·lecció/);
  });
});

describe('Finances i estadístiques', () => {
  it('mostra els imports, mai inventa preus i permet desar un pressupost', async () => {
    const user = userEvent.setup();
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Girona', price: 40, shippingCost: 5, purchaseDate: '2025-05-01' }));
    await repo.createShirt(makeInput({ teamName: 'Barça' }));
    render(<App repository={repo} />);
    await goTo(user, 'Finances');
    expect(await screen.findByText('Despesa total')).toBeInTheDocument();
    expect(screen.getByText(/1 samarretes no tenen preu/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Any del pressupost'));
    await user.type(screen.getByLabelText('Any del pressupost'), '2025');
    await user.type(screen.getByLabelText('Import del pressupost'), '100');
    await user.click(screen.getByRole('button', { name: 'Desa el pressupost' }));
    expect(await screen.findByRole('button', { name: 'Elimina el pressupost de 2025' })).toBeInTheDocument();
    expect(await repo.listBudgets()).toEqual([{ year: 2025, amount: 100 }]);
  });

  it('mostra les estadístiques per equip i les dades per completar', async () => {
    const user = userEvent.setup();
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Girona', season: '2017-18', brand: 'Nike' }));
    await repo.createShirt(makeInput({ teamName: 'Girona', season: '2018-19' }));
    render(<App repository={repo} />);
    await goTo(user, 'Estadístiques');
    const byTeam = await screen.findByRole('region', { name: 'Per equip' });
    expect(within(byTeam).getByText('Girona')).toBeInTheDocument();
    expect(within(byTeam).getByText('2')).toBeInTheDocument();
    const gaps = screen.getByRole('region', { name: 'Dades per completar' });
    expect(within(gaps).getByText(/Marca/).parentElement).toHaveTextContent('1 / 2 · falten 1');
  });
});

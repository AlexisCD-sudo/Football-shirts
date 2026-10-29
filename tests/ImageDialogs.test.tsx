import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import { makeInput } from './helpers';

async function withCandidate() {
  const repo = new MemoryShirtRepository();
  const s = await repo.createShirt(makeInput({ teamName: 'Girona', season: '2017-18' }));
  await repo.addCandidates(s.id, [
    {
      imageUrl: 'https://img.test/a.jpg',
      thumbnailUrl: null,
      sourcePageUrl: 'https://page.test/a',
      source: 'wikimedia_commons',
      author: 'Anna',
      license: 'CC BY 4.0',
      licenseUrl: null,
      matchScore: 0.8,
    },
  ]);
  return repo;
}

describe('Fotos', () => {
  it('mostra les candidates, la font i la llicència, i les confirma manualment', async () => {
    const user = userEvent.setup();
    const repo = await withCandidate();
    render(<App repository={repo} />);
    expect(await screen.findByText('Per revisar')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Girona/ }));
    await user.click(screen.getByRole('button', { name: 'Cerca fotos' }));
    const dialog = await screen.findByRole('dialog', { name: /Fotos/ });
    expect(within(dialog).getByText(/CC BY 4.0/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /pàgina d’origen/ })).toHaveAttribute('href', 'https://page.test/a');
    // Encara no s'ha assignat res automàticament.
    expect((await repo.listShirts())[0].photoUrl).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Confirma' }));
    await waitFor(async () => expect((await repo.listShirts())[0].photoUrl).toBe('https://img.test/a.jpg'));
    expect(await within(dialog).findByRole('button', { name: 'Treu la foto' })).toBeInTheDocument();
  });

  it('rebutja una candidata i no la torna a proposar', async () => {
    const user = userEvent.setup();
    const repo = await withCandidate();
    render(<App repository={repo} />);
    await user.click(await screen.findByRole('button', { name: /Girona/ }));
    await user.click(screen.getByRole('button', { name: 'Cerca fotos' }));
    const dialog = await screen.findByRole('dialog', { name: /Fotos/ });
    await user.click(within(dialog).getByRole('button', { name: 'Rebutja' }));
    expect(await within(dialog).findByText('Cap candidata per revisar.')).toBeInTheDocument();
    expect((await repo.listImages())[0].status).toBe('rejected');
  });

  it('obre el diàleg de cerca per lots i explica que no assigna res', async () => {
    const user = userEvent.setup();
    const repo = await withCandidate();
    render(<App repository={repo} />);
    await user.click(await screen.findByRole('button', { name: 'Cerca fotos' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cerca de fotos per lots' });
    expect(within(dialog).getByText(/No s’assigna cap foto automàticament/)).toBeInTheDocument();
    expect(await within(dialog).findByRole('button', { name: /Cerca per a 1 samarretes sense foto/ })).toBeInTheDocument();
    expect(within(dialog).getByText('Per revisar (1)')).toBeInTheDocument();
  });
});

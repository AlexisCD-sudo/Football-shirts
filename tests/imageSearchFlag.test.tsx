import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import { makeInput } from './helpers';

afterEach(() => vi.unstubAllEnvs());

describe('cerca d’imatges desactivada (per defecte a producció)', () => {
  it('amaga la cerca, les candidates i l’enllaç, però deixa pujar fotos pròpies', async () => {
    vi.stubEnv('VITE_ENABLE_IMAGE_SEARCH', 'false');
    const user = userEvent.setup();
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Girona', season: '2020-21' }));
    render(<App repository={repo} />);
    expect(await screen.findByRole('button', { name: 'Afegeix samarreta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerca fotos' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Girona/ }));
    const detail = await screen.findByRole('dialog', { name: /Girona/ });
    await user.click(within(detail).getByRole('button', { name: 'Afegeix una foto' }));
    const photos = await screen.findByRole('dialog', { name: /Fotos/ });
    expect(within(photos).getByLabelText('Puja una foto')).toBeInTheDocument();
    expect(within(photos).queryByLabelText('Consulta de cerca')).not.toBeInTheDocument();
    expect(within(photos).queryByText(/Candidates/)).not.toBeInTheDocument();
    expect(within(photos).queryByLabelText('URL de la imatge')).not.toBeInTheDocument();
  });
});

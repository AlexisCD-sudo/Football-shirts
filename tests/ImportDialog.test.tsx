import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import { makeInput } from './helpers';

const CSV = [
  'Equip,Any,Nom,Home/away,Rèpliques,Curiositats',
  'Barça,2010-11,,Home,,Any Triplet',
  'Argentina,2005-2006,Messi,Away,,',
  'Roma,2001-02,,Home,,',
  'Girona,2017-18,,Home,,',
  'Ajax,2021-22,,Away,,',
  'Celtic,2007-08,,Home,,',
  'Fulham,2016-17,,Home,,',
].join('\n');

async function openImport(repo: MemoryShirtRepository, user: ReturnType<typeof userEvent.setup>, csv = CSV) {
  render(<App repository={repo} />);
  await user.click(await screen.findByRole('button', { name: 'Importa' }));
  const dialog = await screen.findByRole('dialog', { name: 'Importa samarretes' });
  const file = new File([csv], 'samarretes.csv', { type: 'text/csv' });
  await user.upload(within(dialog).getByLabelText('Fitxer'), file);
  await within(dialog).findByLabelText('Camp per a la columna Equip');
  return dialog;
}

describe('Importació (interfície)', () => {
  it('mostra mapeig, resum i vista prèvia, i importa només la mostra per defecte', async () => {
    const repo = new MemoryShirtRepository();
    const user = userEvent.setup();
    const dialog = await openImport(repo, user);

    expect(within(dialog).getByLabelText('Camp per a la columna Equip')).toHaveValue('teamName');
    expect(within(dialog).getByLabelText('Camp per a la columna Any')).toHaveValue('season');
    expect(within(dialog).getByText(/normalitzada a 2005-06/)).toBeInTheDocument();

    const importBtn = within(dialog).getByRole('button', { name: 'Importa 5 samarretes' });
    await user.click(importBtn);
    expect(await within(dialog).findByText('Importació acabada')).toBeInTheDocument();
    expect(await repo.listShirts()).toHaveLength(5);
  });

  it('importa totes les files si es tria, i no importa les desmarcades', async () => {
    const repo = new MemoryShirtRepository();
    const user = userEvent.setup();
    const dialog = await openImport(repo, user);
    await user.click(within(dialog).getByLabelText(/Totes les files marcades/));
    await user.click(within(dialog).getByLabelText('Importa la fila 3'));
    await user.click(within(dialog).getByRole('button', { name: 'Importa 6 samarretes' }));
    await within(dialog).findByText('Importació acabada');
    const shirts = await repo.listShirts();
    expect(shirts).toHaveLength(6);
    expect(shirts.some((s) => s.team.name === 'Argentina')).toBe(false);
    expect(shirts.find((s) => s.team.name === 'Barça')?.originalData).toMatchObject({ Curiositats: 'Any Triplet' });
  });

  it('marca com a duplicat el que ja existeix i el deixa desmarcat', async () => {
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Barça', season: '2010-11', kitType: 'home' }));
    const user = userEvent.setup();
    const dialog = await openImport(repo, user);
    expect(within(dialog).getByText(/Ja existeix a la col·lecció/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Importa la fila 2')).not.toBeChecked();
    await user.click(within(dialog).getByLabelText(/Totes les files marcades/));
    await user.click(within(dialog).getByRole('button', { name: 'Importa 6 samarretes' }));
    await within(dialog).findByText('Importació acabada');
    expect(await repo.listShirts()).toHaveLength(7); // 1 existent + 6 noves; res no s'ha fusionat ni esborrat
  });

  it('avisa si es carrega un fitxer de Numbers', async () => {
    const repo = new MemoryShirtRepository();
    const user = userEvent.setup({ applyAccept: false });
    render(<App repository={repo} />);
    await user.click(await screen.findByRole('button', { name: 'Importa' }));
    const dialog = await screen.findByRole('dialog', { name: 'Importa samarretes' });
    await user.upload(within(dialog).getByLabelText('Fitxer'), new File(['x'], 'col.numbers'));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Numbers/);
  });

  it('exigeix assignar l’equip abans d’importar', async () => {
    const repo = new MemoryShirtRepository();
    const user = userEvent.setup();
    const dialog = await openImport(repo, user);
    await user.selectOptions(within(dialog).getByLabelText('Camp per a la columna Equip'), 'ignore');
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/«Equip»/);
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /Importa 0/ })).toBeDisabled());
  });
});

describe('Exportació (interfície)', () => {
  it('mostra el nombre de samarretes i els tres formats', async () => {
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Barça' }));
    const user = userEvent.setup();
    render(<App repository={repo} />);
    await user.click(await screen.findByRole('button', { name: 'Exporta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Exporta la col·lecció' });
    expect(within(dialog).getByText(/1 samarretes/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Excel (.xlsx)' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'CSV (.csv)' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'JSON complet (.json)' })).toBeEnabled();
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { backupToJson, buildBackup, inspectBackup } from '../src/lib/backup';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import { makeInput } from './helpers';

async function filled() {
  const repo = new MemoryShirtRepository();
  const s = await repo.createShirt(makeInput({ teamName: 'Girona', season: '2017-18', price: 40 }));
  await repo.addCandidates(s.id, [
    { imageUrl: 'https://img/a.jpg', thumbnailUrl: null, sourcePageUrl: 'https://p/a', source: 'openverse', author: null, license: 'CC0', licenseUrl: null, matchScore: 0.7 },
  ]);
  await repo.uploadPhoto(s.id, new Blob(['x']), 'image/jpeg');
  await repo.createWishlistItem({
    teamName: 'Barça', teamKind: 'club', country: null, season: null, kitType: null, playerName: null, priority: 1,
    maxPrice: 50, purchaseUrl: null, referenceImageUrl: null, notes: null, status: 'wanted',
  });
  await repo.setBudget(2026, 300);
  return repo;
}

async function data(repo: MemoryShirtRepository) {
  return {
    shirts: await repo.listShirts(),
    teams: await repo.listTeams(),
    images: await repo.listImages(),
    wishlist: await repo.listWishlist(),
    budgets: await repo.listBudgets(),
  };
}

describe('còpia de seguretat', () => {
  it('inclou totes les seccions, els recomptes i descarta les adreces temporals de les fotos pròpies', async () => {
    const b = buildBackup(await data(await filled()), new Date('2026-10-29T10:00:00Z'));
    expect(b).toMatchObject({ format: 'football-shirts-backup', version: 2, exportedAt: '2026-10-29T10:00:00.000Z' });
    expect(b.counts).toEqual({ shirts: 1, teams: 2, images: 2, wishlist: 1, budgets: 1 });
    const own = b.images.find((i) => i.origin === 'stored')!;
    expect(own.imageUrl).toBeNull();
    expect(own.storagePath).toBeTruthy();
    expect(b.shirts[0]).not.toHaveProperty('photoUrl');
  });

  it('una còpia generada es verifica correctament', async () => {
    const json = backupToJson(await data(await filled()));
    const r = inspectBackup(json);
    expect(r).toMatchObject({ ok: true, counts: { shirts: 1, wishlist: 1, budgets: 1 } });
  });

  it('detecta fitxers invàlids, d’un altre format o incomplets', async () => {
    expect(inspectBackup('no és json')).toMatchObject({ ok: false });
    expect(inspectBackup('{"format":"altre"}')).toMatchObject({ ok: false });
    const b = JSON.parse(backupToJson(await data(await filled())));
    b.shirts = [];
    expect(inspectBackup(JSON.stringify(b))).toMatchObject({ ok: false, error: expect.stringContaining('incompleta') });
    delete b.budgets;
    expect(inspectBackup(JSON.stringify(b))).toMatchObject({ ok: false });
    expect(inspectBackup(JSON.stringify({ ...JSON.parse(backupToJson(await data(await filled()))), version: 9 }))).toMatchObject({ ok: false });
  });
});

describe('diàleg d’exportació', () => {
  it('descarrega la còpia completa i verifica un fitxer', async () => {
    const user = userEvent.setup();
    const repo = await filled();
    const created: Blob[] = [];
    const prev = { c: URL.createObjectURL, r: URL.revokeObjectURL };
    URL.createObjectURL = (b: Blob | MediaSource) => (created.push(b as Blob), 'blob:x');
    URL.revokeObjectURL = () => {};
    render(<App repository={repo} />);
    await user.click(await screen.findByRole('button', { name: 'Exporta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Exporta la col·lecció' });
    await user.click(within(dialog).getByRole('button', { name: 'Descarrega la còpia (.json)' }));
    await vi.waitFor(() => expect(created).toHaveLength(1));
    const text = await created[0].text();
    expect(inspectBackup(text).ok).toBe(true);
    await user.upload(within(dialog).getByLabelText('Verifica una còpia'), new File([text], 'c.json', { type: 'application/json' }));
    expect(await within(dialog).findByRole('status')).toHaveTextContent(/Còpia vàlida.*1 samarretes/);
    await user.upload(within(dialog).getByLabelText('Verifica una còpia'), new File(['{}'], 'x.json', { type: 'application/json' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/no és una còpia/);
    URL.createObjectURL = prev.c;
    URL.revokeObjectURL = prev.r;
  });
});

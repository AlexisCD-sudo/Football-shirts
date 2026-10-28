import { describe, expect, it } from 'vitest';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import { makeInput } from './helpers';

const meta = { filename: 'x.csv', columnMapping: {}, summary: {} };

describe('importShirts (memòria)', () => {
  it('importa amb la fila original, el número de fila i el lot', async () => {
    const repo = new MemoryShirtRepository();
    const progress: number[] = [];
    const report = await repo.importShirts(
      [
        { input: makeInput({ teamName: 'Roma', season: '2001-02' }), sourceRow: 2, original: { Equip: 'Roma', Extra: 'x' } },
        { input: makeInput({ teamName: 'Lazio' }), sourceRow: 3, original: { Equip: 'Lazio' } },
      ],
      meta,
      (done) => progress.push(done),
    );
    expect(report.imported).toBe(2);
    expect(report.failed).toEqual([]);
    expect(progress).toEqual([1, 2]);
    const shirts = await repo.listShirts();
    expect(shirts).toHaveLength(2);
    const roma = shirts.find((s) => s.team.name === 'Roma')!;
    expect(roma.sourceRow).toBe(2);
    expect(roma.originalData).toEqual({ Equip: 'Roma', Extra: 'x' });
    expect(roma.importBatchId).toBe(report.batchId);
  });

  it('no modifica el tipus ni el país d’un equip existent', async () => {
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Itàlia', teamKind: 'national', country: 'Itàlia' }));
    await repo.importShirts(
      [{ input: makeInput({ teamName: 'itàlia', teamKind: 'club', country: null }), sourceRow: 2, original: {} }],
      meta,
    );
    const [team] = await repo.listTeams();
    expect(team.kind).toBe('national');
    expect(team.country).toBe('Itàlia');
    expect(await repo.listTeams()).toHaveLength(1);
  });

  it('no elimina res de la col·lecció existent', async () => {
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Barça' }));
    await repo.importShirts([{ input: makeInput({ teamName: 'Barça' }), sourceRow: 2, original: {} }], meta);
    expect(await repo.listShirts()).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import { makeInput } from './helpers';

describe('MemoryShirtRepository', () => {
  it('comença buit', async () => {
    const repo = new MemoryShirtRepository();
    expect(await repo.listShirts()).toEqual([]);
    expect(await repo.listTeams()).toEqual([]);
  });

  it('crea una samarreta i reutilitza l’equip encara que canviïn accents o majúscules', async () => {
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Barça', season: '2010-11' }));
    await repo.createShirt(makeInput({ teamName: 'barca', season: '2019-20' }));
    expect(await repo.listShirts()).toHaveLength(2);
    expect(await repo.listTeams()).toHaveLength(1);
  });

  it('edita una samarreta i en conserva l’identificador i la data d’alta', async () => {
    const repo = new MemoryShirtRepository();
    const created = await repo.createShirt(makeInput({ season: '2010-11' }));
    const updated = await repo.updateShirt(created.id, makeInput({ season: '2011-12', playerName: 'Xavi' }));
    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.season).toBe('2011-12');
    expect((await repo.listShirts())[0].playerName).toBe('Xavi');
  });

  it('elimina una samarreta i falla si ja no existeix', async () => {
    const repo = new MemoryShirtRepository();
    const created = await repo.createShirt(makeInput());
    await repo.deleteShirt(created.id);
    expect(await repo.listShirts()).toHaveLength(0);
    await expect(repo.deleteShirt(created.id)).rejects.toThrow();
    await expect(repo.updateShirt(created.id, makeInput())).rejects.toThrow();
  });

  it('no deixa que el consumidor modifiqui l’estat intern', async () => {
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Roma' }));
    const [shirt] = await repo.listShirts();
    shirt.team.name = 'Hackejat';
    expect((await repo.listShirts())[0].team.name).toBe('Roma');
  });
});

import { describe, expect, it } from 'vitest';
import { computeFinance, wishlistBudget } from '../src/lib/finance';
import { computeStats, decadeOf, tally, UNSPECIFIED } from '../src/lib/stats';
import { normalizeSeason, parseWishlistForm, emptyWishlistValues } from '../src/lib/wishlistSchema';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import type { Shirt, WishlistItem } from '../src/types/shirt';
import { makeInput } from './helpers';

async function build(inputs: Parameters<typeof makeInput>[0][]): Promise<Shirt[]> {
  const repo = new MemoryShirtRepository();
  for (const i of inputs) await repo.createShirt(makeInput(i));
  return repo.listShirts();
}

describe('estadístiques', () => {
  it('compta per equip, marca i dècada, i deixa «Sense especificar» al final', async () => {
    const shirts = await build([
      { teamName: 'Barça', season: '2005-06', brand: 'Nike', country: 'Espanya' },
      { teamName: 'Barça', season: '2012-13', brand: 'Nike', country: 'Espanya' },
      { teamName: 'Girona', season: null, brand: null, country: null },
    ]);
    const st = computeStats(shirts);
    expect(st.total).toBe(3);
    expect(st.teams).toBe(2);
    expect(st.countries).toBe(1);
    expect(st.byTeam[0]).toEqual({ label: 'Barça', count: 2 });
    expect(st.byBrand.map((b) => b.label)).toEqual(['Nike', UNSPECIFIED]);
    expect(st.byDecade.map((b) => b.label)).toEqual(['2000s', '2010s', UNSPECIFIED]);
    expect(st.firstSeason).toBe('2005-06');
    expect(st.lastSeason).toBe('2012-13');
    expect(st.completeness.find((c) => c.key === 'season')?.have).toBe(2);
    expect(st.completeness.find((c) => c.key === 'photo')?.have).toBe(0);
  });

  it('gestiona una col·lecció buida', () => {
    const st = computeStats([]);
    expect(st.total).toBe(0);
    expect(st.firstSeason).toBeNull();
  });

  it('decadeOf i tally ignoren valors invàlids', () => {
    expect(decadeOf('1999-00')).toBe('1990s');
    expect(decadeOf('xx')).toBeNull();
    expect(tally(['a', ' ', null, 'a'])).toEqual([{ label: 'a', count: 2 }, { label: UNSPECIFIED, count: 2 }]);
  });
});

describe('finances', () => {
  it('suma preu + enviament, no inventa preus i agrupa per any', async () => {
    const shirts = await build([
      { teamName: 'A', price: 50, shippingCost: 5, purchaseDate: '2024-03-01', estimatedValue: 80 },
      { teamName: 'B', price: 30, purchaseDate: '2025-01-10' },
      { teamName: 'C' }, // sense preu
      { teamName: 'D', price: 10, shippingCost: null }, // sense data
    ]);
    const f = computeFinance(shirts, [{ year: 2024, amount: 40 }, { year: 2023, amount: 100 }]);
    expect(f.priced).toBe(3);
    expect(f.unpriced).toBe(1);
    expect(f.totalPrice).toBe(90);
    expect(f.totalShipping).toBe(5);
    expect(f.totalSpent).toBe(95);
    expect(f.averagePrice).toBe(30);
    expect(f.balance).toBe(25); // 80 − 55, només la que té preu i valor
    expect(f.balanceCount).toBe(1);
    expect(f.undatedSpent).toBe(10);
    const y2024 = f.byYear.find((y) => y.year === 2024)!;
    expect(y2024).toMatchObject({ spent: 55, budget: 40, remaining: -15, count: 1 });
    expect(f.byYear.find((y) => y.year === 2023)).toMatchObject({ spent: 0, remaining: 100 });
    expect(f.byYear.find((y) => y.year === 2025)).toMatchObject({ budget: null, remaining: null });
    expect(f.mostExpensive[0].total).toBe(55);
  });

  it('sense dades retorna nuls en lloc de zeros enganyosos', () => {
    const f = computeFinance([], []);
    expect(f.averagePrice).toBeNull();
    expect(f.balance).toBeNull();
    expect(f.byYear).toEqual([]);
  });

  it('el pressupost de desitjos només suma els actius amb preu', () => {
    const mk = (status: WishlistItem['status'], maxPrice: number | null) =>
      ({ status, maxPrice }) as unknown as WishlistItem;
    expect(wishlistBudget([mk('wanted', 50), mk('watching', null), mk('acquired', 99), mk('dropped', 10)])).toEqual({
      total: 50,
      withPrice: 1,
      withoutPrice: 1,
    });
  });
});

describe('formulari de desitjos', () => {
  it('normalitza temporades i valida imports i enllaços', () => {
    expect(normalizeSeason('2005-2006')).toBe('2005-06');
    expect(normalizeSeason('2005-07')).toBeNull();
    const bad = parseWishlistForm({ ...emptyWishlistValues, teamName: '', maxPrice: '-3', purchaseUrl: 'javascript:alert(1)' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['maxPrice', 'purchaseUrl', 'teamName']);
    const ok = parseWishlistForm({ ...emptyWishlistValues, teamName: ' Girona ', maxPrice: '45,5', season: '2017-2018' });
    expect(ok.ok && ok.data).toMatchObject({ teamName: 'Girona', maxPrice: 45.5, season: '2017-18', priority: 3, status: 'wanted' });
  });
});

describe('repositori de memòria: desitjos i pressupost', () => {
  it('crea, edita, adquireix i elimina; l’equip es reutilitza', async () => {
    const repo = new MemoryShirtRepository();
    const shirt = await repo.createShirt(makeInput({ teamName: 'Girona' }));
    const parsed = parseWishlistForm({ ...emptyWishlistValues, teamName: 'girona', season: '2017-18' });
    if (!parsed.ok) throw new Error('invàlid');
    const w = await repo.createWishlistItem(parsed.data);
    expect((await repo.listTeams()).length).toBe(1);
    const edited = await repo.updateWishlistItem(w.id, { ...parsed.data, priority: 1 });
    expect(edited.priority).toBe(1);
    const acquired = await repo.markWishlistAcquired(w.id, shirt.id);
    expect(acquired).toMatchObject({ status: 'acquired', acquiredShirtId: shirt.id });
    await repo.deleteShirt(shirt.id);
    expect((await repo.listWishlist())[0].acquiredShirtId).toBeNull();
    await repo.deleteWishlistItem(w.id);
    await expect(repo.deleteWishlistItem(w.id)).rejects.toThrow();
  });

  it('el pressupost es desa per any, es substitueix i valida', async () => {
    const repo = new MemoryShirtRepository();
    await repo.setBudget(2026, 200);
    await repo.setBudget(2026, 250.456);
    await repo.setBudget(2025, 100);
    expect(await repo.listBudgets()).toEqual([{ year: 2026, amount: 250.46 }, { year: 2025, amount: 100 }]);
    await expect(repo.setBudget(1800, 10)).rejects.toThrow();
    await expect(repo.setBudget(2026, -1)).rejects.toThrow();
    await repo.deleteBudget(2026);
    expect(await repo.listBudgets()).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { runBatch, shirtsPendingPhoto } from '../src/lib/imageSearch/batch';
import type { ScoredCandidate, SearchOutcome } from '../src/lib/imageSearch/types';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import type { NewCandidate } from '../src/services/shirtRepository';
import { makeInput } from './helpers';

const nc = (n: number): NewCandidate => ({
  imageUrl: `https://img/${n}.jpg`,
  thumbnailUrl: null,
  sourcePageUrl: `https://page/${n}`,
  source: 'openverse',
  author: 'Ann',
  license: 'CC BY 4.0',
  licenseUrl: null,
  matchScore: 0.7,
});

const scored = (n: number): ScoredCandidate => ({ ...nc(n), title: 't', width: null, height: null, matchScore: 0.7 });
const outcome = (n: number): SearchOutcome => ({ candidates: [scored(n)], errors: [], queries: ['q'] });

describe('imatges al repositori de memòria', () => {
  it('desa candidates sense repetir URL i no assigna cap foto', async () => {
    const repo = new MemoryShirtRepository();
    const s = await repo.createShirt(makeInput());
    expect(await repo.addCandidates(s.id, [nc(1), nc(2)])).toBe(2);
    expect(await repo.addCandidates(s.id, [nc(1), nc(3)])).toBe(1);
    expect((await repo.listShirts())[0].photoUrl).toBeNull();
  });

  it('confirma, canvia, treu i no repropossa les rebutjades', async () => {
    const repo = new MemoryShirtRepository();
    const s = await repo.createShirt(makeInput());
    await repo.addCandidates(s.id, [nc(1), nc(2)]);
    const [a, b] = await repo.listImages();
    await repo.confirmImage(a.id);
    expect((await repo.listShirts())[0].photoUrl).toBe(a.imageUrl);
    await repo.confirmImage(b.id);
    const imgs = await repo.listImages();
    expect(imgs.filter((i) => i.isPrimary)).toHaveLength(1);
    expect(imgs.find((i) => i.id === a.id)?.status).toBe('candidate');
    await repo.unconfirmImage(b.id);
    expect((await repo.listShirts())[0].photoUrl).toBeNull();
    await repo.rejectImage(a.id);
    expect(await repo.addCandidates(s.id, [nc(1)])).toBe(0);
  });

  it('enllaç manual: només http(s) i queda confirmat', async () => {
    const repo = new MemoryShirtRepository();
    const s = await repo.createShirt(makeInput());
    await expect(repo.addManualImage(s.id, 'javascript:alert(1)')).rejects.toThrow();
    await repo.addManualImage(s.id, 'https://example.com/a.jpg', 'https://example.com');
    const [sh] = await repo.listShirts();
    expect(sh.photoUrl).toBe('https://example.com/a.jpg');
  });

  it('eliminar la samarreta elimina les seves imatges', async () => {
    const repo = new MemoryShirtRepository();
    const s = await repo.createShirt(makeInput());
    await repo.addCandidates(s.id, [nc(1)]);
    await repo.deleteShirt(s.id);
    expect(await repo.listImages()).toEqual([]);
  });
});

describe('runBatch', () => {
  async function setup(count = 3) {
    const repo = new MemoryShirtRepository();
    for (let i = 0; i < count; i++) await repo.createShirt(makeInput({ teamName: `Equip ${i}`, season: '2010-11' }));
    const shirts = await repo.listShirts();
    const job = await repo.createImageJob(shirts.map((s) => s.id));
    const latest = (await repo.getLatestImageJob())!;
    return { repo, shirts, job, items: latest.items };
  }
  const base = { sleep: async () => {}, intervalMs: 0, maxAttempts: 3 };

  it('cerca per a totes les samarretes i desa només candidates', async () => {
    const { repo, shirts, job, items } = await setup();
    let n = 0;
    const res = await runBatch(job, items, { ...base, repo, shirts, search: async () => outcome(++n), isPaused: () => false });
    expect(res).toBe('completed');
    expect((await repo.listImages()).filter((i) => i.status === 'candidate')).toHaveLength(3);
    expect((await repo.listShirts()).every((s) => s.photoUrl === null)).toBe(true);
    expect((await repo.getLatestImageJob())!.job.status).toBe('completed');
  });

  it('es pot pausar i reprendre sense repetir feina', async () => {
    const { repo, shirts, job, items } = await setup();
    let calls = 0;
    const paused = { v: false };
    const search = async () => {
      calls++;
      if (calls === 1) paused.v = true;
      return outcome(calls);
    };
    expect(await runBatch(job, items, { ...base, repo, shirts, search, isPaused: () => paused.v })).toBe('paused');
    expect(calls).toBe(1);
    const saved = (await repo.getLatestImageJob())!;
    expect(saved.job.status).toBe('paused');
    paused.v = false;
    expect(await runBatch(saved.job, saved.items, { ...base, repo, shirts, search, isPaused: () => paused.v })).toBe('completed');
    expect(calls).toBe(3);
  });

  it('reintenta i marca com a fallida després dels intents màxims', async () => {
    const { repo, shirts, job, items } = await setup(1);
    let calls = 0;
    const search = async (): Promise<SearchOutcome> => {
      calls++;
      throw new Error('xarxa');
    };
    await runBatch(job, items, { ...base, repo, shirts, search, isPaused: () => false });
    expect(calls).toBe(3);
    const { items: after } = (await repo.getLatestImageJob())!;
    expect(after[0]).toMatchObject({ status: 'failed', attempts: 3, lastError: 'xarxa' });
  });

  it('tracta «totes les fonts han fallat» com a error i es recupera al reintent', async () => {
    const { repo, shirts, job, items } = await setup(1);
    let calls = 0;
    const search = async (): Promise<SearchOutcome> =>
      ++calls === 1
        ? { candidates: [], errors: [{ source: 'openverse', message: '429' }, { source: 'wikimedia_commons', message: '500' }], queries: [] }
        : outcome(1);
    await runBatch(job, items, { ...base, repo, shirts, search, isPaused: () => false });
    expect(calls).toBe(2);
    expect((await repo.getLatestImageJob())!.items[0].status).toBe('completed');
  });

  it('protegeix les samarretes que ja tenen foto confirmada', async () => {
    const { repo, shirts, job, items } = await setup(2);
    await repo.addManualImage(shirts[0].id, 'https://example.com/a.jpg');
    const fresh = await repo.listShirts();
    expect(shirtsPendingPhoto(fresh)).toHaveLength(1);
    const asked: string[] = [];
    await runBatch(job, items, {
      ...base,
      repo,
      shirts: fresh,
      search: async (s) => {
        asked.push(s.id);
        return outcome(asked.length);
      },
      isPaused: () => false,
    });
    expect(asked).toEqual([shirts[1].id]);
  });
});

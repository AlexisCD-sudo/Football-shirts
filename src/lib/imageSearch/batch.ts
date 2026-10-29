import type { ShirtRepository, NewCandidate } from '../../services/shirtRepository';
import type { ImageJob, ImageJobItem, Shirt } from '../../types/shirt';
import { allSourcesFailed } from './search';
import type { ScoredCandidate, SearchOutcome } from './types';

export function toNewCandidate(c: ScoredCandidate): NewCandidate {
  return {
    imageUrl: c.imageUrl,
    thumbnailUrl: c.thumbnailUrl,
    sourcePageUrl: c.sourcePageUrl,
    source: c.source,
    author: c.author,
    license: c.license,
    licenseUrl: c.licenseUrl,
    matchScore: c.matchScore,
  };
}

export interface BatchProgress {
  done: number;
  failed: number;
  total: number;
  current: string | null;
}

export interface BatchDeps {
  repo: ShirtRepository;
  shirts: Shirt[];
  search: (shirt: Shirt) => Promise<SearchOutcome>;
  sleep: (ms: number) => Promise<void>;
  /** Pausa mínima entre samarretes (límit de peticions). */
  intervalMs: number;
  maxAttempts: number;
  isPaused: () => boolean;
  onProgress?: (p: BatchProgress) => void;
}

/** Samarretes que es poden cercar: les que encara no tenen una foto confirmada. */
export function shirtsPendingPhoto(shirts: Shirt[]): Shirt[] {
  return shirts.filter((s) => !s.photoUrl);
}

/**
 * Executa (o reprèn) una feina de cerca per lots. Cada resultat es desa a mesura que arriba, de manera que si
 * es tanca la pàgina res es perd. Mai assigna cap foto: només desa candidates. Les samarretes que ja tenen una
 * foto confirmada se salten (les imatges confirmades queden protegides).
 */
export async function runBatch(
  job: ImageJob,
  items: ImageJobItem[],
  deps: BatchDeps,
): Promise<'completed' | 'paused'> {
  const { repo, search, sleep, intervalMs, maxAttempts, isPaused, onProgress } = deps;
  const byId = new Map(deps.shirts.map((s) => [s.id, s]));
  const state = new Map(items.map((i) => [i.id, { ...i }]));
  const count = (status: string) => [...state.values()].filter((i) => i.status === status).length;
  const report = (current: string | null) =>
    onProgress?.({ done: count('completed'), failed: count('failed'), total: items.length, current });

  await repo.updateImageJob(job.id, { status: 'running' });
  report(null);

  const todo = items.filter((i) => i.status !== 'completed' && !(i.status === 'failed' && i.attempts >= maxAttempts));
  for (const [index, original] of todo.entries()) {
    if (isPaused()) {
      await repo.updateImageJob(job.id, { status: 'paused', done: count('completed'), failed: count('failed') });
      return 'paused';
    }
    const item = state.get(original.id)!;
    const shirt = byId.get(item.shirtId);
    report(shirt?.team.name ?? null);

    if (!shirt) {
      item.status = 'failed';
      item.lastError = 'La samarreta ja no existeix';
      await repo.updateImageJobItem(item.id, { status: 'failed', lastError: item.lastError });
    } else if (shirt.photoUrl) {
      item.status = 'completed'; // protegida: ja té una foto confirmada
      await repo.updateImageJobItem(item.id, { status: 'completed', candidatesFound: 0 });
    } else {
      let ok = false;
      while (!ok && item.attempts < maxAttempts) {
        try {
          const outcome = await search(shirt);
          if (allSourcesFailed(outcome)) throw new Error(outcome.errors[0]?.message ?? 'Cap font ha respost');
          const added = await repo.addCandidates(shirt.id, outcome.candidates.map(toNewCandidate));
          item.status = 'completed';
          item.candidatesFound = added;
          item.lastError = null;
          await repo.updateImageJobItem(item.id, { status: 'completed', candidatesFound: added, lastError: null });
          ok = true;
        } catch (e) {
          item.attempts += 1;
          item.lastError = e instanceof Error ? e.message : 'Error desconegut';
          item.status = item.attempts >= maxAttempts ? 'failed' : 'pending';
          await repo.updateImageJobItem(item.id, {
            status: item.status,
            attempts: item.attempts,
            lastError: item.lastError,
          });
          if (item.attempts < maxAttempts) await sleep(intervalMs * 2 ** item.attempts); // reintent amb espera creixent
        }
      }
    }
    await repo.updateImageJob(job.id, { done: count('completed'), failed: count('failed') });
    report(null);
    if (index < todo.length - 1) await sleep(intervalMs);
  }

  await repo.updateImageJob(job.id, { status: 'completed', done: count('completed'), failed: count('failed') });
  report(null);
  return 'completed';
}

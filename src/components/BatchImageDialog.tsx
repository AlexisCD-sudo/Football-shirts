import { useEffect, useRef, useState } from 'react';
import { runBatch, shirtsPendingPhoto, type BatchProgress } from '../lib/imageSearch/batch';
import { sleep } from '../lib/imageSearch/rateLimit';
import { searchImages } from '../lib/imageSearch/search';
import type { ShirtRepository } from '../services/shirtRepository';
import type { ImageJob, ImageJobItem, Shirt, ShirtImage } from '../types/shirt';
import { Modal, buttonCls, primaryCls } from './ui';

const MAX_ATTEMPTS = 3;
const INTERVAL_MS = 1100; // ~1 samarreta/s (cada samarreta fa diverses peticions en sèrie)

interface Props {
  repository: ShirtRepository;
  shirts: Shirt[];
  images: ShirtImage[];
  onChanged: () => Promise<void> | void;
  onReview: (shirtId: string) => void;
  onClose: () => void;
}

export function BatchImageDialog({ repository, shirts, images, onChanged, onReview, onClose }: Props) {
  const [saved, setSaved] = useState<{ job: ImageJob; items: ImageJobItem[] } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<'completed' | 'paused' | null>(null);
  const paused = useRef(false);

  useEffect(() => {
    let alive = true;
    repository
      .getLatestImageJob()
      .then((j) => alive && setSaved(j))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'No s’ha pogut carregar la feina anterior'))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [repository]);

  const pending = shirtsPendingPhoto(shirts);
  const resumable =
    saved && (saved.job.status === 'paused' || saved.job.status === 'running' || saved.job.status === 'pending')
      ? saved
      : null;
  const reviewShirts = shirts.filter(
    (s) => !s.photoUrl && images.some((i) => i.shirtId === s.id && i.status === 'candidate'),
  );

  async function start(existing?: { job: ImageJob; items: ImageJobItem[] }) {
    setError(null);
    setResult(null);
    paused.current = false;
    setRunning(true);
    try {
      let current = existing;
      if (!current) {
        const job = await repository.createImageJob(pending.map((s) => s.id));
        current = (await repository.getLatestImageJob()) ?? { job, items: [] };
      }
      setSaved(current);
      const outcome = await runBatch(current.job, current.items, {
        repo: repository,
        shirts,
        search: (s) => searchImages(s),
        sleep,
        intervalMs: INTERVAL_MS,
        maxAttempts: MAX_ATTEMPTS,
        isPaused: () => paused.current,
        onProgress: setProgress,
      });
      setResult(outcome);
      setSaved(await repository.getLatestImageJob());
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La cerca per lots s’ha aturat per un error');
    } finally {
      setRunning(false);
    }
  }

  const pct = progress && progress.total > 0 ? Math.round(((progress.done + progress.failed) / progress.total) * 100) : 0;

  return (
    <Modal
      title="Cerca de fotos per lots"
      onClose={() => {
        if (running) paused.current = true;
        onClose();
      }}
      wide
    >
      <p className="text-sm text-muted">
        Cerca candidates per a les samarretes sense foto confirmada. <strong>No s&rsquo;assigna cap foto automàticament</strong>: cada
        candidata s&rsquo;ha de revisar. Les fotos ja confirmades no es toquen. Els resultats es desen a mesura que arriben.
      </p>

      {!loaded ? (
        <p className="mt-4 text-sm">Carregant…</p>
      ) : (
        <div className="mt-4 space-y-3">
          {!running && (
            <div className="flex flex-wrap gap-2">
              {resumable && (
                <button type="button" className={primaryCls} onClick={() => void start(resumable)}>
                  Reprèn la feina anterior ({resumable.job.done}/{resumable.job.total})
                </button>
              )}
              <button type="button" className={resumable ? buttonCls : primaryCls} disabled={pending.length === 0} onClick={() => void start()}>
                Cerca per a {pending.length} samarretes sense foto
              </button>
            </div>
          )}
          {running && (
            <button type="button" className={buttonCls} onClick={() => (paused.current = true)}>
              Pausa
            </button>
          )}
          {(running || progress) && (
            <div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label="Progrés de la cerca"
                className="h-3 overflow-hidden rounded-full bg-line"
              >
                <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-sm text-muted" aria-live="polite">
                {progress?.done ?? 0} fetes · {progress?.failed ?? 0} amb error · {progress?.total ?? 0} en total
                {progress?.current ? ` · ara: ${progress.current}` : ''}
              </p>
            </div>
          )}
          {result === 'paused' && <p role="status" className="text-sm">Cerca en pausa. Pots reprendre-la quan vulguis.</p>}
          {result === 'completed' && <p role="status" className="text-sm">Cerca acabada.</p>}
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}

      <section className="mt-6 border-t border-line pt-4" aria-label="Per revisar">
        <h3 className="font-display text-lg font-bold">Per revisar ({reviewShirts.length})</h3>
        {reviewShirts.length === 0 ? (
          <p className="mt-1 text-sm text-muted">No hi ha cap samarreta amb candidates pendents.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
            {reviewShirts.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">
                  {s.team.name} {s.season ?? ''}
                  <span className="text-muted"> · {images.filter((i) => i.shirtId === s.id && i.status === 'candidate').length} candidates</span>
                </span>
                <button type="button" className={buttonCls} onClick={() => onReview(s.id)}>
                  Revisa
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Modal>
  );
}

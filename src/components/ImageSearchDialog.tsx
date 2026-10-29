import { useMemo, useRef, useState, type FormEvent } from 'react';
import { buildQueries, describeShirt } from '../lib/imageSearch/query';
import { toNewCandidate } from '../lib/imageSearch/batch';
import { PROBABLE, confidence, confidenceLabels } from '../lib/imageSearch/score';
import { allSourcesFailed, searchImages } from '../lib/imageSearch/search';
import type { ShirtRepository } from '../services/shirtRepository';
import type { Shirt, ShirtImage } from '../types/shirt';
import { Modal, buttonCls, inputCls, primaryCls } from './ui';

interface Props {
  repository: ShirtRepository;
  shirt: Shirt;
  /** Totes les imatges d'aquesta samarreta. */
  images: ShirtImage[];
  onChanged: () => Promise<void> | void;
  onClose: () => void;
}

/** Només enllaços http(s): una URL desada mai ha de poder executar codi. */
export function safeHttpUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

const sourceLabels: Record<string, string> = {
  wikimedia_commons: 'Wikimedia Commons',
  openverse: 'Openverse',
  manual: 'Enllaç manual',
};

function Attribution({ image }: { image: ShirtImage }) {
  return (
    <p className="mt-1 text-xs text-muted">
      {image.source ? (sourceLabels[image.source] ?? image.source) : 'Font desconeguda'}
      {image.author ? ` · ${image.author}` : ''}
      {image.license ? ` · ${image.license}` : ' · llicència desconeguda'}{' '}
      {safeHttpUrl(image.sourcePageUrl) && (
        <a href={safeHttpUrl(image.sourcePageUrl) as string} target="_blank" rel="noopener noreferrer" className="underline">
          pàgina d&rsquo;origen
        </a>
      )}
    </p>
  );
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  return broken || !safeHttpUrl(src) ? (
    <div className="flex h-full w-full items-center justify-center bg-card p-2 text-center text-xs text-muted">
      Imatge no disponible
    </div>
  ) : (
    <img src={src as string} alt={alt} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setBroken(true)} />
  );
}

export function ImageSearchDialog({ repository, shirt, images, onChanged, onClose }: Props) {
  const [query, setQuery] = useState(() => buildQueries(shirt)[0] ?? shirt.team.name);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [linkSource, setLinkSource] = useState('');
  const [compare, setCompare] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const confirmed = images.find((i) => i.status === 'confirmed' && i.isPrimary);
  const candidates = useMemo(
    () =>
      images
        .filter((i) => i.status === 'candidate')
        .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)),
    [images],
  );
  const rejectedCount = images.filter((i) => i.status === 'rejected').length;
  const compared = candidates.filter((c) => compare.includes(c.id));

  async function run(action: () => Promise<void>, id?: string) {
    setError(null);
    setBusyId(id ?? 'x');
    try {
      await action();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No s’ha pogut completar l’acció');
    } finally {
      setBusyId(null);
    }
  }

  async function search(e?: FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setSearching(true);
    setError(null);
    setMessage(null);
    try {
      const outcome = await searchImages(shirt, { queries: [query.trim()], signal: ctrl.signal });
      if (allSourcesFailed(outcome)) {
        setError(`No s’ha pogut consultar cap font: ${outcome.errors.map((x) => x.message).join(' · ')}`);
        return;
      }
      const added = await repository.addCandidates(shirt.id, outcome.candidates.map(toNewCandidate));
      await onChanged();
      const warn = outcome.errors.length ? ` Atenció: ${outcome.errors.map((x) => `${sourceLabels[x.source]}: ${x.message}`).join(' · ')}` : '';
      setMessage(
        (added > 0
          ? `S’han trobat ${added} candidates noves. Revisa-les: cap s’assigna automàticament.`
          : 'No s’ha trobat cap candidata nova amb prou coincidència. Prova una altra consulta o afegeix un enllaç.') + warn,
      );
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(err instanceof Error ? err.message : 'Error en la cerca');
    } finally {
      setSearching(false);
    }
  }

  function toggleCompare(id: string) {
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));
  }

  function close() {
    abort.current?.abort();
    onClose();
  }

  return (
    <Modal title={`Fotos · ${describeShirt(shirt)}`} onClose={close} wide>
      <section aria-label="Foto actual">
        <h3 className="font-display text-lg font-bold">Foto confirmada</h3>
        {confirmed ? (
          <div className="mt-2 flex gap-4">
            <div className="h-36 w-28 shrink-0 overflow-hidden rounded-lg border border-line">
              <Thumb src={confirmed.imageUrl} alt="Foto confirmada" />
            </div>
            <div className="text-sm">
              <Attribution image={confirmed} />
              <p className="mt-1 text-xs text-muted">Referència externa (la imatge no es copia a la teva base de dades).</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={buttonCls} disabled={busyId !== null} onClick={() => void run(() => repository.unconfirmImage(confirmed.id), confirmed.id)}>
                  Treu la foto
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted">Aquesta samarreta encara no té foto.</p>
        )}
      </section>

      <section aria-label="Cerca" className="mt-6 border-t border-line pt-4">
        <h3 className="font-display text-lg font-bold">Cerca a Internet</h3>
        <form onSubmit={(e) => void search(e)} className="mt-2 flex gap-2">
          <input aria-label="Consulta de cerca" className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit" className={primaryCls} disabled={searching || !query.trim()}>
            {searching ? 'Cercant…' : 'Cerca'}
          </button>
        </form>
        <p className="mt-1 text-xs text-muted">
          Fonts: Wikimedia Commons i Openverse (imatges amb llicència). Pot ser que no hi hagi cap foto d&rsquo;aquesta peça.
        </p>
        {message && (
          <p role="status" className="mt-2 text-sm">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </section>

      <section aria-label="Candidates" className="mt-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Candidates ({candidates.length})</h3>
          {rejectedCount > 0 && <span className="text-xs text-muted">{rejectedCount} rebutjades (no es tornaran a proposar)</span>}
        </div>
        {candidates.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Cap candidata per revisar.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {candidates.map((c) => {
              const level = confidence(c.matchScore ?? 0);
              return (
                <li key={c.id} className="rounded-lg border border-line bg-card p-2">
                  <div className="aspect-[4/5] overflow-hidden rounded-md">
                    <Thumb src={c.thumbnailUrl ?? c.imageUrl} alt="Candidata" />
                  </div>
                  <p className="mt-1 text-xs font-medium">
                    {confidenceLabels[level]}
                    {c.matchScore !== null && ` (${Math.round(c.matchScore * 100)}%)`}
                    {(c.matchScore ?? 0) < PROBABLE && ' · dubtosa'}
                  </p>
                  <Attribution image={c} />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" className={primaryCls} disabled={busyId !== null} onClick={() => void run(() => repository.confirmImage(c.id), c.id)}>
                      Confirma
                    </button>
                    <button type="button" className={buttonCls} disabled={busyId !== null} onClick={() => void run(() => repository.rejectImage(c.id), c.id)}>
                      Rebutja
                    </button>
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={compare.includes(c.id)} onChange={() => toggleCompare(c.id)} disabled={!compare.includes(c.id) && compare.length >= 3} />
                      Compara
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {compared.length >= 2 && (
          <div className="mt-4 rounded-lg border border-line p-3" aria-label="Comparació">
            <p className="mb-2 text-sm font-medium">Comparació</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {compared.map((c) => (
                <div key={c.id} className="aspect-[4/5] overflow-hidden rounded-md">
                  <Thumb src={c.imageUrl} alt="Imatge ampliada per comparar" />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section aria-label="Enllaç manual" className="mt-6 border-t border-line pt-4">
        <h3 className="font-display text-lg font-bold">Afegeix per enllaç</h3>
        <form
          className="mt-2 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await repository.addManualImage(shirt.id, link.trim(), linkSource.trim() || undefined);
              setLink('');
              setLinkSource('');
            });
          }}
        >
          <input aria-label="URL de la imatge" type="url" placeholder="https://… (adreça directa de la imatge)" className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} required />
          <input aria-label="Pàgina d'origen" type="url" placeholder="Pàgina d’origen (opcional)" className={inputCls} value={linkSource} onChange={(e) => setLinkSource(e.target.value)} />
          <div>
            <button type="submit" className={buttonCls} disabled={busyId !== null || !link.trim()}>
              Afegeix i confirma
            </button>
          </div>
        </form>
        <p className="mt-1 text-xs text-muted">Es desa com a referència externa amb llicència desconeguda. Assegura&rsquo;t que en pots fer ús.</p>
      </section>
    </Modal>
  );
}

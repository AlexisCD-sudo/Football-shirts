import { useMemo, useState } from 'react';
import { FilterBar } from '../components/FilterBar';
import { ShirtCard } from '../components/ShirtCard';
import { ShirtDetailDialog } from '../components/ShirtDetailDialog';
import { ShirtFormDialog } from '../components/ShirtFormDialog';
import { ExportDialog } from '../components/ExportDialog';
import { ImportDialog } from '../components/ImportDialog';
import { BatchImageDialog } from '../components/BatchImageDialog';
import { FkaBulkDialog } from '../components/FkaBulkDialog';
import { FkaImportDialog, type FkaDraft } from '../components/FkaImportDialog';
import { ImageSearchDialog } from '../components/ImageSearchDialog';
import { ConfirmDialog, Spinner, buttonCls, inputCls, primaryCls } from '../components/ui';
import { useShirtCollection } from '../hooks/useShirtCollection';
import { usePersistentState } from '../hooks/usePersistentState';
import {
  activeFilterCount,
  applyCatalog,
  emptyFilters,
  facetOptions,
  type CatalogFilters,
  type SortKey,
} from '../lib/catalog';
import { FKA_LICENSE, FKA_SOURCE, isFkaUrl } from '../lib/fka';
import { preparePhoto } from '../lib/photoUpload';
import { normalize } from '../lib/catalog';
import type { ShirtRepository } from '../services/shirtRepository';
import type { Shirt, ShirtInput } from '../types/shirt';

type Dialog =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'import' }
  | { type: 'export' }
  | { type: 'batch' }
  | { type: 'fka-bulk' }
  | { type: 'fka' }
  | { type: 'fka-form'; draft: FkaDraft }
  | { type: 'photos'; id: string }
  | { type: 'detail'; id: string }
  | { type: 'edit'; id: string }
  | { type: 'delete'; id: string };

export function CatalogPage({ repository }: { repository: ShirtRepository }) {
  const { shirts, teams, images, loading, error, reload, sync, syncing, syncError, lastSync, create, update, remove } =
    useShirtCollection(repository);
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters);
  const [sort, setSort] = useState<SortKey>('team');
  const [view, setView] = usePersistentState<'grid' | 'list'>('fsc.view', 'grid', ['grid', 'list']);
  const [dialog, setDialog] = useState<Dialog>({ type: 'none' });
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const facets = useMemo(() => facetOptions(shirts), [shirts]);
  const visible = useMemo(() => applyCatalog(shirts, filters, sort), [shirts, filters, sort]);
  const selected: Shirt | undefined =
    dialog.type !== 'none' && dialog.type !== 'create' && dialog.type !== 'import' && dialog.type !== 'export' && dialog.type !== 'batch' && dialog.type !== 'fka-bulk' && dialog.type !== 'fka' && dialog.type !== 'fka-form' ? shirts.find((s) => s.id === dialog.id) : undefined;
  const candidateShirtIds = useMemo(
    () => new Set(images.filter((i) => i.status === 'candidate').map((i) => i.shirtId)),
    [images],
  );
  const filtered = activeFilterCount(filters) > 0;

  const close = () => {
    setDialog({ type: 'none' });
    setDeleteError(null);
  };

  async function save(input: ShirtInput) {
    if (dialog.type === 'edit' && selected) {
      await update(selected.id, input);
      setDialog({ type: 'detail', id: selected.id });
    } else {
      await create(input);
      close();
    }
  }

  /** Desa la samarreta del flux assistit i després hi adjunta la imatge, conservant-ne la font. */
  async function saveFromFka(draft: FkaDraft, input: ShirtInput) {
    const duplicate = shirts.some(
      (s) =>
        normalize(s.team.name) === normalize(input.teamName) &&
        (s.season ?? '') === (input.season ?? '') &&
        (s.kitType ?? '') === (input.kitType ?? ''),
    );
    const created = await create(input);
    close();
    const meta = { source: isFkaUrl(draft.pageUrl) ? FKA_SOURCE : ('manual' as const), license: FKA_LICENSE };
    let imageNote = '';
    try {
      if (draft.file) {
        const { blob, contentType } = await preparePhoto(draft.file);
        await repository.uploadPhoto(created.id, blob, contentType, { ...meta, sourcePageUrl: draft.pageUrl });
      } else if (draft.imageUrl) {
        await repository.addManualImage(created.id, draft.imageUrl, draft.pageUrl, meta);
      }
    } catch (e) {
      imageNote = ` Però la imatge no s’ha pogut desar (${e instanceof Error ? e.message : 'error'}). Afegeix-la des de «Cerca fotos».`;
    }
    await sync();
    setNotice(
      `${created.team.name} s’ha afegit a la col·lecció.${duplicate ? ' Atenció: ja tenies una samarreta amb el mateix equip, temporada i equipació.' : ''}${imageNote}`,
    );
  }

  async function confirmDelete() {
    if (!selected) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove(selected.id);
      close();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'No s’ha pogut eliminar');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          aria-label="Cerca"
          placeholder="Cerca per equip, jugador, temporada, marca…"
          className={`${inputCls} sm:max-w-md`}
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
        />
        <div className="flex flex-wrap gap-2 sm:ml-auto sm:flex-nowrap">
          <div role="group" aria-label="Vista" className="flex overflow-hidden rounded-md border border-line">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`px-3 py-2 text-sm ${view === v ? 'bg-ink text-paper' : 'bg-card text-ink'}`}
              >
                {v === 'grid' ? 'Quadrícula' : 'Llista'}
              </button>
            ))}
          </div>
          <button type="button" className={buttonCls} onClick={() => setDialog({ type: 'import' })}>
            Importa
          </button>
          <button type="button" className={buttonCls} onClick={() => setDialog({ type: 'fka-bulk' })}>
            Des de Football Kit Archive
          </button>
          <button type="button" className={buttonCls} onClick={() => setDialog({ type: 'batch' })}>
            Cerca fotos
          </button>
          <button type="button" className={buttonCls} onClick={() => setDialog({ type: 'export' })}>
            Exporta
          </button>
          <button type="button" className={primaryCls} onClick={() => setDialog({ type: 'create' })}>
            Afegeix samarreta
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="mb-4 flex items-start justify-between gap-3 rounded-md bg-accent/10 px-4 py-2 text-sm">
          <span>{notice}</span>
          <button type="button" className="underline" onClick={() => setNotice(null)}>
            Tanca
          </button>
        </p>
      )}

      <FilterBar filters={filters} facets={facets} sort={sort} onFilters={setFilters} onSort={setSort} />

      {loading ? (
        <Spinner />
      ) : error ? (
        <div role="alert" className="mt-10 rounded-xl border border-line bg-card p-8 text-center">
          <p className="font-display text-xl font-bold">No s&rsquo;ha pogut carregar la col·lecció</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <button type="button" className={`${buttonCls} mt-4`} onClick={() => void reload()}>
            Torna-ho a provar
          </button>
        </div>
      ) : shirts.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line p-10 text-center">
          <p className="font-display text-2xl font-bold">Encara no tens cap samarreta</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Afegeix-ne una a mà. Quan arribi la fase d&rsquo;importació, podràs carregar tota la col·lecció d&rsquo;una vegada.
          </p>
          <button type="button" className={`${primaryCls} mt-5`} onClick={() => setDialog({ type: 'create' })}>
            Afegeix la primera samarreta
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 mt-5 flex items-center gap-3 text-sm text-muted" aria-live="polite">
            <span>
              {visible.length} de {shirts.length} samarretes
            </span>
            {filtered && (
              <button type="button" className="underline" onClick={() => setFilters(emptyFilters)}>
                Neteja filtres
              </button>
            )}
            {repository.persistence === 'cloud' && (
              <span className="ml-auto flex items-center gap-2">
                {syncError ? (
                  <span role="alert" className="text-red-700 dark:text-red-400">
                    No s&rsquo;ha pogut actualitzar: {syncError}
                  </span>
                ) : (
                  lastSync && (
                    <span>
                      Sincronitzat a les{' '}
                      {lastSync.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )
                )}
                <button type="button" className="underline" onClick={() => void sync()} disabled={syncing}>
                  {syncing ? 'Actualitzant…' : 'Actualitza'}
                </button>
              </span>
            )}
          </p>
          {visible.length === 0 ? (
            <p className="py-16 text-center text-muted">Cap samarreta coincideix amb la cerca o els filtres.</p>
          ) : (
            <ul
              className={
                view === 'grid'
                  ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5'
                  : 'flex flex-col gap-2'
              }
            >
              {visible.map((s) => (
                <ShirtCard key={s.id} shirt={s} view={view} hasCandidates={!s.photoUrl && candidateShirtIds.has(s.id)} onOpen={(sh) => setDialog({ type: 'detail', id: sh.id })} />
              ))}
            </ul>
          )}
        </>
      )}

      {dialog.type === 'import' && (
        <ImportDialog repository={repository} shirts={shirts} teams={teams} onImported={sync} onClose={close} />
      )}
      {dialog.type === 'fka-bulk' && (
        <FkaBulkDialog
          shirts={shirts}
          addImage={(id, url, page) => repository.addManualImage(id, url, page, { source: FKA_SOURCE, license: FKA_LICENSE })}
          onSingle={() => setDialog({ type: 'fka' })}
          onDone={(n) => {
            void sync();
            setNotice(`S’han enllaçat ${n} imatges de Football Kit Archive.`);
          }}
          onClose={close}
        />
      )}
      {dialog.type === 'fka' && (
        <FkaImportDialog onContinue={(draft) => setDialog({ type: 'fka-form', draft })} onClose={close} />
      )}
      {dialog.type === 'fka-form' && (
        <ShirtFormDialog
          title="Revisa les dades"
          initial={dialog.draft.initial}
          teams={teams}
          brands={facets.brands}
          onSubmit={(input) => saveFromFka(dialog.draft, input)}
          onClose={() => setDialog({ type: 'fka' })}
        />
      )}
      {dialog.type === 'batch' && (
        <BatchImageDialog
          repository={repository}
          shirts={shirts}
          images={images}
          onChanged={sync}
          onReview={(id) => setDialog({ type: 'photos', id })}
          onClose={close}
        />
      )}
      {dialog.type === 'photos' && selected && (
        <ImageSearchDialog
          repository={repository}
          shirt={selected}
          images={images.filter((i) => i.shirtId === selected.id)}
          onChanged={sync}
          onClose={() => setDialog({ type: 'detail', id: selected.id })}
        />
      )}
      {dialog.type === 'export' && <ExportDialog shirts={shirts} repository={repository} onClose={close} />}
      {dialog.type === 'create' && (
        <ShirtFormDialog teams={teams} brands={facets.brands} onSubmit={save} onClose={close} />
      )}
      {dialog.type === 'edit' && selected && (
        <ShirtFormDialog
          shirt={selected}
          teams={teams}
          brands={facets.brands}
          onSubmit={save}
          onClose={() => setDialog({ type: 'detail', id: selected.id })}
        />
      )}
      {dialog.type === 'detail' && selected && (
        <ShirtDetailDialog
          shirt={selected}
          onClose={close}
          onEdit={() => setDialog({ type: 'edit', id: selected.id })}
          onDelete={() => setDialog({ type: 'delete', id: selected.id })}
          onPhotos={() => setDialog({ type: 'photos', id: selected.id })}
          image={images.find((i) => i.shirtId === selected.id && i.status === 'confirmed' && i.isPrimary)}
        />
      )}
      {dialog.type === 'delete' && selected && (
        <ConfirmDialog
          title="Eliminar samarreta"
          message={`Vols eliminar la samarreta ${selected.team.name}${selected.season ? ` ${selected.season}` : ''}? Aquesta acció no es pot desfer.`}
          confirmLabel="Elimina"
          busy={deleting}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDialog({ type: 'detail', id: selected.id })}
        />
      )}
    </div>
  );
}

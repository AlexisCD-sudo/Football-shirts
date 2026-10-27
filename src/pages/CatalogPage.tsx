import { useMemo, useState } from 'react';
import { FilterBar } from '../components/FilterBar';
import { ShirtCard } from '../components/ShirtCard';
import { ShirtDetailDialog } from '../components/ShirtDetailDialog';
import { ShirtFormDialog } from '../components/ShirtFormDialog';
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
import type { ShirtRepository } from '../services/shirtRepository';
import type { Shirt, ShirtInput } from '../types/shirt';

type Dialog =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'detail'; id: string }
  | { type: 'edit'; id: string }
  | { type: 'delete'; id: string };

export function CatalogPage({ repository }: { repository: ShirtRepository }) {
  const { shirts, teams, loading, error, reload, create, update, remove } = useShirtCollection(repository);
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters);
  const [sort, setSort] = useState<SortKey>('team');
  const [view, setView] = usePersistentState<'grid' | 'list'>('fsc.view', 'grid', ['grid', 'list']);
  const [dialog, setDialog] = useState<Dialog>({ type: 'none' });
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const facets = useMemo(() => facetOptions(shirts), [shirts]);
  const visible = useMemo(() => applyCatalog(shirts, filters, sort), [shirts, filters, sort]);
  const selected: Shirt | undefined =
    dialog.type !== 'none' && dialog.type !== 'create' ? shirts.find((s) => s.id === dialog.id) : undefined;
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
        <div className="flex gap-2 sm:ml-auto">
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
          <button type="button" className={primaryCls} onClick={() => setDialog({ type: 'create' })}>
            Afegeix samarreta
          </button>
        </div>
      </div>

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
                <ShirtCard key={s.id} shirt={s} view={view} onOpen={(sh) => setDialog({ type: 'detail', id: sh.id })} />
              ))}
            </ul>
          )}
        </>
      )}

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

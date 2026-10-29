import { useCallback, useMemo, useState } from 'react';
import { ShirtFormDialog } from '../components/ShirtFormDialog';
import { WishlistFormDialog } from '../components/WishlistFormDialog';
import { ConfirmDialog, Spinner, buttonCls, primaryCls } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { facetOptions } from '../lib/catalog';
import { formatMoney } from '../lib/format';
import { kitTypeLabels } from '../lib/labels';
import { wishlistStatusLabels } from '../lib/wishlistLabels';
import type { ShirtRepository } from '../services/shirtRepository';
import type { ShirtInput, WishlistInput, WishlistItem, WishlistStatus } from '../types/shirt';

type Filter = 'active' | 'acquired' | 'dropped' | 'all';
const filterLabels: Record<Filter, string> = { active: 'Actius', acquired: 'Adquirits', dropped: 'Descartats', all: 'Tots' };

function matches(item: WishlistItem, f: Filter): boolean {
  const s: WishlistStatus = item.status;
  if (f === 'all') return true;
  if (f === 'active') return s === 'wanted' || s === 'watching';
  return s === f;
}

type Dialog =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'acquire'; id: string };

function safeLink(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function WishlistPage({ repository }: { repository: ShirtRepository }) {
  const load = useCallback(async () => {
    const [items, teams, shirts] = await Promise.all([repository.listWishlist(), repository.listTeams(), repository.listShirts()]);
    return { items, teams, shirts };
  }, [repository]);
  const { data, loading, error, reload } = useAsync(load);
  const [filter, setFilter] = useState<Filter>('active');
  const [dialog, setDialog] = useState<Dialog>({ type: 'none' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const items = data?.items ?? [];
  const visible = useMemo(
    () => items.filter((i) => matches(i, filter)).sort((a, b) => a.priority - b.priority || a.team.name.localeCompare(b.team.name, 'ca')),
    [items, filter],
  );
  const selected = dialog.type !== 'none' && dialog.type !== 'create' ? items.find((i) => i.id === dialog.id) : undefined;
  const brands = useMemo(() => (data ? facetOptions(data.shirts).brands : []), [data]);

  const close = () => {
    setDialog({ type: 'none' });
    setActionError(null);
  };

  async function save(input: WishlistInput) {
    if (dialog.type === 'edit' && selected) await repository.updateWishlistItem(selected.id, input);
    else await repository.createWishlistItem(input);
    close();
    await reload();
  }

  async function remove() {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      await repository.deleteWishlistItem(selected.id);
      close();
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No s’ha pogut eliminar');
    } finally {
      setBusy(false);
    }
  }

  /** Crea la samarreta a partir del desig i només després el marca com a adquirit (així mai es duplica). */
  async function acquire(input: ShirtInput) {
    if (!selected) return;
    const shirt = await repository.createShirt(input);
    close();
    try {
      await repository.markWishlistAcquired(selected.id, shirt.id);
      setNotice(`${shirt.team.name} s’ha afegit a la col·lecció i el desig s’ha marcat com a adquirit.`);
    } catch (e) {
      setNotice(
        `La samarreta s’ha afegit a la col·lecció, però no s’ha pogut marcar el desig com a adquirit (${e instanceof Error ? e.message : 'error'}). Edita’l i canvia l’estat a mà.`,
      );
    }
    await reload();
  }

  if (loading) return <Spinner />;
  if (error || !data)
    return (
      <div role="alert" className="rounded-xl border border-line bg-card p-8 text-center">
        <p className="font-display text-xl font-bold">No s&rsquo;ha pogut carregar la llista de desitjos</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <button type="button" className={`${buttonCls} mt-4`} onClick={() => void reload()}>
          Torna-ho a provar
        </button>
      </div>
    );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtre d’estat" className="flex overflow-hidden rounded-md border border-line">
          {(Object.keys(filterLabels) as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm ${filter === f ? 'bg-ink text-paper' : 'bg-card text-ink'}`}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
        <button type="button" className={`${primaryCls} sm:ml-auto`} onClick={() => setDialog({ type: 'create' })}>
          Afegeix un desig
        </button>
      </div>
      {notice && (
        <p role="status" className="mb-4 rounded-md bg-accent/10 px-4 py-2 text-sm">
          {notice}
        </p>
      )}
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
          {items.length === 0 ? 'Encara no tens cap desig. Afegeix les samarretes que vols aconseguir.' : 'Cap desig en aquest filtre.'}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((w) => {
            const buy = safeLink(w.purchaseUrl);
            return (
              <li key={w.id} className="rounded-xl border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold">{w.team.name}</p>
                    <p className="text-sm text-muted">
                      {[w.season, w.kitType ? kitTypeLabels[w.kitType] : null, w.playerName].filter(Boolean).join(' · ') || 'Sense més dades'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs">P{w.priority}</span>
                </div>
                <p className="mt-2 text-sm">
                  <span className="font-medium">{wishlistStatusLabels[w.status]}</span>
                  {w.maxPrice !== null && <span> · màx. {formatMoney(w.maxPrice)}</span>}
                </p>
                {w.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{w.notes}</p>}
                {buy && (
                  <p className="mt-1 text-sm">
                    <a href={buy} target="_blank" rel="noopener noreferrer" className="underline">
                      Enllaç de compra
                    </a>
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {w.status !== 'acquired' && (
                    <button type="button" className={primaryCls} onClick={() => setDialog({ type: 'acquire', id: w.id })}>
                      Ja la tinc
                    </button>
                  )}
                  <button type="button" className={buttonCls} onClick={() => setDialog({ type: 'edit', id: w.id })}>
                    Edita
                  </button>
                  <button type="button" className={buttonCls} onClick={() => setDialog({ type: 'delete', id: w.id })}>
                    Elimina
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialog.type === 'create' && <WishlistFormDialog teams={data.teams} onSubmit={save} onClose={close} />}
      {dialog.type === 'edit' && selected && <WishlistFormDialog item={selected} teams={data.teams} onSubmit={save} onClose={close} />}
      {dialog.type === 'acquire' && selected && (
        <ShirtFormDialog
          teams={data.teams}
          brands={brands}
          initial={{
            teamName: selected.team.name,
            teamKind: selected.team.kind,
            country: selected.team.country ?? '',
            season: selected.season ?? '',
            kitType: selected.kitType ?? '',
            playerName: selected.playerName ?? '',
          }}
          onSubmit={acquire}
          onClose={close}
        />
      )}
      {dialog.type === 'delete' && selected && (
        <ConfirmDialog
          title="Eliminar desig"
          message={`Vols eliminar el desig ${selected.team.name}${selected.season ? ` ${selected.season}` : ''}? Aquesta acció no es pot desfer.`}
          confirmLabel="Elimina"
          busy={busy}
          error={actionError}
          onConfirm={() => void remove()}
          onCancel={close}
        />
      )}
    </div>
  );
}

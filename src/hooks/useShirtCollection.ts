import { useCallback, useEffect, useState } from 'react';
import type { ShirtRepository } from '../services/shirtRepository';
import type { Shirt, ShirtImage, ShirtInput, Team } from '../types/shirt';

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'S’ha produït un error inesperat';
}

export function useShirtCollection(repo: ShirtRepository) {
  const [shirts, setShirts] = useState<Shirt[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [images, setImages] = useState<ShirtImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [s, t, i] = await Promise.all([repo.listShirts(), repo.listTeams(), repo.listImages()]);
    setShirts(s);
    setTeams(t);
    setImages(i);
    setLastSync(new Date());
  }, [repo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refresh();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Actualització silenciosa (no amaga la llista): un error només mostra un avís. */
  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await refresh();
    } catch (e) {
      setSyncError(messageOf(e));
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  // Al tornar a la pestanya (p. ex. després d'editar des del mòbil) es refresquen les dades.
  useEffect(() => {
    if (repo.persistence !== 'cloud') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [repo, sync]);

  // Les mutacions llancen l'error perquè el formulari el pugui mostrar.
  const create = useCallback(
    async (input: ShirtInput) => {
      const created = await repo.createShirt(input);
      await refresh();
      return created;
    },
    [repo, refresh],
  );
  const update = useCallback(
    async (id: string, input: ShirtInput) => {
      const updated = await repo.updateShirt(id, input);
      await refresh();
      return updated;
    },
    [repo, refresh],
  );
  const remove = useCallback(
    async (id: string) => {
      await repo.deleteShirt(id);
      await refresh();
    },
    [repo, refresh],
  );

  return { shirts, teams, images, loading, error, reload: load, sync, syncing, syncError, lastSync, create, update, remove };
}

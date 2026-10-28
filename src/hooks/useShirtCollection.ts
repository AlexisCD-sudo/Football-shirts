import { useCallback, useEffect, useState } from 'react';
import type { ShirtRepository } from '../services/shirtRepository';
import type { Shirt, ShirtInput, Team } from '../types/shirt';

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'S’ha produït un error inesperat';
}

export function useShirtCollection(repo: ShirtRepository) {
  const [shirts, setShirts] = useState<Shirt[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [s, t] = await Promise.all([repo.listShirts(), repo.listTeams()]);
    setShirts(s);
    setTeams(t);
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

  return { shirts, teams, loading, error, reload: load, create, update, remove };
}

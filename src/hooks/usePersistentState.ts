import { useCallback, useState } from 'react';

/** Preferència de visualització per dispositiu (no són dades de la col·lecció). */
export function usePersistentState<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored && (allowed as readonly string[]).includes(stored)) return stored as T;
    } catch {
      /* localStorage pot no estar disponible */
    }
    return initial;
  });
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        /* ignorat */
      }
    },
    [key],
  );
  return [value, update] as const;
}

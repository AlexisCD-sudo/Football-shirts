import type { Bucket } from '../lib/stats';

/** Llista de barres horitzontals senzilla i accessible (el valor sempre és text, no només color). */
export function BarList({ title, items, max = 8 }: { title: string; items: Bucket[]; max?: number }) {
  const shown = items.slice(0, max);
  const rest = items.slice(max).reduce((a, b) => a + b.count, 0);
  const top = Math.max(1, ...items.map((i) => i.count));
  return (
    <section aria-label={title} className="rounded-xl border border-line bg-card p-4">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Encara no hi ha dades.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {shown.map((b) => (
            <li key={b.label} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-2 text-sm">
              <span className="truncate" title={b.label}>
                {b.label}
              </span>
              <span className="h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
                <span className="block h-full rounded-full bg-accent" style={{ width: `${(b.count / top) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums">{b.count}</span>
            </li>
          ))}
          {rest > 0 && <li className="text-xs text-muted">+ {rest} més</li>}
        </ul>
      )}
    </section>
  );
}

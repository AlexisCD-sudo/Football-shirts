import { kitTypeLabels } from '../lib/labels';
import type { Shirt } from '../types/shirt';
import { ShirtPhoto } from './ShirtPhoto';

interface Props {
  shirt: Shirt;
  view: 'grid' | 'list';
  onOpen: (shirt: Shirt) => void;
  /** Té candidates de foto pendents de revisar. */
  hasCandidates?: boolean;
}

function subtitle(s: Shirt): string {
  return [s.season, s.kitType ? kitTypeLabels[s.kitType] : null].filter(Boolean).join(' · ');
}

function extra(s: Shirt): string | null {
  const player = [s.playerName, s.squadNumber !== null ? `#${s.squadNumber}` : null].filter(Boolean).join(' ');
  return player || null;
}

export function ShirtCard({ shirt, view, onOpen, hasCandidates }: Props) {
  const badge = hasCandidates ? (
    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-ink">Per revisar</span>
  ) : null;
  if (view === 'list') {
    return (
      <li>
        <button
          type="button"
          onClick={() => onOpen(shirt)}
          className="flex w-full items-center gap-4 rounded-lg border border-line bg-card p-2 text-left transition hover:border-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="block h-16 w-14 shrink-0 overflow-hidden rounded-md">
            <ShirtPhoto shirt={shirt} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-lg font-bold">{shirt.team.name}{badge}</span>
            <span className="block truncate text-sm text-muted">{subtitle(shirt) || 'Sense més dades'}</span>
          </span>
          {extra(shirt) && <span className="hidden text-sm text-muted sm:block">{extra(shirt)}</span>}
        </button>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(shirt)}
        className="group block w-full overflow-hidden rounded-xl border border-line bg-card text-left transition duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-lg focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="block aspect-[4/5] overflow-hidden">
          <ShirtPhoto shirt={shirt} />
        </span>
        <span className="block px-3.5 pb-3.5 pt-3">
          <span className="block truncate font-display text-lg font-bold leading-tight">{shirt.team.name}{badge}</span>
          <span className="mt-0.5 block h-5 truncate text-sm text-muted">{subtitle(shirt)}</span>
          <span className="block h-5 truncate text-sm">{extra(shirt) ?? ' '}</span>
        </span>
      </button>
    </li>
  );
}

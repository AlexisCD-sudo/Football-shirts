import { usePersistentState } from '../hooks/usePersistentState';
import type { ShirtRepository } from '../services/shirtRepository';
import { CatalogPage } from './CatalogPage';
import { FinancePage } from './FinancePage';
import { StatsPage } from './StatsPage';
import { WishlistPage } from './WishlistPage';

const SECTIONS = ['collection', 'wishlist', 'finance', 'stats'] as const;
type Section = (typeof SECTIONS)[number];
const labels: Record<Section, string> = {
  collection: 'Col·lecció',
  wishlist: 'Desitjos',
  finance: 'Finances',
  stats: 'Estadístiques',
};

export function Workspace({ repository, readOnly = false }: { repository: ShirtRepository; readOnly?: boolean }) {
  const [section, setSection] = usePersistentState<Section>('fsc.section', 'collection', [...SECTIONS]);
  const sections = readOnly ? (['collection', 'stats'] as const) : SECTIONS;
  const current: Section = sections.some((x) => x === section) ? section : 'collection';
  return (
    <div>
      <nav aria-label="Seccions" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {sections.map((s) => (
          <button
            key={s}
            type="button"
            aria-current={current === s ? 'page' : undefined}
            onClick={() => setSection(s)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              current === s ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {labels[s]}
          </button>
        ))}
      </nav>
      {current === 'collection' && <CatalogPage repository={repository} readOnly={readOnly} />}
      {!readOnly && current === 'wishlist' && <WishlistPage repository={repository} />}
      {!readOnly && current === 'finance' && <FinancePage repository={repository} />}
      {current === 'stats' && <StatsPage repository={repository} readOnly={readOnly} />}
    </div>
  );
}

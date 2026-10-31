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
  if (readOnly) return <CatalogPage repository={repository} readOnly />;
  return (
    <div>
      <nav aria-label="Seccions" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            aria-current={section === s ? 'page' : undefined}
            onClick={() => setSection(s)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              section === s ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {labels[s]}
          </button>
        ))}
      </nav>
      {section === 'collection' && <CatalogPage repository={repository} />}
      {section === 'wishlist' && <WishlistPage repository={repository} />}
      {section === 'finance' && <FinancePage repository={repository} />}
      {section === 'stats' && <StatsPage repository={repository} />}
    </div>
  );
}

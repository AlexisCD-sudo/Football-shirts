import { useState } from 'react';
import { buttonCls } from './components/ui';
import { useTheme } from './hooks/useTheme';
import { CatalogPage } from './pages/CatalogPage';
import { MemoryShirtRepository } from './services/memoryShirtRepository';
import type { ShirtRepository } from './services/shirtRepository';

export default function App({ repository }: { repository?: ShirtRepository }) {
  // Fins a la fase 3 (Supabase) les dades només viuen a la sessió.
  const [repo] = useState<ShirtRepository>(() => repository ?? new MemoryShirtRepository());
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="font-display text-2xl font-bold leading-none">Football Shirt Collection</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">L&rsquo;arxiu de samarretes</p>
          </div>
          <button type="button" className={buttonCls} onClick={toggle} aria-label="Canvia el mode clar o fosc">
            {theme === 'dark' ? 'Mode clar' : 'Mode fosc'}
          </button>
        </div>
      </header>
      {repo.persistence === 'memory' && (
        <p role="note" className="bg-accent/10 px-4 py-2 text-center text-xs text-ink">
          Mode provisional: les dades només es conserven mentre no recarreguis la pàgina. El desat al núvol
          arriba amb la fase 3.
        </p>
      )}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <CatalogPage repository={repo} />
      </main>
    </div>
  );
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { useMemo, useState, type ReactNode } from 'react';
import { Spinner, buttonCls } from './components/ui';
import { useAuth } from './hooks/useAuth';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useTheme } from './hooks/useTheme';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { CatalogPage } from './pages/CatalogPage';
import { LoginPage } from './pages/LoginPage';
import { MemoryShirtRepository } from './services/memoryShirtRepository';
import type { ShirtRepository } from './services/shirtRepository';
import { SupabaseShirtRepository } from './services/supabaseShirtRepository';

function Shell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const { theme, toggle } = useTheme();
  const online = useOnlineStatus();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <h1 className="font-display text-2xl font-bold leading-none">Football Shirt Collection</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">L&rsquo;arxiu de samarretes</p>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button type="button" className={buttonCls} onClick={toggle} aria-label="Canvia el mode clar o fosc">
              {theme === 'dark' ? 'Mode clar' : 'Mode fosc'}
            </button>
          </div>
        </div>
      </header>
      {!online && (
        <p role="status" className="bg-red-700/15 px-4 py-2 text-center text-xs text-ink">
          Sense connexió a Internet. Pots veure el que ja s&rsquo;ha carregat, però els canvis no es desaran fins que tornis a estar en línia.
        </p>
      )}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

function MemoryApp({ repository }: { repository: ShirtRepository }) {
  return (
    <Shell>
      {repository.persistence === 'memory' && (
        <p role="note" className="mb-5 rounded-md bg-accent/10 px-4 py-2 text-center text-xs text-ink">
          Mode de prova sense Supabase configurat: les dades només es conserven mentre no recarreguis la pàgina.
        </p>
      )}
      <CatalogPage repository={repository} />
    </Shell>
  );
}

function CloudApp({ client }: { client: SupabaseClient }) {
  const { session, loading, signIn, signOut } = useAuth(client);
  // El repositori es recrea només si canvia l'usuari, no a cada renovació del token.
  const userId = session?.user.id;
  const repository = useMemo(() => (userId ? new SupabaseShirtRepository(client) : null), [client, userId]);

  if (loading) {
    return (
      <Shell>
        <Spinner label="Comprovant la sessió…" />
      </Shell>
    );
  }
  if (!session || !repository) {
    return (
      <Shell>
        <LoginPage onSignIn={signIn} />
      </Shell>
    );
  }
  return (
    <Shell
      actions={
        <>
          <span className="hidden text-xs text-muted md:inline">{session.user.email}</span>
          <button type="button" className={buttonCls} onClick={() => void signOut()}>
            Tanca la sessió
          </button>
        </>
      }
    >
      <CatalogPage key={userId} repository={repository} />
    </Shell>
  );
}

interface AppProps {
  /** Per a proves o desenvolupament: força un repositori concret. */
  repository?: ShirtRepository;
  /** Per a proves: força un client de Supabase concret. */
  client?: SupabaseClient | null;
}

export default function App({ repository, client }: AppProps) {
  const [fallback] = useState<ShirtRepository>(() => repository ?? new MemoryShirtRepository());
  if (repository) return <MemoryApp repository={repository} />;
  const resolved = client === undefined ? supabase : client;
  if (resolved && (client !== undefined || isSupabaseConfigured)) return <CloudApp client={resolved} />;
  return <MemoryApp repository={fallback} />;
}

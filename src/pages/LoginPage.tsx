import { useState, type FormEvent } from 'react';
import { inputCls, primaryCls } from '../components/ui';

export function LoginPage({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Introdueix el correu i la contrasenya.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSignIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No s’ha pogut iniciar la sessió.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-line bg-card p-7">
      <h2 className="font-display text-2xl font-bold">Inicia la sessió</h2>
      <p className="mt-1 text-sm text-muted">Accés privat a la teva col·lecció.</p>
      <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
        <div>
          <label htmlFor="login-email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Correu electrònic
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="login-password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Contrasenya
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        <button type="submit" className={`${primaryCls} w-full`} disabled={busy}>
          {busy ? 'Entrant…' : 'Entra'}
        </button>
      </form>
    </div>
  );
}

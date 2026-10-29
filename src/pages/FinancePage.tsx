import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Spinner, buttonCls, inputCls, primaryCls } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { computeFinance, wishlistBudget } from '../lib/finance';
import { formatMoney } from '../lib/format';
import type { ShirtRepository } from '../services/shirtRepository';

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

const money = (n: number | null) => (n === null ? '—' : (formatMoney(n) ?? '—'));

export function FinancePage({ repository }: { repository: ShirtRepository }) {
  const load = useCallback(async () => {
    const [shirts, budgets, wishlist] = await Promise.all([
      repository.listShirts(),
      repository.listBudgets(),
      repository.listWishlist(),
    ]);
    return { shirts, budgets, wishlist };
  }, [repository]);
  const { data, loading, error, reload } = useAsync(load);
  const finance = useMemo(() => (data ? computeFinance(data.shirts, data.budgets) : null), [data]);
  const wish = useMemo(() => (data ? wishlistBudget(data.wishlist) : null), [data]);

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveBudget(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const n = Number(amount.trim().replace(/\s/g, '').replace(',', '.'));
    if (!amount.trim() || !Number.isFinite(n) || n < 0) {
      setFormError('Escriu un import vàlid (0 o més).');
      return;
    }
    setSaving(true);
    try {
      await repository.setBudget(Number(year), n);
      setAmount('');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No s’ha pogut desar el pressupost');
    } finally {
      setSaving(false);
    }
  }

  async function removeBudget(y: number) {
    setFormError(null);
    try {
      await repository.deleteBudget(y);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No s’ha pogut eliminar el pressupost');
    }
  }

  if (loading) return <Spinner />;
  if (error || !finance || !wish || !data)
    return (
      <div role="alert" className="rounded-xl border border-line bg-card p-8 text-center">
        <p className="font-display text-xl font-bold">No s&rsquo;han pogut carregar les finances</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <button type="button" className={`${buttonCls} mt-4`} onClick={() => void reload()}>
          Torna-ho a provar
        </button>
      </div>
    );

  const budgetYears = new Set(data.budgets.map((b) => b.year));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Despesa total" value={money(finance.totalSpent)} note={`Preu ${money(finance.totalPrice)} + enviament ${money(finance.totalShipping)}`} />
        <Tile label="Preu mitjà" value={money(finance.averagePrice)} note={`${finance.priced} samarretes amb preu`} />
        <Tile label="Valor estimat" value={money(finance.estimatedTotal)} note={`${finance.estimatedCount} samarretes amb valor`} />
        <Tile
          label="Balanç estimat"
          value={money(finance.balance)}
          note={finance.balanceCount ? `Només ${finance.balanceCount} amb preu i valor` : 'Cal tenir preu i valor estimat'}
        />
      </div>
      {finance.unpriced > 0 && (
        <p className="text-sm text-muted">
          {finance.unpriced} samarretes no tenen preu: no es compten a cap import (no s&rsquo;inventa cap valor).
          {finance.undatedSpent > 0 && ` ${money(finance.undatedSpent)} de despesa no tenen data de compra i no entren a cap any.`}
        </p>
      )}

      <section aria-label="Pressupost per any" className="rounded-xl border border-line bg-card p-4">
        <h3 className="font-display text-lg font-bold">Despesa i pressupost per any</h3>
        {finance.byYear.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Encara no hi ha cap compra amb data ni cap pressupost.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-1 pr-3">Any</th>
                  <th className="py-1 pr-3">Compres</th>
                  <th className="py-1 pr-3">Despesa</th>
                  <th className="py-1 pr-3">Pressupost</th>
                  <th className="py-1 pr-3">Resta</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {finance.byYear.map((y) => (
                  <tr key={y.year} className="border-t border-line">
                    <td className="py-1.5 pr-3 font-medium">{y.year}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{y.count}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{money(y.spent)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{money(y.budget)}</td>
                    <td className={`py-1.5 pr-3 tabular-nums ${y.remaining !== null && y.remaining < 0 ? 'font-semibold text-red-700 dark:text-red-400' : ''}`}>
                      {y.remaining === null ? '—' : y.remaining < 0 ? `${money(y.remaining)} (superat)` : money(y.remaining)}
                    </td>
                    <td className="py-1.5 text-right">
                      {budgetYears.has(y.year) && (
                        <button type="button" className="text-xs underline" onClick={() => void removeBudget(y.year)} aria-label={`Elimina el pressupost de ${y.year}`}>
                          Treu pressupost
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form onSubmit={(e) => void saveBudget(e)} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">
            Any
            <input aria-label="Any del pressupost" type="number" min={1990} max={2100} className={`${inputCls} mt-1 w-28`} value={year} onChange={(e) => setYear(e.target.value)} />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">
            Import (€)
            <input aria-label="Import del pressupost" inputMode="decimal" className={`${inputCls} mt-1 w-36`} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <button type="submit" className={primaryCls} disabled={saving}>
            {saving ? 'Desant…' : 'Desa el pressupost'}
          </button>
        </form>
        {formError && (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
            {formError}
          </p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Les més cares" className="rounded-xl border border-line bg-card p-4">
          <h3 className="font-display text-lg font-bold">Les més cares</h3>
          {finance.mostExpensive.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Cap samarreta té preu.</p>
          ) : (
            <ol className="mt-3 space-y-1.5 text-sm">
              {finance.mostExpensive.map((m) => (
                <li key={m.id} className="flex justify-between gap-3">
                  <span className="truncate">{m.label}</span>
                  <span className="tabular-nums">{money(m.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section aria-label="Llista de desitjos" className="rounded-xl border border-line bg-card p-4">
          <h3 className="font-display text-lg font-bold">Llista de desitjos activa</h3>
          <p className="mt-2 text-2xl font-bold tabular-nums">{money(wish.total)}</p>
          <p className="mt-1 text-sm text-muted">
            Suma dels preus màxims de {wish.withPrice} desitjos.
            {wish.withoutPrice > 0 && ` ${wish.withoutPrice} més no tenen preu màxim i no se sumen.`}
          </p>
        </section>
      </div>
    </div>
  );
}

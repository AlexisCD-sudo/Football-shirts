import { useCallback, useMemo } from 'react';
import { BarList } from '../components/BarList';
import { Spinner, buttonCls } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { computeStats } from '../lib/stats';
import type { ShirtRepository } from '../services/shirtRepository';

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function StatsPage({ repository }: { repository: ShirtRepository }) {
  const load = useCallback(() => repository.listShirts(), [repository]);
  const { data: shirts, loading, error, reload } = useAsync(load);
  const stats = useMemo(() => (shirts ? computeStats(shirts) : null), [shirts]);

  if (loading) return <Spinner />;
  if (error || !stats)
    return (
      <div role="alert" className="rounded-xl border border-line bg-card p-8 text-center">
        <p className="font-display text-xl font-bold">No s&rsquo;han pogut carregar les estadístiques</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <button type="button" className={`${buttonCls} mt-4`} onClick={() => void reload()}>
          Torna-ho a provar
        </button>
      </div>
    );
  if (stats.total === 0)
    return <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">Encara no hi ha samarretes per mostrar estadístiques.</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Samarretes" value={stats.total} />
        <Tile label="Equips" value={stats.teams} />
        <Tile label="Països" value={stats.countries} />
        <Tile label="Temporades" value={stats.firstSeason ? `${stats.firstSeason} → ${stats.lastSeason}` : '—'} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <BarList title="Per equip" items={stats.byTeam} />
        <BarList title="Per país" items={stats.byCountry} />
        <BarList title="Per marca" items={stats.byBrand} />
        <BarList title="Per equipació" items={stats.byKit} />
        <BarList title="Per dècada" items={stats.byDecade} max={12} />
        <BarList title="Per estat" items={stats.byCondition} />
        <BarList title="Per versió" items={stats.byVersion} />
      </div>
      <section aria-label="Dades per completar" className="rounded-xl border border-line bg-card p-4">
        <h3 className="font-display text-lg font-bold">Dades per completar</h3>
        <p className="mt-1 text-sm text-muted">Quantes samarretes tenen cada dada (de {stats.total}).</p>
        <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
          {stats.completeness.map((c) => (
            <li key={c.key} className="flex justify-between gap-3">
              <span>{c.label}</span>
              <span className="tabular-nums">
                {c.have} / {stats.total} · falten {stats.total - c.have}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

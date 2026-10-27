import type { ReactNode } from 'react';
import type { CatalogFilters, Facets, SortKey } from '../lib/catalog';
import { kitTypeLabels, versionLabels } from '../lib/labels';
import { KIT_TYPES, VERSIONS, type KitType, type ShirtVersion } from '../types/shirt';
import { inputCls } from './ui';

interface Props {
  filters: CatalogFilters;
  facets: Facets;
  sort: SortKey;
  onFilters: (f: CatalogFilters) => void;
  onSort: (s: SortKey) => void;
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <select aria-label={label} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

export function FilterBar({ filters, facets, sort, onFilters, onSort }: Props) {
  const set = <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) =>
    onFilters({ ...filters, [key]: value });

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      <Select label="Filtra per equip" value={filters.team} onChange={(v) => set('team', v)}>
        <option value="">Tots els equips</option>
        {facets.teams.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </Select>
      <Select label="Filtra per país" value={filters.country} onChange={(v) => set('country', v)}>
        <option value="">Tots els països</option>
        {facets.countries.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>
      <Select label="Filtra per temporada" value={filters.season} onChange={(v) => set('season', v)}>
        <option value="">Totes les temporades</option>
        {facets.seasons.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Select>
      <Select label="Filtra per marca" value={filters.brand} onChange={(v) => set('brand', v)}>
        <option value="">Totes les marques</option>
        {facets.brands.map((b) => (
          <option key={b}>{b}</option>
        ))}
      </Select>
      <Select label="Filtra per equipació" value={filters.kitType} onChange={(v) => set('kitType', v as KitType | '')}>
        <option value="">Totes les equipacions</option>
        {KIT_TYPES.map((k) => (
          <option key={k} value={k}>
            {kitTypeLabels[k]}
          </option>
        ))}
      </Select>
      <Select label="Filtra per versió" value={filters.version} onChange={(v) => set('version', v as ShirtVersion | '')}>
        <option value="">Totes les versions</option>
        {VERSIONS.map((k) => (
          <option key={k} value={k}>
            {versionLabels[k]}
          </option>
        ))}
      </Select>
      <Select label="Filtra per fotografia" value={filters.photo} onChange={(v) => set('photo', v as CatalogFilters['photo'])}>
        <option value="all">Amb o sense foto</option>
        <option value="with">Amb foto</option>
        <option value="without">Sense foto</option>
      </Select>
      <Select label="Ordena" value={sort} onChange={(v) => onSort(v as SortKey)}>
        <option value="team">Ordena: equip</option>
        <option value="season-desc">Ordena: més recent primer</option>
        <option value="season-asc">Ordena: més antiga primer</option>
        <option value="recent">Ordena: afegides fa poc</option>
      </Select>
    </div>
  );
}

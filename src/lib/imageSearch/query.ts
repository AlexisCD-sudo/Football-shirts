import { kitTypeLabels } from '../labels';
import type { Shirt } from '../../types/shirt';

const KIT_EN: Record<string, string> = {
  home: 'home',
  away: 'away',
  third: 'third',
  goalkeeper: 'goalkeeper',
  special: 'special edition',
  training: 'training',
  other: '',
};

/** Equip i temporada tal com acostumen a aparèixer als títols (p. ex. «Barça 2010-11 home shirt»). */
export function buildQueries(shirt: Shirt): string[] {
  const team = shirt.team.name.trim();
  const season = shirt.season ?? '';
  const kit = shirt.kitType ? KIT_EN[shirt.kitType] : '';
  const player = shirt.playerName?.trim() ?? '';
  const base = [team, season].filter(Boolean).join(' ');
  const queries = [
    [base, kit, 'shirt'].filter(Boolean).join(' '),
    [base, 'jersey'].filter(Boolean).join(' '),
  ];
  if (player) queries.push([team, season, player, 'shirt'].filter(Boolean).join(' '));
  return [...new Set(queries.map((q) => q.replace(/\s+/g, ' ').trim()))];
}

/** Descripció llegible de la samarreta per al diàleg de cerca. */
export function describeShirt(shirt: Shirt): string {
  return [
    shirt.team.name,
    shirt.season,
    shirt.kitType ? kitTypeLabels[shirt.kitType] : null,
    shirt.playerName,
  ]
    .filter(Boolean)
    .join(' · ');
}

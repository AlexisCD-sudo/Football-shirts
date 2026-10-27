import type { Authenticity, KitType, ShirtCondition, ShirtVersion, TeamKind } from '../types/shirt';

export const teamKindLabels: Record<TeamKind, string> = { club: 'Club', national: 'Selecció' };

export const kitTypeLabels: Record<KitType, string> = {
  home: 'Local',
  away: 'Visitant',
  third: 'Tercera',
  goalkeeper: 'Porter',
  special: 'Edició especial',
  training: 'Entrenament',
  other: 'Altra',
};

export const versionLabels: Record<ShirtVersion, string> = {
  fan: 'Aficionat',
  player: 'Jugador',
  replica: 'Rèplica',
  unknown: 'Sense especificar',
};

export const conditionLabels: Record<ShirtCondition, string> = {
  new_with_tags: 'Nova amb etiquetes',
  new_without_tags: 'Nova sense etiquetes',
  excellent: 'Excel·lent',
  good: 'Bona',
  fair: 'Acceptable',
  poor: 'Dolenta',
};

export const authenticityLabels: Record<Authenticity, string> = {
  official: 'Oficial',
  reissue: 'Reedició oficial',
  replica: 'Rèplica',
  unverified: 'Sense verificar',
};

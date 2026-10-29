import type { KitType, TeamKind, WishlistInput, WishlistItem, WishlistStatus } from '../types/shirt';
import { KIT_TYPES, WISHLIST_STATUSES } from '../types/shirt';

export interface WishlistFormValues {
  teamName: string;
  teamKind: TeamKind;
  country: string;
  season: string;
  kitType: string;
  playerName: string;
  priority: string;
  maxPrice: string;
  purchaseUrl: string;
  referenceImageUrl: string;
  notes: string;
  status: string;
}

export const emptyWishlistValues: WishlistFormValues = {
  teamName: '',
  teamKind: 'club',
  country: '',
  season: '',
  kitType: '',
  playerName: '',
  priority: '3',
  maxPrice: '',
  purchaseUrl: '',
  referenceImageUrl: '',
  notes: '',
  status: 'wanted',
};

export function wishlistToFormValues(w: WishlistItem): WishlistFormValues {
  return {
    teamName: w.team.name,
    teamKind: w.team.kind,
    country: w.team.country ?? '',
    season: w.season ?? '',
    kitType: w.kitType ?? '',
    playerName: w.playerName ?? '',
    priority: String(w.priority),
    maxPrice: w.maxPrice === null ? '' : String(w.maxPrice).replace('.', ','),
    purchaseUrl: w.purchaseUrl ?? '',
    referenceImageUrl: w.referenceImageUrl ?? '',
    notes: w.notes ?? '',
    status: w.status,
  };
}

type Errors = Partial<Record<keyof WishlistFormValues, string>>;
export type WishlistParse = { ok: true; data: WishlistInput } | { ok: false; errors: Errors };

const opt = (s: string) => (s.trim() ? s.trim() : null);

function isHttp(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Accepta `2005-06` i la forma llarga `2005-2006` (es normalitza a `2005-06`). */
export function normalizeSeason(raw: string): string | null {
  const t = raw.trim().replace(/[–—/]/g, '-');
  const short = /^(\d{4})-(\d{2})$/.exec(t);
  const long = /^(\d{4})-(\d{4})$/.exec(t);
  const m = short ?? long;
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2].length === 4 ? Number(m[2]) % 100 : Number(m[2]);
  return (start + 1) % 100 === end ? `${m[1]}-${String(end).padStart(2, '0')}` : null;
}

export function parseWishlistForm(v: WishlistFormValues): WishlistParse {
  const errors: Errors = {};
  if (!v.teamName.trim()) errors.teamName = 'Escriu l’equip o la selecció.';
  let season: string | null = null;
  if (v.season.trim()) {
    season = normalizeSeason(v.season);
    if (!season) errors.season = 'Format de temporada: 2005-06.';
  }
  let maxPrice: number | null = null;
  if (v.maxPrice.trim()) {
    const n = Number(v.maxPrice.trim().replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) errors.maxPrice = 'Escriu un import vàlid (0 o més).';
    else maxPrice = Math.round(n * 100) / 100;
  }
  const priority = Number(v.priority);
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) errors.priority = 'La prioritat va d’1 a 5.';
  if (v.purchaseUrl.trim() && !isHttp(v.purchaseUrl.trim())) errors.purchaseUrl = 'L’enllaç ha de començar per http:// o https://';
  if (v.referenceImageUrl.trim() && !isHttp(v.referenceImageUrl.trim()))
    errors.referenceImageUrl = 'L’enllaç ha de començar per http:// o https://';
  const kit = v.kitType as KitType | '';
  if (kit && !KIT_TYPES.includes(kit)) errors.kitType = 'Equipació no vàlida.';
  if (!WISHLIST_STATUSES.includes(v.status as WishlistStatus)) errors.status = 'Estat no vàlid.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      teamName: v.teamName.trim(),
      teamKind: v.teamKind,
      country: opt(v.country),
      season,
      kitType: kit || null,
      playerName: opt(v.playerName),
      priority,
      maxPrice,
      purchaseUrl: opt(v.purchaseUrl),
      referenceImageUrl: opt(v.referenceImageUrl),
      notes: opt(v.notes),
      status: v.status as WishlistStatus,
    },
  };
}

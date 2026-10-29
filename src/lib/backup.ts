import type { Budget, Shirt, ShirtImage, Team, WishlistItem } from '../types/shirt';

export const BACKUP_FORMAT = 'football-shirts-backup';
export const BACKUP_VERSION = 2;

export interface BackupData {
  shirts: Shirt[];
  teams: Team[];
  images: ShirtImage[];
  wishlist: WishlistItem[];
  budgets: Budget[];
}

export interface BackupCounts {
  shirts: number;
  teams: number;
  images: number;
  wishlist: number;
  budgets: number;
}

export function backupFilename(now = new Date()): string {
  return `copia-seguretat-samarretes-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Còpia completa de les DADES: samarretes (amb la fila d'importació original), equips, metadades de fotos,
 * desitjos i pressupostos. Les fotos pròpies NO s'hi inclouen (només la ruta); les adreces signades són
 * temporals i es descarten.
 */
export function buildBackup(data: BackupData, now = new Date()) {
  const images = data.images.map((i) => (i.origin === 'stored' ? { ...i, imageUrl: null, thumbnailUrl: null } : i));
  const shirts = data.shirts.map((s) => {
    const { photoUrl, ...rest } = s; // la foto es recupera de les imatges
    void photoUrl;
    return rest;
  });
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    counts: {
      shirts: shirts.length,
      teams: data.teams.length,
      images: images.length,
      wishlist: data.wishlist.length,
      budgets: data.budgets.length,
    } satisfies BackupCounts,
    teams: data.teams,
    shirts,
    images,
    wishlist: data.wishlist,
    budgets: data.budgets,
    notes: 'Les fotos pròpies (origin "stored") no s’inclouen: només la ruta al bucket privat shirt-photos.',
  };
}

export function backupToJson(data: BackupData, now = new Date()): string {
  return JSON.stringify(buildBackup(data, now), null, 2);
}

export type BackupCheck =
  | { ok: true; exportedAt: string; counts: BackupCounts }
  | { ok: false; error: string };

/** Comprova que un fitxer és una còpia vàlida i que els recomptes coincideixen. No modifica res. */
export function inspectBackup(text: string): BackupCheck {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El fitxer no és un JSON vàlid.' };
  }
  const b = json as Record<string, unknown> | null;
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'Aquest fitxer no és una còpia de seguretat d’aquesta aplicació.' };
  }
  if (b.version !== BACKUP_VERSION) return { ok: false, error: `Versió de còpia no compatible (${String(b.version)}).` };
  const keys = ['shirts', 'teams', 'images', 'wishlist', 'budgets'] as const;
  const counts = {} as BackupCounts;
  for (const k of keys) {
    const v = b[k];
    if (!Array.isArray(v)) return { ok: false, error: `Falta la secció «${k}» o no és vàlida.` };
    counts[k] = v.length;
  }
  const declared = b.counts as Partial<BackupCounts> | undefined;
  for (const k of keys) {
    if (declared && declared[k] !== counts[k]) {
      return { ok: false, error: `La còpia sembla incompleta: «${k}» declara ${declared[k]} i en conté ${counts[k]}.` };
    }
  }
  return { ok: true, exportedAt: String(b.exportedAt ?? ''), counts };
}

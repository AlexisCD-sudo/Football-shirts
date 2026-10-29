import type { ImportItem } from '../lib/importer';
import type { ImageJob, ImageJobItem, ImageSource, Shirt, ShirtImage, ShirtInput, Team } from '../types/shirt';

/**
 * Contracte d'accés a les dades. A la fase 3 s'afegirà una implementació amb
 * Supabase sense canviar res de la interfície d'usuari.
 */
export interface ImportMeta {
  filename: string;
  columnMapping: Record<string, string>;
  summary: Record<string, unknown>;
}

export interface ImportReport {
  batchId: string;
  imported: number;
  failed: { sourceRow: number; message: string }[];
}

/** Candidata a desar a una samarreta (vinguda d'una font d'imatges o d'un enllaç manual). */
export interface NewCandidate {
  imageUrl: string;
  thumbnailUrl: string | null;
  sourcePageUrl: string;
  source: ImageSource;
  author: string | null;
  license: string | null;
  licenseUrl: string | null;
  matchScore: number | null;
}

export type ImageJobPatch = Partial<Pick<ImageJob, 'status' | 'done' | 'failed'>>;
export type ImageJobItemPatch = Partial<Pick<ImageJobItem, 'status' | 'attempts' | 'lastError' | 'candidatesFound'>>;

export interface ShirtRepository {
  /** `memory`: les dades només viuen a la sessió. `cloud`: persistides al servidor. */
  readonly persistence: 'memory' | 'cloud';
  listShirts(): Promise<Shirt[]>;
  listTeams(): Promise<Team[]>;
  createShirt(input: ShirtInput): Promise<Shirt>;
  updateShirt(id: string, input: ShirtInput): Promise<Shirt>;
  deleteShirt(id: string): Promise<void>;
  /**
   * Importa per lots. Mai elimina ni fusiona res i NO modifica els equips existents
   * (només en crea els que falten). Cada fila conserva la seva dada original.
   */
  importShirts(
    items: ImportItem[],
    meta: ImportMeta,
    onProgress?: (done: number, total: number) => void,
  ): Promise<ImportReport>;

  // ───────── Fotografies ─────────
  listImages(): Promise<ShirtImage[]>;
  /** Desa candidates noves. No repeteix mai una URL ja existent per a la samarreta (ni les rebutjades). Retorna quantes s'han afegit. */
  addCandidates(shirtId: string, candidates: NewCandidate[]): Promise<number>;
  /** Confirma una imatge com a foto principal; la que ho era passa a candidata. */
  confirmImage(imageId: string): Promise<void>;
  /** Treu la confirmació: la imatge torna a ser només una candidata. */
  unconfirmImage(imageId: string): Promise<void>;
  rejectImage(imageId: string): Promise<void>;
  /** Afegeix i confirma una imatge a partir d'un enllaç escrit per la persona. */
  addManualImage(shirtId: string, imageUrl: string, sourcePageUrl?: string): Promise<void>;
  deleteImage(imageId: string): Promise<void>;

  // ───────── Cerca per lots (persistent, amb pausa i represa) ─────────
  createImageJob(shirtIds: string[]): Promise<ImageJob>;
  getLatestImageJob(): Promise<{ job: ImageJob; items: ImageJobItem[] } | null>;
  updateImageJob(id: string, patch: ImageJobPatch): Promise<void>;
  updateImageJobItem(id: string, patch: ImageJobItemPatch): Promise<void>;
}
